#!/usr/bin/env node
// build-lyrics.js — Fetches lyrics for all TTH songs and saves to data/lyrics.json
// Usage: node build-lyrics.js
// Requires: Node 18+ (built-in fetch)

const fs = require('fs');
const path = require('path');

const ARTIST = 'The Tragically Hip';
const DELAY_MS = 300;
const TIMEOUT_MS = 10000;

// All songs from studioAlbums + epAlbums (matches getAllSongsForLyrics in discography.html)
const songs = [
  // Up to Here (1989)
  { album: 'Up to Here', song: 'Blow at High Dough' },
  { album: 'Up to Here', song: "I'll Believe in You (Or I'll Be Leaving You Tonight)" },
  { album: 'Up to Here', song: 'New Orleans Is Sinking' },
  { album: 'Up to Here', song: '38 Years Old' },
  { album: 'Up to Here', song: "She Didn't Know" },
  { album: 'Up to Here', song: 'Boots or Hearts' },
  { album: 'Up to Here', song: 'Everytime You Go' },
  { album: 'Up to Here', song: 'When the Weight Comes Down' },
  { album: 'Up to Here', song: 'Trickle Down' },
  { album: 'Up to Here', song: 'Another Midnight' },
  { album: 'Up to Here', song: 'Opiated' },
  // Road Apples (1991)
  { album: 'Road Apples', song: 'Little Bones' },
  { album: 'Road Apples', song: 'Twist My Arm' },
  { album: 'Road Apples', song: 'Cordelia' },
  { album: 'Road Apples', song: 'The Luxury' },
  { album: 'Road Apples', song: 'Born in the Water' },
  { album: 'Road Apples', song: 'Long Time Running' },
  { album: 'Road Apples', song: 'Bring It All Back' },
  { album: 'Road Apples', song: 'Three Pistols' },
  { album: 'Road Apples', song: 'Fight' },
  { album: 'Road Apples', song: 'On the Verge' },
  { album: 'Road Apples', song: "Fiddler's Green" },
  { album: 'Road Apples', song: 'The Last of the Unplucked Gems' },
  // Fully Completely (1992)
  { album: 'Fully Completely', song: 'Courage (for Hugh MacLennan)' },
  { album: 'Fully Completely', song: 'Looking for a Place to Happen' },
  { album: 'Fully Completely', song: 'At the Hundredth Meridian' },
  { album: 'Fully Completely', song: 'Pigeon Camera' },
  { album: 'Fully Completely', song: 'Lionized' },
  { album: 'Fully Completely', song: 'Locked in the Trunk of a Car' },
  { album: 'Fully Completely', song: "We'll Go, Too" },
  { album: 'Fully Completely', song: 'Fully Completely' },
  { album: 'Fully Completely', song: 'Wheat Kings' },
  { album: 'Fully Completely', song: 'Fifty-Mission Cap' },
  { album: 'Fully Completely', song: 'The Wherewithal' },
  { album: 'Fully Completely', song: 'Eldorado' },
  // Day for Night (1994)
  { album: 'Day for Night', song: 'Grace, Too' },
  { album: 'Day for Night', song: 'Daredevil' },
  { album: 'Day for Night', song: 'Greasy Jungle' },
  { album: 'Day for Night', song: 'Yawning or Snarling' },
  { album: 'Day for Night', song: 'Fire in the Hole' },
  { album: 'Day for Night', song: 'So Hard Done By' },
  { album: 'Day for Night', song: 'Nautical Disaster' },
  { album: 'Day for Night', song: 'Thugs' },
  { album: 'Day for Night', song: 'Inevitability of Death' },
  { album: 'Day for Night', song: 'Scared' },
  { album: 'Day for Night', song: 'An Inch an Hour' },
  { album: 'Day for Night', song: 'Emergency' },
  { album: 'Day for Night', song: 'Titanic Terrarium' },
  { album: 'Day for Night', song: 'Impossibilium' },
  // Trouble at the Henhouse (1996)
  { album: 'Trouble at the Henhouse', song: 'Gift Shop' },
  { album: 'Trouble at the Henhouse', song: 'Springtime in Vienna' },
  { album: 'Trouble at the Henhouse', song: 'Ahead by a Century' },
  { album: 'Trouble at the Henhouse', song: "Don't Wake Daddy" },
  { album: 'Trouble at the Henhouse', song: 'Flamenco' },
  { album: 'Trouble at the Henhouse', song: '700 Ft. Ceiling' },
  { album: 'Trouble at the Henhouse', song: "Butts Wigglin'" },
  { album: 'Trouble at the Henhouse', song: 'Apartment Song' },
  { album: 'Trouble at the Henhouse', song: 'Coconut Cream' },
  { album: 'Trouble at the Henhouse', song: "Let's Stay Engaged" },
  { album: 'Trouble at the Henhouse', song: 'Sherpa' },
  { album: 'Trouble at the Henhouse', song: 'Put It Off' },
  // Phantom Power (1998)
  { album: 'Phantom Power', song: 'Poets' },
  { album: 'Phantom Power', song: 'Something On' },
  { album: 'Phantom Power', song: 'Save the Planet' },
  { album: 'Phantom Power', song: 'Bobcaygeon' },
  { album: 'Phantom Power', song: 'Thompson Girl' },
  { album: 'Phantom Power', song: 'Membership' },
  { album: 'Phantom Power', song: 'Fireworks' },
  { album: 'Phantom Power', song: 'Vapour Trails' },
  { album: 'Phantom Power', song: 'The Rules' },
  { album: 'Phantom Power', song: 'Chagrin Falls' },
  { album: 'Phantom Power', song: "Escape Is at Hand for the Travellin' Man" },
  { album: 'Phantom Power', song: 'Emperor Penguin' },
  // Music @ Work (2000)
  { album: 'Music @ Work', song: 'My Music at Work' },
  { album: 'Music @ Work', song: 'Tiger the Lion' },
  { album: 'Music @ Work', song: 'Lake Fever' },
  { album: 'Music @ Work', song: 'Putting Down' },
  { album: 'Music @ Work', song: 'Stay' },
  { album: 'Music @ Work', song: 'The Bastard' },
  { album: 'Music @ Work', song: 'The Completists' },
  { album: 'Music @ Work', song: 'Freak Turbulence' },
  { album: 'Music @ Work', song: 'Sharks' },
  { album: 'Music @ Work', song: 'Toronto #4' },
  { album: 'Music @ Work', song: 'Wild Mountain Honey' },
  { album: 'Music @ Work', song: 'Train Overnight' },
  { album: 'Music @ Work', song: 'The Bear' },
  { album: 'Music @ Work', song: 'As I Wind Down the Pines' },
  // In Violet Light (2002)
  { album: 'In Violet Light', song: 'Are You Ready' },
  { album: 'In Violet Light', song: 'Use It Up' },
  { album: 'In Violet Light', song: 'The Darkest One' },
  { album: 'In Violet Light', song: "It's a Good Life If You Don't Weaken" },
  { album: 'In Violet Light', song: 'Silver Jet' },
  { album: 'In Violet Light', song: 'Throwing Off Glass' },
  { album: 'In Violet Light', song: 'All Tore Up' },
  { album: 'In Violet Light', song: 'Leave' },
  { album: 'In Violet Light', song: 'A Beautiful Thing' },
  { album: 'In Violet Light', song: 'The Dire Wolf' },
  { album: 'In Violet Light', song: 'The Dark Canuck' },
  // In Between Evolution (2004)
  { album: 'In Between Evolution', song: 'Heaven Is a Better Place Today' },
  { album: 'In Between Evolution', song: "Summer's Killing Us" },
  { album: 'In Between Evolution', song: 'Gus: The Polar Bear from Central Park' },
  { album: 'In Between Evolution', song: 'Vaccination Scar' },
  { album: 'In Between Evolution', song: "It Can't Be Nashville Every Night" },
  { album: 'In Between Evolution', song: 'If New Orleans Is Beat' },
  { album: 'In Between Evolution', song: "You're Everywhere" },
  { album: 'In Between Evolution', song: 'As Makeshift As We Are' },
  { album: 'In Between Evolution', song: 'Mean Streak' },
  { album: 'In Between Evolution', song: 'The Heart of the Melt' },
  { album: 'In Between Evolution', song: 'One Night in Copenhagen' },
  { album: 'In Between Evolution', song: 'Are We Family' },
  { album: 'In Between Evolution', song: 'Goodnight Josephine' },
  // World Container (2006)
  { album: 'World Container', song: 'Yer Not the Ocean' },
  { album: 'World Container', song: 'The Lonely End of the Rink' },
  { album: 'World Container', song: 'In View' },
  { album: 'World Container', song: 'Fly' },
  { album: 'World Container', song: 'Luv (sic)' },
  { album: 'World Container', song: "The Kids Don't Get It" },
  { album: 'World Container', song: 'Pretend' },
  { album: 'World Container', song: "Last Night I Dreamed You Didn't Love Me" },
  { album: 'World Container', song: 'The Drop-Off' },
  { album: 'World Container', song: 'Family Band' },
  { album: 'World Container', song: 'World Container' },
  // We Are the Same (2009)
  { album: 'We Are the Same', song: 'Morning Moon' },
  { album: 'We Are the Same', song: 'Honey, Please' },
  { album: 'We Are the Same', song: 'The Last Recluse' },
  { album: 'We Are the Same', song: 'Coffee Girl' },
  { album: 'We Are the Same', song: 'Now the Struggle Has a Name' },
  { album: 'We Are the Same', song: 'The Depression Suite' },
  { album: 'We Are the Same', song: 'The Exact Feeling' },
  { album: 'We Are the Same', song: 'Queen of the Furrows' },
  { album: 'We Are the Same', song: 'Speed River' },
  { album: 'We Are the Same', song: 'Frozen in My Tracks' },
  { album: 'We Are the Same', song: 'Love Is a First' },
  { album: 'We Are the Same', song: 'Country Day' },
  // Now for Plan A (2012)
  { album: 'Now for Plan A', song: 'At Transformation' },
  { album: 'Now for Plan A', song: 'Man Machine Poem' },
  { album: 'Now for Plan A', song: 'The Lookahead' },
  { album: 'Now for Plan A', song: 'We Want to Be It' },
  { album: 'Now for Plan A', song: 'Streets Ahead' },
  { album: 'Now for Plan A', song: 'Now for Plan A' },
  { album: 'Now for Plan A', song: 'The Modern Spirit' },
  { album: 'Now for Plan A', song: 'About This Map' },
  { album: 'Now for Plan A', song: 'Take Forever' },
  { album: 'Now for Plan A', song: 'Done and Done' },
  { album: 'Now for Plan A', song: 'Goodnight Attawapiskat' },
  // Man Machine Poem (2016)
  { album: 'Man Machine Poem', song: 'Man' },
  { album: 'Man Machine Poem', song: 'In a World Possessed by the Human Mind' },
  { album: 'Man Machine Poem', song: 'What Blue' },
  { album: 'Man Machine Poem', song: 'In Sarnia' },
  { album: 'Man Machine Poem', song: 'Here, in the Dark' },
  { album: 'Man Machine Poem', song: 'Great Soul' },
  { album: 'Man Machine Poem', song: 'Tired as Fuck' },
  { album: 'Man Machine Poem', song: 'Hot Mic' },
  { album: 'Man Machine Poem', song: 'Ocean Next' },
  { album: 'Man Machine Poem', song: 'Machine' },
  // EP: The Tragically Hip (1987)
  { album: 'The Tragically Hip', song: 'Small Town Bringdown' },
  { album: 'The Tragically Hip', song: 'Last American Exit' },
  { album: 'The Tragically Hip', song: 'Killing Time' },
  { album: 'The Tragically Hip', song: 'Evelyn' },
  { album: 'The Tragically Hip', song: 'Cemetery Sideroad' },
  { album: 'The Tragically Hip', song: "I'm a Werewolf, Baby" },
  { album: 'The Tragically Hip', song: 'Highway Girl' },
  { album: 'The Tragically Hip', song: 'All Canadian Surf Club' },
  // EP: Saskadelphia (2021)
  { album: 'Saskadelphia', song: 'Ouch' },
  { album: 'Saskadelphia', song: 'Not Necessary' },
  { album: 'Saskadelphia', song: 'Montreal (Live)' },
  { album: 'Saskadelphia', song: 'Crack My Spine Like a Whip' },
  { album: 'Saskadelphia', song: 'Just as Well' },
  { album: 'Saskadelphia', song: 'Reformed Baptist Blues' },
];

async function fetchLyrics(artist, song) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.lyrics || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Fetching lyrics for ${songs.length} songs from lyrics.ovh...\n`);

  const result = {};
  let found = 0;
  let failed = 0;

  for (let i = 0; i < songs.length; i++) {
    const { album, song } = songs[i];
    const key = `${album}|||${song}`;

    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

    const lyrics = await fetchLyrics(ARTIST, song);
    result[key] = lyrics || '';

    if (lyrics) {
      found++;
      console.log(`[${i + 1}/${songs.length}] OK: ${song} (${album})`);
    } else {
      failed++;
      console.log(`[${i + 1}/${songs.length}] --: ${song} (${album})`);
    }
  }

  const output = { version: 1, generated: new Date().toISOString(), songs: result };
  const outPath = path.join(__dirname, '..', 'data', 'lyrics.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 0));

  const size = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\nDone. ${found} songs with lyrics, ${failed} without.`);
  console.log(`Written to ${outPath} (${size} KB)`);
}

main();
