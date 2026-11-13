// little-bones.js - 'Little Bones', the daily live-clip game
// One song by The Hip a day, the same for everyone, heard as a short clip from a real show
// in the Hip Archive (Backblaze, the same files the tour map plays). Name it from the
// shortest clip you can; get it and guess the show's year for a bonus.
// Everything runs in the browser from data/clip-pool.json (scripts/build-clip-pool.js); the
// only outside requests are the clip itself and anonymous Umami event names.
// Shares its frame and styles with unlocked.js / bring-it-all-back.js.
(async function () {
  const $ = id => document.getElementById(id);
  const track = (name, data) => { try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) { /* analytics optional */ } };

  // Date of puzzle #1 - the game opens at midnight Toronto time on this day. Before it the
  // page says when the game opens instead of showing a puzzle. Wednesday, November 18, 2026
  // (jD, 2026-11-05). Never change it once the game has opened.
  const EPOCH = '2026-11-18';
  // Clip lengths in seconds, one per try, and what a right answer is worth on each
  const CLIPS = [2, 4, 8, 15, 30];
  const LADDER = [100, 80, 60, 40, 20];
  // Year bonus: bang on, or within YEAR_CLOSE years
  const YEAR_EXACT = 20, YEAR_NEAR = 10, YEAR_CLOSE = 2;
  // Where the clip starts when jD hasn't set one (data/clip-starts.json): this far into the
  // track, past the crowd noise and the talk
  const DEFAULT_START = 0.3;
  const AUDIO_BASE = 'https://f006.backblazeb2.com/file/tth-audio';
  const STORE_KEY = 'tth_littlebones_v1';
  const SHARE_URL = 'thehiphandbook.tthpods.com/little-bones';
  const NAME = 'Little Bones';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SQ = { hit: '\u{1F7E9}', miss: '\u{1F7E5}', unused: '\u{2B1B}', year: '\u{1F4C5}' };

  // ?day=N and ?reset=1 are for testing, and only work on a local address
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const forcedDay = isLocal && /^\d+$/.test(params.get('day') || '') ? Math.max(1, +params.get('day')) : 0;
  const songHref = s => isLocal ? '/song?s=' + s : '/song/' + s;

  // ─── Storage (never trust it to be there) ───
  // dist[c] = wins on clip c (0-4)
  const blank = () => ({ stats: { played: 0, won: 0, streak: 0, best: 0, points: 0, dist: [0, 0, 0, 0, 0], years: 0, lastSolved: 0 }, today: null });
  const load = () => {
    try {
      if (isLocal && params.get('reset') === '1') localStorage.removeItem(STORE_KEY);
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.stats && Array.isArray(saved.stats.dist) && saved.stats.dist.length === CLIPS.length) return saved;
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

  // ─── Which puzzle is today ───
  const epochParts = EPOCH.split('-');
  const epochDay = Math.floor(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]) / 86400000);
  const naturalPuzzleNo = () => Math.max(1, dayNumber() - epochDay + 1);
  // Normally today's puzzle, but a saved game is kept when it is yesterday's and half played
  // (finish it first), or one day ahead (a fan east of Toronto who already had the next one)
  const natural = naturalPuzzleNo();
  const saved = store.today && Array.isArray(store.today.guesses) ? store.today : null;
  const carried = !forcedDay && !!saved && (saved.no === natural + 1 || (saved.no === natural - 1 && !saved.done && !!saved.started));
  const puzzleNo = forcedDay || (carried ? saved.no : natural);
  const yesterdays = carried && puzzleNo < natural;

  // Not open yet: say when, and open itself when the day arrives
  if (!forcedDay && dayNumber() < epochDay) {
    const opens = new Date(Date.UTC(+epochParts[0], +epochParts[1] - 1, +epochParts[2]));
    $('lbLoading').textContent = NAME + ' opens ' + DAYS[opens.getUTCDay()] + ', ' + MONTHS[+epochParts[1] - 1] + ' ' + (+epochParts[2]) + ', at midnight Toronto time (Eastern). One live clip a day - come back then.';
    setTimeout(() => location.reload(), Math.min(msUntilDay(dayNumber() + 1) + 1000, 2147483647));
    return;
  }

  // ─── Load the pool ───
  let pool;
  try {
    pool = await fetch('/data/clip-pool.json').then(r => { if (!r.ok) throw new Error('pool'); return r.json(); });
    if (!pool.puzzles || !pool.puzzles.length) throw new Error('empty');
  } catch (e) {
    $('lbLoading').hidden = true;
    $('lbError').hidden = false;
    return;
  }
  const puzzle = pool.puzzles[(puzzleNo - 1) % pool.puzzles.length];
  // Past the last puzzle the game starts again from the first one, and says so: the
  // heading, the share text and the card all get a "rerun" label (jD, 2026-11-13). Add
  // puzzles on the end of the pool before the run ends and no rerun is ever shown.
  const rerunOf = puzzleNo > pool.puzzles.length ? ((puzzleNo - 1) % pool.puzzles.length) + 1 : 0;
  const puzzleNote = late => { const tags = [late, rerunOf ? 'rerun' : ''].filter(Boolean); return tags.length ? ' (' + tags.join(', ') + ')' : ''; };
  const rerunTag = puzzleNote('');
  const showYear = +puzzle.d.slice(0, 4);

  // Saved game belongs to a different puzzle (or is missing): start today's fresh
  // guesses: one per clip, { c: clip, s: song slug, or '' for a skip }; year: { y, pts } or { skip }
  if (!saved || saved.no !== puzzleNo) {
    store.today = { no: puzzleNo, guesses: [], done: false, won: false, started: false, year: null };
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
  const clip = () => Math.min(today.guesses.length, CLIPS.length - 1);
  // Waiting on the year bonus: the song is named, the year isn't settled yet
  const yearOpen = () => today.won && !today.year;
  // Once the song is named (or the game is over) the whole 30 seconds is open
  const heardAll = () => today.done || today.won;
  const wrongSlugs = () => today.guesses.filter(g => g.s && g.s !== puzzle.s).map(g => g.s);
  const yearPoints = () => today.year && today.year.pts ? today.year.pts : 0;
  const todayPoints = () => today.won ? LADDER[today.wonAt] + yearPoints() : 0;
  const markStarted = () => { if (!today.started) { today.started = true; track('Little Bones - Started', startInfo()); } };
  const fmtDate = d => MONTHS[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8, 10)) + ', ' + d.slice(0, 4);

  // ─── The clip ───
  // One <audio>, loaded on the first press (nothing downloads until then). It plays muted
  // until it has jumped to the start point, so nobody hears the crowd or the talk before it,
  // then stops itself at the end of the clip.
  const audio = new Audio();
  audio.preload = 'none';
  let startAt = null; // seconds into the track, once the length is known
  let stopAt = 0, playing = false, frame = 0;
  const audioUrl = AUDIO_BASE + '/' + puzzle.u.split('/').map(encodeURIComponent).join('/');
  // The lock screen and the media controls would show the file's own tags (the song title);
  // name the game instead
  function hideTitle() {
    try {
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({ title: NAME + ' - today\'s clip', artist: 'The Hip Handbook' });
      }
    } catch (e) { /* not supported here */ }
  }
  const once = (target, event) => new Promise((res, rej) => {
    const ok = () => { off(); res(); };
    const bad = () => { off(); rej(new Error(event)); };
    const off = () => { target.removeEventListener(event, ok); target.removeEventListener('error', bad); };
    target.addEventListener(event, ok);
    target.addEventListener('error', bad);
  });

  function renderBar() {
    const len = CLIPS[CLIPS.length - 1];
    const marks = $('lbMarks');
    if (!marks.children.length) CLIPS.forEach(c => { const m = el('span', 'lb-mark'); m.style.left = (100 * c / len) + '%'; marks.appendChild(m); });
    const open = heardAll() ? len : CLIPS[clip()];
    $('lbMarks').style.setProperty('--open', (100 * open / len) + '%');
    $('lbMarks').parentNode.style.setProperty('--open', (100 * open / len) + '%');
    const heard = playing && startAt != null ? Math.max(0, Math.min(audio.currentTime - startAt, open)) : 0;
    $('lbFill').style.width = (100 * heard / len) + '%';
  }
  function tick() {
    renderBar();
    if (!playing) return;
    if (audio.currentTime >= stopAt || audio.ended) { stop(); return; }
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    audio.pause();
    $('lbPlay').innerHTML = '&#9654; Play';
    $('lbPlay').setAttribute('aria-label', 'Play the clip');
    renderBar();
  }
  async function play() {
    if (playing) { stop(); return; }
    const len = heardAll() ? CLIPS[CLIPS.length - 1] : CLIPS[clip()];
    const msg = $('lbAudioMsg');
    msg.textContent = '';
    playing = true;
    $('lbPlay').textContent = 'Loading...';
    try {
      hideTitle();
      if (!audio.src) {
        audio.src = audioUrl;
        audio.muted = true;
        const meta = once(audio, 'loadedmetadata');
        await audio.play();
        await meta;
        const dur = isFinite(audio.duration) ? audio.duration : 0;
        startAt = typeof puzzle.at === 'number' ? puzzle.at : dur * DEFAULT_START;
        // Leave room for the longest clip
        if (dur) startAt = Math.max(0, Math.min(startAt, dur - CLIPS[CLIPS.length - 1] - 1));
        track('Little Bones - Clip played');
      } else {
        audio.muted = true;
        await audio.play();
      }
      if (!playing) return; // stopped while loading
      const seeked = once(audio, 'seeked');
      audio.currentTime = startAt;
      await seeked;
      stopAt = startAt + len;
      audio.muted = false;
      $('lbPlay').innerHTML = '&#9632; Stop';
      $('lbPlay').setAttribute('aria-label', 'Stop the clip');
      frame = requestAnimationFrame(tick);
    } catch (e) {
      playing = false;
      audio.pause();
      audio.muted = false;
      $('lbPlay').innerHTML = '&#9654; Play';
      msg.textContent = "Couldn't play the clip. Check yer connection and press Play again.";
      // Start over on the next press, in case the load itself failed
      if (startAt == null) audio.removeAttribute('src');
    }
  }
  $('lbPlay').addEventListener('click', () => { markStarted(); play(); });

  function renderPlayer() {
    const len = heardAll() ? CLIPS[CLIPS.length - 1] : CLIPS[clip()];
    $('lbLen').textContent = heardAll() ? 'The whole 30 seconds' : 'Clip ' + (clip() + 1) + ' of ' + CLIPS.length + ': ' + len + ' seconds';
    $('lbPlay').setAttribute('aria-label', 'Play the clip, ' + len + ' seconds');
    renderBar();
  }

  // ─── Guessing the song ───
  // Same matching as (Un)Locked: words of the title, and the title from each word on
  const wordsOf = t => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['‘’]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  const titles = pool.titles.map(([s, t]) => {
    const w = wordsOf(t);
    return { s, t, n: norm(t), words: w, starts: w.map((x, i) => w.slice(i).join('')) };
  });
  function suggest() {
    const q = norm($('lbGuessInput').value);
    const box = $('lbSuggest');
    box.textContent = '';
    if (!q) { box.hidden = true; $('lbGuessInput').setAttribute('aria-expanded', 'false'); return; }
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
        $('lbGuessInput').value = x.t;
        box.hidden = true;
        $('lbGuessInput').setAttribute('aria-expanded', 'false');
        $('lbGuessInput').focus();
      });
      li.appendChild(b);
      box.appendChild(li);
    });
    box.hidden = !hits.length;
    $('lbGuessInput').setAttribute('aria-expanded', String(!!hits.length));
  }
  $('lbGuessInput').addEventListener('input', () => { $('lbMsg').textContent = ''; suggest(); });
  const options = () => [...$('lbSuggest').querySelectorAll('.ul-option:not(:disabled)')];
  $('lbGuessInput').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && options().length) { e.preventDefault(); options()[0].focus(); }
    else if (e.key === 'Escape') { $('lbSuggest').hidden = true; $('lbGuessInput').setAttribute('aria-expanded', 'false'); }
  });
  $('lbSuggest').addEventListener('keydown', e => {
    const list = options(), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i > 0 ? list[i - 1].focus() : $('lbGuessInput').focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); $('lbSuggest').hidden = true; $('lbGuessInput').setAttribute('aria-expanded', 'false'); $('lbGuessInput').focus(); }
  });

  $('lbGuessForm').addEventListener('submit', e => {
    e.preventDefault();
    if (today.done || today.won) return;
    const msg = $('lbMsg');
    const q = norm($('lbGuessInput').value);
    if (!q) { msg.textContent = 'Type a song title.'; return; }
    // An exact title, or the only song where what was typed starts one of its words
    let pick = titles.find(x => x.n === q);
    if (!pick) {
      const hits = titles.filter(x => x.starts.some(w => w.startsWith(q)) && (q.length >= 4 || (q.length >= 3 && x.words.includes(q))));
      if (hits.length === 1) pick = hits[0];
    }
    if (!pick) { msg.textContent = 'Pick a song from the list.'; return; }
    if (wrongSlugs().includes(pick.s)) { msg.textContent = 'Already guessed ' + pick.t + '. Try another.'; return; }
    markStarted();
    $('lbGuessInput').value = '';
    $('lbSuggest').hidden = true;
    answer(pick.s, pick.t);
  });
  $('lbSkip').addEventListener('click', () => {
    if (today.done || today.won) return;
    markStarted();
    $('lbGuessInput').value = '';
    $('lbSuggest').hidden = true;
    answer('', '');
  });

  // A guess (or a skip, slug '') on the current clip
  function answer(slug, title) {
    const c = clip();
    const msg = $('lbMsg');
    if (playing) stop();
    today.guesses.push({ c, s: slug });
    if (slug === puzzle.s) {
      today.won = true;
      today.wonAt = c;
      msg.textContent = "That's it - " + puzzle.t + ' for ' + LADDER[c] + ' points. Now the bonus.';
      track('Little Bones - Song named');
    } else if (c === CLIPS.length - 1) {
      finish();
    } else {
      msg.textContent = (slug ? 'Not ' + title + '.' : 'Skipped.') + ' Clip ' + (c + 2) + ' is ' + CLIPS[c + 1] + ' seconds - press Play.';
    }
    save();
    renderAll();
    if (yearOpen()) $('lbYear').focus();
    else if (!today.done) $('lbPlay').focus();
  }

  // ─── The year bonus ───
  {
    const sel = $('lbYear');
    sel.appendChild(el('option', '', 'Pick a year')).value = '';
    for (let y = 1984; y <= 2016; y++) sel.appendChild(el('option', '', String(y))).value = String(y);
  }
  $('lbYearForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!yearOpen()) return;
    const y = +$('lbYear').value;
    if (!y) { $('lbMsg').textContent = 'Pick a year, or skip the bonus.'; return; }
    const off = Math.abs(y - showYear);
    today.year = { y, pts: off === 0 ? YEAR_EXACT : off <= YEAR_CLOSE ? YEAR_NEAR : 0 };
    finish();
    save();
    renderAll();
  });
  $('lbYearSkip').addEventListener('click', () => {
    if (!yearOpen()) return;
    today.year = { skip: true };
    finish();
    save();
    renderAll();
  });

  // ─── Finishing a game ───
  function finish() {
    today.done = true;
    const s = store.stats;
    s.played++;
    if (today.won) {
      s.won++;
      s.points += todayPoints();
      s.dist[today.wonAt]++;
      if (today.year && today.year.pts === YEAR_EXACT) s.years++;
      s.streak = continues() ? s.streak + 1 : 1;
      s.lastSolved = puzzleNo;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    track(today.won ? 'Little Bones - Won' : 'Little Bones - Lost');
  }
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
      last: !last ? (n ? 'Not known' : 'First game') : gap <= 1 ? 'Yesterday' : gap <= 7 ? '2-7 days ago' : 'Over a week ago'
    };
    s.lastPlayed = puzzleNo;
    return info;
  };

  // One square per clip: red for a miss or skip, green where you got it, black never needed.
  // The words say it too, so the colours don't carry it alone.
  const squares = () => CLIPS.map((x, i) => i < today.guesses.length ? (today.won && i === today.wonAt ? SQ.hit : SQ.miss) : SQ.unused).join('');
  const yearWords = () => !today.won ? '' : today.year && today.year.pts === YEAR_EXACT ? 'year bang on' : today.year && today.year.pts ? 'year close' : 'year missed';
  const shareWords = () => today.won
    ? ' (clip ' + (today.wonAt + 1) + ' of ' + CLIPS.length + ', ' + yearWords() + ')'
    : ' (missed)';
  const shareText = () =>
    '\u{1F3B5} ' + NAME + ' No. ' + puzzleNo + rerunTag + ' - ' + todayPoints() + ' points' + shareWords() + '\n' +
    squares() + (today.won ? ' ' + SQ.year + (today.year && today.year.pts ? '+' + today.year.pts : '0') : '') + '\nhttps://' + SHARE_URL + '\n';

  function renderWrong() {
    const list = $('lbWrong');
    list.textContent = '';
    wrongSlugs().forEach(s => list.appendChild(el('li', '', '✗ ' + titleOf(s))));
  }

  function renderStats() {
    const s = store.stats;
    const box = $('lbStats');
    box.textContent = '';
    const row = el('div', 'bia-stat-row');
    [
      [s.played, 'Played'],
      [s.played ? Math.round(100 * s.won / s.played) : 0, 'Win %'],
      [shownStreak(), 'Streak'],
      [s.years, 'Years'],
      [s.points.toLocaleString('en-CA'), 'Points'],
    ].forEach(c => {
      const cell = el('div');
      cell.appendChild(el('b', String(c[0]).length > 4 ? 'long' : '', c[0]));
      cell.appendChild(el('span', '', c[1]));
      row.appendChild(cell);
    });
    box.appendChild(row);
    box.appendChild(el('p', 'ul-dist-h', 'The clip you got it on (Years = years bang on)'));
    const dist = el('div', 'bia-dist');
    const max = Math.max(1, ...s.dist);
    s.dist.forEach((n, i) => {
      const r = el('div', 'bia-dist-row');
      r.appendChild(el('span', '', CLIPS[i] + 's'));
      const bar = el('span', 'bia-dist-bar' + (today.won && today.wonAt === i ? ' today' : ''), n);
      bar.style.width = Math.max(8, Math.round(100 * n / max)) + '%';
      r.appendChild(bar);
      dist.appendChild(r);
    });
    box.appendChild(dist);
  }

  const resultLine = () => {
    if (!today.won) return "Didn't get it. 0 points.";
    const yr = today.year && today.year.pts === YEAR_EXACT ? ' and the year bang on' : today.year && today.year.pts ? ' and the year close' : '';
    return (today.wonAt === 0 ? 'Two seconds' : 'Got it on clip ' + (today.wonAt + 1)) + yr + ' - ' + todayPoints() + ' points!';
  };

  function renderEnd() {
    const hadFocus = $('lbGuessForm').contains(document.activeElement) || $('lbYearForm').contains(document.activeElement) || $('lbSuggest').contains(document.activeElement);
    $('lbEnd').hidden = false;
    $('lbResult').setAttribute('tabindex', '-1');
    $('lbResult').textContent = resultLine();
    if (hadFocus) $('lbResult').focus();
    const total = $('lbTotal');
    total.textContent = 'Yer total: ';
    total.appendChild(el('b', '', store.stats.points.toLocaleString('en-CA') + ' points'));
    total.appendChild(document.createTextNode(' from ' + store.stats.played + (store.stats.played === 1 ? ' game' : ' games')));

    const reveal = $('lbReveal');
    reveal.textContent = '';
    reveal.appendChild(el('div', 'when', "Today's song"));
    reveal.appendChild(el('div', 'where', puzzle.t));
    reveal.appendChild(el('div', 'meta', 'Live, ' + fmtDate(puzzle.d) + (puzzle.pl ? ' - ' + puzzle.pl : '')));
    if (today.year && today.year.y) reveal.appendChild(el('div', 'meta', 'You guessed ' + today.year.y + (today.year.pts ? ' (+' + today.year.pts + ')' : '')));

    const links = $('lbLinks');
    links.textContent = '';
    const show = el('a', '', 'Play the whole show');
    show.href = 'tour-map.html#play=' + puzzle.id;
    show.addEventListener('click', () => track('Little Bones - Whole show'));
    links.appendChild(show);
    const song = el('a', '', 'Song page');
    song.href = songHref(puzzle.s);
    song.addEventListener('click', () => track('Little Bones - Song page'));
    links.appendChild(song);

    $('lbShareText').textContent = shareText();
    renderStats();
    startCountdown();
  }

  function renderAll() {
    $('lbNo').textContent = 'Puzzle No. ' + puzzleNo + puzzleNote(yesterdays ? "yesterday's" : '');
    $('lbPoints').textContent = today.done ? todayPoints() : today.won ? LADDER[today.wonAt] : LADDER[clip()];
    $('lbGuessForm').hidden = today.done || today.won;
    $('lbYearForm').hidden = !yearOpen();
    $('lbGuessLabel').textContent = 'Name the song for ' + LADDER[clip()] + ' points';
    $('lbSkip').hidden = clip() === CLIPS.length - 1;
    renderPlayer();
    renderWrong();
    if (today.done) { $('lbMsg').textContent = ''; renderEnd(); }
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
  $('lbCopy').addEventListener('click', async () => {
    const btn = $('lbCopy');
    const ok = await copyText(shareText());
    track('Little Bones - Shared');
    btn.textContent = ok ? 'Copied!' : 'Copy failed - select the text above';
    setTimeout(() => { btn.textContent = 'Copy my score'; }, 2000);
  });
  if (navigator.share) {
    $('lbShare').hidden = false;
    $('lbShare').addEventListener('click', () => {
      navigator.share({ text: shareText() }).then(() => track('Little Bones - Shared')).catch(() => { /* cancelled */ });
    });
  }

  // ─── Score card (image) ───
  // Same three sizes as the other games. No spoilers: never the song, the show or the year.
  const FORMATS = {
    facebook: { w: 1200, h: 630, file: 'facebook' },
    instagram: { w: 1080, h: 1350, file: 'instagram' },
    story: { w: 1080, h: 1920, file: 'instagram-story' },
  };
  let cardFormat = 'facebook';
  let currentCard = null; // { blob, url, format }
  const cardFile = () => 'little-bones-' + puzzleNo + '-' + FORMATS[cardFormat].file + '.png';

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
    // One bar per clip, as wide as the clip is long: gold where you got it, red for a miss,
    // an outline if never needed
    const bars = (left, top, width, height) => {
      const total = CLIPS.reduce((a, b) => a + b, 0), gap = 10, room = width - gap * (CLIPS.length - 1);
      let at = left;
      CLIPS.forEach((len, i) => {
        const w = Math.max(14, room * len / total);
        x.beginPath();
        if (x.roundRect) x.roundRect(at, top, w, height, 8); else x.rect(at, top, w, height);
        if (i < today.guesses.length) { x.fillStyle = today.won && i === today.wonAt ? '#CCA23C' : '#C8102E'; x.fill(); }
        else { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3; x.stroke(); }
        at += w + gap;
      });
    };

    const score = String(todayPoints());
    const yr = today.won ? (today.year && today.year.pts === YEAR_EXACT ? ', year bang on' : today.year && today.year.pts ? ', year close' : '') : '';
    const result = !today.won
      ? (name ? name + " didn't get it today" : "Didn't get it today")
      : (name ? name + ' got it on clip ' : 'Got it on clip ') + (today.wonAt + 1) + ' of ' + CLIPS.length + yr;
    const s = store.stats;
    const statLine = 'Streak ' + shownStreak() + '   |   Win rate ' + (s.played ? Math.round(100 * s.won / s.played) : 0) + '%';
    const totalLine = 'Total: ' + s.points.toLocaleString('en-CA') + ' points';
    const blurb = 'Name the song by The Hip from a few seconds live';

    if (landscape) {
      put('\u{1F3B5}', 330, 130, '700', 60, '#ffffff');
      put(NAME.toUpperCase(), 330, 186, '700', 30, '#ffffff', '4px', 540);
      put('PUZZLE NO. ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), 330, 232, '700', 26, '#929292', '6px', rerunOf ? 540 : 0);
      put(score, 330, 420, '900', 190, '#ffffff', '0px', 540);
      put('POINTS', 330, 492, '700', 40, '#ffffff', '10px');
      x.strokeStyle = 'rgba(204,162,60,0.3)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(650, 120); x.lineTo(650, 520); x.stroke();
      put(result, 690, 210, '700', 38, '#ffffff', '0px', 460, 'left');
      bars(690, 250, 450, 60);
      put(totalLine, 690, 385, '700', 34, '#ffffff', '0px', 460, 'left');
      put(statLine, 690, 435, '600', 28, '#d9d9d9', '0px', 460, 'left');
      put(blurb, 690, 480, '600', 22, '#929292', '0px', 460, 'left');
      put(SHARE_URL, W / 2, 585, '600', 24, '#929292', '2px', W - 120);
    } else {
      const y = story
        ? { icon: 360, label: 450, no: 525, score: 880, pts: 970, result: 1090, bars: 1150, total: 1395, stats: 1465, blurb: 1530, site: 1640 }
        : { icon: 160, label: 232, no: 290, score: 590, pts: 668, result: 768, bars: 820, total: 1036, stats: 1100, blurb: 1160, site: 1250 };
      put('\u{1F3B5}', W / 2, y.icon, '700', story ? 110 : 96, '#ffffff');
      put(NAME.toUpperCase(), W / 2, y.label, '700', 44, '#ffffff', '4px', W - 160);
      put('PUZZLE NO. ' + puzzleNo + (rerunOf ? ' - RERUN' : ''), W / 2, y.no, '700', 36, '#929292', '6px', rerunOf ? W - 160 : 0);
      put(score, W / 2, y.score, '900', story ? 330 : 290, '#ffffff', '0px', W - 160);
      put('POINTS', W / 2, y.pts, '700', story ? 64 : 56, '#ffffff', '12px');
      put(result, W / 2, y.result, '700', story ? 54 : 48, '#ffffff', '0px', W - 160);
      bars(140, y.bars, W - 280, story ? 110 : 100);
      put(totalLine, W / 2, y.total, '700', story ? 52 : 48, '#ffffff', '0px', W - 160);
      put(statLine, W / 2, y.stats, '600', story ? 42 : 38, '#d9d9d9', '0px', W - 160);
      put(blurb, W / 2, y.blurb, '600', story ? 34 : 30, '#929292', '0px', W - 160);
      put(SHARE_URL, W / 2, y.site, '600', 32, '#929292', '2px', W - 140);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (currentCard) URL.revokeObjectURL(currentCard.url);
    currentCard = { blob, url: URL.createObjectURL(blob), format: cardFormat };
    const img = $('lbCardImg');
    img.src = currentCard.url;
    img.alt = NAME + ', puzzle ' + puzzleNo + (rerunOf ? ' (a rerun of puzzle ' + rerunOf + ')' : '') + ': ' + result + '. ' + score + ' points today. ' + totalLine + '. ' + statLine.replace(/\s+\|\s+/, '. ') + '.';
    img.className = 'bia-card-img bia-card-' + cardFormat;
    $('lbCardWrap').hidden = false;
    const file = new File([blob], cardFile(), { type: 'image/png' });
    $('lbCardShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    track('Little Bones - Card made - ' + cardFormat);
  }

  $('lbMakeCard').addEventListener('click', () => { if (today.done) makeCard(); });
  document.querySelectorAll('.bia-fmt').forEach(btn => btn.addEventListener('click', () => {
    cardFormat = btn.dataset.format;
    document.querySelectorAll('.bia-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (today.done && currentCard) makeCard();
  }));
  $('lbCardSave').addEventListener('click', () => {
    if (!currentCard) return;
    const a = el('a');
    a.href = currentCard.url;
    a.download = cardFile();
    document.body.appendChild(a); a.click(); a.remove();
    track('Little Bones - Card saved');
  });
  $('lbCardShare').addEventListener('click', async () => {
    if (!currentCard) return;
    const file = new File([currentCard.blob], cardFile(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: NAME + ' No. ' + puzzleNo + rerunTag, text: shareText() });
      track('Little Bones - Card shared');
    } catch (e) { /* cancelled */ }
  });

  // ─── Countdown to the next clip (midnight Toronto time) ───
  let timer = null;
  const behind = () => !forcedDay && naturalPuzzleNo() > puzzleNo;
  function startCountdown() {
    if (timer) return;
    const staleAtStart = behind();
    const box = $('lbCountdown').parentNode;
    const tick = () => {
      if (behind()) {
        if (!staleAtStart) { location.reload(); return; }
        if (!box.querySelector('a')) {
          box.textContent = 'A new clip is out. ';
          const a = el('a', '', 'Play it now');
          a.href = location.pathname;
          box.appendChild(a);
        }
        return;
      }
      const left = Math.max(0, Math.round(msUntilDay(epochDay + puzzleNo) / 1000));
      const p = n => String(n).padStart(2, '0');
      $('lbCountdown').textContent = p(Math.floor(left / 3600)) + ':' + p(Math.floor(left / 60) % 60) + ':' + p(left % 60);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Phone left open overnight: new day, new clip. Never in the middle of a game, though.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && behind() && (today.done || !today.started)) location.reload();
  });

  save();
  renderAll();
  if (yesterdays) $('lbMsg').textContent = "Yesterday's clip is still open - finish it, then today's is waiting.";
  $('lbLoading').hidden = true;
  $('lbGame').hidden = false;
})();
