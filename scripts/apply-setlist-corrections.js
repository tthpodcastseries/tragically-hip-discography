#!/usr/bin/env node
// apply-setlist-corrections.js
// Layers the hand-checked fixes in data/setlist-corrections.json on top of the
// setlist.fm pull (data/setlists.min.json) and the tour map data
// (data/tth-tour-data.json). Safe to re-run: every fix is keyed by show ID and
// leaves already-fixed data alone. Re-run after any fresh setlist.fm fetch,
// then rebuild the derived files:
//   node scripts/build-show-index.js && node scripts/build-canonical-songs.js &&
//   node scripts/build-song-index.js && node scripts/build-show-video-map.js &&
//   node scripts/build-game-pool.js
//
// Fix types (see the file for the why of each one):
//   remove           duplicate entries, dropped from both files
//   keepSongs        trim a setlist to the songs that were really played
//   dateUncertain    adds dateNote; On This Day and the daily game skip these
//   tour             set the tour name on listed shows
//   removeRecording  detach a Hip Archive recording matched to the wrong show
//   renameSongs      fix song-name typos everywhere
//   dropSongsMatching  regex for blank and non-song entries (interviews, intros)
//
// Usage: node scripts/apply-setlist-corrections.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const fix = read('data/setlist-corrections.json');
const sl = read('data/setlists.min.json');
const tour = read('data/tth-tour-data.json');

const drop = new RegExp(fix.dropSongsMatching, 'i');
const counts = { removed: 0, trimmed: 0, flagged: 0, retoured: 0, unlinked: 0, renamed: 0, dropped: 0 };
const tourFor = {};
for (const [name, t] of Object.entries(fix.tour || {})) for (const id of t.ids) tourFor[id] = name;

function fixShow(s, isTourData) {
  const keep = fix.keepSongs[s.id];
  if (keep && !isTourData && s.songs.length !== keep.songs.length) {
    s.songs = s.songs.filter(x => keep.songs.includes(x.name));
    counts.trimmed++;
  }
  if (fix.dateUncertain[s.id] && s.dateNote !== fix.dateUncertain[s.id]) {
    s.dateNote = fix.dateUncertain[s.id];
    if (!isTourData) counts.flagged++;
  } else if (s.dateNote && !fix.dateUncertain[s.id]) {
    delete s.dateNote; // the flag was taken back out of the corrections file
  }
  if (tourFor[s.id] && s.tour !== tourFor[s.id]) {
    s.tour = tourFor[s.id];
    if (!isTourData) counts.retoured++;
  }
  if (isTourData) {
    if (fix.removeRecording[s.id] && (s.archiveUrl || (s.tracks || []).length)) {
      s.archiveUrl = null; s.archiveFormat = null; s.tracks = [];
      counts.unlinked++;
    }
    return;
  }
  const before = s.songs.length;
  s.songs = s.songs.filter(x => !drop.test(x.name || ''));
  counts.dropped += before - s.songs.length;
  for (const x of s.songs) {
    if (fix.renameSongs[x.name]) { x.name = fix.renameSongs[x.name]; counts.renamed++; }
  }
}

const before = sl.setlists.length;
sl.setlists = sl.setlists.filter(s => !fix.remove[s.id]);
counts.removed = before - sl.setlists.length;
tour.splice(0, tour.length, ...tour.filter(g => !fix.remove[g.id]));
sl.setlists.forEach(s => fixShow(s, false));
tour.forEach(g => fixShow(g, true));

// Keep the tour map's per-show song counts in step with the setlists
const songsById = new Map(sl.setlists.map(s => [s.id, s.songs.length]));
for (const g of tour) if (songsById.has(g.id)) g.songCount = songsById.get(g.id);

// Header stats, computed the same way as the original setlist.fm pull
const years = sl.setlists.map(s => +s.date.split('-')[2]);
sl.totalSetlists = sl.setlists.length;
sl.setlistsWithSongs = sl.setlists.filter(s => s.songs.length).length;
sl.yearRange = Math.min(...years) + '-' + Math.max(...years);
sl.uniqueTours = new Set(sl.setlists.filter(s => s.tour).map(s => s.tour)).size;
sl.uniqueVenues = new Set(sl.setlists.filter(s => s.venue).map(s => s.venue)).size;
sl.uniqueCities = new Set(sl.setlists.map(s => s.city)).size;

fs.writeFileSync(path.join(ROOT, 'data', 'setlists.min.json'), JSON.stringify(sl));
fs.writeFileSync(path.join(ROOT, 'data', 'tth-tour-data.json'), JSON.stringify(tour, null, 2) + '\n');
console.log(`applied setlist corrections: ${counts.removed} duplicates removed, ${counts.trimmed} setlists trimmed, ` +
  `${counts.flagged} dates flagged uncertain, ${counts.retoured} tours fixed, ${counts.unlinked} recordings unlinked, ` +
  `${counts.renamed} songs renamed, ${counts.dropped} blank/non-song entries dropped`);
console.log(`now ${sl.totalSetlists} shows, ${sl.setlistsWithSongs} with setlists, ${sl.uniqueCities} cities, ${sl.uniqueTours} tours`);
