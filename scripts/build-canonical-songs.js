#!/usr/bin/env node
// build-canonical-songs.js
// Pulls jD's official song list (every Hip song on an official release - the
// 214 options in the TTHTop Fifty Countdown submission form) and writes
// data/canonical-songs.json for the Yer Hip Passport song checklist (v5).
//
// Demos, outtakes, and alternate versions are folded into their parent song,
// since you can only see the song live, not the demo. Each song carries the
// normalized names it appears under in data/setlists.min.json so the Passport
// can tell which ones a member has seen.
//
// Usage: node scripts/build-canonical-songs.js
// Prints any canonical songs never found in a setlist (never played live, or a
// name mismatch worth checking) and setlist originals missing from the list.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FORM_URL = 'https://forms.gle/TXNCF2iBuMJR4qnPA';
const SETLISTS_IN = path.join(ROOT, 'data', 'setlists.min.json');
const OUT = path.join(ROOT, 'data', 'canonical-songs.json');

// Parenthetical notes that mark a version of a song rather than part of its
// title. 'Courage (For Hugh MacLennan)' and 'Luv (Sic)' keep their brackets.
const VERSION_NOTE = /\s*\((?:[^)]*\b(?:demo|outtake|alternate|mix|live|original version|full length version)\b[^)]*)\)\s*$/i;

// Versions released under a different name than the song they grew into
const RENAMED_VERSIONS = {
  'angst on the planks': 'Cordelia',
  'super farmer nano baby': 'Poets',
  'just another midnight': 'Another Midnight',
};

// Songs on official releases that the Google Form list leaves out (jD confirmed
// 2026-10-28). 'Apartment Song' is on Trouble at the Henhouse.
const EXTRA_SONGS = ['Apartment Song'];

// setlist.fm spells some titles differently from the official list (jD confirmed
// 'It's Just as Well' is 'Just As Well').
const SETLIST_ALIASES = {
  [''.concat('itsjustaswell')]: 'Just As Well',
};
const NOT_SONGS = /^\s*(interview|introduction|intro|outro)\b/i;

function norm(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function stripFormQuotes(t) {
  // The form shows "'Title' (Version note)" - drop the quotes around the title
  const m = t.trim().match(/^['‘’](.*)['‘’](\s*\(.*\))?$/);
  return m ? (m[1] + (m[2] || '')).replace(/[‘’]/g, "'").trim() : t.trim();
}

async function main() {
  const html = await (await fetch(FORM_URL, { redirect: 'follow' })).text();
  const m = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s);
  if (!m) throw new Error('Could not find the form data - has the form changed?');
  const items = JSON.parse(m[1])[1][1];
  const firstPick = items.find(it => it[4] && it[4][0] && it[4][0][1]);
  const raw = firstPick[4][0][1].map(o => o[0]).filter(Boolean);

  const titles = [...new Set(raw.map(stripFormQuotes))];
  console.log(`form: ${raw.length} options, ${titles.length} unique`);
  for (const t of EXTRA_SONGS) if (!titles.includes(t)) titles.push(t);
  console.log(`plus ${EXTRA_SONGS.length} extra song(s) not on the form: ${EXTRA_SONGS.join(', ')}`);

  // Fold versions into their parent song
  const songs = new Map(); // norm(base) -> { title, versions: [] }
  for (const t of titles) {
    let base = t.replace(VERSION_NOTE, '').trim();
    const renamed = RENAMED_VERSIONS[base.toLowerCase().replace(/\s*\(.*$/, '')];
    if (renamed) base = renamed;
    const key = norm(base);
    if (!songs.has(key)) songs.set(key, { title: base, versions: [] });
    if (t !== base) songs.get(key).versions.push(t);
  }

  // Setlist names for each song: exact title, or title before its bracket
  // ('Courage' -> 'Courage (For Hugh MacLennan)')
  const setlists = JSON.parse(fs.readFileSync(SETLISTS_IN, 'utf8')).setlists;
  const playCount = new Map(); // norm(name) -> { name, plays }
  for (const s of setlists) {
    for (const song of s.songs || []) {
      if (song.tape || song.cover || !song.name || !song.name.trim()) continue;
      // A medley ('New Orleans Is Sinking / Nautical Disaster') is two songs
      for (const part of song.name.split(' / ')) {
        const k = norm(SETLIST_ALIASES[norm(part)] || part);
        if (!k || NOT_SONGS.test(part)) continue;
        if (!playCount.has(k)) playCount.set(k, { name: part.trim(), plays: 0 });
        playCount.get(k).plays++;
      }
    }
  }

  const out = [];
  const claimed = new Set();
  for (const [key, song] of songs) {
    // The title before its bracket, unless that is another song's own title:
    // 'Dare Devil (Reprise)' must not claim every play of 'Daredevil'
    const stripped = norm(song.title.replace(/\s*\(.*\)\s*$/, ''));
    const keys = new Set([key]);
    if (stripped === key || !songs.has(stripped)) keys.add(stripped);
    const setlistKeys = [...keys].filter(k => playCount.has(k));
    setlistKeys.forEach(k => claimed.add(k));
    out.push({
      title: song.title,
      versions: song.versions,
      setlistKeys,
      livePlays: setlistKeys.reduce((n, k) => n + playCount.get(k).plays, 0),
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));

  // Spellings the Passport must map before matching: norm(setlist spelling) -> norm(official)
  const aliases = {};
  for (const [from, to] of Object.entries(SETLIST_ALIASES)) aliases[from] = norm(to);

  fs.writeFileSync(OUT, JSON.stringify({
    source: FORM_URL,
    builtAt: new Date().toISOString().slice(0, 10),
    formOptions: raw.length,
    songCount: out.length,
    aliases,
    songs: out,
  }, null, 1) + '\n');
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${out.length} songs (${titles.length - out.length} versions folded in)`);

  const neverLive = out.filter(s => !s.setlistKeys.length).map(s => s.title);
  console.log(`\n${neverLive.length} songs never found in a setlist:`);
  neverLive.forEach(t => console.log('  - ' + t));

  const orphans = [...playCount.entries()].filter(([k]) => !claimed.has(k))
    .sort((a, b) => b[1].plays - a[1].plays);
  console.log(`\n${orphans.length} setlist originals not on the list (top 25 by plays):`);
  orphans.slice(0, 25).forEach(([, v]) => console.log(`  - ${v.name} (${v.plays})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
