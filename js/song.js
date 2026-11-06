// song.js - song pages at /song/<slug> (v5.1, 'Grace, Too')
// Live debut and latest play, plays by year, albums, fan ranking, every Hip Archive
// recording, and every performance - all from data/song-index.json
// (scripts/build-song-index.js), so phones skip the 2 MB setlist file.
// Lyrics (v5.1.7) load from data/lyrics.json only when the Lyrics card is opened.
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
  const shows = data.shows.map(r => ({ id: r[0], iso: r[1], venue: r[2], city: r[3], state: r[4], country: r[5], tour: window.tthAlbumCase(r[6]), rec: r[7] }));
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

  // Same text as songDesc in scripts/build-seo-pages.js (audit SEO-02): the longest
  // version that fits 155 characters, dropping "by The Tragically Hip" first
  function songDesc(plays, recs, origin) {
    const t = "'" + song.t + "'";
    const fit = list => list.find(d => d.length <= 155) || list[list.length - 1];
    if (plays.length) {
      const first = plays[0], last = plays[plays.length - 1];
      const live = plays.length === 1 ? 'played live once, on ' + fmtDate(first.iso) + '.' : 'played live ' + plural(plays.length, 'time', 'times') + ', ' + fmtDate(first.iso) + ' to ' + fmtDate(last.iso) + '.';
      const recLong = recs.length ? ' Plays by year and ' + plural(recs.length, 'recording', 'recordings') + ' in The Tragically Hip Archive.' : ' Plays by year.';
      const recShort = recs.length ? ' Plays by year and ' + plural(recs.length, 'recording', 'recordings') + '.' : ' Plays by year.';
      return fit([t + ' by The Tragically Hip: ' + live + recLong, t + ': ' + live + recLong, t + ': ' + live + recShort, t + ': ' + live]);
    }
    const from = origin ? ' From "' + origin[0] + '" (' + origin[1] + ').' : '';
    return fit([
      t + ' by The Tragically Hip.' + from + ' No live performances on record. Albums and fan ranking.',
      t + '.' + from + ' No live performances on record. Albums and fan ranking.',
      t + '.' + from + ' Albums and fan ranking.',
    ]);
  }

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
    // One play reads "played live once, on Dec 9, 1993" (audit BRAND-09)
    const once = plays.length === 1 ? 'played live once, on ' + fmtDate(first.iso) : '';
    bits.push(once || (plays.length ? 'played live ' + plural(plays.length, 'time', 'times') : 'no live performances on record'));
    $('spDesc').textContent = bits.join(' - ') + '.';

    const url = SITE + '/song/' + song.s;
    setMeta("'" + song.t + "' - Song - The Hip Handbook", songDesc(plays, recs, origin), url);
    // The plain summary written into the page for search engines says what the stats
    // below now show (audit SEO-03)
    if ($('spSummary')) $('spSummary').hidden = true;

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
      cell('Live debut', fmtDate(first.iso), showLine(first), '/tour-map.html#show=' + first.id);
      cell('Latest', fmtDate(last.iso), showLine(last), '/tour-map.html#show=' + last.id);
      cell('Recordings', recs.length.toLocaleString('en-CA'), recs.length ? 'in the Archive' : 'none in the Archive');
    } else {
      $('spNever').hidden = false;
    }

    renderYears(plays);
    renderRelease(origin, sorted);
    renderLyrics();
    renderRank();
    renderRecordings(recs);
    renderAll(plays);
    initCard(plays, origin, url);

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
      // The bars are for mouse and touch; the year picker below does the same job from
      // the keyboard and for screen readers (the bars are under 24px wide, audit A11Y-06)
      const b = el('div', 'sp-bar' + (n ? '' : ' none') + (y === busiest ? ' top' : ''));
      b.setAttribute('aria-hidden', 'true');
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
    const pick = el('div', 'sp-yearpick');
    const lbl = el('label', '', 'Pick a year');
    lbl.setAttribute('for', 'spYearSelect');
    const sel = el('select');
    sel.id = 'spYearSelect';
    sel.appendChild(new Option('Choose a year', ''));
    for (let y = lo; y <= hi; y++) sel.appendChild(new Option(y + ' - ' + plural(counts[y] || 0, 'play', 'plays'), y));
    sel.addEventListener('change', () => { if (sel.value) say(+sel.value); });
    pick.appendChild(lbl);
    pick.appendChild(sel);
    box.parentNode.insertBefore(pick, $('spYearNote'));
    note.textContent = 'Busiest year: ' + busiest + ' (' + plural(max, 'play', 'plays') + '). Tap a bar, or pick a year below.';
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
    const head = el('div', 'sp-rank', 'No. ' + k.rank);
    head.appendChild(el('small', '', k.rank <= 40 ? 'The Tragically Hip Top Forty Countdown' : 'Full 169 Fan Vote'));
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
      const play = link('▶ Play', '/tour-map.html#play=' + x.id);
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

  // Lyrics: fetched only when the card is opened, falling back to the copy lyrics search
  // saves when offline. Refreshes that copy when lyrics.json has changed (same key,
  // fingerprint and format as js/discography-app.js).
  const LYRICS_CACHE_KEY = 'tth_lyrics_cache_v4';
  const LYRICS_STAMP_KEY = 'tth_lyrics_stamp';
  function lyricsStamp(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return text.length + '-' + (h >>> 0).toString(36);
  }
  const lyricsMailto = title => 'mailto:tthpodcastseries@gmail.com?subject=' + encodeURIComponent('Lyrics for The Hip Handbook') +
    '&body=' + encodeURIComponent('Song: ' + title + '\n\nLyrics:\n\n\nSource (optional - liner notes, where you got them):\n\nCredit (optional - how you\'d like to be thanked):');

  async function lyricsFor(key) {
    let text;
    try {
      text = await fetch('/data/lyrics.json').then(r => { if (!r.ok) throw new Error('lyrics'); return r.text(); });
    } catch (err) {
      try {
        const cache = JSON.parse(localStorage.getItem(LYRICS_CACHE_KEY));
        if (cache && cache[key]) return cache[key];
      } catch (e) { /* no saved copy */ }
      throw err;
    }
    const all = JSON.parse(text);
    try {
      const stamp = lyricsStamp(text);
      if (localStorage.getItem(LYRICS_STAMP_KEY) !== stamp) {
        localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify(all.songs));
        localStorage.setItem(LYRICS_STAMP_KEY, stamp);
      }
    } catch (e) { /* storage full or blocked */ }
    return all.songs[key];
  }

  function renderLyrics() {
    if (!song.l) {
      $('spLyricsSend').href = lyricsMailto(song.t);
      $('spLyricsNone').hidden = false;
      return;
    }
    const det = $('spLyrics');
    const body = $('spLyricsBody');
    det.hidden = false;
    let state = 'none';
    det.addEventListener('toggle', async () => {
      if (!det.open || state === 'loading' || state === 'done') return;
      state = 'loading';
      track('Song - Open lyrics');
      body.replaceChildren(el('p', 'sp-sub', 'Loading the lyrics...'));
      let text;
      try { text = await lyricsFor(song.l); } catch (e) { /* offline */ }
      if (!text) {
        state = 'none';
        body.replaceChildren(el('p', 'sp-sub sp-error', "Couldn't load the lyrics. Check yer connection, then close and reopen this."));
        return;
      }
      state = 'done';
      body.replaceChildren();
      text.split(/\n\s*\n/).forEach(v => body.appendChild(el('p', 'sp-verse', v.trim())));
      const fix = el('p', 'sp-lyrics-note', 'Spot a mistake? ');
      fix.appendChild(link('Send jD a fix', lyricsMailto(song.t)));
      body.appendChild(fix);
    });
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
        li.appendChild(x.rec ? link('▶ Play', '/tour-map.html#play=' + x.id) : link('Map', '/tour-map.html#show=' + x.id));
        list.appendChild(li);
      });
    });
  }

  // ─── Share card (v5.8) ───
  // Same sizes, frame and buttons as the Passport and game cards: Facebook link-card size,
  // Instagram feed portrait (4:5), Instagram Story (9:16). Red and Gold are bar fills only.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  // Rank numbers are spelled out (jD, 2026-11-03): 12 -> "Twelve", 142 -> "One Hundred Forty-Two"
  const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const words = n => {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : '');
    return n.toLocaleString('en-CA');
  };

  function initCard(plays, origin, url) {
    let cardFormat = 'facebook';
    let currentCard = null; // { blob, url, format }
    const cardFile = () => 'hip-song-' + song.s + '-' + FORMATS[cardFormat].file + '.png';
    const siteText = url.replace(/^https:\/\//, '');
    const title = "'" + song.t + "'";
    const fromLine = origin ? 'From "' + origin[0] + '" (' + origin[1] + ')' : '';
    const first = plays[0], last = plays[plays.length - 1];
    const counts = {};
    plays.forEach(p => { const y = +p.iso.slice(0, 4); counts[y] = (counts[y] || 0) + 1; });
    const k = song.k;
    const rankLine = k ? 'Fan-ranked Number ' + words(k.rank) : '';
    const rankShow = k ? (k.rank <= 40 ? 'The Tragically Hip Top Forty Countdown' : 'Full 169 Fan Vote') : '';

    async function makeCard() {
      const fmt = FORMATS[cardFormat];
      const W = fmt.w, H = fmt.h, landscape = W > H, story = H > 1500;
      try {
        // Every weight the card uses, or the canvas quietly draws in another font
        await Promise.all(['900 300px Poppins', '800 56px Poppins', '700 48px Poppins', '600 40px Poppins'].map(f => document.fonts.load(f)));
      } catch (e) { /* fall back to the default sans-serif */ }

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

      // A dry run measures the layout without drawing (the tall cards use it to fit)
      let dry = false;
      // Draw text at (cx, y); align 'center' or 'left'. Shrinks to fit maxW.
      const put = (str, cx, y, weight, size, color, spacing, maxW, align) => {
        let px = size;
        x.textAlign = align || 'center';
        x.font = weight + ' ' + px + 'px Poppins, sans-serif';
        if ('letterSpacing' in x) x.letterSpacing = spacing || '0px';
        while (maxW && x.measureText(str).width > maxW && px > 20) { px -= 2; x.font = weight + ' ' + px + 'px Poppins, sans-serif'; }
        if (dry) return;
        x.fillStyle = color;
        x.fillText(str, cx, y);
      };
      // Breaks text into at most maxLines lines, shrinking the size until it fits.
      // Draws them from y down and returns where the last line sits.
      const putLines = (str, cx, y, weight, size, color, maxW, maxLines, align) => {
        let px = size, lines;
        if ('letterSpacing' in x) x.letterSpacing = '0px';
        for (;;) {
          x.font = weight + ' ' + px + 'px Poppins, sans-serif';
          lines = [];
          let line = '';
          str.split(' ').forEach(w => {
            const next = line ? line + ' ' + w : w;
            if (line && x.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
          });
          lines.push(line);
          if (lines.length <= maxLines || px <= 24) break;
          px -= 4;
        }
        const lineH = Math.round(px * 1.18);
        lines.forEach((l, i) => put(l, cx, y + i * lineH, weight, px, color, '0px', maxW, align));
        return y + (lines.length - 1) * lineH;
      };
      // Plays by year, 1985 to 2016 at least: red bars, the busiest year in gold
      const bars = (left, top, w, h, labelSize) => {
        if (dry) return;
        const ys = Object.keys(counts).map(Number);
        const lo = Math.min(1985, ...ys), hi = Math.max(2016, ...ys);
        const max = Math.max(...Object.values(counts));
        const n = hi - lo + 1, gap = Math.max(2, Math.round(w / n * 0.18)), bw = (w - gap * (n - 1)) / n;
        let busiest = null;
        for (let y = lo; y <= hi; y++) if (counts[y] === max && busiest == null) busiest = y;
        for (let y = lo; y <= hi; y++) {
          const v = counts[y] || 0, bx = left + (y - lo) * (bw + gap);
          if (v) {
            const bh = Math.max(4, Math.round(h * v / max));
            x.fillStyle = y === busiest ? '#CCA23C' : '#C8102E';
            x.fillRect(bx, top + h - bh, bw, bh);
          } else {
            x.fillStyle = '#2a2a2a';
            x.fillRect(bx, top + h - 2, bw, 2);
          }
        }
        put(String(lo), left, top + h + labelSize + 8, '600', labelSize, '#929292', '1px', 0, 'left');
        put(String(hi), left + w, top + h + labelSize + 8, '600', labelSize, '#929292', '1px', 0, 'right');
      };

      const big = plays.length.toLocaleString('en-CA');
      const bigLabel = plays.length === 1 ? 'TIME PLAYED LIVE' : 'TIMES PLAYED LIVE';
      const details = [];
      if (plays.length) {
        if (plays.length === 1) details.push('Played on ' + fmtDate(first.iso));
        else details.push('Live debut: ' + fmtDate(first.iso), 'Latest: ' + fmtDate(last.iso));
      }

      if (landscape) {
        // The live count and the bars on the left, the song on the right
        put('\u{1F341}', 330, 120, '700', 56, '#ffffff');
        put('THE HIP HANDBOOK', 330, 172, '700', 26, '#ffffff', '8px', 520);
        if (plays.length) {
          put(big, 330, 330, '900', 150, '#ffffff', '0px', 520);
          put(bigLabel, 330, 382, '700', 30, '#ffffff', '8px', 520);
          bars(90, 412, 480, 92, 20);
        } else {
          putLines('No live performances on record', 330, 320, '700', 44, '#d9d9d9', 460, 2, 'center');
        }
        x.strokeStyle = 'rgba(204,162,60,0.3)';
        x.lineWidth = 2;
        x.beginPath(); x.moveTo(650, 90); x.lineTo(650, 540); x.stroke();
        let y = putLines(title, 690, 170, '800', 56, '#ffffff', 450, 3, 'left');
        if (fromLine) { y += 50; y = putLines(fromLine, 690, y, '600', 28, '#d9d9d9', 450, 2, 'left'); }
        y += 22;
        details.forEach(d => { y += 44; put(d, 690, y, '600', 28, '#d9d9d9', '0px', 450, 'left'); });
        if (k) {
          y += 56;
          y = putLines(rankLine, 690, y, '700', 28, '#ffffff', 450, 2, 'left');
          y += 34;
          put(rankShow, 690, y, '600', 22, '#929292', '0px', 450, 'left');
        }
        put(siteText, W / 2, 590, '600', 22, '#929292', '2px', W - 120);
      } else {
        // Portrait. Stories keep everything inside the safe zone (Instagram covers
        // roughly the top and bottom 250px with its own interface). A long title takes
        // up to three lines, so measure first: shrink until it fits, then centre it.
        const top = story ? 300 : 130, limit = story ? 1560 : 1180;
        const layout = (s, y) => {
          put('\u{1F341}', W / 2, y, '700', 90 * s, '#ffffff');
          y += 74 * s;
          put('THE HIP HANDBOOK', W / 2, y, '700', 36, '#ffffff', '10px', W - 160);
          y += 110 * s;
          y = putLines(title, W / 2, y, '800', 78 * s, '#ffffff', W - 180, 3, 'center');
          if (fromLine) { y += 64 * s; y = putLines(fromLine, W / 2, y, '600', 38 * s, '#d9d9d9', W - 180, 2, 'center'); }
          if (plays.length) {
            y += 250 * s;
            put(big, W / 2, y, '900', 230 * s, '#ffffff', '0px', W - 160);
            y += 70 * s;
            put(bigLabel, W / 2, y, '700', 44 * s, '#ffffff', '10px', W - 160);
            y += 44 * s;
            bars(150, y, W - 300, 130 * s, 26);
            y += 130 * s + 34;
            details.forEach(d => { y += 62 * s; put(d, W / 2, y, '600', 40 * s, '#d9d9d9', '0px', W - 180); });
          } else {
            y += 120 * s;
            y = putLines('No live performances on record', W / 2, y, '700', 52 * s, '#d9d9d9', W - 200, 2, 'center');
          }
          if (k) {
            y += 84 * s;
            y = putLines(rankLine, W / 2, y, '700', 42 * s, '#ffffff', W - 180, 2, 'center');
            y += 48 * s;
            put(rankShow, W / 2, y, '600', 30 * s, '#929292', '0px', W - 180);
          }
          return y;
        };
        let s = story ? 1.12 : 1, end;
        dry = true;
        while ((end = layout(s, top)) > limit && s > 0.6) s -= 0.04;
        dry = false;
        layout(s, top + Math.max(0, Math.round((limit - end) / 2)));
        put(siteText, W / 2, story ? 1650 : 1270, '600', 30, '#929292', '2px', W - 140);
      }

      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      if (currentCard) URL.revokeObjectURL(currentCard.url);
      currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
      const img = $('spCardImg');
      img.src = currentCard.url;
      // The card's own words, for people who can't see it (audit BRAND-15)
      img.alt = title + ' share card. ' + (fromLine ? fromLine + '. ' : '') +
        (plays.length ? big + ' ' + bigLabel.toLowerCase() + ', with a chart of plays by year. ' + details.join('. ') + '.' : 'No live performances on record.') +
        (k ? ' ' + rankLine + ', ' + rankShow + '.' : '');
      img.className = 'sp-card-img sp-card-' + cardFormat;
      $('spCardWrap').hidden = false;
      const file = new File([blob], cardFile(), { type: 'image/png' });
      $('spCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      track('Song - Card made - ' + cardFormat);
    }

    $('spMakeCard').addEventListener('click', makeCard);
    document.querySelectorAll('.sp-fmt').forEach(btn => btn.addEventListener('click', () => {
      cardFormat = btn.dataset.format;
      document.querySelectorAll('.sp-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      if (currentCard) makeCard(); // already showing a card: redraw in the new size
    }));
    $('spCardSave').addEventListener('click', () => {
      if (!currentCard) return;
      const a = el('a');
      a.href = currentCard.url;
      a.download = cardFile();
      document.body.appendChild(a); a.click(); a.remove();
      track('Song - Card saved');
    });
    $('spCardShare').addEventListener('click', async () => {
      if (!currentCard) return;
      const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
      try {
        await navigator.share({ files: [file], title: title + ' - The Hip Handbook', text: title + ' by The Tragically Hip, live history on The Hip Handbook: ' + url });
        track('Song - Card shared');
      } catch (e) { /* cancelled */ }
    });
  }

  // ─── All songs ───
  function renderIndex() {
    $('spLabel').textContent = 'Songs';
    $('spTitle').textContent = 'Every Song';
    $('spDesc').textContent = 'Every song on an official release, with its live history.';
    if (slug) {
      // An address with no song behind it should never be listed by search engines (audit FUNC-13)
      const robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex';
      document.head.appendChild(robots);
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
