// Scrape The Hip Archive - Extract all show dates and audio download URLs
// Node.js - no external dependencies

const https = require('https');

const YEARS = [
  1985, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005,
  2006, 2007, 2008, 2009, 2011, 2012, 2013, 2014, 2015, 2016
];

const BASE = 'https://www.thehiparchive.com';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TTHDiscographyBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractShows(html, year) {
  const shows = [];

  // Find all audio download links - pattern: Files/Audio/YYYY-MM-DD-City-State-format.zip
  const audioRegex = /href=["'](?:\.\/|\/)?Files\/Audio\/([^"']+\.zip)["']/gi;
  let match;
  const audioFiles = [];

  while ((match = audioRegex.exec(html)) !== null) {
    audioFiles.push(match[1]);
  }

  // Parse each audio filename to extract date and location
  for (const filename of audioFiles) {
    // Pattern: YYYY-MM-DD-City-State-format.zip
    // Some have xx for unknown day: 1985-xx-xx-Kingston-ON-mp3.zip
    const parts = filename.replace('.zip', '').split('-');
    if (parts.length < 5) continue;

    const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;

    // Find format suffix (mp3, flac, etc) - it's the last part
    const format = parts[parts.length - 1];
    // State/province is second to last
    const state = parts[parts.length - 2];
    // City is everything between date and state (may have hyphens in city name)
    const cityParts = parts.slice(3, parts.length - 2);
    const city = cityParts.join(' ');

    // Only keep mp3 versions to avoid duplicates (prefer mp3 for linking)
    // But if only flac exists, keep that
    const audioUrl = `${BASE}/Files/Audio/${filename}`;

    shows.push({
      date: dateStr,
      year: parseInt(parts[0]),
      city: city,
      state: state,
      filename: filename,
      audioUrl: audioUrl,
      format: format
    });
  }

  // Also try to extract show info from the page structure
  // Look for date patterns in text: Mon DD, YYYY or similar
  const dateTextRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/gi;

  // Deduplicate by date - prefer mp3 over flac
  const byDate = {};
  for (const show of shows) {
    const key = `${show.date}-${show.city}`;
    if (!byDate[key] || show.format === 'mp3') {
      byDate[key] = show;
    }
  }

  return Object.values(byDate);
}

async function scrapeAll() {
  const allShows = [];

  for (const year of YEARS) {
    const url = `${BASE}/${year}.shtml`;
    try {
      console.log(`Scraping ${year}...`);
      const html = await fetch(url);
      const shows = extractShows(html, year);
      console.log(`  Found ${shows.length} recordings`);
      allShows.push(...shows);
      // Be polite - small delay between requests
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  Error scraping ${year}: ${err.message}`);
    }
  }

  // Sort by date
  allShows.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`\n=== TOTAL: ${allShows.length} recordings found ===`);

  // Count by format
  const formats = {};
  allShows.forEach(s => { formats[s.format] = (formats[s.format] || 0) + 1; });
  console.log('Formats:', formats);

  // Count with valid dates (no xx)
  const validDates = allShows.filter(s => !s.date.includes('xx'));
  console.log(`Valid dates: ${validDates.length} / ${allShows.length}`);

  // Save
  const fs = require('fs');
  const outPath = require('path').join(__dirname, '..', 'data', 'hip-archive-index.json');
  fs.writeFileSync(outPath, JSON.stringify(allShows, null, 2));
  console.log(`\nSaved to ${outPath}`);

  return allShows;
}

scrapeAll().catch(console.error);
