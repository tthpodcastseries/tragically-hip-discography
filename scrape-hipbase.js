#!/usr/bin/env node
// scrape-hipbase.js - Scrape Hipbase.com for Tragically Hip live play count data
// No external dependencies - uses built-in https/http modules
// Usage: node scrape-hipbase.js

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DELAY_MS = 1000; // 1 second between requests
const OUTPUT_FILE = path.join(__dirname, 'data', 'hipbase-play-counts.json');
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TTHResearch/1.0)' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      console.error(`  Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
      if (i < retries - 1) await sleep(2000);
      else throw err;
    }
  }
}

// Pass 1: Scrape album pages to get song IDs, names, play counts, and album names
async function scrapeAlbumPages() {
  const songs = [];
  const seenIds = new Set();

  for (let albumNum = 1; albumNum <= 20; albumNum++) {
    const url = `https://www.hipbase.com/album.php?album=${albumNum}`;
    console.log(`[Pass 1] Fetching album ${albumNum}/20: ${url}`);

    try {
      const html = await fetchWithRetry(url);

      // Extract album names from <th colspan="2">Album Name <br> YYYY-MM-DD</th> headers
      // Page may contain multiple album sections, so we split by album headers
      const albumSections = html.split(/<th[^>]*colspan[^>]*>/gi);
      let currentAlbum = `Album ${albumNum}`;
      let songCount = 0;

      for (const section of albumSections) {
        // Check if this section starts with an album name (format: "Album Name <br> date")
        const albumMatch = section.match(/^([^<]+?)\s*<br>/i);
        if (albumMatch) {
          currentAlbum = albumMatch[1].trim().replace(/&amp;/g, '&').replace(/&#039;/g, "'");
        }

        // Extract songs from this section
        const songRegex = /song_id=(\d+)[^>]*>([^<]+)<\/a><\/td>\s*<td[^>]*>(\d+)/gi;
        let match;

        while ((match = songRegex.exec(section)) !== null) {
          const songId = parseInt(match[1]);
          const songName = match[2].trim().replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');
          const playCount = parseInt(match[3]);

          if (!seenIds.has(songId)) {
            seenIds.add(songId);
            songs.push({
              song_id: songId,
              name: songName,
              album: currentAlbum,
              total_plays: playCount
            });
            songCount++;
          }
        }
      }

      console.log(`  Found ${songCount} new songs (${songs.length} total)`);
    } catch (err) {
      console.error(`  ERROR on album ${albumNum}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  return songs;
}

// Pass 2: Scrape individual song pages for detailed stats
async function scrapeSongDetails(songs) {
  const total = songs.length;

  for (let i = 0; i < total; i++) {
    const song = songs[i];
    const url = `https://www.hipbase.com/song.php?start_date=1985-01-01&end_date=${TODAY}&song_id=${song.song_id}`;
    console.log(`[Pass 2] ${i + 1}/${total}: "${song.name}" (id=${song.song_id})`);

    try {
      const html = await fetchWithRetry(url);

      // Total plays: "[Song Name] was played N time(s)"
      const playsMatch = html.match(/was played (\d+) time/i);
      if (playsMatch) {
        song.total_plays = parseInt(playsMatch[1]);
      }

      // Opener count: <b>Show(s) opener</b> - N
      const openerMatch = html.match(/<b>Show\(s\) opener<\/b>\s*-\s*(\d+)/i);
      song.as_opener = openerMatch ? parseInt(openerMatch[1]) : 0;

      // Encore count: <b>Encore(s)</b> - N
      const encoreMatch = html.match(/<b>Encore\(s\)<\/b>\s*-\s*(\d+)/i);
      song.as_encore = encoreMatch ? parseInt(encoreMatch[1]) : 0;

      // First played: <b>First Played</b> - YYYY-MM-DD
      const firstMatch = html.match(/<b>First Played<\/b>\s*-\s*([\d-]+)/i);
      song.first_played = firstMatch ? firstMatch[1] : null;

      // Last played: <b>Last Played</b> - YYYY-MM-DD
      const lastMatch = html.match(/<b>Last Played<\/b>\s*-\s*([\d-]+)/i);
      song.last_played = lastMatch ? lastMatch[1] : null;

      // Percentage: Played at X% shows  (or "X.X% of shows" etc.)
      const pctMatch = html.match(/Played at ([\d.]+)%/i) || html.match(/([\d.]+)%\s*of\s*shows/i);
      song.pct_of_shows = pctMatch ? parseFloat(pctMatch[1]) : null;

    } catch (err) {
      console.error(`  ERROR fetching song ${song.song_id}: ${err.message}`);
      song.as_opener = song.as_opener || 0;
      song.as_encore = song.as_encore || 0;
      song.first_played = song.first_played || null;
      song.last_played = song.last_played || null;
      song.pct_of_shows = song.pct_of_shows || null;
    }

    await sleep(DELAY_MS);
  }

  return songs;
}

async function main() {
  console.log('=== Hipbase.com Scraper ===');
  console.log(`Date: ${TODAY}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('');

  // Pass 1
  console.log('--- Pass 1: Album pages ---');
  const songs = await scrapeAlbumPages();
  console.log(`\nPass 1 complete: ${songs.length} songs found.\n`);

  if (songs.length === 0) {
    console.error('No songs found! Check if Hipbase.com is accessible and HTML patterns are correct.');
    process.exit(1);
  }

  // Pass 2
  console.log('--- Pass 2: Individual song pages ---');
  console.log(`Estimated time: ~${Math.ceil(songs.length * 1.1 / 60)} minutes\n`);
  await scrapeSongDetails(songs);
  console.log(`\nPass 2 complete.\n`);

  // Build output object
  const songsObj = {};
  for (const s of songs) {
    songsObj[s.name] = {
      song_id: s.song_id,
      album: s.album,
      total_plays: s.total_plays,
      as_opener: s.as_opener,
      as_encore: s.as_encore,
      first_played: s.first_played,
      last_played: s.last_played,
      pct_of_shows: s.pct_of_shows
    };
  }

  const output = {
    source: 'hipbase.com',
    fetched: TODAY,
    total_songs: songs.length,
    songs: songsObj
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Done! Saved ${songs.length} songs to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
