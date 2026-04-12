// TTH Discography Web App - v2.9 Daredevil
// setlist.fm API Data Pull - The Tragically Hip Tour Map Dataset
// No external dependencies - Node v22

const API_KEY = process.env.SETLISTFM_API_KEY || 'YOUR_API_KEY_HERE';
const MBID = 'e86ab653-bec8-46f3-b4b6-a1a866919ef6';
const BASE_URL = 'https://api.setlist.fm/rest/1.0';
const ITEMS_PER_PAGE = 20;
const DELAY_MS = 1500; // be polite to the API

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(page) {
  const url = `${BASE_URL}/artist/${MBID}/setlists?p=${page}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'x-api-key': API_KEY
    }
  });

  if (!res.ok) {
    throw new Error(`API error on page ${page}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function fetchAllSetlists() {
  console.log('Fetching page 1 to get total count...');
  const firstPage = await fetchPage(1);
  const total = firstPage.total;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  console.log(`Found ${total} setlists across ${totalPages} pages\n`);

  let allSetlists = [...firstPage.setlist];

  for (let p = 2; p <= totalPages; p++) {
    await sleep(DELAY_MS);
    process.stdout.write(`Fetching page ${p}/${totalPages}...\r`);
    try {
      const data = await fetchPage(p);
      allSetlists.push(...data.setlist);
    } catch (err) {
      console.warn(`\nWarning: Failed on page ${p} - ${err.message}. Skipping.`);
    }
  }

  console.log(`\nFetched ${allSetlists.length} setlists total`);
  return allSetlists;
}

function transformSetlist(s) {
  const venue = s.venue || {};
  const city = venue.city || {};
  const country = city.country || {};
  const coords = city.coords || {};

  return {
    id: s.id,
    date: s.eventDate, // dd-MM-yyyy format
    isoDate: convertToISO(s.eventDate),
    tour: s.tour?.name || null,
    venue: venue.name || null,
    venueId: venue.id || null,
    city: city.name || null,
    state: city.stateCode || city.state || null,
    country: country.code || null,
    countryName: country.name || null,
    lat: coords.lat ? parseFloat(coords.lat) : null,
    lng: coords.long ? parseFloat(coords.long) : null,
    songCount: s.sets?.set?.reduce((acc, set) => acc + (set.song?.length || 0), 0) || 0,
    setlistUrl: s.url || null
  };
}

function convertToISO(dateStr) {
  if (!dateStr) return null;
  const [dd, mm, yyyy] = dateStr.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

function generateStats(gigs) {
  const withCoords = gigs.filter(g => g.lat && g.lng);
  const withTour = gigs.filter(g => g.tour);
  const countries = [...new Set(gigs.map(g => g.countryName).filter(Boolean))];
  const cities = [...new Set(gigs.map(g => `${g.city}, ${g.state || g.country}`).filter(Boolean))];

  const years = {};
  gigs.forEach(g => {
    const year = g.isoDate?.substring(0, 4);
    if (year) years[year] = (years[year] || 0) + 1;
  });

  const tours = {};
  gigs.forEach(g => {
    if (g.tour) tours[g.tour] = (tours[g.tour] || 0) + 1;
  });

  return {
    totalGigs: gigs.length,
    withCoordinates: withCoords.length,
    withoutCoordinates: gigs.length - withCoords.length,
    withTourName: withTour.length,
    uniqueCountries: countries.length,
    uniqueCities: cities.length,
    countries,
    gigsByYear: Object.fromEntries(Object.entries(years).sort()),
    tours: Object.fromEntries(Object.entries(tours).sort((a, b) => b[1] - a[1])),
    dateRange: {
      earliest: gigs.map(g => g.isoDate).filter(Boolean).sort()[0],
      latest: gigs.map(g => g.isoDate).filter(Boolean).sort().pop()
    }
  };
}

async function main() {
  console.log('=== TTH Tour Map - setlist.fm Data Pull ===\n');

  const raw = await fetchAllSetlists();
  const gigs = raw.map(transformSetlist);

  // sort chronologically
  gigs.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));

  const stats = generateStats(gigs);

  // save full dataset
  const fs = await import('fs');
  const outputPath = '/Users/jd/Documents/Discography Web App/data/tth-tour-data.json';
  const statsPath = '/Users/jd/Documents/Discography Web App/data/tth-tour-stats.json';

  // ensure data directory exists
  fs.mkdirSync('/Users/jd/Documents/Discography Web App/data', { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(gigs, null, 2));
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

  console.log('\n=== RESULTS ===');
  console.log(`Total gigs: ${stats.totalGigs}`);
  console.log(`With coordinates: ${stats.withCoordinates} (${Math.round(stats.withCoordinates/stats.totalGigs*100)}%)`);
  console.log(`Without coordinates: ${stats.withoutCoordinates}`);
  console.log(`With tour name: ${stats.withTourName}`);
  console.log(`Unique cities: ${stats.uniqueCities}`);
  console.log(`Unique countries: ${stats.uniqueCountries} - ${stats.countries.join(', ')}`);
  console.log(`Date range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
  console.log(`\nTours logged:`);
  Object.entries(stats.tours).slice(0, 15).forEach(([tour, count]) => {
    console.log(`  ${tour}: ${count} shows`);
  });
  console.log(`\nGigs by year:`);
  Object.entries(stats.gigsByYear).forEach(([year, count]) => {
    console.log(`  ${year}: ${count}`);
  });
  console.log(`\nDataset saved to: ${outputPath}`);
  console.log(`Stats saved to: ${statsPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
