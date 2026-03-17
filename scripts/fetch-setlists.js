#!/usr/bin/env node
/**
 * Fetch all Tragically Hip setlists from setlist.fm API
 * and save as a static JSON file for the web app.
 *
 * Usage: node scripts/fetch-setlists.js
 */

const API_KEY = process.env.SETLISTFM_API_KEY || 'YOUR_API_KEY_HERE';
const ARTIST_MBID = 'e86ab653-bec8-46f3-b4b6-a1a866919ef6'; // The Tragically Hip
const BASE_URL = 'https://api.setlist.fm/rest/1.0';
const OUTPUT_FILE = 'data/setlists.json';
const PER_PAGE = 20;
const DELAY_MS = 600; // stay well under rate limits

const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/artist/${ARTIST_MBID}/setlists?p=${page}`;
    const options = {
      headers: {
        'Accept': 'application/json',
        'x-api-key': API_KEY,
        'User-Agent': 'TTHDiscographyApp/2.8.4'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseSetlist(raw) {
  const songs = [];
  if (raw.sets && raw.sets.set) {
    raw.sets.set.forEach(s => {
      const setName = s.encore ? `Encore ${s.encore}` : (s.name || 'Main Set');
      (s.song || []).forEach(song => {
        songs.push({
          name: song.name,
          set: setName,
          info: song.info || null,
          cover: song.cover ? song.cover.name : null,
          tape: song.tape || false
        });
      });
    });
  }

  return {
    id: raw.id,
    date: raw.eventDate, // dd-MM-yyyy
    url: raw.url,
    tour: raw.tour ? raw.tour.name : null,
    venue: raw.venue ? raw.venue.name : null,
    city: raw.venue && raw.venue.city ? raw.venue.city.name : null,
    state: raw.venue && raw.venue.city ? (raw.venue.city.stateCode || raw.venue.city.state || null) : null,
    country: raw.venue && raw.venue.city && raw.venue.city.country ? raw.venue.city.country.code : null,
    songs: songs,
    songCount: songs.filter(s => !s.tape).length
  };
}

async function main() {
  console.log('Fetching The Tragically Hip setlists from setlist.fm...\n');

  // First page to get total count
  const first = await fetchPage(1);
  const total = first.total;
  const totalPages = Math.ceil(total / PER_PAGE);
  console.log(`Found ${total} setlists across ${totalPages} pages\n`);

  let allSetlists = first.setlist.map(parseSetlist);
  console.log(`Page 1/${totalPages} - ${allSetlists.length} setlists`);

  for (let p = 2; p <= totalPages; p++) {
    await sleep(DELAY_MS);
    try {
      const page = await fetchPage(p);
      const parsed = page.setlist.map(parseSetlist);
      allSetlists = allSetlists.concat(parsed);
      console.log(`Page ${p}/${totalPages} - ${allSetlists.length} total setlists`);
    } catch (e) {
      console.error(`Error on page ${p}: ${e.message}`);
      // Retry once after longer delay
      await sleep(2000);
      try {
        const page = await fetchPage(p);
        const parsed = page.setlist.map(parseSetlist);
        allSetlists = allSetlists.concat(parsed);
        console.log(`Page ${p}/${totalPages} (retry) - ${allSetlists.length} total setlists`);
      } catch (e2) {
        console.error(`Failed page ${p} on retry: ${e2.message}, skipping`);
      }
    }
  }

  // Sort by date (newest first)
  allSetlists.sort((a, b) => {
    const [dA, mA, yA] = a.date.split('-').map(Number);
    const [dB, mB, yB] = b.date.split('-').map(Number);
    return (yB * 10000 + mB * 100 + dB) - (yA * 10000 + mA * 100 + dA);
  });

  // Build summary stats
  const withSongs = allSetlists.filter(s => s.songs.length > 0);
  const years = [...new Set(allSetlists.map(s => s.date.split('-')[2]))].sort();
  const tours = [...new Set(allSetlists.map(s => s.tour).filter(Boolean))].sort();
  const venues = [...new Set(allSetlists.map(s => s.venue).filter(Boolean))];
  const cities = [...new Set(allSetlists.map(s => s.city).filter(Boolean))];

  const output = {
    artist: 'The Tragically Hip',
    fetchedAt: new Date().toISOString(),
    totalSetlists: allSetlists.length,
    setlistsWithSongs: withSongs.length,
    yearRange: years.length > 0 ? `${years[0]}-${years[years.length - 1]}` : '',
    uniqueTours: tours.length,
    uniqueVenues: venues.length,
    uniqueCities: cities.length,
    setlists: allSetlists
  };

  // Write output
  const outPath = path.join(__dirname, '..', OUTPUT_FILE);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone! Saved ${allSetlists.length} setlists to ${OUTPUT_FILE}`);
  console.log(`  With songs: ${withSongs.length}`);
  console.log(`  Years: ${output.yearRange}`);
  console.log(`  Tours: ${tours.length}`);
  console.log(`  Venues: ${venues.length}`);
  console.log(`  Cities: ${cities.length}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
