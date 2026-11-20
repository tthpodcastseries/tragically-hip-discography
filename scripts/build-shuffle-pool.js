#!/usr/bin/env node
// build-shuffle-pool.js
// The small data file behind the two shuffle machines on the home page (js/shuffle-machine.js),
// so the home page never downloads the big song and show files just to spin.
//
//   data/shuffle-pool.json
//     songs: [title, album, year, slug]   every official song with an album, from song-index.json.
//                                         The album is the one the song page names ("From ..."):
//                                         the earliest studio album or EP, else the earliest release.
//     shows: [id, isoDate, place, venue]  every show with a Hip Archive recording, from tour-map.json.
//                                         place is "City, ST" in North America, "City, Country" elsewhere.
//
// Run after build-song-index.js and build-light-data.js.
// Usage: node scripts/build-shuffle-pool.js           write the file
//        node scripts/build-shuffle-pool.js --check   only report if it is out of date

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const CHECK = process.argv.includes('--check');
const OUT = path.join(ROOT, 'data', 'shuffle-pool.json');

const songIndex = read('song-index.json');
const tourMap = read('tour-map.json');

// Same rule as the song pages (js/song.js): where the song first came out
function origin(albums) {
  const sorted = [...albums].sort((x, y) => x[1] - y[1]);
  return sorted.find(a => (a[2] === 'studio' || a[2] === 'eps') && !a[4]) || sorted[0];
}

const songs = [];
const leftOut = [];
for (const s of songIndex.songs) {
  const a = s.a && s.a.length ? origin(s.a) : null;
  if (!a) { leftOut.push(s.t); continue; } // a reel needs an album to land on
  songs.push([s.t, a[0], a[1], s.s]);
}
songs.sort((x, y) => x[2] - y[2] || x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]));

const shows = tourMap
  .filter(g => g.trackCount && g.isoDate)
  .map(g => {
    const where = g.state || g.countryName || g.country || '';
    return [String(g.id), g.isoDate, g.city + (where ? ', ' + where : ''), g.venue || ''];
  })
  .sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]));

const text = JSON.stringify({ songs, shows }) + '\n';
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
if (old !== text) {
  if (CHECK) { console.error('out of date: data/shuffle-pool.json (run node scripts/build-shuffle-pool.js)'); process.exit(1); }
  fs.writeFileSync(OUT, text);
  console.log(`data/shuffle-pool.json: ${songs.length} songs, ${shows.length} shows with recordings, ${(text.length / 1024).toFixed(1)} KB`);
} else {
  console.log(`data/shuffle-pool.json is up to date (${songs.length} songs, ${shows.length} shows).`);
}
if (leftOut.length && !CHECK) console.log('Left out (no album on record): ' + leftOut.join(', '));
