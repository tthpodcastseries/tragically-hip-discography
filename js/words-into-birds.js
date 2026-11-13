// words-into-birds.js - 'Words Into Birds', the weekly crossword
// Twenty clues on one grid (15 about The Hip, 5 music linking words), the same for everyone. A new grid every Saturday at
// midnight Toronto time. The name is from 'About This Map': "turn words into birds".
// Everything runs in the browser from data/bird-puzzles.json, which jD edits by hand (grids
// laid out by scripts/build-bird-grids.js); there is no server and nothing is sent anywhere
// except anonymous Umami event names.
// Shares its frame and styles with are-we-family.js / bring-it-all-back.js.
(async function () {
  const $ = id => document.getElementById(id);
  const track = (name, data) => { try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) { /* analytics optional */ } };

  // Date of puzzle 1, a Saturday - the game opens at midnight Toronto time on this day. Before
  // it the page says when the game opens instead of showing a grid. Saturday, November 21, 2026
  // (jD, 2026-11-05). Never change it once the game has opened.
  const EPOCH = '2026-11-21';
  const STEP_DAYS = 7; // one puzzle a week
  const START_POINTS = 100;
  const CHECK_COST = 5;
  const REVEAL_COST = 10;
  const FLOOR_POINTS = 10; // a finished grid keeps at least this many
  const STORE_KEY = 'tth_birds_v1';
  const SHARE_URL = 'thehiphandbook.tthpods.com/words-into-birds';
  const NAME = 'Words Into Birds';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ?week=N and ?reset=1 are for testing, and only work on a local address
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const forcedNo = isLocal && /^\d+$/.test(params.get('week') || '') ? Math.max(1, +params.get('week')) : 0;

  // ─── Storage (never trust it to be there) ───
  const blank = () => ({ stats: { played: 0, won: 0, streak: 0, best: 0, points: 0, fastest: 0, lastSolved: 0, lastPlayed: 0 }, today: null });
  const load = () => {
    try {
      if (isLocal && params.get('reset') === '1') localStorage.removeItem(STORE_KEY);
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.stats && typeof saved.stats.played === 'number') return saved;
    } catch (e) { /* private mode or bad data - start fresh */ }
    return blank();
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* playing still works */ } };
  const store = load();

  // ─── Which day it is: Toronto's calendar date ───
  // Every fan gets the new grid at midnight Toronto time, wherever they are. The same code is
  // in are-we-family.js, unlocked.js and bring-it-all-back.js.
  let torontoClock = null;
  try {
    torontoClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  } catch (e) { /* no time-zone data */ }
  const torontoWall = t => {
    const d = new Date(t);
    if (torontoClock) {
      try {
        const p = {};
        torontoClock.formatToParts(d).forEach(x => { p[x.type] = +x.value; });
        if (p.year && p.month && p.day) return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
      } catch (e) { /* fall back below */ }
    }
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  };
  const dayNumber = (t = Date.now()) => Math.floor(torontoWall(t) / 86400000);
  const msUntilDay = n => {
    const t = Date.now();
    const offset = at => torontoWall(at) - Math.floor(at / 1000) * 1000;
    let at = n * 86400000 - offset(t);
    at = n * 86400000 - offset(at);
    return at - t;
  };

  // ─── Which puzzle is this week's ───
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, Math.floor((dayNumber() - epochDay) / STEP_DAYS) + 1);
  // Normally this week's puzzle, but a saved game is kept when it's last week's and half done
  // (finish it first), or one week ahead (a fan east of Toronto who already had the next one)
  const natural = naturalPuzzleNo();
  const saved = store.today && store.today.letters && typeof store.today.letters === 'object' ? store.today : null;
  const carried = !forcedNo && !!saved && (saved.no === natural + 1 || (saved.no === natural - 1 && !saved.done && !!saved.started));
  const puzzleNo = forcedNo || (carried ? saved.no : natural);
  const lastWeeks = carried && puzzleNo < natural;

  if (!forcedNo && dayNumber() < epochDay) {
    const opens = new Date(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]));
    $('wbLoading').textContent = NAME + ' opens ' + DAYS[opens.getUTCDay()] + ', ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + ', at midnight Toronto time (Eastern). A new crossword every Saturday - come back then.';
    setTimeout(() => location.reload(), Math.min(msUntilDay(dayNumber() + 1) + 1000, 2147483647));
    return;
  }

  // ─── Load the puzzles ───
  let pool;
  try {
    pool = await fetch('/data/bird-puzzles.json').then(r => { if (!r.ok) throw new Error('pool'); return r.json(); });
    if (!pool.puzzles || !pool.puzzles.length) throw new Error('empty');
  } catch (e) {
    $('wbLoading').hidden = true;
    $('wbError').hidden = false;
    return;
  }
  const puzzle = pool.puzzles[(puzzleNo - 1) % pool.puzzles.length];
  // Past the last puzzle the game starts again from the first one, and says so: the
  // heading, the share text and the card all get a "rerun" label (jD, 2026-11-13). Add
  // puzzles on the end of the pool before the run ends and no rerun is ever shown.
  const rerunOf = puzzleNo > pool.puzzles.length ? ((puzzleNo - 1) % pool.puzzles.length) + 1 : 0;
  const puzzleNote = late => { const tags = [late, rerunOf ? 'rerun' : ''].filter(Boolean); return tags.length ? ' (' + tags.join(', ') + ')' : ''; };
  const rerunTag = puzzleNote('');
  const R = puzzle.rows, C = puzzle.cols;

  // ─── The grid ───
  // sq["r,c"] = { r, c, ch, across, down, num, el, lEl }; each clue gets .sqs (its squares, in order)
  const sq = {};
  const clues = puzzle.clues.map((c, i) => Object.assign({ i, sqs: [] }, c));
  clues.forEach(c => {
    for (let k = 0; k < c.answer.length; k++) {
      const r = c.row + (c.dir === 'down' ? k : 0), col = c.col + (c.dir === 'across' ? k : 0);
      const id = r + ',' + col;
      sq[id] = sq[id] || { id, r, c: col, ch: c.answer[k] };
      sq[id][c.dir] = c;
      c.sqs.push(sq[id]);
    }
    sq[c.row + ',' + c.col].num = c.num;
  });
  const order = clues.slice().sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  const allSq = Object.values(sq);

  // Saved game belongs to a different puzzle (or is missing): start this week's fresh
  // letters: { "r,c": "A" }; shown: squares revealed with Show letter
  const fingerprint = clues.map(c => c.answer).join('|');
  if (!saved || saved.no !== puzzleNo || saved.fp !== fingerprint) {
    store.today = { no: puzzleNo, fp: fingerprint, letters: {}, shown: [], checks: 0, reveals: 0, secs: 0, started: false, done: false, won: false };
  }
  const today = store.today;
  const shown = new Set(today.shown);

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const board = $('wbBoard');
  const keys = $('wbKeys');
  let cur = null, curClue = null;

  function sizeBoard() {
    const cs = Math.max(17, Math.min(36, Math.floor($('wbBoardWrap').clientWidth / C)));
    board.style.setProperty('--cs', cs + 'px');
    board.style.gridTemplateColumns = 'repeat(' + C + ', ' + cs + 'px)';
  }
  // A grid's squares must sit inside rows for a screen reader to count them. The row
  // boxes take no space of their own (display: contents in the CSS), so the squares are
  // laid out exactly as before. A row that is all black squares is hidden instead.
  for (let r = 0; r < R; r++) {
    const row = el('div', 'wb-row');
    let open = 0;
    for (let c = 0; c < C; c++) {
      const s = sq[r + ',' + c];
      const d = el('div', 'wb-sq' + (s ? ' on' : ''));
      if (s) {
        open++;
        d.setAttribute('role', 'gridcell');
        if (s.num) d.appendChild(el('span', 'wb-n', s.num));
        s.lEl = d.appendChild(el('span', 'wb-l'));
        s.el = d;
        d.addEventListener('click', () => tap(s));
      } else d.setAttribute('aria-hidden', 'true');
      row.appendChild(d);
    }
    if (open) row.setAttribute('role', 'row'); else row.setAttribute('aria-hidden', 'true');
    board.appendChild(row);
  }
  sizeBoard();
  window.addEventListener('resize', sizeBoard);

  const clueLine = c => c.num + ' ' + (c.dir === 'across' ? 'Across' : 'Down');
  ['across', 'down'].forEach(dir => {
    const ol = $(dir === 'across' ? 'wbAcross' : 'wbDown');
    order.filter(c => c.dir === dir).forEach(c => {
      const li = el('li');
      li.tabIndex = 0;
      li.appendChild(el('span', 'wb-cn', c.num));
      const t = el('span', '', c.clue + ' ');
      t.appendChild(el('span', 'wb-enum', '(' + c.enum + ')'));
      li.appendChild(t);
      const go = () => { if (!today.done) select(c, firstEmpty(c), true); };
      li.addEventListener('click', go);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      c.li = li;
      ol.appendChild(li);
    });
  });

  // ─── Points and the clock ───
  const points = () => {
    if (today.done && !today.won) return 0;
    const p = START_POINTS - today.checks * CHECK_COST - today.reveals * REVEAL_COST;
    return Math.max(FLOOR_POINTS, p);
  };
  const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  let ticker = null, lastTick = 0;
  function startClock() {
    if (ticker || today.done) return;
    lastTick = Date.now();
    ticker = setInterval(() => {
      if (document.hidden) { lastTick = Date.now(); return; }
      const now = Date.now();
      const add = Math.floor((now - lastTick) / 1000);
      if (add > 0) { today.secs += add; lastTick += add * 1000; $('wbTime').textContent = clock(today.secs); if (today.secs % 5 === 0) save(); }
    }, 250);
  }
  const stopClock = () => { clearInterval(ticker); ticker = null; };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lastTick = Date.now(); else save(); });

  function renderMeta() {
    $('wbNo').textContent = 'Puzzle ' + puzzleNo + puzzleNote(lastWeeks ? "last week's" : '');
    $('wbPoints').textContent = points() + ' points';
    $('wbTime').textContent = clock(today.secs);
  }

  // ─── Picking a square ───
  const firstEmpty = c => c.sqs.find(s => !today.letters[s.id]) || c.sqs[0];
  function markStarted() {
    if (today.started) return;
    today.started = true;
    track('Birds - Started', startInfo());
    save();
  }
  function tap(s) {
    if (today.done) return;
    if (cur === s && s.across && s.down) curClue = curClue === s.across ? s.down : s.across;
    else if (!curClue || !curClue.sqs.includes(s)) curClue = s[curClue ? curClue.dir : 'across'] || s.across || s.down;
    select(curClue, s, true);
  }
  // focus: only on a tap or a key, so a phone doesn't pop its keyboard open on page load
  function select(c, s, focus) {
    curClue = c; cur = s;
    board.querySelectorAll('.word, .cur').forEach(n => n.classList.remove('word', 'cur'));
    c.sqs.forEach(x => x.el.classList.add('word'));
    s.el.classList.add('cur');
    document.querySelectorAll('.wb-list li.act').forEach(n => n.classList.remove('act'));
    c.li.classList.add('act');
    const t = $('wbClueText');
    t.textContent = '';
    t.appendChild(el('b', '', clueLine(c)));
    t.appendChild(document.createTextNode(c.clue + ' '));
    t.appendChild(el('span', 'wb-enum', '(' + c.enum + ')'));
    if (focus) {
      keys.focus({ preventScroll: true });
      markStarted();
      startClock();
      // Keep the square in view below the stuck clue bar
      const box = s.el.getBoundingClientRect(), bar = $('wbClueBar').getBoundingClientRect();
      if (box.top < bar.bottom + 4) window.scrollBy({ top: box.top - bar.bottom - 12 });
      else if (box.bottom > window.innerHeight - 8) window.scrollBy({ top: box.bottom - window.innerHeight + 60 });
    }
  }

  // ─── Typing ───
  function setLetter(s, v) {
    if (v) today.letters[s.id] = v; else delete today.letters[s.id];
    s.lEl.textContent = v || '';
    s.el.classList.remove('bad');
  }
  function move(delta) {
    const i = curClue.sqs.indexOf(cur) + delta;
    if (i >= 0 && i < curClue.sqs.length) select(curClue, curClue.sqs[i], true);
  }
  function jump(delta) {
    const i = curClue ? order.indexOf(curClue) : -1;
    const n = order[(i + delta + order.length) % order.length];
    select(n, firstEmpty(n), true);
  }
  function type(ch) {
    if (!cur || today.done) return;
    if (shown.has(cur.id)) { move(1); return; } // a shown letter can't be typed over
    setLetter(cur, ch);
    // On to the next empty square in this answer, else just the next square
    const next = curClue.sqs.slice(curClue.sqs.indexOf(cur) + 1).find(x => !today.letters[x.id]);
    if (next) select(curClue, next, true); else move(1);
    afterChange();
  }
  function back() {
    if (!cur || today.done) return;
    if (today.letters[cur.id] && !shown.has(cur.id)) setLetter(cur, '');
    else {
      const i = curClue.sqs.indexOf(cur);
      if (i > 0) { select(curClue, curClue.sqs[i - 1], true); if (!shown.has(cur.id)) setLetter(cur, ''); }
    }
    afterChange();
  }
  function arrow(dr, dc) {
    if (!cur) return;
    const want = dc ? 'across' : 'down';
    if (curClue.dir !== want && cur[want]) { select(cur[want], cur, true); return; }
    for (let r = cur.r + dr, c = cur.c + dc; r >= 0 && r < R && c >= 0 && c < C; r += dr, c += dc) {
      const n = sq[r + ',' + c];
      if (n) { select(n[want] || n.across || n.down, n, true); return; }
    }
  }
  keys.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || today.done) return;
    const k = e.key;
    if (/^[a-z]$/i.test(k)) { e.preventDefault(); type(k.toUpperCase()); }
    else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); back(); }
    else if (k === 'ArrowRight') { e.preventDefault(); arrow(0, 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); arrow(0, -1); }
    else if (k === 'ArrowDown') { e.preventDefault(); arrow(1, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); arrow(-1, 0); }
    else if (k === 'Enter') { e.preventDefault(); jump(e.shiftKey ? -1 : 1); }
    else if (k === ' ') { e.preventDefault(); if (cur && cur.across && cur.down) tap(cur); }
    else if (k === 'Escape') keys.blur();
  });
  // Phone keyboards (and swipe typing or autocomplete) often send text without a key name:
  // take every letter that arrives, in order
  keys.addEventListener('input', () => {
    const v = keys.value.replace(/[^a-z]/gi, '').toUpperCase();
    keys.value = '';
    for (const ch of v) type(ch);
  });
  $('wbPrev').addEventListener('click', () => { if (!today.done) jump(-1); });
  $('wbNext').addEventListener('click', () => { if (!today.done) jump(1); });

  // ─── After every change ───
  function afterChange() {
    clues.forEach(c => c.li.classList.toggle('full', c.sqs.every(s => today.letters[s.id])));
    renderMeta();
    if (allSq.every(s => today.letters[s.id] === s.ch)) finish(true);
    else if (allSq.every(s => today.letters[s.id])) say('Every square is filled, but something is off. Try Check grid.');
    save();
  }
  const say = t => { $('wbMsg').textContent = t; };

  // ─── Help (each one costs points) ───
  function check(list, what) {
    if (today.done) return;
    if (!list.some(s => today.letters[s.id] && !shown.has(s.id))) { say('Nothing to check yet - type some letters first.'); return; }
    markStarted();
    today.checks++;
    let wrong = 0;
    list.forEach(s => { if (today.letters[s.id] && today.letters[s.id] !== s.ch) { s.el.classList.add('bad'); wrong++; } });
    say((wrong ? wrong + (wrong === 1 ? ' square' : ' squares') + ' marked in red' : 'Everything in ' + what + ' is right so far') + '. -' + CHECK_COST + ' points.');
    track('Birds - Checked');
    renderMeta();
    save();
    if (cur) keys.focus({ preventScroll: true });
  }
  $('wbCheckWord').addEventListener('click', () => { if (curClue) check(curClue.sqs, 'this answer'); });
  $('wbCheckAll').addEventListener('click', () => check(allSq, 'the grid'));
  $('wbReveal').addEventListener('click', () => {
    if (today.done || !cur) return;
    if (today.letters[cur.id] === cur.ch) { say('That square is already right.'); keys.focus({ preventScroll: true }); return; }
    markStarted();
    today.reveals++;
    shown.add(cur.id);
    today.shown = [...shown];
    setLetter(cur, cur.ch);
    cur.el.classList.add('shown');
    say('Letter shown. -' + REVEAL_COST + ' points.');
    track('Birds - Letter shown');
    keys.focus({ preventScroll: true });
    afterChange();
  });
  // Give up takes two taps, so a stray one doesn't end the week
  let giveUpArmed = null;
  $('wbGiveUp').addEventListener('click', () => {
    const btn = $('wbGiveUp');
    if (today.done) return;
    if (!giveUpArmed) {
      btn.textContent = 'Sure? Tap again';
      btn.classList.add('sure');
      giveUpArmed = setTimeout(() => { btn.textContent = 'Give up'; btn.classList.remove('sure'); giveUpArmed = null; }, 4000);
      return;
    }
    clearTimeout(giveUpArmed);
    markStarted();
    finish(false);
  });

  // ─── Finishing ───
  function finish(won) {
    if (today.done) return;
    today.done = true;
    today.won = won;
    stopClock();
    const s = store.stats;
    s.played++;
    if (won) {
      s.won++;
      s.points += points();
      s.streak = s.lastSolved === puzzleNo - 1 ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
      if (!today.checks && !today.reveals && (!s.fastest || today.secs < s.fastest)) s.fastest = today.secs;
    } else {
      s.streak = 0;
      allSq.forEach(x => { if (today.letters[x.id] !== x.ch) { today.letters[x.id] = x.ch; x.lEl.textContent = x.ch; x.el.classList.add('shown'); } });
    }
    save();
    track(won ? 'Birds - Solved' : 'Birds - Gave up');
    renderAll();
  }
  const shownStreak = () => store.stats.lastSolved === puzzleNo || store.stats.lastSolved === puzzleNo - 1 ? store.stats.streak : 0;
  // Sent with the Started event so Umami can count real return players (same bands as
  // are-we-family.js). Nothing personal.
  const startInfo = () => {
    const s = store.stats, n = s.played || 0;
    const last = Math.max(s.lastPlayed || 0, s.lastSolved || 0);
    const gap = puzzleNo - last;
    const info = {
      game: n === 0 ? 'First game' : n < 3 ? '2nd or 3rd' : n < 7 ? '4th to 7th' : n < 15 ? '8th to 15th' : '16th or more',
      last: !last ? (n ? 'Not known' : 'First game') : gap <= 1 ? 'Last week' : gap <= 4 ? '2-4 weeks ago' : 'Over a month ago'
    };
    s.lastPlayed = puzzleNo;
    return info;
  };

  // ─── The end card ───
  const helpWords = () => {
    const bits = [];
    if (today.checks) bits.push(today.checks + (today.checks === 1 ? ' check' : ' checks'));
    if (today.reveals) bits.push(today.reveals + (today.reveals === 1 ? ' letter shown' : ' letters shown'));
    return bits.length ? bits.join(', ') : 'no help';
  };
  const resultLine = () => today.won
    ? 'Filled in ' + clock(today.secs) + ' with ' + helpWords() + ' - ' + points() + ' points!'
    : 'Gave up after ' + clock(today.secs) + '. 0 points this week.';
  // No answers in the share: the time, the points and the help only
  const shareText = () =>
    '\u{1F426} ' + NAME + ', Puzzle ' + puzzleNo + rerunTag + ' - ' + points() + ' points\n' +
    (today.won ? 'Filled in ' + clock(today.secs) + ' (' + helpWords() + ')' : 'Gave up after ' + clock(today.secs)) +
    '\nhttps://' + SHARE_URL + '\n';

  function renderStats() {
    const s = store.stats;
    const box = $('wbStats');
    box.textContent = '';
    const row = el('div', 'bia-stat-row');
    [
      [s.played, 'Played'],
      [s.played ? Math.round(100 * s.won / s.played) : 0, 'Solved %'],
      [shownStreak(), 'Weeks'],
      [s.best, 'Best'],
      [s.points.toLocaleString('en-CA'), 'Points'],
    ].forEach(c => {
      const cell = el('div');
      cell.appendChild(el('b', String(c[0]).length > 4 ? 'long' : '', c[0]));
      cell.appendChild(el('span', '', c[1]));
      row.appendChild(cell);
    });
    box.appendChild(row);
    if (s.fastest) box.appendChild(el('p', 'bia-next', 'Fastest with no help: ' + clock(s.fastest)));
  }

  function renderEnd() {
    $('wbEnd').hidden = false;
    $('wbResult').setAttribute('tabindex', '-1');
    $('wbResult').textContent = resultLine();
    const total = $('wbTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', store.stats.points.toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' crossword' : ' crosswords')));
    $('wbShareText').textContent = shareText();
    renderStats();
    startCountdown();
  }

  function renderAll() {
    allSq.forEach(s => {
      s.lEl.textContent = today.letters[s.id] || '';
      s.el.classList.toggle('shown', shown.has(s.id) || (today.done && !today.won));
    });
    clues.forEach(c => c.li.classList.toggle('full', c.sqs.every(s => today.letters[s.id])));
    renderMeta();
    $('wbControls').hidden = today.done;
    board.classList.toggle('done', today.done);
    board.classList.toggle('solved', today.done && today.won);
    if (today.done) {
      board.querySelectorAll('.word, .cur').forEach(n => n.classList.remove('word', 'cur'));
      $('wbClueBar').hidden = true;
      say('');
      const hadFocus = document.activeElement === keys;
      renderEnd();
      if (hadFocus) $('wbResult').focus();
    }
  }

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
  $('wbCopy').addEventListener('click', async () => {
    const btn = $('wbCopy');
    const ok = await copyText(shareText());
    track('Birds - Shared');
    btn.textContent = ok ? 'Copied!' : 'Copy failed - select the text above';
    setTimeout(() => { btn.textContent = 'Copy my score'; }, 2000);
  });
  if (navigator.share) {
    $('wbShare').hidden = false;
    $('wbShare').addEventListener('click', () => {
      navigator.share({ text: shareText() }).then(() => track('Birds - Shared')).catch(() => { /* cancelled */ });
    });
  }

  // ─── Score card (image) ───
  // Same three sizes as the other games. No spoilers: the grid's shape only, never a letter.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  let cardFormat = 'facebook';
  let currentCard = null;
  const cardFile = () => 'words-into-birds-' + puzzleNo + '-' + FORMATS[cardFormat].file + '.png';

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
    const put = (str, cx, y, weight, size, color, spacing, maxW, align) => {
      let px = size;
      x.textAlign = align || 'center';
      x.font = weight + ' ' + px + 'px Poppins, sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = spacing || '0px';
      while (maxW && x.measureText(str).width > maxW && px > 20) { px -= 2; x.font = weight + ' ' + px + 'px Poppins, sans-serif'; }
      x.fillStyle = color;
      x.fillText(str, cx, y);
    };
    // The grid's shape: gold for squares you filled, grey for squares you were shown
    const shape = (left, top, boxW, boxH) => {
      const size = Math.floor(Math.min(boxW / C, boxH / R));
      const ox = left + (boxW - size * C) / 2, oy = top + (boxH - size * R) / 2;
      allSq.forEach(s => {
        x.fillStyle = shown.has(s.id) || !today.won ? '#929292' : '#CCA23C';
        x.fillRect(ox + s.c * size + 1, oy + s.r * size + 1, size - 2, size - 2);
      });
    };

    const score = String(points());
    const result = today.won
      ? (name ? name + ' filled it in ' : 'Filled in ') + clock(today.secs)
      : (name ? name + ' gave up' : 'Gave up') + ' after ' + clock(today.secs);
    const s = store.stats;
    const statLine = 'Weeks in a row ' + shownStreak() + '   |   ' + (today.won ? helpWords() : 'Solved ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%');
    const totalLine = 'Total: ' + s.points.toLocaleString('en-CA') + ' points';

    if (landscape) {
      put('\u{1F426}', 330, 130, '700', 60, '#ffffff');
      put(NAME.toUpperCase(), 330, 186, '700', 30, '#ffffff', '4px', 540);
      put('PUZZLE ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), 330, 232, '700', 26, '#929292', '6px', rerunOf ? 540 : 0);
      put(score, 330, 420, '900', 190, '#ffffff', '0px', 540);
      put('POINTS', 330, 492, '700', 40, '#ffffff', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      put(result, 690, 150, '700', 38, '#ffffff', '0px', 460, 'left');
      shape(690, 175, 240, 250);
      put(totalLine, 690, 470, '700', 32, '#ffffff', '0px', 460, 'left');
      put(statLine, 690, 510, '600', 26, '#d9d9d9', '0px', 460, 'left');
      put(SHARE_URL, W / 2, 585, '600', 24, '#929292', '2px', W - 120);
    } else {
      // Stories keep content inside Instagram's safe zone (top and bottom ~250px)
      const y = story
        ? { icon: 340, label: 430, no: 500, score: 780, pts: 865, result: 960, grid: 1000, room: 440, total: 1520, stats: 1580, site: 1650 }
        : { icon: 150, label: 222, no: 280, score: 520, pts: 595, result: 690, grid: 725, room: 380, total: 1170, stats: 1230, site: 1285 };
      put('\u{1F426}', W / 2, y.icon, '700', story ? 110 : 96, '#ffffff');
      put(NAME.toUpperCase(), W / 2, y.label, '700', 44, '#ffffff', '4px', W - 160);
      put('PUZZLE ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), W / 2, y.no, '700', 36, '#929292', '6px', rerunOf ? W - 160 : 0);
      put(score, W / 2, y.score, '900', story ? 300 : 260, '#ffffff', '0px', W - 160);
      put('POINTS', W / 2, y.pts, '700', story ? 60 : 52, '#ffffff', '12px');
      put(result, W / 2, y.result, '700', story ? 56 : 50, '#ffffff', '0px', W - 160);
      shape(160, y.grid, W - 320, y.room);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 46, '#ffffff', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 36, '#d9d9d9', '0px', W - 160);
      put(SHARE_URL, W / 2, y.site, '600', 32, '#929292', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('wbCardImg');
    img.src = currentCard.url;
    img.alt = NAME + ', puzzle ' + puzzleNo + (rerunOf ? ' (a rerun of puzzle ' + rerunOf + ')' : '') + ': ' + result + '. ' + score + ' points this week. ' + totalLine + '. ' + statLine.replace(/\s+\|\s+/, '. ') + '.';
    img.className = 'bia-card-img bia-card-' + cardFormat;
    $('wbCardWrap').hidden = false;
    const file = new File([blob], cardFile(), { type: 'image/png' });
    $('wbCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Birds - Card made - ' + cardFormat);
  }

  $('wbMakeCard').addEventListener('click', () => { if (today.done) makeCard(); });
  document.querySelectorAll('.bia-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.bia-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (today.done && currentCard) makeCard();
  }));
  $('wbCardSave').addEventListener('click', () => {
    if (!currentCard) return;
    const a = el('a');
    a.href = currentCard.url;
    a.download = cardFile();
    document.body.appendChild(a); a.click(); a.remove();
    track('Birds - Card saved');
  });
  $('wbCardShare').addEventListener('click', async () => {
    if (!currentCard) return;
    const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: NAME + ', Puzzle ' + puzzleNo + rerunTag, text: shareText() });
      track('Birds - Card shared');
    } catch (e) { /* cancelled */ }
  });

  // ─── Countdown to next Saturday's grid (midnight Toronto time) ───
  let timer = null;
  const behind = () => !forcedNo && naturalPuzzleNo() > puzzleNo;
  function startCountdown() {
    if (timer) return;
    const staleAtStart = behind();
    const box = $('wbCountdown').parentNode;
    const tick = () => {
      if (behind()) {
        if (!staleAtStart) { location.reload(); return; }
        if (!box.querySelector('a')) {
          box.textContent = 'A new crossword is out. ';
          const a = el('a', '', 'Play it now');
          a.href = location.pathname;
          box.appendChild(a);
        }
        return;
      }
      const secs = Math.max(0, Math.round(msUntilDay(epochDay + puzzleNo * STEP_DAYS) / 1000));
      const p = n => String(n).padStart(2, '0');
      const d = Math.floor(secs / 86400);
      $('wbCountdown').textContent = (d ? d + (d === 1 ? ' day ' : ' days ') : '') + p(Math.floor(secs / 3600) % 24) + ':' + p(Math.floor(secs / 60) % 60) + ':' + p(secs % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  // Tab left open into a new week: new grid. Never in the middle of one, though.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && behind() && (today.done || !today.started)) location.reload();
  });

  save();
  renderAll();
  if (!today.done) {
    const first = order.find(c => c.sqs.some(s => !today.letters[s.id])) || order[0];
    select(first, firstEmpty(first), false);
    if (today.started) startClock();
  }
  if (lastWeeks) say("Last week's crossword is still open - finish it, then this week's is waiting.");
  $('wbLoading').hidden = true;
  $('wbGame').hidden = false;
  sizeBoard(); // the wrap had no width while hidden
})();
