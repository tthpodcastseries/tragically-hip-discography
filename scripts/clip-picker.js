// scripts/clip-picker.js - jD's local tool for 'Little Bones' clip start points.
// Reads data/clip-pool.json and data/clip-starts.json, plays each clip from its start point
// (the hand-set one, or 30% in like the game), and writes a new clip-starts.json to copy or
// download. It saves nothing by itself: paste the result into data/clip-starts.json and run
// node scripts/build-clip-pool.js.
(async function () {
  const $ = id => document.getElementById(id);
  const AUDIO_BASE = 'https://f006.backblazeb2.com/file/tth-audio';
  const DEFAULT_START = 0.3; // same as js/little-bones.js
  const LISTEN = 30; // seconds each preview plays: the longest clip in the game
  const PAGE = 20;

  const [pool, hand] = await Promise.all([
    fetch('/data/clip-pool.json').then(r => r.json()),
    fetch('/data/clip-starts.json').then(r => r.json()).catch(() => ({ starts: {}, skip: [] })),
  ]);
  const starts = { ...(hand.starts || {}) };
  const skip = new Set(hand.skip || []);
  const original = JSON.stringify({ starts, skip: [...skip].sort() });
  const keyOf = p => p.s + '@' + p.id;
  const durations = {};

  const audio = new Audio();
  let playingKey = null, stopAt = 0, frame = 0;
  const fmt = s => s == null ? '?' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + Math.floor((s * 10) % 10);
  const startOf = p => typeof starts[keyOf(p)] === 'number' ? starts[keyOf(p)] : (durations[keyOf(p)] ? durations[keyOf(p)] * DEFAULT_START : null);

  function stop() {
    playingKey = null;
    cancelAnimationFrame(frame);
    audio.pause();
    render();
  }
  async function play(p) {
    const k = keyOf(p);
    if (playingKey === k) { stop(); return; }
    stop();
    playingKey = k;
    audio.src = AUDIO_BASE + '/' + p.u.split('/').map(encodeURIComponent).join('/');
    await new Promise(res => audio.addEventListener('loadedmetadata', res, { once: true }));
    durations[k] = audio.duration;
    const at = startOf(p);
    audio.currentTime = at;
    stopAt = at + LISTEN;
    await audio.play();
    const tick = () => {
      if (playingKey !== k) return;
      if (audio.currentTime >= stopAt || audio.ended) { stop(); return; }
      const now = document.querySelector('[data-key="' + CSS.escape(k) + '"] .cp-now');
      if (now) now.textContent = 'playing ' + fmt(audio.currentTime) + ' (+' + (audio.currentTime - at).toFixed(1) + 's)';
      frame = requestAnimationFrame(tick);
    };
    render();
    tick();
  }
  function setStart(p, s) {
    const d = durations[keyOf(p)];
    starts[keyOf(p)] = Math.max(0, Math.round((d ? Math.min(s, d - LISTEN - 1) : s) * 10) / 10);
    if (playingKey === keyOf(p)) { stopAt = starts[keyOf(p)] + LISTEN; audio.currentTime = starts[keyOf(p)]; }
    render();
  }

  function button(label, fn, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', fn);
    return b;
  }
  function render() {
    const from = Math.max(1, +$('cpFrom').value || 1);
    const list = $('cpList');
    list.textContent = '';
    list.start = from;
    pool.puzzles.slice(from - 1, from - 1 + PAGE).forEach((p, i) => {
      const k = keyOf(p);
      const li = document.createElement('li');
      li.className = 'cp-item' + (skip.has(k) ? ' skipped' : '') + (k in starts ? ' changed' : '');
      li.dataset.key = k;
      const head = document.createElement('div');
      head.className = 'cp-head';
      const no = document.createElement('b'); no.textContent = 'No. ' + (from + i) + ' - ' + p.t; head.appendChild(no);
      const where = document.createElement('span'); where.textContent = p.d + ' - ' + p.pl; head.appendChild(where);
      li.appendChild(head);
      const tools = document.createElement('div');
      tools.className = 'cp-tools';
      tools.appendChild(button(playingKey === k ? 'Stop' : 'Play 30s', () => play(p), 'cp-play'));
      const at = document.createElement('span');
      at.className = 'cp-at';
      at.textContent = 'starts ' + fmt(startOf(p)) + (k in starts ? ' (set)' : ' (30% in)');
      tools.appendChild(at);
      [-5, -1, 1, 5].forEach(n => tools.appendChild(button((n > 0 ? '+' : '') + n + 's', () => { if (startOf(p) == null) return; setStart(p, startOf(p) + n); })));
      tools.appendChild(button('Start here', () => { if (playingKey === k) setStart(p, audio.currentTime); }));
      tools.appendChild(button('Reset', () => { delete starts[k]; render(); }));
      tools.appendChild(button(skip.has(k) ? 'Unskip' : 'Skip tape', () => { skip.has(k) ? skip.delete(k) : skip.add(k); render(); }));
      const now = document.createElement('span');
      now.className = 'cp-now cp-at';
      tools.appendChild(now);
      li.appendChild(tools);
      list.appendChild(li);
    });
    $('cpCount').textContent = pool.puzzles.length + ' puzzles';
    const out = { about: hand.about || '', starts, skip: [...skip].sort() };
    $('cpOut').textContent = JSON.stringify(out, null, 2) + '\n';
    $('cpChanged').textContent = JSON.stringify({ starts, skip: [...skip].sort() }) === original ? 'No changes yet.' : 'Changed - copy this into data/clip-starts.json, then run node scripts/build-clip-pool.js.';
  }

  $('cpFrom').addEventListener('change', render);
  $('cpPrev').addEventListener('click', () => { $('cpFrom').value = Math.max(1, (+$('cpFrom').value || 1) - PAGE); render(); });
  $('cpNext').addEventListener('click', () => { $('cpFrom').value = Math.min(pool.puzzles.length, (+$('cpFrom').value || 1) + PAGE); render(); });
  $('cpCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('cpOut').textContent); $('cpCopy').textContent = 'Copied!'; } catch (e) { $('cpCopy').textContent = 'Select the text and copy'; }
    setTimeout(() => { $('cpCopy').textContent = 'Copy'; }, 2000);
  });
  $('cpSave').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('cpOut').textContent], { type: 'application/json' }));
    a.download = 'clip-starts.json';
    a.click();
  });
  render();
})();
