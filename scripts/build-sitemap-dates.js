#!/usr/bin/env node
// build-sitemap-dates.js - puts a "last changed" date on every address in sitemap.xml
// (jD, 2026-11-13: date all of them).
//
// The date is the day the page's own file last changed: the date of the last commit that
// touched it, or today (Toronto) if it has changes that aren't committed yet. It reads
// git, so it only runs on jD's Mac, never on Netlify or in audit-site.js. The audit just
// checks that every address has a date and none is in the future.
//
// The song pages and the podcast pages are rebuilt together, so they usually share a date.
// That is expected: the date says when the page was last built with a change, nothing more.
//
// The builders that write parts of sitemap.xml (build-song-index.js, build-podcasts.js)
// keep whatever dates are already there, and leave a new address undated for this script.
//
// Run it as the last step before a release commit (after every page is built):
//   node scripts/build-sitemap-dates.js           write the dates
//   node scripts/build-sitemap-dates.js --check   only report what would change

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const SITE = 'https://thehiphandbook.tthpods.com';
const smPath = path.join(ROOT, 'sitemap.xml');

const git = args => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.error('STOPPED - git did not answer (' + args.slice(0, 2).join(' ') + '). Nothing changed.'); process.exit(1); }
  return r.stdout;
};

// Addresses that are served from a differently named file (the "200" lines in _redirects)
const rewrites = new Map();
for (const line of fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n')) {
  const m = line.trim().match(/^(\/\S*)\s+(\/\S+\.html)\s+200$/);
  if (m) rewrites.set(m[1], m[2].slice(1));
}
const fileOf = loc => {
  const p = loc.slice(SITE.length) || '/';
  if (rewrites.has(p)) return rewrites.get(p);
  if (p === '/') return 'index.html';
  return p.slice(1) + '.html';
};

// The last commit date of every .html file, in one pass (newest commit first)
const committed = new Map();
let date = null;
for (const line of git(['-c', 'core.quotepath=off', 'log', '--format=@%cs', '--name-only', '--', '*.html']).split('\n')) {
  if (line.startsWith('@')) date = line.slice(1);
  else if (line && !committed.has(line)) committed.set(line, date);
}
// Files with changes that aren't committed yet (or not in git at all) count as changed today
const dirty = new Set(git(['-c', 'core.quotepath=off', 'status', '--porcelain', '--', '*.html']).split('\n').filter(Boolean).map(l => l.slice(3)));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const sm = fs.readFileSync(smPath, 'utf8');
const problems = [], changes = [];
let entries = 0;
const out = sm.replace(/( *)<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g, (whole, indent, loc, rest) => {
  entries++;
  const file = fileOf(loc);
  if (!loc.startsWith(SITE) || !fs.existsSync(path.join(ROOT, file))) { problems.push(`${loc}: no page file found (looked for ${file})`); return whole; }
  const want = dirty.has(file) ? today : committed.get(file);
  if (!want) { problems.push(`${loc}: ${file} has no history in git`); return whole; }
  const had = (rest.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
  if (had !== want) changes.push(`${loc.slice(SITE.length) || '/'}: ${had || 'no date'} -> ${want}`);
  const others = rest.replace(/\s*<lastmod>[^<]*<\/lastmod>/, '').trim();
  return `${indent}<url>\n${indent}  <loc>${loc}</loc>\n${indent}  <lastmod>${want}</lastmod>\n${indent}  ${others}\n${indent}</url>`;
});

if (problems.length) {
  console.error('STOPPED - nothing saved:');
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
if (CHECK) {
  if (!changes.length) { console.log(`OK: all ${entries} sitemap dates are current.`); process.exit(0); }
  console.log(`${changes.length} of ${entries} sitemap dates would change:`);
  changes.slice(0, 20).forEach(c => console.log('  ' + c));
  if (changes.length > 20) console.log(`  ...and ${changes.length - 20} more`);
  process.exit(1);
}
if (out !== sm) fs.writeFileSync(smPath, out);
console.log(`sitemap.xml: ${entries} addresses dated, ${changes.length} changed.`);
const tally = {};
for (const m of out.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) tally[m[1]] = (tally[m[1]] || 0) + 1;
Object.entries(tally).sort().forEach(([d, n]) => console.log(`  ${d}: ${n}`));
