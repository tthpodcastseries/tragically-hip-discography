# Changelog

## v3.4
**The Luxury** - April 15, 2026
- Added new **Video For New Recruits** page: a curated YouTube archive of 380 Tragically Hip concerts, soundboards, radio simulcasts, rarities and compilations
- 7 flip-card era buckets: 1984–1988 (8), 1989–1994 (33), 1995–1999 (72), 2000–2006 (97), 2007–2010 (57), 2011–2016 (12), Rarities & Compilations (101)
- The Filters (pre-Hip, 1983) included in the Early Years bucket
- 96 soundboard recordings tagged and filterable; 99 entries flagged for tracklist recovery
- Per-era panel with search (title, location, track name) and filter pills: All / Soundboard / FM Simulcast / Pro-Shot / Compilations
- Video cards show YouTube thumbnail, date, location, source tags, tracklist, and a Watch on YouTube button
- Re-runnable CSV → JSON build script at `scripts/build-youtube-videos.js` (dedupes by URL, drops Gord solo / Sadies / Buck 65 / Country of Miracles content — Hip-only archive)
- Footer masthead now credits **Alonx** for Unplucked Gems (previously Darius, per his request)
- Updated `data/unplucked-gems.json` credit line from "Darius" to "Alonx"
- Nav: new "Video For New Recruits" button on index under Unplucked Gems
- Added new **They Shot A Movie Once** page (Blow At High Dough lyric): standalone archive of 35 official Tragically Hip music videos, chronological grid with decade filter pills, search, and YouTube thumbnails sourced from the band's official YouTube channel
- **Hip-lyric section rebrand**: Discography → **Music @ Work**, Lyrics Search → **Poets**, Setlists → **Family Band**, My Shows → **In View**, Tour Map → **About This Map**
- Promoted Poets, Family Band, and In View to top-level home-page nav (previously only reachable from inside Music @ Work)

---

## v2.9.9.6
**Countdown Update** - March 27, 2026
- Changed password gate countdown target from April 7 at 8 AM to May 1 at 8 PM ET across all 5 pages

---

## v2.9.9.5
**Song Search** - March 25, 2026
- Added Search feature to discography page - type any Hip song and see every place it appears
- Searches across all album tracklists (studio, live, compilations, box sets, EPs), alternate versions (Live/Demo/Alternate), TTHTop40 fan rankings (all 169 voted songs), 1,358 live setlists from setlist.fm, and cached lyrics
- Type-ahead autocomplete dropdown with keyboard navigation (arrow keys + Enter)
- Results grouped into Albums, Alternate Versions, Fan Rankings, Live Performances, and Lyrics sections
- Live performances sorted newest-first with paginated "Show all" button
- Search input embedded in header below title, replacing tagline - always visible, no button needed
- Selecting a song hides current category and shows results in main content area
- Autocomplete dropdown overlays from header for immediate access
- Deep-linkable via #cat=songsearch
- Stats row: 169 Songs, 26 Releases, 1,358 Live Shows, 1984-2016

---

## v2.9.9
**An Inch An Hour - Release Candidate** - March 21, 2026
- Added Stephen Dame credit for The Hip Museum on Yer Hip Links page
- Fixed password gate duplicate CSS display property across all 5 pages
- Standardized password gate background to #000000 (was inconsistent #0e0b16)
- Added aria-label to password gate input on all pages for screen reader accessibility
- Added aria-hidden="true" to decorative SVG icons on Yer Hip Links page
- Fixed double decodeURIComponent on album deep link in discography (URLSearchParams.get() already decodes)

---

## v2.9.8.4
**The Hip Compendium + Yer Hip Links** - March 21, 2026
- Renamed app from "The Hip Experience" to "The Hip Compendium" across all pages (titles, meta tags, headers, password gates)
- Added new Yer Hip Links page with curated community resources in 4 categories: Community & Fan Sites, Official, Podcasts & Media, Articles & Guides
- Links include TTH Community, r/TragicallyHip, Hipbase, The Hip Archive, The Hip Museum, tragicallyhip.com, setlist.fm, TTH Podcast Series, Yer Letter, Hip Quiz, and Shaun Robertson's Ultimate TTH Bucket List
- Added Yer Hip Links nav button on index page and 404 page

---

## v2.9.8.3
**Pre-Launch Password Gate** - March 21, 2026
- Added password gate to all pages (index, discography, tour-map, 404) for pre-launch access control
- Gate uses session storage so password persists across page navigation within a session

---

## v2.9.8.2
**Security Hardening** - March 19, 2026
- Escaped user input in lyrics search empty state to prevent self-XSS via `innerHTML`
- Added `state` parameter to Spotify OAuth flow for CSRF protection (validates on callback, rejects mismatches)
- Added SRI integrity hash to dynamically loaded Spotify Web Playback SDK with `onerror` fallback

---

## v2.9.8.1
**Yer Letter Link Update** - March 19, 2026
- Updated Yer Letter newsletter signup links on both index and discography pages to `subscribe.tthpods.com`
- Replaced old Mailchimp (index) and Cyberimpact (discography) URLs

---

## v2.9.8
**Yawning Or Snarling - Pre-Deployment Audit Fixes** - March 19, 2026

### Security
- Removed hardcoded setlist.fm API key from `fetch-setlist-data.js`, moved to env var pattern
- Added `node_modules/` and `.env*` to `.gitignore`
- Created Netlify `_headers` file with Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy
- Added SRI (Subresource Integrity) hashes to all CDN-loaded resources on tour-map (Leaflet JS/CSS, MarkerCluster JS/CSS)

### SEO
- Created `robots.txt` with sitemap reference
- Created `sitemap.xml` covering all three pages
- Fixed `og:image` to use absolute URLs on index and discography pages
- Added `og:image` and upgraded `twitter:card` to `summary_large_image` on tour-map
- Fixed canonical URL on index to use `/` instead of `/index.html`

### Accessibility
- Added `aria-label` attributes to 9 unlabeled form inputs (5 on discography, 4 on tour-map)
- Added skip-to-content links on index and tour-map pages
- Wrapped navigation sections in `<nav>` landmark elements on all three pages
- Associated `<label>` elements with `for` attributes on tour-map filter dropdowns

### UI
- Fixed tour map year slider range from 1985-2022 to 1985-2016 (actual last show year)
- Created branded 404 page with navigation links

---

## v2.9.2.2
**Emergency - Patch 2 (Spotify/Security + Performance Cleanup)** — March 22, 2026

### Spotify & Security
- Update Spotify redirect URI to thehipexperience.tthpods.com
- Switch Spotify token storage from localStorage to sessionStorage (XSS mitigation)
- Remove console.log from tour map production code

### Performance & Cleanup
- Defer Spotify SDK load - now injected dynamically only when user clicks Connect
- Add preconnect hints to tour-map.html (fonts.googleapis.com, fonts.gstatic.com, unpkg.com)
- Add touch event handlers for timeline drag-to-scroll on mobile
- Update .gitignore to exclude unused dev data files (setlists.json, hip-archive-index.json, tth-tour-stats.json)

---

## v2.9.2.1
**Emergency - Patch 1 (Accessibility + Visual Consistency)** — March 22, 2026

### Accessibility
- Fix Random Song button and Hip Quiz link roles inside tablist (role="none")
- Add Escape key handler + focus management + inert background to Random Song overlay
- Add focus-visible styles to 8 missing interactive elements
- Fix tour map: remove outline:none, add proper focus-visible indicators
- Fix all rel="noopener" to include noreferrer (index.html setlist links, tour-map.html popup/attribution links)
- Bump --muted2 color from #aaa to #b0b0b0 for better small-text contrast

### Visual Consistency
- Unify color palette across both pages: --red: #C8102E, --gold: #CCA23C, --text: #ffffff
- Document purple hover colors as CSS variables (--accent: #2a1065, --accent-scroll: #3a1080)
- Remove !important from .yer-letter-btn color rules

---

## v2.9.2
**Emergency (QA Audit: SEO/Meta + Error Handling)** — March 22, 2026

### SEO & Meta
- Add Open Graph tags (og:title, og:description, og:image, og:type) to both pages
- Add Twitter Card meta tag to both pages
- Add SVG maple leaf favicon to both pages
- Remove version number from page title ("Complete Discography" instead of "Discography v2.8.5")
- Add meta description to tour-map.html
- Add JSON-LD MusicGroup structured data to index.html

### Error Handling
- Tour map: wrap data fetch in try/catch with user-facing error message on failure
- Setlist fetch: add resp.ok check before parsing JSON
- Lyrics fetch: add 10-second AbortController timeout
- Fix XSS risk in lyrics search results with escapeHtml helper
- Fix On This Day date parsing to handle incomplete dates (e.g. "December 1987")
- Wrap initial renderCategory call in error boundary

---

## v2.9.1.3
**Fire In The Hole - Patch 3 (QA Audit: Data Integrity + Image Optimization)** — March 21, 2026

### Data Integrity
- Fix "As I Wind Down the Pines" (#50) album attribution from In Between Evolution to Music @ Work
- Fix duplicate Spotify URL: That Night in Toronto was sharing Live Between Us URL
- Fix timeline stat: "26 Official Releases" corrected to "35"
- Flag missing rank #151 in beyondTop40 array with TODO comment
- Add Tiger the Lion cross-album attribution note (Phantom Power single, M@W track)

### Image Optimization
- Create assets-optimized/ folder with all 56 images resized to 600px max dimension
- Convert 7 PNG album covers to JPG format
- Total image payload reduced from 30MB to 5MB (83% reduction)
- Update all image paths in index.html to reference optimized versions
- Add loading="lazy" to band photos and all dynamically created album art images

---

## v2.9.1.2
**Fire In The Hole - Patch 2 (Universal Black Backgrounds)** — March 22, 2026

---

## v2.9.1.1
**Fire In The Hole - Patch 1 (Attribution: Lance Robinson, Darrin Cappe)** — March 22, 2026

---

## v2.9.1
**Fire In The Hole (Hip Archive Integration - 625 live recordings linked)** — March 21, 2026

---

## v2.9
**Daredevil (Interactive Tour Map - 1,358 gigs, Leaflet.js, On This Day, Animated Playback)** — March 21, 2026

---

## v2.8.6
**Thugs - Patch 5 (On This Day Align + Footer Button)** — March 18, 2026

---

## v2.8.5.4
**Thugs - Patch 4 (Footer Credit Update)** — March 20, 2026

---

## v2.8.5.3
**Thugs - Patch 3 (On This Day + Footer Buttons)** — March 20, 2026

---

## v2.8.5.2
**Thugs - Patch 2 (Art Overflow + Footer)** — March 19, 2026

---

## v2.8.5.1
**Thugs - Patch 1 (Album Art Border Fix)** — March 19, 2026

---

## v2.8.5
**Thugs (Band Photo + On This Day + Nav)** — March 19, 2026

---

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
