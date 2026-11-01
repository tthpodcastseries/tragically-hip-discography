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
//
// Usage: node scripts/audit-site.js [--no-network]
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
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const externals = new Set();
for (const page of pages) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const m of src.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const r = m[1];
    // Skip preconnect/dns-prefetch hints - bare origins, not fetchable pages
    const tagStart = src.lastIndexOf('<', m.index);
    const tag = src.slice(tagStart, src.indexOf('>', m.index) + 1);
    if (/rel=["'](?:preconnect|dns-prefetch)["']/.test(tag)) continue;
    if (/^https?:\/\//.test(r)) externals.add(r);
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
