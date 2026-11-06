#!/usr/bin/env node
// build-bird-grids.js
// Lays out the grids for 'Words Into Birds', the weekly crossword, played at
// /words-into-birds (words-into-birds.html).
//
// Every puzzle has exactly 20 clues: 15 about The Hip and 5 linking words (jD, 2026-11-06).
// data/bird-puzzles.json is edited by hand, like lyrics.json: one puzzle a week, 15 Hip
// clues, each { answer, enum, clue }. answer is capital letters only (GRACETOO); enum is the
// word lengths shown after the clue ("5, 3"). This script adds the grid to any puzzle that
// doesn't have one yet: it lays out the 15 Hip answers, then picks 5 linking words from
// data/bird-links.json (music words: instruments, the studio, the road, the page, the record)
// that cross the most Hip answers, the way a real crossword ties its long answers together.
// Linking clues are marked "link": true. It writes rows and cols on the puzzle, and row,
// col, dir and num on each clue. It never touches a puzzle that already has a grid, so a
// scheduled puzzle can't move.
//
// Answers only cross where they share a letter, and never touch side by side. Grids are at
// most 15 squares wide so they fit a phone (about 22px a square at 375px wide); taller is
// fine, the page scrolls.
//
// Repeats: a Hip answer comes back 5 or more puzzles after its last use (more than a month);
// a linking word 2 or more (never two weeks running), with its next clue from the list.
//
// To change a grid before the game opens: delete that puzzle's rows and cols, run this
// again (its linking words are picked fresh). To reword one linking clue, edit its text in
// place. After the game opens, never change, reorder or remove a scheduled puzzle
// (node scripts/check-game-schedule.js).
//
// Usage: node scripts/build-bird-grids.js            (lay out new puzzles, update the lock)
//        node scripts/build-bird-grids.js --check    (report only, write nothing)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'bird-puzzles.json');
const LINKS_FILE = path.join(ROOT, 'data', 'bird-links.json');
const CHECK = process.argv.includes('--check');
const CLUES = 20;
const HIP = 15;
const LINKS = CLUES - HIP;
// An answer can come back, but not within a month: at least 5 puzzles after its last use.
// Linking words are crossword staples and can come back sooner, just never two weeks running.
const REPEAT_GAP = 5;
const LINK_GAP = 2;
const MAX_COLS = 15;
const MAX_ROWS = 22;
const TRIES = 6000;
const FILLS = 40;      // best Hip layouts that get linking words tried on them

// Same seeded random numbers as the games use, so a grid comes out the same every run
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// grid: Map "r,c" -> { ch, dirs }
const key = (r, c) => r + ',' + c;
const step = d => d === 'across' ? [0, 1] : [1, 0];

// How many squares the answer would share with answers already down, or -1 if it can't go there
function fits(grid, w, r, c, d) {
  const [dr, dc] = step(d);
  if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1;
  let cross = 0;
  for (let i = 0; i < w.length; i++) {
    const rr = r + dr * i, cc = c + dc * i;
    const g = grid.get(key(rr, cc));
    if (g) {
      if (g.ch !== w[i] || g.dirs.includes(d)) return -1;
      cross++;
    } else if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) {
      return -1; // would touch another answer side by side
    }
  }
  return cross;
}

function place(grid, w, r, c, d) {
  const [dr, dc] = step(d);
  for (let i = 0; i < w.length; i++) {
    const k = key(r + dr * i, c + dc * i);
    const g = grid.get(k);
    if (g) g.dirs.push(d); else grid.set(k, { ch: w[i], dirs: [d] });
  }
}

function bounds(grid, extra) {
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  const add = (r, c) => { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); };
  for (const k of grid.keys()) { const [r, c] = k.split(',').map(Number); add(r, c); }
  if (extra) { add(extra[0], extra[1]); add(extra[2], extra[3]); }
  return { r0, c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
}

function attempt(words, rand) {
  const order = words.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.sort((a, b) => (b.length - a.length) + (rand() - 0.5) * 6);
  const grid = new Map();
  const placed = [{ w: order[0], r: 0, c: 0, d: 'across' }];
  place(grid, order[0], 0, 0, 'across');
  let pending = order.slice(1);
  for (let pass = 0; pass < 5 && pending.length; pass++) {
    const later = [];
    for (const w of pending) {
      let best = null;
      for (const [k, g] of grid) {
        const [pr, pc] = k.split(',').map(Number);
        for (let i = 0; i < w.length; i++) {
          if (w[i] !== g.ch) continue;
          for (const d of ['across', 'down']) {
            const r = d === 'across' ? pr : pr - i, c = d === 'across' ? pc - i : pc;
            const x = fits(grid, w, r, c, d);
            if (x < 1) continue;
            const [dr, dc] = step(d);
            const b = bounds(grid, [r, c, r + dr * (w.length - 1), c + dc * (w.length - 1)]);
            if (b.cols > MAX_COLS || b.rows > MAX_ROWS) continue;
            const score = b.rows * b.cols - x * 10 + rand() * 40;
            if (!best || score < best.score) best = { score, r, c, d };
          }
        }
      }
      if (!best) { later.push(w); continue; }
      place(grid, w, best.r, best.c, best.d);
      placed.push({ w, r: best.r, c: best.c, d: best.d });
    }
    pending = later;
  }
  if (pending.length) return null;
  const b = bounds(grid);
  let crossings = 0;
  for (const g of grid.values()) if (g.dirs.length === 2) crossings++;
  return { placed, ...b, crossings };
}

// Add the linking words: one at a time, the bank word that crosses the most Hip answers
// (two or more where it can), keeping the grid 15 wide. A word used less often wins a tie,
// and a grid takes one plain crossword word ('general') at most.
function fill(placed, cands, rand) {
  const grid = new Map();
  for (const p of placed) place(grid, p.w, p.r, p.c, p.d);
  const links = [];
  let general = 0;
  for (let t = 0; t < LINKS; t++) {
    const b = bounds(grid), area = b.rows * b.cols;
    let best = null;
    for (const cand of cands) {
      if (links.some(l => l.cand === cand) || (cand.kind === 'general' && general)) continue;
      const w = cand.answer;
      for (const [k, g] of grid) {
        const [pr, pc] = k.split(',').map(Number);
        for (let i = 0; i < w.length; i++) {
          if (w[i] !== g.ch) continue;
          for (const d of ['across', 'down']) {
            const r = d === 'across' ? pr : pr - i, c = d === 'across' ? pc - i : pc;
            const x = fits(grid, w, r, c, d);
            if (x < 1) continue;
            const [dr, dc] = step(d);
            const nb = bounds(grid, [r, c, r + dr * (w.length - 1), c + dc * (w.length - 1)]);
            if (nb.cols > MAX_COLS || nb.rows > MAX_ROWS) continue;
            const score = x * 100 - (nb.rows * nb.cols - area) - cand.uses * 15 + rand() * 30;
            if (!best || score > best.score) best = { score, cand, r, c, d };
          }
        }
      }
    }
    if (!best) return null;
    place(grid, best.cand.answer, best.r, best.c, best.d);
    if (best.cand.kind === 'general') general++;
    links.push(best);
  }
  const b = bounds(grid);
  let crossings = 0;
  for (const g of grid.values()) if (g.dirs.length === 2) crossings++;
  return { placed: placed.concat(links.map(l => ({ w: l.cand.answer, r: l.r, c: l.c, d: l.d, cand: l.cand }))), ...b, crossings };
}

function layout(hip, cands, seedBase) {
  const words = hip.map(c => c.answer);
  // Lay out the Hip answers many ways, then try the linking words on the best few dozen
  const tries = [];
  for (let t = 0; t < TRIES; t++) {
    const got = attempt(words, rng(seedBase * 100003 + t));
    if (got) tries.push({ got, t, score: got.rows * got.cols - got.crossings * 6 });
  }
  tries.sort((a, b) => a.score - b.score);
  let best = null;
  for (const { got, t } of tries.slice(0, FILLS)) {
    for (let f = 0; f < 3; f++) {
      const full = fill(got.placed, cands, rng(seedBase * 7919 + t * 13 + f));
      if (!full) continue;
      // Smaller and squarer is better, more crossings is better, and stay near 20 rows
      const score = full.rows * full.cols + Math.max(0, full.rows - 20) * 30 - full.crossings * 10;
      if (!best || score < best.score) best = { ...full, score };
    }
  }
  if (!best) return null;
  // Number the starting squares in reading order, the way crosswords do
  const starts = [...new Set(best.placed.map(p => key(p.r - best.r0, p.c - best.c0)))]
    .map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const num = new Map(starts.map((s, i) => [key(s[0], s[1]), i + 1]));
  const pos = p => { const row = p.r - best.r0, col = p.c - best.c0; return { row, col, dir: p.d, num: num.get(key(row, col)) }; };
  const at = new Map(best.placed.map(p => [p.w, p]));
  const clues = hip.map(c => ({ answer: c.answer, enum: c.enum, clue: c.clue, ...pos(at.get(c.answer)) }));
  for (const p of best.placed.filter(p => p.cand)) {
    const cand = p.cand;
    clues.push({ answer: cand.answer, enum: cand.enum, clue: cand.clues[cand.uses % cand.clues.length], link: true, ...pos(p) });
  }
  clues.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  return { rows: best.rows, cols: best.cols, crossings: best.crossings, links: best.placed.filter(p => p.cand).map(p => p.w), clues };
}

// ---------- Run ----------
const text = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(text);
const bank = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')).words;
const hipAnswers = new Set(data.puzzles.flatMap(p => (p.clues || []).filter(c => !c.link).map(c => c.answer)));
let problems = 0, built = 0;
{
  const clash = bank.filter(w => hipAnswers.has(w.answer)).map(w => w.answer);
  if (clash.length) { console.error(`bird-links.json: ${clash.join(', ')} ${clash.length > 1 ? 'are Hip answers' : 'is a Hip answer'} in bird-puzzles.json; take it off the linking list`); problems++; }
}
// Linking words in a puzzle that already has a grid (puzzle number -> answers)
const linksIn = i => (data.puzzles[i].rows ? data.puzzles[i].clues.filter(c => c.link).map(c => c.answer) : []);
const lastUse = new Map();
data.puzzles.forEach((p, i) => {
  const at = `Puzzle ${i + 1}`;
  const all = p.clues || [];
  const hip = all.filter(c => !c.link);
  const links = all.filter(c => c.link);
  if (p.rows && p.cols ? (hip.length !== HIP || links.length !== LINKS) : hip.length !== HIP) {
    console.error(`${at}: has ${hip.length} Hip clues and ${links.length} linking words; every puzzle has ${HIP} Hip clues (written by hand) and ${LINKS} linking words (added by this script)`); problems++; return;
  }
  const answers = hip.map(c => c.answer);
  const bad = answers.filter(a => !/^[A-Z]{3,}$/.test(a));
  if (bad.length) { console.error(`${at}: answers must be capital letters only, 3 or more: ${bad.join(', ')}`); problems++; return; }
  if (new Set(answers).size !== answers.length) { console.error(`${at}: an answer is used twice`); problems++; return; }
  const soon = answers.filter(a => lastUse.has(a) && i + 1 - lastUse.get(a) < REPEAT_GAP);
  answers.forEach(a => lastUse.set(a, i + 1));
  if (soon.length) { console.error(`${at}: ${soon.join(', ')} came up too recently; an answer can only come back ${REPEAT_GAP} or more puzzles later (more than a month)`); problems++; return; }
  if (p.rows && p.cols) { console.log(`${at}: grid already set (${p.cols} wide, ${p.rows} tall), left alone`); return; }
  // Linking words this grid may use: not in a puzzle less than LINK_GAP away either side,
  // and not part of (or containing) a Hip answer or a word in a clue in this grid
  const near = new Set();
  data.puzzles.forEach((q, j) => { if (j !== i && Math.abs(j - i) < LINK_GAP) linksIn(j).forEach(w => near.add(w)); });
  const words = new Set(hip.flatMap(c => c.clue.toUpperCase().match(/[A-Z]+/g) || []));
  const cands = bank.filter(w => !near.has(w.answer) && !words.has(w.answer) && !answers.some(a => a.includes(w.answer) || w.answer.includes(a)))
    .map(w => ({ ...w, uses: data.puzzles.slice(0, i).filter((q, j) => linksIn(j).includes(w.answer)).length }));
  const g = layout(hip, cands, i + 1);
  if (!g) { console.error(`${at}: no grid fits the ${HIP} Hip answers and ${LINKS} linking words within ${MAX_COLS} wide and ${MAX_ROWS} tall. The Hip answers add up to ${answers.join('').length} letters; swap a long answer for a shorter one, or one with more common letters`); problems++; return; }
  data.puzzles[i] = { rows: g.rows, cols: g.cols, clues: g.clues };
  built++;
  console.log(`${at}: new grid, ${g.cols} wide, ${g.rows} tall, ${g.crossings} crossings, linking words ${g.links.join(', ')}`);
});

if (problems) { console.error(`\nFAILED - ${problems} puzzle(s) need fixing. Nothing written.`); process.exit(1); }
if (CHECK) { console.log(`\n--check: ${built} grid(s) would be added. Nothing written.`); process.exit(0); }
if (!built) { console.log('\nNo new grids. data/bird-puzzles.json unchanged.'); }
else {
  // One clue per line keeps the file easy to read and to edit by hand
  const lines = ['{', `  "about": ${JSON.stringify(data.about)},`, '  "puzzles": ['];
  data.puzzles.forEach((p, i) => {
    lines.push('    {');
    lines.push(`      "rows": ${p.rows}, "cols": ${p.cols},`);
    lines.push('      "clues": [');
    p.clues.forEach((c, j) => lines.push('        ' + JSON.stringify(c) + (j < p.clues.length - 1 ? ',' : '')));
    lines.push('      ]');
    lines.push('    }' + (i < data.puzzles.length - 1 ? ',' : ''));
  });
  lines.push('  ]', '}', '');
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log(`\nWrote data/bird-puzzles.json (${built} new grid(s))`);
}
// Record any new puzzles in the schedule lock, like the other game builders
execFileSync(process.execPath, [path.join(__dirname, 'check-game-schedule.js'), '--update-lock'], { stdio: 'inherit' });
