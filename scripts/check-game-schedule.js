#!/usr/bin/env node
// check-game-schedule.js
// Proves no scheduled daily-game puzzle moved (v5.4.9, audit GAME-01).
//
// Compares data/game-pool.json ('Bring It All Back') and data/trunk-pool.json
// ('(Un)Locked') with an earlier copy, day by day:
//   - every day that already had a puzzle must keep the same show / the same
//     song, words and scrambles (past days included)
//   - today and tomorrow must not change at all (fans east of Toronto get
//     tomorrow's puzzle first)
//   - later days may pick up refreshed details (venue, songs, play links);
//     these are listed, not failed
//   - new puzzles may only be added to the end
//
// Run it after any builder run and right before a push.
//
// Usage: node scripts/check-game-schedule.js                 (against the last commit)
//        node scripts/check-game-schedule.js --ref <git ref>
//        node scripts/check-game-schedule.js --before <folder with both old files>
// Exit code 0 = nothing scheduled moved, 1 = something did.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOCK_AHEAD_DAYS = 1;
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const REF = arg('--ref') || 'HEAD';
const BEFORE = arg('--before');

function oldText(file) {
  if (BEFORE) return fs.readFileSync(path.join(path.resolve(BEFORE), file), 'utf8');
  return execFileSync('git', ['show', `${REF}:data/${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// Day numbers, the same way the games count them (local calendar date)
const dayNumber = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const now = new Date();
const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
function epochOf(jsFile) {
  const m = fs.readFileSync(path.join(ROOT, 'js', jsFile), 'utf8').match(/const EPOCH = '(\d{4})-(\d{2})-(\d{2})'/);
  if (!m) throw new Error('Could not find EPOCH in js/' + jsFile);
  return dayNumber(+m[1], +m[2], +m[3]);
}
const dateOf = n => new Date(n * 86400000).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

// Puzzle changes jD approved by name. They are listed but don't fail the check. Only add a
// puzzle here when jD says so; entries can go once the change has been pushed.
const APPROVED = {
  // v5.4.10 (audit DATA-06, jD 2026-10-31): "chorus" swapped for a real lyric word
  'trunk-pool.json': [116, 249, 343],
};

let failed = false;
function check(name, file, jsFile, listKey, keyOf, label) {
  const before = oldText(file);
  const after = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8');
  const a = JSON.parse(before)[listKey];
  const b = JSON.parse(after)[listKey];
  const epoch = epochOf(jsFile);
  const todayNo = today - epoch + 1; // 0 or less = not open yet
  const lockedThrough = todayNo + LOCK_AHEAD_DAYS;
  const day = i => `#${i + 1} (${dateOf(epoch + i)})`;

  const moved = [], lockedChanged = [], refreshed = [], approved = [];
  const ok = APPROVED[file] || [];
  for (let i = 0; i < a.length; i++) {
    if (i >= b.length) { moved.push(`${day(i)} ${label(a[i])} is gone`); continue; }
    if (keyOf(a[i]) !== keyOf(b[i])) (ok.includes(i + 1) ? approved : moved).push(`${day(i)} was ${label(a[i])}, now ${label(b[i])}`);
    else if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) (i + 1 <= lockedThrough ? lockedChanged : refreshed).push(`${day(i)} ${label(b[i])}`);
  }
  const added = Math.max(0, b.length - a.length);

  console.log(`\n${name} (${file})`);
  console.log(`  ${todayNo >= 1 ? `today is puzzle #${todayNo}` : `opens ${dateOf(epoch)}, so every puzzle is still upcoming`}; checked ${a.length} scheduled days`);
  console.log(`  file ${before === after ? 'byte-identical' : 'differs'}; ${a.length - moved.length - approved.length} days kept their puzzle, ${added} added on the end`);
  if (approved.length) { console.log(`  changed with jD's approval (${approved.length}):`); approved.forEach(m => console.log('    ' + m)); }
  if (moved.length) { failed = true; console.log(`  MOVED (${moved.length}):`); moved.slice(0, 30).forEach(m => console.log('    ' + m)); }
  if (lockedChanged.length) { failed = true; console.log(`  CHANGED on a day that may already be in play (${lockedChanged.length}):`); lockedChanged.forEach(m => console.log('    ' + m)); }
  if (refreshed.length) { console.log(`  details refreshed on ${refreshed.length} later days (same puzzle):`); refreshed.slice(0, 30).forEach(m => console.log('    ' + m)); }
}

check("'Bring It All Back'", 'game-pool.json', 'bring-it-all-back.js', 'shows', s => s.id, s => `show ${s.id} (${s.d})`);
// The puzzle itself is the song, its version and the five words with their scrambles;
// album hint and play links (al, sp, lv) are refreshed details
check("'(Un)Locked'", 'trunk-pool.json', 'unlocked.js', 'puzzles', p => JSON.stringify([p.s, p.t, p.v, p.w]), p => `'${p.t}' v${p.v}`);

console.log(failed ? '\nFAILED - a scheduled puzzle moved or changed. Don\'t commit or push this.' : '\nOK - no scheduled puzzle moved.');
process.exit(failed ? 1 : 0);
