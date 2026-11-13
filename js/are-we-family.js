// are-we-family.js - 'Are We Family', the weekly grouping game
// Sixteen songs by The Hip, four hidden groups of four, the same for everyone. A new puzzle
// every Saturday at midnight Toronto time. Four mistakes and the week is over.
// Everything runs in the browser from data/family-puzzles.json, which jD edits by hand;
// there is no server and nothing is sent anywhere except anonymous Umami event names.
// Shares its frame and styles with bring-it-all-back.js / unlocked.js.
(async function () {
  const $ = id => document.getElementById(id);
  const track = (name, data) => { try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) { /* analytics optional */ } };

  // Date of puzzle 1, a Saturday - the game opens at midnight Toronto time on this day. Before it
  // the page says when the game opens instead of showing a puzzle. Saturday, November 21, 2026
  // (jD, 2026-11-05). Never change it once the game has opened.
  const EPOCH = '2026-11-21';
  const STEP_DAYS = 7; // one puzzle a week
  const MISTAKES = 4;
  // Points for a win by mistakes made (0-3); losing scores 0
  const LADDER = [100, 80, 60, 40];
  const STORE_KEY = 'tth_family_v1';
  const SHARE_URL = 'thehiphandbook.tthpods.com/are-we-family';
  const NAME = 'Are We Family';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // One square per group, easiest first: light grey, gold, red, purple
  const SQ = ['\u{2B1C}', '\u{1F7E8}', '\u{1F7E5}', '\u{1F7EA}'];
  const TIER_NAMES = ['light grey', 'gold', 'red', 'purple'];

  // ?week=N and ?reset=1 are for testing, and only work on a local address
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const forcedNo = isLocal && /^\d+$/.test(params.get('week') || '') ? Math.max(1, +params.get('week')) : 0;
  const songHref = s => isLocal ? '/song?s=' + s : '/song/' + s;
  // Same slugs as data/song-index.json ("Toronto #4" -> toronto-4, "Fiddler's Green" -> fiddlers-green)
  const slugOf = t => String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['‘’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // ─── Storage (never trust it to be there) ───
  // dist[m] = wins with m mistakes
  const blank = () => ({ stats: { played: 0, won: 0, streak: 0, best: 0, points: 0, dist: [0, 0, 0, 0], lastSolved: 0 }, today: null });
  const load = () => {
    try {
      if (isLocal && params.get('reset') === '1') localStorage.removeItem(STORE_KEY);
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.stats && Array.isArray(saved.stats.dist) && saved.stats.dist.length === MISTAKES) return saved;
    } catch (e) { /* private mode or bad data - start fresh */ }
    return blank();
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* playing still works */ } };
  const store = load();

  // ─── Which day it is: Toronto's calendar date ───
  // Every fan gets the new puzzle at midnight Toronto time, wherever they are. The same code is
  // in unlocked.js and bring-it-all-back.js.
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

  // ─── Which puzzle is this week's ───
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, Math.floor((dayNumber() - epochDay) / STEP_DAYS) + 1);
  // Normally this week's puzzle, but a saved game is kept when it is:
  //  - last week's and half played: finish it first, then this week's is waiting
  //  - one week ahead: saved before the puzzle changed at midnight Toronto time, by a fan east
  //    of Toronto who already had the next one
  const natural = naturalPuzzleNo();
  const saved = store.today && Array.isArray(store.today.solved) && Array.isArray(store.today.guesses) ? store.today : null;
  const carried = !forcedNo && !!saved && (saved.no === natural + 1 || (saved.no === natural - 1 && !saved.done && !!saved.started));
  const puzzleNo = forcedNo || (carried ? saved.no : natural);
  const lastWeeks = carried && puzzleNo < natural;

  // Not open yet: say when, and open itself when the day arrives
  if (!forcedNo && dayNumber() < epochDay) {
    const opens = new Date(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]));
    $('awLoading').textContent = NAME + ' opens ' + DAYS[opens.getUTCDay()] + ', ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + ', at midnight Toronto time (Eastern). A new puzzle every Saturday - come back then.';
    setTimeout(() => location.reload(), Math.min(msUntilDay(dayNumber() + 1) + 1000, 2147483647));
    return;
  }

  // ─── Load the puzzles ───
  let pool;
  try {
    pool = await fetch('/data/family-puzzles.json').then(r => { if (!r.ok) throw new Error('pool'); return r.json(); });
    if (!pool.puzzles || !pool.puzzles.length) throw new Error('empty');
  } catch (e) {
    $('awLoading').hidden = true;
    $('awError').hidden = false;
    return;
  }
  const puzzle = pool.puzzles[(puzzleNo - 1) % pool.puzzles.length];
  // Past the last puzzle the game starts again from the first one, and says so: the
  // heading, the share text and the card all get a "rerun" label (jD, 2026-11-13). Add
  // puzzles on the end of the pool before the run ends and no rerun is ever shown.
  const rerunOf = puzzleNo > pool.puzzles.length ? ((puzzleNo - 1) % pool.puzzles.length) + 1 : 0;
  const puzzleNote = late => { const tags = [late, rerunOf ? 'rerun' : ''].filter(Boolean); return tags.length ? ' (' + tags.join(', ') + ')' : ''; };
  const rerunTag = puzzleNote('');
  const groups = puzzle.groups;
  const groupOf = title => groups.findIndex(g => g.songs.includes(title));
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  // The starting layout is the same for everyone that week (shuffled from the puzzle number);
  // Shuffle reorders it on this device only
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const shuffle = (arr, rand) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  const allSongs = groups.flatMap(g => g.songs);

  // Saved game belongs to a different puzzle (or is missing): start this week's fresh
  // solved: group indexes in the order found; guesses: every submitted set of four titles
  if (!saved || saved.no !== puzzleNo || !Array.isArray(saved.order) || !sameSet(saved.order, allSongs)) {
    store.today = { no: puzzleNo, order: shuffle(allSongs.slice(), rng(1994 + puzzleNo)), solved: [], guesses: [], mistakes: 0, done: false, won: false, started: false };
  }
  const today = store.today;
  let picked = [];

  // ─── Pieces ───
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const markStarted = () => { if (!today.started) { today.started = true; track('Family - Started', startInfo()); } };
  const left = () => today.order.filter(t => !today.solved.includes(groupOf(t)));
  const todayPoints = () => today.won ? LADDER[today.mistakes] : 0;

  // A title with its hidden word marked ('Ma<b>chin</b>e'). The word is letters only and may
  // run across a space ('My Music a<b>t Wo</b>rk').
  function titleNode(title, hidden) {
    const span = el('span', 'aw-title');
    const at = hidden ? title.toLowerCase().replace(/[^a-z]/g, '').indexOf(hidden.toLowerCase()) : -1;
    if (at < 0) { span.textContent = title; return span; }
    let letter = 0, from = -1, to = -1;
    [...title].forEach((ch, i) => {
      if (!/[a-z]/i.test(ch)) return;
      if (letter === at) from = i;
      if (letter === at + hidden.length - 1) to = i + 1;
      letter++;
    });
    span.appendChild(document.createTextNode(title.slice(0, from)));
    span.appendChild(el('b', 'aw-hl', title.slice(from, to)));
    span.appendChild(document.createTextNode(title.slice(to)));
    return span;
  }

  // ─── The solved groups ───
  function renderSolved() {
    const box = $('awSolved');
    box.textContent = '';
    // Once the game is over, every group shows, in the order found, then the rest
    const order = today.done ? today.solved.concat([0, 1, 2, 3].filter(g => !today.solved.includes(g))) : today.solved;
    order.forEach(g => {
      const grp = groups[g];
      const row = el('section', 'aw-group aw-tier' + g + (today.solved.includes(g) ? '' : ' aw-missed'));
      row.setAttribute('aria-label', (today.solved.includes(g) ? 'Group found: ' : 'Group missed: ') + grp.label);
      row.appendChild(el('h2', 'aw-group-label', grp.label));
      const list = el('p', 'aw-group-songs');
      grp.songs.forEach((t, i) => {
        if (i) list.appendChild(document.createTextNode(', '));
        const node = titleNode(t, grp.hl && grp.hl[t]);
        if (today.done) {
          const a = el('a', 'aw-song');
          a.href = songHref(slugOf(t));
          a.appendChild(node);
          a.addEventListener('click', () => track('Family - Song page'));
          list.appendChild(a);
        } else list.appendChild(node);
      });
      row.appendChild(list);
      if (grp.note) row.appendChild(el('p', 'aw-group-note', grp.note));
      box.appendChild(row);
    });
  }

  // ─── The tiles ───
  function renderGrid() {
    const grid = $('awGrid');
    grid.textContent = '';
    grid.hidden = today.done;
    if (today.done) return;
    left().forEach(t => {
      const on = picked.includes(t);
      const b = el('button', 'aw-tile' + (on ? ' on' : ''), t);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      if (t.length > 26) b.classList.add('long');
      else if (t.split(/\s+/).some(w => w.length >= 10)) b.classList.add('wide');
      b.addEventListener('click', () => {
        if (picked.includes(t)) picked = picked.filter(x => x !== t);
        else if (picked.length < 4) picked.push(t);
        else { $('awMsg').textContent = 'Four at a time. Tap one to drop it first.'; return; }
        $('awMsg').textContent = '';
        renderGrid();
        renderControls();
        // Rebuilding the tiles drops keyboard focus: put it back on the same song
        const again = [...$('awGrid').children].find(n => n.textContent === t);
        if (again) again.focus();
      });
      grid.appendChild(b);
    });
  }

  function renderControls() {
    $('awControls').hidden = today.done;
    $('awSubmit').disabled = picked.length !== 4;
    $('awClear').disabled = !picked.length;
    $('awSubmit').textContent = picked.length === 4 ? 'Submit' : 'Pick ' + (4 - picked.length) + ' more';
  }

  function renderLives() {
    const box = $('awLives');
    box.textContent = '';
    const leftN = MISTAKES - today.mistakes;
    box.setAttribute('aria-label', leftN + (leftN === 1 ? ' mistake' : ' mistakes') + ' left');
    box.appendChild(el('span', 'aw-lives-h', 'Mistakes left'));
    for (let i = 0; i < MISTAKES; i++) box.appendChild(el('span', 'aw-dot' + (i < leftN ? '' : ' used')));
  }

  $('awShuffle').addEventListener('click', () => {
    const rest = left();
    shuffle(rest, Math.random);
    today.order = today.order.filter(t => today.solved.includes(groupOf(t))).concat(rest);
    save();
    renderGrid();
  });
  $('awClear').addEventListener('click', () => { picked = []; $('awMsg').textContent = ''; renderGrid(); renderControls(); });

  $('awSubmit').addEventListener('click', () => {
    if (today.done || picked.length !== 4) return;
    const msg = $('awMsg');
    if (today.guesses.some(g => sameSet(g, picked))) { msg.textContent = "You've tried those four already. No mistake counted."; return; }
    markStarted();
    today.guesses.push(picked.slice());
    const counts = [0, 1, 2, 3].map(g => picked.filter(t => groupOf(t) === g).length);
    const hit = counts.indexOf(4);
    if (hit >= 0) {
      today.solved.push(hit);
      picked = [];
      msg.textContent = 'Yes - ' + groups[hit].label + '.';
      if (today.solved.length === 4) finish(true);
    } else {
      today.mistakes++;
      const oneAway = counts.includes(3);
      if (today.mistakes >= MISTAKES) finish(false);
      else {
        const leftN = MISTAKES - today.mistakes;
        msg.textContent = (oneAway ? 'One away! ' : 'Not a group. ') + leftN + (leftN === 1 ? ' mistake' : ' mistakes') + ' left.';
      }
    }
    save();
    renderAll();
  });

  // ─── Finishing a game ───
  function finish(won) {
    today.done = true;
    today.won = won;
    picked = [];
    const s = store.stats;
    s.played++;
    if (won) {
      s.won++;
      s.points += todayPoints();
      s.dist[today.mistakes]++;
      s.streak = continues() ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    track(won ? 'Family - Won' : 'Family - Lost');
  }
  // A win on this puzzle keeps the streak going: the streak counts weeks in a row
  const continues = () => store.stats.lastSolved === puzzleNo - 1;
  const shownStreak = () => store.stats.lastSolved === puzzleNo || continues() ? store.stats.streak : 0;
  // Sent with the Started event so Umami can count real return players. Umami's visitor count
  // resets when a phone changes network; these numbers live on the device (jD, 2026-11-05).
  // Nothing personal: a band of games played here before and how long since the last one.
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

  // One row of squares per guess, coloured by each song's real group. No song names.
  // The tier in words too, so the colours don't have to carry it alone.
  const guessRows = () => today.guesses.map(g => g.map(t => SQ[groupOf(t)]).join(''));
  const shareWords = () => today.won
    ? ' (' + (today.mistakes ? today.mistakes + (today.mistakes === 1 ? ' mistake' : ' mistakes') : 'no mistakes') + ')'
    : ' (' + today.solved.length + ' of 4 groups)';
  const shareText = () =>
    '\u{1F3B8} ' + NAME + ' No. ' + puzzleNo + rerunTag + ' - ' + todayPoints() + ' points' + shareWords() + '\n' +
    guessRows().join('\n') + '\nhttps://' + SHARE_URL + '\n';

  function renderStats() {
    const s = store.stats;
    const box = $('awStats');
    box.textContent = '';
    const row = el('div', 'bia-stat-row');
    [
      [s.played, 'Played'],
      [s.played ? Math.round(100 * s.won / s.played) : 0, 'Win %'],
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

    box.appendChild(el('p', 'aw-dist-h', 'Mistakes when you solved it'));
    const dist = el('div', 'bia-dist');
    const max = Math.max(1, ...s.dist);
    s.dist.forEach((n, i) => {
      const r = el('div', 'bia-dist-row');
      r.appendChild(el('span', '', i));
      const bar = el('span', 'bia-dist-bar' + (today.won && today.mistakes === i ? ' today' : ''), n);
      bar.style.width = Math.max(8, Math.round(100 * n / max)) + '%';
      r.appendChild(bar);
      dist.appendChild(r);
    });
    box.appendChild(dist);
  }

  const resultLine = () => {
    if (!today.won) return 'Out of mistakes - ' + today.solved.length + ' of 4 groups. 0 points.';
    if (!today.mistakes) return 'All four, no mistakes. 100 points!';
    return 'Solved with ' + today.mistakes + (today.mistakes === 1 ? ' mistake' : ' mistakes') + ' - ' + todayPoints() + ' points!';
  };

  function renderEnd() {
    const hadFocus = $('awGrid').contains(document.activeElement) || $('awControls').contains(document.activeElement);
    $('awEnd').hidden = false;
    $('awResult').setAttribute('tabindex', '-1');
    $('awResult').textContent = resultLine();
    if (hadFocus) $('awResult').focus();
    const total = $('awTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', store.stats.points.toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' game' : ' games')));
    $('awShareText').textContent = shareText();
    renderStats();
    startCountdown();
  }

  function renderAll() {
    $('awNo').textContent = 'Puzzle No. ' + puzzleNo + puzzleNote(lastWeeks ? "last week's" : '');
    renderLives();
    renderSolved();
    renderGrid();
    renderControls();
    if (today.done) { $('awMsg').textContent = ''; renderEnd(); }
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
  $('awCopy').addEventListener('click', async () => {
    const btn = $('awCopy');
    const ok = await copyText(shareText());
    track('Family - Shared');
    btn.textContent = ok ? 'Copied!' : 'Copy failed - select the text above';
    setTimeout(() => { btn.textContent = 'Copy my score'; }, 2000);
  });
  if (navigator.share) {
    $('awShare').hidden = false;
    $('awShare').addEventListener('click', () => {
      navigator.share({ text: shareText() }).then(() => track('Family - Shared')).catch(() => { /* cancelled */ });
    });
  }

  // ─── Score card (image) ───
  // Same three sizes as the daily games. No spoilers: the guess grid only, never a song or group.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  const TILE = ['#d9d9d9', '#CCA23C', '#C8102E', '#140038'];
  let cardFormat = 'facebook';
  let currentCard = null; // { blob, url, format }
  const cardFile = () => 'are-we-family-' + puzzleNo + '-' + FORMATS[cardFormat].file + '.png';

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
    // The guesses: one row of four squares each, coloured by the songs' real groups
    const grid = (left, top, size, gap) => {
      today.guesses.forEach((g, r) => g.forEach((t, i) => {
        const tx = left + i * (size + gap), ty = top + r * (size + gap), tier = groupOf(t);
        x.beginPath();
        if (x.roundRect) x.roundRect(tx, ty, size, size, size * 0.14); else x.rect(tx, ty, size, size);
        x.fillStyle = TILE[tier];
        x.fill();
        if (tier === 3) { x.strokeStyle = 'rgba(204,162,60,0.7)'; x.lineWidth = 3; x.stroke(); }
      }));
    };

    const score = String(todayPoints());
    const result = !today.won
      ? (name ? name + ' found ' : 'Found ') + today.solved.length + ' of 4 groups'
      : !today.mistakes
        ? (name ? name + ' sorted it with no mistakes' : 'No mistakes')
        : (name ? name + ' sorted it with ' : 'Sorted with ') + today.mistakes + (today.mistakes === 1 ? ' mistake' : ' mistakes');
    const s = store.stats;
    const statLine = 'Weeks in a row ' + shownStreak() + '   |   Win rate ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%';
    const totalLine = 'Total: ' + s.points.toLocaleString('en-CA') + ' points';
    const rows = today.guesses.length;

    if (landscape) {
      put('\u{1F3B8}', 330, 130, '700', 60, '#ffffff');
      put(NAME.toUpperCase(), 330, 186, '700', 30, '#ffffff', '4px', 540);
      put('PUZZLE NO. ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), 330, 232, '700', 26, '#929292', '6px', rerunOf ? 540 : 0);
      put(score, 330, 420, '900', 190, '#ffffff', '0px', 540);
      put('POINTS', 330, 492, '700', 40, '#ffffff', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      const size = Math.min(44, Math.floor((230 - (rows - 1) * 8) / rows));
      put(result, 690, 150, '700', 38, '#ffffff', '0px', 460, 'left');
      grid(690, 180, size, 8);
      put(totalLine, 690, 450, '700', 32, '#ffffff', '0px', 460, 'left');
      put(statLine, 690, 495, '600', 26, '#d9d9d9', '0px', 460, 'left');
      put(SHARE_URL, W / 2, 585, '600', 24, '#929292', '2px', W - 120);
    } else {
      // Stories keep content inside Instagram's safe zone (top and bottom ~250px)
      const y = story
        ? { icon: 340, label: 430, no: 500, score: 800, pts: 885, result: 990, grid: 1040, room: 380, total: 1480, stats: 1545, site: 1640 }
        : { icon: 150, label: 222, no: 280, score: 540, pts: 615, result: 712, grid: 752, room: 330, total: 1150, stats: 1212, site: 1270 };
      const gap = 14, size = Math.min(90, Math.floor((y.room - (rows - 1) * gap) / rows)), rowW = 4 * size + 3 * gap;
      put('\u{1F3B8}', W / 2, y.icon, '700', story ? 110 : 96, '#ffffff');
      put(NAME.toUpperCase(), W / 2, y.label, '700', 44, '#ffffff', '4px', W - 160);
      put('PUZZLE NO. ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), W / 2, y.no, '700', 36, '#929292', '6px', rerunOf ? W - 160 : 0);
      put(score, W / 2, y.score, '900', story ? 300 : 260, '#ffffff', '0px', W - 160);
      put('POINTS', W / 2, y.pts, '700', story ? 60 : 52, '#ffffff', '12px');
      put(result, W / 2, y.result, '700', story ? 56 : 50, '#ffffff', '0px', W - 160);
      grid((W - rowW) / 2, y.grid, size, gap);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 46, '#ffffff', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 36, '#d9d9d9', '0px', W - 160);
      put(SHARE_URL, W / 2, y.site, '600', 32, '#929292', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('awCardImg');
    img.src = currentCard.url;
    // The card's own words, for people who can't see it
    img.alt = NAME + ', puzzle ' + puzzleNo + (rerunOf ? ' (a rerun of puzzle ' + rerunOf + ')' : '') + ': ' + result + '. ' + score + ' points this week. ' + totalLine + '. ' + statLine.replace(/\s+\|\s+/, '. ') + '.';
    img.className = 'bia-card-img bia-card-' + cardFormat;
    $('awCardWrap').hidden = false;
    const file = new File([blob], cardFile(), { type: 'image/png' });
    $('awCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Family - Card made - ' + cardFormat);
  }

  $('awMakeCard').addEventListener('click', () => { if (today.done) makeCard(); });
  document.querySelectorAll('.bia-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.bia-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (today.done && currentCard) makeCard();
  }));
  $('awCardSave').addEventListener('click', () => {
    if (!currentCard) return;
    const a = el('a');
    a.href = currentCard.url;
    a.download = cardFile();
    document.body.appendChild(a); a.click(); a.remove();
    track('Family - Card saved');
  });
  $('awCardShare').addEventListener('click', async () => {
    if (!currentCard) return;
    const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: NAME + ' No. ' + puzzleNo + rerunTag, text: shareText() });
      track('Family - Card shared');
    } catch (e) { /* cancelled */ }
  });

  // ─── Countdown to next Saturday's puzzle (midnight Toronto time) ───
  let timer = null;
  const behind = () => !forcedNo && naturalPuzzleNo() > puzzleNo;
  function startCountdown() {
    if (timer) return;
    // Finished a game that began before the switch: the new puzzle is already out, but
    // reloading now would take the score screen away, so offer it instead
    const staleAtStart = behind();
    const box = $('awCountdown').parentNode;
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
      const secs = Math.max(0, Math.round(msUntilDay(epochDay + puzzleNo * STEP_DAYS) / 1000));
      const p = n => String(n).padStart(2, '0');
      const d = Math.floor(secs / 86400);
      $('awCountdown').textContent = (d ? d + (d === 1 ? ' day ' : ' days ') : '') + p(Math.floor(secs / 3600) % 24) + ':' + p(Math.floor(secs / 60) % 60) + ':' + p(secs % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Tab left open into a new week: new puzzle. Never in the middle of a game, though.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && behind() && (today.done || !today.started)) location.reload();
  });

  save();
  renderAll();
  if (lastWeeks) $('awMsg').textContent = "Last week's puzzle is still open - finish it, then this week's is waiting.";
  $('awLoading').hidden = true;
  $('awGame').hidden = false;
})();
