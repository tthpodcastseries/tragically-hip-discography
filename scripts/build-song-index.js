#!/usr/bin/env node
// build-song-index.js
// Builds data/song-index.json for the song pages (v5.1, 'Grace, Too'), served at
// /song/<slug> by song.html. One entry per song on jD's official list
// (data/canonical-songs.json), so a song page never has to download the 2 MB
// setlist file or the 2.6 MB tour data.
//
// Output (compact):
//   { built, shows: [ [id, 'yyyy-mm-dd', venue, city, state, country, tour, hasRecording] ... ],
//     songs: [ { s: slug, t: title, p: [showIdx ...], r: [[showIdx, trackNo] ...],
//                a: [[album, year, category, trackNo, versionNote] ...],
//                k: { rank, pts, url, ep } | null } ... ] }
//   shows are sorted oldest first, so p[0] is the live debut and p[p.length - 1] the
//   latest performance. p matches livePlays in canonical-songs.json (medleys count
//   for both songs, covers and tape are skipped) - the script checks this.
//   r lists the Hip Archive recordings of the song: the show, and the track number
//   in that recording.
//
// Also rewrites the song block between the markers in sitemap.xml.
//
// Usage: node scripts/build-song-index.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Same normalizer and rules as scripts/build-canonical-songs.js - keys must match
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const NOT_SONGS = /^\s*(interview|introduction|intro|outro)\b/i;
const VERSION_NOTE = /\s*\((Live|Demo|Alternate Version|Super Farmer Nano Baby Version)\)\s*$/i;

const canon = JSON.parse(read('data/canonical-songs.json'));
const aliases = canon.aliases || {};
const setlists = JSON.parse(read('data/setlists.min.json')).setlists;
const tour = JSON.parse(read('data/tth-tour-data.json'));
const disc = JSON.parse(read('data/discography.json'));

// Setlist and recording spellings -> the key used in canonical-songs.json
const songKey = name => { const k = norm(name); return aliases[k] || k; };
const partsOf = name => String(name || '').split(' / ').filter(p => p.trim() && !NOT_SONGS.test(p));

// ─── Shows, oldest first ───
const tourById = new Map(tour.map(g => [g.id, g]));
const shows = setlists.map(s => {
  const g = tourById.get(s.id) || {};
  return { id: s.id, iso: g.isoDate || s.date.split('-').reverse().join('-'), s, rec: (g.tracks || []).length > 0, tracks: g.tracks || [] };
}).sort((a, b) => a.iso.localeCompare(b.iso) || a.id.localeCompare(b.id));
const showIdx = new Map(shows.map((x, i) => [x.id, i]));

// ─── Songs ───
const slugOf = t => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const songs = canon.songs.map(c => ({
  s: slugOf(c.title), t: c.title, keys: new Set(c.setlistKeys),
  // A version's own name too, for demos released under another title
  // ('Angst on the Planks (Demo)' is Cordelia)
  titleKeys: new Set([norm(c.title), ...c.versions.map(norm),
    ...c.versions.map(v => norm(v.replace(/\s*\(.*\)\s*$/, '')))]),
  p: [], r: [], a: [], k: null, livePlays: c.livePlays,
}));
const slugs = new Set(songs.map(x => x.s));
if (slugs.size !== songs.length) throw new Error('Two songs share a slug');
const byKey = new Map();
for (const so of songs) for (const k of so.keys) byKey.set(k, so);

// Live performances
shows.forEach((x, i) => {
  for (const song of x.s.songs || []) {
    if (song.tape || song.cover || !song.name || !song.name.trim()) continue;
    for (const part of partsOf(song.name)) {
      const so = byKey.get(songKey(part));
      if (so) so.p.push(i);
    }
  }
});

// Hip Archive recordings: which track of which show
let trackHits = 0, trackMisses = 0;
shows.forEach((x, i) => {
  x.tracks.forEach((t, n) => {
    const so = partsOf(t.name).map(p => byKey.get(songKey(p)))[0];
    if (so) { trackHits++; so.r.push([i, n + 1]); } else trackMisses++;
  });
});

// Albums
const byTitle = new Map();
for (const so of songs) for (const k of so.titleKeys) byTitle.set(k, so);
for (const a of disc.albums) {
  (Array.isArray(a.tracks) ? a.tracks : []).forEach((t, n) => {
    const m = t.match(VERSION_NOTE);
    const base = m ? t.replace(VERSION_NOTE, '') : t;
    const so = byTitle.get(norm(t)) || byTitle.get(norm(base));
    if (so) so.a.push([a.title, +a.year, a.category, n + 1, m ? m[1] : '']);
  });
}

// Fan rankings and podcast episodes: lifted from the inline data in discography-app.js
const app = read('js/discography-app.js');
const grab = (re, what) => { const m = app.match(re); if (!m) throw new Error('Could not find ' + what + ' in discography-app.js'); return m[1]; };
const top40 = new Function('return ' + grab(/const top40Songs = (\[[\s\S]*?\n\]);/, 'top40Songs'))();
const beyond = new Function('return ' + grab(/const beyondTop40 = (\[[\s\S]*?\n\]);/, 'beyondTop40'))();
const roadStart = app.indexOf('const ROAD_PLAYLIST');
const podEnd = app.indexOf('};', app.indexOf('const top40PodcastURLs')) + 2;
if (roadStart < 0 || podEnd < 2) throw new Error('Could not find the podcast episode data in discography-app.js');
const { roadEpisodeForRank, top40PodcastURLs } = new Function(app.slice(roadStart, podEnd) + '\nreturn { roadEpisodeForRank, top40PodcastURLs };')();

const unvoted = [];
for (const v of [...top40, ...beyond]) {
  const so = byTitle.get(norm(v.title)) || byTitle.get(norm(v.title.replace(/\s*\(.*\)\s*$/, '')));
  if (!so) { unvoted.push(v.title); continue; }
  const road = v.rank > 40 ? roadEpisodeForRank(v.rank) : null;
  const kite = top40PodcastURLs[v.rank];
  so.k = { rank: v.rank, pts: v.points || 0 };
  if (kite) { so.k.url = 'https://kite.link/' + kite; so.k.ep = 'TTHTop40 Countdown'; }
  else if (road) { so.k.url = road.url; so.k.ep = 'Road to the Top 40 - Episode ' + road.ep; }
}

// ─── Checks ───
const mismatched = songs.filter(so => so.p.length !== so.livePlays);
if (mismatched.length) throw new Error('Play counts differ from canonical-songs.json: ' + mismatched.map(m => `${m.t} (${m.p.length} vs ${m.livePlays})`).join(', '));

// ─── Write ───
const out = {
  built: new Date().toISOString().slice(0, 10),
  shows: shows.map(x => [x.id, x.iso, x.s.venue || '', x.s.city || '', x.s.state || '', x.s.country || '', x.s.tour || '', x.rec ? 1 : 0]),
  songs: songs.map(so => ({ s: so.s, t: so.t, p: so.p, r: so.r, a: so.a, k: so.k })),
};
fs.writeFileSync(path.join(ROOT, 'data', 'song-index.json'), JSON.stringify(out) + '\n');

// Sitemap block
const smPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8');
const START = '<!-- songs:start -->', END = '<!-- songs:end -->';
const block = START + '\n' + songs.map(so =>
  `  <url>\n    <loc>https://thehiphandbook.tthpods.com/song/${so.s}</loc>\n    <lastmod>${out.built}</lastmod>\n    <priority>0.5</priority>\n  </url>`
).join('\n') + '\n  ' + END;
if (sm.includes(START)) sm = sm.replace(new RegExp(START + '[\\s\\S]*?' + END), () => block);
else sm = sm.replace('</urlset>', () => '  ' + block + '\n</urlset>');
fs.writeFileSync(smPath, sm);

const kb = Math.round(fs.statSync(path.join(ROOT, 'data', 'song-index.json')).size / 1024);
console.log(`wrote data/song-index.json: ${songs.length} songs, ${shows.length} shows, ${kb} KB`);
console.log(`  ${songs.filter(s => s.p.length).length} played live, ${songs.filter(s => s.r.length).length} with a recording, ${songs.filter(s => s.a.length).length} with an album, ${songs.filter(s => s.k).length} ranked`);
console.log(`  recording tracks matched to a song: ${trackHits} of ${trackHits + trackMisses}`);
const noAlbum = songs.filter(s => !s.a.length).map(s => s.t);
if (noAlbum.length) console.log(`  no album found for: ${noAlbum.join(', ')}`);
if (unvoted.length) console.log(`  fan-vote titles not matched to a song: ${unvoted.join(', ')}`);
console.log(`updated ${songs.length} song entries in sitemap.xml`);
