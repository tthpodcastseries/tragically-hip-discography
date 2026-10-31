#!/usr/bin/env node
// build-trunk-pool.js
// Builds data/trunk-pool.json for '(Un)Locked in the Trunk of a Car', the daily
// lyrics game (v5.4), played at /unlocked (unlocked.html).
//
// One song per puzzle: five words from its lyrics, scrambled. The song title is
// the key. Words run from the vaguest (shared with a few other songs) at the top
// to the most telling (only in this song, sung often) at the bottom.
//
// A word is used only if it:
//   - has 4+ letters, plain a-z (no apostrophes or accents), and isn't filler
//   - isn't part of the song's title
//   - appears in 6 or fewer songs
//   - is a real word (macOS /usr/share/dict/words, with simple endings) or is
//     always capitalised mid-line in the song (a name or place)
//   - has no other anagram in the dictionary or the lyrics ('stop' vs 'pots' is out),
//     so the scramble has one answer
//
// The order is LOCKED once built: existing puzzles keep their place, words and
// scrambles, and songs that gain lyrics later are shuffled onto the end. So the
// puzzle for a given day never changes after launch. Delete data/trunk-pool.json
// only to start the whole order over (never after launch).
//
// Output: { built, total, titles: [[slug, title] ...], puzzles: [ { s, t, w: [[word, SCRAMBLE] x5], sp, lv } ] }
//   titles is every song on the official list, for the guess box.
//   sp (Spotify track link) and lv (latest Hip Archive show with the song) power the
//   'Play it' links after the reveal. Unlike the words, they're refreshed every run.
//
// Usage: node scripts/build-trunk-pool.js   (re-run after scripts/build-song-index.js
// whenever lyrics.json gains songs)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'trunk-pool.json');
const WORDS = 5;
const MAX_SONGS_WITH_WORD = 6;
const SEED = 1992; // Fully Completely

const songIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'song-index.json'), 'utf8'));
const lyrics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lyrics.json'), 'utf8')).songs;
const index = songIndex.songs;

// Spotify track links: lifted from the inline map in discography-app.js
const app = fs.readFileSync(path.join(ROOT, 'js', 'discography-app.js'), 'utf8');
const spMatch = app.match(/const spotifyTrackURLs = (\{[\s\S]*?\n\});/);
if (!spMatch) throw new Error('Could not find spotifyTrackURLs in discography-app.js');
const spotifyTrackURLs = new Function('return ' + spMatch[1])();

// mulberry32 - tiny seeded PRNG (same as build-game-pool.js)
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

// ─── Words ───
const FILLER = new Set(('that this with from your have what when where there they them then than were will would could should ' +
  'into just like been about some because over only well know never ever every gonna wanna gotta yeah ooh oooh whoa hey ' +
  'cause cuz till until upon onto also very much more most such even each other another here those these their thing things ' +
  'said says make made take took come came goes going gone want does doing done being have having seem seems away back down').split(' '));
// Spellings in lyrics.json that look wrong - never use them until they're checked
const SKIP_WORDS = new Set(['northhumberland', 'forksake']);
const plain = s => s.normalize('NFKD');
// Tokens with their original case; apostrophes and accents kept so those words can be skipped
const tokens = text => plain(text).match(/[\p{L}\p{M}']+/gu) || [];

const dictPath = '/usr/share/dict/words';
if (!fs.existsSync(dictPath)) throw new Error('No dictionary at ' + dictPath + ' - this script needs macOS (or a words file there)');
const dict = new Set(fs.readFileSync(dictPath, 'utf8').toLowerCase().split('\n').filter(Boolean));
const ENDINGS = ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers', 'est', 'y'];
const isWord = w => dict.has(w) || ENDINGS.some(e => w.endsWith(e) && w.length - e.length >= 3 &&
  (dict.has(w.slice(0, -e.length)) || dict.has(w.slice(0, -e.length) + 'e')));

// Every song's words, and how many songs each word is in
const songWords = {};
const df = {};
for (const [key, text] of Object.entries(lyrics)) {
  const count = {}, caps = {};
  for (const line of text.split('\n')) {
    tokens(line).forEach((tok, i) => {
      const w = tok.toLowerCase();
      if (!/^[a-z]+$/.test(w)) return;
      count[w] = (count[w] || 0) + 1;
      // A name or place: capitalised every time it's sung mid-line (a line's first word doesn't count)
      if (i > 0) caps[w] = (caps[w] === undefined ? true : caps[w]) && /^[A-Z]/.test(tok);
    });
  }
  songWords[key] = { count, caps };
  for (const w of Object.keys(count)) df[w] = (df[w] || 0) + 1;
}

// Anagram families across the dictionary (plus plurals) and every lyric word
const sig = w => [...w].sort().join('');
const family = new Map();
const addFam = w => { const k = sig(w); if (!family.has(k)) family.set(k, new Set()); family.get(k).add(w); };
for (const w of dict) { addFam(w); addFam(w + 's'); }
for (const w of Object.keys(df)) addFam(w);
const oneAnswer = w => [...family.get(sig(w))].every(v => v === w);

function pickWords(key, title) {
  const { count, caps } = songWords[key];
  const titleWords = (plain(title).toLowerCase().match(/[a-z]+/g) || []).filter(t => t.length >= 3);
  const inTitle = w => titleWords.some(t => w === t || (t.length >= 4 && (w.includes(t) || t.includes(w))));
  const cands = Object.keys(count).filter(w =>
    w.length >= 4 && !FILLER.has(w) && !SKIP_WORDS.has(w) && !inTitle(w) && df[w] <= MAX_SONGS_WITH_WORD &&
    !/(.)\1\1/.test(w) && /[aeiouy]/.test(w) &&
    (isWord(w) || caps[w] === true) && oneAnswer(w));
  if (cands.length < WORDS) return null;
  // How much a word gives away: sung often, in few other songs
  const tell = w => count[w] / (df[w] * df[w]);
  cands.sort((a, b) => tell(a) - tell(b) || a.localeCompare(b));
  // Spread the picks from the vaguest to the most telling
  const picked = [];
  for (let i = 0; i < WORDS; i++) {
    let j = Math.round(i * (cands.length - 1) / (WORDS - 1));
    while (picked.includes(cands[j])) j++;
    picked.push(cands[j]);
  }
  return picked;
}

// Scramble so no more than a third of the letters stay put (never the word itself)
function scramble(word, rand) {
  let best = null;
  for (let tries = 0; tries < 200; tries++) {
    const s = shuffle([...word], rand).join('');
    if (s === word) continue;
    const same = [...s].filter((c, i) => c === word[i]).length;
    if (!best || same < best.same) best = { s, same };
    if (same <= Math.floor(word.length / 3)) break;
  }
  return (best ? best.s : [...word].reverse().join('')).toUpperCase();
}

// ─── Build (append-only) ───
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const puzzles = old ? old.puzzles.slice() : [];
const have = new Set(puzzles.map(p => p.s));
const rand = rng(SEED + puzzles.length);

const skipped = [];
const fresh = [];
for (const so of index) {
  if (!so.l || have.has(so.s)) continue;
  const words = pickWords(so.l, so.t);
  if (!words) { skipped.push(so.t); continue; }
  fresh.push({ s: so.s, t: so.t, w: words });
}
shuffle(fresh, rand).forEach(p => {
  p.w = p.w.map(w => [w, scramble(w, rand)]);
  puzzles.push(p);
});

// A locked puzzle whose song changed title or slug still plays; flag it
const bySlug = new Map(index.map(so => [so.s, so]));

// Play links (refreshed every run)
for (const p of puzzles) {
  const so = bySlug.get(p.s);
  p.sp = spotifyTrackURLs[p.t] || '';
  const rec = so && so.r.length ? so.r[so.r.length - 1] : null;
  p.lv = rec ? String(songIndex.shows[rec[0]][0]) : '';
}
const stale = puzzles.filter(p => !bySlug.has(p.s)).map(p => p.t);

const out = {
  built: new Date().toISOString().slice(0, 10),
  total: puzzles.length,
  titles: index.map(so => [so.s, so.t]),
  puzzles,
};
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');

console.log(`  play links: ${puzzles.filter(p => p.sp).length} Spotify tracks (the rest use search), ${puzzles.filter(p => p.lv).length} with a Hip Archive show`);
const lens = puzzles.flatMap(p => p.w.map(w => w[0].length));
console.log(`wrote data/trunk-pool.json: ${puzzles.length} puzzles (${fresh.length} new, ${puzzles.length - fresh.length} kept), ${out.titles.length} titles, ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
console.log(`  word length ${Math.min(...lens)}-${Math.max(...lens)}, average ${(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1)}`);
if (skipped.length) console.log(`  not enough usable words: ${skipped.join(', ')}`);
if (stale.length) console.log(`  WARNING - songs no longer in song-index.json: ${stale.join(', ')}`);
