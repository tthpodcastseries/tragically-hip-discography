// /js/tth-member-gate.js
//
// Guest pass and membersHIP sign-in for The Hip Handbook.
//
// Behavior (v5.4.16, audit PERF-01 / SEO-03 - no more full-screen wall):
//   - Reads the session from localStorage before the page renders.
//   - A first visit gets the same guest pass "Start exploring" used to give, silently,
//     so every page shows straight away with no reload.
//   - Guests see a slim sign-in bar at the top (closed for good with its X).
//     "Sign in" opens a pop-up with the first-name + membersHIP number form; a
//     successful unlock saves the session and reloads so the page boots as the member.
//
// Load with a plain <script> tag at the very top of <body>:
//   <script src="/js/tth-member-gate.js"></script>
//
// Public API (window.TTHMember):
//   getSession()              -> { memberNumber, firstName, attendedShows, guest } | null
//   isUnlocked()              -> boolean
//   signOut()                 -> a member becomes a guest and the sign-in pop-up opens
//                                after the reload; a guest just gets the pop-up
//   signInWithNumber()        -> opens the sign-in pop-up; a guest's shows merge in on unlock
//   hasShow(id)               -> boolean
//   addShow(id)               -> Promise<void>
//   removeShow(id)            -> Promise<void>
//   toggleShow(id)            -> Promise<boolean>   // resolves true if now attended
//   onChange(cb)              -> unsubscribe fn
//
// Session persistence:
//   localStorage key: 'tth_member_session'
//   Shape: { memberNumber: number, firstName: string, attendedShows: string[], unlockedAt: number, guest?: true }

// Album and tour names in the data files use "Day For Night" casing. The Brand & Style Guide
// writes the five albums with lowercase prepositions, so pages show them through this
// (audit BRAND-04). The data files are not changed. Loaded first on every page that needs it.
window.tthAlbumCase = function (text) {
  return text == null ? text : String(text)
    .replace(/\bUp To Here\b/g, 'Up to Here')
    .replace(/\bDay For Night\b/g, 'Day for Night')
    .replace(/\bTrouble At The Henhouse\b/g, 'Trouble at the Henhouse')
    .replace(/\bWe Are The Same\b/g, 'We Are the Same')
    .replace(/\bNow For Plan A\b/g, 'Now for Plan A');
};

(function () {
  'use strict';

  var STORAGE_KEY = 'tth_member_session';
  var SUPABASE_URL = 'https://deqslacywpwnjjckdygp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcXNsYWN5d3B3bmpqY2tkeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQyNjEsImV4cCI6MjA5MDczMDI2MX0.rrawa18owCmKbmryWRi6ROJX146FTqis2OGVT68K7jM';

  // Guest pass for every visitor, and the public press credential. These never hit
  // Supabase; the session is local-only. Any attended-show toggles a guest makes
  // stay in their own device's localStorage and never touch a real member row.
  var GUEST_FIRST_NAME = 'TheHip';
  var GUEST_NUMBER = 1984;

  var BAR_CLOSED_KEY = 'tth_signin_bar_closed'; // the fan closed the sign-in bar on this device
  var BAR_SEEN_KEY = 'tth_signin_bar_seen';     // 'Sign-in bar - Shown' counts devices, not page views
  var OPEN_KEY = 'tth_open_signin';             // sessionStorage: open the pop-up after "Switch member"

  // Load any existing session immediately (sync, from localStorage)
  var session = null;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.memberNumber === 'number' && parsed.firstName) {
        if (!Array.isArray(parsed.attendedShows)) parsed.attendedShows = [];
        parsed.attendedShows = parsed.attendedShows.map(String);
        session = parsed;
      }
    }
  } catch (e) { session = null; }

  var subscribers = [];
  function notify() {
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](session); } catch (e) {}
    }
  }

  function persistLocal() {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // Guest shows left waiting by the old sign-in flow (before v5.4.16) or by the claim
  // page get merged into the member's list on unlock (audit FUNC-02)
  var PENDING_KEY = 'tth_guest_shows_pending';
  function readPending() {
    try {
      var list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return Array.isArray(list) ? list.map(String) : [];
    } catch (e) { return []; }
  }
  function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
  }

  function guestSession(shows) {
    return { memberNumber: GUEST_NUMBER, firstName: GUEST_FIRST_NAME, attendedShows: shows, unlockedAt: Date.now(), guest: true };
  }

  // Database errors arrive as codes; turn them into something a fan can act on
  function friendlyError(err) {
    var msg = (err && err.message) || '';
    if (msg.indexOf('too_many_attempts') !== -1) return 'Too many tries from here. Give it an hour and try again.';
    if (msg.indexOf('invalid_credentials') !== -1) return 'No match. Check yer name and number.';
    if (msg.indexOf('too_many_removed') !== -1) return 'That would remove a lot of shows at once, so it wasn\'t saved.';
    return msg || 'Something went wrong. Try again.';
  }

  // Lazy supabase loader
  var sbClient = null;
  var sbPromise = null;
  function getSupabase() {
    if (sbClient) return Promise.resolve(sbClient);
    if (sbPromise) return sbPromise;
    sbPromise = new Promise(function (resolve, reject) {
      function init() {
        try {
          sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          resolve(sbClient);
        } catch (e) { reject(e); }
      }
      if (window.supabase) { init(); return; }
      var s = document.createElement('script');
      s.src = '/js/supabase.min.js';
      s.onload = init;
      s.onerror = function () { reject(new Error('Failed to load Supabase.')); };
      document.head.appendChild(s);
    });
    return sbPromise;
  }

  function persistRemote() {
    persistLocal();
    notify();
    if (!session) return Promise.resolve();
    // Guest sessions are local-only — never write to Supabase.
    if (session.guest) return Promise.resolve();
    return getSupabase().then(function (sb) {
      return sb.rpc('update_attended_shows', {
        p_first_name: session.firstName,
        p_number: session.memberNumber,
        p_shows: session.attendedShows
      });
    }).then(function (res) {
      if (res && res.error) throw res.error;
      return res && res.data;
    });
  }

  // No wall (v5.4.16): a first visit gets the guest pass straight away
  if (!session) {
    session = guestSession(readPending());
    persistLocal();
    clearPending();
  }

  // Public API
  var TTHMember = {
    getSession: function () {
      if (!session) return null;
      return {
        memberNumber: session.memberNumber,
        firstName: session.firstName,
        attendedShows: session.attendedShows.slice(),
        // Guest sessions are local-only; the Passport needs to tell them apart (v5)
        guest: !!session.guest
      };
    },
    isUnlocked: function () { return !!session; },
    // Guest -> member sign-in without losing the guest's shows (audit FUNC-02)
    signInWithNumber: function () { openSignIn('Sign-in - Opened'); },
    friendlyError: friendlyError,
    signOut: function () {
      if (session && session.guest) { openSignIn('Sign-in - Opened'); return; }
      session = guestSession([]);
      persistLocal();
      notify();
      try { sessionStorage.setItem(OPEN_KEY, '1'); } catch (e) {}
      location.reload();
    },
    hasShow: function (id) {
      if (!session) return false;
      return session.attendedShows.indexOf(String(id)) !== -1;
    },
    addShow: function (id) {
      if (!session) return Promise.reject(new Error('Not unlocked'));
      id = String(id);
      if (session.attendedShows.indexOf(id) === -1) session.attendedShows.push(id);
      return persistRemote();
    },
    removeShow: function (id) {
      if (!session) return Promise.reject(new Error('Not unlocked'));
      id = String(id);
      session.attendedShows = session.attendedShows.filter(function (s) { return s !== id; });
      return persistRemote();
    },
    toggleShow: function (id) {
      if (!session) return Promise.reject(new Error('Not unlocked'));
      id = String(id);
      var isAdd = session.attendedShows.indexOf(id) === -1;
      if (isAdd) session.attendedShows.push(id);
      else session.attendedShows = session.attendedShows.filter(function (s) { return s !== id; });
      return persistRemote().then(function () { return isAdd; });
    },
    onChange: function (cb) {
      subscribers.push(cb);
      return function () {
        var i = subscribers.indexOf(cb);
        if (i > -1) subscribers.splice(i, 1);
      };
    }
  };
  window.TTHMember = TTHMember;

  // Anonymous Umami events (v4.8) so we can see how sign-in is used. Event names
  // only - never names or numbers. Umami loads deferred, so wait for it briefly;
  // resolves within 800ms either way so redirects never hang.
  function track(name) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      setTimeout(finish, 800);
      (function attempt(tries) {
        if (window.umami && typeof window.umami.track === 'function') {
          try {
            var p = window.umami.track(name);
            if (p && typeof p.then === 'function') p.then(finish, finish); else finish();
          } catch (e) { finish(); }
        } else if (tries > 0) {
          setTimeout(function () { attempt(tries - 1); }, 100);
        } else {
          finish();
        }
      })(50);
    });
  }

  function stored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key) { try { localStorage.setItem(key, '1'); } catch (e) {} }

  var css = [
    '#tth-signin-bar { display:flex; align-items:center; gap:10px; padding:8px 12px 8px 16px; background:#141414; border-bottom:1px solid #2a2a2a; font-family:Poppins,sans-serif; font-size:0.8rem; line-height:1.4; color:#d9d9d9; }',
    '#tth-signin-bar p { flex:1; min-width:0; margin:0; }',
    '#tth-signin-bar b { color:#fff; font-weight:600; }',
    '#tth-signin-bar button { font-family:Poppins,sans-serif; cursor:pointer; min-height:44px; }',
    '#tth-signin-bar .sb-open { flex-shrink:0; padding:0 14px; background:transparent; color:#fff; border:1px solid rgba(204,162,60,0.6); border-radius:8px; font-size:0.78rem; font-weight:600; }',
    '#tth-signin-bar .sb-open:hover { background:rgba(204,162,60,0.1); border-color:#CCA23C; }',
    '#tth-signin-bar .sb-close { flex-shrink:0; width:44px; background:none; border:none; color:#d9d9d9; font-size:1.3rem; line-height:1; }',
    '#tth-signin-bar button:focus-visible { outline:2px solid #CCA23C; outline-offset:2px; }',
    '@media (max-width: 480px) { #tth-signin-bar .sb-more { display:none; } }',
    '#tth-signin { border:none; padding:0; margin:auto; background:transparent; width:calc(100% - 32px); max-width:440px; max-height:calc(100% - 32px); overflow:auto; color:#d9d9d9; }',
    '#tth-signin::backdrop { background:rgba(0,0,0,0.78); }',
    '#tth-signin .mg-card { position:relative; background:#0e0b16; border:1px solid #2a2a2a; border-radius:14px; padding:2rem 1.25rem 1.5rem; text-align:center; font-family:Poppins,sans-serif; }',
    '#tth-signin .mg-x { position:absolute; top:6px; right:6px; width:44px; height:44px; background:none; border:none; color:#d9d9d9; font-size:1.4rem; line-height:1; cursor:pointer; }',
    '#tth-signin .mg-maple { font-size:2rem; display:block; margin-bottom:10px; }',
    // No uppercase on these - it would flatten the membersHIP brand casing
    '#tth-signin .mg-title { font-size:1.35rem; font-weight:800; color:#fff; line-height:1.2; margin:0 0 0.6rem; }',
    '#tth-signin .mg-sub { font-size:0.88rem; line-height:1.6; color:#d9d9d9; margin:0 0 1.2rem; }',
    '#tth-signin a { color:#fff; text-decoration:underline; text-decoration-color:#CCA23C; text-underline-offset:3px; font-weight:600; }',
    '#tth-signin button:focus-visible, #tth-signin a:focus-visible { outline:2px solid #fff; outline-offset:3px; }',
    '#tth-signin form { display:flex; flex-direction:column; gap:0.75rem; text-align:left; }',
    '#tth-signin .mg-fields { display:flex; gap:0.6rem; }',
    '#tth-signin .mg-fields > div { flex:1; min-width:0; }',
    '#tth-signin label { font-size:0.72rem; font-weight:500; letter-spacing:0.5px; color:#d9d9d9; margin-bottom:0.35rem; display:block; }',
    '#tth-signin input { width:100%; padding:0.8rem 0.9rem; background:#141414; border:1px solid #2a2a2a; border-radius:8px; color:#fff; font-family:Poppins,sans-serif; font-size:1rem; transition:border-color 0.15s; }',
    '#tth-signin input:focus { outline:2px solid #CCA23C; outline-offset:2px; border-color:#CCA23C; }',
    '#tth-signin .mg-unlock { width:100%; padding:0.95rem; background:#C8102E; color:#fff; border:none; border-radius:8px; font-family:Poppins,sans-serif; font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; cursor:pointer; }',
    '#tth-signin .mg-unlock:hover:not(:disabled) { background:#a60d26; }',
    '#tth-signin .mg-unlock:disabled { opacity:0.6; cursor:not-allowed; }',
    '#tth-signin .mg-err { color:#fff; font-size:0.85rem; min-height:1.2em; text-align:center; }',
    '#tth-signin .mg-claim { font-size:0.85rem; color:#b0b0b0; margin:1rem 0 0; }',
    '#tth-signin .mg-privacy { font-size:0.75rem; color:#909090; margin-top:1rem; }',
    '#tth-signin .mg-privacy a { color:#d9d9d9; text-decoration:underline; text-decoration-color:#CCA23C; text-underline-offset:3px; }'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.id = 'tth-member-gate-css';
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // ─── Sign-in bar ───
  // Written in before the rest of the page is parsed, so it never pushes content down
  // after the first paint. Not on the claim page, which has its own form.
  var onClaimPage = /forum-invite/.test(location.pathname);
  if (session.guest && !onClaimPage && !stored(BAR_CLOSED_KEY)) {
    var bar = document.createElement('div');
    bar.id = 'tth-signin-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'membersHIP sign-in');
    bar.innerHTML =
      '<p><b>Got a membersHIP number?</b> <span class="sb-more">Sign in to keep yer shows on any device.</span></p>' +
      '<button type="button" class="sb-open">Sign in</button>' +
      '<button type="button" class="sb-close" aria-label="Close the sign-in bar for good">&times;</button>';
    var here = document.currentScript;
    if (here && here.parentNode === document.body) here.insertAdjacentElement('afterend', bar);
    else if (document.body) document.body.insertBefore(bar, document.body.firstChild);
    // Keep "Skip to content" first in the Tab order (it sits off-screen, so nothing moves)
    document.addEventListener('DOMContentLoaded', function () {
      var skip = document.querySelector('body > .skip-link');
      if (skip && bar.parentNode === document.body && (skip.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_PRECEDING)) {
        skip.insertAdjacentElement('afterend', bar);
      }
    });
    bar.querySelector('.sb-open').addEventListener('click', function () { openSignIn('Sign-in bar - Open'); });
    bar.querySelector('.sb-close').addEventListener('click', function () {
      store(BAR_CLOSED_KEY);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
      track('Sign-in bar - Closed');
    });
    if (!stored(BAR_SEEN_KEY)) { store(BAR_SEEN_KEY); track('Sign-in bar - Shown'); }
  }

  // ─── Sign-in pop-up ───
  var dialogHtml =
    '<div class="mg-card">' +
      '<button type="button" class="mg-x" id="mg-x" aria-label="Close">&times;</button>' +
      '<span class="mg-maple" aria-hidden="true">&#127809;</span>' +
      '<h2 id="mg-title" class="mg-title">Got a membersHIP number?</h2>' +
      // Members' shows sync via update_attended_shows; guest shows never leave the device
      '<p class="mg-sub">Sign in to save the shows you were at and build yer own concert history, on any device. As a guest, yer shows stay on this one device.</p>' +
      '<form id="mg-form" novalidate autocomplete="on">' +
        '<div class="mg-fields">' +
          '<div>' +
            '<label for="mg-first">First name</label>' +
            '<input id="mg-first" name="first_name" type="text" autocomplete="given-name" autocapitalize="words" required>' +
          '</div>' +
          '<div>' +
            '<label for="mg-num">membersHIP number</label>' +
            '<input id="mg-num" name="member_number" type="text" inputmode="numeric" pattern="[0-9]{1,7}" maxlength="7" autocomplete="off" required>' +
          '</div>' +
        '</div>' +
        '<div class="mg-err" id="mg-err" role="alert"></div>' +
        '<button id="mg-btn" class="mg-unlock" type="submit">Unlock yer shows</button>' +
      '</form>' +
      '<p class="mg-claim">No number yet? <a id="mg-claim-link" href="/forum-invite.html">Get one free - takes 10 seconds.</a></p>' +
      '<p class="mg-privacy">No email. No password. Nothing to buy. <a href="/privacy.html">Privacy</a></p>' +
    '</div>';

  var dialog = null;

  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.id = 'tth-signin';
    dialog.setAttribute('aria-labelledby', 'mg-title');
    dialog.innerHTML = dialogHtml;
    document.body.appendChild(dialog);

    var firstEl = document.getElementById('mg-first');
    var numEl = document.getElementById('mg-num');
    var errEl = document.getElementById('mg-err');
    var btn = document.getElementById('mg-btn');
    var form = document.getElementById('mg-form');

    document.getElementById('mg-x').addEventListener('click', function () { dialog.close(); });
    // A tap on the dark area around the card closes it too
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

    document.getElementById('mg-claim-link').addEventListener('click', function (e) {
      e.preventDefault();
      var href = this.href;
      track('Gate - Claim click').then(function () { location.href = href; });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.textContent = '';
      var first = firstEl.value.trim();
      var numStr = numEl.value.trim();

      if (!first) { errEl.textContent = 'Yer first name is required.'; return; }
      if (!/^[0-9]{1,7}$/.test(numStr)) {
        errEl.textContent = 'Number must be 1 to 7 digits.';
        return;
      }
      var num = parseInt(numStr, 10);

      // Shows marked as a guest on this device come along
      var guestShows = (session && session.guest ? session.attendedShows : []).slice();
      readPending().forEach(function (id) { if (guestShows.indexOf(id) === -1) guestShows.push(id); });

      // Press credential: the same guest pass everyone already has, without hitting Supabase.
      if (first.toLowerCase() === GUEST_FIRST_NAME.toLowerCase() && num === GUEST_NUMBER) {
        session = guestSession(guestShows);
        persistLocal();
        clearPending();
        notify();
        dialog.close();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Unlocking...';

      var sbRef;
      getSupabase().then(function (sb) {
        sbRef = sb;
        return sb.rpc('unlock_member', { p_first_name: first, p_number: num });
      }).then(function (res) {
        if (res && res.error) throw res.error;
        var data = res && res.data;
        if (!data) throw new Error('No match. Check yer name and number.');

        var shows = (data.attended_shows || []).map(String);
        var added = guestShows.filter(function (id) { return shows.indexOf(id) === -1; });
        session = {
          memberNumber: data.membership_number,
          firstName: data.first_name,
          attendedShows: shows.concat(added),
          unlockedAt: Date.now()
        };
        persistLocal();
        if (!added.length) { clearPending(); return; }
        // Keep the guest copy until the merge is saved, so a failed save can try again next sign-in
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(added)); } catch (e2) {}
        return sbRef.rpc('update_attended_shows', {
          p_first_name: session.firstName,
          p_number: session.memberNumber,
          p_shows: session.attendedShows
        }).then(function (r) {
          if (!(r && r.error)) clearPending();
        }, function () {});
      }).then(function () {
        // Reload so the rest of the page boots with the member's session in place.
        track('Gate - Member unlock').then(function () { location.reload(); });
      }).catch(function (err) {
        errEl.textContent = friendlyError(err);
        btn.disabled = false;
        btn.textContent = 'Unlock yer shows';
        track('Gate - Unlock failed');
      });
    });
  }

  function openSignIn(eventName, prefillFirst) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { openSignIn(eventName, prefillFirst); });
      return;
    }
    if (!dialog) buildDialog();
    if (dialog.open) return;
    document.getElementById('mg-err').textContent = '';
    if (prefillFirst) document.getElementById('mg-first').value = prefillFirst;
    dialog.showModal();
    // The fan asked to sign in, so going straight to the form is fine (keyboard included)
    try { document.getElementById(prefillFirst ? 'mg-num' : 'mg-first').focus(); } catch (e) {}
    if (eventName) track(eventName);
  }

  // Arrived from the invite reveal screen with ?first=: open the pop-up with the
  // name filled in. Strip the param so it doesn't linger in the address bar.
  var prefill = '';
  try {
    var params = new URLSearchParams(location.search);
    prefill = (params.get('first') || '').trim();
    if (prefill) {
      params.delete('first');
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
  } catch (e) { /* ignore */ }

  var reopen = false;
  try { reopen = sessionStorage.getItem(OPEN_KEY) === '1'; sessionStorage.removeItem(OPEN_KEY); } catch (e) {}

  if (session.guest && (prefill || reopen)) openSignIn(prefill ? 'Sign-in - Opened from invite' : 'Sign-in - Opened', prefill);
})();
