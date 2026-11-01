#!/usr/bin/env node
// build-game-pool.js
// Builds data/game-pool.json for 'Bring It All Back', the daily setlist game (v5).
//
// Pool: every show with at least 10 named songs on its setlist. The game walks
// the list one show per day (puzzle #1 = EPOCH in js/bring-it-all-back.js), so
// no show repeats until the whole pool has been played and the order never
// depends on client code.
//
// The order is LOCKED (v5.4.9, audit GAME-01). The first build shuffled every
// show once, with a fixed seed. Every run since keeps that order:
//   - every puzzle up to and including tomorrow is copied exactly (fans east of
//     Toronto get tomorrow's puzzle first)
//   - later days keep their show; only its details (venue, city, tour, songs,
//     recording flag) are refreshed from the data, so data fixes reach them
//   - a later show that leaves the pool (removed duplicate, date marked
//     uncertain, setlist trimmed under 10 songs) is replaced on its own day by a
//     newly eligible show, or by the last day's show if there are none; the run
//     lists every day that changed
//   - newly eligible shows go on the end
//   - a newly placed show (gap fill or on the end) avoids the month and year of any
//     show within 7 days of it, where it can (GAME-09); scheduled days never move for it
// Before saving, the run checks itself and refuses to save if any puzzle up to
// tomorrow would change. Check with node scripts/check-game-schedule.js after.
// If data/game-pool.json is missing it refuses to start a new schedule unless
// given --force (get the old one back with git checkout data/game-pool.json).
//
// Output (compact): { built, total, minYear, maxYear, shows: [ { id, d, v, c, st, co, t, r, sets } ] }
//   d  = 'dd-mm-yyyy'   v = venue   c = city   st = state   co = country code
//   t  = tour (or '')   r = 1 if the Hip Archive has a recording
//   sets = [ { l: 'Main' | 'Encore', s: [ 'Song', ... ] }, ... ]
//   built only changes when something else in the file does.
//
// Usage: node scripts/build-game-pool.js [--force]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'game-pool.json');
const MIN_SONGS = 10;
const SEED = 1984;
const LOCK_AHEAD_DAYS = 1;
const RUN_OUT_WARN_DAYS = 60;
const SPACING_DAYS = 7; // GAME-09: no same month and year within a week, for shows placed from now on
const FORCE = process.argv.includes('--force');

const setlists = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'setlists.min.json'), 'utf8')).setlists;
const showIdx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'show-index.json'), 'utf8'));

// Puzzle numbers, the same way the game counts them (local calendar date)
const dayNumber = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const epochMatch = fs.readFileSync(path.join(ROOT, 'js', 'bring-it-all-back.js'), 'utf8').match(/const EPOCH = '(\d{4})-(\d{2})-(\d{2})'/);
if (!epochMatch) throw new Error('Could not find EPOCH in js/bring-it-all-back.js');
const epoch = dayNumber(+epochMatch[1], +epochMatch[2], +epochMatch[3]);
const now = new Date();
const todayNo = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate()) - epoch + 1; // 0 or less = not open yet
const dateOf = no => new Date((epoch + no - 1) * 86400000).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

// mulberry32 - tiny seeded PRNG
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
// Stable base order, then a seeded Fisher-Yates shuffle
const shuffled = (list, seed) => {
  const arr = list.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const rand = rng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const shows = [];
for (const s of setlists) {
  // A show whose date is a guess (data/setlist-corrections.json) can't be a puzzle answer
  if (s.dateNote) continue;
  const songs = (s.songs || []).filter(x => !x.tape && x.name && x.name.trim());
  if (songs.length < MIN_SONGS) continue;
  // setlist.fm set labels are messy ('Set #3', 'post-broadcast set', '"Fully
  // Completely" album in entirety') and some give the show away, so keep only
  // the shape: consecutive runs of 'Main' songs and 'Encore' songs.
  const sets = [];
  for (const x of songs) {
    const label = /encore/i.test(x.set || '') ? 'Encore' : 'Main';
    let group = sets[sets.length - 1];
    if (!group || group.l !== label) { group = { l: label, s: [] }; sets.push(group); }
    group.s.push(x.cover ? x.name.trim() + ' (cover)' : x.name.trim());
  }
  const idx = showIdx[s.id];
  shows.push({
    id: s.id, d: s.date, v: s.venue || '', c: s.city || '', st: s.state || '', co: s.country || '',
    t: s.tour || '', r: idx && idx[2] ? 1 : 0, sets,
  });
}
const byId = new Map(shows.map(s => [s.id, s]));

// ─── Build (append-only) ───
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (!old && !FORCE) {
  console.error('STOPPED - nothing saved. There is no data/game-pool.json, so this would start a brand-new schedule');
  console.error('and every Bring It All Back puzzle, past and future, would change. To get the current one back:');
  console.error('  git checkout data/game-pool.json');
  console.error('Only if you really mean to start the whole game over, run: node scripts/build-game-pool.js --force');
  process.exit(1);
}

let pool;
const lockedThrough = old ? Math.min(old.shows.length, Math.max(0, todayNo + LOCK_AHEAD_DAYS)) : 0;
const replaced = [], keptPlayed = [];
let appended = 0;
if (!old) {
  pool = shuffled(shows, SEED);
} else {
  pool = old.shows.map((p, i) => {
    if (i < lockedThrough) {
      if (!byId.has(p.id)) keptPlayed.push(`#${i + 1} (${dateOf(i + 1)}) show ${p.id} (${p.d})`);
      return p;
    }
    return byId.get(p.id) || null; // null = left the pool, filled below
  });
  const inPool = new Set(pool.filter(Boolean).map(p => p.id));
  const newcomers = shuffled(shows.filter(s => !inPool.has(s.id)), SEED + old.shows.length);
  // GAME-09: a newly placed show avoids the same month and year as any show within
  // SPACING_DAYS of its day, so yesterday's answer isn't a head start. Takes the first
  // newcomer (in shuffled order) that fits, or the first one if none does.
  const monthYear = s => s.d.slice(3);
  const takeSpaced = at => {
    const near = new Set();
    for (let k = Math.max(0, at - SPACING_DAYS); k <= at + SPACING_DAYS && k < pool.length; k++) {
      if (k !== at && pool[k]) near.add(monthYear(pool[k]));
    }
    const pick = newcomers.findIndex(s => !near.has(monthYear(s)));
    return newcomers.splice(pick < 0 ? 0 : pick, 1)[0];
  };
  const day = i => `#${i + 1} (${dateOf(i + 1)})`;
  const dropped = i => replaced.push(`${day(i)} show ${old.shows[i].id} (${old.shows[i].d}) left the pool; nothing to replace it, so the pool is one day shorter`);
  for (let i = 0; i < pool.length; i++) {
    if (pool[i]) continue;
    let fill = takeSpaced(i);
    if (!fill) {
      // No new shows: the last day's show moves into the gap, and the pool gets a day shorter
      while (pool.length - 1 > i && !pool[pool.length - 1]) { dropped(pool.length - 1); pool.pop(); }
      if (pool.length - 1 > i) {
        fill = pool.pop();
        replaced.push(`${day(pool.length)} show ${fill.id} (${fill.d}) moved to ${day(i)} to fill a gap; the pool is one day shorter`);
      }
    }
    if (fill) { replaced.push(`${day(i)} show ${old.shows[i].id} (${old.shows[i].d}) left the pool -> show ${fill.id} (${fill.d})`); pool[i] = fill; }
    else { dropped(i); pool.splice(i, 1); i--; }
  }
  appended = newcomers.length;
  while (newcomers.length) { pool.push(null); pool[pool.length - 1] = takeSpaced(pool.length - 1); }

  // Self-check: nothing up to tomorrow changed, and every other day kept its show or is listed above
  for (let i = 0; i < old.shows.length; i++) {
    const same = pool[i] && pool[i].id === old.shows[i].id;
    if (i < lockedThrough && (!same || JSON.stringify(pool[i]) !== JSON.stringify(old.shows[i]))) {
      throw new Error(`Refusing to save: puzzle #${i + 1} (${dateOf(i + 1)}) may already be in play and would change`);
    }
    if (!same && !replaced.some(r => r.startsWith(`#${i + 1} `))) throw new Error(`Refusing to save: puzzle #${i + 1} moved without a reason`);
  }
}

const years = pool.map(s => +s.d.split('-')[2]);
const body = { total: pool.length, minYear: Math.min(...years), maxYear: Math.max(...years), shows: pool };
const sameAsOld = old && JSON.stringify(body) === JSON.stringify({ total: old.total, minYear: old.minYear, maxYear: old.maxYear, shows: old.shows });
fs.writeFileSync(OUT, JSON.stringify({ built: sameAsOld ? old.built : new Date().toISOString().slice(0, 10), ...body }) + '\n');

console.log(`wrote data/game-pool.json: ${pool.length} shows (${Math.min(...years)}-${Math.max(...years)}), ${pool.filter(s => s.r).length} with recordings`);
if (old) {
  const keptDays = old.shows.map((p, i) => i).filter(i => pool[i] && pool[i].id === old.shows[i].id);
  const refreshed = keptDays.filter(i => i >= lockedThrough && JSON.stringify(pool[i]) !== JSON.stringify(old.shows[i])).length;
  console.log(`  ${sameAsOld ? 'no change' : 'changed'}: ${keptDays.length} of ${old.shows.length} days kept their show (#1-#${lockedThrough} copied exactly), ${refreshed} later days refreshed details, ${appended} added on the end`);
  replaced.sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)).forEach(r => console.log('  CHANGED ' + r));
  keptPlayed.forEach(r => console.log(`  NOTE - ${r} is no longer in the pool, but that day may already be in play, so it stays`));
}

// GAME-05: when the pool runs out (the game then repeats from puzzle #1)
const daysLeft = pool.length - todayNo;
console.log(`  runs out: last new puzzle #${pool.length} on ${dateOf(pool.length)}; from ${dateOf(pool.length + 1)} it repeats from puzzle #1 (${daysLeft} days from today)`);
if (daysLeft < RUN_OUT_WARN_DAYS) console.log(`  WARNING - only ${daysLeft} days of new Bring It All Back puzzles left. Decide what happens after ${dateOf(pool.length)} (see docs/CHANGELOG.md v5.4.9).`);

// Add the new days to data/game-schedule-lock.json, the fixed record of every scheduled
// puzzle (audit GAME-01). It refuses, and exits 1, if a locked day changed.
{
  const lockArgs = [path.join(__dirname, 'check-game-schedule.js'), '--update-lock', ...(FORCE ? ['--reset', 'game-pool.json'] : [])];
  const lockRun = require('child_process').spawnSync(process.execPath, lockArgs, { stdio: 'inherit' });
  if (lockRun.status !== 0) process.exitCode = 1;
}
