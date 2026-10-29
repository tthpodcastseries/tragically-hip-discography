// /js/tth-member-gate.js
//
// Member gate for The Hip Handbook.
//
// Behavior:
//   - Before any page content renders, checks localStorage for a valid member session.
//   - If no session, injects a full-screen opaque overlay with a first-name + membersHIP
//     number form. On successful unlock via Supabase RPC, persists session and reloads
//     so the rest of the page scripts boot with TTHMember fully hydrated.
//   - If session exists, exposes window.TTHMember and lets the page render normally.
//
// Skipped on localhost / file:// for dev convenience.
//
// Load with a plain <script> tag at the very top of <body>, after tth-launch-gate.js:
//   <script src="/js/tth-launch-gate.js"></script>
//   <script src="/js/tth-member-gate.js"></script>
//
// Public API (window.TTHMember):
//   getSession()              -> { memberNumber, firstName, attendedShows, guest } | null
//   isUnlocked()              -> boolean
//   signOut()                 -> clears local session and reloads
//   hasShow(id)               -> boolean
//   addShow(id)               -> Promise<void>
//   removeShow(id)            -> Promise<void>
//   toggleShow(id)            -> Promise<boolean>   // resolves true if now attended
//   onChange(cb)              -> unsubscribe fn
//
// Session persistence:
//   localStorage key: 'tth_member_session'
//   Shape: { memberNumber: number, firstName: string, attendedShows: string[], unlockedAt: number }

(function () {
  'use strict';

  var STORAGE_KEY = 'tth_member_session';
  var SUPABASE_URL = 'https://deqslacywpwnjjckdygp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcXNsYWN5d3B3bmpqY2tkeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQyNjEsImV4cCI6MjA5MDczMDI2MX0.rrawa18owCmKbmryWRi6ROJX146FTqis2OGVT68K7jM';

  // Guest bypass for press / external reviewers. These credentials never hit
  // Supabase; the session is local-only. Any attended-show toggles a guest
  // makes stay in their own device's localStorage and never touch a real
  // member row. Safe to share publicly.
  var GUEST_FIRST_NAME = 'TheHip';
  var GUEST_NUMBER = 1984;

  // Skip on local dev
  var isLocal = location.protocol === 'file:'
             || location.hostname === 'localhost'
             || location.hostname === '127.0.0.1';

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
    signOut: function () {
      session = null;
      persistLocal();
      notify();
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

  // On local dev, inject a stub session so pages work without hitting Supabase.
  // Marked guest so persistRemote() stays local-only — otherwise every toggle
  // fires an RPC as ('dev', 0), which the function rejects with
  // invalid_credentials and the caller silently rolls back.
  if (isLocal && !session) {
    session = { memberNumber: 0, firstName: 'dev', attendedShows: [], unlockedAt: Date.now(), guest: true };
  }

  // If we have a session, we're done. Page renders normally.
  if (session) return;

  // If the pre-launch gate is showing, bail out. The launch gate reloads on
  // unlock, at which point this script runs fresh and takes over cleanly.
  if (document.getElementById('passGate')) return;

  // No session: hide page content and render the gate.
  // Anti-flash: insert a style that keeps body hidden until we mount the overlay.
  var hideStyle = document.createElement('style');
  hideStyle.id = 'tth-member-gate-hide';
  hideStyle.textContent = 'body > *:not(#tth-member-gate) { visibility: hidden !important; }';
  (document.head || document.documentElement).appendChild(hideStyle);

  var gateCss = [
    '#tth-member-gate { position:fixed; inset:0; z-index:2147483647; background:#0e0b16; display:flex; align-items:flex-start; justify-content:center; padding:2rem 1rem; font-family:Poppins,sans-serif; overflow-y:auto; visibility:visible !important; }',
    '#tth-member-gate::before { content:""; position:absolute; inset:0; background:radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,16,46,0.22) 0%, transparent 70%); pointer-events:none; }',
    '#tth-member-gate .mg-card { position:relative; max-width:440px; width:100%; text-align:center; margin:auto 0; }',
    '#tth-member-gate .mg-maple { font-size:2rem; display:block; margin-bottom:12px; }',
    '#tth-member-gate .mg-eyebrow { text-transform:uppercase; font-size:0.7rem; font-weight:600; letter-spacing:3px; color:#CCA23C; margin-bottom:0.6rem; }',
    '#tth-member-gate .mg-title { font-size:clamp(1.8rem,5vw,2.6rem); font-weight:800; color:#fff; line-height:1.15; margin:0 0 0.6rem; }',
    '#tth-member-gate .mg-title span { color:#C8102E; }',
    '#tth-member-gate .mg-sub { font-size:0.92rem; line-height:1.6; color:#d9d9d9; margin:0 0 1.4rem; }',
    '#tth-member-gate a { color:#CCA23C; text-decoration:none; font-weight:600; }',
    '#tth-member-gate a:hover { text-decoration:underline; }',
    '#tth-member-gate button { width:100%; padding:1rem; background:#C8102E; color:#fff; border:none; border-radius:8px; font-family:Poppins,sans-serif; font-size:0.95rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:background 0.15s, border-color 0.15s, color 0.15s; }',
    '#tth-member-gate button:hover:not(:disabled) { background:#a60d26; }',
    '#tth-member-gate button:disabled { opacity:0.6; cursor:not-allowed; }',
    '#tth-member-gate .mg-start { font-size:1.05rem; padding:1.1rem; }',
    '#tth-member-gate .mg-member { margin-top:1.75rem; padding-top:1.4rem; border-top:1px solid #2a2a2a; text-align:left; }',
    // No uppercase on these - it would flatten the membersHIP brand casing
    '#tth-member-gate .mg-member-title { font-size:0.95rem; font-weight:700; color:#fff; margin:0 0 0.85rem; text-align:center; }',
    '#tth-member-gate form { display:flex; flex-direction:column; gap:0.75rem; }',
    '#tth-member-gate .mg-fields { display:flex; gap:0.6rem; }',
    '#tth-member-gate .mg-fields > div { flex:1; min-width:0; }',
    '#tth-member-gate label { font-size:0.72rem; font-weight:500; letter-spacing:0.5px; color:#d9d9d9; margin-bottom:0.35rem; display:block; }',
    '#tth-member-gate input { width:100%; padding:0.8rem 0.9rem; background:#141414; border:1px solid #2a2a2a; border-radius:8px; color:#fff; font-family:Poppins,sans-serif; font-size:1rem; transition:border-color 0.15s; }',
    '#tth-member-gate input:focus { outline:none; border-color:#CCA23C; }',
    '#tth-member-gate .mg-unlock { background:transparent; color:#CCA23C; border:1px solid rgba(204,162,60,0.6); font-size:0.85rem; padding:0.85rem; }',
    '#tth-member-gate .mg-unlock:hover:not(:disabled) { background:rgba(204,162,60,0.1); border-color:#CCA23C; }',
    '#tth-member-gate .mg-err { color:#ff6b6b; font-size:0.85rem; min-height:1.2em; text-align:center; }',
    '#tth-member-gate .mg-claim { font-size:0.85rem; color:#b0b0b0; text-align:center; margin:0.25rem 0 0; }',
    '#tth-member-gate .mg-why { font-size:0.8rem; line-height:1.55; color:#b0b0b0; background:#141414; border:1px solid #2a2a2a; border-radius:10px; padding:0.85rem 1rem; margin:1rem 0 0; }',
    '#tth-member-gate .mg-why b { color:#fff; font-weight:600; }',
    '#tth-member-gate .mg-privacy { font-size:0.75rem; color:#909090; margin-top:1.25rem; text-align:center; }'
  ].join('\n');

  // Guest-first layout (v4.8): the big button lets anyone straight in; the
  // membersHIP sign-in sits below it as an option, never a wall.
  var gateHtml =
    '<style>' + gateCss + '</style>' +
    '<div class="mg-card">' +
      '<span class="mg-maple" aria-hidden="true">&#127809;</span>' +
      '<div class="mg-eyebrow">Free for every Hip fan</div>' +
      '<h1 class="mg-title">Yer <span>Handbook</span></h1>' +
      '<p class="mg-sub">Every release, 1,355 live shows, lyrics, and rare recordings. No account needed.</p>' +
      '<button id="mg-guest-btn" class="mg-start" type="button">Start exploring</button>' +
      '<div class="mg-member">' +
        '<p class="mg-member-title">Got a membersHIP number?</p>' +
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
        // Members' shows sync via update_attended_shows; guest shows never leave the device
        '<p class="mg-why"><b>Why grab one?</b> Save the Hip shows you were at and build yer own concert history, on any device. As a guest, yer shows stay on this one device.</p>' +
      '</div>' +
      '<p class="mg-privacy">No email. No password. Nothing to buy.</p>' +
    '</div>';

  // Anonymous Umami events (v4.8) so we can see where visitors drop off at the
  // gate. Event names only - never names or numbers. Umami loads deferred, so
  // wait for it briefly; resolves within 800ms either way so redirects never hang.
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

  function mountGate() {
    if (!document.body) {
      requestAnimationFrame(mountGate);
      return;
    }
    if (document.getElementById('tth-member-gate')) return;

    var gate = document.createElement('div');
    gate.id = 'tth-member-gate';
    gate.innerHTML = gateHtml;
    document.body.insertBefore(gate, document.body.firstChild);

    var firstEl = document.getElementById('mg-first');
    var numEl = document.getElementById('mg-num');
    var errEl = document.getElementById('mg-err');
    var btn = document.getElementById('mg-btn');
    var form = document.getElementById('mg-form');

    // If we arrived from the invite reveal screen, pre-fill the first name and
    // jump focus straight to the number field. Strip the param so it doesn't
    // linger in the address bar.
    var prefillFirst = '';
    try {
      var params = new URLSearchParams(location.search);
      prefillFirst = (params.get('first') || '').trim();
      if (prefillFirst) {
        params.delete('first');
        var qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      }
    } catch (e) { /* ignore */ }

    // Only jump into the form for someone arriving with a name to finish -
    // auto-focusing it for everyone popped the phone keyboard over the
    // Start exploring button (v4.8)
    if (prefillFirst) {
      firstEl.value = prefillFirst;
      setTimeout(function () { try { numEl.focus(); } catch (e) {} }, 60);
    }

    track('Gate - Shown');

    var guestBtn = document.getElementById('mg-guest-btn');
    guestBtn.addEventListener('click', function () {
      guestBtn.disabled = true;
      session = {
        memberNumber: GUEST_NUMBER,
        firstName: GUEST_FIRST_NAME,
        attendedShows: [],
        unlockedAt: Date.now(),
        guest: true
      };
      persistLocal();
      track('Gate - Start exploring').then(function () { location.reload(); });
    });

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

      // Guest bypass: match the public press credential without hitting Supabase.
      if (first.toLowerCase() === GUEST_FIRST_NAME.toLowerCase() && num === GUEST_NUMBER) {
        session = {
          memberNumber: GUEST_NUMBER,
          firstName: GUEST_FIRST_NAME,
          attendedShows: [],
          unlockedAt: Date.now(),
          guest: true
        };
        persistLocal();
        location.reload();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Unlocking...';

      getSupabase().then(function (sb) {
        return sb.rpc('unlock_member', { p_first_name: first, p_number: num });
      }).then(function (res) {
        if (res && res.error) throw res.error;
        var data = res && res.data;
        if (!data) throw new Error('No match. Check yer name and number.');

        session = {
          memberNumber: data.membership_number,
          firstName: data.first_name,
          attendedShows: (data.attended_shows || []).map(String),
          unlockedAt: Date.now()
        };
        persistLocal();
        // Reload so the rest of the page boots with the session in place.
        track('Gate - Member unlock').then(function () { location.reload(); });
      }).catch(function (err) {
        errEl.textContent = (err && err.message) || 'Something went wrong. Try again.';
        btn.disabled = false;
        btn.textContent = 'Unlock yer shows';
        track('Gate - Unlock failed');
      });
    });
  }

  mountGate();
})();
