#!/usr/bin/env node
// build-trunk-pool.js
// Builds data/trunk-pool.json for '(Un)Locked in the Trunk of a Car', the daily
// lyrics game (v5.4), played at /unlocked (unlocked.html).
//
// One song per puzzle: five words from its lyrics, scrambled. The song title is
// the key. Words run from the vaguest (shared with a few other songs) at the top
// to the most telling (only in this song, sung often) at the bottom.
//
// Songs come back: each song gives up to 3 versions, each with its own five words
// (no word is used twice for a song), and the best version goes out first. The
// schedule mixes them so the same song never returns within 90 days.
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
// scrambles, and songs that gain lyrics later are added to the end (first version
// only, since a short tail can't keep repeats 90 days apart). So the puzzle for a
// given day never changes after launch. Delete data/trunk-pool.json only to start
// the whole schedule over (never after launch, November 4, 2026).
//
// Output: { built, total, titles: [[slug, title] ...], puzzles: [ { s, t, v, w: [[word, SCRAMBLE] x5], sp, lv } ] }
//   v is the version of the song (1 = its first appearance).
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
const MAX_VERSIONS = 3;
const MIN_GAP_DAYS = 90;
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

// A song's versions, best first: each is five words, vaguest to most telling
function pickVersions(key, title) {
  const { count, caps } = songWords[key];
  const titleWords = (plain(title).toLowerCase().match(/[a-z]+/g) || []).filter(t => t.length >= 3);
  const inTitle = w => titleWords.some(t => w === t || (t.length >= 4 && (w.includes(t) || t.includes(w))));
  const cands = Object.keys(count).filter(w =>
    w.length >= 4 && !FILLER.has(w) && !SKIP_WORDS.has(w) && !inTitle(w) && df[w] <= MAX_SONGS_WITH_WORD &&
    !/(.)\1\1/.test(w) && /[aeiouy]/.test(w) &&
    (isWord(w) || caps[w] === true) && oneAnswer(w));
  // Every version needs its own giveaway: a word only this song has
  const k = Math.min(MAX_VERSIONS, Math.floor(cands.length / WORDS), cands.filter(w => df[w] === 1).length);
  if (k < 1) return [];
  // How much a word gives away: sung often, in few other songs
  const tell = w => count[w] / (df[w] * df[w]);
  cands.sort((a, b) => tell(b) - tell(a) || a.localeCompare(b));
  // Deal the words out like cards, most telling first, so each version gets a
  // full range and version 1 holds the single most telling word
  const hands = Array.from({ length: k }, () => []);
  cands.forEach((w, i) => hands[i % k].push(w));
  return hands.map(hand => {
    const asc = hand.reverse();
    // Spread the picks from the vaguest to the most telling
    const picked = [];
    for (let i = 0; i < WORDS; i++) {
      let j = Math.round(i * (asc.length - 1) / (WORDS - 1));
      while (picked.includes(asc[j])) j++;
      picked.push(asc[j]);
    }
    return picked;
  });
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
const songs = []; // { s, t, versions: [[word x5] ...] }
for (const so of index) {
  if (!so.l || have.has(so.s)) continue;
  const versions = pickVersions(so.l, so.t);
  if (!versions.length) { skipped.push(so.t); continue; }
  // Added after launch: first version only (see the note at the top)
  songs.push({ s: so.s, t: so.t, versions: old ? versions.slice(0, 1) : versions });
}
shuffle(songs, rand);

// Schedule: one puzzle a day. Each day picks at random from the songs that are
// due (never played, or last played 90+ days ago), favouring songs with more
// versions left so the repeats spread across the year instead of piling up at
// the end. Versions go out in order.
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
    // Nothing is due (only near the very end): take the song that waited longest
    tooClose++;
    const wait = so => day - lastDay.get(so.s);
    due = [open.reduce((a, b) => (wait(b) > wait(a) ? b : a))];
  }
  const weight = so => left.get(so.s) ** 3;
  let r = rand() * due.reduce((n, so) => n + weight(so), 0);
  const so = due.find(x => (r -= weight(x)) < 0) || due[due.length - 1];
  const v = next.get(so.s);
  fresh.push({ s: so.s, t: so.t, v: v + 1, w: so.versions[v].map(w => [w, scramble(w, rand)]) });
  next.set(so.s, v + 1);
  left.set(so.s, left.get(so.s) - 1);
  lastDay.set(so.s, day);
}
puzzles.push(...fresh);

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
const byVersion = [1, 2, 3].map(v => puzzles.filter(p => (p.v || 1) === v).length);
console.log(`  ${new Set(puzzles.map(p => p.s)).size} songs; first appearances ${byVersion[0]}, second ${byVersion[1]}, third ${byVersion[2]}`);
const gaps = [];
const seen = new Map();
puzzles.forEach((p, i) => { if (seen.has(p.s)) gaps.push(i - seen.get(p.s)); seen.set(p.s, i); });
if (gaps.length) console.log(`  days between a song's appearances: shortest ${Math.min(...gaps)}, average ${Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)}${tooClose ? `; ${tooClose} came back early (end of schedule)` : ''}`);
console.log(`  word length ${Math.min(...lens)}-${Math.max(...lens)}, average ${(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1)}`);
if (skipped.length) console.log(`  not enough usable words: ${skipped.join(', ')}`);
if (stale.length) console.log(`  WARNING - songs no longer in song-index.json: ${stale.join(', ')}`);
