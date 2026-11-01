#!/usr/bin/env node
// apply-unplucked-corrections.js
// Layers the spelling fixes in data/unplucked-corrections.json onto the Unplucked Gems
// notes in data/unplucked-gems.json (jD, 2026-11-01, audit BRAND-13). Spelling only:
// wording, style and session names stay as the tracker wrote them. Safe to re-run:
// a fix that's already in place matches nothing. parse-sessions-csv.js runs this
// after any rebuild, so a fresh tracker import keeps the fixes.
//
// Usage: node scripts/apply-unplucked-corrections.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const gemsPath = path.join(ROOT, 'data', 'unplucked-gems.json');
const fixesPath = path.join(ROOT, 'data', 'unplucked-corrections.json');

function applyUnpluckedCorrections() {
  const gems = JSON.parse(fs.readFileSync(gemsPath, 'utf8'));
  const { spelling } = JSON.parse(fs.readFileSync(fixesPath, 'utf8'));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = spelling.map(([from, to]) => ({ re: new RegExp('\\b' + esc(from) + '\\b', 'g'), to }));
  let fixed = 0;
  for (const era of gems.eras || []) {
    for (const s of era.sessions || []) {
      if (typeof s.notes !== 'string') continue;
      let notes = s.notes;
      for (const r of rules) notes = notes.replace(r.re, () => { fixed++; return r.to; });
      s.notes = notes;
    }
  }
  if (fixed) fs.writeFileSync(gemsPath, JSON.stringify(gems, null, 2) + '\n');
  console.log(`Unplucked Gems spelling fixes applied: ${fixed}`);
  return fixed;
}

if (require.main === module) applyUnpluckedCorrections();
module.exports = { applyUnpluckedCorrections };
