// bring-it-all-back.js - 'Bring It All Back', the daily setlist game (v5)
// One real Hip setlist a day, the same for everyone. Guess the year in five tries.
// Everything runs in the browser from data/game-pool.json (scripts/build-game-pool.js);
// there is no server and nothing is sent anywhere except anonymous Umami event names.
(async function () {
  const $ = id => document.getElementById(id);
  const track = name => { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) { /* analytics optional */ } };

  // Date of puzzle #1 - the game opens this day (local time). Before it the page
  // says when the game opens instead of showing a puzzle.
  const EPOCH = '2026-10-30';
  const MAX_GUESSES = 5;
  const STORE_KEY = 'tth_bia_v1';
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
  const minYear = pool.minYear, maxYear = pool.maxYear;

  // Saved game belongs to a different puzzle (or is missing): start today's fresh
  if (!store.today || store.today.no !== puzzleNo || !Array.isArray(store.today.guesses)) {
    store.today = { no: puzzleNo, guesses: [], done: false, won: false };
  }
  const today = store.today;

  // ─── Pieces ───
  const missCount = () => today.guesses.filter(g => g !== answer).length;
  const squareFor = g => {
    const diff = Math.abs(g - answer);
    return diff === 0 ? '\u{1F7E9}' : diff <= 2 ? '\u{1F7E8}' : diff <= 5 ? '\u{1F7E7}' : '\u{1F7E5}';
  };
  const countryName = code => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  };
  const hints = [
    ['Country', () => countryName(show.co)],
    ['Tour', () => show.t || 'none listed'],
    ['City', () => show.st ? show.c + ', ' + show.st : show.c],
    ['Month', () => MONTHS[+parts[1] - 1]],
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
      const hit = g === answer;
      const li = el('li', 'bia-guess' + (hit ? ' hit' : ''));
      li.appendChild(el('span', 'bia-guess-year', g));
      li.appendChild(el('span', 'bia-guess-dir', hit ? 'Right year' : g < answer ? 'Later - the show was after ' + g : 'Earlier - the show was before ' + g));
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

  const shareText = () =>
    '\u{1F341} Bring It All Back #' + puzzleNo + ' ' + (today.won ? today.guesses.length : 'X') + '/' + MAX_GUESSES + '\n' +
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
    ].forEach(c => {
      const cell = el('div');
      cell.appendChild(el('b', '', c[0]));
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
      ? (today.guesses.length === 1 ? 'First try. Bang on.' : 'Got it in ' + today.guesses.length + '!')
      : 'Not today - it was ' + answer + '.';

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
    const raw = $('biaInput').value.trim();
    const g = /^\d{4}$/.test(raw) ? +raw : NaN;
    if (isNaN(g) || g < minYear || g > maxYear) { msg.textContent = 'Pick a year from ' + minYear + ' to ' + maxYear + '.'; return; }
    if (today.guesses.includes(g)) { msg.textContent = 'Already guessed ' + g + '. Try another year.'; return; }
    msg.textContent = '';
    if (!today.guesses.length) track('Game - Started');
    today.guesses.push(g);
    $('biaInput').value = '';
    if (g === answer) finish(true);
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
