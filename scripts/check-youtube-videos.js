#!/usr/bin/env node
// check-youtube-videos.js - liveness check for every YouTube video the site links to
//
// Sources:
//   data/youtube-videos.json  (Video For New Recruits - fan concert archive)
//   data/show-videos.json     (tour-map show <-> video mappings)
//   data/music-videos.json    (official music videos)
//   js/discography-app.js      (26 Road to the Top 40 episode IDs)
//
// Keyless liveness via YouTube's oembed endpoint: 404 = the video/playlist
// is gone (removed, channel deleted, copyright strike); anything else means
// it still exists. 401 specifically = "embedding disabled" which is fine here
// because the site LINKS OUT to youtube.com/watch, never embeds inline.
//
// Why oembed only: scraping the watch page for playabilityStatus is more
// precise in theory but YouTube serves consent-wall/degraded pages to
// concurrent datacenter (CI) requests, producing bogus UNPLAYABLE/UNKNOWN
// results that would flap the weekly job red. oembed is not bot-walled and
// returned identical results across repeated runs, so it's the reliable
// choice for an unattended nag. Trade-off: a video set to *private* (rare for
// these fan archive uploads, vs. outright removed) reads as alive.
//
// Usage: node scripts/check-youtube-videos.js [--json report.json]
// Exit 0 = nothing removed, 1 = at least one 404.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const jsonFlag = process.argv.indexOf('--json');
const jsonOut = jsonFlag !== -1 ? process.argv[jsonFlag + 1] : null;

// id -> Set of "source: label" strings (a video can appear in several places)
const targets = new Map();
function add(id, kind, source, label) {
  if (!id) return;
  const key = kind + ':' + id;
  if (!targets.has(key)) targets.set(key, { id, kind, where: new Set() });
  targets.get(key).where.add(`${source} (${label})`);
}
const VID_RE = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/;
const LIST_RE = /[?&]list=([\w-]+)/;

// 1. archive
const yv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/youtube-videos.json'), 'utf8'));
for (const era of yv.eras) {
  for (const v of era.videos || []) {
    const vid = v.videoId || (v.url && (v.url.match(VID_RE) || [])[1]);
    if (vid) add(vid, 'video', 'youtube-videos.json', v.title || vid);
    else {
      const list = v.url && (v.url.match(LIST_RE) || [])[1];
      if (list) add(list, 'playlist', 'youtube-videos.json', v.title || list);
    }
  }
}

// 2. show-videos
const sv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/show-videos.json'), 'utf8'));
for (const [showId, list] of Object.entries(sv.byShow || {})) {
  for (const v of list) {
    const vid = v.videoId || (v.url && (v.url.match(VID_RE) || [])[1]);
    if (vid) add(vid, 'video', 'show-videos.json', `show ${showId}`);
  }
}

// 3. music videos
const mv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/music-videos.json'), 'utf8'));
const mvl = Array.isArray(mv) ? mv : (mv.videos || mv.musicVideos || []);
for (const v of mvl) {
  const vid = v.youtubeId || v.videoId || (v.youtubeUrl && (v.youtubeUrl.match(VID_RE) || [])[1]);
  if (vid) add(vid, 'video', 'music-videos.json', v.song || vid);
}

// 4. Road to the Top 40 episode IDs from discography-app.js
const app = fs.readFileSync(path.join(ROOT, 'js/discography-app.js'), 'utf8');
const roadBlock = app.slice(app.indexOf('const roadToTop40Videos'), app.indexOf('function roadEpisodeForRank'));
for (const m of roadBlock.matchAll(/(\d+):\s*'([\w-]{11})'/g)) {
  add(m[2], 'video', 'discography-app.js', `Road ep ${m[1]}`);
}

const all = [...targets.values()];
console.error(`Checking ${all.length} unique YouTube targets...`);

async function oembedStatus(t) {
  const url = t.kind === 'playlist'
    ? `https://www.youtube.com/playlist?list=${t.id}`
    : `https://www.youtube.com/watch?v=${t.id}`;
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  try {
    const res = await fetch(oembed, { signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch {
    return 'ERR';
  }
}

// Verdict: 'live' | 'dead' | 'unreachable'. Only a confirmed 404 is dead.
async function verdict(t) {
  let status = await oembedStatus(t);
  if (status === 'ERR') status = await oembedStatus(t); // retry transient network
  if (status === 404) {
    // confirm - guard against a one-off 404 before failing the build
    await new Promise(r => setTimeout(r, 500));
    status = await oembedStatus(t);
    if (status === 404) return { v: 'dead', reason: 'oembed 404 (removed)' };
  }
  t.oembed = status;
  if (status === 'ERR') return { v: 'unreachable', reason: 'oembed unreachable' };
  return { v: 'live' };
}

(async () => {
  const dead = [], warn = [];
  const queue = [...all];
  const CONCURRENCY = 10;
  async function worker() {
    while (queue.length) {
      const t = queue.pop();
      const r = await verdict(t);
      t.verdict = r.v; t.reason = r.reason;
      if (r.v === 'dead') dead.push(t);
      else if (r.v === 'unreachable') warn.push(t); // don't fail CI on flakiness
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('=== YouTube video liveness ===');
  console.log(`  ${all.length} unique targets checked (${all.filter(t => t.verdict === 'live').length} watchable)`);

  if (warn.length) {
    console.log(`\n${warn.length} warning(s) - unreachable this run (not failing):`);
    for (const t of warn) {
      console.log(`  ! ${t.kind} ${t.id} (${t.reason}) - ${[...t.where].join('; ')}`);
    }
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({
      checkedAt: new Date().toISOString(),
      total: all.length,
      dead: dead.map(t => ({ id: t.id, kind: t.kind, reason: t.reason, where: [...t.where] })),
      warnings: warn.map(t => ({ id: t.id, reason: t.reason, where: [...t.where] })),
    }, null, 2) + '\n');
  }

  if (dead.length) {
    console.log(`\n${dead.length} DEAD video(s) (removed / private / unavailable):`);
    for (const t of dead) {
      console.log(`  ✗ ${t.kind} ${t.id} (${t.reason}) - ${[...t.where].join('; ')}`);
      console.log(`      https://www.youtube.com/${t.kind === 'playlist' ? 'playlist?list=' : 'watch?v='}${t.id}`);
    }
    process.exit(1);
  }
  console.log('\nAll videos watchable.');
})();
