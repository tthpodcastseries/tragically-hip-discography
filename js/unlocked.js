// unlocked.js - '(Un)Locked in the Trunk of a Car', the daily lyrics game (v5.4; points ladder in v5.4.4)
// One Hip song a day, the same for everyone, behind five scrambled words from its
// lyrics. Name the song with as few words unlocked as you can.
// Everything runs in the browser from data/trunk-pool.json (scripts/build-trunk-pool.js);
// there is no server and nothing is sent anywhere except anonymous Umami event names.
// Shares its frame and styles with bring-it-all-back.js / css.
(async function () {
  const $ = id => document.getElementById(id);
  const track = name => { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) { /* analytics optional */ } };

  // Date of puzzle #1 - the game opens this day (local time). Before it the page
  // says when the game opens instead of showing a puzzle.
  const EPOCH = '2026-11-04';
  const WORDS = 5;
  // Points ladder: the score depends on when you name the song. Rung 0 is before any
  // word (a free first shot), rungs 1-5 come after each word, and rung 6 is the album
  // hint, which appears after a miss on word 5. Every unlocked word forces a guess (or
  // a pass) before the next one opens. A word revealed instead of unscrambled costs 10
  // more, but a win always scores at least 10. Missing the last guess is a loss.
  const LADDER = [100, 90, 80, 70, 60, 50, 30];
  const HINT_RUNG = 6, REVEAL_COST = 10, MIN_WIN = 10;
  const STORE_KEY = 'tth_unlocked_v1';
  const SHARE_URL = 'thehiphandbook.tthpods.com/unlocked';
  const NAME = '(Un)Locked in the Trunk of a Car';
  const SHORT = '(Un)Locked';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SQ = { solved: '\u{1F7E9}', revealed: '\u{1F7E8}', locked: '\u{2B1B}', hint: '\u{1F4BF}' };

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

  // ─── Which puzzle is today ───
  const localDayNumber = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, localDayNumber(new Date()) - epochDay + 1);
  const puzzleNo = forcedDay || naturalPuzzleNo();

  // Not open yet: say when, and open itself when the day arrives
  if (!forcedDay && localDayNumber(new Date()) < epochDay) {
    const opens = new Date(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]));
    $('ulLoading').textContent = NAME + ' opens ' + DAYS[opens.getUTCDay()] + ', ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + '. One Hip song a day - come back then.';
    const now = new Date();
    setTimeout(() => location.reload(), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now + 1000);
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

  // Saved game belongs to a different puzzle (or is missing): start today's fresh
  // guesses: one per rung at most, { r: rung, s: song slug, or '' for a pass }
  if (!store.today || store.today.no !== puzzleNo || !Array.isArray(store.today.unlocked) || !Array.isArray(store.today.guesses)) {
    store.today = { no: puzzleNo, unlocked: [], guesses: [], hint: false, done: false, won: false, started: false };
  }
  const today = store.today;

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
  // What a right answer is worth on a rung
  const worth = r => Math.max(MIN_WIN, LADDER[r] - reveals() * REVEAL_COST);
  const guessedHere = () => today.guesses.some(g => g.r === rung());
  // Guess now? Every rung allows one; rungs 1+ require it before the next word opens
  const canGuess = () => !today.done && !guessedHere();
  const canUnlock = () => !today.done && !today.hint && today.unlocked.length < WORDS && (rung() === 0 || guessedHere());
  const wrongSlugs = () => today.guesses.filter(g => g.s && g.s !== puzzle.s).map(g => g.s);
  const todayPoints = () => today.won ? worth(today.wonAt) : 0;
  const shownPoints = () => today.done ? todayPoints() : worth(canGuess() ? rung() : Math.min(rung() + 1, HINT_RUNG));
  const squares = () => words.map((w, i) => SQ[today.unlocked[i] || 'locked']).join('') + (today.hint ? ' ' + SQ.hint : '');
  const markStarted = () => { if (!today.started) { today.started = true; track('Unlocked - Started'); } };

  // ─── The words ───
  let used = []; // which tiles of the active word are spent, by index
  function renderWords() {
    const list = $('ulWords');
    list.textContent = '';
    const active = canUnlock() ? today.unlocked.length : -1;
    words.forEach((word, i) => {
      const how = today.unlocked[i];
      const li = el('li', 'ul-word' + (how ? ' open ' + how : i === active ? ' active' : ' locked'));
      li.appendChild(el('span', 'ul-num', i + 1));
      if (how || today.done) {
        li.appendChild(el('span', 'ul-answer', word.toUpperCase()));
        li.appendChild(el('span', 'ul-tag', how === 'revealed' ? 'Revealed -10' : how ? 'Unlocked' : 'Never needed'));
      } else {
        const tiles = el('span', 'ul-tiles');
        [...scrambles[i]].forEach((ch, t) => {
          if (i === active) {
            const b = el('button', 'ul-tile' + (used.includes(t) ? ' used' : ''), ch);
            b.type = 'button';
            b.disabled = used.includes(t);
            b.setAttribute('aria-label', 'Letter ' + ch);
            b.addEventListener('click', () => tapTile(t));
            tiles.appendChild(b);
          } else {
            tiles.appendChild(el('span', 'ul-tile', ch));
          }
        });
        li.appendChild(tiles);
        if (i !== active) li.appendChild(el('span', 'ul-lock', '\u{1F512}'));
      }
      list.appendChild(li);
    });
    const form = $('ulWordForm');
    form.hidden = active < 0;
    if (!form.hidden) {
      $('ulWordLabel').textContent = 'Unscramble word ' + (active + 1) + ' (' + words[active].length + ' letters)';
      $('ulWordInput').maxLength = words[active].length;
    }
  }

  // Tiles and the text box stay in step: tapping types the letter, typing spends tiles
  function syncTiles() {
    const active = today.unlocked.length;
    if (!canUnlock()) return;
    const letters = [...scrambles[active]];
    used = [];
    for (const ch of $('ulWordInput').value.toUpperCase()) {
      const t = letters.findIndex((c, k) => c === ch && !used.includes(k));
      if (t >= 0) used.push(t);
    }
    renderWords();
  }
  function tapTile(t) {
    const active = today.unlocked.length;
    const input = $('ulWordInput');
    if (input.value.length >= words[active].length) return;
    input.value += scrambles[active][t];
    syncTiles();
  }
  $('ulWordInput').addEventListener('input', () => { $('ulWordMsg').textContent = ''; syncTiles(); });
  $('ulClear').addEventListener('click', () => { $('ulWordInput').value = ''; $('ulWordMsg').textContent = ''; syncTiles(); });

  function unlock(how) {
    markStarted();
    today.unlocked.push(how);
    $('ulWordInput').value = '';
    used = [];
    $('ulMsg').textContent = '';
    save();
    renderAll();
    $('ulGuessInput').focus();
  }
  $('ulWordForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!canUnlock()) return;
    const active = today.unlocked.length;
    const raw = $('ulWordInput').value.trim().toLowerCase();
    const msg = $('ulWordMsg');
    if (raw.length !== words[active].length) { msg.textContent = 'Use all ' + words[active].length + ' letters.'; return; }
    if (raw !== words[active]) { msg.textContent = 'Not quite. Try again - wrong unscrambles are free.'; return; }
    msg.textContent = '';
    unlock('solved');
  });
  $('ulRevealWord').addEventListener('click', () => {
    if (!canUnlock()) return;
    $('ulWordMsg').textContent = '';
    unlock('revealed');
  });

  // ─── Guessing the song ───
  const titles = pool.titles.map(([s, t]) => ({ s, t, n: norm(t) }));
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

  $('ulGuessForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!canGuess()) return;
    const msg = $('ulMsg');
    const q = norm($('ulGuessInput').value);
    if (!q) { msg.textContent = 'Type a song title.'; return; }
    // An exact title, or the only song that matches what was typed
    let pick = titles.find(x => x.n === q);
    if (!pick) {
      const hits = titles.filter(x => x.n.includes(q));
      if (hits.length === 1) pick = hits[0];
    }
    if (!pick) { msg.textContent = 'Pick a song from the list.'; return; }
    if (wrongSlugs().includes(pick.s)) { msg.textContent = 'Already guessed ' + pick.t + '. Try another.'; return; }
    markStarted();
    $('ulGuessInput').value = '';
    $('ulSuggest').hidden = true;
    answer(pick.s, pick.t);
  });

  // A guess (or a pass, slug '') on the current rung
  function answer(slug, title) {
    const r = rung();
    const msg = $('ulMsg');
    today.guesses.push({ r, s: slug });
    if (slug === puzzle.s) {
      msg.textContent = '';
      today.wonAt = r;
      finish(true);
    } else if (r === HINT_RUNG || (r === WORDS && !puzzle.al)) {
      finish(false);
    } else if (r === WORDS) {
      // Missed with every word open: the album hint is the last rung
      today.hint = true;
      track('Unlocked - Album hint');
      msg.textContent = (slug ? 'Not ' + title + '.' : 'Passed.') + ' Here is the album - one last guess.';
    } else if (r === 0) {
      msg.textContent = 'Not ' + title + ". No points lost - unlock word 1 when you're ready.";
    } else {
      msg.textContent = (slug ? 'Not ' + title + '.' : 'Passed.') + ' Unlock word ' + (r + 1) + '.';
    }
    save();
    renderAll();
  }
  $('ulPass').addEventListener('click', () => {
    if (!canGuess() || rung() === 0 || rung() === HINT_RUNG) return;
    markStarted();
    $('ulGuessInput').value = '';
    $('ulSuggest').hidden = true;
    answer('', '');
  });

  function renderWrong() {
    const list = $('ulWrong');
    list.textContent = '';
    wrongSlugs().forEach(s => list.appendChild(el('li', '', '✗ ' + titleOf(s))));
  }

  // The guess box: what it's worth now, and whether a guess is owed
  function renderGuess() {
    const form = $('ulGuessForm');
    form.hidden = !canGuess();
    if (form.hidden) return;
    const r = rung();
    $('ulGuessLabel').textContent = r === 0
      ? 'Know it already? Name the song for ' + worth(0) + ' points'
      : r === HINT_RUNG
        ? 'Last guess, with the album hint - worth ' + worth(r) + ' points'
        : 'Word ' + r + ' is open - name the song for ' + worth(r) + ' points, or pass';
    $('ulPass').hidden = r === 0 || r === HINT_RUNG;
  }

  // ─── Album hint and giving up ───
  function renderTools() {
    const tools = $('ulTools');
    tools.hidden = today.done;
    if (today.done) return;
    const shown = $('ulHintShown');
    shown.hidden = !today.hint;
    if (today.hint) {
      shown.textContent = '';
      shown.appendChild(el('span', '', 'Album: '));
      shown.appendChild(el('b', '', puzzle.al));
    }
  }
  // Two taps, so nobody gives up by accident
  let giveUpArmed = null;
  $('ulGiveUp').addEventListener('click', () => {
    if (today.done) return;
    const btn = $('ulGiveUp');
    if (!giveUpArmed) {
      btn.textContent = 'Tap again to give up';
      btn.classList.add('armed');
      giveUpArmed = setTimeout(() => { giveUpArmed = null; btn.textContent = 'Give up'; btn.classList.remove('armed'); }, 4000);
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
    today.done = true;
    today.won = won;
    const s = store.stats;
    s.played++;
    if (won) {
      s.won++;
      s.points += todayPoints();
      s.dist[today.wonAt]++;
      s.streak = s.lastSolved === puzzleNo - 1 ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    track(won ? 'Unlocked - Won' : 'Unlocked - Lost');
  }

  const shareText = () =>
    (today.won ? '\u{1F513} ' : '\u{1F512} ') + SHORT + ' #' + puzzleNo + ' - ' + todayPoints() + ' points\n' +
    squares() + '\n' + SHARE_URL;

  function shownStreak() {
    const s = store.stats;
    return s.lastSolved === puzzleNo || s.lastSolved === puzzleNo - 1 ? s.streak : 0;
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
    if (!today.won) return today.gaveUp ? 'You gave up - here it is. 0 points.' : 'The trunk stays locked. 0 points.';
    if (r === 0) return 'Straight guess. Bang on. 100 points!';
    if (r === HINT_RUNG) return 'Got it with the album hint - ' + todayPoints() + ' points!';
    return 'Unlocked with ' + r + (r === 1 ? ' word' : ' words') + ' - ' + todayPoints() + ' points!';
  };

  function renderEnd() {
    $('ulGuessForm').hidden = true;
    $('ulWordForm').hidden = true;
    $('ulMsg').textContent = '';
    $('ulEnd').hidden = false;
    $('ulResult').textContent = resultLine();
    const total = $('ulTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', store.stats.points.toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' game' : ' games')));

    const reveal = $('ulReveal');
    reveal.textContent = '';
    reveal.appendChild(el('div', 'when', "Today's song"));
    reveal.appendChild(el('div', 'where', puzzle.t));
    if (puzzle.al) reveal.appendChild(el('div', 'meta', 'From ' + puzzle.al));

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
      const live = el('a', 'ul-play-btn ul-play-live', 'Live in the Hip Archive');
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
    $('ulNo').textContent = 'Puzzle #' + puzzleNo;
    $('ulPoints').textContent = shownPoints();
    renderWords();
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
    const result = !today.won
      ? (today.gaveUp ? (name ? name + ' gave up today' : 'Gave up today') : (name ? name + ' stayed locked out today' : 'Locked out today'))
      : n === 0
        ? (name ? name + ' got it straight away' : 'Straight guess. Bang on.')
        : n === HINT_RUNG
          ? (name ? name + ' got it with the album hint' : 'Got it with the album hint')
          : (name ? name + ' unlocked it with ' + n : 'Unlocked with ' + n) + (n === 1 ? ' word' : ' words');
    const s = store.stats;
    const statLine = 'Streak ' + shownStreak() + '   |   Win rate ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%';
    const totalLine = 'Total: ' + s.points.toLocaleString('en-CA') + ' points';
    const blurb = 'Name the Hip song from five scrambled lyric words';

    if (landscape) {
      put(today.won ? '\u{1F513}' : '\u{1F512}', 330, 130, '700', 60, '#ffffff');
      put(NAME.toUpperCase(), 330, 186, '700', 28, '#CCA23C', '4px', 540);
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
      put(blurb, 690, 492, '600', 24, '#b0b0b0', '0px', 460, 'left');
      put(SHARE_URL, W / 2, 585, '600', 24, '#b0b0b0', '2px', W - 120);
    } else {
      // Stories keep content inside Instagram's safe zone (top and bottom ~250px)
      const y = story
        ? { icon: 360, label: 450, no: 525, score: 880, pts: 970, result: 1090, tiles: 1150, size: 150, total: 1395, stats: 1465, blurb: 1530, site: 1640 }
        : { icon: 160, label: 232, no: 290, score: 590, pts: 668, result: 768, tiles: 806, size: 140, total: 1036, stats: 1100, blurb: 1160, site: 1250 };
      const gap = 24, rowW = WORDS * y.size + (WORDS - 1) * gap;
      put(today.won ? '\u{1F513}' : '\u{1F512}', W / 2, y.icon, '700', story ? 110 : 96, '#ffffff');
      put(NAME.toUpperCase(), W / 2, y.label, '700', 40, '#CCA23C', '4px', W - 160);
      put('PUZZLE #' + puzzleNo, W / 2, y.no, '700', 36, '#b0b0b0', '6px');
      put(score, W / 2, y.score, '900', story ? 330 : 290, '#C8102E', '0px', W - 160);
      put('POINTS', W / 2, y.pts, '700', story ? 64 : 56, '#CCA23C', '12px');
      put(result, W / 2, y.result, '700', story ? 62 : 56, '#ffffff', '0px', W - 160);
      tiles((W - rowW) / 2, y.tiles, y.size, gap);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 48, '#CCA23C', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 38, '#d9d9d9', '0px', W - 160);
      put(blurb, W / 2, y.blurb, '600', story ? 34 : 30, '#b0b0b0', '0px', W - 160);
      put(SHARE_URL, W / 2, y.site, '600', 32, '#b0b0b0', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('ulCardImg');
    img.src = currentCard.url;
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
      await navigator.share({ files: [file], title: SHORT + ' #' + puzzleNo, text: shareText() });
      track('Unlocked - Card shared');
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
      $('ulCountdown').textContent = p(Math.floor(left / 3600)) + ':' + p(Math.floor(left / 60) % 60) + ':' + p(left % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Phone left open overnight: new day, new puzzle
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !forcedDay && naturalPuzzleNo() !== puzzleNo) location.reload();
  });

  renderAll();
  $('ulLoading').hidden = true;
  $('ulGame').hidden = false;
})();
