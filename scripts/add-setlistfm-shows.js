#!/usr/bin/env node
// add-setlistfm-shows.js
// Adds the setlist.fm shows listed under "addShows" in data/setlist-corrections.json
// to data/setlists.min.json and data/tth-tour-data.json. It only ever adds: a show
// that is already in either file is left exactly as it is, so the Hip Archive
// recordings and every hand fix stay put. This is the safe way to bring in new
// setlist.fm shows (fetch-setlist-data.js would wipe the 614 recordings).
//
// Needs the internet and SETLIST_FM_API_KEY from .env:
//   node --env-file=.env scripts/add-setlistfm-shows.js
// Then run the data pipeline from step 1 (apply-setlist-corrections.js).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const API_KEY = process.env.SETLIST_FM_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fix = read('data/setlist-corrections.json');
const sl = read('data/setlists.min.json');
const tour = read('data/tth-tour-data.json');

const wanted = Object.keys(fix.addShows || {});
const inSl = new Set(sl.setlists.map(s => s.id));
const inTour = new Set(tour.map(g => g.id));
const todo = wanted.filter(id => !inSl.has(id) || !inTour.has(id));
if (!todo.length) { console.log(`addShows: all ${wanted.length} shows are already in the data. Nothing to do.`); process.exit(0); }
if (!API_KEY) { console.error('STOPPED - no SETLIST_FM_API_KEY. Run: node --env-file=.env scripts/add-setlistfm-shows.js'); process.exit(1); }

async function getSetlist(id) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.setlist.fm/rest/1.0/setlist/${id}`, { headers: { Accept: 'application/json', 'x-api-key': API_KEY } });
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`setlist.fm said ${res.status} for show ${id}`);
    return res.json();
  }
  throw new Error(`setlist.fm kept rate-limiting show ${id}; try again in a minute`);
}

// Same shapes as the original pulls (fetch-setlists.js and fetch-setlist-data.js)
function toSetlist(raw) {
  const songs = [];
  for (const s of (raw.sets && raw.sets.set) || []) {
    const setName = s.encore ? `Encore ${s.encore}` : (s.name || 'Main Set');
    for (const song of s.song || []) {
      songs.push({ name: song.name, set: setName, info: song.info || null, cover: song.cover ? song.cover.name : null, tape: song.tape || false });
    }
  }
  const city = (raw.venue && raw.venue.city) || {};
  return {
    id: raw.id, date: raw.eventDate, url: raw.url, tour: raw.tour ? raw.tour.name : null,
    venue: raw.venue ? raw.venue.name : null, city: city.name || null,
    state: city.stateCode || city.state || null, country: city.country ? city.country.code : null,
    songs, songCount: songs.filter(s => !s.tape).length,
  };
}
function toGig(raw) {
  const venue = raw.venue || {};
  const city = venue.city || {};
  const country = city.country || {};
  const coords = city.coords || {};
  const [dd, mm, yyyy] = raw.eventDate.split('-');
  return {
    id: raw.id, date: raw.eventDate, isoDate: `${yyyy}-${mm}-${dd}`, tour: raw.tour ? raw.tour.name : null,
    venue: venue.name || null, venueId: venue.id || null, city: city.name || null,
    state: city.stateCode || city.state || null, country: country.code || null, countryName: country.name || null,
    lat: coords.lat ? parseFloat(coords.lat) : null, lng: coords.long ? parseFloat(coords.long) : null,
    songCount: ((raw.sets && raw.sets.set) || []).reduce((n, s) => n + ((s.song || []).length), 0),
    setlistUrl: raw.url || null,
  };
}

(async () => {
  let added = 0;
  for (const id of todo) {
    const raw = await getSetlist(id);
    if (!inSl.has(id)) sl.setlists.push(toSetlist(raw));
    if (!inTour.has(id)) tour.push(toGig(raw));
    console.log(`  added ${id}: ${raw.eventDate} ${raw.venue.name}, ${raw.venue.city.name}`);
    added++;
    await sleep(1200);
  }
  // Same order as before: setlists newest first, tour data oldest first
  const iso = d => d.split('-').reverse().join('-');
  sl.setlists.sort((a, b) => iso(b.date).localeCompare(iso(a.date)));
  tour.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));
  sl.totalSetlists = sl.setlists.length;
  fs.writeFileSync(path.join(ROOT, 'data', 'setlists.min.json'), JSON.stringify(sl));
  fs.writeFileSync(path.join(ROOT, 'data', 'tth-tour-data.json'), JSON.stringify(tour, null, 2) + '\n');
  console.log(`addShows: ${added} new shows added. Now run the data pipeline from apply-setlist-corrections.js.`);
})().catch(e => { console.error('STOPPED - ' + e.message + '. Nothing was saved.'); process.exit(1); });
