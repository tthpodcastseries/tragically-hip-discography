// unlocked.js - '(Un)Locked in the Trunk of a Car', the daily lyrics game (v5.4; points ladder in v5.4.4)
// One song by The Hip a day, the same for everyone, behind five scrambled words from its
// lyrics. Name the song with as few words unlocked as you can.
// Everything runs in the browser from data/trunk-pool.json (scripts/build-trunk-pool.js);
// there is no server and nothing is sent anywhere except anonymous Umami event names.
// Shares its frame and styles with bring-it-all-back.js / css.
(async function () {
  const $ = id => document.getElementById(id);
  const track = (name, data) => { try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) { /* analytics optional */ } };

  // Date of puzzle #1 - the game opens at midnight Toronto time on this day. Before it the
  // page says when the game opens instead of showing a puzzle.
  const EPOCH = '2026-11-02';
  const WORDS = 5;
  // Scoring (jD, 2026-11-12, v5.8.6): start on 100, and three things take points away.
  //  - Opening a word costs 10. No words show until one is opened, so a blind guess is the
  //    only way to 100.
  //  - Each open word has 10 more points on a clock: 1 goes every 10 seconds the word stays
  //    scrambled. Revealing it takes whatever is left of the 10, so a reveal never beats
  //    unscrambling. The clock starts when the tiles show (not on the first letter typed,
  //    or the word could be solved in the head first) and runs on the wall clock, so a
  //    reload or a hidden tab can't stop it. It can never cost more than 10 a word.
  //  - A wrong guess costs 5 and opens the next word. After word 5 it opens the album hint
  //    instead (10), then one last guess.
  //  - A win scores at least 10. A loss keeps 1 point for each word unscrambled without a
  //    reveal, so 0 means no words and no song.
  // "Rung" is how far in a guess was made: 0-5 words, or 6 with the hint.
  const OPEN_COST = 10, POT = 10, TICK = 10000, MISS = 5, HINT_COST = 10, MIN_WIN = 10, HINT_RUNG = 6;
  // Older rules, kept only to score games saved under them: rules 1 was the first ladder
  // (v5.4.4 to v5.8.1), rules 2 cost 10 a move (v5.8.2 to v5.8.4), and rules 3 was the
  // ladder below less 5 a slip (v5.8.5). A game half played under rules 3 finishes on them.
  const LADDER = [100, 90, 80, 70, 60, 50, 30];
  const SLIP = 5, OLD_COST = 10;
  const RULES = 4;
  const STORE_KEY = 'tth_unlocked_v1';
  const SHARE_URL = 'thehiphandbook.tthpods.com/unlocked';
  const NAME = '(Un)Locked in the Trunk of a Car';
  const SHORT = '(Un)Locked';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SQ = { solved: '\u{1F7E9}', revealed: '\u{1F7E8}', locked: '\u{2B1B}', hint: '\u{1F4BF}', miss: '\u{1F7E5}' };

  // ?day=N and ?reset=1 are for testing, and only work on a local address
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const forcedDay = isLocal && /^\d+$/.test(params.get('day') || '') ? Math.max(1, +params.get('day')) : 0;
  const songHref = s => isLocal ? '/song?s=' + s : '/song/' + s;

  // ─── Storage (never trust it to be there) ───
  // dist[r] = wins on rung r (0-5 words unlocked, 6 = with the album hint)
  const blank = () => ({ stats: { played: 0, won: 0, streak: 0, best: 0, points: 0, dist: [0, 0, 0, 0, 0, 0, 0], lastSolved: 0 }, today: null });
  const load = () => {
    try {
      if (isLocal && params.get('reset') === '1') localStorage.removeItem(STORE_KEY);
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      // Saves from before the ladder (v5.4.4) have six rows; add the hint row
      if (saved && saved.stats && Array.isArray(saved.stats.dist) && saved.stats.dist.length === WORDS + 1) saved.stats.dist.push(0);
      if (saved && saved.stats && Array.isArray(saved.stats.dist) && saved.stats.dist.length === HINT_RUNG + 1) return saved;
    } catch (e) { /* private mode or bad data - start fresh */ }
    return blank();
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* playing still works */ } };
  const store = load();

  // ─── Which day it is: Toronto's calendar date ───
  // Every fan gets the new puzzle at midnight Toronto time, wherever they are (jD, 2026-11-01,
  // audit GAME-06). The browser's own time-zone data handles daylight saving; a browser
  // without it falls back to the device's own date. The same code is in bring-it-all-back.js.
  let torontoClock = null;
  try {
    torontoClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  } catch (e) { /* no time-zone data */ }
  // The time on a Toronto wall clock at moment t, written as if it were UTC (ms)
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
  // Milliseconds from now until midnight in Toronto at the start of day number n
  const msUntilDay = n => {
    const t = Date.now();
    const offset = at => torontoWall(at) - Math.floor(at / 1000) * 1000; // Toronto's clock minus UTC
    let at = n * 86400000 - offset(t);
    at = n * 86400000 - offset(at); // again, in case the clocks change in between
    return at - t;
  };

  // ─── Which puzzle is today ───
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, dayNumber() - epochDay + 1);
  // Normally today's puzzle, but a saved game is kept when it is:
  //  - yesterday's and half played: finish it first, then today's is waiting (audit GAME-03)
  //  - one day ahead: saved before puzzles changed at midnight Toronto time, by a fan east of
  //    Toronto who already had the next puzzle. They keep it instead of replaying one (GAME-06)
  const natural = naturalPuzzleNo();
  const saved = store.today && Array.isArray(store.today.unlocked) && Array.isArray(store.today.guesses) ? store.today : null;
  const carried = !forcedDay && !!saved && (saved.no === natural + 1 || (saved.no === natural - 1 && !saved.done && !!saved.started));
  const puzzleNo = forcedDay || (carried ? saved.no : natural);
  const yesterdays = carried && puzzleNo < natural;

  // Streaks across the switch to Toronto days (audit GAME-06): a fan west of Toronto who won
  // yesterday's puzzle by their own date can find Toronto already a puzzle ahead, so their
  // first game after the switch forgives a one-puzzle gap, once.
  if (!store.tz) {
    store.tz = 'America/Toronto';
    if (store.stats.played > 0) store.tzGrace = true;
    save();
  }

  // Not open yet: say when, and open itself when the day arrives
  if (!forcedDay && dayNumber() < epochDay) {
    const opens = new Date(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]));
    $('ulLoading').textContent = NAME + ' opens ' + DAYS[opens.getUTCDay()] + ', ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + ', at midnight Toronto time (Eastern). One song by The Hip a day - come back then.';
    setTimeout(() => location.reload(), msUntilDay(dayNumber() + 1) + 1000);
    return;
  }

  // ─── Load the pool ───
  let pool;
  try {
    pool = await fetch('/data/trunk-pool.json').then(r => { if (!r.ok) throw new Error('pool'); return r.json(); });
    if (!pool.puzzles || !pool.puzzles.length) throw new Error('empty');
  } catch (e) {
    $('ulLoading').hidden = true;
    $('ulError').hidden = false;
    return;
  }
  const puzzle = pool.puzzles[(puzzleNo - 1) % pool.puzzles.length];
  const words = puzzle.w.map(w => w[0]);
  const scrambles = puzzle.w.map(w => w[1]);

  // Saved game belongs to a different puzzle (or is missing): start today's fresh.
  // opened: words opened so far; unlocked: how each opened word was cleared ('solved' or
  // 'revealed'), so one word at most is open and still scrambled.
  // guesses: { r: rung, s: song slug } ('' was a pass under the old rules)
  if (!store.today || store.today.no !== puzzleNo || !Array.isArray(store.today.unlocked) || !Array.isArray(store.today.guesses)) {
    // lost: points the clock (or a reveal) took from each cleared word; openedAt: when the
    // word that is open and still scrambled showed its tiles
    store.today = { no: puzzleNo, rules: RULES, opened: 0, unlocked: [], lost: [], openedAt: null, guesses: [], hint: false, done: false, won: false, started: false };
  }
  const today = store.today;
  // A game saved under older rules, carried over the update. One with no move made yet
  // simply starts under these rules. A finished game keeps the score it got. A half-played
  // one finishes on rules 3, with no clock:
  //  - from rules 1 (before v5.8.2): its wrong guesses were free when made, so they stay free
  //  - from rules 2 (v5.8.2 to v5.8.4): a win scores whichever of rules 2 and 3 gives it more
  if (today.rules !== RULES) {
    const untouched = !today.done && !today.opened && !today.unlocked.length && !today.guesses.length && !today.hint;
    if (untouched) {
      today.rules = RULES;
      today.opened = 0;
      today.lost = [];
      today.openedAt = null;
    } else if (today.rules !== 3) {
      const oldWrong = today.guesses.filter(g => g.s && g.s !== puzzle.s).length;
      const oldReveals = today.unlocked.filter(how => how === 'revealed').length;
      if (!today.rules) {
        today.opened = today.unlocked.length;
        if (today.done) today.final = today.won ? Math.max(10, LADDER[today.wonAt] - oldReveals * OLD_COST) : 0;
        else today.credit = oldWrong * SLIP;
      } else if (today.rules === 2 && !today.done) {
        today.rules2 = true;
      }
      today.rules = 3;
    }
  }
  const legacy = today.rules !== RULES;
  if (!legacy && !Array.isArray(today.lost)) today.lost = [];

  // ─── Pieces ───
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const titleOf = slug => (pool.titles.find(t => t[0] === slug) || [slug, slug])[1];
  const rung = () => today.hint ? HINT_RUNG : today.unlocked.length;
  const reveals = () => today.unlocked.filter(how => how === 'revealed').length;
  const wrongGuesses = () => today.guesses.filter(g => g.s && g.s !== puzzle.s);
  const wrongSlugs = () => wrongGuesses().map(g => g.s);
  const misses = () => wrongGuesses().length;
  const solvedCount = () => today.unlocked.filter(how => how === 'solved').length;
  // A word is open and still scrambled: unscramble it (or reveal it) before guessing
  const wordOpen = () => !today.done && today.opened > today.unlocked.length;
  // The clock: points gone from the open word so far (1 every 10 seconds, 10 at most), and
  // the points it took from the words already cleared
  const activeLost = () => !legacy && wordOpen()
    ? Math.min(POT, Math.max(0, Math.floor((Date.now() - (today.openedAt || Date.now())) / TICK))) : 0;
  const clockLost = () => (today.lost || []).reduce((a, b) => a + b, 0);
  // What a right answer is worth right now: 100, less the words opened, the clock, the
  // misses, and the hint. extra = what one more step would add (a miss, then what it opens).
  const rawScore = extra => 100 - OPEN_COST * today.opened - clockLost() - activeLost() - MISS * misses() - (today.hint ? HINT_COST : 0) - (extra || 0);
  // Games half played under the older rules (see RULES): the rung for the words opened, less 5 a slip
  const opened = () => today.hint ? HINT_RUNG : today.opened;
  const slips = () => reveals() + misses();
  const ruleScore = () => Math.max(MIN_WIN, Math.min(LADDER[opened()], LADDER[opened()] - SLIP * slips() + (today.credit || 0)));
  const rules2Score = () => 100 - OLD_COST * (today.opened + reveals() + misses() + (today.hint ? 1 : 0)) + (today.credit || 0);
  const legacyPoints = () => today.rules2 ? Math.max(ruleScore(), rules2Score()) : ruleScore();
  const points = () => legacy ? legacyPoints() : Math.max(MIN_WIN, rawScore());
  // A loss keeps 1 point for each word unscrambled without a reveal (nothing under the older rules)
  const lossPoints = () => legacy ? 0 : solvedCount();
  const canGuess = () => !today.done && !wordOpen();
  const canOpen = () => canGuess() && !today.hint && today.opened < WORDS;
  const canReveal = () => wordOpen();
  const todayPoints = () => today.final != null ? today.final : today.won ? points() : 0;
  const shownPoints = () => today.done ? todayPoints() : points();
  const pts = n => n + (n === 1 ? ' point' : ' points');
  // Nothing done yet, and the fan hasn't asked for the blind guess: show the start card
  let blindMode = false;
  const atStart = () => !today.done && !today.opened && !today.guesses.length && !today.hint && !blindMode;
  // Squares in the order things happened: a red one for each wrong guess, then the word it opened
  const missSquares = r => wrongGuesses().filter(g => g.r === r).map(() => SQ.miss).join('');
  const squares = () => words.map((w, i) => missSquares(i) + SQ[today.unlocked[i] || 'locked']).join('') +
    missSquares(WORDS) + (today.hint ? ' ' + SQ.hint + missSquares(HINT_RUNG) : '');
  const missText = n => n + (n === 1 ? ' miss' : ' misses');
  const markStarted = () => { if (!today.started) { today.started = true; track('Unlocked - Started', startInfo()); } };

  // ─── The words ───
  let used = []; // which tiles of the active word are spent, by index
  function renderWords() {
    const list = $('ulWords');
    list.textContent = '';
    const active = wordOpen() ? today.unlocked.length : -1;
    words.forEach((word, i) => {
      const how = today.unlocked[i];
      const li = el('li', 'ul-word' + (how ? ' open ' + how : i === active ? ' active' : ' locked'));
      li.appendChild(el('span', 'ul-num', i + 1));
      if (how || today.done) {
        li.appendChild(el('span', 'ul-answer', word.toUpperCase()));
        // What the word cost on top of opening it: the clock's share, or the whole 10 for a reveal
        const took = legacy ? (how === 'revealed' ? SLIP : 0) : ((today.lost || [])[i] || 0);
        li.appendChild(el('span', 'ul-tag', (how === 'revealed' ? 'Revealed' : how ? 'Unlocked' : 'Never needed') + (how && took ? ' -' + took : '')));
      } else if (i === active) {
        const tiles = el('span', 'ul-tiles');
        [...scrambles[i]].forEach((ch, t) => {
          const b = el('button', 'ul-tile' + (used.includes(t) ? ' used' : ''), ch);
          b.type = 'button';
          b.disabled = used.includes(t);
          b.setAttribute('aria-label', 'Letter ' + ch);
          b.addEventListener('click', () => tapTile(t));
          tiles.appendChild(b);
        });
        li.appendChild(tiles);
      } else {
        // No letters until the word opens, so nobody can solve ahead of their guesses (v5.6.4)
        li.appendChild(el('span', 'ul-wait', 'Still locked'));
        li.appendChild(el('span', 'ul-lock', '\u{1F512}'));
      }
      list.appendChild(li);
    });
    const form = $('ulWordForm');
    form.hidden = active < 0;
    if (!form.hidden) {
      $('ulWordLabel').textContent = 'Unscramble word ' + (active + 1) + ' (' + words[active].length + ' letters)';
      $('ulWordInput').maxLength = words[active].length;
      $('ulRevealWord').hidden = !canReveal();
    }
  }

  // ─── The clock on the open word ───
  // Only the bar, its line, the Reveal label, and the points move on a tick. The tiles are
  // left alone so the keyboard never loses its place, and none of it sits in a live
  // region, so a screen reader isn't told about every point.
  const stepped = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let clockTimer = null;
  function renderClock() {
    const on = !legacy && wordOpen();
    $('ulClock').hidden = !on;
    if (!on) {
      if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
      if (legacy) $('ulRevealWord').textContent = 'Reveal it (-' + SLIP + ')';
      return;
    }
    const left = POT - activeLost();
    const run = Math.min(1, Math.max(0, (Date.now() - (today.openedAt || Date.now())) / (POT * TICK)));
    $('ulClockBar').style.width = (stepped ? left * 10 : Math.round((1 - run) * 1000) / 10) + '%';
    $('ulClockText').textContent = left
      ? pts(left) + ' left on this word. The clock takes 1 every 10 seconds.'
      : 'The clock has run out on this word. Nothing more to lose - take yer time.';
    $('ulRevealWord').textContent = left ? 'Reveal it (-' + left + ')' : 'Reveal it (free now)';
    $('ulPoints').textContent = shownPoints();
    if (!clockTimer) clockTimer = setInterval(renderClock, 500);
  }

  // Tiles and the text box stay in step: tapping types the letter, typing spends tiles
  function syncTiles() {
    const active = today.unlocked.length;
    if (!wordOpen()) return;
    const letters = [...scrambles[active]];
    used = [];
    for (const ch of $('ulWordInput').value.toUpperCase()) {
      const t = letters.findIndex((c, k) => c === ch && !used.includes(k));
      if (t >= 0) used.push(t);
    }
    renderWords();
  }
  const firstFreeTile = () => document.querySelector('#ulWords .ul-word.active .ul-tile:not(:disabled)');
  function tapTile(t) {
    const active = today.unlocked.length;
    const input = $('ulWordInput');
    if (input.value.length >= words[active].length) return;
    input.value += scrambles[active][t];
    syncTiles();
    // syncTiles rebuilds the tiles, which drops keyboard focus: put it on the next free tile,
    // or on Unlock once every letter is placed (audit GAME-13)
    (firstFreeTile() || $('ulUnlock')).focus();
  }
  // After a miss the song box hides: move on to the word that opened (or the last guess). A phone would pop
  // its keyboard up for a text box, so touch screens get the first tile instead.
  function focusNext() {
    if (!wordOpen()) { if (canGuess()) $('ulGuessInput').focus(); return; }
    const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const target = fine ? $('ulWordInput') : firstFreeTile();
    if (target) target.focus();
  }
  $('ulWordInput').addEventListener('input', () => { $('ulWordMsg').textContent = ''; syncTiles(); });
  $('ulClear').addEventListener('click', () => { $('ulWordInput').value = ''; $('ulWordMsg').textContent = ''; syncTiles(); });

  function unlock(how) {
    markStarted();
    // Bank what the clock took (all 10 for a reveal) before the word stops being the open one
    if (!legacy) {
      today.lost.push(how === 'revealed' ? POT : activeLost());
      today.openedAt = null;
    }
    today.unlocked.push(how);
    $('ulWordInput').value = '';
    used = [];
    save();
    renderAll();
    // Read the word out: focus moves to the song box, so a screen reader would only hear its
    // label, not the word (audit A11Y-09)
    const n = today.unlocked.length;
    $('ulMsg').textContent = 'Word ' + n + ': ' + words[n - 1].toUpperCase() + '. Name the song for ' + points() + ' points' +
      (canOpen() ? ', or open word ' + (n + 1) + '.' : '.');
    $('ulGuessInput').focus();
  }
  // The next word's tiles show: 10 points go, and its clock starts
  function openNext() {
    today.opened++;
    if (!legacy) today.openedAt = Date.now();
  }
  function openWord() {
    markStarted();
    openNext();
    $('ulWordInput').value = '';
    used = [];
    $('ulWordMsg').textContent = '';
    save();
    renderAll();
  }
  $('ulWordForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!wordOpen()) return;
    const active = today.unlocked.length;
    const raw = $('ulWordInput').value.trim().toLowerCase();
    const msg = $('ulWordMsg');
    if (raw.length !== words[active].length) { msg.textContent = 'Use all ' + words[active].length + ' letters.'; return; }
    if (raw !== words[active]) { msg.textContent = legacy ? 'Not quite. Try again - wrong unscrambles are free.' : 'Not quite. Try again - a wrong try costs nothing but time.'; return; }
    msg.textContent = '';
    unlock('solved');
  });
  $('ulRevealWord').addEventListener('click', () => {
    if (!canReveal()) return;
    $('ulWordMsg').textContent = '';
    unlock('revealed');
  });

  // ─── Guessing the song ───
  // words: the title's words, matched like norm(); starts: the title from each word on, run together
  const wordsOf = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['\u2018\u2019]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  const titles = pool.titles.map(([s, t]) => {
    const w = wordsOf(t);
    return { s, t, n: norm(t), words: w, starts: w.map((x, i) => w.slice(i).join('')) };
  });
  function suggest() {
    const q = norm($('ulGuessInput').value);
    const box = $('ulSuggest');
    box.textContent = '';
    if (!q) { box.hidden = true; $('ulGuessInput').setAttribute('aria-expanded', 'false'); return; }
    const hits = titles.filter(x => x.n.includes(q))
      .sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || a.t.localeCompare(b.t))
      .slice(0, 6);
    hits.forEach(x => {
      const li = el('li');
      li.setAttribute('role', 'presentation');
      const b = el('button', 'ul-option', x.t);
      b.type = 'button';
      b.setAttribute('role', 'option');
      if (wrongSlugs().includes(x.s)) { b.disabled = true; b.textContent = x.t + ' - already guessed'; }
      b.addEventListener('click', () => {
        $('ulGuessInput').value = x.t;
        box.hidden = true;
        $('ulGuessInput').setAttribute('aria-expanded', 'false');
        $('ulGuessInput').focus();
      });
      li.appendChild(b);
      box.appendChild(li);
    });
    box.hidden = !hits.length;
    $('ulGuessInput').setAttribute('aria-expanded', String(!!hits.length));
  }
  $('ulGuessInput').addEventListener('input', () => { $('ulMsg').textContent = ''; suggest(); });
  // Arrow keys walk the suggestions, Escape closes them (the box says it is a combobox, so it behaves like one)
  const options = () => [...$('ulSuggest').querySelectorAll('.ul-option:not(:disabled)')];
  const closeSuggest = () => { $('ulSuggest').hidden = true; $('ulGuessInput').setAttribute('aria-expanded', 'false'); $('ulGuessInput').focus(); };
  $('ulGuessInput').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && options().length) { e.preventDefault(); options()[0].focus(); }
    else if (e.key === 'Escape') { $('ulSuggest').hidden = true; $('ulGuessInput').setAttribute('aria-expanded', 'false'); }
  });
  $('ulSuggest').addEventListener('keydown', e => {
    const list = options(), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i > 0 ? list[i - 1].focus() : $('ulGuessInput').focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSuggest(); }
  });

  $('ulGuessForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!canGuess()) return;
    const msg = $('ulMsg');
    const q = norm($('ulGuessInput').value);
    if (!q) { msg.textContent = 'Type a song title.'; return; }
    // An exact title, or the only song where what was typed starts one of its words (so "gus"
    // finds 'Gus: The Polar Bear from Central Park', not 'Summer's Killing Us'). Part of a word
    // needs 4 letters or more ("cen" isn't enough); a whole word needs 3 ("gus") (audit GAME-13)
    let pick = titles.find(x => x.n === q);
    if (!pick) {
      const hits = titles.filter(x => x.starts.some(w => w.startsWith(q)) && (q.length >= 4 || (q.length >= 3 && x.words.includes(q))));
      if (hits.length === 1) pick = hits[0];
    }
    if (!pick) { msg.textContent = 'Pick a song from the list.'; return; }
    if (wrongSlugs().includes(pick.s)) { msg.textContent = 'Already guessed ' + pick.t + '. Try another.'; return; }
    markStarted();
    $('ulGuessInput').value = '';
    $('ulSuggest').hidden = true;
    answer(pick.s, pick.t);
  });

  // When the album is named after the song (a title track), the album would give the
  // answer away, so the hint is the year it came out instead (v5.4.10, audit GAME-08).
  // Same when they share two or more words of 4+ letters: 'My Music at Work' on
  // "Music @ Work" (audit GAME-08, 2026-11-01).
  const flat = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const bigWords = s => wordsOf(s).filter(w => w.length >= 4);
  const yearHint = () => !!(puzzle.al && puzzle.ay && (flat(puzzle.al).includes(flat(puzzle.t)) ||
    bigWords(puzzle.t).filter((w, i, all) => all.indexOf(w) === i && bigWords(puzzle.al).includes(w)).length >= 2));

  // A guess on the current rung. A miss costs 5 and opens what comes next: the next
  // word, or after word 5 the album hint. A miss on the last guess ends it.
  function answer(slug, title) {
    const r = rung();
    const msg = $('ulMsg');
    today.guesses.push({ r, s: slug });
    if (slug === puzzle.s) {
      msg.textContent = '';
      today.wonAt = r;
      today.final = points();
      finish(true);
    } else if (r === HINT_RUNG || (r === WORDS && !puzzle.al)) {
      finish(false);
    } else {
      if (r === WORDS) {
        today.hint = true;
        track('Unlocked - Album hint');
      } else {
        openNext();
        $('ulWordInput').value = '';
        used = [];
      }
      if (today.hint) {
        msg.textContent = 'Not ' + title + ' (-5). Here is the ' + (yearHint() ? 'year it came out' : 'album') + ' - one last guess, for ' + points() + ' points.';
      } else {
        msg.textContent = 'Not ' + title + ' (-5). Word ' + today.opened + ' is open - unscramble it.';
      }
    }
    save();
    renderAll();
    focusNext();
  }
  $('ulNext').addEventListener('click', () => {
    if (!canOpen()) return;
    $('ulGuessInput').value = '';
    $('ulSuggest').hidden = true;
    openWord();
    $('ulMsg').textContent = openMsg();
    focusNext();
  });
  const openMsg = () => 'Word ' + today.opened + ' is open. Unscramble it - ' + (legacy ? 'wrong tries are free.' : 'the clock is running.');

  // ─── The start card ───
  // Before the first move the page offers the two ways in, with the usual one (open word 1)
  // as the big button. The blind guess used to be the only box on show (jD, 2026-11-12).
  function renderStart() {
    $('ulStart').hidden = !atStart();
  }
  $('ulStartOpen').addEventListener('click', () => {
    if (!atStart()) return;
    openWord();
    $('ulMsg').textContent = openMsg();
    focusNext();
  });
  $('ulStartBlind').addEventListener('click', () => {
    if (!atStart()) return;
    blindMode = true;
    renderAll();
    $('ulGuessInput').focus();
  });

  function renderWrong() {
    const list = $('ulWrong');
    list.textContent = '';
    wrongSlugs().forEach(s => list.appendChild(el('li', '', '✗ ' + titleOf(s))));
  }

  // The guess box: what a right answer is worth now, and where a miss or the next word
  // would leave you, so every step down is in plain sight
  // A new word is worth "up to" its number, because its clock starts as it opens.
  const worthAt = (rungNo, extraSlips) => Math.max(MIN_WIN, LADDER[rungNo] - SLIP * (slips() + extraSlips) + (today.credit || 0));
  const afterMiss = r => legacy ? worthAt(r + 1, 1) : Math.max(MIN_WIN, rawScore(MISS + (r === WORDS ? HINT_COST : OPEN_COST)));
  const afterOpen = r => legacy ? worthAt(r + 1, 0) : Math.max(MIN_WIN, rawScore(OPEN_COST));
  function renderGuess() {
    const form = $('ulGuessForm');
    form.hidden = !canGuess() || atStart();
    if (form.hidden) return;
    const r = rung(), p = points(), upTo = legacy ? '' : 'up to ';
    $('ulGuessLabel').textContent = r === HINT_RUNG
      ? 'Last guess, with the ' + (yearHint() ? 'year' : 'album') + ' hint - worth ' + p + ' points'
      : (r === 0 ? 'Know it blind? ' : '') + 'Name the song for ' + p + ' points. A miss opens ' +
        (r === WORDS ? 'the ' + (yearHint() ? 'year it came out' : 'album') + ', worth ' : 'word ' + (r + 1) + ', worth ' + upTo) + afterMiss(r) + '.';
    $('ulNext').hidden = !canOpen();
    $('ulNext').textContent = (r === 0 ? 'Open word 1 instead' : 'Open word ' + (r + 1)) + ', worth ' + upTo + afterOpen(r);
  }

  // ─── Album hint and giving up ───
  function renderTools() {
    const tools = $('ulTools');
    tools.hidden = today.done || atStart();
    if (tools.hidden) return;
    const shown = $('ulHintShown');
    shown.hidden = !today.hint;
    if (today.hint) {
      shown.textContent = '';
      shown.appendChild(el('span', '', yearHint() ? 'Came out in ' : 'Album: '));
      shown.appendChild(el('b', '', yearHint() ? String(puzzle.ay) : window.tthAlbumCase(puzzle.al)));
    }
  }
  // Two presses, so nobody gives up by accident. Ten seconds to press again, long enough for
  // a screen reader to read the new label out (audit A11Y-09).
  let giveUpArmed = null;
  $('ulGiveUp').addEventListener('click', () => {
    if (today.done) return;
    const btn = $('ulGiveUp');
    if (!giveUpArmed) {
      btn.textContent = 'Press again to give up';
      btn.classList.add('armed');
      giveUpArmed = setTimeout(() => { giveUpArmed = null; btn.textContent = 'Give up'; btn.classList.remove('armed'); }, 10000);
      return;
    }
    clearTimeout(giveUpArmed);
    giveUpArmed = null;
    markStarted();
    today.gaveUp = true;
    finish(false);
    track('Unlocked - Gave up');
    save();
    renderAll();
  });

  // ─── Finishing a game ───
  function finish(won) {
    // A loss banks its points here; a win's were set as the right answer landed. lossPoints
    // counts the words before done is set, while the game still knows which were solved.
    if (!won) today.final = lossPoints();
    today.done = true;
    today.won = won;
    today.openedAt = null;
    const s = store.stats;
    s.played++;
    s.points += todayPoints();
    if (won) {
      s.won++;
      s.dist[today.wonAt]++;
      s.streak = continues() ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    delete store.tzGrace;
    track(won ? 'Unlocked - Won' : 'Unlocked - Lost');
  }
  // Sent with the Started event so Umami can count real return players. Umami's visitor count
  // resets when a phone changes network; these numbers live on the device (jD, 2026-11-05).
  // Nothing personal: a band of games played here before and how long since the last one.
  const startInfo = () => {
    const s = store.stats, n = s.played || 0;
    const last = Math.max(s.lastPlayed || 0, s.lastSolved || 0);
    const gap = puzzleNo - last;
    const info = {
      game: n === 0 ? 'First game' : n < 3 ? '2nd or 3rd' : n < 7 ? '4th to 7th' : n < 15 ? '8th to 15th' : '16th or more',
      last: !last ? (n ? 'Not known' : 'First game') : gap <= 1 ? 'Yesterday' : gap <= 7 ? '2-7 days ago' : 'Over a week ago'
    };
    s.lastPlayed = puzzleNo;
    return info;
  };

  // Naming the song before any word opens shows as its own line: five black squares read as a fail
  // (audit GAME-10). The link starts with https:// so every app turns it into a tap.
  const straightGuess = () => today.won && today.unlocked.length === 0;
  // The squares in words too, so green and yellow don't rely on colour (audit GAME-12).
  // "hint", never "album hint" or "year hint": the year would say it's a title track.
  const shareWords = () => {
    if (!today.won) return today.gaveUp ? ' (gave up)' : today.outOfPoints ? ' (out of points)' : ' (missed)';
    if (straightGuess()) return '';
    const n = today.unlocked.length, rev = reveals(), m = misses();
    return ' (' + n + (n === 1 ? ' word' : ' words') + (rev ? ', ' + rev + ' revealed' : '') + (m ? ', ' + missText(m) : '') + (today.wonAt === HINT_RUNG ? ', plus the hint' : '') + ')';
  };
  const shareText = () =>
    (today.won ? '\u{1F513} ' : '\u{1F512} ') + SHORT + ' No. ' + puzzleNo + ' - ' + pts(todayPoints()) + shareWords() + '\n' +
    (straightGuess() ? '\u{1F513} Straight guess - no words needed' : squares()) + '\nhttps://' + SHARE_URL + '\n';

  // A win on this puzzle keeps the streak going (see the switch note at the top)
  const continues = () => store.stats.lastSolved === puzzleNo - 1 || (!!store.tzGrace && store.stats.lastSolved === puzzleNo - 2);
  function shownStreak() {
    return store.stats.lastSolved === puzzleNo || continues() ? store.stats.streak : 0;
  }

  function renderStats() {
    const s = store.stats;
    const box = $('ulStats');
    box.textContent = '';
    const row = el('div', 'bia-stat-row');
    [
      [s.played, 'Played'],
      [s.played ? Math.round(100 * s.won / s.played) : 0, 'Win %'],
      [shownStreak(), 'Streak'],
      [s.best, 'Best'],
      [s.points.toLocaleString('en-CA'), 'Points'],
    ].forEach(c => {
      const cell = el('div');
      cell.appendChild(el('b', String(c[0]).length > 4 ? 'long' : '', c[0]));
      cell.appendChild(el('span', '', c[1]));
      row.appendChild(cell);
    });
    box.appendChild(row);

    box.appendChild(el('p', 'ul-dist-h', 'Words unlocked when you got it (\u{1F4BF} = album hint)'));
    const dist = el('div', 'bia-dist');
    const max = Math.max(1, ...s.dist);
    s.dist.forEach((n, i) => {
      const r = el('div', 'bia-dist-row');
      r.appendChild(el('span', '', i === HINT_RUNG ? SQ.hint : i));
      const bar = el('span', 'bia-dist-bar' + (today.won && today.wonAt === i ? ' today' : ''), n);
      bar.style.width = Math.max(8, Math.round(100 * n / max)) + '%';
      r.appendChild(bar);
      dist.appendChild(r);
    });
    box.appendChild(dist);
  }

  const resultLine = () => {
    const r = today.wonAt;
    if (!today.won) {
      if (today.outOfPoints) return 'Out of points - the trunk stays locked.';
      const kept = todayPoints();
      return (today.gaveUp ? 'You gave up - here it is. ' : 'The trunk stays locked. ') +
        (kept ? pts(kept) + ' for the ' + (kept === 1 ? 'word' : 'words') + ' you unscrambled.' : '0 points.');
    }
    if (r === 0) return 'Straight guess. Bang on. 100 points!';
    const m = misses() ? ' and ' + missText(misses()) : '';
    if (r === HINT_RUNG) return 'Got it with the album hint' + m + ' - ' + todayPoints() + ' points!';
    return 'Unlocked with ' + r + (r === 1 ? ' word' : ' words') + m + ' - ' + todayPoints() + ' points!';
  };

  function renderEnd() {
    // If the keyboard was in a form that's about to vanish, land on the result instead of losing focus
    const hadFocus = $('ulGuessForm').contains(document.activeElement) || $('ulWordForm').contains(document.activeElement) || $('ulSuggest').contains(document.activeElement) || $('ulTools').contains(document.activeElement);
    $('ulGuessForm').hidden = true;
    $('ulWordForm').hidden = true;
    $('ulMsg').textContent = '';
    $('ulEnd').hidden = false;
    $('ulResult').setAttribute('tabindex', '-1');
    $('ulResult').textContent = resultLine();
    if (hadFocus) $('ulResult').focus();
    const total = $('ulTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', store.stats.points.toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' game' : ' games')));

    const reveal = $('ulReveal');
    reveal.textContent = '';
    reveal.appendChild(el('div', 'when', "Today's song"));
    reveal.appendChild(el('div', 'where', puzzle.t));
    if (puzzle.al) reveal.appendChild(el('div', 'meta', 'From ' + window.tthAlbumCase(puzzle.al)));

    // Play it: a direct Spotify track where we have one, search links elsewhere,
    // and the latest Hip Archive show with the song (plays the whole show)
    const play = $('ulPlay');
    play.textContent = '';
    play.appendChild(el('span', 'ul-play-h', '▶ Play it'));
    const q = encodeURIComponent(puzzle.t + ' The Tragically Hip');
    [
      ['Spotify', puzzle.sp || 'https://open.spotify.com/search/' + q, 'spotify'],
      ['Apple Music', 'https://music.apple.com/search?term=' + q, 'apple'],
      ['YouTube Music', 'https://music.youtube.com/search?q=' + q, 'youtube'],
    ].forEach(([label, href, svc]) => {
      const a = el('a', 'ul-play-btn ul-play-' + svc, label);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', () => track('Unlocked - Play - ' + svc));
      play.appendChild(a);
    });
    if (puzzle.lv) {
      const live = el('a', 'ul-play-btn ul-play-live', 'Live in the Archive');
      live.href = 'tour-map.html#play=' + puzzle.lv;
      live.addEventListener('click', () => track('Unlocked - Play - live'));
      play.appendChild(live);
    }

    const links = $('ulLinks');
    links.textContent = '';
    const lyr = el('a', '', 'Read the lyrics');
    lyr.href = songHref(puzzle.s);
    lyr.addEventListener('click', () => track('Unlocked - Song page'));
    links.appendChild(lyr);

    $('ulShareText').textContent = shareText();
    renderStats();
    startCountdown();
  }

  function renderAll() {
    $('ulNo').textContent = 'Puzzle No. ' + puzzleNo + (yesterdays ? " (yesterday's)" : '');
    $('ulPoints').textContent = shownPoints();
    renderStart();
    renderWords();
    renderClock();
    renderGuess();
    renderWrong();
    renderTools();
    if (today.done) renderEnd();
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
  $('ulCopy').addEventListener('click', async () => {
    const btn = $('ulCopy');
    const ok = await copyText(shareText());
    track('Unlocked - Shared');
    btn.textContent = ok ? 'Copied!' : 'Copy failed - select the text above';
    setTimeout(() => { btn.textContent = 'Copy my score'; }, 2000);
  });
  if (navigator.share) {
    $('ulShare').hidden = false;
    $('ulShare').addEventListener('click', () => {
      navigator.share({ text: shareText() }).then(() => track('Unlocked - Shared')).catch(() => { /* cancelled */ });
    });
  }

  // ─── Score card (image) ───
  // Same three sizes as Bring It All Back. No spoilers: never the song or its words.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  const TILE = { solved: '#4CAF50', revealed: '#F2C94C' };
  let cardFormat = 'facebook';
  let currentCard = null; // { blob, url, format }
  const cardFile = () => 'unlocked-' + puzzleNo + '-' + FORMATS[cardFormat].file + '.png';

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
    // Left-aligned text that breaks onto more lines rather than running past maxW
    const putWrapped = (str, left, y, weight, size, color, maxW, lineH) => {
      x.font = weight + ' ' + size + 'px Poppins, sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      const lines = [];
      let line = '';
      str.split(' ').forEach(w => {
        const next = line ? line + ' ' + w : w;
        if (line && x.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
      });
      lines.push(line);
      lines.forEach((l, i) => put(l, left, y + i * lineH, weight, size, color, '0px', maxW, 'left'));
    };
    // One tile per word: green unscrambled, yellow revealed, an outline if never needed
    const tiles = (left, top, size, gap) => {
      for (let i = 0; i < WORDS; i++) {
        const tx = left + i * (size + gap), how = today.unlocked[i];
        x.beginPath();
        if (x.roundRect) x.roundRect(tx, top, size, size, size * 0.14); else x.rect(tx, top, size, size);
        if (how) { x.fillStyle = TILE[how]; x.fill(); }
        else { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3; x.stroke(); }
      }
    };

    const n = today.wonAt;
    const score = String(todayPoints());
    const pointsLabel = todayPoints() === 1 ? 'POINT' : 'POINTS';
    const m = misses() ? ', ' + missText(misses()) : '';
    const result = !today.won
      ? (today.gaveUp ? (name ? name + ' gave up today' : 'Gave up today') : (name ? name + ' stayed locked out today' : 'Locked out today'))
      : n === 0
        ? (name ? name + ' got it straight away' : 'Straight guess. Bang on.')
        : n === HINT_RUNG
          ? (name ? name + ' got it with the album hint' : 'Got it with the album hint') + m
          : (name ? name + ' unlocked it with ' + n : 'Unlocked with ' + n) + (n === 1 ? ' word' : ' words') + m;
    const s = store.stats;
    const statLine = 'Streak ' + shownStreak() + '   |   Win rate ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%';
    const totalLine = 'Total: ' + s.points.toLocaleString('en-CA') + ' points';
    const blurb = 'Name the song by The Hip from five scrambled lyric words';

    if (landscape) {
      put(today.won ? '\u{1F513}' : '\u{1F512}', 330, 130, '700', 60, '#ffffff');
      put(NAME.toUpperCase(), 330, 186, '700', 28, '#ffffff', '4px', 540);
      put('PUZZLE NO. ' + puzzleNo, 330, 232, '700', 26, '#929292', '6px');
      put(score, 330, 420, '900', 190, '#ffffff', '0px', 540);
      put(pointsLabel, 330, 492, '700', 40, '#ffffff', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      put(result, 690, 210, '700', 42, '#ffffff', '0px', 460, 'left');
      tiles(690, 255, 76, 16);
      put(totalLine, 690, 395, '700', 34, '#ffffff', '0px', 460, 'left');
      put(statLine, 690, 445, '600', 28, '#d9d9d9', '0px', 460, 'left');
      putWrapped(blurb, 690, 486, '600', 24, '#929292', 460, 30);
      put(SHARE_URL, W / 2, 585, '600', 24, '#929292', '2px', W - 120);
    } else {
      // Stories keep content inside Instagram's safe zone (top and bottom ~250px)
      const y = story
        ? { icon: 360, label: 450, no: 525, score: 880, pts: 970, result: 1090, tiles: 1150, size: 150, total: 1395, stats: 1465, blurb: 1530, site: 1640 }
        : { icon: 160, label: 232, no: 290, score: 590, pts: 668, result: 768, tiles: 806, size: 140, total: 1036, stats: 1100, blurb: 1160, site: 1250 };
      const gap = 24, rowW = WORDS * y.size + (WORDS - 1) * gap;
      put(today.won ? '\u{1F513}' : '\u{1F512}', W / 2, y.icon, '700', story ? 110 : 96, '#ffffff');
      put(NAME.toUpperCase(), W / 2, y.label, '700', 40, '#ffffff', '4px', W - 160);
      put('PUZZLE NO. ' + puzzleNo, W / 2, y.no, '700', 36, '#929292', '6px');
      put(score, W / 2, y.score, '900', story ? 330 : 290, '#ffffff', '0px', W - 160);
      put(pointsLabel, W / 2, y.pts, '700', story ? 64 : 56, '#ffffff', '12px');
      put(result, W / 2, y.result, '700', story ? 62 : 56, '#ffffff', '0px', W - 160);
      tiles((W - rowW) / 2, y.tiles, y.size, gap);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 48, '#ffffff', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 38, '#d9d9d9', '0px', W - 160);
      put(blurb, W / 2, y.blurb, '600', story ? 34 : 30, '#929292', '0px', W - 160);
      put(SHARE_URL, W / 2, y.site, '600', 32, '#929292', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('ulCardImg');
    img.src = currentCard.url;
    // The card's own words, for people who can't see it (audit BRAND-15)
    img.alt = '(Un)Locked in the Trunk of a Car, puzzle ' + puzzleNo + ': ' + result + '. ' + pts(todayPoints()) + ' today. ' + totalLine + '. ' + statLine.replace(/\s+\|\s+/, '. ') + '.';
    img.className = 'bia-card-img bia-card-' + cardFormat;
    $('ulCardWrap').hidden = false;
    const file = new File([blob], cardFile(), { type: 'image/png' });
    $('ulCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Unlocked - Card made - ' + cardFormat);
  }

  $('ulMakeCard').addEventListener('click', () => { if (today.done) makeCard(); });
  document.querySelectorAll('.bia-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.bia-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (today.done && currentCard) makeCard();
  }));
  $('ulCardSave').addEventListener('click', () => {
    if (!currentCard) return;
    const a = el('a');
    a.href = currentCard.url;
    a.download = cardFile();
    document.body.appendChild(a); a.click(); a.remove();
    track('Unlocked - Card saved');
  });
  $('ulCardShare').addEventListener('click', async () => {
    if (!currentCard) return;
    const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: SHORT + ' No. ' + puzzleNo, text: shareText() });
      track('Unlocked - Card shared');
    } catch (e) { /* cancelled */ }
  });

  // ─── Countdown to the next puzzle (midnight Toronto time) ───
  // The puzzle number decides when the page reloads, not an exact
  // zero on the clock: a tick that lands just after midnight used to miss it (audit GAME-02).
  let timer = null;
  const behind = () => !forcedDay && naturalPuzzleNo() > puzzleNo;
  function startCountdown() {
    if (timer) return;
    // Finished a game that began before midnight: the new puzzle is already out, but reloading
    // now would take the score screen away, so offer it instead of reloading
    const staleAtStart = behind();
    const box = $('ulCountdown').parentNode;
    const tick = () => {
      if (behind()) {
        if (!staleAtStart) { location.reload(); return; }
        if (!box.querySelector('a')) {
          box.textContent = 'A new puzzle is out. ';
          const a = el('a', '', 'Play it now');
          a.href = location.pathname;
          box.appendChild(a);
        }
        return;
      }
      // The next puzzle comes out on the day after this one's, at midnight Toronto time
      const left = Math.max(0, Math.round(msUntilDay(epochDay + puzzleNo) / 1000));
      const p = n => String(n).padStart(2, '0');
      $('ulCountdown').textContent = p(Math.floor(left / 3600)) + ':' + p(Math.floor(left / 60) % 60) + ':' + p(left % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Phone left open overnight: new day, new puzzle. Never in the middle of a game, though:
  // switching apps on a phone counts, and the half-played game would be lost (audit GAME-03).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && behind() && (today.done || !today.started)) location.reload();
  });

  // First game on this device: the rules sit open under the start card
  if (!store.stats.played && !today.started) $('ulHow').open = true;
  renderAll();
  if (yesterdays) $('ulMsg').textContent = "Yesterday's puzzle is still open - finish it, then today's is waiting.";
  $('ulLoading').hidden = true;
  $('ulGame').hidden = false;
})();
