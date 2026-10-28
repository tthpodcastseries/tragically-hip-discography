#!/usr/bin/env node
// build-show-index.js
// Slim per-show lookup for the Yer Hip Passport (v5): map coordinates and
// whether the Hip Archive has a recording, without making phones download the
// 2.6 MB data/tth-tour-data.json.
// Output data/show-index.json: { "<showId>": [lat, lng, hasRecording(0|1)] }
//
// Usage: node scripts/build-show-index.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tour = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tth-tour-data.json'), 'utf8'));

const out = {};
let noCoords = 0, playable = 0;
for (const g of tour) {
  const hasRec = (g.tracks || []).length > 0 ? 1 : 0;
  playable += hasRec;
  if (typeof g.lat !== 'number' || typeof g.lng !== 'number') { noCoords++; out[g.id] = [null, null, hasRec]; continue; }
  out[g.id] = [Math.round(g.lat * 1e4) / 1e4, Math.round(g.lng * 1e4) / 1e4, hasRec];
}
fs.writeFileSync(path.join(ROOT, 'data', 'show-index.json'), JSON.stringify(out) + '\n');
console.log(`wrote data/show-index.json: ${Object.keys(out).length} shows, ${playable} with recordings, ${noCoords} without coordinates`);
