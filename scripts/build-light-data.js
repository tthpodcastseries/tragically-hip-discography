#!/usr/bin/env node
// build-light-data.js
// Small data files so phones don't download the big ones just to open a page
// (v5.4.16, audit PERF-03 and PERF-04). Reads only the files below; never touches
// the game pools.
//
//   data/on-this-day.json  homepage On This Day and Show of the Day: every show with a
//                          confirmed date, without its setlist (from setlists.min.json,
//                          show-index.json and show-videos.json)
//   data/tour-map.json     the tour map's shows without their track lists; trackCount says
//                          how many tracks the Hip Archive recording has (from tth-tour-data.json)
//   data/tour-tracks.json  { "<showId>": [{ name, url, duration? }] }, fetched on first Play
//
// Run after any setlist or tour data change (after build-show-index.js).
// Usage: node scripts/build-light-data.js           write the files
//        node scripts/build-light-data.js --check   only report if they are out of date

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const CHECK = process.argv.includes('--check');

const setlists = read('setlists.min.json').setlists;
const showIndex = read('show-index.json');
const byShow = read('show-videos.json').byShow || {};
const tour = read('tth-tour-data.json');

// setlist.fm stores some regions outside North America as bare numbers ("Amsterdam, 07, NL").
// They mean nothing to fans, so the light files leave them out (audit FUNC-08).
const isRegionCode = st => /^\d+$/.test(String(st || '').trim());
const fanState = st => (isRegionCode(st) ? undefined : st);

// On This Day: shows with a guessed date (dateNote) never show there, so they're left out
const otd = [];
for (const s of setlists) {
  if (s.dateNote) continue;
  const songs = s.songs || [];
  const o = { id: s.id, date: s.date, venue: s.venue, city: s.city, state: fanState(s.state), country: s.country, tour: s.tour };
  // The two counts the homepage used: On This Day's, and Show of the Day's (named songs only)
  o.songCount = s.songCount || songs.filter(x => !x.tape).length;
  const named = songs.filter(x => !x.tape && x.name).length;
  if (named !== o.songCount) o.namedCount = named;
  if (showIndex[s.id] && showIndex[s.id][2]) o.rec = 1;
  if (byShow[s.id]) o.video = 1;
  otd.push(o);
}

const light = [];
const tracks = {};
for (const g of tour) {
  const o = Object.assign({}, g);
  delete o.tracks;
  if (isRegionCode(o.state)) delete o.state;
  if (g.tracks && g.tracks.length) {
    o.trackCount = g.tracks.length;
    tracks[g.id] = g.tracks.map(t => (t.duration ? { name: t.name, url: t.url, duration: t.duration } : { name: t.name, url: t.url }));
  }
  light.push(o);
}

const outputs = {
  'on-this-day.json': JSON.stringify({ shows: otd }) + '\n',
  'tour-map.json': JSON.stringify(light) + '\n',
  'tour-tracks.json': JSON.stringify(tracks) + '\n'
};

let stale = [];
for (const [name, text] of Object.entries(outputs)) {
  const file = path.join(ROOT, 'data', name);
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === text) continue;
  stale.push(name);
  if (!CHECK) fs.writeFileSync(file, text);
}

if (CHECK) {
  if (stale.length) { console.error(`out of date: ${stale.join(', ')} (run node scripts/build-light-data.js)`); process.exit(1); }
  console.log('light data files are up to date');
} else {
  const kb = n => Math.round(Buffer.byteLength(outputs[n]) / 1024) + ' KB';
  console.log(`on-this-day.json: ${otd.length} shows, ${kb('on-this-day.json')}`);
  console.log(`tour-map.json: ${light.length} shows, ${Object.keys(tracks).length} with recordings, ${kb('tour-map.json')}`);
  console.log(`tour-tracks.json: ${kb('tour-tracks.json')}`);
  console.log(stale.length ? `changed: ${stale.join(', ')}` : 'no change');
}
