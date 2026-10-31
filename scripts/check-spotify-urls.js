#!/usr/bin/env node
// check-spotify-urls.js - liveness check for every Spotify link the site uses
//
// Sources: every open.spotify.com album/track/playlist/artist/show/episode URL
// in js/*.js, the root *.html pages and data/*.json. Search links
// (open.spotify.com/search/...) are built at runtime and always resolve, so
// they are skipped.
//
// Keyless liveness via Spotify's oembed endpoint: 404 = the ID no longer
// exists (a plain HEAD on open.spotify.com returns 200 even for dead IDs,
// which is why the old v2-era version of this script never caught anything).
//
// Usage: node scripts/check-spotify-urls.js [--titles] [--json report.json]
//   --titles  also print each link's label next to Spotify's own title, to
//             catch an ID that is alive but points at the wrong release
// Exit 0 = nothing dead, 1 = at least one 404.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const jsonFlag = process.argv.indexOf('--json');
const jsonOut = jsonFlag !== -1 ? process.argv[jsonFlag + 1] : null;
const showTitles = process.argv.includes('--titles');

// url -> Set of "file:line (label)" strings (a link can appear in several places)
const targets = new Map();
const URL_RE = /https:\/\/open\.spotify\.com\/(album|track|playlist|artist|show|episode)\/([A-Za-z0-9]{22})/g;

const files = [
  ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.json')).map(f => 'data/' + f),
];
for (const file of files) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(URL_RE)) {
      const url = `https://open.spotify.com/${m[1]}/${m[2]}`;
      // Map entries look like  'Title': 'https://open.spotify.com/...'
      const key = (line.match(/^\s*['"](.+?)['"]\s*:/) || [])[1];
      if (!targets.has(url)) targets.set(url, { url, kind: m[1], where: new Set(), labels: new Set() });
      targets.get(url).where.add(`${file}:${i + 1}`);
      if (key) targets.get(url).labels.add(key.replace(/\\(['"])/g, '$1'));
    }
  });
}

const all = [...targets.values()];
console.error(`Checking ${all.length} unique Spotify links...`);

async function oembed(t) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(t.url)}`, { signal: AbortSignal.timeout(20000) });
    if (res.status === 200) {
      try { t.title = (await res.json()).title; } catch { /* title is optional */ }
    }
    return res.status;
  } catch {
    return 'ERR';
  }
}

// Verdict: 'live' | 'dead' | 'unreachable'. Only a confirmed 404 is dead.
async function verdict(t) {
  let status = await oembed(t);
  if (status === 'ERR' || status === 429) status = await oembed(t); // retry transient network / rate limit
  if (status === 404) {
    await new Promise(r => setTimeout(r, 500));
    status = await oembed(t);
    if (status === 404) return { v: 'dead', reason: 'oembed 404 (gone)' };
  }
  if (status !== 200) return { v: 'unreachable', reason: `oembed ${status}` };
  return { v: 'live' };
}

(async () => {
  const dead = [], warn = [];
  const queue = [...all];
  const CONCURRENCY = 6;
  async function worker() {
    while (queue.length) {
      const t = queue.pop();
      const r = await verdict(t);
      t.verdict = r.v; t.reason = r.reason;
      if (r.v === 'dead') dead.push(t);
      else if (r.v === 'unreachable') warn.push(t); // don't fail on flakiness
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const label = t => (t.labels.size ? [...t.labels].join(' / ') + ' - ' : '') + [...t.where].join('; ');

  console.log('=== Spotify link liveness ===');
  console.log(`  ${all.length} unique links checked (${all.filter(t => t.verdict === 'live').length} live)`);

  if (showTitles) {
    console.log('\nLabel -> Spotify title:');
    for (const t of all.filter(t => t.title).sort((a, b) => label(a).localeCompare(label(b)))) {
      console.log(`  ${[...t.labels].join(' / ') || t.url}  ->  ${t.title}`);
    }
  }

  if (warn.length) {
    console.log(`\n${warn.length} warning(s) - unreachable this run (not failing):`);
    for (const t of warn) console.log(`  ! ${t.url} (${t.reason}) - ${label(t)}`);
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({
      checkedAt: new Date().toISOString(),
      total: all.length,
      dead: dead.map(t => ({ url: t.url, reason: t.reason, labels: [...t.labels], where: [...t.where] })),
      warnings: warn.map(t => ({ url: t.url, reason: t.reason, labels: [...t.labels], where: [...t.where] })),
    }, null, 2) + '\n');
  }

  if (dead.length) {
    console.log(`\n${dead.length} DEAD link(s):`);
    for (const t of dead) console.log(`  ✗ ${t.url} - ${label(t)}`);
    process.exit(1);
  }
  console.log('\nAll Spotify links live.');
})();
