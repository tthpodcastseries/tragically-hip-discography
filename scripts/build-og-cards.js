#!/usr/bin/env node
// build-og-cards.js - one link-preview picture per song (SEO audit SEO-16, jD 2026-11-21).
//
// When a song link is shared on Facebook, Messenger or iMessage, the preview shows the
// song's own card instead of the same band photo on every song: its title, times played
// live, the plays-by-year bars, debut and latest, and the fan ranking. The card is the
// Facebook-size one each song page already makes with "Make the card" (js/song.js,
// makeCard), so there is one design, not two.
//
// How: serves the site on 127.0.0.1, opens every song page in headless Google Chrome
// (driven over its DevTools socket with Node's built-in WebSocket: no packages), presses
// "Make the card", and saves the picture as a JPEG (macOS sips) in
// assets-optimized/og/song/<slug>-<fingerprint>.jpg. The fingerprint changes when the
// song's data or the card code changes, because images are cached for a week (_headers):
// a changed card must get a new name. Old pictures are deleted.
//
// data/og-cards.json lists each song's picture and its alt text; scripts/build-seo-pages.js
// reads it and puts the picture in the song page's og:image. Run this before it:
//
//   node scripts/build-og-cards.js            make missing or changed cards (jD's Mac only)
//   node scripts/build-og-cards.js --check    only list what would be made (no Chrome)
//   node scripts/build-og-cards.js --force    make every card again
//   node scripts/build-og-cards.js --only bobcaygeon,poets
//   then: node scripts/build-seo-pages.js
//
// Needs Google Chrome in /Applications (or CHROME=/path/to/chrome) and macOS sips.
// Node 22, no packages.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = 'assets-optimized/og/song';
const MANIFEST = 'data/og-cards.json';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const JPEG_QUALITY = 82;
const CHECK = process.argv.includes('--check');
const FORCE = process.argv.includes('--force');
const onlyArg = (process.argv.find(a => a.startsWith('--only')) || '').split('=')[1] || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '');
const ONLY = onlyArg ? new Set(onlyArg.split(',')) : null;

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

// ---- What each card shows, so an unchanged card is never made again ----
const index = JSON.parse(read('data/song-index.json'));
const songJs = read('js/song.js');
const cardCode = (songJs.match(/\/\/ ─── Share card[\s\S]*?\$\('spMakeCard'\)\.addEventListener/) || [])[0];
if (!cardCode) { console.error('STOPPED - the share card code was not found in js/song.js (look for "// ─── Share card").'); process.exit(1); }
const codeHash = sha(cardCode);
const fingerprint = song => sha(codeHash + JSON.stringify({
  t: song.t, s: song.s, a: song.a, k: song.k || null,
  plays: song.p.map(i => index.shows[i][1]),
})).slice(0, 10);

const manifest = fs.existsSync(path.join(ROOT, MANIFEST)) ? JSON.parse(read(MANIFEST)) : { cards: {} };
const wanted = index.songs.map(song => ({ song, fp: fingerprint(song), file: OUT_DIR + '/' + song.s + '-' + fingerprint(song) + '.jpg' }));
const todo = wanted.filter(w => {
  if (ONLY && !ONLY.has(w.song.s)) return false;
  const had = manifest.cards[w.song.s];
  return FORCE || !had || had.file !== w.file || !fs.existsSync(path.join(ROOT, w.file));
});

if (CHECK) {
  if (!todo.length) { console.log('OK: all ' + wanted.length + ' song cards are current.'); process.exit(0); }
  console.log(todo.length + ' of ' + wanted.length + ' song cards would be made: ' + todo.slice(0, 12).map(w => w.song.s).join(', ') + (todo.length > 12 ? ', ...' : ''));
  process.exit(1);
}

// ---- A small static server, the way Netlify serves the site ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    let f = path.join(ROOT, p);
    if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---- Headless Chrome over the DevTools socket ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function startChrome() {
  if (!fs.existsSync(CHROME)) { console.error('STOPPED - Google Chrome not found at ' + CHROME + ' (set CHROME=/path/to/chrome).'); process.exit(1); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-og-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) { proc.kill(); console.error('STOPPED - Chrome did not start.'); process.exit(1); }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const target = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map(), waiters = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.ok(m.result); }
    else if (m.method) waiters.filter(w => w.method === m.method).forEach(w => { waiters.splice(waiters.indexOf(w), 1); w.ok(m.params); });
  };
  const send = (method, params) => new Promise((ok, fail) => { const n = ++id; pending.set(n, { ok, fail }); ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
  const once = method => new Promise(ok => waiters.push({ method, ok }));
  // Wait for Chrome to exit before deleting its profile, or it is still writing there
  const stop = async () => {
    try { ws.close(); } catch (e) { /* closing anyway */ }
    const exited = new Promise(ok => proc.once('exit', ok));
    proc.kill();
    await Promise.race([exited, sleep(5000)]);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* a temp folder; the system clears it */ }
  };
  return { send, once, stop };
}

// In the page: wait for the song to draw, press "Make the card", hand back the picture and its alt text
const IN_PAGE = `(async () => {
  const $ = id => document.getElementById(id);
  for (let i = 0; i < 200 && $('spSong').hidden && $('spError').hidden; i++) await new Promise(r => setTimeout(r, 50));
  if (!$('spError').hidden) throw new Error('song data did not load');
  const img = $('spCardImg');
  $('spMakeCard').click();
  for (let i = 0; i < 200 && !String(img.src).startsWith('blob:'); i++) await new Promise(r => setTimeout(r, 50));
  if (!String(img.src).startsWith('blob:')) throw new Error('no card was made');
  const blob = await fetch(img.src).then(r => r.blob());
  const data = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(blob); });
  return { data, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight };
})()`;

(async () => {
  fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true });
  if (todo.length) {
    const server = await serve();
    const base = 'http://127.0.0.1:' + server.address().port;
    const chrome = await startChrome();
    await chrome.send('Page.enable');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-og-png-'));
    let made = 0;
    try {
      for (const w of todo) {
        const loaded = chrome.once('Page.loadEventFired');
        await chrome.send('Page.navigate', { url: base + '/song/' + w.song.s });
        await loaded;
        const r = await chrome.send('Runtime.evaluate', { expression: IN_PAGE, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(w.song.s + ': ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
        const card = r.result.value;
        if (card.w !== 1200 || card.h !== 630) throw new Error(w.song.s + ': card is ' + card.w + 'x' + card.h + ', not 1200x630');
        const png = path.join(tmp, w.song.s + '.png');
        fs.writeFileSync(png, Buffer.from(card.data.split(',')[1], 'base64'));
        const conv = spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY), png, '--out', path.join(ROOT, w.file)], { encoding: 'utf8' });
        if (conv.status !== 0) throw new Error(w.song.s + ': sips could not make the JPEG: ' + conv.stderr);
        manifest.cards[w.song.s] = { file: w.file, alt: card.alt };
        made++;
        if (made % 20 === 0) console.log('  ' + made + ' of ' + todo.length + ' cards made');
      }
    } finally {
      await chrome.stop();
      server.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(made + ' card(s) made.');
  }

  // Keep only current songs, sorted, and delete pictures nothing points to
  const cards = {};
  for (const w of wanted) if (manifest.cards[w.song.s] && fs.existsSync(path.join(ROOT, manifest.cards[w.song.s].file))) cards[w.song.s] = manifest.cards[w.song.s];
  fs.writeFileSync(path.join(ROOT, MANIFEST), JSON.stringify({ note: 'Written by scripts/build-og-cards.js - never edit by hand', cards }, null, 1) + '\n');
  const keep = new Set(Object.values(cards).map(c => path.basename(c.file)));
  let removed = 0;
  for (const f of fs.readdirSync(path.join(ROOT, OUT_DIR))) if (!keep.has(f)) { fs.unlinkSync(path.join(ROOT, OUT_DIR, f)); removed++; }
  const bytes = [...keep].reduce((n, f) => n + fs.statSync(path.join(ROOT, OUT_DIR, f)).size, 0);
  console.log(Object.keys(cards).length + ' of ' + wanted.length + ' songs have a card (' + (bytes / 1048576).toFixed(1) + ' MB); ' + removed + ' old picture(s) removed. Next: node scripts/build-seo-pages.js');
})().catch(e => { console.error('STOPPED - ' + e.message); process.exit(1); });
