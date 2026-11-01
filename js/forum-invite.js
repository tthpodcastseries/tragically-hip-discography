// forum-invite.js - Claim Yer membersHIP page (moved out of forum-invite.html in v5.4.17)
// Database calls go through TTHMember.rpc and TTHMember.friendlyError (js/tth-member-gate.js):
// a 15-second time limit and the same fan-friendly lines as the sign-in pop-up, so raw
// server text never reaches a fan (audit REL-04, BRAND-08).
var CLAIM_DOWN = 'Can\'t hand out new numbers right now. Keep exploring as a guest and try again later.';

// A real form, so Enter works from any box (audit A11Y-10)
document.getElementById('claim-form').addEventListener('submit', function (e) {
  e.preventDefault();
  handleConnect();
});

// Claim limits from the database (Member Hardening, audit SEC-05)
function claimLimitText(e) {
  var msg = (e && e.message) || '';
  if (msg.indexOf('too_many_claims') !== -1) return 'That\'s the most numbers one connection can claim in a day. Try again tomorrow.';
  if (msg.indexOf('claims_full_today') !== -1) return 'That\'s the most numbers the Handbook hands out in one day. Try again tomorrow.';
  return '';
}

async function handleConnect() {
  var firstName = document.getElementById('first-name').value.trim();
  var lastName = document.getElementById('last-name').value.trim();
  var favSong = document.getElementById('fav-song').value.trim();
  var errEl = document.getElementById('error-msg');
  var btn = document.getElementById('btn-connect');
  var M = window.TTHMember;

  if (btn.disabled) return; // already waiting on the first tap
  errEl.textContent = '';

  if (!firstName || !lastName) {
    errEl.textContent = 'Add yer first name and a last name or initial.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Getting yer number...';

  try {
    if (!M || typeof M.rpc !== 'function') throw new Error('not_loaded');

    // claim_member saves the row and returns only the new number - the
    // public key can't read or write forum_members directly (v5.4.6)
    var num = await M.rpc('claim_member', {
      p_first_name: firstName,
      p_last_name: lastName,
      p_favourite_song: favSong || null
    });
    if (num == null) throw new Error('no_number');

    document.getElementById('membership-num').textContent = 'No. ' + num;

    // Sign them straight in (v4.8) - same session shape tth-member-gate.js
    // writes on unlock, so the Handbook opens without retyping the number.
    // Shows they collected as a guest carry over to the new number.
    var guestShows = [];
    try {
      var prev = JSON.parse(localStorage.getItem('tth_member_session') || 'null');
      if (prev && prev.guest && Array.isArray(prev.attendedShows)) guestShows = prev.attendedShows.map(String);
      // Shows a guest left waiting when they went to sign in (tth-member-gate.js)
      var pending = JSON.parse(localStorage.getItem('tth_guest_shows_pending') || '[]');
      if (Array.isArray(pending)) pending.map(String).forEach(function (id) { if (guestShows.indexOf(id) === -1) guestShows.push(id); });
      localStorage.removeItem('tth_guest_shows_pending');
    } catch (e2) { /* no prior session */ }
    try {
      localStorage.setItem('tth_member_session', JSON.stringify({
        memberNumber: num,
        firstName: firstName,
        attendedShows: guestShows,
        unlockedAt: Date.now()
      }));
    } catch (e3) { /* storage blocked - they can still sign in with the number */ }
    if (guestShows.length) {
      M.rpc('update_attended_shows', { p_first_name: firstName, p_number: num, p_shows: guestShows })
        .then(function () {}, function () {});
    }
    if (window.umami && typeof window.umami.track === 'function') {
      try { window.umami.track('Claim - Number claimed'); } catch (e4) {}
    }

    document.getElementById('screen-welcome').classList.remove('active');
    document.getElementById('screen-reveal').classList.add('active');
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // The form just disappeared, so move focus to the new number and read the greeting
    // out once its screen is showing (audit A11Y-10)
    try { document.getElementById('membership-num').focus({ preventScroll: true }); } catch (e5) {}
    setTimeout(function () {
      document.getElementById('reveal-greeting').textContent =
        "Yer in, " + firstName + ". You're membersHIP No. " + num + ".";
    }, 150);

  } catch (e) {
    errEl.textContent = claimLimitText(e) || ((M && typeof M.friendlyError === 'function') ? M.friendlyError(e, 'claim') : CLAIM_DOWN);
    btn.disabled = false;
    btn.textContent = 'Get my number';
  }
}
