// song.js - song pages at /song/<slug> (v5.1, 'Grace, Too')
// Live debut and latest play, plays by year, albums, fan ranking, every Hip Archive
// recording, and every performance - all from data/song-index.json
// (scripts/build-song-index.js), so phones skip the 2 MB setlist file.
// /song with no slug (or an unknown one) shows the list of all songs.
(async function () {
  const $ = id => document.getElementById(id);
  const track = name => { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) { /* analytics optional */ } };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const link = (text, href, cls) => { const a = el('a', cls, text); a.href = href; return a; };

  const SITE = 'https://thehiphandbook.tthpods.com';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const RECORDINGS_VISIBLE = 8;
  const ALSO_VISIBLE = 4;
  const CATEGORY_LABEL = { eps: 'EP', live: 'Live album', compilations: 'Compilation', boxsets: 'Box set', video: 'Video', studio: '' };
  const plural = (n, one, many) => n.toLocaleString('en-CA') + ' ' + (n === 1 ? one : many);
  const fmtDate = iso => { const p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; };

  // /song/<slug> on the live site; song.html?s=<slug> works anywhere (local testing)
  const slug = ((location.pathname.match(/\/song\/([^/]+)/) || [])[1] || new URLSearchParams(location.search).get('s') || '').toLowerCase();
  // The local preview server has no rewrites, so there links use ?s=
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const songHref = s => isLocal ? '/song?s=' + s : '/song/' + s;

  let data;
  try {
    data = await fetch('/data/song-index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json(); });
  } catch (e) {
    $('spLoading').hidden = true;
    $('spError').hidden = false;
    return;
  }
  const shows = data.shows.map(r => ({ id: r[0], iso: r[1], venue: r[2], city: r[3], state: r[4], country: r[5], tour: r[6], rec: r[7] }));
  const song = data.songs.find(s => s.s === slug);

  const setMeta = (title, desc, url) => {
    document.title = title;
    const set = (sel, attr, val) => { const n = document.querySelector(sel); if (n) n.setAttribute(attr, val); };
    set('meta[name="description"]', 'content', desc);
    set('meta[property="og:title"]', 'content', title);
    set('meta[property="og:description"]', 'content', desc);
    set('meta[property="og:url"]', 'content', url);
    set('link[rel="canonical"]', 'href', url);
  };
  const placeOf = x => [x.city, x.state].filter(Boolean).join(', ');
  const albumTag = a => (a[4] || CATEGORY_LABEL[a[2]] || '');
  const albumLine = a => {
    const line = el('div', 'sp-line');
    line.appendChild(document.createTextNode('"' + a[0] + '" (' + a[1] + ')'));
    const tag = albumTag(a);
    const bits = [tag, 'track ' + a[3]].filter(Boolean).join(' - ');
    line.appendChild(el('small', '', ' ' + bits));
    return line;
  };

  // ─── The song page ───
  function renderSong() {
    const plays = song.p.map(i => shows[i]);
    const recs = song.r.map(r => shows[r[0]]).filter((x, i, all) => all.indexOf(x) === i);
    const first = plays[0], last = plays[plays.length - 1];

    // Where it first came out: earliest studio album or EP, else the earliest of anything
    const sorted = [...song.a].sort((x, y) => x[1] - y[1]);
    const origin = sorted.find(a => (a[2] === 'studio' || a[2] === 'eps') && !a[4]) || sorted[0];

    $('spLabel').textContent = 'Song';
    $('spTitle').textContent = song.t;
    const bits = [];
    if (origin) bits.push('From "' + origin[0] + '" (' + origin[1] + ')');
    bits.push(plays.length ? 'played live ' + plural(plays.length, 'time', 'times') : 'no live performances on record');
    $('spDesc').textContent = bits.join(' - ') + '.';

    const url = SITE + '/song/' + song.s;
    setMeta("'" + song.t + "' - Song - The Hip Handbook",
      plays.length
        ? "'" + song.t + "' by The Tragically Hip: played live " + plural(plays.length, 'time', 'times') + ', ' + fmtDate(first.iso) + ' to ' + fmtDate(last.iso) + '. Plays by year' + (recs.length ? ' and ' + plural(recs.length, 'recording', 'recordings') + ' in the Hip Archive.' : '.')
        : "'" + song.t + "' by The Tragically Hip: albums and fan ranking.",
      url);

    // Story strip
    if (plays.length) {
      const stats = $('spStats');
      const cell = (label, big, small, href) => {
        const c = el('div', 'sp-stat');
        c.appendChild(el('span', '', label));
        const b = el('b');
        if (href) b.appendChild(link(big, href)); else b.textContent = big;
        c.appendChild(b);
        if (small) c.appendChild(el('small', '', small));
        stats.appendChild(c);
      };
      const showLine = x => [x.venue, placeOf(x)].filter(Boolean).join(', ');
      cell('Played live', plays.length.toLocaleString('en-CA'), plural(new Set(plays.map(x => x.iso.slice(0, 4))).size, 'year', 'years'));
      cell('Live debut', fmtDate(first.iso), showLine(first), 'tour-map.html#show=' + first.id);
      cell('Latest', fmtDate(last.iso), showLine(last), 'tour-map.html#show=' + last.id);
      cell('Recordings', recs.length.toLocaleString('en-CA'), recs.length ? 'in the Hip Archive' : 'none in the Hip Archive');
    } else {
      $('spNever').hidden = false;
    }

    renderYears(plays);
    renderRelease(origin, sorted);
    renderRank();
    renderRecordings(recs);
    renderAll(plays);

    $('spCopy').addEventListener('click', async () => {
      const btn = $('spCopy');
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { /* no clipboard access */ }
      btn.textContent = ok ? 'Link copied' : url;
      setTimeout(() => { btn.textContent = 'Copy link to this song'; }, 2500);
    });
    $('spSong').hidden = false;
  }

  function renderYears(plays) {
    if (!plays.length) return;
    const counts = {};
    plays.forEach(x => { const y = +x.iso.slice(0, 4); counts[y] = (counts[y] || 0) + 1; });
    const ys = Object.keys(counts).map(Number);
    const lo = Math.min(1985, ...ys), hi = Math.max(2016, ...ys);
    const max = Math.max(...Object.values(counts));
    const box = $('spYears');
    const note = $('spYearNote');
    const busiest = +Object.keys(counts).find(y => counts[y] === max);
    const say = y => { note.textContent = y + ': ' + (counts[y] ? plural(counts[y], 'play', 'plays') : 'not played'); };
    for (let y = lo; y <= hi; y++) {
      const n = counts[y] || 0;
      const b = el('button', 'sp-bar' + (n ? '' : ' none') + (y === busiest ? ' top' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', y + ': ' + plural(n, 'play', 'plays'));
      const bar = el('i');
      bar.style.height = n ? Math.max(4, Math.round(100 * n / max)) + '%' : '';
      b.appendChild(bar);
      b.addEventListener('click', () => say(y));
      b.addEventListener('mouseenter', () => say(y));
      box.appendChild(b);
    }
    const axis = el('div', 'sp-axis');
    [lo, Math.round((lo + hi) / 2), hi].forEach(y => axis.appendChild(el('span', '', y)));
    box.parentNode.insertBefore(axis, $('spYearNote'));
    note.textContent = 'Busiest year: ' + busiest + ' (' + plural(max, 'play', 'plays') + '). Tap a bar for a year.';
    $('spYearsCard').hidden = false;
  }

  function renderRelease(origin, sorted) {
    if (!origin) return;
    const box = $('spRelease');
    box.appendChild(el('div', 'sp-also sp-first', 'First released on'));
    box.appendChild(albumLine(origin));
    const rest = sorted.filter((a, i) => a !== origin && sorted.findIndex(b => b[0] === a[0] && albumTag(b) === albumTag(a)) === i);
    if (rest.length) {
      box.appendChild(el('div', 'sp-also', 'Also on'));
      const lines = rest.map(a => { const l = albumLine(a); box.appendChild(l); return l; });
      if (rest.length > ALSO_VISIBLE) {
        lines.slice(ALSO_VISIBLE).forEach(l => { l.hidden = true; });
        const more = el('button', 'sp-more', 'Show ' + (rest.length - ALSO_VISIBLE) + ' more');
        more.type = 'button';
        more.addEventListener('click', () => { lines.forEach(l => { l.hidden = false; }); more.remove(); });
        box.appendChild(more);
      }
    }
    $('spReleaseCard').hidden = false;
  }

  function renderRank() {
    const k = song.k;
    if (!k) return;
    const box = $('spRank');
    const head = el('div', 'sp-rank', '#' + k.rank);
    head.appendChild(el('small', '', k.rank <= 40 ? 'TTHTop40 Countdown' : 'Full 169 Fan Vote'));
    box.appendChild(head);
    if (k.pts) box.appendChild(el('div', 'sp-line', plural(k.pts, 'point', 'points')));
    if (k.url) {
      const a = link('\u{1F399} Hear it on ' + k.ep, k.url, 'sp-podcast');
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      box.appendChild(a);
    }
    $('spRankCard').hidden = false;
  }

  function renderRecordings(recs) {
    if (!recs.length) return;
    $('spRecIntro').textContent = plural(recs.length, 'show', 'shows') + ' with a recording of this song. Tap Play to hear the whole show.';
    const list = $('spRec');
    const row = x => {
      const li = el('li', 'sp-row');
      li.appendChild(el('span', 'sp-date', fmtDate(x.iso)));
      const where = el('span', 'sp-where');
      where.appendChild(el('b', '', x.venue || placeOf(x)));
      where.appendChild(el('small', '', [placeOf(x), x.tour].filter(Boolean).join(' - ')));
      li.appendChild(where);
      const play = link('▶ Play', 'tour-map.html#play=' + x.id);
      play.addEventListener('click', () => track('Song - Play recording'));
      li.appendChild(play);
      return li;
    };
    const draw = all => {
      list.textContent = '';
      (all ? recs : recs.slice(0, RECORDINGS_VISIBLE)).forEach(x => list.appendChild(row(x)));
    };
    draw(false);
    if (recs.length > RECORDINGS_VISIBLE) {
      const more = $('spRecMore');
      more.hidden = false;
      more.textContent = 'Show all ' + recs.length;
      more.addEventListener('click', () => { draw(true); more.hidden = true; });
    }
    $('spRecCard').hidden = false;
  }

  function renderAll(plays) {
    if (!plays.length) return;
    const det = $('spAll');
    det.hidden = false;
    $('spAllSummary').textContent = 'All ' + plural(plays.length, 'live performance', 'live performances');
    let drawn = false;
    det.addEventListener('toggle', () => {
      if (!det.open || drawn) return;
      drawn = true;
      const body = $('spAllBody');
      let year = null, list = null;
      plays.forEach(x => {
        const y = x.iso.slice(0, 4);
        if (y !== year) {
          year = y;
          body.appendChild(el('h3', 'sp-year-h', y));
          list = el('ul', 'sp-list');
          body.appendChild(list);
        }
        const li = el('li', 'sp-row');
        li.appendChild(el('span', 'sp-date', fmtDate(x.iso)));
        const where = el('span', 'sp-where');
        where.appendChild(el('b', '', x.venue || placeOf(x)));
        where.appendChild(el('small', '', [placeOf(x), x.tour].filter(Boolean).join(' - ')));
        li.appendChild(where);
        li.appendChild(x.rec ? link('▶ Play', 'tour-map.html#play=' + x.id) : link('Map', 'tour-map.html#show=' + x.id));
        list.appendChild(li);
      });
    });
  }

  // ─── All songs ───
  function renderIndex() {
    $('spLabel').textContent = 'Songs';
    $('spTitle').textContent = 'Every Hip Song';
    $('spDesc').textContent = 'Every song on an official release, with its live history.';
    if (slug) {
      const m = $('spIndexMsg');
      m.hidden = false;
      m.textContent = "No song at that address. Try the list below.";
    }
    const list = $('spIndexList');
    const draw = q => {
      list.textContent = '';
      const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      const nq = norm(q);
      data.songs.filter(s => !nq || norm(s.t).includes(nq)).forEach(s => {
        const li = el('li');
        const a = link(s.t, songHref(s.s));
        a.appendChild(el('small', '', s.p.length ? plural(s.p.length, 'play', 'plays') : 'no live plays on record'));
        li.appendChild(a);
        list.appendChild(li);
      });
    };
    draw('');
    $('spFilter').addEventListener('input', e => draw(e.target.value));
    $('spIndex').hidden = false;
  }

  if (song) renderSong(); else renderIndex();
  $('spLoading').hidden = true;
})();
