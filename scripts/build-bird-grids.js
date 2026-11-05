#!/usr/bin/env node
// build-bird-grids.js
// Lays out the grids for 'Words Into Birds', the weekly crossword, played at
// /words-into-birds (words-into-birds.html).
//
// data/bird-puzzles.json is edited by hand, like lyrics.json: one puzzle a week, exactly
// 20 clues, each { answer, enum, clue }. answer is capital letters only (GRACETOO); enum is
// the word lengths shown after the clue ("5, 3"). This script adds the grid to any puzzle
// that doesn't have one yet: rows and cols on the puzzle, and row, col, dir and num on each
// clue. It never touches a puzzle that already has a grid, so a scheduled puzzle can't move.
//
// The grid is a criss-cross: every answer is a real answer (no filler words), and answers
// only cross where they share a letter. Grids are at most 15 squares wide so they fit a
// phone (about 22px a square at 375px wide); taller is fine, the page scrolls.
//
// To change a grid before the game opens: delete that puzzle's rows and cols, run this
// again. After the game opens, never change, reorder or remove a scheduled puzzle
// (node scripts/check-game-schedule.js).
//
// Usage: node scripts/build-bird-grids.js            (lay out new puzzles, update the lock)
//        node scripts/build-bird-grids.js --check    (report only, write nothing)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'bird-puzzles.json');
const CHECK = process.argv.includes('--check');
const CLUES = 20;
const MAX_COLS = 15;
const MAX_ROWS = 22;
const TRIES = 6000;

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

function layout(puzzle, seedBase) {
  const words = puzzle.clues.map(c => c.answer);
  let best = null;
  for (let t = 0; t < TRIES; t++) {
    const got = attempt(words, rng(seedBase * 100003 + t));
    if (!got) continue;
    // Smaller and squarer is better, more crossings is better, and stay near 20 rows
    const score = got.rows * got.cols + Math.max(0, got.rows - 20) * 30 - got.crossings * 6;
    if (!best || score < best.score) best = { ...got, score };
  }
  if (!best) return null;
  // Number the starting squares in reading order, the way crosswords do
  const starts = [...new Set(best.placed.map(p => key(p.r - best.r0, p.c - best.c0)))]
    .map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const num = new Map(starts.map((s, i) => [key(s[0], s[1]), i + 1]));
  const at = new Map(best.placed.map(p => [p.w, p]));
  const clues = puzzle.clues.map(c => {
    const p = at.get(c.answer);
    const row = p.r - best.r0, col = p.c - best.c0;
    return { answer: c.answer, enum: c.enum, clue: c.clue, row, col, dir: p.d, num: num.get(key(row, col)) };
  });
  clues.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  return { rows: best.rows, cols: best.cols, crossings: best.crossings, clues };
}

// ---------- Run ----------
const text = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(text);
let problems = 0, built = 0;
data.puzzles.forEach((p, i) => {
  const at = `Puzzle ${i + 1}`;
  const answers = (p.clues || []).map(c => c.answer);
  if (answers.length !== CLUES) { console.error(`${at}: has ${answers.length} clues; every puzzle has exactly ${CLUES}`); problems++; return; }
  const bad = answers.filter(a => !/^[A-Z]{3,}$/.test(a));
  if (bad.length) { console.error(`${at}: answers must be capital letters only, 3 or more: ${bad.join(', ')}`); problems++; return; }
  if (new Set(answers).size !== answers.length) { console.error(`${at}: an answer is used twice`); problems++; return; }
  if (p.rows && p.cols) { console.log(`${at}: grid already set (${p.cols} wide, ${p.rows} tall), left alone`); return; }
  const g = layout(p, i + 1);
  if (!g) { console.error(`${at}: no grid fits all ${CLUES} answers within ${MAX_COLS} wide and ${MAX_ROWS} tall. The answers add up to ${answers.join('').length} letters; puzzles that fit usually have about 170 or fewer. Swap a long answer for a shorter one, or one with more common letters`); problems++; return; }
  data.puzzles[i] = { rows: g.rows, cols: g.cols, clues: g.clues };
  built++;
  console.log(`${at}: new grid, ${g.cols} wide, ${g.rows} tall, ${g.crossings} crossings`);
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
