// /js/tth-auth.js
// Shared auth gate for The Hip Compendium.
// Email + password only. Google and Apple sign-in were removed deliberately.
//
// Load with a plain <script> tag at the very top of <body>:
//   <script src="/js/tth-auth.js"></script>
// Requires /js/supabase.min.js to also be loaded on the page (defer in <head> is fine).

(function () {
  var SUPABASE_URL = 'https://deqslacywpwnjjckdygp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcXNsYWN5d3B3bmpqY2tkeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQyNjEsImV4cCI6MjA5MDczMDI2MX0.rrawa18owCmKbmryWRi6ROJX146FTqis2OGVT68K7jM';

  // Skip the gate entirely on local dev (file://, localhost, 127.0.0.1)
  var isLocal = location.protocol === 'file:'
             || location.hostname === 'localhost'
             || location.hostname === '127.0.0.1';
  if (isLocal) return;

  var gateHtml = `
<div id="authGate" style="display:flex;position:fixed;inset:0;z-index:99999;background:#0e0b16;font-family:Poppins,sans-serif;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
  <h1 style="color:#C8102E;font-size:1.4rem;letter-spacing:0.15em;margin:0;">THE HIP COMPENDIUM</h1>
  <p style="color:#aaa;font-size:0.85rem;margin:0;text-align:center;max-width:300px;">Create a free account or log in to access The Hip Compendium.</p>
  <div id="authTabs" style="display:flex;gap:0;margin-top:8px;">
    <button id="tabLogin" onclick="showAuthTab('login')" style="background:#C8102E;color:#fff;border:none;padding:8px 20px;border-radius:6px 0 0 6px;font-size:0.8rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;">Log In</button>
    <button id="tabSignup" onclick="showAuthTab('signup')" style="background:transparent;color:#C8102E;border:1px solid #C8102E;border-left:none;padding:8px 20px;border-radius:0 6px 6px 0;font-size:0.8rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;">Sign Up</button>
  </div>
  <div id="authFormLogin" style="display:flex;flex-direction:column;gap:10px;width:260px;">
    <input id="authEmail" type="email" placeholder="Email" autocomplete="email" aria-label="Email address" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:6px;font-size:0.9rem;font-family:Poppins,sans-serif;width:100%;">
    <input id="authPass" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:6px;font-size:0.9rem;font-family:Poppins,sans-serif;width:100%;" onkeydown="if(event.key==='Enter')document.getElementById('authSubmitLogin').click()">
    <button id="authSubmitLogin" onclick="handleLogin()" style="background:#C8102E;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:0.85rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;width:100%;">Log In</button>
  </div>
  <div id="authFormSignup" style="display:none;flex-direction:column;gap:10px;width:260px;">
    <input id="authEmailSignup" type="email" placeholder="Email" autocomplete="email" aria-label="Email address for signup" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:6px;font-size:0.9rem;font-family:Poppins,sans-serif;width:100%;">
    <input id="authPassSignup" type="password" placeholder="Password" autocomplete="new-password" aria-label="Password for signup" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:6px;font-size:0.9rem;font-family:Poppins,sans-serif;width:100%;">
    <input id="authPassConfirm" type="password" placeholder="Confirm Password" autocomplete="new-password" aria-label="Confirm password" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:6px;font-size:0.9rem;font-family:Poppins,sans-serif;width:100%;" onkeydown="if(event.key==='Enter')document.getElementById('authSubmitSignup').click()">
    <button id="authSubmitSignup" onclick="handleSignup()" style="background:#C8102E;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:0.85rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;width:100%;">Sign Up</button>
  </div>
  <p id="authError" style="color:#C8102E;font-size:0.78rem;margin:0;text-align:center;max-width:260px;min-height:1.2em;"></p>
</div>`.trim();

  // ----- Tab switcher -----
  window.showAuthTab = function (tab) {
    var tl = document.getElementById('tabLogin');
    var ts = document.getElementById('tabSignup');
    var fl = document.getElementById('authFormLogin');
    var fs = document.getElementById('authFormSignup');
    var err = document.getElementById('authError');
    if (err) { err.textContent = ''; err.style.color = '#C8102E'; }
    if (tab === 'login') {
      fl.style.display = 'flex'; fs.style.display = 'none';
      tl.style.background = '#C8102E'; tl.style.color = '#fff'; tl.style.border = 'none';
      ts.style.background = 'transparent'; ts.style.color = '#C8102E'; ts.style.border = '1px solid #C8102E'; ts.style.borderLeft = 'none';
    } else {
      fl.style.display = 'none'; fs.style.display = 'flex';
      ts.style.background = '#C8102E'; ts.style.color = '#fff'; ts.style.border = 'none';
      tl.style.background = 'transparent'; tl.style.color = '#C8102E'; tl.style.border = '1px solid #C8102E'; tl.style.borderRight = 'none';
    }
  };

  // ----- Email/password login -----
  window.handleLogin = async function () {
    var err = document.getElementById('authError');
    err.textContent = '';
    err.style.color = '#C8102E';
    if (!window.tthSupabase) { err.textContent = 'Loading, please try again...'; return; }
    var email = document.getElementById('authEmail').value.trim();
    var pass = document.getElementById('authPass').value;
    if (!email || !pass) { err.textContent = 'Please enter email and password.'; return; }
    var res = await window.tthSupabase.auth.signInWithPassword({ email: email, password: pass });
    if (res.error) err.textContent = res.error.message;
  };

  // ----- Email/password signup -----
  window.handleSignup = async function () {
    var err = document.getElementById('authError');
    err.textContent = '';
    err.style.color = '#C8102E';
    if (!window.tthSupabase) { err.textContent = 'Loading, please try again...'; return; }
    var email = document.getElementById('authEmailSignup').value.trim();
    var pass = document.getElementById('authPassSignup').value;
    var confirm = document.getElementById('authPassConfirm').value;
    if (!email || !pass) { err.textContent = 'Please enter email and password.'; return; }
    if (pass !== confirm) { err.textContent = 'Passwords do not match.'; return; }
    var res = await window.tthSupabase.auth.signUp({ email: email, password: pass });
    if (res.error) {
      err.textContent = res.error.message;
    } else {
      err.style.color = '#4CAF50';
      err.textContent = 'Check your email to confirm your account.';
    }
  };

  // ----- Inject the gate as the first child of <body> -----
  function injectGate() {
    if (!document.body) {
      // body not parsed yet; try again on next frame
      requestAnimationFrame(injectGate);
      return;
    }
    if (!document.getElementById('authGate')) {
      document.body.insertAdjacentHTML('afterbegin', gateHtml);
    }
    initSupabase();
  }
  injectGate();

  // ----- Supabase init + session handling -----
  function initSupabase() {
    if (typeof supabase === 'undefined') {
      // Supabase SDK not loaded yet; retry shortly
      setTimeout(initSupabase, 100);
      return;
    }

    window.tthSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function addLogout() {
      if (document.getElementById('tth-logout')) return;
      var btn = document.createElement('button');
      btn.id = 'tth-logout';
      btn.textContent = 'Log Out';
      btn.onclick = async function () {
        await window.tthSupabase.auth.signOut();
        window.location.reload();
      };
      btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9998;background:rgba(14,11,22,0.9);color:#888;border:1px solid #333;padding:6px 14px;border-radius:6px;font-size:0.7rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;transition:color 0.2s;';
      btn.onmouseenter = function () { btn.style.color = '#C8102E'; };
      btn.onmouseleave = function () { btn.style.color = '#888'; };
      document.body.appendChild(btn);
    }

    window.tthSupabase.auth.getSession().then(function (res) {
      if (res.data.session) {
        var g = document.getElementById('authGate');
        if (g) g.remove();
        addLogout();
      }
    });

    window.tthSupabase.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        var g = document.getElementById('authGate');
        if (g) g.remove();
        addLogout();
      }
      if (event === 'SIGNED_OUT') {
        window.location.reload();
      }
    });
  }
})();
