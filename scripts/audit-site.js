#!/usr/bin/env node
// audit-site.js - The Hip Handbook full-site audit
//
// Checks (no external dependencies, Node 18+):
//   1. Internal links/assets referenced by every HTML page exist on disk
//   2. Service worker CORE_ASSETS all exist
//   3. manifest.json icons exist
//   4. sitemap.xml entries map to real pages
//   5. Data cross-references: show-video orphans, AppleDouble junk tracks,
//      empty lyrics, unplucked-gems imagePaths
//   6. External links in page chrome respond (skipped with --no-network)
//   7. Every external image host used by pages/scripts/data is allowed by
//      the CSP img-src in _headers (localhost ignores _headers, so a
//      missing host only breaks on the live site)
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
}

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
