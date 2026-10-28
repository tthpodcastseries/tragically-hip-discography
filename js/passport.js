// passport.js - Yer Hip Passport (v5, "In View")
// Turns the shows a member ticked off with "I Was There" into stats, rarities,
// a checklist against the official song list, a map, and a share card.
// Everything is worked out in the browser from data the site already ships:
//   data/setlists.min.json     setlist.fm data for all 1,358 shows
//   data/canonical-songs.json  jD's official song list (scripts/build-canonical-songs.js)
//   data/show-index.json       map coordinates + "has a recording" (scripts/build-show-index.js)
(async function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const track = name => { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) { /* analytics optional */ } };

  // Same normalizer as scripts/build-canonical-songs.js - keys must match
  const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const NOT_SONGS = /^\s*(interview|introduction|intro|outro)\b/i;
  const RARE_UNDER = 10;
  const SHOWS_VISIBLE = 8;

  // Public by design, like the tour map's key - see tour-map.html
  const CARTO_KEY = 'cb1_4wzs_1_6486b4aebf6d574862008dc4';

  const M = window.TTHMember;
  if (!M || !M.getSession || !M.getSession()) return; // member gate is showing

  // Same slug rule as scripts/build-song-index.js - every checklist song has a page at /song/<slug>
  const songSlug = t => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const dateKey = d => { const p = d.split('-'); return p[2] + p[1] + p[0]; };
  const fmtDate = d => { const p = d.split('-'); return new Date(+p[2], +p[1] - 1, +p[0]).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // ─── Load data ───
  let setlists, canon, showIdx;
  try {
    const [a, b, c] = await Promise.all([
      fetch('data/setlists.min.json').then(r => { if (!r.ok) throw new Error('setlists'); return r.json(); }),
      fetch('data/canonical-songs.json').then(r => { if (!r.ok) throw new Error('songs'); return r.json(); }),
      fetch('data/show-index.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    setlists = a.setlists || [];
    canon = b;
    showIdx = c || {};
  } catch (e) {
    $('ppLoading').hidden = true;
    $('ppError').hidden = false;
    console.error('Passport data failed to load:', e);
    return;
  }

  const songs = canon.songs;
  const aliases = canon.aliases || {};
  const keyToSong = new Map();
  songs.forEach((s, i) => s.setlistKeys.forEach(k => keyToSong.set(k, i)));
  const playable = songs.map((s, i) => i).filter(i => songs[i].setlistKeys.length)
    .sort((a, b) => songs[a].title.localeCompare(songs[b].title));
  const neverLive = songs.length - playable.length;

  // A setlist entry can be a medley ('New Orleans Is Sinking / Nautical Disaster')
  // - each part counts as its own song. Covers and tape are not Hip songs.
  function partsOf(entry) {
    if (!entry || entry.tape || entry.cover || !entry.name || !entry.name.trim()) return [];
    return entry.name.split(' / ').map(p => p.trim()).filter(p => p && !NOT_SONGS.test(p)).map(p => {
      const k = norm(p);
      return { key: aliases[k] || k, name: p };
    });
  }
  const hasSetlist = s => (s.songs || []).some(x => !x.tape && x.name);

  let currentCard = null; // { blob, url }
  let showAll = false;
  let onlyMissing = false;

  function currentShows() {
    const sess = M.getSession();
    const ids = new Set(((sess && sess.attendedShows) || []).map(String));
    return setlists.filter(s => ids.has(String(s.id))).sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)));
  }

  // ─── Compute everything the page shows ───
  function compute(shows) {
    const cities = new Set(), venues = new Set(), years = new Set();
    let songsHeard = 0;
    const heard = new Map();  // key -> { name, count }
    const seen = new Map();   // canonical index -> count
    shows.forEach(s => {
      if (s.city) cities.add(s.city);
      if (s.venue) venues.add(s.venue);
      years.add(s.date.split('-')[2]);
      (s.songs || []).forEach(entry => {
        if (!entry.tape && entry.name) songsHeard++;
        partsOf(entry).forEach(p => {
          const idx = keyToSong.get(p.key);
          const label = idx != null ? songs[idx].title : p.name;
          if (!heard.has(p.key)) heard.set(p.key, { name: label, count: 0 });
          heard.get(p.key).count++;
          if (idx != null) seen.set(idx, (seen.get(idx) || 0) + 1);
        });
      });
    });
    const rarities = [...seen.keys()].filter(i => songs[i].livePlays > 0 && songs[i].livePlays < RARE_UNDER)
      .sort((a, b) => songs[a].livePlays - songs[b].livePlays || songs[a].title.localeCompare(songs[b].title));
    const top = [...heard.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
    const seenPlayable = playable.filter(i => seen.has(i)).length;
    return { cities, venues, years, songsHeard, seen, rarities, top, seenPlayable,
      noSetlist: shows.filter(s => !hasSetlist(s)).length };
  }

  // ─── Render ───
  function render() {
    const sess = M.getSession();
    const isGuest = !!(sess && sess.guest);
    const memberEl = $('ppMember');
    if (sess && !isGuest) {
      memberEl.textContent = 'Yer shows, ' + (sess.firstName || 'friend') + ' (#' + sess.memberNumber + ')';
      memberEl.hidden = false;
    } else {
      memberEl.hidden = true;
    }
    $('ppSwitch').textContent = isGuest ? 'Sign in with a number' : 'Switch member';
    $('ppSwitch').hidden = false;
    $('ppGuestNote').hidden = !isGuest;
    $('ppLoading').hidden = true;

    const shows = currentShows();
    if (!shows.length) {
      $('ppEmpty').hidden = false;
      $('ppBody').hidden = true;
      return;
    }
    $('ppEmpty').hidden = true;
    $('ppBody').hidden = false;

    const d = compute(shows);
    const first = shows[0], last = shows[shows.length - 1];
    const firstYear = first.date.split('-')[2], lastYear = last.date.split('-')[2];

    $('ppStats').innerHTML = [
      [shows.length, shows.length === 1 ? 'Show' : 'Shows'],
      [d.songsHeard.toLocaleString('en-CA'), 'Songs heard'],
      [d.cities.size, d.cities.size === 1 ? 'City' : 'Cities'],
      [d.years.size, d.years.size === 1 ? 'Year' : 'Years'],
    ].map(x => '<div class="pp-stat"><span class="pp-stat-num">' + x[0] + '</span><span class="pp-stat-lbl">' + x[1] + '</span></div>').join('');

    $('ppSpan').textContent = shows.length === 1
      ? 'First stamp: ' + fmtDate(first.date) + ' at ' + (first.venue || 'a Hip show')
      : 'First show ' + fmtDate(first.date) + ' (' + (first.venue || '?') + ')  -  latest ' + fmtDate(last.date) + ' (' + (last.venue || '?') + ')';

    const noteEl = $('ppNoSetlist');
    if (d.noSetlist) {
      noteEl.textContent = plural(d.noSetlist, 'of yer shows has', 'of yer shows have') + ' no setlist on file yet, so ' + (d.noSetlist === 1 ? 'it doesn\'t' : 'they don\'t') + ' count toward song stats.';
      noteEl.hidden = false;
    } else {
      noteEl.hidden = true;
    }

    // Rarities
    $('ppRaritySection').hidden = !d.rarities.length;
    $('ppRarities').innerHTML = d.rarities.map(i => {
      const n = songs[i].livePlays;
      return '<div class="pp-chip"><b>' + esc(songs[i].title) + '</b><span>' + (n === 1 ? 'Played live once ever' : 'Played live ' + n + ' times ever') + '</span></div>';
    }).join('');

    // Most heard (only interesting once something repeats)
    const showTop = d.top.length && d.top[0].count > 1;
    $('ppTopSection').hidden = !showTop;
    $('ppTop').innerHTML = showTop ? d.top.filter(t => t.count > 1).map(t => '<li>' + esc(t.name) + '<span>' + t.count + 'x</span></li>').join('') : '';

    // Checklist
    const pct = Math.round(d.seenPlayable / playable.length * 100);
    $('ppCheckSub').textContent = 'You\'ve seen ' + d.seenPlayable + ' of ' + playable.length + ' songs live (' + pct + '%).';
    $('ppBarFill').style.width = pct + '%';
    $('ppBar').setAttribute('aria-valuenow', String(pct));
    $('ppChecklist').innerHTML = playable.map(i => '<a class="pp-song' + (d.seen.has(i) ? ' seen' : '') + '" href="/song/' + songSlug(songs[i].title) + '">' + esc(songs[i].title) + '</a>').join('');
    $('ppChecklist').classList.toggle('only-missing', onlyMissing);
    $('ppNeverLive').textContent = neverLive + ' more songs on the official list have never been played live, per setlist.fm, so there\'s nothing to catch.';

    // Show list (newest first)
    const list = shows.slice().reverse();
    const visible = showAll ? list : list.slice(0, SHOWS_VISIBLE);
    $('ppShows').innerHTML = visible.map(s => {
      const loc = [s.city, s.state, s.country].filter(Boolean).join(', ');
      const n = (s.songs || []).filter(x => !x.tape && x.name).length;
      const idx = showIdx[s.id];
      const links = ['<a href="tour-map.html#show=' + esc(s.id) + '">View on map</a>'];
      if (idx && idx[2]) links.push('<a href="tour-map.html#play=' + esc(s.id) + '">Play this show</a>');
      if (s.url) links.push('<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">setlist.fm</a>');
      return '<div class="pp-show"><div>' +
        '<div class="pp-show-date">' + esc(fmtDate(s.date)) + '</div>' +
        '<div class="pp-show-venue">' + esc(s.venue || 'Unknown venue') + '</div>' +
        '<div class="pp-show-meta">' + esc(loc) + (s.tour ? ' &middot; ' + esc(s.tour) : '') + (n ? ' &middot; ' + n + ' songs' : '') + '</div>' +
        '<div class="pp-show-links">' + links.join('') + '</div></div>' +
        '<button class="pp-remove" type="button" data-id="' + esc(s.id) + '" aria-label="Remove ' + esc(s.venue || 'this show') + ' from yer shows">Remove</button></div>';
    }).join('');
    $('ppMoreBtn').hidden = list.length <= SHOWS_VISIBLE;
    $('ppMoreBtn').textContent = showAll ? 'Show fewer' : 'Show all ' + list.length + ' shows';

    renderMap(shows);
    // A new set of shows means the old card is stale
    if (currentCard) { URL.revokeObjectURL(currentCard.url); currentCard = null; $('ppCardWrap').hidden = true; }
    lastStats = { shows, d, firstYear };
  }

  // ─── Map ───
  let map = null, layer = null;
  function renderMap(shows) {
    const section = $('ppMap').parentElement;
    if (typeof L === 'undefined') { section.hidden = true; return; }
    if (!map) {
      map = L.map('ppMap', { scrollWheelZoom: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd', maxZoom: 18,
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }
    layer.clearLayers();
    const groups = new Map(); // venue spot -> { lat, lng, venue, count }
    shows.forEach(s => {
      const c = showIdx[s.id];
      if (!c || c[0] == null) return;
      const k = c[0].toFixed(3) + ',' + c[1].toFixed(3);
      if (!groups.has(k)) groups.set(k, { lat: c[0], lng: c[1], venue: s.venue || 'Show', city: s.city, count: 0 });
      groups.get(k).count++;
    });
    if (!groups.size) { section.hidden = true; return; }
    section.hidden = false;
    const pts = [];
    groups.forEach(g => {
      pts.push([g.lat, g.lng]);
      L.circleMarker([g.lat, g.lng], { radius: 6 + Math.min(g.count, 6), color: '#CCA23C', weight: 2, fillColor: '#C8102E', fillOpacity: 0.85 })
        .bindPopup('<b>' + esc(g.venue) + '</b><br>' + esc(g.city || '') + '<br>' + plural(g.count, 'show', 'shows'))
        .addTo(layer);
    });
    map.invalidateSize();
    if (pts.length === 1) map.setView(pts[0], 7); else map.fitBounds(pts, { padding: [30, 30], maxZoom: 8 });
  }

  // ─── Share card ───
  // Facebook link-card size, Instagram feed portrait (4:5), Instagram Story (9:16)
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  let cardFormat = 'facebook';
  let lastStats = null;

  async function makeCard() {
    const { shows, d, firstYear } = lastStats;
    const fmt = FORMATS[cardFormat];
    const landscape = fmt.w > fmt.h;
    const sess = M.getSession();
    const name = sess && !sess.guest && sess.firstName ? String(sess.firstName).trim().slice(0, 20) : '';
    try {
      await Promise.all(['900 300px Poppins', '700 48px Poppins', '600 40px Poppins'].map(f => document.fonts.load(f)));
    } catch (e) { /* fall back to the default sans-serif */ }

    const W = fmt.w, H = fmt.h;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#0e0b16';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(204,162,60,0.45)';
    x.lineWidth = landscape ? 4 : 6;
    const inset = landscape ? 24 : 36;
    x.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    x.textBaseline = 'alphabetic';

    // Draw text at (cx, y); align 'center' or 'left'. Shrinks to fit maxW.
    const put = (str, cx, y, weight, size, color, spacing, maxW, align) => {
      let px = size;
      x.textAlign = align || 'center';
      x.font = weight + ' ' + px + 'px Poppins, sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = spacing || '0px';
      while (maxW && x.measureText(str).width > maxW && px > 20) { px -= 2; x.font = weight + ' ' + px + 'px Poppins, sans-serif'; }
      x.fillStyle = color;
      x.fillText(str, cx, y);
    };

    const headline = name ? name + ' has seen The Hip live' : 'Seen The Hip live';
    const numSize = shows.length > 99 ? 0.82 : 1;
    const label = shows.length === 1 ? 'SHOW' : 'SHOWS';
    const siteText = 'thehiphandbook.tthpods.com';

    if (landscape) {
      // Number on the left, the details on the right
      put('\u{1F341}', 330, 150, '700', 70, '#ffffff');
      put('YER HIP PASSPORT', 330, 212, '700', 28, '#CCA23C', '8px');
      put(String(shows.length), 330, 410, '900', 230 * numSize, '#C8102E');
      put(label, 330, 486, '700', 50, '#CCA23C', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      const lines = [
        d.songsHeard.toLocaleString('en-CA') + ' songs heard live',
        d.seenPlayable + ' of ' + playable.length + ' songs seen',
      ];
      if (d.rarities.length) lines.push(plural(d.rarities.length, 'rarity', 'rarities') + ' caught');
      lines.push('First show: ' + firstYear);
      put(headline, 690, 190, '700', 40, '#ffffff', '0px', 460, 'left');
      lines.forEach((ln, i) => put(ln, 690, 280 + i * 62, '600', 34, '#d9d9d9', '0px', 460, 'left'));
      put(siteText, W / 2, 585, '600', 26, '#b0b0b0', '2px');
    } else {
      // Portrait. Stories keep content inside the safe zone (Instagram covers
      // roughly the top and bottom 250px with its own interface).
      const story = H > 1500;
      const y = story
        ? { maple: 340, label: 440, head: 570, num: 1030, lbl: 1150, lines: 1290, gap: 80, site: 1650 }
        : { maple: 190, label: 272, head: 384, num: 760, lbl: 856, lines: 972, gap: 70, site: 1262 };
      put('\u{1F341}', W / 2, y.maple, '700', story ? 110 : 96, '#ffffff');
      put('YER HIP PASSPORT', W / 2, y.label, '700', 38, '#CCA23C', '10px');
      put(headline, W / 2, y.head, '700', story ? 58 : 54, '#ffffff', '0px', W - 160);
      put(String(shows.length), W / 2, y.num, '900', (story ? 420 : 360) * numSize, '#C8102E');
      put(label, W / 2, y.lbl, '700', story ? 72 : 64, '#CCA23C', '12px');
      const lines = [
        d.songsHeard.toLocaleString('en-CA') + ' songs heard live',
        d.seenPlayable + ' of ' + playable.length + ' songs on the checklist',
      ];
      if (d.rarities.length) lines.push(plural(d.rarities.length, 'rarity', 'rarities') + ' caught');
      lines.push('First show: ' + firstYear);
      lines.forEach((ln, i) => put(ln, W / 2, y.lines + i * y.gap, '600', story ? 48 : 44, '#d9d9d9', '0px', W - 160));
      put(siteText, W / 2, y.site, '600', 36, '#b0b0b0', '2px');
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('ppCardImg');
    img.src = currentCard.url;
    img.className = 'pp-card-img pp-card-' + cardFormat;
    $('ppCardWrap').hidden = false;
    const file = new File([blob], 'my-hip-passport-' + fmt.file + '.png', { type: 'image/png' });
    $('ppShareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Passport - Card made - ' + cardFormat);
  }

  // ─── Wiring ───
  $('ppSwitch').addEventListener('click', () => M.signOut());
  $('ppMissingBtn').addEventListener('click', e => {
    onlyMissing = !onlyMissing;
    e.currentTarget.setAttribute('aria-pressed', String(onlyMissing));
    e.currentTarget.textContent = onlyMissing ? 'Show everything' : 'Show only what I\'m missing';
    $('ppChecklist').classList.toggle('only-missing', onlyMissing);
  });
  $('ppMoreBtn').addEventListener('click', () => { showAll = !showAll; render(); });
  $('ppShows').addEventListener('click', async e => {
    const btn = e.target.closest('.pp-remove');
    if (!btn) return;
    btn.disabled = true;
    try { await M.toggleShow(btn.dataset.id); } catch (err) { console.error('Could not update shows:', err); }
    render();
  });
  $('ppMakeCard').addEventListener('click', () => { if (lastStats) makeCard(); });
  document.querySelectorAll('.pp-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.pp-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (lastStats && currentCard) makeCard(); // already showing a card: redraw in the new size
  }));
  $('ppSaveBtn').addEventListener('click', () => {
    if (!currentCard) return;
    const a = document.createElement('a');
    a.href = currentCard.url;
    a.download = 'my-hip-passport-' + FORMATS[currentCard.format].file + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    track('Passport - Card saved');
  });
  $('ppShareBtn').addEventListener('click', async () => {
    if (!currentCard || !lastStats) return;
    const file = new File([currentCard.blob], 'my-hip-passport-' + FORMATS[currentCard.format].file + '.png', { type: 'image/png' });
    const n = lastStats.shows.length;
    try {
      await navigator.share({ files: [file], title: 'Yer Hip Passport', text: 'I\'ve been to ' + plural(n, 'Hip show', 'Hip shows') + '. Build yer own passport at thehiphandbook.tthpods.com/my-shows' });
      track('Passport - Card shared');
    } catch (err) { /* cancelled */ }
  });

  render();
})();
