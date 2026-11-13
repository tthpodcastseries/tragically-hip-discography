#!/usr/bin/env node
// check-clip-files.js - is every 'Little Bones' clip still on Backblaze?
//
// For each puzzle in data/clip-pool.json it builds the file's address the same way the
// game does (AUDIO_BASE, read from js/little-bones.js, plus each part of the path through
// encodeURIComponent) and asks for the first 1,024 bytes only. An answer of 200 or 206
// with an audio file behind it is good. Anything else is a clip a fan would press play on
// and hear nothing.
//
// It goes one file at a time with a pause between them, and tries a file again before
// calling it missing, so a network blip can't raise a false alarm. All 412 take about
// three minutes. It reads only: nothing is written to Backblaze or to the repo.
//
// GitHub runs it every Monday with the weekly audit (.github/workflows/site-audit.yml).
// It is NOT part of audit-site.js or the Netlify build: a slow day at Backblaze must
// never stop a deploy.
//
// Usage: node scripts/check-clip-files.js [--from N] [--to N] [--delay ms] [--json report.json]
//   --from / --to   puzzle numbers to check (default: all of them)
//   --delay         pause between files in milliseconds (default 150)
//   --json          also write the result to a file
// Exit 0 = every clip answered, 1 = at least one did not.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; };
const DELAY = Math.max(0, Number(arg('--delay') ?? 150));
const jsonOut = arg('--json');
const BYTES = 1024;
const TIMEOUT_MS = 20000;
const TRIES = 3;
const RETRY_WAIT_MS = 5000;

// The game's own settings, so this can never check a different address than fans get
const gameSrc = fs.readFileSync(path.join(ROOT, 'js/little-bones.js'), 'utf8');
const base = (gameSrc.match(/const AUDIO_BASE = '([^']+)'/) || [])[1];
const epoch = (gameSrc.match(/const EPOCH = '(\d{4}-\d{2}-\d{2})'/) || [])[1];
if (!base || !epoch) {
  console.error('STOPPED - could not find AUDIO_BASE or EPOCH in js/little-bones.js.');
  process.exit(1);
}
if (!gameSrc.includes(".split('/').map(encodeURIComponent).join('/')")) {
  console.error('STOPPED - js/little-bones.js no longer builds the clip address the way this script does. Update urlOf() below to match it.');
  process.exit(1);
}
const urlOf = p => base + '/' + p.u.split('/').map(encodeURIComponent).join('/');

const puzzles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clip-pool.json'), 'utf8')).puzzles;
const from = Math.max(1, Number(arg('--from') ?? 1));
const to = Math.min(puzzles.length, Number(arg('--to') ?? puzzles.length));
if (!(from <= to)) {
  console.error(`STOPPED - nothing to check between puzzle ${from} and puzzle ${to} (there are ${puzzles.length}).`);
  process.exit(1);
}

const [ey, em, ed] = epoch.split('-').map(Number);
const dateOf = no => new Date(Date.UTC(ey, em - 1, ed + no - 1)).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const sleep = ms => new Promise(res => setTimeout(res, ms));

// A recording can be scheduled more than once: ask for each file once, list every puzzle it is in
const files = new Map();
for (let no = from; no <= to; no++) {
  const p = puzzles[no - 1];
  const url = urlOf(p);
  if (!files.has(url)) files.set(url, { url, file: p.u, title: p.t, nos: [] });
  files.get(url).nos.push(no);
}

// One try: { ok, status, type, note }
async function ask(url) {
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${BYTES - 1}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get('content-type') || '';
    if (res.body) await res.body.cancel().catch(() => {});
    if (res.status !== 200 && res.status !== 206) return { ok: false, status: res.status, type, note: 'answered ' + res.status };
    if (!/^audio\//i.test(type)) return { ok: false, status: res.status, type, note: `answered ${res.status} but it is not an audio file (${type || 'no type given'})` };
    return { ok: true, status: res.status, type };
  } catch (e) {
    return { ok: false, status: 0, type: '', note: 'no answer (' + (e.name === 'TimeoutError' ? `gave up after ${TIMEOUT_MS / 1000} seconds` : (e.cause && e.cause.code) || e.message) + ')' };
  }
}
// A missing file (404) is missing: no point asking again. Anything else gets more tries.
async function check(url) {
  let last;
  for (let t = 1; t <= TRIES; t++) {
    last = await ask(url);
    if (last.ok || last.status === 404) break;
    if (t < TRIES) await sleep(RETRY_WAIT_MS);
  }
  return last;
}

(async () => {
  console.log(`=== 'Little Bones' clip files ===`);
  console.log(`  puzzles ${from} to ${to} (${dateOf(from)} to ${dateOf(to)}): ${files.size} file(s) at ${base}`);
  const bad = [];
  const answers = {};
  let done = 0;
  for (const f of files.values()) {
    const r = await check(f.url);
    done++;
    if (r.ok) answers[r.status] = (answers[r.status] || 0) + 1;
    else bad.push({ ...f, ...r });
    if (done % 50 === 0 && done < files.size) console.log(`  ${done} of ${files.size} checked, ${bad.length} problem(s) so far`);
    if (done < files.size) await sleep(DELAY);
  }
  const summary = Object.entries(answers).map(([status, n]) => `${n} answered ${status}`).join(', ') || 'none answered';
  console.log(`  ${done} checked: ${summary}`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({
      checked: new Date().toISOString(), base, from, to, files: files.size,
      problems: bad.map(b => ({ puzzles: b.nos, dates: b.nos.map(dateOf), song: b.title, file: b.file, url: b.url, status: b.status, note: b.note })),
    }, null, 2) + '\n');
  }

  if (!bad.length) { console.log('\nEvery clip answered.'); return; }
  console.error(`\n${bad.length} clip(s) did not answer:`);
  for (const b of bad) {
    console.error(`  x puzzle ${b.nos.join(', ')} (${b.nos.map(dateOf).join('; ')}) '${b.title}' - ${b.note}`);
    console.error(`      ${b.file}`);
  }
  console.error("\nBefore the game opens, a missing clip can be swapped for another recording: add it to skip in data/clip-starts.json and run node scripts/build-clip-pool.js. Once the game has opened the schedule is locked, so put the file back on Backblaze under the same name.");
  process.exit(1);
})();
