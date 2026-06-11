// live-stats.html - computes live performance trivia from setlist data (v4.3)
(async function() {
  const $ = id => document.getElementById(id);

  let setData = null, lyricsData = null;
  try {
    const r = await fetch('data/setlists.min.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setData = await r.json();
  } catch (e) {
    $('statsLoading').style.display = 'none';
    $('statsError').style.display = 'block';
    console.error('Setlist data load failed:', e);
    return;
  }
  try {
    // The lyrics index doubles as the 169-song studio catalogue (Album|||Song keys)
    const r2 = await fetch('data/lyrics.json');
    if (r2.ok) lyricsData = await r2.json();
  } catch (e) { /* catalogue optional - Never Played section stays hidden */ }

  const norm = s => (s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  const parseDate = d => { const p = d.split('-'); return new Date(+p[2], +p[1] - 1, +p[0]); };
  const fmtDate = d => d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const songLink = title => '<a href="discography.html#song=' + encodeURIComponent(title) + '">' + esc(title) + '</a>';

  // ─── Tally every performance ───
  const plays = new Map();   // norm name -> { display, count, dates[], cover }
  const openers = new Map(); // norm name -> count
  const closers = new Map();
  let totalPerf = 0, showsWithSongs = 0;

  (setData.setlists || []).forEach(s => {
    const songs = (s.songs || []).filter(x => !x.tape && x.name);
    if (!songs.length) return;
    showsWithSongs++;
    const d = parseDate(s.date);
    songs.forEach(x => {
      totalPerf++;
      const k = norm(x.name);
      if (!plays.has(k)) plays.set(k, { display: x.name, count: 0, dates: [], cover: false });
      const rec = plays.get(k);
      rec.count++;
      rec.dates.push({ d, venue: s.venue || 'Unknown venue', city: s.city || '', id: s.id });
      if (x.cover) rec.cover = true;
    });
    const ok = norm(songs[0].name);
    const ck = norm(songs[songs.length - 1].name);
    openers.set(ok, (openers.get(ok) || 0) + 1);
    closers.set(ck, (closers.get(ck) || 0) + 1);
  });

  const all = [...plays.values()];
  const originals = all.filter(r => !r.cover);
  const covers = all.filter(r => r.cover);

  // ─── Headline stats ───
  $('statShows').textContent = showsWithSongs.toLocaleString();
  $('statSongs').textContent = plays.size.toLocaleString();
  $('statPerfs').textContent = totalPerf.toLocaleString();
  $('statCovers').textContent = covers.length.toLocaleString();

  // ─── Most played ───
  const top = originals.slice().sort((a, b) => b.count - a.count).slice(0, 20);
  const maxCount = top.length ? top[0].count : 1;
  $('mostPlayed').innerHTML = top.map((r, i) =>
    '<li class="rank-row"><span class="rank-num">' + (i + 1) + '</span>' +
    '<span class="rank-song">' + songLink(r.display) + '</span>' +
    '<span class="rank-bar-wrap"><span class="rank-bar" style="width:' + Math.round(r.count / maxCount * 100) + '%"></span></span>' +
    '<span class="rank-count">' + r.count + '</span></li>'
  ).join('');

  // ─── Openers & closers ───
  const nameOf = k => (plays.get(k) || { display: k }).display;
  const renderTally = (map, el) => {
    const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const mx = rows.length ? rows[0][1] : 1;
    $(el).innerHTML = rows.map(([k, c], i) =>
      '<li class="rank-row"><span class="rank-num">' + (i + 1) + '</span>' +
      '<span class="rank-song">' + songLink(nameOf(k)) + '</span>' +
      '<span class="rank-bar-wrap"><span class="rank-bar" style="width:' + Math.round(c / mx * 100) + '%"></span></span>' +
      '<span class="rank-count">' + c + '</span></li>'
    ).join('');
  };
  renderTally(openers, 'topOpeners');
  renderTally(closers, 'topClosers');

  // ─── One-timers ───
  const oneTimers = originals.filter(r => r.count === 1)
    .map(r => ({ display: r.display, p: r.dates[0] }))
    .sort((a, b) => a.p.d - b.p.d);
  $('oneTimerCount').textContent = oneTimers.length;
  const renderOneTimers = limit => {
    $('oneTimers').innerHTML = oneTimers.slice(0, limit).map(o =>
      '<li class="detail-row">' + songLink(o.display) +
      '<div class="detail-meta">Played once - <a href="tour-map.html#show=' + esc(o.p.id) + '">' +
      esc(o.p.venue) + (o.p.city ? ', ' + esc(o.p.city) : '') + ' - ' + fmtDate(o.p.d) + ' &rarr;</a></div></li>'
    ).join('');
  };
  renderOneTimers(12);
  if (oneTimers.length > 12) {
    const btn = $('oneTimersMore');
    btn.style.display = 'block';
    btn.addEventListener('click', () => { renderOneTimers(oneTimers.length); btn.style.display = 'none'; });
  }

  // ─── Longest gaps between performances ───
  const gaps = [];
  originals.filter(r => r.count >= 2).forEach(r => {
    const ds = r.dates.slice().sort((a, b) => a.d - b.d);
    let best = null;
    for (let i = 1; i < ds.length; i++) {
      const gap = ds[i].d - ds[i - 1].d;
      if (!best || gap > best.gap) best = { gap, from: ds[i - 1], to: ds[i] };
    }
    if (best && best.gap > 0) gaps.push({ display: r.display, ...best });
  });
  gaps.sort((a, b) => b.gap - a.gap);
  $('longestGaps').innerHTML = gaps.slice(0, 10).map(g => {
    const years = g.gap / 31557600000;
    const span = years >= 1 ? years.toFixed(1) + ' years' : Math.round(g.gap / 86400000) + ' days';
    return '<li class="detail-row">' + songLink(g.display) +
      ' <span class="rank-count">' + span + '</span>' +
      '<div class="detail-meta">Shelved after ' + fmtDate(g.from.d) + ' (' + esc(g.from.city || g.from.venue) + ') - revived ' +
      fmtDate(g.to.d) + ' (' + esc(g.to.city || g.to.venue) + ')</div></li>';
  }).join('');

  // ─── Top covers ───
  $('topCovers').innerHTML = covers.slice().sort((a, b) => b.count - a.count).slice(0, 10).map((r, i) =>
    '<li class="rank-row"><span class="rank-num">' + (i + 1) + '</span>' +
    '<span class="rank-song">' + esc(r.display) + '</span>' +
    '<span class="rank-bar-wrap"></span>' +
    '<span class="rank-count">' + r.count + '</span></li>'
  ).join('');

  // ─── Never played live (per setlist.fm data) ───
  if (lyricsData && lyricsData.songs) {
    const catalogue = new Map();
    Object.keys(lyricsData.songs).forEach(key => {
      const title = (key.split('|||')[1] || '').trim();
      if (!title) return;
      const base = title.replace(/\s*\((Live|Demo|Alternate Version)\)\s*$/i, '');
      if (!catalogue.has(norm(base))) catalogue.set(norm(base), base);
    });
    const never = [...catalogue.entries()].filter(([k]) => !plays.has(k)).map(([, v]) => v).sort();
    if (never.length) {
      $('neverSection').style.display = '';
      $('neverCount').textContent = never.length;
      $('neverPlayed').innerHTML = never.map(t =>
        '<a class="never-chip" href="discography.html#song=' + encodeURIComponent(t) + '">' + esc(t) + '</a>'
      ).join('');
    }
  }

  $('statsLoading').style.display = 'none';
  $('statsContent').style.display = '';
})();
