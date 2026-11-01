#!/usr/bin/env node
// build-webp.js
// Smaller WebP copies of every JPEG/PNG in assets-optimized/ (v5.4.16, audit PERF-05).
// Pages show the .webp; the originals stay for link-preview images (og:image).
//   band/   photos: at most 1200 px wide (shown at up to 600-700 px)
//   others: covers and era images, at most 600 px wide, the size of the originals (cards and the album window)
// Only (re)makes a .webp that is missing or older than its source. Needs ffmpeg built
// with libwebp on the PATH.
//
// Usage: node scripts/build-webp.js           make missing/stale .webp files
//        node scripts/build-webp.js --check   only report them

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets-optimized');
const CHECK = process.argv.includes('--check');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    // link-preview-*.jpg is only for og:image (robots read the JPEG), so it needs no WebP
    return /\.(jpe?g|png)$/i.test(e.name) && !e.name.startsWith('._') && !e.name.startsWith('link-preview') ? [p] : [];
  });
}

const todo = walk(DIR).filter(src => {
  const out = src.replace(/\.(jpe?g|png)$/i, '.webp');
  return !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs;
});

if (CHECK) {
  if (todo.length) {
    console.error(`${todo.length} image(s) without an up-to-date .webp (run node scripts/build-webp.js):`);
    todo.forEach(f => console.error('  ' + path.relative(ROOT, f)));
    process.exit(1);
  }
  console.log('every image in assets-optimized has a .webp');
  process.exit(0);
}

let before = 0, after = 0;
for (const src of todo) {
  const out = src.replace(/\.(jpe?g|png)$/i, '.webp');
  const max = path.relative(DIR, src).startsWith('band' + path.sep) ? 1200 : 600;
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src,
    '-vf', `scale='min(${max},iw)':-1`, '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`failed: ${path.relative(ROOT, src)}\n${r.stderr || r.error}`); process.exitCode = 1; continue; }
  before += fs.statSync(src).size;
  after += fs.statSync(out).size;
  console.log(`${path.relative(ROOT, out)}  ${Math.round(fs.statSync(src).size / 1024)} KB -> ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
console.log(todo.length ? `made ${todo.length} .webp file(s): ${Math.round(before / 1024)} KB of originals -> ${Math.round(after / 1024)} KB` : 'every image already has a .webp');
