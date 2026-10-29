// bring-it-all-back.js - 'Bring It All Back', the daily setlist game (v5)
// One real Hip setlist a day, the same for everyone. Guess the month and year in five tries.
// Everything runs in the browser from data/game-pool.json (scripts/build-game-pool.js);
// there is no server and nothing is sent anywhere except anonymous Umami event names.
(async function () {
  const $ = id => document.getElementById(id);
  const track = name => { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) { /* analytics optional */ } };

  // Date of puzzle #1 - the game opens this day (local time). Before it the page
  // says when the game opens instead of showing a puzzle.
  const EPOCH = '2026-10-30';
  const MAX_GUESSES = 5;
  // v2: a guess became { y, m } (month and year); v1 saves held bare years
  const STORE_KEY = 'tth_bia_v2';
  const SHARE_URL = 'thehiphandbook.tthpods.com/bring-it-all-back';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ?day=N and ?reset=1 are for testing, and only work on a local address
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const forcedDay = isLocal && /^\d+$/.test(params.get('day') || '') ? Math.max(1, +params.get('day')) : 0;

  // ─── Storage (never trust it to be there) ───
  const blank = () => ({ stats: { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0], lastSolved: 0 }, today: null });
  const load = () => {
    try {
      if (isLocal && params.get('reset') === '1') localStorage.removeItem(STORE_KEY);
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.stats && Array.isArray(saved.stats.dist) && saved.stats.dist.length === MAX_GUESSES) return saved;
    } catch (e) { /* private mode or bad data - start fresh */ }
    return blank();
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* playing still works */ } };
  const store = load();

  // ─── Which puzzle is today ───
  const localDayNumber = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, localDayNumber(new Date()) - epochDay + 1);
  const puzzleNo = forcedDay || naturalPuzzleNo();

  // Not open yet: say when, and open itself when the day arrives
  if (!forcedDay && localDayNumber(new Date()) < epochDay) {
    $('biaLoading').textContent = 'Bring It All Back opens ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + '. One real Hip setlist a day - come back then.';
    const now = new Date();
    setTimeout(() => location.reload(), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now + 1000);
    return;
  }

  // ─── Load the pool ───
  let pool;
  try {
    pool = await fetch('/data/game-pool.json').then(r => { if (!r.ok) throw new Error('pool'); return r.json(); });
    if (!pool.shows || !pool.shows.length) throw new Error('empty');
  } catch (e) {
    $('biaLoading').hidden = true;
    $('biaError').hidden = false;
    return;
  }
  const show = pool.shows[(puzzleNo - 1) % pool.shows.length];
  const parts = show.d.split('-'); // dd-mm-yyyy
  const answer = +parts[2];
  const answerMonth = +parts[1];
  const minYear = pool.minYear, maxYear = pool.maxYear;

  // Saved game belongs to a different puzzle (or is missing): start today's fresh
  if (!store.today || store.today.no !== puzzleNo || !Array.isArray(store.today.guesses)) {
    store.today = { no: puzzleNo, guesses: [], done: false, won: false };
  }
  const today = store.today;

  // ─── Pieces ───
  const isHit = g => g.y === answer && g.m === answerMonth;
  const missCount = () => today.guesses.filter(g => !isHit(g)).length;
  // Green: month and year. Yellow: right year, wrong month. Orange: within 2 years. Red: farther.
  const squareFor = g => {
    const diff = Math.abs(g.y - answer);
    return isHit(g) ? '\u{1F7E9}' : diff === 0 ? '\u{1F7E8}' : diff <= 2 ? '\u{1F7E7}' : '\u{1F7E5}';
  };
  const shortMonth = m => MONTHS[m - 1].slice(0, 3);
  const countryName = code => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  };
  const hints = [
    ['Country', () => countryName(show.co)],
    // Drop a trailing year ('Another Roadside Attraction 1997') so the hint doesn't give the answer away
    ['Tour', () => show.t ? show.t.replace(/\s+(19|20)\d\d$/, '') : 'none listed'],
    ['City', () => show.st ? show.c + ', ' + show.st : show.c],
  ];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function renderSetlist() {
    const box = $('biaSetlist');
    box.textContent = '';
    let count = 0;
    show.sets.forEach(group => {
      if (group.l === 'Encore') box.appendChild(el('div', 'bia-set-label', 'Encore'));
      const list = el('ul', 'bia-songs');
      list.style.setProperty('--start', count);
      group.s.forEach(song => list.appendChild(el('li', '', song)));
      count += group.s.length;
      box.appendChild(list);
    });
  }

  function renderGuesses() {
    const list = $('biaGuesses');
    list.textContent = '';
    today.guesses.forEach(g => {
      const li = el('li', 'bia-guess' + (isHit(g) ? ' hit' : ''));
      li.appendChild(el('span', 'bia-guess-year', shortMonth(g.m) + ' ' + g.y));
      // Right or wrong only - no earlier/later, so the hints do the narrowing
      const dir = el('span', 'bia-guess-dir');
      const yearOk = g.y === answer, monthOk = g.m === answerMonth;
      dir.appendChild(el('span', yearOk ? 'ok' : '', yearOk ? 'Right year' : 'Wrong year'));
      dir.appendChild(el('span', monthOk ? 'ok' : '', monthOk ? 'Right month' : 'Wrong month'));
      li.appendChild(dir);
      li.appendChild(el('span', 'bia-guess-sq', squareFor(g)));
      list.appendChild(li);
    });
  }

  function renderHints() {
    const list = $('biaHints');
    list.textContent = '';
    hints.slice(0, Math.min(missCount(), hints.length)).forEach(h => {
      const li = el('li');
      li.appendChild(el('b', '', h[0] + ':'));
      li.appendChild(document.createTextNode(' ' + h[1]()));
      list.appendChild(li);
    });
  }

  function renderTries() {
    const left = MAX_GUESSES - today.guesses.length;
    $('biaTries').textContent = today.done ? '' : left + (left === 1 ? ' guess left' : ' guesses left');
  }

  // Fewer guesses score higher: 100 for the first guess, then 80, 60, 40, 20; a miss is 0
  const pointsFor = guesses => (MAX_GUESSES - guesses + 1) * 20;
  const todayPoints = () => today.won ? pointsFor(today.guesses.length) : 0;
  // Worked out from the guess distribution, so games played before points existed still count
  const totalPoints = () => store.stats.dist.reduce((sum, wins, i) => sum + wins * pointsFor(i + 1), 0);

  const shareText = () =>
    '\u{1F341} Bring It All Back #' + puzzleNo + ' - ' + todayPoints() + ' points\n' +
    today.guesses.map(squareFor).join('') + '\n' + SHARE_URL;

  function shownStreak() {
    const s = store.stats;
    return s.lastSolved === puzzleNo || s.lastSolved === puzzleNo - 1 ? s.streak : 0;
  }

  function renderStats() {
    const s = store.stats;
    const box = $('biaStats');
    box.textContent = '';
    const row = el('div', 'bia-stat-row');
    [
      [s.played, 'Played'],
      [s.played ? Math.round(100 * s.won / s.played) : 0, 'Win %'],
      [shownStreak(), 'Streak'],
      [s.best, 'Best'],
      [totalPoints().toLocaleString('en-CA'), 'Points'],
    ].forEach(c => {
      const cell = el('div');
      cell.appendChild(el('b', String(c[0]).length > 4 ? 'long' : '', c[0])); // a big points total shrinks to fit
      cell.appendChild(el('span', '', c[1]));
      row.appendChild(cell);
    });
    box.appendChild(row);

    const dist = el('div', 'bia-dist');
    const max = Math.max(1, ...s.dist);
    s.dist.forEach((n, i) => {
      const r = el('div', 'bia-dist-row');
      r.appendChild(el('span', '', i + 1));
      const bar = el('span', 'bia-dist-bar' + (today.won && today.guesses.length === i + 1 ? ' today' : ''), n);
      bar.style.width = Math.max(8, Math.round(100 * n / max)) + '%';
      r.appendChild(bar);
      dist.appendChild(r);
    });
    box.appendChild(dist);
  }

  function renderEnd() {
    $('biaForm').hidden = true;
    $('biaMsg').textContent = '';
    $('biaEnd').hidden = false;
    $('biaResult').textContent = today.won
      ? (today.guesses.length === 1 ? 'First try. Bang on. 100 points!' : 'Got it in ' + today.guesses.length + ' - ' + todayPoints() + ' points!')
      : 'Not today - it was ' + MONTHS[answerMonth - 1] + ' ' + answer + '. 0 points.';
    const total = $('biaTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', totalPoints().toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' game' : ' games')));

    const d = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0]));
    const reveal = $('biaReveal');
    reveal.textContent = '';
    reveal.appendChild(el('div', 'when', DAYS[d.getUTCDay()] + ', ' + MONTHS[+parts[1] - 1] + ' ' + (+parts[0]) + ', ' + parts[2]));
    reveal.appendChild(el('div', 'where', show.v || show.c));
    reveal.appendChild(el('div', 'meta', [show.c, show.st, countryName(show.co)].filter(Boolean).join(', ')));
    reveal.appendChild(el('div', 'meta', show.t ? show.t + ' tour' : 'No tour listed'));

    const links = $('biaLinks');
    links.textContent = '';
    if (show.r === 1) {
      const play = el('a', '', 'Play this show');
      play.href = 'tour-map.html#play=' + show.id;
      links.appendChild(play);
    }
    const map = el('a', '', 'View on map');
    map.href = 'tour-map.html#show=' + show.id;
    links.appendChild(map);

    $('biaShareText').textContent = shareText();
    renderStats();
    startCountdown();
  }

  function renderAll() {
    $('biaNo').textContent = 'Puzzle #' + puzzleNo;
    renderSetlist();
    renderGuesses();
    renderHints();
    renderTries();
    if (today.done) renderEnd();
  }

  // ─── Finishing a game ───
  function finish(won) {
    today.done = true;
    today.won = won;
    const s = store.stats;
    s.played++;
    if (won) {
      s.won++;
      s.dist[today.guesses.length - 1]++;
      s.streak = s.lastSolved === puzzleNo - 1 ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    track(won ? 'Game - Won' : 'Game - Lost');
  }

  // ─── Guessing ───
  $('biaForm').addEventListener('submit', e => {
    e.preventDefault();
    if (today.done) return;
    const msg = $('biaMsg');
    const m = +$('biaMonth').value;
    const raw = $('biaInput').value.trim();
    const y = /^\d{4}$/.test(raw) ? +raw : NaN;
    if (!m) { msg.textContent = 'Pick a month.'; return; }
    if (isNaN(y) || y < minYear || y > maxYear) { msg.textContent = 'Pick a year from ' + minYear + ' to ' + maxYear + '.'; return; }
    if (today.guesses.some(g => g.y === y && g.m === m)) { msg.textContent = 'Already guessed ' + MONTHS[m - 1] + ' ' + y + '. Try another.'; return; }
    msg.textContent = '';
    if (!today.guesses.length) track('Game - Started');
    const g = { y, m };
    today.guesses.push(g);
    // Both fields stay filled, so a player can change just the part that was wrong
    if (isHit(g)) finish(true);
    else if (today.guesses.length >= MAX_GUESSES) finish(false);
    save();
    renderGuesses();
    renderHints();
    renderTries();
    if (today.done) renderEnd();
  });

  // ─── Sharing ───
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back below */ }
    const ta = el('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
    ta.remove();
    return ok;
  }
  $('biaCopy').addEventListener('click', async () => {
    const btn = $('biaCopy');
    const ok = await copyText(shareText());
    track('Game - Shared');
    btn.textContent = ok ? 'Copied!' : 'Copy failed - select the text above';
    setTimeout(() => { btn.textContent = 'Copy my score'; }, 2000);
  });
  if (navigator.share) {
    $('biaShare').hidden = false;
    $('biaShare').addEventListener('click', () => {
      navigator.share({ text: shareText() }).then(() => track('Game - Shared')).catch(() => { /* cancelled */ });
    });
  }

  // ─── Score card (image) ───
  // Same three sizes as the Passport card. No spoilers: never the show, the date,
  // or the years guessed - people post it before their friends have played.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  // The emoji squares' colours, so the card matches the text share
  const TILE = { '\u{1F7E9}': '#4CAF50', '\u{1F7E8}': '#F2C94C', '\u{1F7E7}': '#F2994A', '\u{1F7E5}': '#C8102E' };
  let cardFormat = 'facebook';
  let currentCard = null; // { blob, url, format }
  const cardFile = () => 'bring-it-all-back-' + puzzleNo + '-' + FORMATS[cardFormat].file + '.png';

  async function makeCard() {
    const fmt = FORMATS[cardFormat];
    const W = fmt.w, H = fmt.h, landscape = W > H, story = H > 1500;
    let name = '';
    try {
      const sess = window.TTHMember && window.TTHMember.getSession();
      if (sess && !sess.guest && sess.firstName) name = String(sess.firstName).trim().slice(0, 20);
    } catch (e) { /* no name then */ }
    try {
      await Promise.all(['900 300px Poppins', '700 48px Poppins', '600 40px Poppins'].map(f => document.fonts.load(f)));
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
    // One tile per guess; unused tries show as empty outlines
    const tiles = (left, top, size, gap) => {
      for (let i = 0; i < MAX_GUESSES; i++) {
        const tx = left + i * (size + gap), g = today.guesses[i];
        x.beginPath();
        if (x.roundRect) x.roundRect(tx, top, size, size, size * 0.14); else x.rect(tx, top, size, size);
        if (g) { x.fillStyle = TILE[squareFor(g)]; x.fill(); }
        else { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3; x.stroke(); }
      }
    };

    const n = today.guesses.length;
    const score = String(todayPoints());
    const result = today.won
      ? (n === 1 ? (name ? name + ' got it first try' : 'First try. Bang on.') : (name ? name + ' got it in ' + n : 'Got it in ' + n))
      : (name ? name + ' was stumped today' : 'Stumped today');
    const s = store.stats;
    const statLine = 'Streak ' + shownStreak() + '   |   Win rate ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%';
    const totalLine = 'Total: ' + totalPoints().toLocaleString('en-CA') + ' points';
    const siteText = SHARE_URL;

    if (landscape) {
      // Score on the left, the details on the right
      put('\u{1F341}', 330, 130, '700', 60, '#ffffff');
      put('BRING IT ALL BACK', 330, 186, '700', 28, '#CCA23C', '8px', 520);
      put('PUZZLE #' + puzzleNo, 330, 232, '700', 26, '#b0b0b0', '6px');
      put(score, 330, 420, '900', 190, '#C8102E', '0px', 540);
      put('POINTS', 330, 492, '700', 40, '#CCA23C', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      put(result, 690, 210, '700', 42, '#ffffff', '0px', 460, 'left');
      tiles(690, 255, 76, 16);
      put(totalLine, 690, 395, '700', 34, '#CCA23C', '0px', 460, 'left');
      put(statLine, 690, 445, '600', 28, '#d9d9d9', '0px', 460, 'left');
      put('Guess the month and year of a real Hip setlist', 690, 492, '600', 24, '#b0b0b0', '0px', 460, 'left');
      put(siteText, W / 2, 585, '600', 24, '#b0b0b0', '2px', W - 120);
    } else {
      // Portrait. Stories keep content inside the safe zone (Instagram covers
      // roughly the top and bottom 250px with its own interface).
      const y = story
        ? { maple: 360, label: 450, no: 525, score: 880, pts: 970, result: 1090, tiles: 1150, size: 150, total: 1395, stats: 1465, blurb: 1530, site: 1640 }
        : { maple: 160, label: 232, no: 290, score: 590, pts: 668, result: 768, tiles: 806, size: 140, total: 1036, stats: 1100, blurb: 1160, site: 1250 };
      const gap = 24, rowW = MAX_GUESSES * y.size + (MAX_GUESSES - 1) * gap;
      put('\u{1F341}', W / 2, y.maple, '700', story ? 110 : 96, '#ffffff');
      put('BRING IT ALL BACK', W / 2, y.label, '700', 40, '#CCA23C', '10px', W - 160);
      put('PUZZLE #' + puzzleNo, W / 2, y.no, '700', 36, '#b0b0b0', '6px');
      put(score, W / 2, y.score, '900', story ? 330 : 290, '#C8102E', '0px', W - 160);
      put('POINTS', W / 2, y.pts, '700', story ? 64 : 56, '#CCA23C', '12px');
      put(result, W / 2, y.result, '700', story ? 62 : 56, '#ffffff', '0px', W - 160);
      tiles((W - rowW) / 2, y.tiles, y.size, gap);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 48, '#CCA23C', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 38, '#d9d9d9', '0px', W - 160);
      put('Guess the month and year of a real Hip setlist', W / 2, y.blurb, '600', story ? 34 : 30, '#b0b0b0', '0px', W - 160);
      put(siteText, W / 2, y.site, '600', 32, '#b0b0b0', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('biaCardImg');
    img.src = currentCard.url;
    img.className = 'bia-card-img bia-card-' + cardFormat;
    $('biaCardWrap').hidden = false;
    const file = new File([blob], cardFile(), { type: 'image/png' });
    $('biaCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Game - Card made - ' + cardFormat);
  }

  $('biaMakeCard').addEventListener('click', () => { if (today.done) makeCard(); });
  document.querySelectorAll('.bia-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.bia-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (today.done && currentCard) makeCard(); // already showing a card: redraw in the new size
  }));
  $('biaCardSave').addEventListener('click', () => {
    if (!currentCard) return;
    const a = el('a');
    a.href = currentCard.url;
    a.download = cardFile();
    document.body.appendChild(a); a.click(); a.remove();
    track('Game - Card saved');
  });
  $('biaCardShare').addEventListener('click', async () => {
    if (!currentCard) return;
    const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'Bring It All Back #' + puzzleNo, text: shareText() });
      track('Game - Card shared');
    } catch (e) { /* cancelled */ }
  });

  // ─── Countdown to the next puzzle ───
  let timer = null;
  function startCountdown() {
    if (timer) return;
    const tick = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const left = Math.max(0, Math.round((next - now) / 1000));
      if (left === 0) { location.reload(); return; }
      const p = n => String(n).padStart(2, '0');
      $('biaCountdown').textContent = p(Math.floor(left / 3600)) + ':' + p(Math.floor(left / 60) % 60) + ':' + p(left % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Phone left open overnight: new day, new puzzle
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !forcedDay && naturalPuzzleNo() !== puzzleNo) location.reload();
  });

  renderAll();
  $('biaLoading').hidden = true;
  $('biaGame').hidden = false;
})();
