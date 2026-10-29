#!/usr/bin/env node
// build-game-pool.js
// Builds data/game-pool.json for 'Bring It All Back', the daily setlist game (v5).
//
// Pool: every show with at least 10 named songs on its setlist. The shows are
// shuffled once, with a fixed seed, and stored in that order - the game just
// walks the list one show per day, so no show repeats until the whole pool has
// been played and the order never depends on client code.
//
// Output (compact): { built, total, shows: [ { id, d, v, c, st, co, t, r, sets } ] }
//   d  = 'dd-mm-yyyy'   v = venue   c = city   st = state   co = country code
//   t  = tour (or '')   r = 1 if the Hip Archive has a recording
//   sets = [ { l: 'Main' | 'Encore', s: [ 'Song', ... ] }, ... ]
//
// Usage: node scripts/build-game-pool.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIN_SONGS = 10;
const SEED = 1984;

const setlists = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'setlists.min.json'), 'utf8')).setlists;
const showIdx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'show-index.json'), 'utf8'));

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

// Stable base order, then a seeded Fisher-Yates shuffle
shows.sort((a, b) => (a.id < b.id ? -1 : 1));
const rand = rng(SEED);
for (let i = shows.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [shows[i], shows[j]] = [shows[j], shows[i]];
}

const years = shows.map(s => +s.d.split('-')[2]);
fs.writeFileSync(path.join(ROOT, 'data', 'game-pool.json'),
  JSON.stringify({ built: new Date().toISOString().slice(0, 10), total: shows.length, minYear: Math.min(...years), maxYear: Math.max(...years), shows }) + '\n');
console.log(`wrote data/game-pool.json: ${shows.length} shows (${Math.min(...years)}-${Math.max(...years)}), ${shows.filter(s => s.r).length} with recordings`);
