// forum-invite.js - Claim Yer membersHIP page (moved out of forum-invite.html in v5.4.17)
var sb;
document.addEventListener('DOMContentLoaded', function() {
  if (window.supabase) {
    sb = supabase.createClient(
      'https://deqslacywpwnjjckdygp.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcXNsYWN5d3B3bmpqY2tkeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQyNjEsImV4cCI6MjA5MDczMDI2MX0.rrawa18owCmKbmryWRi6ROJX146FTqis2OGVT68K7jM'
    );
  }
});

document.getElementById('btn-connect').addEventListener('click', handleConnect);

async function handleConnect() {
  var firstName = document.getElementById('first-name').value.trim();
  var lastName = document.getElementById('last-name').value.trim();
  var favSong = document.getElementById('fav-song').value.trim();
  var errEl = document.getElementById('error-msg');
  var btn = document.getElementById('btn-connect');

  errEl.textContent = '';

  if (!firstName || !lastName) {
    errEl.textContent = 'Add yer first name and a last name or initial.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Getting yer number...';

  try {
    if (!sb) throw new Error('Still loading - try again in a sec.');

    // claim_member saves the row and returns only the new number - the
    // public key can't read or write forum_members directly (v5.4.6)
    var { data, error } = await sb.rpc('claim_member', {
      p_first_name: firstName,
      p_last_name: lastName,
      p_favourite_song: favSong || null
    });

    if (error) throw error;
    if (data == null) throw new Error('Something went wrong. Try again.');

    var num = data;

    document.getElementById('membership-num').textContent = 'No. ' + num;
    document.getElementById('reveal-greeting').textContent =
      "Yer in, " + firstName + ". You're membersHIP No. " + num + ".";

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
      sb.rpc('update_attended_shows', { p_first_name: firstName, p_number: num, p_shows: guestShows })
        .then(function () {}, function () {});
    }
    if (window.umami && typeof window.umami.track === 'function') {
      try { window.umami.track('Claim - Number claimed'); } catch (e4) {}
    }

    document.getElementById('screen-welcome').classList.remove('active');
    document.getElementById('screen-reveal').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (e) {
    errEl.textContent = e.message || 'Something went wrong. Try again.';
    btn.disabled = false;
    btn.textContent = 'Get my number';
  }
}
