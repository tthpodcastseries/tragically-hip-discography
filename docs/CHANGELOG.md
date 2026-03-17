# Changelog

## v2.8.4
**Setlist Explorer**

### Setlist Explorer
- New "Setlists" tab - browse 1,358 live shows from 1985 to 2016
- Data sourced from setlist.fm API (static JSON, fetched via Node script)
- Filter by year, tour name, or city using dropdown selectors
- Free-text search across venue names, cities, and songs played
- Summary stats update live: show count, unique songs, total songs played
- "Most Played Songs" pills show the top 15 songs for any filtered view - click to search
- Each setlist card shows date, venue, city, tour badge, full song list with encore labels
- "View on setlist.fm" links on every card
- Paginated results with "Load More" button (20 per page)
- 1,091 shows with full setlist data, 299 unique songs, 20,312 total performances

---

## v2.8.3
**Lyrics Search**

### Lyrics Search
- New "Lyrics Search" tab - search across every Hip song by keyword or phrase
- Powered by lyrics.ovh API with full localStorage caching - fetch once, search forever
- One-click "Build Lyrics Index" fetches lyrics for all 169 songs (13 studio albums + 2 EPs)
- Search results show matching lines with context, keywords highlighted in gold
- Album breakdown pills show which albums contain the most matches, sorted by frequency
- Click any album pill to filter results to just that album
- Rebuild Index and Clear Cache controls for managing the local lyrics database
- Progress bar with real-time status during index building

---

## v2.8.2
**Album Timeline View**

### Timeline
- New horizontal scrolling timeline as the default home screen
- All 35 official releases plotted chronologically from 1984 to 2024
- Colour-coded by release type: Studio (red), Live (green), Compilation (purple), Box Set (gold), EP (orange), Video (blue)
- Album art thumbnails with connector lines to a year axis
- Click any album to open its full detail modal
- Three milestones marked on the axis: Band Formed (1984), The Final Show (Aug 20, 2016), Gord's Passing (Oct 17, 2017)
- Drag-to-scroll on desktop, swipe on mobile
- Legend and scroll hint below the timeline
- Timeline tab is now the first and default tab on load

---

## v2.8.1
**TTHTop40 Podcast Links, Streaming Panels & Buy Links**

### TTHTop40 Countdown
- Replaced Spotify links on all Top 40 songs (#1-40) with TTHTop40 Countdown podcast episode links via kitelink
- Red headphone icon replaces the Spotify icon on each song row
- Hover colour changed from Spotify green to TTH red
- Songs #41-169 now expand on click to reveal a streaming service panel (Apple Music, Spotify, Tidal, YouTube Music, Amazon Music)
- Removed point totals from #41-169 song entries (just album name now)
- Moved Album Vote Breakdown section below the #41-169 list

### Solo Project Buy Links
- Gord Downie solo modals now include a "Buy at Gordieland.com" gold pill button
- All other solo/side project modals include a "Buy at TheHip.com" gold pill button

### Footer
- Updated credit line: "Designed by The Tragically Hip Podcast Series - Coded with Claude"

---

## v2.8.0
**Solo Modals, Tracklists & Streaming Links**

### Solo & Side Projects
- Added complete tracklists for all 19 solo and side project albums (213 total tracks)
- Solo album cards now open a full detail modal (matching the main album modal style)
- Each solo modal includes description, tracklist, and streaming links
- Posthumous releases display a gold "Posthumous" tag in the modal
- Removed inline notes from solo cards in favour of the cleaner "Details" hover hint

### Streaming Links
- Added brand-coloured pill buttons for all streaming services across the app:
  - Tidal (cyan), YouTube Music (red), Amazon Music (teal), Buy at TheHip.com (gold)
  - Previously only Apple Music and Spotify had colour; the rest were grey
- Solo project modals include Apple Music, Spotify, Tidal, YouTube Music, and Amazon Music search links using the artist name

### Data Fixes
- Fixed TTHTop40 rank #115: corrected "Shy" to "Fly" (World Container)

---

## v2.7.0
**Solo Records & Side Projects - New Sections + Full Cover Art**

### New Content
- Added **Solo Records** section featuring 15 releases spanning all five members of The Tragically Hip:
  - **Gord Downie** (9 albums): Coke Machine Glow (2001), Battle of the Nudes (2003), The Grand Bounce (2010), And the Conquering Sun (2014), Secret Path (2016), Introduce Yerself (2017), Away Is Mine (2020), Lustre Parfait (2023), Live at 6 O'Clock (2026)
  - **Paul Langlois** (3 albums): Fix This Head (2010), Not Guilty (2013), Smooth Rock Falls (2026)
  - **Gord Sinclair** (2 albums): Taxi Dancers (2020), In Continental Drift (2023)
  - **Johnny Fay** (1 EP): Mercury Sea (2025)
- Added **Side Projects** section featuring 4 releases:
  - **Stripper's Union / Rob Baker** (3 albums): Stripper's Union Local 518 (2006), The Deuce (2011), The Undertaking (2021)
  - **Paul Langlois Band** (1 album): Guess What (2023)
- Each entry includes year, label, producer (where known), artist credit, and a custom description
- Solo and Side Project sections accessible via new nav tabs alongside existing categories

### Cover Art
- Added actual album cover art for 18 of 19 solo and side project entries, replacing gradient placeholders:
  - Coke Machine Glow, Battle of the Nudes, The Grand Bounce, And the Conquering Sun, Secret Path, Introduce Yerself, Away Is Mine, Lustre Parfait, Live at 6 O'Clock, Fix This Head, Not Guilty, Taxi Dancers, Smooth Rock Falls, Mercury Sea, Local 518, The Deuce, The Undertaking, Guess What
- In Continental Drift retains gradient fallback (cover art pending)
- All images stored in `assets/solo-projects/`

### Data Source
- Discography dataset updated to match TTH Podcast Series Complete Discography v6.0 (appendix: Solo Records & Side Projects)

### File Structure
- New folder: `assets/solo-projects/` containing 18 cover art images
- Reorganized existing cover art into subfolders: `assets/studio-albums/`, `assets/live-albums/`, `assets/compilations/`, `assets/box-sets/`, `assets/eps/`, `assets/video-albums/`

---

## v2.6.3
**UI Polish**
- Album vote breakdown now alternates gold and red text for voted songs, improving readability across cards
- Progress bars in the breakdown section restored to solid gold

## v2.6.2
**Data Accuracy & Badge Colors**
- Fixed "Buy at TheHip.com" button to link to thehip.com/pages/listen
- Track ranking badges now use two colors: gold for the Top 40 (#1-40) and red for #41-169
- Fixed Music @ Work chart position to #1 (was incorrectly unmarked)
- Fixed In Violet Light chart position to #2 (was incorrectly marked #1)
- Updated Canadian #1 albums count from 8 to 9
- Corrected Up to Here tracklist — removed EP tracks (Highway Girl, I'm a Werewolf Baby), added missing album tracks (Another Midnight, Opiated)
- Fixed #47 from "Dusk" to "Thugs"
- Fixed "Honey Please" spelling to "Honey, Please"
- Fixed Live at the Roxy track name to "I'll Believe in You"

## v2.6.1
**TTH Top 40 Expansion & TheHip.com**
- Added all 169 voted songs from the fan countdown (previously only Top 40)
- Ranking badges now appear on every voted track across all album pages
- Added collapsible "The Full 169" section showing songs #41-169 with point totals
- Added Album Vote Breakdown — visual cards showing which albums had the most voted songs, with voted/unvoted track lists and percentage bars
- Added "Buy at TheHip.com" pill button on every album modal, linking out in a new tab
- Apple Music "Open in Apple Music" buttons added to album modals and Random Hip Song results

## v2.6.0
**Apple Music, Spotify Fixes & Deployment**
- Deployed app to GitHub Pages at tthpodcastseries.github.io for permanent HTTPS hosting
- Added GitHub Actions workflow for automatic deployment on push
- Added Apple Music link buttons on album modals (pink pill, opens Apple Music)
- Added Apple Music link on Random Hip Song results
- Fixed Spotify OAuth — redirect URI updated from localhost to GitHub Pages URL
- Fixed Spotify auth persistence — switched from sessionStorage to localStorage so login survives page reloads
- Added "Requires Spotify Premium" note under the Connect Spotify button
- Removed red single indicator dots from track listings (cleaner look)
- Updated version to v5.6 in footer
