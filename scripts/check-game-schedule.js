#!/usr/bin/env node
// check-game-schedule.js
// Proves no scheduled daily-game puzzle moved (v5.4.9, audit GAME-01; lock file and
// start dates since the relaunch fixes, audit GAME-01 and GAME-02).
//
// Two checks on data/game-pool.json ('Bring It All Back') and data/trunk-pool.json
// ('(Un)Locked'):
//
// 1. The lock (data/game-schedule-lock.json, committed). It holds each game's start
//    date and a fingerprint of every scheduled day's puzzle (Bring It All Back: the
//    show; (Un)Locked: song, version, words and scrambles). It never "moves past" a
//    bad push: a changed day fails here until the change is undone, however many
//    commits later. Needs no git history, so it also runs in Netlify's build.
//      - every locked day must keep its puzzle
//      - the start date (EPOCH in js/<game>.js) must match, and may only change
//        while the game has not opened on either date
//      - new days on the end must be added to the lock (the builders do this)
//
// 2. An earlier copy from git (default: the last commit), day by day:
//      - every day that already had a puzzle keeps the same show / song, words, scrambles
//      - today and tomorrow must not change at all (fans east of Toronto get
//        tomorrow's puzzle first)
//      - later days may pick up refreshed details (venue, songs, play links);
//        these are listed, not failed
//      - the start date did not change (unless the game hasn't opened on either date)
//      - new puzzles may only be added to the end
//
// Run it after any builder run and right before a push.
//
// Usage: node scripts/check-game-schedule.js                  (lock + the last commit)
//        node scripts/check-game-schedule.js --ref <git ref>  (lock + that commit)
//        node scripts/check-game-schedule.js --no-git         (lock only)
//        node scripts/check-game-schedule.js --no-lock --ref <git ref>   (git only)
//        node scripts/check-game-schedule.js --before <folder with both old files>
//        node scripts/check-game-schedule.js --update-lock    (add new days to the lock;
//            the builders run this. Refuses if a locked day changed, unless approved)
//        node scripts/check-game-schedule.js --update-lock --reset <game-pool.json|trunk-pool.json>
//            (only after jD starts that game over with the builder's --force)
// Exit code 0 = nothing scheduled moved, 1 = something did,
//           2 = the git ref could not be read (no history here; the lock was still checked).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(ROOT, 'data', 'game-schedule-lock.json');
const LOCK_AHEAD_DAYS = 1;
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const flag = name => process.argv.includes(name);
const REF = arg('--ref') || 'HEAD';
const BEFORE = arg('--before');
const UPDATE_LOCK = flag('--update-lock');
const RESET = arg('--reset');
const USE_GIT = !flag('--no-git') && !UPDATE_LOCK;
const USE_LOCK = !flag('--no-lock') || UPDATE_LOCK;

// Puzzle changes jD approved by puzzle number, per file, e.g. 'trunk-pool.json': [116].
// They are listed but don't fail either check, and --update-lock records their new
// fingerprint. Only add a puzzle here when jD says so; take it out once pushed.
const APPROVED = {};

// A start-date move jD approved, per file, e.g. 'trunk-pool.json': ['2026-11-04', '2026-11-02'].
// Only for a game nobody has played yet: it lets that exact move through both checks once
// the game is within a day of opening. Only add one when jD says so; take it out once pushed.
const APPROVED_START = { 'trunk-pool.json': ['2026-11-04', '2026-11-02'] };
const startApproved = (file, from, to) => { const a = APPROVED_START[file]; return !!a && a[0] === from && a[1] === to; };

const GAMES = [
  {
    name: "'Bring It All Back'", file: 'game-pool.json', jsFile: 'bring-it-all-back.js', listKey: 'shows',
    keyOf: s => s.id, label: s => `show ${s.id} (${s.d})`,
    // The answer date is part of the puzzle: always list a changed one in full
    detailNote: (a, b) => a.d !== b.d ? `answer date ${a.d} -> ${b.d}` : '',
  },
  {
    // The puzzle itself is the song, its version and the five words with their scrambles;
    // album hint and play links (al, sp, lv) are refreshed details
    name: "'(Un)Locked'", file: 'trunk-pool.json', jsFile: 'unlocked.js', listKey: 'puzzles',
    keyOf: p => JSON.stringify([p.s, p.t, p.v, p.w]), label: p => `'${p.t}' v${p.v}`,
    detailNote: () => '',
  },
];

// Day numbers, the same way the games count them (local calendar date)
const dayNumber = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const now = new Date();
const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
const EPOCH_RE = /const EPOCH = '(\d{4})-(\d{2})-(\d{2})'/;
const epochText = (src, where) => { const m = src.match(EPOCH_RE); if (!m) throw new Error('Could not find EPOCH in ' + where); return `${m[1]}-${m[2]}-${m[3]}`; };
const epochDay = text => { const [y, m, d] = text.split('-').map(Number); return dayNumber(y, m, d); };
// A game has opened once its puzzle No. 1 can be in play somewhere (fans east of Toronto
// get tomorrow's puzzle first)
const hasOpened = text => today + LOCK_AHEAD_DAYS >= epochDay(text);
const dateOf = n => new Date(n * 86400000).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const fingerprint = (game, item) => crypto.createHash('sha256').update(game.keyOf(item)).digest('hex').slice(0, 16);

const current = {};
for (const g of GAMES) {
  current[g.file] = {
    list: JSON.parse(fs.readFileSync(path.join(ROOT, 'data', g.file), 'utf8'))[g.listKey],
    text: fs.readFileSync(path.join(ROOT, 'data', g.file), 'utf8'),
    epoch: epochText(fs.readFileSync(path.join(ROOT, 'js', g.jsFile), 'utf8'), 'js/' + g.jsFile),
  };
}

let failed = false;

// ---------- 1. The lock ----------
function readLock() {
  if (!fs.existsSync(LOCK_FILE)) return null;
  return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
}

function updateLock() {
  const lock = readLock() || { games: {} };
  let refused = false;
  for (const g of GAMES) {
    const cur = current[g.file];
    const fresh = { name: g.name.replace(/'/g, ''), epoch: cur.epoch, days: cur.list.map(item => fingerprint(g, item)) };
    const old = lock.games[g.file];
    if (!old || RESET === g.file) {
      lock.games[g.file] = fresh;
      console.log(`${g.name}: lock ${old ? 'started over' : 'created'} with ${fresh.days.length} days from ${cur.epoch}`);
      continue;
    }
    const ok = APPROVED[g.file] || [];
    const problems = [];
    if (old.epoch !== cur.epoch && (hasOpened(old.epoch) || hasOpened(cur.epoch)) && !startApproved(g.file, old.epoch, cur.epoch)) problems.push(`start date changed from ${old.epoch} to ${cur.epoch}, and the game has opened`);
    if (cur.list.length < old.days.length) problems.push(`the schedule got shorter (${old.days.length} -> ${cur.list.length} days)`);
    const relocked = [];
    old.days.forEach((fp, i) => {
      if (i >= cur.list.length || fresh.days[i] === fp) return;
      if (ok.includes(i + 1)) relocked.push(i + 1);
      else problems.push(`No. ${i + 1} (${dateOf(epochDay(old.epoch) + i)}) changed`);
    });
    if (problems.length) {
      refused = true;
      console.error(`${g.name}: NOT updating the lock:`);
      problems.slice(0, 30).forEach(p => console.error('  ' + p));
      continue;
    }
    const added = fresh.days.length - old.days.length;
    lock.games[g.file] = fresh;
    console.log(`${g.name}: lock has ${fresh.days.length} days from ${cur.epoch}; ${added} added${relocked.length ? `; re-locked with jD's approval: No. ${relocked.join(', ')}` : ''}${old.epoch !== cur.epoch ? `; start date moved from ${old.epoch} (${startApproved(g.file, old.epoch, cur.epoch) ? "with jD's approval" : 'not opened yet'})` : ''}`);
  }
  if (refused) {
    console.error('\nFAILED - the lock was not changed. A scheduled puzzle moved; put it back (git checkout data/<file>).');
    process.exit(1);
  }
  const out = {
    about: 'Fingerprints of every scheduled daily-game puzzle, one per day from the start date. Written only by scripts/check-game-schedule.js --update-lock (the game builders run it). Never edit by hand.',
    games: lock.games,
  };
  const text = JSON.stringify(out, null, 2) + '\n';
  if (fs.existsSync(LOCK_FILE) && fs.readFileSync(LOCK_FILE, 'utf8') === text) console.log('\nLock unchanged: data/game-schedule-lock.json');
  else { fs.writeFileSync(LOCK_FILE, text); console.log('\nWrote data/game-schedule-lock.json'); }
  process.exit(0);
}

function checkLock() {
  const lock = readLock();
  if (!lock) { failed = true; console.log('\nLOCK MISSING - data/game-schedule-lock.json is gone. Get it back with git checkout data/game-schedule-lock.json'); return; }
  for (const g of GAMES) {
    const cur = current[g.file];
    const locked = lock.games[g.file];
    console.log(`\n${g.name} vs the lock (data/game-schedule-lock.json)`);
    if (!locked) { failed = true; console.log(`  NOT IN THE LOCK - run node scripts/check-game-schedule.js --update-lock`); continue; }
    const ok = APPROVED[g.file] || [];
    const moved = [], approved = [];
    locked.days.forEach((fp, i) => {
      const day = `No. ${i + 1} (${dateOf(epochDay(locked.epoch) + i)})`;
      if (i >= cur.list.length) moved.push(`${day} is gone`);
      else if (fingerprint(g, cur.list[i]) !== fp) (ok.includes(i + 1) ? approved : moved).push(`${day} is now ${g.label(cur.list[i])}, not the locked puzzle`);
    });
    const unlocked = cur.list.length - locked.days.length;
    console.log(`  start date ${cur.epoch}; ${locked.days.length} locked days, ${locked.days.length - moved.length - approved.length} unchanged`);
    if (locked.epoch !== cur.epoch) {
      failed = true;
      console.log(`  START DATE CHANGED: the lock says ${locked.epoch}, js/${g.jsFile} says ${cur.epoch}. That shifts every fan's puzzle.`);
      console.log(hasOpened(locked.epoch) || hasOpened(cur.epoch)
        ? '    The game has opened, so put the old date back.'
        : '    The game has not opened yet, so if jD moved the launch, run node scripts/check-game-schedule.js --update-lock to record it.');
    }
    if (approved.length) { console.log(`  changed with jD's approval (${approved.length}) - run --update-lock to lock them:`); approved.forEach(m => console.log('    ' + m)); }
    if (moved.length) { failed = true; console.log(`  MOVED (${moved.length}):`); moved.slice(0, 30).forEach(m => console.log('    ' + m)); }
    if (unlocked > 0) { failed = true; console.log(`  ${unlocked} new days on the end are not in the lock yet: run node scripts/check-game-schedule.js --update-lock`); }
  }
}

// ---------- 2. An earlier copy from git ----------
function gitShow(file) {
  return execFileSync('git', ['show', `${REF}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function oldCopy(g) {
  if (BEFORE) {
    const dir = path.resolve(BEFORE);
    const js = path.join(dir, g.jsFile);
    return { text: fs.readFileSync(path.join(dir, g.file), 'utf8'), epoch: fs.existsSync(js) ? epochText(fs.readFileSync(js, 'utf8'), js) : null };
  }
  const text = gitShow('data/' + g.file);
  let epoch = null;
  try { epoch = epochText(gitShow('js/' + g.jsFile), `${REF}:js/${g.jsFile}`); } catch (e) { /* older commit without the file */ }
  return { text, epoch };
}

function checkAgainst(g) {
  const old = oldCopy(g);
  const cur = current[g.file];
  const a = JSON.parse(old.text)[g.listKey];
  const b = cur.list;
  const epoch = epochDay(cur.epoch);
  const todayNo = today - epoch + 1; // 0 or less = not open yet
  const lockedThrough = todayNo + LOCK_AHEAD_DAYS;
  const day = i => `No. ${i + 1} (${dateOf(epoch + i)})`;

  const moved = [], lockedChanged = [], refreshed = [], dateChanged = [], approved = [];
  const ok = APPROVED[g.file] || [];
  for (let i = 0; i < a.length; i++) {
    if (i >= b.length) { moved.push(`${day(i)} ${g.label(a[i])} is gone`); continue; }
    if (g.keyOf(a[i]) !== g.keyOf(b[i])) (ok.includes(i + 1) ? approved : moved).push(`${day(i)} was ${g.label(a[i])}, now ${g.label(b[i])}`);
    else if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      if (i + 1 <= lockedThrough) lockedChanged.push(`${day(i)} ${g.label(b[i])}`);
      else { const note = g.detailNote(a[i], b[i]); (note ? dateChanged : refreshed).push(`${day(i)} ${g.label(b[i])}${note ? ': ' + note : ''}`); }
    }
  }
  const added = Math.max(0, b.length - a.length);
  const where = BEFORE ? BEFORE : REF;

  console.log(`\n${g.name} vs ${where} (data/${g.file})`);
  console.log(`  ${todayNo >= 1 ? `today is puzzle No. ${todayNo}` : `opens ${dateOf(epoch)}, so every puzzle is still upcoming`}; checked ${a.length} scheduled days`);
  console.log(`  file ${old.text === cur.text ? 'byte-identical' : 'differs'}; ${a.length - moved.length - approved.length} days kept their puzzle, ${added} added on the end`);
  if (old.epoch && old.epoch !== cur.epoch) {
    if (startApproved(g.file, old.epoch, cur.epoch)) console.log(`  start date moved from ${old.epoch} to ${cur.epoch} with jD's approval`);
    else if (hasOpened(old.epoch) || hasOpened(cur.epoch)) { failed = true; console.log(`  START DATE CHANGED from ${old.epoch} to ${cur.epoch} after the game opened: every fan's puzzle shifts. Put the old date back.`); }
    else console.log(`  start date moved from ${old.epoch} to ${cur.epoch} (the game has not opened on either date)`);
  }
  if (approved.length) { console.log(`  changed with jD's approval (${approved.length}):`); approved.forEach(m => console.log('    ' + m)); }
  if (moved.length) { failed = true; console.log(`  MOVED (${moved.length}):`); moved.slice(0, 30).forEach(m => console.log('    ' + m)); }
  if (lockedChanged.length) { failed = true; console.log(`  CHANGED on a day that may already be in play (${lockedChanged.length}):`); lockedChanged.forEach(m => console.log('    ' + m)); }
  if (dateChanged.length) { console.log(`  answer date changed on ${dateChanged.length} later days (same show):`); dateChanged.forEach(m => console.log('    ' + m)); }
  if (refreshed.length) { console.log(`  details refreshed on ${refreshed.length} later days (same puzzle):`); refreshed.slice(0, 30).forEach(m => console.log('    ' + m)); }
}

let unreadable = false;
if (UPDATE_LOCK) updateLock();
if (USE_LOCK) checkLock();
if (USE_GIT || BEFORE) {
  let refOk = true;
  if (!BEFORE) {
    try { execFileSync('git', ['rev-parse', '--verify', '--quiet', REF + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); }
    catch (e) { refOk = false; unreadable = true; console.log(`\nCan't read ${REF} from git here (no history in this copy), so the schedule was only checked against the lock.`); }
  }
  if (refOk) for (const g of GAMES) {
    try { checkAgainst(g); }
    catch (e) { unreadable = true; console.log(`\nCan't read data/${g.file} at ${BEFORE || REF} (${e.message.split('\n')[0]}), so it was only checked against the lock.`); }
  }
}

if (failed) console.log('\nFAILED - a scheduled puzzle moved or changed. Don\'t commit or push this.');
else if (unreadable) console.log(USE_LOCK ? '\nOK against the lock - no locked puzzle moved (the git comparison could not run).' : '\nNOT CHECKED - the git comparison could not run.');
else console.log('\nOK - no scheduled puzzle moved.');
process.exit(failed ? 1 : unreadable ? 2 : 0);
