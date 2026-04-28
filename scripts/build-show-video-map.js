#!/usr/bin/env node
// build-show-video-map.js
// Joins data/youtube-videos.json (380 Hip videos) against
// data/tth-tour-data.json (1,358 shows) by ISO date.
// Produces data/show-videos.json with bidirectional lookups:
//   byShow:  showId  -> [video refs]
//   byVideo: videoId -> show ref
// ISO-date match only (high confidence). Year-only and undated videos are skipped.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YT_IN   = path.join(ROOT, 'data', 'youtube-videos.json');
const TOUR_IN = path.join(ROOT, 'data', 'tth-tour-data.json');
const OUT     = path.join(ROOT, 'data', 'show-videos.json');

function main() {
  const yt = JSON.parse(fs.readFileSync(YT_IN, 'utf8'));
  const tour = JSON.parse(fs.readFileSync(TOUR_IN, 'utf8'));

  // Index shows by isoDate. Same date can have multiple shows (rare).
  const showsByDate = new Map();
  for (const show of tour) {
    if (!show.isoDate) continue;
    if (!showsByDate.has(show.isoDate)) showsByDate.set(show.isoDate, []);
    showsByDate.get(show.isoDate).push(show);
  }

  const byShow  = {};        // showId -> [video refs]
  const byVideo = {};        // videoId -> show ref
  const ambiguous = [];      // videos that hit a multi-show date — kept but flagged
  const unmatched = [];      // videos with no date or no matching show

  let matched = 0, skippedNoDate = 0, skippedYearOnly = 0, skippedNoShow = 0;

  for (const era of yt.eras || []) {
    for (const v of era.videos || []) {
      // Tier C — skip undated videos (Compilations & Rarities)
      if (!v.date) {
        if (v.year) skippedYearOnly++; else skippedNoDate++;
        unmatched.push({ videoId: v.videoId, url: v.url, reason: v.year ? 'year-only' : 'no-date' });
        continue;
      }
      const candidates = showsByDate.get(v.date);
      if (!candidates || candidates.length === 0) {
        skippedNoShow++;
        unmatched.push({ videoId: v.videoId, url: v.url, date: v.date, reason: 'no-show-on-that-date' });
        continue;
      }

      // Pick the show. If only one show that day, take it. If multiple, prefer one whose city
      // appears in the video's location string. Fall back to the first.
      let show = candidates[0];
      if (candidates.length > 1) {
        const loc = (v.location || '').toLowerCase();
        const cityMatch = candidates.find(s => s.city && loc.includes(s.city.toLowerCase()));
        if (cityMatch) show = cityMatch;
        ambiguous.push({
          videoId: v.videoId,
          date: v.date,
          chose: show.id,
          options: candidates.map(s => ({ id: s.id, city: s.city, venue: s.venue })),
        });
      }

      const videoRef = {
        videoId: v.videoId,
        url: v.url,
        title: v.title,
        thumbnail: v.thumbnail,
        tags: v.tags || [],
        dateDisplay: v.dateDisplay,
        location: v.location,
        partialTracklist: !!v.partialTracklist,
        trackCount: Array.isArray(v.tracks) ? v.tracks.length : 0,
      };
      const showRef = {
        showId: show.id,
        isoDate: show.isoDate,
        venue: show.venue,
        city: show.city,
        state: show.state,
        country: show.country,
        countryName: show.countryName,
        tour: show.tour,
        setlistUrl: show.setlistUrl,
      };

      if (!byShow[show.id]) byShow[show.id] = [];
      byShow[show.id].push(videoRef);
      byVideo[v.videoId] = showRef;
      matched++;
    }
  }

  // Sort each show's video list deterministically: SBD first, then by partial-tracklist false-first,
  // then by track count desc, then by videoId for stable order.
  for (const showId of Object.keys(byShow)) {
    byShow[showId].sort((a, b) => {
      const aSBD = a.tags.includes('SBD') ? 0 : 1;
      const bSBD = b.tags.includes('SBD') ? 0 : 1;
      if (aSBD !== bSBD) return aSBD - bSBD;
      if (a.partialTracklist !== b.partialTracklist) return a.partialTracklist ? 1 : -1;
      if (a.trackCount !== b.trackCount) return b.trackCount - a.trackCount;
      return (a.videoId || '').localeCompare(b.videoId || '');
    });
  }

  const output = {
    description: 'ISO-date match between data/youtube-videos.json and data/tth-tour-data.json. Used by tour-map.html, discography.html (Family Band), and video-for-new-recruits.html for bidirectional show ↔ video links.',
    lastUpdated: new Date().toISOString().split('T')[0],
    summary: {
      totalShowsWithVideo: Object.keys(byShow).length,
      totalVideosMatched: matched,
      multipleVideosPerShow: Object.values(byShow).filter(v => v.length > 1).length,
      ambiguousDateMatches: ambiguous.length,
      unmatchedVideos: unmatched.length,
      skippedNoDate, skippedYearOnly, skippedNoShow,
    },
    byShow,
    byVideo,
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log('Show ↔ Video map — build summary');
  console.log('-----------------------------------');
  console.log(`Shows with at least one video:  ${Object.keys(byShow).length}`);
  console.log(`Videos matched to a show:       ${matched}`);
  console.log(`Shows with 2+ videos:           ${Object.values(byShow).filter(v => v.length > 1).length}`);
  console.log(`Ambiguous (multi-show on date): ${ambiguous.length}`);
  console.log(`Skipped (no date):              ${skippedNoDate}`);
  console.log(`Skipped (year only):            ${skippedYearOnly}`);
  console.log(`Skipped (no show on that date): ${skippedNoShow}`);
  console.log('');
  if (ambiguous.length) {
    console.log('Ambiguous date picks (first 5):');
    for (const a of ambiguous.slice(0, 5)) {
      console.log(`  ${a.date}  video=${a.videoId}  chose=${a.chose}  among ${a.options.length}`);
    }
    console.log('');
  }
  console.log(`Wrote: ${OUT}`);
}

main();
