#!/usr/bin/env node

// fetch-setlistfm.js
// Fetches all Tragically Hip setlists from setlist.fm and aggregates per-song play counts.
// No external dependencies - uses built-in https module.

const https = require('https');

const API_KEY = 'F2SEnErfN5soGAhxFdKw7TqaTfls9BoVuScR';
const MBID = 'e86ab653-bec8-46f3-b4b6-a1a866919ef6';
const DELAY_MS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const path = require('path');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'setlistfm-play-counts.json');
const fs = require('fs');

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.setlist.fm',
      path: `/rest/1.0/artist/${MBID}/setlists?p=${page}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageWithRetry(page) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchPage(page);
    } catch (err) {
      if (err.message.includes('429') && attempt < MAX_RETRIES) {
        const wait = RETRY_DELAY_MS * attempt;
        console.log(`  Rate limited on page ${page}, retry ${attempt}/${MAX_RETRIES} after ${wait}ms...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

// setlist.fm dates are DD-MM-YYYY, convert to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function compareDates(a, b) {
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

async function main() {
  console.log('Testing API with page 1...');

  let firstPage;
  try {
    firstPage = await fetchPageWithRetry(1);
  } catch (err) {
    console.error('API test failed:', err.message);
    process.exit(1);
  }

  const totalSetlists = firstPage.total;
  const itemsPerPage = firstPage.itemsPerPage;
  const totalPages = Math.ceil(totalSetlists / itemsPerPage);

  console.log(`API OK. Total setlists: ${totalSetlists}, pages: ${totalPages} (${itemsPerPage}/page)`);

  // Song stats accumulator
  const songs = {};
  let processedSetlists = 0;

  function processSetlist(setlist) {
    const eventDate = parseDate(setlist.eventDate);
    if (!setlist.sets || !setlist.sets.set) return;

    const sets = setlist.sets.set;
    // Find the first non-encore set to determine opener
    const mainSets = sets.filter(s => !s.encore);
    const encoreSets = sets.filter(s => s.encore);

    let openerName = null;
    if (mainSets.length > 0 && mainSets[0].song && mainSets[0].song.length > 0) {
      openerName = mainSets[0].song[0].name;
    }

    for (const set of sets) {
      if (!set.song) continue;
      const isEncore = !!set.encore;

      for (const song of set.song) {
        const name = song.name;
        if (!name || name.trim() === '') continue;

        if (!songs[name]) {
          songs[name] = {
            total_plays: 0,
            as_opener: 0,
            as_encore: 0,
            first_played: null,
            last_played: null,
            is_cover: false
          };
        }

        const s = songs[name];
        s.total_plays++;

        if (name === openerName && !isEncore) {
          // Only count opener once per setlist (the first song of the first main set)
          // We check name match so it only increments for that song
        }

        if (isEncore) {
          s.as_encore++;
        }

        // Track if it's a cover
        if (song.cover && song.cover.name) {
          s.is_cover = true;
        }

        if (eventDate) {
          if (!s.first_played || compareDates(eventDate, s.first_played) < 0) {
            s.first_played = eventDate;
          }
          if (!s.last_played || compareDates(eventDate, s.last_played) > 0) {
            s.last_played = eventDate;
          }
        }
      }
    }

    // Count opener separately (once per setlist)
    if (openerName && songs[openerName]) {
      songs[openerName].as_opener++;
    }

    processedSetlists++;
  }

  // Process page 1
  if (firstPage.setlist) {
    for (const sl of firstPage.setlist) {
      processSetlist(sl);
    }
  }
  console.log(`Page 1/${totalPages} done (${processedSetlists} setlists processed)`);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    try {
      const data = await fetchPageWithRetry(page);
      if (data.setlist) {
        for (const sl of data.setlist) {
          processSetlist(sl);
        }
      }
      if (page % 10 === 0 || page === totalPages) {
        console.log(`Page ${page}/${totalPages} done (${processedSetlists} setlists processed)`);
      }
    } catch (err) {
      console.error(`Error on page ${page}: ${err.message}`);
      // Continue to next page
    }
  }

  const result = {
    source: 'setlist.fm',
    fetched: new Date().toISOString().split('T')[0],
    total_setlists_processed: processedSetlists,
    total_unique_songs: Object.keys(songs).length,
    songs: songs
  };

  // Sort songs by total_plays descending for readability
  const sortedSongs = {};
  Object.keys(songs)
    .sort((a, b) => songs[b].total_plays - songs[a].total_plays)
    .forEach(key => { sortedSongs[key] = songs[key]; });
  result.songs = sortedSongs;

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nDone. ${processedSetlists} setlists, ${Object.keys(songs).length} unique songs.`);
  console.log(`Output: ${OUTPUT_PATH}`);

  // Print top 20
  console.log('\nTop 20 most-played songs:');
  const entries = Object.entries(sortedSongs).slice(0, 20);
  entries.forEach(([name, s], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${name} — ${s.total_plays} plays (opener: ${s.as_opener}, encore: ${s.as_encore})`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
