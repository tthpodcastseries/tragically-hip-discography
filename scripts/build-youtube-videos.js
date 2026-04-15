#!/usr/bin/env node
// build-youtube-videos.js
// Parses data/source/youtube-videos.csv into
// data/youtube-videos.json for the Video For New Recruits page (v3.4).
//
// Usage: node scripts/build-youtube-videos.js
//
// - Dedupes by YouTube URL
// - Drops all non-Hip entries (Gord solo, Sadies, Buck 65, Country of Miracles)
// - Keeps The Filters (pre-Hip, 1983) in the Early Years bucket
// - Strips YouTube "click SHOW MORE" description noise from tracklists
// - Extracts title parentheticals (SBD, FM Simulcast, Pro-Shot, etc.) as tags
// - Buckets each row into 6 eras + rarities
// - Flags rows with truncated tracklists (partialTracklist: true)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV_IN = path.join(ROOT, 'data', 'source', 'youtube-videos.csv');
const JSON_OUT = path.join(ROOT, 'data', 'youtube-videos.json');

// -------------- CSV parser (handles quoted fields with commas) --------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

// -------------- Helpers --------------
function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) || url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function isHipEntry(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  // Drop Gord solo / side projects
  if (t.startsWith('gord downie')) return false;
  if (t.includes('sadies & gord')) return false;
  if (t.includes('very short gordie')) return false;
  if (t.includes('country of miracles')) return false;
  if (t.includes('buck 65')) return false;
  // Keep The Filters (pre-Hip, row 1)
  if (t.startsWith('the filters')) return true;
  // Keep anything explicitly Tragically Hip
  if (t.includes('tragically hip')) return true;
  return false;
}

// Parse tags out of title. Returns { cleanTitle, tags }.
// Examples:
//   "The Tragically Hip - (SBD)" -> { cleanTitle: "The Tragically Hip", tags: ["SBD"] }
//   "The Tragically Hip - (FM Radio Simulcast)" -> tags: ["FM Simulcast"]
//   "The Tragically Hip - Soundboard Compilation #10" -> cleanTitle preserved, tag: ["Compilation"]
const TAG_PATTERNS = [
  { re: /\(SBD\)/i, tag: 'SBD' },
  { re: /\(Upgraded STU\/SBD\)/i, tag: 'SBD' },
  { re: /\(FM Radio Simulcast\)/i, tag: 'FM Simulcast' },
  { re: /\(Pro-Shot Video\)/i, tag: 'Pro-Shot' },
  { re: /\(Complete Video\)/i, tag: 'Complete Video' },
  { re: /\(Complete Bootleg\)/i, tag: 'Complete Bootleg' },
  { re: /\(Studio Rehearsal\)/i, tag: 'Rehearsal' },
  { re: /Soundboard Compilation/i, tag: 'Compilation' },
];

function parseTitleTags(rawTitle, sourceCol) {
  const tags = new Set();
  let clean = rawTitle || '';

  for (const { re, tag } of TAG_PATTERNS) {
    if (re.test(clean)) tags.add(tag);
  }
  // Column 5 may explicitly say SBD
  if (sourceCol && /SBD/i.test(sourceCol)) tags.add('SBD');

  // Strip trailing " - (XXX)" fragments for a cleaner display title
  clean = clean
    .replace(/\s*-\s*\((SBD|Upgraded STU\/SBD|FM Radio Simulcast|Pro-Shot Video|Complete Video|Complete Bootleg|Studio Rehearsal)\)\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanTitle: clean, tags: Array.from(tags) };
}

// Clean a tracklist string. Returns { tracks, partial }.
function parseTracklist(raw) {
  if (!raw || !raw.trim()) return { tracks: [], partial: false };
  let s = raw;

  // Detect truncation markers
  const truncated = /click\s*SHOW\s*MORE/i.test(s) || /\.{4,}/.test(s);

  // Strip the "........click SHOW MORE to expand vvv" noise
  s = s.replace(/\.{2,}[^/]*click[^/]*/gi, '');
  s = s.replace(/\.{3,}/g, '');
  s = s.replace(/\s*vvv\s*/gi, '');
  s = s.replace(/click SHOW MORE( to expand)?/gi, '');

  // Split on " / " (space-slash-space) so we don't break on "(w/ ...)" annotations
  const parts = s.split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);

  return { tracks: parts, partial: truncated };
}

function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return { iso: null, year: null, display: null };
  const str = dateStr.trim();
  // Full ISO YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const d = new Date(`${str}T00:00:00Z`);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const display = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${year}`;
    return { iso: str, year, display };
  }
  // Year only
  m = str.match(/^(\d{4})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    return { iso: null, year, display: String(year) };
  }
  return { iso: null, year: null, display: str };
}

function getEraId(year, tags) {
  if (tags.includes('Compilation')) return 'rarities';
  if (year == null) return 'rarities';
  if (year <= 1988) return 'early';   // The Filters (1983) lands here
  if (year <= 1994) return 'up-to-here';
  if (year <= 1999) return 'day-for-night';
  if (year <= 2006) return 'in-violet-light';
  if (year <= 2010) return 'world-container';
  if (year <= 2016) return 'man-machine-poem';
  return 'rarities';
}

const ERA_DEFS = [
  { id: 'early',            era: '1984 - 1988', label: 'The Early Years',                     imagePath: 'assets-optimized/Untitled 6.jpg' },
  { id: 'up-to-here',       era: '1989 - 1994', label: 'Up To Here - Fully Completely',       imagePath: 'assets-optimized/89.jpg' },
  { id: 'day-for-night',    era: '1995 - 1999', label: 'Day For Night - Phantom Power',       imagePath: 'assets-optimized/95.jpg' },
  { id: 'in-violet-light',  era: '2000 - 2006', label: 'Music @ Work - In Between Evolution', imagePath: 'assets-optimized/2000.jpg' },
  { id: 'world-container',  era: '2007 - 2010', label: 'World Container - We Are The Same',   imagePath: 'assets-optimized/2007.jpg' },
  { id: 'man-machine-poem', era: '2011 - 2016', label: 'Now For Plan A - Man Machine Poem',   imagePath: 'assets-optimized/2011.jpg' },
  { id: 'rarities',         era: 'Compilations & Rarities', label: 'Soundboard compilations and the undated curiosities', imagePath: 'assets-optimized/Rare.jpg' },
];

// -------------- Main --------------
function main() {
  const csvText = fs.readFileSync(CSV_IN, 'utf8');
  const rows = parseCSV(csvText);

  const seenUrls = new Set();
  const buckets = Object.fromEntries(ERA_DEFS.map(e => [e.id, []]));

  let dropped = { nonHip: 0, duplicate: 0, noUrl: 0 };
  let kept = 0;
  let partialCount = 0;
  let sbdCount = 0;

  for (const cols of rows) {
    const [rawTitle, rawDate, rawUrl, rawLocation, rawSource, rawTracks] = cols;

    if (!rawUrl || !/youtube\.com|youtu\.be/.test(rawUrl)) {
      dropped.noUrl++;
      continue;
    }
    if (!isHipEntry(rawTitle)) {
      dropped.nonHip++;
      continue;
    }
    if (seenUrls.has(rawUrl)) {
      dropped.duplicate++;
      continue;
    }
    seenUrls.add(rawUrl);

    const videoId = extractVideoId(rawUrl);
    const { cleanTitle, tags } = parseTitleTags(rawTitle, rawSource);
    const { iso, year, display: dateDisplay } = parseDate(rawDate);
    const { tracks, partial } = parseTracklist(rawTracks);
    const eraId = getEraId(year, tags);

    if (partial) partialCount++;
    if (tags.includes('SBD')) sbdCount++;

    const video = {
      title: cleanTitle || rawTitle,
      rawTitle: rawTitle,
      date: iso,
      year: year,
      dateDisplay: dateDisplay,
      location: (rawLocation || '').trim() || null,
      tags: tags,
      url: rawUrl,
      videoId: videoId,
      thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
      tracks: tracks,
      partialTracklist: partial,
    };

    buckets[eraId].push(video);
    kept++;
  }

  // Sort within each bucket: by date asc (null years -> end)
  for (const id of Object.keys(buckets)) {
    buckets[id].sort((a, b) => {
      if (a.year == null && b.year == null) return 0;
      if (a.year == null) return 1;
      if (b.year == null) return -1;
      if (a.year !== b.year) return a.year - b.year;
      const ad = a.date || '';
      const bd = b.date || '';
      return ad.localeCompare(bd);
    });
  }

  const eras = ERA_DEFS.map(def => ({
    id: def.id,
    era: def.era,
    label: def.label,
    imagePath: def.imagePath,
    count: buckets[def.id].length,
    videos: buckets[def.id],
  }));

  const today = new Date().toISOString().split('T')[0];

  const output = {
    title: 'Video For New Recruits',
    description: "A curated YouTube archive of Tragically Hip concerts, soundboards, radio simulcasts, rarities and compilations — bucketed by era.",
    lastUpdated: today,
    summary: {
      totalVideos: kept,
      totalEras: ERA_DEFS.length,
      totalSBD: sbdCount,
      partialTracklists: partialCount,
    },
    eras,
  };

  fs.writeFileSync(JSON_OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');

  // Log summary
  console.log('Video For New Recruits — build summary');
  console.log('------------------------------------------');
  console.log(`Input rows:     ${rows.length}`);
  console.log(`Kept:           ${kept}`);
  console.log(`Dropped non-Hip:${dropped.nonHip}`);
  console.log(`Dropped dupes:  ${dropped.duplicate}`);
  console.log(`Dropped no-URL: ${dropped.noUrl}`);
  console.log(`SBD:            ${sbdCount}`);
  console.log(`Partial lists:  ${partialCount}`);
  console.log('');
  for (const era of eras) {
    console.log(`  ${era.era.padEnd(30)} ${era.count} videos`);
  }
  console.log('');
  console.log(`Wrote: ${JSON_OUT}`);
}

main();
