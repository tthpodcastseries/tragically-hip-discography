#!/usr/bin/env node
// merge-live-counts.js
// Cross-references Hipbase and setlist.fm live play count data against the TTH discography dataset.
// No external dependencies - Node v22+

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');

// ─── Load source files ───────────────────────────────────────────────
const hipbase = JSON.parse(fs.readFileSync(path.join(DIR, 'hipbase-play-counts.json'), 'utf8'));
const setlistfm = JSON.parse(fs.readFileSync(path.join(DIR, 'setlistfm-play-counts.json'), 'utf8'));

// ─── Discography dataset (extracted from discography.html) ───────────
// Only studio albums and EPs count as the canonical discography.
// Live albums, compilations, box sets, and video albums are repackaged versions of studio tracks.
const studioAlbums = [
  { title: 'Up to Here', year: 1989, tracks: ['Blow at High Dough', "I'll Believe in You (Or I'll Be Leaving You Tonight)", 'New Orleans Is Sinking', '38 Years Old', "She Didn't Know", 'Boots or Hearts', 'Everytime You Go', 'When the Weight Comes Down', 'Trickle Down', 'Another Midnight', 'Opiated'] },
  { title: 'Road Apples', year: 1991, tracks: ['Little Bones', 'Twist My Arm', 'Cordelia', 'The Luxury', 'Born in the Water', 'Long Time Running', 'Bring It All Back', 'Three Pistols', 'Fight', 'On the Verge', "Fiddler's Green", 'The Last of the Unplucked Gems'] },
  { title: 'Fully Completely', year: 1992, tracks: ['Courage (for Hugh MacLennan)', 'Looking for a Place to Happen', 'At the Hundredth Meridian', 'Pigeon Camera', 'Lionized', 'Locked in the Trunk of a Car', "We'll Go, Too", 'Fully Completely', 'Wheat Kings', 'Fifty-Mission Cap', 'The Wherewithal', 'Eldorado'] },
  { title: 'Day for Night', year: 1994, tracks: ['Grace, Too', 'Daredevil', 'Greasy Jungle', 'Yawning or Snarling', 'Fire in the Hole', 'So Hard Done By', 'Nautical Disaster', 'Thugs', 'Inevitability of Death', 'Scared', 'An Inch an Hour', 'Emergency', 'Titanic Terrarium', 'Impossibilium'] },
  { title: 'Trouble at the Henhouse', year: 1996, tracks: ['Gift Shop', 'Springtime in Vienna', 'Ahead by a Century', "Don't Wake Daddy", 'Flamenco', '700 Ft. Ceiling', "Butts Wigglin'", 'Apartment Song', 'Coconut Cream', "Let's Stay Engaged", 'Sherpa', 'Put It Off'] },
  { title: 'Phantom Power', year: 1998, tracks: ['Poets', 'Something On', 'Save the Planet', 'Bobcaygeon', 'Thompson Girl', 'Membership', 'Fireworks', 'Vapour Trails', 'The Rules', 'Chagrin Falls', "Escape Is at Hand for the Travellin' Man", 'Emperor Penguin'] },
  { title: 'Music @ Work', year: 2000, tracks: ['My Music at Work', 'Tiger the Lion', 'Lake Fever', 'Putting Down', 'Stay', 'The Bastard', 'The Completists', 'Freak Turbulence', 'Sharks', 'Toronto #4', 'Wild Mountain Honey', 'Train Overnight', 'The Bear', 'As I Wind Down the Pines'] },
  { title: 'In Violet Light', year: 2002, tracks: ['Are You Ready', 'Use It Up', 'The Darkest One', "It's a Good Life If You Don't Weaken", 'Silver Jet', 'Throwing Off Glass', 'All Tore Up', 'Leave', 'A Beautiful Thing', 'The Dire Wolf', 'The Dark Canuck'] },
  { title: 'In Between Evolution', year: 2004, tracks: ['Heaven Is a Better Place Today', "Summer's Killing Us", 'Gus: The Polar Bear from Central Park', 'Vaccination Scar', "It Can't Be Nashville Every Night", 'If New Orleans Is Beat', "You're Everywhere", 'As Makeshift As We Are', 'Mean Streak', 'The Heart of the Melt', 'One Night in Copenhagen', 'Are We Family', 'Goodnight Josephine'] },
  { title: 'World Container', year: 2006, tracks: ['Yer Not the Ocean', 'The Lonely End of the Rink', 'In View', 'Fly', 'Luv (sic)', "The Kids Don't Get It", 'Pretend', "Last Night I Dreamed You Didn't Love Me", 'The Drop-Off', 'Family Band', 'World Container'] },
  { title: 'We Are the Same', year: 2009, tracks: ['Morning Moon', 'Honey, Please', 'The Last Recluse', 'Coffee Girl', 'Now the Struggle Has a Name', 'The Depression Suite', 'The Exact Feeling', 'Queen of the Furrows', 'Speed River', 'Frozen in My Tracks', 'Love Is a First', 'Country Day'] },
  { title: 'Now for Plan A', year: 2012, tracks: ['At Transformation', 'Man Machine Poem', 'The Lookahead', 'We Want to Be It', 'Streets Ahead', 'Now for Plan A', 'The Modern Spirit', 'About This Map', 'Take Forever', 'Done and Done', 'Goodnight Attawapiskat'] },
  { title: 'Man Machine Poem', year: 2016, tracks: ['Man', 'In a World Possessed by the Human Mind', 'What Blue', 'In Sarnia', 'Here, in the Dark', 'Great Soul', 'Tired as Fuck', 'Hot Mic', 'Ocean Next', 'Machine'] },
];

const epAlbums = [
  { title: 'The Tragically Hip', year: 1987, tracks: ['Small Town Bringdown', 'Last American Exit', 'Killing Time', 'Evelyn', 'Cemetery Sideroad', "I'm a Werewolf, Baby", 'Highway Girl', 'All Canadian Surf Club'] },
  { title: 'Saskadelphia', year: 2021, tracks: ['Ouch', 'Not Necessary', 'Montreal (Live)', 'Crack My Spine Like a Whip', 'Just as Well', 'Reformed Baptist Blues'] },
];

const allAlbums = [...studioAlbums, ...epAlbums];

// ─── Name normalization & matching ───────────────────────────────────

// Known aliases: discography name -> [possible source names]
const ALIASES = {
  // Number/word variants
  '38 years old': ['thirty-eight years old'],
  'fifty-mission cap': ['50 mission cap', '50-mission cap', 'fifty mission cap'],
  '700 ft. ceiling': ['700 ft ceiling', '700 foot ceiling', 'seven hundred foot ceiling'],
  // Parenthetical/subtitle variants
  'courage (for hugh maclennan)': ['courage', 'courage for hugh maclennan'],
  "i'll believe in you (or i'll be leaving you tonight)": ["i'll believe in you", 'ill believe in you'],
  "escape is at hand for the travellin' man": ["escape is at hand for the travellin man", 'escape is at hand for the travelling man', "escape is at hand for the travelling' man"],
  "it's a good life if you don't weaken": ["its a good life if you dont weaken"],
  "we'll go, too": ["we'll go too", "well go too"],
  'gus: the polar bear from central park': ['gus the polar bear from central park', 'gus'],
  // Punctuation variants
  'my music at work': ['my music @ work'],
  'music @ work': ['music at work'],
  "butts wigglin'": ['butts wigglin'],
  "fiddler's green": ['fiddlers green'],
  "don't wake daddy": ['dont wake daddy'],
  "it can't be nashville every night": ["it cant be nashville every night"],
  "summer's killing us": ['summers killing us'],
  "you're everywhere": ['youre everywhere'],
  "the kids don't get it": ['the kids dont get it'],
  "last night i dreamed you didn't love me": ["last night i dreamed you didnt love me"],
  "let's stay engaged": ['lets stay engaged'],
  "she didn't know": ['she didnt know'],
  'luv (sic)': ['luv sic', 'luv'],
  "i'm a werewolf, baby": ["i'm a werewolf baby", "im a werewolf baby"],
  'montreal (live)': ['montreal'],
  // The Tragically Hip On Shuffle variant
  'inevitability of death': ['the inevitability of death'],
  'in a world possessed by the human mind': ['world possessed by the human mind'],
  'all tore up': ['all torn up'],
  'as makeshift as we are': ['as makeshift as you are'],
  'crack my spine like a whip': ['crack my spine (like a whip)'],
  'reformed baptist blues': ['reformed bapist blues', 'reformed baptist blues'],
  'ouch': ['ouch!'],
};

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // curly quotes
    .replace(/\s+/g, ' ')
    .trim();
}

// Build lookup maps for both sources keyed by normalized name
function buildSourceMap(songs) {
  const map = new Map();
  for (const [name, data] of Object.entries(songs)) {
    map.set(normalize(name), { originalName: name, ...data });
  }
  return map;
}

const hipbaseMap = buildSourceMap(hipbase.songs);
const setlistfmMap = buildSourceMap(setlistfm.songs);

// Try to find a match in a source map
function findInSource(sourceMap, discoTitle) {
  const norm = normalize(discoTitle);

  // 1. Direct match
  if (sourceMap.has(norm)) return sourceMap.get(norm);

  // 2. Check known aliases
  const aliases = ALIASES[norm] || [];
  for (const alias of aliases) {
    if (sourceMap.has(alias)) return sourceMap.get(alias);
  }

  // 3. Reverse alias check - does any source name have an alias that matches our disco title?
  for (const [discoNorm, aliasList] of Object.entries(ALIASES)) {
    if (aliasList.includes(norm) && sourceMap.has(discoNorm)) {
      return sourceMap.get(discoNorm);
    }
  }

  // 4. Containment match (source name contains disco name or vice versa) - only if long enough
  if (norm.length >= 6) {
    for (const [key, val] of sourceMap.entries()) {
      if (key.includes(norm) || norm.includes(key)) {
        if (Math.abs(key.length - norm.length) <= 15) { // don't match wildly different lengths
          return val;
        }
      }
    }
  }

  return null;
}

// ─── Merge ───────────────────────────────────────────────────────────

// Track which source songs got matched so we can report unmatched ones
const matchedHipbase = new Set();
const matchedSetlistfm = new Set();

const unmatched = {
  discoNoSource: [],       // discography tracks with no match in either source
  hipbaseNoMatch: [],      // hipbase songs not matched to discography
  setlistfmNoMatch: [],    // setlistfm songs not matched to discography
};

function earlierDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  // Handle partial dates like "1988-10-00"
  const cleanA = a.replace(/-00/g, '-01');
  const cleanB = b.replace(/-00/g, '-01');
  return cleanA <= cleanB ? a : b;
}

function laterDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  const cleanA = a.replace(/-00/g, '-01');
  const cleanB = b.replace(/-00/g, '-01');
  return cleanA >= cleanB ? a : b;
}

const mergedAlbums = allAlbums.map(album => {
  const tracks = album.tracks.map((trackTitle, idx) => {
    const hMatch = findInSource(hipbaseMap, trackTitle);
    const sMatch = findInSource(setlistfmMap, trackTitle);

    if (hMatch) matchedHipbase.add(normalize(hMatch.originalName));
    if (sMatch) matchedSetlistfm.add(normalize(sMatch.originalName));

    const hipbasePlays = hMatch ? hMatch.total_plays : null;
    const setlistfmPlays = sMatch ? sMatch.total_plays : null;

    let bestEstimate = null;
    if (hipbasePlays !== null && setlistfmPlays !== null) {
      bestEstimate = Math.max(hipbasePlays, setlistfmPlays);
    } else if (hipbasePlays !== null) {
      bestEstimate = hipbasePlays;
    } else if (setlistfmPlays !== null) {
      bestEstimate = setlistfmPlays;
    }

    const sourcesMatched = [];
    if (hMatch) sourcesMatched.push('hipbase');
    if (sMatch) sourcesMatched.push('setlistfm');

    if (sourcesMatched.length === 0) {
      unmatched.discoNoSource.push({ title: trackTitle, album: album.title });
    }

    return {
      title: trackTitle,
      track_number: idx + 1,
      hipbase_plays: hipbasePlays,
      setlistfm_plays: setlistfmPlays,
      best_estimate: bestEstimate,
      hipbase_opener: hMatch ? hMatch.as_opener : null,
      setlistfm_opener: sMatch ? sMatch.as_opener : null,
      hipbase_encore: hMatch ? hMatch.as_encore : null,
      setlistfm_encore: sMatch ? sMatch.as_encore : null,
      first_played: earlierDate(
        hMatch ? hMatch.first_played : null,
        sMatch ? sMatch.first_played : null
      ),
      last_played: laterDate(
        hMatch ? hMatch.last_played : null,
        sMatch ? sMatch.last_played : null
      ),
      sources_matched: sourcesMatched,
    };
  });

  return {
    album: album.title,
    year: album.year,
    tracks,
  };
});

// Find unmatched source songs
for (const [name, data] of Object.entries(hipbase.songs)) {
  if (!matchedHipbase.has(normalize(name))) {
    unmatched.hipbaseNoMatch.push({ title: name, album: data.album || '(unknown)', plays: data.total_plays });
  }
}
for (const [name, data] of Object.entries(setlistfm.songs)) {
  if (!matchedSetlistfm.has(normalize(name))) {
    unmatched.setlistfmNoMatch.push({ title: name, plays: data.total_plays, is_cover: data.is_cover });
  }
}

// ─── Summary stats ───────────────────────────────────────────────────

let totalTracks = 0;
let matchedBoth = 0;
let matchedHipbaseOnly = 0;
let matchedSetlistfmOnly = 0;
let unmatchedCount = 0;

for (const album of mergedAlbums) {
  for (const track of album.tracks) {
    totalTracks++;
    const h = track.sources_matched.includes('hipbase');
    const s = track.sources_matched.includes('setlistfm');
    if (h && s) matchedBoth++;
    else if (h) matchedHipbaseOnly++;
    else if (s) matchedSetlistfmOnly++;
    else unmatchedCount++;
  }
}

// ─── Output merged JSON ──────────────────────────────────────────────

const output = {
  generated: new Date().toISOString().split('T')[0],
  sources: {
    hipbase: { total_songs: hipbase.total_songs, scraped: hipbase.fetched },
    setlistfm: { total_songs: setlistfm.total_unique_songs, scraped: setlistfm.fetched },
  },
  albums: mergedAlbums,
  summary: {
    total_discography_tracks: totalTracks,
    matched_both_sources: matchedBoth,
    matched_hipbase_only: matchedHipbaseOnly,
    matched_setlistfm_only: matchedSetlistfmOnly,
    unmatched: unmatchedCount,
  },
};

fs.writeFileSync(
  path.join(DIR, 'live-play-counts-merged.json'),
  JSON.stringify(output, null, 2),
  'utf8'
);

// ─── Output unmatched report ─────────────────────────────────────────

let report = '';
report += '=== LIVE PLAY COUNTS - UNMATCHED SONGS REPORT ===\n';
report += `Generated: ${output.generated}\n\n`;

report += `--- DISCOGRAPHY TRACKS WITH NO MATCH IN EITHER SOURCE (${unmatched.discoNoSource.length}) ---\n`;
if (unmatched.discoNoSource.length === 0) {
  report += '(none)\n';
} else {
  for (const t of unmatched.discoNoSource) {
    report += `  "${t.title}" (${t.album})\n`;
  }
}

report += `\n--- HIPBASE SONGS NOT MATCHED TO DISCOGRAPHY (${unmatched.hipbaseNoMatch.length}) ---\n`;
unmatched.hipbaseNoMatch.sort((a, b) => b.plays - a.plays);
if (unmatched.hipbaseNoMatch.length === 0) {
  report += '(none)\n';
} else {
  for (const t of unmatched.hipbaseNoMatch) {
    report += `  "${t.title}" [${t.album}] - ${t.plays} plays\n`;
  }
}

report += `\n--- SETLIST.FM SONGS NOT MATCHED TO DISCOGRAPHY (${unmatched.setlistfmNoMatch.length}) ---\n`;
unmatched.setlistfmNoMatch.sort((a, b) => b.plays - a.plays);
if (unmatched.setlistfmNoMatch.length === 0) {
  report += '(none)\n';
} else {
  for (const t of unmatched.setlistfmNoMatch) {
    const coverTag = t.is_cover ? ' [COVER]' : '';
    report += `  "${t.title}" - ${t.plays} plays${coverTag}\n`;
  }
}

report += '\n--- SUMMARY ---\n';
report += `Total discography tracks: ${totalTracks}\n`;
report += `Matched in both sources: ${matchedBoth}\n`;
report += `Matched Hipbase only: ${matchedHipbaseOnly}\n`;
report += `Matched setlist.fm only: ${matchedSetlistfmOnly}\n`;
report += `Unmatched (no source): ${unmatchedCount}\n`;
report += `Hipbase songs not in discography: ${unmatched.hipbaseNoMatch.length}\n`;
report += `Setlist.fm songs not in discography: ${unmatched.setlistfmNoMatch.length}\n`;

fs.writeFileSync(
  path.join(DIR, 'live-play-counts-unmatched.txt'),
  report,
  'utf8'
);

// ─── Console summary ─────────────────────────────────────────────────

console.log('=== MERGE COMPLETE ===\n');
console.log(`Total discography tracks: ${totalTracks}`);
console.log(`Matched both sources:     ${matchedBoth}`);
console.log(`Matched Hipbase only:     ${matchedHipbaseOnly}`);
console.log(`Matched setlist.fm only:  ${matchedSetlistfmOnly}`);
console.log(`Unmatched:                ${unmatchedCount}`);
console.log(`Hipbase unmatched:        ${unmatched.hipbaseNoMatch.length}`);
console.log(`Setlist.fm unmatched:     ${unmatched.setlistfmNoMatch.length}`);

// Top 10 most-played
const allTracks = mergedAlbums.flatMap(a => a.tracks.map(t => ({ ...t, album: a.album })));
const ranked = allTracks.filter(t => t.best_estimate !== null).sort((a, b) => b.best_estimate - a.best_estimate);

console.log('\n=== TOP 10 MOST-PLAYED SONGS ===\n');
for (let i = 0; i < Math.min(10, ranked.length); i++) {
  const t = ranked[i];
  const diff = (t.hipbase_plays !== null && t.setlistfm_plays !== null)
    ? ` (H:${t.hipbase_plays} / S:${t.setlistfm_plays}, diff: ${Math.abs(t.hipbase_plays - t.setlistfm_plays)})`
    : '';
  console.log(`  ${i + 1}. ${t.title} (${t.album}) - ${t.best_estimate} plays${diff}`);
}

// Biggest discrepancies
console.log('\n=== BIGGEST DISCREPANCIES BETWEEN SOURCES ===\n');
const discrepancies = allTracks
  .filter(t => t.hipbase_plays !== null && t.setlistfm_plays !== null)
  .map(t => ({ ...t, diff: Math.abs(t.hipbase_plays - t.setlistfm_plays) }))
  .sort((a, b) => b.diff - a.diff);

for (let i = 0; i < Math.min(15, discrepancies.length); i++) {
  const t = discrepancies[i];
  const winner = t.hipbase_plays > t.setlistfm_plays ? 'Hipbase' : 'setlist.fm';
  console.log(`  ${t.title} - Hipbase: ${t.hipbase_plays}, setlist.fm: ${t.setlistfm_plays} (diff: ${t.diff}, ${winner} higher)`);
}

console.log('\n=== FILES WRITTEN ===');
console.log(`  ${path.join(DIR, 'live-play-counts-merged.json')}`);
console.log(`  ${path.join(DIR, 'live-play-counts-unmatched.txt')}`);
