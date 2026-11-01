#!/usr/bin/env node
// build-site-stats.js - keeps the headline counts on the pages in step with the data
// (v5.4.18, audit DATA-04).
//
// The counts fans read ("1,355 live shows and appearances", "614 live recordings",
// "188 songs") are plain text in the pages, so link previews and search engines
// see them without running JavaScript. This works each count out from data/,
// finds every phrase that carries it, and rewrites the number in place. Then it
// re-runs build-seo-pages.js so lyrics.html, setlists.html and top-40.html pick
// the numbers up from discography.html and FEATURE_VIEWS.
//
// Each phrase must still be in its file. If a page's wording changes so a phrase
// no longer matches, this stops instead of quietly leaving the count behind:
// update PHRASES below to the new wording.
//
// Run after any data change (step 8 of the refresh order in CLAUDE.md).
// Node 22, no packages. --check prints wrong counts and exits 1 without writing
// (scripts/audit-site.js runs it that way).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const fmt = n => n.toLocaleString('en-US');

// ---- The counts, from the data ----
const setlists = readJson('setlists.min.json').setlists;
const tour = readJson('tth-tour-data.json');
const lyrics = readJson('lyrics.json').songs;
const lyricTexts = Object.values(lyrics).filter(v => typeof v === 'string' && v.trim());
const ranks = [...fs.readFileSync(path.join(ROOT, 'js/discography-app.js'), 'utf8').matchAll(/\brank: (\d+)/g)].map(m => +m[1]);

// Words in the lyrics, counted the way countLyricWords() in js/discography-app.js does
const words = new Set();
let wordTotal = 0;
for (const text of lyricTexts) {
  for (const w of text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) || []) {
    wordTotal++;
    words.add(w);
  }
}

const STATS = {
  releases: { n: readJson('discography.json').albums.length, from: 'albums in discography.json' },
  shows: { n: setlists.length, from: 'shows in setlists.min.json' },
  lastYear: { n: Math.max(...setlists.map(s => +s.date.slice(-4))), from: 'latest show year in setlists.min.json', plain: true },
  setlists: { n: setlists.filter(s => (s.songs || []).length).length, from: 'shows with at least one song' },
  recordings: { n: tour.filter(g => (g.tracks || []).length).length, from: 'shows with tracks in tth-tour-data.json' },
  cities: { n: new Set(setlists.map(s => s.city)).size, from: 'city names in setlists.min.json' },
  tours: { n: new Set(setlists.filter(s => s.tour).map(s => s.tour)).size, from: 'tour names in setlists.min.json' },
  lyrics: { n: lyricTexts.length, from: 'songs in lyrics.json' },
  lyricWords: { n: words.size, from: 'different words in lyrics.json' },
  lyricWordTotal: { n: wordTotal, from: 'words in lyrics.json' },
  unreleased: { n: readJson('unplucked-gems.json').eras.reduce((n, e) => n + (e.sessions || []).length, 0), from: 'sessions in unplucked-gems.json' },
  concertVideos: { n: readJson('youtube-videos.json').eras.reduce((n, e) => n + (e.videos || []).length, 0), from: 'videos in youtube-videos.json' },
  officialVideos: { n: readJson('music-videos.json').videos.length, from: 'entries in music-videos.json' },
  ranks: { n: Math.max(...ranks), from: 'highest rank in js/discography-app.js' },
};

// The two show files must agree, or the tour map and the setlists tell different stories
if (tour.length !== setlists.length) {
  console.error(`tth-tour-data.json has ${tour.length} shows but setlists.min.json has ${setlists.length}. Run scripts/apply-setlist-corrections.js first.`);
  process.exit(1);
}

// ---- Where each count is written. The number is the only part that changes. ----
const PHRASES = [
  ['releases', /\b\d+(?= (?:official )?releases\b)/g, ['index.html', 'discography.html']],
  ['shows', /\b\d[\d,]*(?= live shows and appearances)/g, ['index.html', 'discography.html', 'js/discography-app.js']],
  ['shows', /(?<=num: ')\d[\d,]*(?=', lbl: 'Shows & Appearances')/g, ['js/discography-app.js']],
  ['lastYear', /(?<=live shows and appearances from 1985 to\s+)\d{4}/g, ['discography.html', 'js/discography-app.js']],
  ['setlists', /\b\d[\d,]*(?= (?:with )?setlists\b)/g, ['index.html', 'live-stats.html', 'js/discography-app.js']],
  ['recordings', /\b\d[\d,]*(?= live recordings| shows you can play)/g, ['index.html']],
  ['cities', /(?<=num: ')\d[\d,]*(?=', lbl: 'Cities')/g, ['js/discography-app.js']],
  ['tours', /(?<=num: ')\d[\d,]*(?=', lbl: 'Tours & Events')/g, ['js/discography-app.js']],
  ['lyrics', /\b\d[\d,]*(?= songs by (?:keyword or phrase|The Tragically Hip by a word))/g, ['discography.html', 'js/discography-app.js']],
  ['lyrics', /(?<=num: ')\d[\d,]*(?=', lbl: 'Songs Searchable')|(?<=Loading lyrics for all )\d[\d,]*(?= songs)/g, ['js/discography-app.js']],
  ['lyricWords', /(?<=num: ')\d[\d,]*(?=', lbl: 'Different Words')/g, ['js/discography-app.js']],
  ['lyricWordTotal', /(?<=num: ')\d[\d,]*(?=', lbl: 'Words of Lyrics')/g, ['js/discography-app.js']],
  ['unreleased', /\b\d[\d,]*(?= demos, outtakes, and alternate versions)/g, ['index.html']],
  ['concertVideos', /\b\d[\d,]*(?= videos: concerts)/g, ['index.html']],
  ['officialVideos', /(?<=Official videos for )\d[\d,]*(?= songs)/g, ['index.html']],
  ['ranks', /(?<=ranking from No\. 1 to No\. )\d+|(?<=The Full )\d+(?= - All Songs)/g, ['index.html', 'discography.html', 'js/discography-app.js']],
  ['ranks', /(?<=Full )\d+(?= Fan Vote)/g, ['js/song.js', 'js/discography-app.js']],
];

const files = new Map(); // file -> text
const wrong = [];
const missing = [];
for (const [key, re, list] of PHRASES) {
  const want = STATS[key].plain ? String(STATS[key].n) : fmt(STATS[key].n);
  for (const file of list) {
    if (!files.has(file)) files.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
    let hits = 0;
    const text = files.get(file).replace(re, (num, offset, all) => {
      hits++;
      if (num !== want) wrong.push(`${file}:${all.slice(0, offset).split('\n').length} says ${num}, data says ${want} (${STATS[key].from})`);
      return want;
    });
    if (!hits) missing.push(`${file}: no phrase for '${key}' matching ${re}`);
    files.set(file, text);
  }
}

if (missing.length) {
  console.error('A page no longer has the wording this script looks for. Update PHRASES in scripts/build-site-stats.js:');
  missing.forEach(m => console.error('  ' + m));
  process.exit(1);
}

if (CHECK) {
  if (wrong.length) {
    console.error(`${wrong.length} count(s) don't match the data. Run: node scripts/build-site-stats.js`);
    wrong.forEach(w => console.error('  ' + w));
    process.exit(1);
  }
  console.log(`All ${PHRASES.length} count phrases match the data.`);
  process.exit(0);
}

console.log('Counts from the data:');
for (const [key, s] of Object.entries(STATS)) console.log(`  ${key.padEnd(15)} ${String(s.plain ? s.n : fmt(s.n)).padStart(7)}  (${s.from})`);
if (!wrong.length) { console.log('\nEvery page already says these numbers. Nothing written.'); process.exit(0); }

for (const [file, text] of files) fs.writeFileSync(path.join(ROOT, file), text);
console.log(`\nUpdated ${wrong.length} number(s):`);
wrong.forEach(w => console.log('  ' + w));

console.log('\nRebuilding the generated pages so they pick up the new numbers...');
const seo = spawnSync(process.execPath, [path.join(__dirname, 'build-seo-pages.js')], { stdio: 'inherit' });
process.exit(seo.status);
