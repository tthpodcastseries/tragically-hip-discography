// /js/tth-launch-gate.js
//
// Pre-launch gate for The Hip Compendium.
//
// Behavior:
//   - Before LAUNCH_TIME: shows a password gate with a live countdown timer.
//     Correct password ('roadapples') unlocks the site for this device.
//   - At/after LAUNCH_TIME: gate is bypassed entirely. Site is fully public.
//   - On localhost / file://: gate is skipped (dev convenience).
//
// Load with a plain <script> tag at the very top of <body>:
//   <script src="/js/tth-auth.js"></script>

(function () {
  // Launch target: April 20, 2026 at 8:00 PM Eastern Daylight Time.
  // Stored as an absolute moment in time, so users in any timezone unlock simultaneously.
  var LAUNCH_TIME = new Date('2026-04-20T20:00:00-04:00').getTime();
  var PASSWORD = 'roadapples';
  var STORAGE_KEY = 'tth_pass';

  // Skip on local dev
  var isLocal = location.protocol === 'file:'
             || location.hostname === 'localhost'
             || location.hostname === '127.0.0.1';
  if (isLocal) return;

  // Skip if launch has already happened
  if (Date.now() >= LAUNCH_TIME) return;

  // Skip if this device has already entered the password
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch (e) {
    // localStorage may be blocked (private browsing on some browsers).
    // Fall through and show the gate every time in that case.
  }

  var gateHtml = `
<div id="passGate" style="display:flex;position:fixed;inset:0;z-index:100000;background:#0e0b16;font-family:Poppins,sans-serif;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:20px;box-sizing:border-box;">
  <h1 style="color:#C8102E;font-size:1.4rem;letter-spacing:0.15em;margin:0;text-align:center;">THE HIP COMPENDIUM</h1>
  <p style="color:#aaa;font-size:0.85rem;margin:0;text-align:center;max-width:300px;">This site is in pre-launch. Enter the password to continue.</p>
  <div id="countdown" style="display:flex;gap:18px;margin:8px 0 4px;flex-wrap:wrap;justify-content:center;">
    <div style="text-align:center;"><span id="cdDays" style="color:#C8102E;font-size:1.8rem;font-weight:700;display:block;">--</span><span style="color:#666;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;">Days</span></div>
    <div style="text-align:center;"><span id="cdHrs" style="color:#C8102E;font-size:1.8rem;font-weight:700;display:block;">--</span><span style="color:#666;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;">Hours</span></div>
    <div style="text-align:center;"><span id="cdMin" style="color:#C8102E;font-size:1.8rem;font-weight:700;display:block;">--</span><span style="color:#666;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;">Min</span></div>
    <div style="text-align:center;"><span id="cdSec" style="color:#C8102E;font-size:1.8rem;font-weight:700;display:block;">--</span><span style="color:#666;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;">Sec</span></div>
  </div>
  <input id="passInput" type="password" placeholder="Password" autocomplete="off" aria-label="Enter site password" style="background:#1a1a2e;border:1px solid #333;color:#fff;padding:10px 16px;border-radius:6px;font-size:1rem;font-family:Poppins,sans-serif;width:220px;text-align:center;">
  <button id="passBtn" style="background:#C8102E;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:0.85rem;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.05em;">Enter</button>
</div>`.trim();

  function injectGate() {
    if (!document.body) {
      // body not parsed yet; try again on next frame
      requestAnimationFrame(injectGate);
      return;
    }
    if (document.getElementById('passGate')) return; // already injected
    document.body.insertAdjacentHTML('afterbegin', gateHtml);

    var input = document.getElementById('passInput');
    var btn = document.getElementById('passBtn');

    function tryPassword() {
      if (input.value === PASSWORD) {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
        var g = document.getElementById('passGate');
        if (g) g.remove();
      } else {
        input.style.borderColor = '#C8102E';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryPassword);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryPassword();
    });
    input.focus();

    startCountdown();
  }

  function startCountdown() {
    function tick() {
      var diff = LAUNCH_TIME - Date.now();
      if (diff <= 0) {
        // Launch passed while user was sitting on the gate. Drop it cleanly.
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
        var g = document.getElementById('passGate');
        if (g) g.remove();
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var elD = document.getElementById('cdDays'); if (elD) elD.textContent = d;
      var elH = document.getElementById('cdHrs');  if (elH) elH.textContent = h;
      var elM = document.getElementById('cdMin');  if (elM) elM.textContent = m;
      var elS = document.getElementById('cdSec');  if (elS) elS.textContent = s;
    }
    tick();
    setInterval(tick, 1000);
  }

  injectGate();
})();
