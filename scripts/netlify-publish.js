#!/usr/bin/env node
// netlify-publish.js - copies the site into _site/, the folder Netlify publishes
// (netlify.toml runs it after scripts/audit-site.js passes; audit SEC-08).
//
// Everything at the repo root is the site, except the working files below. They are
// left out of the copy, so they are never on the live site at all, whatever the letter
// case of the address (/Docs/, /SCRIPTS/ and /CLAUDE.MD used to get past _redirects).
// The repo itself is never changed: Netlify keeps its copy of the repo between builds,
// so deleting files from it would break the next build.
//
// A new page or folder at the root is published automatically. Add a path to
// LEAVE_OUT only if fans should never be able to download it.
//
// Usage: node scripts/netlify-publish.js     (writes _site/, gitignored; safe to run locally)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');

// Paths relative to the repo root. Anything whose name starts with "." (.git, .github,
// .nvmrc, .env ...) is left out too, except .well-known.
const LEAVE_OUT = new Set([
  // notes, tools and database setup (also blocked in _redirects, as a second layer)
  'docs', 'scripts', 'audits', 'supabase', 'CLAUDE.md',
  'data/source', 'data/live-play-counts-unmatched.txt',
  // the game schedule lock is only for scripts/check-game-schedule.js
  'data/game-schedule-lock.json',
  // data only the build scripts read: no page or script in js/ loads these (checked 2026-11-13).
  // Take one off this list before a page fetches it, or it works locally and 404s live.
  'data/live-play-counts-merged.json', 'data/hipbase-play-counts.json', 'data/setlistfm-play-counts.json',
  'data/podcast-feed.json', 'data/podcast-shows.json', 'data/bird-links.json', 'data/unplucked-corrections.json',
  // build and repo files
  'netlify.toml', 'package.json', 'package-lock.json', 'node_modules', '_site',
  // gitignored files that only exist on jD's Mac (never on Netlify, but this keeps a local run clean)
  '_audit_scratch', 'SYSTEM_MAP.md', '_MANIFEST.md', 'about-me.md', 'brand-voice.md', 'working-style.md',
  'The Hip Handbook - Dashboard Steps.md',
  'data/setlists.json', 'data/hip-archive-index.json', 'data/tth-tour-stats.json',
]);
const leaveOut = rel => {
  const parts = rel.split(path.sep);
  if (parts.some(p => p.startsWith('.') && p !== '.well-known')) return true;
  if (parts.length === 1 && /^AUDIT_.*\.md$/.test(parts[0])) return true;
  if (/\.pdf$/i.test(rel)) return true;
  return LEAVE_OUT.has(parts.join('/'));
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

let files = 0, bytes = 0;
const skipped = [];
for (const name of fs.readdirSync(ROOT)) {
  const src = path.join(ROOT, name);
  if (leaveOut(name)) { skipped.push(name); continue; }
  fs.cpSync(src, path.join(OUT, name), {
    recursive: true,
    filter: s => {
      const rel = path.relative(ROOT, s);
      if (leaveOut(rel)) { skipped.push(rel); return false; }
      const st = fs.lstatSync(s);
      if (st.isFile()) { files++; bytes += st.size; }
      return true;
    },
  });
}

// The copy must hold the site's working parts, or Netlify would publish a broken site
const MUST_HAVE = ['index.html', '404.html', '_redirects', '_headers', 'service-worker.js', 'manifest.json', 'sitemap.xml', 'js', 'css', 'data', 'fonts', 'song'];
const missing = MUST_HAVE.filter(f => !fs.existsSync(path.join(OUT, f)));
if (missing.length) {
  console.error(`netlify-publish: _site is missing ${missing.join(', ')} - not publishing`);
  process.exit(1);
}

console.log(`netlify-publish: copied ${files} files (${(bytes / 1048576).toFixed(1)} MB) to _site/`);
console.log(`  left out: ${skipped.filter(s => !s.startsWith('.')).sort().join(', ')} and dot-files`);
