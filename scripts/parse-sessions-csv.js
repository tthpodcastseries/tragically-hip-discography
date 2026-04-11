#!/usr/bin/env node
// parse-sessions-csv.js
// Parses "The Tragically Hip Tracker - Sessions.csv" into data/unplucked-gems.json

const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, '..', '..', '..', '..', 'Desktop', 'The Tragically Hip Tracker - Sessions.csv');
const outPath = path.join(__dirname, '..', 'data', 'unplucked-gems.json');

const raw = fs.readFileSync(csvPath, 'utf-8');

// --- CSV parser that handles quoted multiline fields ---
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
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(field.trim()); field = '';
        rows.push(row); row = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

const rows = parseCSV(raw);

// Header: Era, Name, Notes, (empty), Type, Available Length, Quality, Link(s)
// Skip header row
const eras = [];
let currentEra = null;

for (let i = 1; i < rows.length; i++) {
  const [era, name, notes, col4, type, availability, quality, links] = rows[i];

  // Skip empty rows
  if (!era && !name) continue;

  // Skip summary/metadata rows at end
  if (era === '' && name === '' && notes === 'Whole Spreadsheet Data') break;
  if (notes === 'Whole Spreadsheet Data') break;

  // Detect era separator rows (start with digit + " OG")
  if (era && /^\d+\s*OG\s*(File|Files)/i.test(era)) {
    // The album name is in the 'name' column of this row
    const albumRaw = name || '';
    const albumName = albumRaw.split('\n')[0].replace(/\(.*$/, '').trim();
    const altNames = albumRaw.includes('(')
      ? albumRaw.match(/\(([^)]+)\)/g)?.map(m => m.replace(/[()]/g, '').trim()) || []
      : [];

    // Parse counts from era field
    const countMatch = {
      full: parseInt((era.match(/(\d+)\s*Full/i) || [0, 0])[1]),
      partial: parseInt((era.match(/(\d+)\s*Partial/i) || [0, 0])[1]),
      snippet: parseInt((era.match(/(\d+)\s*Snippet/i) || [0, 0])[1]),
      unavailable: parseInt((era.match(/(\d+)\s*Unavailable/i) || [0, 0])[1]),
    };

    currentEra = {
      era: albumName,
      altNames,
      counts: countMatch,
      sessions: []
    };
    eras.push(currentEra);
    continue;
  }

  // Skip if no current era or this is just an era-level description row (no name)
  if (!currentEra) continue;
  if (!name) continue;

  // Parse tier from emoji prefix
  let tier = null;
  let cleanName = name;
  if (name.startsWith('🏆')) { tier = 'holy-grail'; cleanName = name.replace('🏆', '').trim(); }
  else if (name.startsWith('⭐')) { tier = 'standout'; cleanName = name.replace('⭐', '').trim(); }
  else if (name.startsWith('🥉')) { tier = 'notable'; cleanName = name.replace('🥉', '').trim(); }

  // Parse alternate names from parentheses in name field
  const nameLines = cleanName.split('\n');
  const primaryName = nameLines[0].trim();
  const altNamesFromName = [];
  for (let j = 1; j < nameLines.length; j++) {
    const line = nameLines[j].trim();
    if (line.startsWith('(') && line.endsWith(')')) {
      altNamesFromName.push(...line.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean));
    }
  }

  // Determine type description from col4 or type
  const sessionType = type || col4 || '';

  const entry = {
    era: era || currentEra.era,
    name: primaryName,
    tier,
    altNames: altNamesFromName.length ? altNamesFromName : undefined,
    notes: notes || undefined,
    type: sessionType || undefined,
    availability: availability || undefined,
    quality: quality || undefined,
    link: links || undefined,
  };

  // Clean up undefined fields
  Object.keys(entry).forEach(k => { if (entry[k] === undefined) delete entry[k]; });

  currentEra.sessions.push(entry);
}

// Build final output
const output = {
  title: "Unplucked Gems: The Tragically Hip Sessions Tracker",
  description: "A comprehensive catalogue of every known unreleased recording, demo, outtake, and alternate version from The Tragically Hip.",
  credit: "Compiled by Darius via TrackerHub",
  lastUpdated: new Date().toISOString().split('T')[0],
  summary: {
    totalEras: eras.length,
    totalSessions: eras.reduce((sum, e) => sum + e.sessions.length, 0),
    totalFull: eras.reduce((sum, e) => sum + e.counts.full, 0),
    totalUnavailable: eras.reduce((sum, e) => sum + e.counts.unavailable, 0),
  },
  eras
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${output.summary.totalSessions} sessions across ${output.summary.totalEras} eras to ${outPath}`);
