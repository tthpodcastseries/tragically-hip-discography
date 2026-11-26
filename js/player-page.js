// player-page.js - the pop-out live show player (player.html, v5.13).
// The Tour Map player's pop-out button opens /player#play=<show id>&track=<n>&at=<seconds>
// in a window named "tthPlayer". This page finds the show and hands it to the same
// player code the map uses (js/tour-map-player.js), at the same track and second.
// Popping out again reuses this window and only changes the address after the "#",
// so the page listens for that too.
(function() {
  const showTitle = document.getElementById('apShowTitle');
  const note = document.getElementById('ppNote');
  const empty = document.getElementById('ppEmpty');
  const closeBtn = document.getElementById('apClose');

  // The show list the map uses (no track lists; the player fetches those itself)
  let showsPromise = null;
  function loadShows() {
    if (!showsPromise) showsPromise = fetch('data/tour-map.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => { showsPromise = null; throw e; });
    return showsPromise;
  }

  function readHash() {
    const p = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const id = p.get('play') || '';
    return {
      id: /^[A-Za-z0-9_-]+$/.test(id) ? id : '',
      track: Math.max(0, parseInt(p.get('track'), 10) || 0),
      at: Math.max(0, parseInt(p.get('at'), 10) || 0)
    };
  }

  function showEmpty() {
    showTitle.textContent = 'No show loaded';
    note.hidden = true;
    empty.hidden = false;
  }

  async function start() {
    const want = readHash();
    if (!want.id) { showEmpty(); return; }
    empty.hidden = true;
    note.hidden = false;
    let shows;
    try { shows = await loadShows(); }
    catch (e) { showTitle.textContent = "Couldn't load the show. Check yer connection and try again."; return; }
    const gig = shows.find(g => String(g.id) === want.id);
    if (!gig || !gig.trackCount) { showEmpty(); return; }
    document.title = `${gig.isoDate || ''} ${gig.venue || ''} - Live Show Player - The Hip Handbook`;
    window.tthPlayer.loadShow(gig, { track: want.track, at: want.at });
  }

  // The x stops the show and closes the window. A window the fan opened by hand can't be
  // closed by the page, so then the player just stops.
  closeBtn.addEventListener('click', () => { try { window.close(); } catch (e) { /* not ours to close */ } });

  start();
  window.addEventListener('hashchange', start);
})();
