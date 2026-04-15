// Netlify Function: exchange a membersHIP credential for a Flarum session cookie.
//
// Flow:
//   1. Client POSTs { first_name, member_number } from the Compendium page.
//   2. We re-verify via Supabase unlock_member RPC (never trust the client).
//   3. We sign a short-lived JWT in the Maicol07 SSO format.
//   4. We hit forum.tthpods.com/api/sso/jwt with Bearer <jwt>.
//   5. Flarum returns { token, userId }. We set that as flarum_remember cookie
//      on .tthpods.com and 302-redirect the browser to the forum.
//
// Guest bypass (TheHip/1984) is rejected — guests do not get forum access.

const jwt = require('jsonwebtoken');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SIGNER_KEY = process.env.SSO_SIGNER_KEY;

const FORUM_URL = 'https://forum.tthpods.com';
const ISSUER = 'tthpods.com';
const COMPENDIUM_URL = 'https://compendium.tthpods.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Defense-in-depth: only accept submissions from the Compendium itself.
  var origin = event.headers.origin || event.headers.Origin;
  var referer = event.headers.referer || event.headers.Referer || '';
  if (origin && origin !== COMPENDIUM_URL) {
    return { statusCode: 403, body: 'Forbidden origin' };
  }
  if (!origin && referer.indexOf(COMPENDIUM_URL) !== 0) {
    return { statusCode: 403, body: 'Forbidden referer' };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SIGNER_KEY) {
    return { statusCode: 500, body: 'SSO not configured' };
  }

  // Parse form-encoded or JSON body.
  var firstName = '';
  var memberNumber = 0;
  try {
    var ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    if (ct.indexOf('application/json') === 0) {
      var parsed = JSON.parse(event.body || '{}');
      firstName = (parsed.first_name || '').trim();
      memberNumber = parseInt(parsed.member_number, 10);
    } else {
      var params = new URLSearchParams(event.body || '');
      firstName = (params.get('first_name') || '').trim();
      memberNumber = parseInt(params.get('member_number'), 10);
    }
  } catch (e) {
    return { statusCode: 400, body: 'Bad request' };
  }

  if (!firstName || !memberNumber || memberNumber < 1 || memberNumber > 9999999) {
    return { statusCode: 400, body: 'Missing credentials' };
  }

  // Reject the public press/guest bypass explicitly.
  if (firstName.toLowerCase() === 'thehip' && memberNumber === 1984) {
    return { statusCode: 403, body: 'Guest accounts cannot access Yer Discussions.' };
  }

  // Server-side re-verify via Supabase RPC. Never trust client-side state.
  var rpcUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/unlock_member';
  var rpcRes;
  try {
    rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_first_name: firstName, p_number: memberNumber })
    });
  } catch (e) {
    return { statusCode: 502, body: 'Upstream auth error' };
  }

  if (!rpcRes.ok) {
    return { statusCode: 401, body: 'Could not verify membersHIP' };
  }

  var member;
  try {
    member = await rpcRes.json();
  } catch (e) {
    return { statusCode: 502, body: 'Malformed auth response' };
  }

  if (!member || !member.membership_number || !member.first_name) {
    return { statusCode: 401, body: 'No match. Check yer name and number.' };
  }

  // Build the Maicol07 SSO JWT payload. Use the verified values from Supabase,
  // not whatever the client submitted.
  var verifiedName = String(member.first_name).trim();
  var verifiedNumber = Number(member.membership_number);
  var usernameSlug = verifiedName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!usernameSlug) usernameSlug = 'member';
  var username = usernameSlug + '_' + verifiedNumber;
  var email = verifiedNumber + '@compendium.tthpods.com';

  var token;
  try {
    // avatarUrl must be a non-null string: the Maicol07 JWTSSOController reads
    // it and calls strpos() on the value, which throws a TypeError on PHP 8.1+
    // if the field is absent (returns null from Arr::get). Empty string is safe.
    token = jwt.sign({
      iss: ISSUER,
      aud: FORUM_URL,
      remember: true,
      user: {
        id: verifiedNumber,
        attributes: {
          email: email,
          username: username,
          avatarUrl: ''
        }
      }
    }, SIGNER_KEY, {
      algorithm: 'HS256',
      expiresIn: '60s'
    });
  } catch (e) {
    return { statusCode: 500, body: 'Could not sign SSO token' };
  }

  // Exchange the JWT for a real Flarum session token.
  var flarumRes;
  try {
    flarumRes = await fetch(FORUM_URL + '/api/sso/jwt', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      }
    });
  } catch (e) {
    return { statusCode: 502, body: 'Forum unreachable' };
  }

  if (!flarumRes.ok) {
    var errText = '';
    try { errText = await flarumRes.text(); } catch (e) {}
    return {
      statusCode: 502,
      body: 'Forum rejected SSO token: ' + flarumRes.status + ' ' + errText.slice(0, 200)
    };
  }

  var flarumJson;
  try {
    flarumJson = await flarumRes.json();
  } catch (e) {
    return { statusCode: 502, body: 'Malformed forum response' };
  }

  var flarumToken = flarumJson && flarumJson.token;
  if (!flarumToken) {
    return { statusCode: 502, body: 'No token in forum response' };
  }

  // Set the Flarum remember cookie on .tthpods.com so the forum subdomain reads it.
  // 60 days matches Flarum's default RememberAccessToken lifetime.
  var cookie = [
    'flarum_remember_token=' + encodeURIComponent(flarumToken),
    'Domain=.tthpods.com',
    'Path=/',
    'Max-Age=5184000',
    'Secure',
    'HttpOnly',
    'SameSite=Lax'
  ].join('; ');

  return {
    statusCode: 302,
    headers: {
      'Location': FORUM_URL + '/',
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store'
    },
    body: ''
  };
};
