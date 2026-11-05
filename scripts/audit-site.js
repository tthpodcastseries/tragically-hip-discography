#!/usr/bin/env node
// audit-site.js - The Hip Handbook full-site audit
//
// Checks (no external dependencies, Node 18+):
//   1. Internal links/assets referenced by every HTML page exist on disk
//   2. Service worker CORE_ASSETS all exist, none over 250 KB (first-visit
//      download), and CACHE_NAME matches the footer version
//   3. manifest.json icons exist
//   4. sitemap.xml entries map to real pages
//   5. Data cross-references: show-video orphans, AppleDouble junk tracks,
//      empty lyrics, unplucked-gems imagePaths
//   6. External links in page chrome respond (skipped with --no-network)
//      and every (Un)Locked puzzle's song still in song-index.json
//   7. Every external image host used by pages/scripts/data is allowed by
//      the CSP img-src in _headers (localhost ignores _headers, so a
//      missing host only breaks on the live site)
//   8. Every page has the home-screen tags (mobile-web-app-capable, and a
//      status bar that doesn't draw the page under the iPhone clock)
//   9. The CSP stays strict: no 'unsafe-inline' scripts, no inline <script> or
//      on...= handlers in pages or built HTML, outside script hosts allowed, no Google Fonts
//  10. Pre-push safety net (v5.4.18): every data file parses and every script passes
//      node --check; fetched data files exist; recordings, setlists and lyrics never
//      shrink; page counts match the data (build-site-stats.js); every setlist song is
//      on the song list; no scheduled puzzle moved (vs the committed lock, the last commit,
//      the last push and, on Netlify, the last deploy); no em or en dashes fans can read;
//      footer, cache name and changelog agree
//  11. No "<" in any data text field; the album lists in js/discography-app.js match
//      data/discography.json; warns when this Node isn't the .nvmrc version
//
// Run before every push (Node 22). Netlify also runs it as the build command
// (netlify.toml), so a failure stops the deploy and the live site stays as it was.
//   node scripts/audit-site.js --no-network     (the pre-push check, a few seconds)
//   node scripts/audit-site.js                  (also tests outside links; the weekly job)
//   --game-ref <ref>   also compare the game schedules with that commit (GitHub uses it)
// Exit code 0 = clean, 1 = problems found.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NO_NETWORK = process.argv.includes('--no-network');
const problems = [];
const warnings = [];
const notes = [];

// 200 rewrites in _redirects (e.g. /setlists -> /discography.html) count as
// real pages as long as their destination file exists (v4.7)
const rewrites = new Map();
const wildcardRewrites = []; // [prefix, destination], e.g. /song/* -> /song.html (v5.1)
for (const line of fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n')) {
  const [from, to, status] = line.trim().split(/\s+/);
  if (!from || !from.startsWith('/') || status !== '200') continue;
  if (!from.includes('*')) rewrites.set(from, to);
  else if (from.endsWith('/*')) wildcardRewrites.push([from.slice(0, -1), to]);
}
const wildcardTarget = pathname => { const w = wildcardRewrites.find(([prefix]) => pathname.startsWith(prefix)); return w ? w[1] : null; };

function existsLocal(ref) {
  const clean = decodeURIComponent(ref.split('#')[0].split('?')[0]).replace(/^\//, '');
  if (!clean) return true;
  if (rewrites.has('/' + clean)) return fs.existsSync(path.join(ROOT, rewrites.get('/' + clean).replace(/^\//, '')));
  const wild = wildcardTarget('/' + clean);
  if (wild) return fs.existsSync(path.join(ROOT, wild.replace(/^\//, '')));
  // Netlify also serves /lyrics from lyrics.html (v5.4.12)
  if (!path.extname(clean) && fs.existsSync(path.join(ROOT, clean + '.html'))) return true;
  return fs.existsSync(path.join(ROOT, clean));
}

// ---- 1. Internal refs in HTML pages ----
// The Radio Show show pages live in podcasts/ (v5.7, scripts/build-podcasts.js)
const pages = [...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...(fs.existsSync(path.join(ROOT, 'podcasts')) ? fs.readdirSync(path.join(ROOT, 'podcasts')).filter(f => f.endsWith('.html')).map(f => 'podcasts/' + f) : [])];
const externals = new Set();
for (const page of pages) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const m of src.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const r = m[1];
    // Skip preconnect/dns-prefetch hints - bare origins, not fetchable pages
    const tagStart = src.lastIndexOf('<', m.index);
    const tag = src.slice(tagStart, src.indexOf('>', m.index) + 1);
    if (/rel=["'](?:preconnect|dns-prefetch)["']/.test(tag)) continue;
    // The site's own canonical/og addresses are checked against the local files, so a new
    // page doesn't fail the audit before it has been pushed (v5.4.17)
    const own = r.match(/^https:\/\/thehiphandbook\.tthpods\.com(\/[^#?]*)?/);
    if (own) { if (!existsLocal(own[1] || '/')) problems.push(`${page}: own-site address has no local file -> ${r}`); }
    else if (/^https?:\/\//.test(r)) externals.add(r);
    else if (/^(mailto:|data:|#|javascript:|tel:|\$\{)/.test(r)) continue;
    else if (!existsLocal(r)) problems.push(`${page}: missing internal ref -> ${r}`);
  }
}
notes.push(`${pages.length} pages scanned for internal refs`);

// ---- 2. Service worker precache ----
const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
const coreBlock = sw.slice(0, sw.indexOf('];'));
for (const m of coreBlock.matchAll(/'(\/[^']+)'/g)) {
  if (m[1] !== '/' && !existsLocal(m[1])) problems.push(`service-worker CORE_ASSETS: missing -> ${m[1]}`);
  else if (m[1] !== '/' && fs.statSync(path.join(ROOT, m[1])).size > 250 * 1024) problems.push(`service-worker CORE_ASSETS: ${m[1]} is over 250 KB (every first visit downloads it; let the page cache it on use)`);
}
const swVersion = (sw.match(/CACHE_NAME = '[a-z]+-(v[\d.]+)'/) || [])[1];
const footerVersion = (fs.readFileSync(path.join(ROOT, 'js/shared-footer.js'), 'utf8').match(/var version = '(v[\d.]+)/) || [])[1];
if (!swVersion || swVersion !== footerVersion) problems.push(`service-worker CACHE_NAME version (${swVersion}) doesn't match the footer version in js/shared-footer.js (${footerVersion})`);

// ---- 3. Manifest icons ----
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
for (const icon of manifest.icons || []) {
  if (!existsLocal(icon.src)) problems.push(`manifest.json: missing icon -> ${icon.src}`);
}

// ---- 4. Sitemap ----
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const pathname = new URL(m[1]).pathname;
  if (rewrites.has(pathname) || wildcardTarget(pathname)) {
    if (!existsLocal(pathname)) problems.push(`sitemap.xml: rewrite target missing for -> ${m[1]}`);
    continue;
  }
  let p = pathname.replace(/^\//, '') || 'index.html';
  if (!p.endsWith('.html')) p += '.html';
  if (!fs.existsSync(path.join(ROOT, p))) problems.push(`sitemap.xml: no local page for -> ${m[1]}`);
}

// ---- 5. Data cross-references ----
const tour = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tth-tour-data.json'), 'utf8'));
const tourIds = new Set(tour.map(g => g.id));

const junk = tour.flatMap(g => g.tracks || []).filter(t => (t.filename || '').startsWith('._'));
if (junk.length) problems.push(`tth-tour-data.json: ${junk.length} AppleDouble ._* junk tracks`);

const sv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/show-videos.json'), 'utf8'));
const orphans = Object.keys(sv.byShow || {}).filter(id => !tourIds.has(id));
if (orphans.length) problems.push(`show-videos.json: ${orphans.length} orphaned show ids`);

const lyrics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lyrics.json'), 'utf8'));
const emptyLyrics = Object.entries(lyrics.songs).filter(([, v]) => !v || !v.trim());
if (emptyLyrics.length) problems.push(`lyrics.json: ${emptyLyrics.length} empty lyric entries`);

const ug = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/unplucked-gems.json'), 'utf8'));
for (const era of ug.eras) {
  if (era.imagePath && !existsLocal(era.imagePath)) {
    problems.push(`unplucked-gems.json: missing image -> ${era.imagePath} (${era.era})`);
  }
}
notes.push(`data cross-refs: ${tour.length} shows, ${Object.keys(sv.byShow || {}).length} video mappings, ${Object.keys(lyrics.songs).length} lyrics, ${ug.eras.length} gem eras`);

// (Un)Locked: a puzzle whose song slug is gone from song-index.json can't be won (v5.4.9, GAME-12)
const songSlugs = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/song-index.json'), 'utf8')).songs.map(so => so.s));
const trunk = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/trunk-pool.json'), 'utf8'));
const unwinnable = trunk.puzzles.map((p, i) => [p, i]).filter(([p]) => !songSlugs.has(p.s));
for (const [p, i] of unwinnable) problems.push(`trunk-pool.json: puzzle #${i + 1} '${p.t}' has slug ${p.s}, which is not in song-index.json (unwinnable)`);
const unguessable = trunk.puzzles.filter(p => !trunk.titles.some(([s]) => s === p.s));
if (unguessable.length) problems.push(`trunk-pool.json: ${unguessable.length} puzzles whose answer is missing from the guess list`);

// Little Bones: same checks, plus every clip has an audio file
const clips = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clip-pool.json'), 'utf8'));
clips.puzzles.forEach((p, i) => {
  if (!songSlugs.has(p.s)) problems.push(`clip-pool.json: puzzle #${i + 1} '${p.t}' has slug ${p.s}, which is not in song-index.json (unwinnable)`);
  if (!clips.titles.some(([s]) => s === p.s)) problems.push(`clip-pool.json: puzzle #${i + 1} '${p.t}' is missing from the guess list`);
  if (!p.u || !/^\d{4}-\d{2}-\d{2}$/.test(p.d || '')) problems.push(`clip-pool.json: puzzle #${i + 1} '${p.t}' has no audio file or show date`);
});

// Are We Family (edited by hand): four groups of four, sixteen different songs, every title
// exactly as on the official song list, and a hidden word that really is in its title
{
  const songTitles = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/song-index.json'), 'utf8')).songs.map(so => so.t));
  const fam = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/family-puzzles.json'), 'utf8'));
  fam.puzzles.forEach((p, i) => {
    const at = `family-puzzles.json: puzzle #${i + 1}`;
    if (!Array.isArray(p.groups) || p.groups.length !== 4 || p.groups.some(g => !g.label || !Array.isArray(g.songs) || g.songs.length !== 4)) { problems.push(`${at} needs 4 groups, each with a label and 4 songs`); return; }
    const all = p.groups.flatMap(g => g.songs);
    if (new Set(all).size !== 16) problems.push(`${at} uses a song twice`);
    all.filter(t => !songTitles.has(t)).forEach(t => problems.push(`${at}: '${t}' is not a title on the official song list (check the spelling)`));
    p.groups.forEach(g => Object.entries(g.hl || {}).forEach(([t, w]) => {
      if (!g.songs.includes(t)) problems.push(`${at}: hl names '${t}', which isn't in the group "${g.label}"`);
      else if (!t.toLowerCase().replace(/[^a-z]/g, '').includes(String(w).toLowerCase())) problems.push(`${at}: '${w}' isn't hidden in '${t}'`);
    }));
  });
  notes.push(`games: ${clips.puzzles.length} Little Bones clips, ${fam.puzzles.length} Are We Family puzzles checked`);
}

// Words Into Birds (edited by hand, grids from scripts/build-bird-grids.js): exactly 20 clues,
// answers in capital letters, word lengths that add up, and a grid that really holds together:
// every answer fits, crossing letters agree, nothing touches side by side by accident, the whole
// grid is joined up, and it is at most 15 squares wide so it fits a phone
{
  const birds = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bird-puzzles.json'), 'utf8'));
  // An answer can come back, but not within a month: at least 5 puzzles (35 days) after its
  // last use (jD, 2026-11-05)
  const REPEAT_GAP = 5;
  const seen = new Map(); // answer -> last puzzle number it was in
  birds.puzzles.forEach((p, i) => {
    const at = `bird-puzzles.json: puzzle ${i + 1}`;
    const cl = Array.isArray(p.clues) ? p.clues : [];
    if (cl.length !== 20) { problems.push(`${at} has ${cl.length} clues; every puzzle has exactly 20`); return; }
    if (!p.rows || !p.cols) { problems.push(`${at} has no grid yet: run node scripts/build-bird-grids.js`); return; }
    if (p.cols > 15) problems.push(`${at} is ${p.cols} squares wide; 15 is the most that fits a phone`);
    const grid = new Map(); // "r,c" -> { ch, across, down }
    let broken = false;
    cl.forEach(c => {
      const who = `${at}, ${c.num} ${c.dir === 'across' ? 'Across' : 'Down'}`;
      if (!/^[A-Z]{3,}$/.test(c.answer || '')) { problems.push(`${who}: answer "${c.answer}" must be capital letters only, 3 or more`); broken = true; return; }
      const lens = String(c.enum || '').split(/\s*,\s*/).map(Number);
      if (lens.some(n => !n) || lens.reduce((a, b) => a + b, 0) !== c.answer.length) problems.push(`${who}: word lengths (${c.enum}) don't add up to ${c.answer.length} letters`);
      if (!c.clue || /[#<\u2013\u2014]/.test(c.clue)) problems.push(`${who}: clue is missing, or has a "#", a "<", or a long dash`);
      if (seen.has(c.answer) && i + 1 - seen.get(c.answer) < REPEAT_GAP) problems.push(`${who}: ${c.answer} was an answer in puzzle ${seen.get(c.answer)}; an answer can only come back ${REPEAT_GAP} or more puzzles later (more than a month)`);
      seen.set(c.answer, i + 1);
      if (c.dir !== 'across' && c.dir !== 'down') { problems.push(`${who}: dir must be across or down`); broken = true; return; }
      for (let k = 0; k < c.answer.length; k++) {
        const r = c.row + (c.dir === 'down' ? k : 0), col = c.col + (c.dir === 'across' ? k : 0);
        if (r < 0 || col < 0 || r >= p.rows || col >= p.cols) { problems.push(`${who}: runs off the grid`); broken = true; return; }
        const id = r + ',' + col, g = grid.get(id) || {};
        if (g.ch && g.ch !== c.answer[k]) { problems.push(`${who}: letter ${k + 1} (${c.answer[k]}) clashes with ${g.ch} where it crosses`); broken = true; }
        if (g[c.dir]) { problems.push(`${who}: overlaps another ${c.dir} answer`); broken = true; }
        g.ch = c.answer[k]; g[c.dir] = c;
        grid.set(id, g);
      }
    });
    if (broken) return;
    // Any two squares next to each other must be part of one answer running that way
    for (const [id, g] of grid) {
      const [r, c] = id.split(',').map(Number);
      const right = grid.get(r + ',' + (c + 1)), below = grid.get((r + 1) + ',' + c);
      if (right && (!g.across || g.across !== right.across)) problems.push(`${at}: squares at row ${r + 1}, columns ${c + 1}-${c + 2} touch but aren't one answer (a stray word in the grid)`);
      if (below && (!g.down || g.down !== below.down)) problems.push(`${at}: squares at column ${c + 1}, rows ${r + 1}-${r + 2} touch but aren't one answer (a stray word in the grid)`);
    }
    // Joined up: every answer can be reached from the first one through crossings
    const reach = new Set([cl[0]]), todo = [cl[0]];
    while (todo.length) {
      const c = todo.pop();
      for (const g of grid.values()) if (g.across === c || g.down === c) for (const o of [g.across, g.down]) if (o && !reach.has(o)) { reach.add(o); todo.push(o); }
    }
    if (reach.size !== cl.length) problems.push(`${at}: the grid is in pieces (${cl.length - reach.size} answers don't connect to the rest)`);
    // Numbers in reading order, one per starting square
    const starts = [...new Set(cl.map(c => c.row * 1000 + c.col))].sort((a, b) => a - b);
    cl.forEach(c => { if (starts.indexOf(c.row * 1000 + c.col) + 1 !== c.num) problems.push(`${at}: ${c.answer} is numbered ${c.num}, but its square is number ${starts.indexOf(c.row * 1000 + c.col) + 1} in reading order`); });
  });
  notes.push(`games: ${birds.puzzles.length} Words Into Birds crossword(s) checked`);
}

// ---- 7. CSP img-src covers every external image host ----
const SITE_HOST = 'thehiphandbook.tthpods.com';
const headersSrc = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
const imgSrc = ((headersSrc.match(/img-src([^;]*)/) || [])[1] || '').trim().split(/\s+/);
const imgAllowed = host => imgSrc.some(s => {
  const h = s.replace(/^https?:\/\//, '');
  return h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h;
});
const imgScanFiles = [
  ...pages,
  ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !f.endsWith('.min.js')).map(f => 'js/' + f),
  ...fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f),
  ...fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.json')).map(f => 'data/' + f),
];
const imgHosts = new Map(); // host -> first file seen in
for (const f of imgScanFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/https:\/\/([a-z0-9.-]+)\/[^"'\s)]*\.(?:jpe?g|png|webp|gif|svg)\b/gi)) {
    const host = m[1].toLowerCase();
    if (host !== SITE_HOST && !imgHosts.has(host)) imgHosts.set(host, f);
  }
}
for (const [host, f] of imgHosts) {
  if (!imgAllowed(host)) problems.push(`_headers CSP img-src: ${host} not allowed (images from it are blocked live; first seen in ${f})`);
}
// Images made in the browser (canvas -> blob URL, like the Passport share card) need blob:
if (!imgSrc.includes('blob:')) {
  const blobUsers = imgScanFiles.filter(f => f.endsWith('.js') && /createObjectURL/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  if (blobUsers.length) problems.push(`_headers CSP img-src: blob: not allowed, but ${blobUsers.join(', ')} builds blob: image URLs (blocked live)`);
}
notes.push(`CSP img-src: ${imgHosts.size} external image host(s) checked`);

// ---- 8. Home-screen tags ----
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!/<meta name="mobile-web-app-capable" content="yes">/.test(html)) problems.push(`${page}: missing <meta name="mobile-web-app-capable" content="yes">`);
  if (/black-translucent/.test(html)) problems.push(`${page}: status bar style black-translucent puts the page under the iPhone clock in the home-screen app (use "black")`);
}

// ---- 8b. Light data files and WebP images (v5.4.16, audit PERF-03 to PERF-05) ----
const staleLight = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-light-data.js'), '--check'], { encoding: 'utf8' });
if (staleLight.status !== 0) problems.push(`data/on-this-day.json, tour-map.json or tour-tracks.json: ${(staleLight.stderr || staleLight.stdout || '').trim().split('\n').slice(-1)[0]}`);
const staleWebp = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-webp.js'), '--check'], { encoding: 'utf8' });
if (staleWebp.status !== 0) problems.push(`assets-optimized: ${(staleWebp.stderr || staleWebp.stdout || '').trim().split('\n')[0]}`);
// Pages show the WebP copies; JPEGs are only for link-preview tags
for (const page of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const jpgImgs = (html.match(/<img [^>]*src="[^"]*assets-optimized\/[^"]+\.jpe?g"/g) || []).length;
  if (jpgImgs) problems.push(`${page}: ${jpgImgs} <img> still shows a JPEG from assets-optimized (use the .webp)`);
}

// ---- 9. Link previews and search (v5.4.12) ----
// Preview robots read the raw HTML, so each route needs its own file with its own tags.
const stalePages = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-seo-pages.js'), '--check'], { encoding: 'utf8' });
if (stalePages.status !== 0) problems.push(`generated pages (song/*.html, lyrics.html, setlists.html, top-40.html) are out of date: ${(stalePages.stderr || stalePages.stdout || '').trim().split('\n').slice(-1)[0]}`);
const stalePods = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-podcasts.js'), '--check'], { encoding: 'utf8' });
if (stalePods.status !== 0) problems.push(`podcast pages (podcasts.html, podcasts/*.html) are out of date: ${(stalePods.stderr || stalePods.stdout || '').trim().split('\n').slice(-1)[0]}`);

// song.html is served at /song/<slug>, so a relative link in it points inside /song/
{
  const src = fs.readFileSync(path.join(ROOT, 'song.html'), 'utf8');
  for (const m of src.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    if (!/^(\/|https?:\/\/|mailto:|data:|#|tel:)/.test(m[1])) problems.push(`song.html: relative link "${m[1]}" breaks on /song/<slug> (use /${m[1]})`);
  }
}

const pageFiles = [...pages, ...(fs.existsSync(path.join(ROOT, 'song')) ? fs.readdirSync(path.join(ROOT, 'song')).filter(f => f.endsWith('.html')).map(f => 'song/' + f) : [])];
const canonicalOf = f => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
for (const f of pageFiles) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (/<meta name="robots" content="noindex/.test(html)) continue;
  const canon = canonicalOf(f);
  if (!canon) { problems.push(`${f}: no canonical tag`); continue; }
  if (!sitemapLocs.has(canon)) problems.push(`${f}: canonical ${canon} is not in sitemap.xml`);
  for (const tag of ['og:image:width', 'og:image:height', 'og:image:alt', 'og:image', 'og:title', 'og:description', 'og:url']) {
    if (!html.includes(`property="${tag}"`)) problems.push(`${f}: missing ${tag}`);
  }
  if (!html.includes('name="twitter:card"')) problems.push(`${f}: missing twitter:card`);
  if (f.startsWith('song/') && !/<h1 id="spTitle">[^<$]+<\/h1>/.test(html)) problems.push(`${f}: song title missing from the page body`);
  if (canon !== (html.match(/<meta property="og:url" content="([^"]+)">/) || [])[1]) problems.push(`${f}: og:url differs from canonical`);
  // Brand guide: never 'Tragically Hip' without 'The' in the text a link preview shows
  for (const m of html.matchAll(/<(?:title>([^<]*)<|meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)")/g)) {
    const text = m[1] || m[2] || '';
    if (/(?<![Tt]he )Tragically Hip/.test(text)) problems.push(`${f}: preview text says 'Tragically Hip' without 'The': ${text.slice(0, 80)}`);
  }
}
for (const loc of sitemapLocs) {
  const pathname = new URL(loc).pathname;
  const file = rewrites.has(pathname) ? rewrites.get(pathname).replace(/^\//, '')
    : pathname.startsWith('/song/') ? pathname.slice(1) + '.html'
    : pathname.replace(/^\//, '') || 'index.html';
  const candidates = [file, file + '.html'];
  const hit = candidates.find(c => fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile());
  if (!hit) { problems.push(`sitemap.xml: ${loc} has no file`); continue; }
  if (canonicalOf(hit) !== loc) problems.push(`sitemap.xml: ${loc} is not the canonical address of ${hit} (${canonicalOf(hit)})`);
}
notes.push(`link previews: ${pageFiles.length} pages checked for canonical, og tags and brand naming; sitemap has ${sitemapLocs.size} addresses`);

// ---- 9. Content-Security-Policy (v5.4.17, audit SEC-03) ----
// The CSP blocks inline scripts, so pages may only load code from files: no <script>
// without src (JSON-LD data blocks are fine) and no onclick=/onerror= style handlers,
// in pages or in HTML that scripts build. Every outside script host must be in script-src.
const cspLine = (headersSrc.match(/Content-Security-Policy:([^\n]*)/) || [])[1] || '';
const cspDirective = name => ((cspLine.match(new RegExp('\\b' + name + '([^;]*)')) || [])[1] || '').trim().split(/\s+/).filter(Boolean);
const scriptSrc = cspDirective('script-src');
if (scriptSrc.includes("'unsafe-inline'")) problems.push("_headers: script-src allows 'unsafe-inline' - move inline code into /js/ files");
const HANDLER = /\son[a-z]+\s*=\s*["'\\]/;
let inlineChecked = 0;
for (const f of pageFiles) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  inlineChecked++;
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs) || /type="application\/ld\+json"/.test(attrs)) {
      // A CSP source is a whole host, a folder ending in "/", or one exact file (SEC-10)
      const url = ((attrs.match(/src="(https:\/\/[^"?#]+)/) || [])[1]);
      const host = url && url.split('/')[2];
      const okSrc = s => s === 'https://' + host || (s.endsWith('/') ? url.startsWith(s) : url === s);
      if (url && !scriptSrc.some(okSrc)) problems.push(`${f}: script ${url} is not allowed by the CSP script-src`);
      continue;
    }
    problems.push(`${f}: inline <script> - the CSP blocks it; move it into a /js/ file`);
  }
  for (const line of html.split('\n')) if (HANDLER.test(line.replace(/<script[^>]*src=[^>]*>/g, ''))) { problems.push(`${f}: inline event handler (on...=) - the CSP blocks it: ${line.trim().slice(0, 80)}`); break; }
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) problems.push(`${f}: loads Google Fonts - Poppins is served from /fonts/`);
}
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(n => n.endsWith('.js') && n !== 'supabase.min.js')) {
  const lines = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n');
  lines.forEach((line, i) => { if (/<[a-z][^>]*\son[a-z]+\s*=\s*["'\\]/i.test(line)) problems.push(`js/${f}:${i + 1}: builds HTML with an on...= handler - the CSP blocks it`); });
}
notes.push(`security policy: ${inlineChecked} pages and the /js/ files checked for inline scripts and handlers`);

// ---- 10. Pre-push safety net (v5.4.18, audit CODE-06, DATA-04, REL-06) ----
const { spawnSync, execFileSync } = require('child_process');
const runScript = (name, args = []) => spawnSync(process.execPath, [path.join(__dirname, name), ...args], { encoding: 'utf8', cwd: ROOT });
const lastLine = r => (r.stderr || r.stdout || '').trim().split('\n').slice(-1)[0];

// Every data file parses (a broken JSON file blanks whole pages)
const dataFiles = fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.json'));
for (const f of dataFiles) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); }
  catch (e) { problems.push(`data/${f}: not valid JSON (${e.message})`); }
}

// Every script is valid JavaScript (a typo stops the whole page's script)
const jsFiles = [
  ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'supabase.min.js').map(f => 'js/' + f),
  ...fs.readdirSync(__dirname).filter(f => f.endsWith('.js')).map(f => 'scripts/' + f),
  'service-worker.js',
];
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`${f}: syntax error - ${(r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'node --check failed'}`);
}

// Every data file a script fetches exists
for (const f of jsFiles.filter(n => n.startsWith('js/'))) {
  for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/fetch\(\s*['"`]\/?(data\/[^'"`?]+)/g)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push(`${f}: fetches ${m[1]}, which doesn't exist`);
  }
}
notes.push(`${dataFiles.length} data files parsed, ${jsFiles.length} scripts syntax-checked`);

// The data must never shrink by accident: a refresh that drops recordings or setlists fails
// here (REL-06). Raise a floor when the data grows on purpose.
const FLOORS = { recordings: 614, setlists: 1089, lyrics: 188 };
const slData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/setlists.min.json'), 'utf8')).setlists;
const have = {
  recordings: tour.filter(g => (g.tracks || []).length).length,
  setlists: slData.filter(s => (s.songs || []).length).length,
  lyrics: Object.values(lyrics.songs).filter(v => v && v.trim()).length,
};
for (const [k, floor] of Object.entries(FLOORS)) {
  if (have[k] < floor) problems.push(`data: only ${have[k]} ${k}, down from ${floor}. Something removed data - check git diff data/ before going further`);
}

// Headline counts on the pages match the data (DATA-04)
const stats = runScript('build-site-stats.js', ['--check']);
if (stats.status !== 0) problems.push(`page counts: ${(stats.stderr || stats.stdout).trim().split('\n').join(' | ')}`);

// Every song in a setlist is on the official song list (or is a known song never released),
// so no page quietly loses plays to a new spelling (DATA-01). Same matching as
// scripts/build-canonical-songs.js.
const KNOWN_NOT_ON_LIST = [
  // Songs played live but never on an official release, plus setlist.fm placeholders
  'Heart Attack Love', 'Hiccups', 'Times Are Passing Us By', 'Fighter fighter', 'Waltz for Juliette',
  'Blonde Solid', 'Running for Your Life', 'Baby Blueblood', 'Psychedelic Ramblings of Rich Kids',
  "It's Snowing", "Haven't You Heard", "Old Wive's Tale", 'We Are the Next Us', 'Elaborate',
  'The Never-Ending Present', "If You're Freaked", "If You're Freaked, I'm Fucked", 'Lofty Pines',
  'Blackflies', 'Win', 'You See Details', "I'm For Real", 'New Song', 'Past...',
];
const normSong = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/canonical-songs.json'), 'utf8'));
const onList = new Set([...canonical.songs.flatMap(so => so.setlistKeys), ...KNOWN_NOT_ON_LIST.map(normSong)]);
const offList = new Map();
for (const show of slData) {
  for (const so of show.songs || []) {
    if (so.tape || so.cover || !so.name || !so.name.trim()) continue;
    for (const part of so.name.split(' / ')) {
      const k = canonical.aliases[normSong(part)] || normSong(part);
      if (!k || /^\s*(interview|introduction|intro|outro)\b/i.test(part) || onList.has(k)) continue;
      if (!offList.has(part.trim())) offList.set(part.trim(), show.id);
    }
  }
}
for (const [name, id] of offList) problems.push(`setlists: '${name}' (show ${id}) matches no song on the official list. A new spelling? Fix it in data/setlist-corrections.json (renameSongs), or add it to KNOWN_NOT_ON_LIST in scripts/audit-site.js if it really is an unreleased song`);
if (canonical.songs.length !== songSlugs.size) problems.push(`canonical-songs.json has ${canonical.songs.length} songs but song-index.json has ${songSlugs.size}: run scripts/build-song-index.js`);

// No scheduled puzzle moved (GAME-01, GAME-02, CODE-03). First the committed lock
// (data/game-schedule-lock.json), which needs no git history, so it also guards Netlify's
// build. Then git copies: the last commit, the last push (origin/main), the last Netlify
// deploy ($CACHED_COMMIT_REF) and --game-ref <ref> (GitHub passes the commit before the push).
// On Netlify and GitHub (IN_CI) a missing history is a warning; on a Mac it fails.
const IN_CI = ['NETLIFY', 'CI', 'GITHUB_ACTIONS'].some(k => process.env[k] === 'true') || !!process.env.COMMIT_REF; // COMMIT_REF: Netlify
const lockRun = runScript('check-game-schedule.js', ['--no-git']);
if (lockRun.status !== 0) problems.push('game schedule vs the lock (data/game-schedule-lock.json): a scheduled puzzle or a start date changed. Run node scripts/check-game-schedule.js for the list');
const historyGap = msg => (IN_CI ? warnings : problems).push(msg);
const resolveRef = ref => { try { return execFileSync('git', ['rev-parse', '--verify', '--quiet', ref + '^{commit}'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; } };
const head = resolveRef('HEAD');
if (head) {
  const gameRefAt = process.argv.indexOf('--game-ref');
  const wanted = [['HEAD', 'the last commit'], ['origin/main', 'the last push']];
  if (process.env.CACHED_COMMIT_REF) wanted.push([process.env.CACHED_COMMIT_REF, 'the last Netlify deploy']);
  if (gameRefAt > 0 && process.argv[gameRefAt + 1]) wanted.push([process.argv[gameRefAt + 1], 'the commit before this push']);
  const checked = [], seen = new Set();
  for (const [ref, label] of wanted) {
    const sha = resolveRef(ref);
    if (!sha) { historyGap(`game schedule: can't find ${label} (${ref}) in this copy's git history, so it was checked against the lock only`); continue; }
    if (ref !== 'HEAD' && sha === head) { checked.push(`${label} (same commit)`); continue; }
    if (seen.has(sha)) continue;
    seen.add(sha);
    const r = runScript('check-game-schedule.js', ['--no-lock', '--ref', sha]);
    if (r.status === 1) problems.push(`game schedule vs ${label} (${ref}): a scheduled puzzle moved or changed. Run node scripts/check-game-schedule.js --ref ${ref} for the list`);
    else if (r.status === 2) historyGap(`game schedule: couldn't read the game files at ${label} (${ref}), so it was checked against the lock only`);
    else if (r.status !== 0) problems.push(`game schedule vs ${label}: the check crashed - ${lastLine(r)}`);
    checked.push(label);
  }
  notes.push(`game schedules checked against the lock${checked.length ? ' and ' + checked.join(', ') : ''}`);
} else historyGap('not a git checkout, so the game schedule was checked against the lock only');

// No em or en dashes in anything fans read (Brand & Style Guide: use " - ")
const DASH_RE = /[—–]/;
const stripJsComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '$1'));
for (const f of pageFiles) {
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
    if (DASH_RE.test(line.replace(/<!--.*?-->/g, ''))) problems.push(`${f}:${i + 1}: em or en dash in page text - use " - "`);
  });
}
for (const f of jsFiles.filter(n => n.startsWith('js/'))) {
  stripJsComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).forEach((line, i) => {
    if (DASH_RE.test(line)) problems.push(`${f}: em or en dash in text the script shows: ${line.trim().slice(0, 80)}`);
  });
}
// Data: em dashes only. Third-party text stays as written: the Unplucked Gems tracker's
// notes (jD's ruling, v5.4.15) and setlist.fm venue names (en dashes).
for (const f of dataFiles.filter(n => n !== 'unplucked-gems.json')) {
  if (fs.readFileSync(path.join(ROOT, 'data', f), 'utf8').includes('—')) problems.push(`data/${f}: has an em dash in text fans read - use " - "`);
}

// The footer, the cache name and the newest changelog entry name the same release
const changelogVersion = (fs.readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8').match(/^## (v[\d.]+)/m) || [])[1];
if (changelogVersion !== footerVersion) problems.push(`docs/CHANGELOG.md newest entry is ${changelogVersion}, but the footer says ${footerVersion}: add the changelog entry`);
notes.push(`release ${footerVersion}: footer, cache name and changelog checked`);

// ---- Daily games: warn 90 days before either schedule runs out (audit GAME-05) ----
// After the last puzzle both games quietly start again from No. 1, so this gives time to
// append more. Counted in Toronto days, like the games themselves.
{
  const tp = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date()).forEach(x => { tp[x.type] = +x.value; });
  const torontoToday = Math.floor(Date.UTC(tp.year, tp.month - 1, tp.day) / 86400000);
  // [name, script, data file, list key, days between puzzles]
  for (const [name, js, file, key, step = 1] of [["'Bring It All Back'", 'bring-it-all-back.js', 'game-pool.json', 'shows'], ["'(Un)Locked'", 'unlocked.js', 'trunk-pool.json', 'puzzles'], ["'Little Bones'", 'little-bones.js', 'clip-pool.json', 'puzzles'], ["'Are We Family'", 'are-we-family.js', 'family-puzzles.json', 'puzzles', 7], ["'Words Into Birds'", 'words-into-birds.js', 'bird-puzzles.json', 'puzzles', 7]]) {
    const m = fs.readFileSync(path.join(ROOT, 'js', js), 'utf8').match(/const EPOCH = '(\d{4})-(\d{2})-(\d{2})'/);
    if (!m) { problems.push(`js/${js}: could not find EPOCH, so the game schedule run-out check was skipped`); continue; }
    const count = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'))[key].length;
    const firstDay = Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
    // Not open yet: nothing to run out (the placeholder start date sits far in the future)
    if (firstDay - torontoToday > 365) { notes.push(`${name} not open yet (start date ${m[1]}-${m[2]}-${m[3]} is a placeholder); ${count} puzzles ready`); continue; }
    const lastDay = firstDay + (count - 1) * step;
    const lastDate = new Date(lastDay * 86400000).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
    const left = lastDay - torontoToday;
    if (left < 0) warnings.push(`${name} ran out of new puzzles after No. ${count} on ${lastDate} and is repeating from No. 1. Append more puzzles`);
    else if (left < 90) warnings.push(`${name} has ${left} days of new puzzles left (last one No. ${count} on ${lastDate}), then it repeats from No. 1. Append more puzzles before then`);
    else notes.push(`${name} schedule runs to No. ${count} on ${lastDate} (${left} days left)`);
  }
}
// ---- 11. Data hygiene and code health (audit SEC-11, CODE-01, CODE-06) ----
{
  // No HTML in the data. setlist.fm is crowd-edited; a "<" in a venue or song name could
  // turn into markup on a page that forgot to escape it (SEC-11).
  let textFields = 0;
  for (const f of dataFiles) {
    const bad = [];
    const walk = (v, at) => {
      if (typeof v === 'string') { textFields++; if (v.includes('<') && bad.length < 3) bad.push(`${at}: ${v.slice(0, 60)}`); }
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], at + '.' + k);
    };
    try { walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')), f); } catch (e) { continue; /* reported above */ }
    for (const b of bad) problems.push(`data/${b} - text has a "<" (HTML?). Fix it at the source or in data/setlist-corrections.json`);
  }
  notes.push(`data text: ${textFields.toLocaleString('en-US')} text fields checked for HTML`);

  // Album facts live in two places: data/discography.json and the arrays at the top of
  // js/discography-app.js. They must agree on title, year, release date and track list (CODE-01).
  const appSrc = fs.readFileSync(path.join(ROOT, 'js/discography-app.js'), 'utf8');
  const ARRAYS = { studioAlbums: 'studio', liveAlbums: 'live', compilationAlbums: 'compilations', boxSetAlbums: 'boxsets', epAlbums: 'eps', videoAlbums: 'video' };
  const jsonAlbums = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/discography.json'), 'utf8')).albums;
  const appAlbums = [];
  for (const [name, category] of Object.entries(ARRAYS)) {
    const m = appSrc.match(new RegExp('\\nconst ' + name + ' = (\\[[\\s\\S]*?\\n\\]);'));
    let list = null;
    try { list = m && new Function('return ' + m[1])(); } catch (e) { /* reported below */ }
    if (!Array.isArray(list)) { problems.push(`js/discography-app.js: couldn't read the ${name} list to compare with data/discography.json`); continue; }
    list.forEach(a => appAlbums.push({ ...a, category }));
  }
  // Titles match ignoring capitals; a capitals-only difference is a warning (jD's call which is right)
  const albumKey = a => a.category + '|' + String(a.title).toLowerCase();
  const jsonByKey = new Map(jsonAlbums.map(a => [albumKey(a), a]));
  const appByKey = new Map(appAlbums.map(a => [albumKey(a), a]));
  for (const [k, a] of appByKey) {
    const j = jsonByKey.get(k);
    if (!j) { problems.push(`album "${a.title}" (${a.category}) is in js/discography-app.js but not data/discography.json - album facts must match in both`); continue; }
    if (a.title !== j.title) warnings.push(`album title capitals differ: "${a.title}" in js/discography-app.js, "${j.title}" in data/discography.json`);
    for (const field of ['year', 'releaseDate']) {
      if (String(a[field] || '') !== String(j[field] || '')) problems.push(`album "${a.title}": ${field} is "${a[field]}" in js/discography-app.js but "${j[field]}" in data/discography.json - change both`);
    }
    if (JSON.stringify(a.tracks || []) !== JSON.stringify(j.tracks || [])) problems.push(`album "${a.title}": track list differs between js/discography-app.js and data/discography.json - change both`);
  }
  for (const [k, j] of jsonByKey) if (!appByKey.has(k)) problems.push(`album "${j.title}" (${j.category}) is in data/discography.json but not js/discography-app.js - album facts must match in both`);
  notes.push(`album facts: ${appAlbums.length} albums in js/discography-app.js compared with data/discography.json`);

  // The scripts are written for the Node version in .nvmrc (GitHub runs that one). A newer
  // Node here can hide a feature that breaks there (CODE-06).
  const nvmrc = fs.existsSync(path.join(ROOT, '.nvmrc')) ? fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim().replace(/^v/, '') : '';
  const nodeMajor = process.versions.node.split('.')[0];
  if (nvmrc && nodeMajor !== nvmrc.split('.')[0]) warnings.push(`this Mac runs Node ${process.versions.node}, but .nvmrc says ${nvmrc} (what GitHub uses). Scripts that pass here could fail there: switch with "nvm use" if you can`);
}

// ---- 6. External links (page chrome only) ----
async function checkExternals() {
  if (NO_NETWORK) { notes.push('external checks skipped (--no-network)'); return; }
  const urls = [...externals];
  notes.push(`checking ${urls.length} external URLs`);
  const limit = 8;
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      const u = queue.pop();
      try {
        const ctl = AbortSignal.timeout(20000);
        let res = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctl,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) HipHandbookAudit/1.0' } });
        if (!res.ok && res.status !== 999) {
          res = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) HipHandbookAudit/1.0' } });
        }
        if (!res.ok) {
          // Only "gone" statuses mean a dead link. Anything else is a live
          // server being hostile to datacenter IPs (403/415/429/999/...) -
          // CI runners see those from sites that serve humans fine.
          if (res.status === 404 || res.status === 410) {
            problems.push(`external ${res.status} -> ${u}`);
          } else {
            warnings.push(`external ${res.status} (server alive, likely bot-block) -> ${u}`);
          }
        }
      } catch (e) {
        const code = e.cause?.code || e.name;
        // Dead DNS = genuinely gone; timeouts/resets are often CI-side flakiness
        if (code === 'ENOTFOUND') problems.push(`external domain dead -> ${u} (${code})`);
        else warnings.push(`external unreachable (transient?) -> ${u} (${code})`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

(async () => {
  await checkExternals();
  console.log('=== Hip Handbook site audit ===');
  for (const n of notes) console.log('  ' + n);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s) (not failing the audit):`);
    for (const w of warnings) console.log('  ! ' + w);
  }
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`);
    for (const p of problems) console.log('  ✗ ' + p);
    process.exit(1);
  }
  console.log('\nAll checks passed.');
})();
