#!/usr/bin/env node
// build-clip-pool.js
// Builds data/clip-pool.json for 'Little Bones', the daily live-clip game, played at
// /little-bones (little-bones.html).
//
// One puzzle a day: one song by The Hip, heard as a short clip from one Hip Archive
// recording (Backblaze, the same files the tour map plays). The song is the answer; the
// show's year is the bonus.
//
// Songs come back: a song with plenty of recordings gives up to 3 puzzles, each from a
// different year where it can, picked at random (seeded) so the bonus year isn't always
// 2016. The schedule mixes them so the same song never returns within 90 days.
//
// Clip start points: by default the game starts the clip 30% of the way into the track
// (past the crowd noise and the talk). jD fixes bad ones in data/clip-starts.json, by hand
// or with the clip picker (scripts/clip-picker.html, local only):
//   starts: { "<slug>@<showId>": seconds }   where the clip starts
//   skip:   [ "<slug>@<showId>" ]            never use this recording (a rough tape)
// Start points are details: they are refreshed on every run, like the play links in
// (Un)Locked, and may change for any day that isn't in play yet.
//
// The order is LOCKED once the game opens: existing puzzles keep their place, song and
// recording, and new songs go on the end. Until the game opens (EPOCH in js/little-bones.js
// still ahead), a skipped recording on a scheduled day is swapped for another recording of
// the same song, so jD can weed out rough tapes before launch. After it opens a skip only
// stops that recording being used for new days. If data/clip-pool.json is missing it refuses
// to start a new schedule unless given --force (get the old one back with
// git checkout data/clip-pool.json). Check with node scripts/check-game-schedule.js after.
//
// Output: { built, total, titles: [[slug, title] ...], puzzles: [ { s, t, v, id, d, pl, u, at? } ] }
//   v is the version of the song (1 = its first appearance), id the setlist.fm show id,
//   d the show date (yyyy-mm-dd), pl the place ("Venue, City, ST"), u the audio file's path
//   in the Backblaze bucket, and at the start point in seconds when jD set one.
//   titles is every song on the official list, for the guess box.
//
// Usage: node scripts/build-clip-pool.js [--force]
//   (re-run after build-song-index.js, and after editing data/clip-starts.json)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'clip-pool.json');
const STARTS = path.join(ROOT, 'data', 'clip-starts.json');
const MAX_VERSIONS = 3;
const MIN_GAP_DAYS = 90;
const SEED = 1991; // Road Apples
const RUN_OUT_WARN_DAYS = 60;
const FORCE = process.argv.includes('--force');

const songIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'song-index.json'), 'utf8'));
const tracks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tour-tracks.json'), 'utf8'));
const hand = fs.existsSync(STARTS) ? JSON.parse(fs.readFileSync(STARTS, 'utf8')) : { starts: {}, skip: [] };
const starts = hand.starts || {};
const skip = new Set(hand.skip || []);
const index = songIndex.songs;
const shows = songIndex.shows;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
};

// ─── Has the game opened? ───
const dayNumber = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const epochMatch = fs.readFileSync(path.join(ROOT, 'js', 'little-bones.js'), 'utf8').match(/const EPOCH = '(\d{4})-(\d{2})-(\d{2})'/);
if (!epochMatch) throw new Error('Could not find EPOCH in js/little-bones.js');
const epoch = dayNumber(+epochMatch[1], +epochMatch[2], +epochMatch[3]);
const now = new Date();
const todayNo = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate()) - epoch + 1; // 0 or less = not open yet
const opened = todayNo + 1 >= 1; // fans east of Toronto get tomorrow's puzzle first
const dateOf = no => new Date((epoch + no - 1) * 86400000).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

// ─── Every usable recording of every song ───
// A recording is the song's own track in one Hip Archive show (song-index r: [showIdx, trackNo]).
const keyOf = (slug, id) => slug + '@' + id;
const recordingsOf = so => (so.r || []).map(([si, tn]) => {
  const show = shows[si];
  const tr = (tracks[show[0]] || [])[tn - 1];
  if (!tr || !tr.url || /^https?:/.test(tr.url)) return null;
  const place = [show[2], show[3], show[4]].filter(Boolean).join(', ');
  return { id: String(show[0]), d: show[1], pl: place, u: tr.url };
}).filter(r => r && !skip.has(keyOf(so.s, r.id)));

// Up to 3 recordings from different years, picked at random (seeded per song)
function pickVersions(so) {
  const recs = recordingsOf(so);
  const k = Math.min(MAX_VERSIONS, recs.length >= 20 ? 3 : recs.length >= 5 ? 2 : 1, recs.length);
  const rand = rng(SEED + [...so.s].reduce((n, c) => n * 31 + c.charCodeAt(0) >>> 0, 7));
  const pool = shuffle(recs.slice(), rand);
  const out = [];
  for (const r of pool) {
    if (out.length >= k) break;
    if (out.some(o => o.d.slice(0, 4) === r.d.slice(0, 4))) continue;
    out.push(r);
  }
  for (const r of pool) { if (out.length >= k) break; if (!out.includes(r)) out.push(r); }
  return out;
}

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (!old && !FORCE) {
  console.error('STOPPED - nothing saved. There is no data/clip-pool.json, so this would start a brand-new schedule');
  console.error('and every Little Bones puzzle would change. To get the current one back:');
  console.error('  git checkout data/clip-pool.json');
  console.error('Only if you really mean to start the whole game over (never after launch), run: node scripts/build-clip-pool.js --force');
  process.exit(1);
}
const bySlug = new Map(index.map(so => [so.s, so]));
const puzzles = old ? old.puzzles.map(p => ({ ...p })) : [];

// ─── Skipped recordings on days already scheduled ───
const swapped = [], stuck = [];
puzzles.forEach((p, i) => {
  if (!skip.has(keyOf(p.s, p.id))) return;
  if (opened) { stuck.push(`No. ${i + 1} (${dateOf(i + 1)}) '${p.t}' at ${p.d}`); return; }
  const so = bySlug.get(p.s);
  const taken = new Set(puzzles.filter(q => q.s === p.s).map(q => q.id));
  const recs = so ? recordingsOf(so).filter(r => !taken.has(r.id)) : [];
  const yearsTaken = new Set(puzzles.filter(q => q.s === p.s && q !== p).map(q => q.d.slice(0, 4)));
  const r = recs.find(x => !yearsTaken.has(x.d.slice(0, 4))) || recs[0];
  if (!r) { stuck.push(`No. ${i + 1} '${p.t}' at ${p.d} (no other recording to swap in)`); return; }
  swapped.push(`No. ${i + 1} '${p.t}': ${p.d} -> ${r.d}`);
  Object.assign(p, { id: r.id, d: r.d, pl: r.pl, u: r.u });
});

// ─── New songs on the end ───
const have = new Set(puzzles.map(p => p.s));
const rand = rng(SEED + puzzles.length);
const songs = [];
const noRecording = [];
for (const so of index) {
  if (have.has(so.s)) continue;
  const versions = pickVersions(so);
  if (!versions.length) { noRecording.push(so.t); continue; }
  songs.push({ s: so.s, t: so.t, versions: old ? versions.slice(0, 1) : versions });
}
shuffle(songs, rand);

// Same spacing as (Un)Locked: a song only comes back after MIN_GAP_DAYS, songs with more
// versions left go first, so the repeats spread out
const lastDay = new Map();
puzzles.forEach((p, i) => lastDay.set(p.s, i));
const left = new Map(songs.map(so => [so.s, so.versions.length]));
const next = new Map(songs.map(so => [so.s, 0]));
let tooClose = 0;
const fresh = [];
while (fresh.length < songs.reduce((n, so) => n + so.versions.length, 0)) {
  const day = puzzles.length + fresh.length;
  const open = songs.filter(so => left.get(so.s) > 0);
  let due = open.filter(so => !lastDay.has(so.s) || day - lastDay.get(so.s) >= MIN_GAP_DAYS);
  if (!due.length) {
    tooClose++;
    const wait = so => day - lastDay.get(so.s);
    due = [open.reduce((a, b) => (wait(b) > wait(a) ? b : a))];
  }
  const weight = so => left.get(so.s) ** 3;
  let r = rand() * due.reduce((n, so) => n + weight(so), 0);
  const so = due.find(x => (r -= weight(x)) < 0) || due[due.length - 1];
  const v = next.get(so.s);
  const rec = so.versions[v];
  fresh.push({ s: so.s, t: so.t, v: v + 1, id: rec.id, d: rec.d, pl: rec.pl, u: rec.u });
  next.set(so.s, v + 1);
  left.set(so.s, left.get(so.s) - 1);
  lastDay.set(so.s, day);
}
puzzles.push(...fresh);

// ─── Details refreshed every run: start points and place names ───
for (const p of puzzles) {
  const at = starts[keyOf(p.s, p.id)];
  if (typeof at === 'number' && at >= 0) p.at = Math.round(at * 10) / 10; else delete p.at;
}

const stale = puzzles.map((p, i) => [p, i]).filter(([p]) => !bySlug.has(p.s));
if (stale.length) {
  console.error('STOPPED - nothing saved. These puzzles are for songs no longer in song-index.json, so no guess could win them:');
  stale.forEach(([p, i]) => console.error(`  #${i + 1} (${dateOf(i + 1)}) '${p.t}' (slug ${p.s})`));
  process.exit(1);
}

// The puzzle itself is the song and the recording; nothing scheduled may change once open
const core = p => JSON.stringify([p.s, p.t, p.v, p.id, p.u]);
if (old && opened) old.puzzles.forEach((p, i) => {
  if (!puzzles[i] || core(puzzles[i]) !== core(p)) throw new Error(`Refusing to save: puzzle #${i + 1} (${dateOf(i + 1)}) '${p.t}' would change`);
});

const body = { total: puzzles.length, titles: index.map(so => [so.s, so.t]), puzzles };
const sameAsOld = old && JSON.stringify(body) === JSON.stringify({ total: old.total, titles: old.titles, puzzles: old.puzzles });
const out = { built: sameAsOld ? old.built : new Date().toISOString().slice(0, 10), ...body };
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');

console.log(`wrote data/clip-pool.json: ${puzzles.length} puzzles (${fresh.length} new, ${puzzles.length - fresh.length} kept), ${out.titles.length} titles, ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
const byVersion = [1, 2, 3].map(v => puzzles.filter(p => p.v === v).length);
console.log(`  ${new Set(puzzles.map(p => p.s)).size} songs; first appearances ${byVersion[0]}, second ${byVersion[1]}, third ${byVersion[2]}`);
const years = {};
puzzles.forEach(p => { const dec = p.d.slice(0, 3) + '0s'; years[dec] = (years[dec] || 0) + 1; });
console.log(`  shows by decade: ${Object.keys(years).sort().map(k => k + ' ' + years[k]).join(', ')}`);
console.log(`  start points set by hand: ${puzzles.filter(p => 'at' in p).length} (the rest start 30% in)`);
const gaps = [];
const seen = new Map();
puzzles.forEach((p, i) => { if (seen.has(p.s)) gaps.push(i - seen.get(p.s)); seen.set(p.s, i); });
if (gaps.length) console.log(`  days between a song's appearances: shortest ${Math.min(...gaps)}, average ${Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)}${tooClose ? `; ${tooClose} came back early (end of schedule)` : ''}`);
if (swapped.length) { console.log(`  swapped skipped recordings (the game hasn't opened):`); swapped.forEach(s => console.log('    ' + s)); }
if (stuck.length) { console.log(`  WARNING - skipped recordings still scheduled${opened ? " (the game has opened, so they stay; they're never used again)" : ''}:`); stuck.forEach(s => console.log('    ' + s)); }
if (noRecording.length) console.log(`  no Archive recording, so not in the game: ${noRecording.length} songs`);
if (opened) {
  const daysLeft = puzzles.length - todayNo;
  console.log(`  runs out: last new puzzle #${puzzles.length} on ${dateOf(puzzles.length)}; then it repeats from puzzle #1 (${daysLeft} days from today)`);
  if (daysLeft < RUN_OUT_WARN_DAYS) console.log(`  WARNING - only ${daysLeft} days of new Little Bones puzzles left.`);
} else console.log(`  not open yet (EPOCH ${epochMatch[1]}-${epochMatch[2]}-${epochMatch[3]}): ${puzzles.length} days of puzzles from launch`);

{
  const lockArgs = [path.join(__dirname, 'check-game-schedule.js'), '--update-lock', ...(FORCE ? ['--reset', 'clip-pool.json'] : [])];
  const lockRun = require('child_process').spawnSync(process.execPath, lockArgs, { stdio: 'inherit' });
  if (lockRun.status !== 0) process.exitCode = 1;
}
