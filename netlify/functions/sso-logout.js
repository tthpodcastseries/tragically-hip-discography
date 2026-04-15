// Netlify Function: clears Flarum SSO cookies and redirects back.
//
// Invoked by the Maicol07 SSO extension's "Logout URL" — Flarum hits this when
// a user logs out on the forum, and the Compendium can hit it too when a
// member signs out of the site.

const COMPENDIUM_URL = 'https://compendium.tthpods.com';

function expire(name) {
  return [
    name + '=',
    'Domain=.tthpods.com',
    'Path=/',
    'Max-Age=0',
    'Secure',
    'HttpOnly',
    'SameSite=Lax'
  ].join('; ');
}

exports.handler = async function (event) {
  // Redirect target: back to the compendium by default, or whatever ?return=
  // points at, as long as it's a subdomain of tthpods.com.
  var target = COMPENDIUM_URL + '/';
  try {
    var params = event.queryStringParameters || {};
    if (params.return && /^https:\/\/[a-z0-9.-]+\.tthpods\.com\//.test(params.return)) {
      target = params.return;
    }
  } catch (e) {}

  return {
    statusCode: 302,
    multiValueHeaders: {
      'Set-Cookie': [
        expire('flarum_remember_token'),
        expire('flarum_session'),
        expire('flarum_token')
      ],
      'Location': [target],
      'Cache-Control': ['no-store']
    },
    body: ''
  };
};
