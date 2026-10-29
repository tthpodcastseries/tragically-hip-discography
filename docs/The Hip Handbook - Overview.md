# The Hip Handbook - Overview

How the site works, how it should work, and where the two differ. Written 2026-10-28 against v5.1.1 "Grace, Too - Patch".

> Internal notes. `/docs/*` returns 404 on the live site, but this repo is public on GitHub, so keep secrets out of this file and everything near it.

What is checked and what is inferred: statements about the live site were tested in a browser on 2026-10-28. Statements about code were read from the repo. Anything marked **(inferred)** was worked out from file names or script inputs and outputs and has not been confirmed with jD.

---

## 1. What it is

**The Hip Handbook** (thehiphandbook.tthpods.com) is a free fan archive for The Tragically Hip, built and run by jD (Jamie Dew) of the TTH Podcast Series. It started as the "TTH Discography Web App", became "The Hip Compendium", and was renamed The Hip Handbook (compendium.tthpods.com is retired).

It puts the whole catalogue in one place:

- Every official release (35 entries in `discography.json`: studio albums, EPs, live records, compilations, box sets, videos), plus a section for solo records and side projects
- 1,355 live shows from setlist.fm, with 1,089 having a full setlist
- 614 shows with full audio you can play in the browser, from The Hip Archive
- Lyrics for 169 songs, the fan-voted Top 40 (all 169 voted songs), unreleased recordings, fan concert videos, official music videos
- Personal features on top: a concert-history Passport, song pages, and a daily setlist game

Who it is for: Hip fans, and the listeners of jD's podcasts. Traffic so far comes from promotion (about 816 visitors in the 90 days to 2026-10-28, 88% landing on home, per Umami). The v5 releases exist to give people reasons to come back: daily habits, personal stats, sharing.

Cost model: free to every visitor. No account is needed. No email, no password, nothing to buy.

---

## 2. How it is built

| Layer | What |
|---|---|
| Site | Static HTML, CSS and plain JavaScript. No framework, no build step. The repo root is the publish root. |
| Hosting | Netlify, auto-deployed from GitHub `main` (public repo `tthpodcastseries/tragically-hip-discography`). Pushing `main` publishes the live site within seconds. |
| Config | `_headers` (security headers and the CSP), `_redirects` and `netlify.toml` (rewrites and blocks; both are kept in step). |
| Type and colour | Poppins only. Background `#0e0b16`, text `#d9d9d9`, gold `#CCA23C`, red `#C8102E`. No gradients except the approved soft red glow behind the home header. |
| Maps | Leaflet with marker clustering (tour map) and Leaflet in the Passport. Basemap tiles from CARTO (needs a free non-commercial API key, which lives in the tile URL in code). |
| Audio | 614 show recordings hosted on Backblaze B2 (`AUDIO_BASE` in `tour-map.html`), played by a custom player on the tour map. |
| Members | Supabase (Postgres). Called straight from the browser with the public anon key. See section 6. |
| Analytics | Umami Cloud, cookieless. Events are names only, never names or numbers. See section 9. |
| Offline | A service worker (`service-worker.js`) makes the site installable and mostly usable offline. See section 7. |
| Checks | `scripts/audit-site.js` (links, assets, data cross-references, CSP image hosts, sitemap) runs locally and weekly in GitHub Actions. `scripts/check-youtube-videos.js` checks that linked videos are alive. |

Security headers set for every page: `nosniff`, `X-Frame-Options: SAMEORIGIN`, a strict referrer policy, camera/microphone/geolocation disabled, and a Content-Security-Policy that whitelists each external host the site uses. **Any new external host (images, scripts, APIs, audio) must be added to the CSP or it is blocked on the live site only** - the local preview server ignores `_headers`. This has bitten the site before (YouTube thumbnails in October 2026) and again with the share card (section 11).

Blocked on purpose (404 via `netlify.toml` and `_redirects`): `/scripts/*`, `/audits/*`, `/docs/*`, `/data/live-play-counts-unmatched.txt`. Personal context files (`about-me.md`, `working-style.md`, `brand-voice.md`, `_MANIFEST.md`) are gitignored and are not on the live site (checked).

---

## 3. Pages and routes

| Address | File | Eyebrow / Hip-song title | What it is |
|---|---|---|---|
| `/` | `index.html` | The Hip Handbook | Front door: welcome note, search, Today band, menu |
| `/discography` | `discography.html` | The Discography / Music @ Work | Albums grid, album modals, tracklists, streaming links |
| `/top-40` | `discography.html` | Fan-Ranked Top 40 / TTHTop40 Countdown | All 169 fan-voted songs with podcast links |
| `/lyrics` | `discography.html` | Lyrics Search / Poets | Search any line across 169 songs |
| `/setlists` | `discography.html` | Setlist Explorer / Family Band | Search shows by song, venue, city, year, tour |
| `/my-shows` | `passport.html` | Yer Hip Passport / In View | Personal concert history, rarities, checklist, share card |
| `/tour-map` | `tour-map.html` | Interactive Tour Map / About This Map | Every gig on a map, filters, timeline, audio player |
| `/live-stats` | `live-stats.html` | Live Show Stats / 38 Years Old | Most played, openers, closers, one-timers, never played |
| `/unplucked-gems` | `unplucked-gems.html` | Unreleased Recordings / Unplucked Gems | 545 demos, outtakes, alternate versions by era |
| `/video-for-new-recruits` | `video-for-new-recruits.html` | Live Concert Videos / Video For New Recruits | 380 fan-shot shows, soundboards, broadcasts by era |
| `/music-videos` | `music-videos.html` | Official Music Videos / They Shot A Movie Once | 36 official videos |
| `/links` | `links.html` | Fan Community Links / Yer Hip Links | Fan sites, podcasts, community |
| `/bring-it-all-back` | `bring-it-all-back.html` | Daily Setlist Game / Bring It All Back | Daily year-guessing game (opens 2026-10-30) |
| `/song/<slug>` | `song.html` | Song | One page per song (191). `/song` lists them all. |
| `/forum-invite.html` | `forum-invite.html` | Claim Yer membersHIP | Free membersHIP number signup |
| anything else | `404.html` | Page Not Found | Branded 404 |

`/lyrics`, `/setlists`, `/top-40` and `/song/*` are Netlify 200 rewrites onto one HTML file; the script reads the path and switches view. Locally (no rewrites) use `discography.html?view=<key>` and `/song?s=<slug>`.

Every sub-page uses the same header (`.page-header` in `shared.css`): gold eyebrow with the plain name, Hip-song title, one-line description, "Home" button.

---

## 4. How each feature works

### 4.1 Member gate and sessions
Every page loads `js/tth-member-gate.js` first. With no saved session it shows a full-screen gate before any content: a big **Start exploring** button (guest), and below it first name plus membersHIP number fields with "Unlock yer shows", a link to claim a free number, and a one-line "Why grab one?". Skipped on localhost and `file://`.

- **Guest**: Start exploring writes a local-only session (`guest: true`) to `localStorage` key `tth_member_session`. Nothing is sent to Supabase. Shows ticked as a guest stay on that device.
- **Member**: first name plus number is checked by the Supabase function `unlock_member`. On success the session is saved locally and attended shows sync to the member's row via `update_attended_shows`.
- **Claiming a number** (`/forum-invite.html`): asks first name, last name or initial, optional favourite song, inserts a row into `forum_members`, and shows the new number. It signs the person straight in, and any shows they collected as a guest carry over to the new number.
- Public API for pages: `window.TTHMember` (`getSession`, `isUnlocked`, `signOut`, `hasShow`, `addShow`, `removeShow`, `toggleShow`, `onChange`).

"membersHIP" was retired as a paywall term but is still the name for the free numbers. Use it for member numbers only.

### 4.2 Home
Welcome note in jD's voice ("Hey, it's jD here."), a universal search box, then the **Today band**: **On This Day** (Hip shows played on today's date) and **Show of the Day** (one recorded show, the same for everyone; if the Archive has a recording played on today's date it uses that, otherwise a fixed rotation). Then the menu in groups: Shuffle (Random Hip Song, Random Live Show), Play, Listen, Live Shows, Watch, Dig Deeper. Each card shows the Hip-song name as a gold label, the plain name, and one line of what is inside, with counts pulled from the site's own data.

Search covers albums, songs, lyrics, live shows, and live performances of a song. A song result opens that song's page (`/song/<slug>`), once per song however many releases or versions it is on.

### 4.3 Discography, Top 40, Lyrics, Setlist Explorer
One 3,200-line script (`js/discography-app.js`) drives four views from one file, because they share modals and the song view. Albums grid (studio, EPs, solo projects, live, compilations, box sets, video) opens modals with tracklists, streaming links (Apple Music, Spotify, Tidal, YouTube Music, Amazon) and buy links. The Top 40 shows all 169 voted songs; ranks 1-40 link their TTHTop40 Countdown episode, ranks 41-169 link their Road to the Top 40 episode. Lyrics Search works over `data/lyrics.json`. The Setlist Explorer filters 1,089 setlists, and each show has an **I Was There** button.

### 4.4 Tour map and the audio player
All 1,355 gigs on a Leaflet map with tour and country filters, a year-range slider, search, an animated "play through the years" mode, an On This Day banner, and per-show popups (setlist, recording, I Was There). Shows with a recording open the player: the track list streams from B2, with a progress bar, previous/next and volume. Deep links: `tour-map.html#show=<id>` opens a show; `#play=<id>` starts its recording; `#play=random` picks a random recorded show.

### 4.5 Yer Hip Passport (`/my-shows`)
Built from the shows a person ticked with **I Was There**. Totals (shows, songs heard, cities, years), first and latest show, rarities caught (songs played live under 10 times ever), most-heard songs, a Leaflet map of their venues, a checklist against the official song list (168 songs ever played live), the show list with remove buttons, and a share card in three sizes (Facebook 1200x630, Instagram post 1080x1350, Instagram story 1080x1920) made on a canvas. Everything is computed in the browser. Guests see a note that shows are saved on this device only.

### 4.6 Song pages (`/song/<slug>`)
One page per song on jD's official list (191). Shows times played live, live debut and latest performance (each linking to the show), a tappable plays-by-year chart, albums (first release, then "Also on"), fan ranking with podcast link, every Hip Archive recording with a Play link, and all live performances by year. Built from `data/song-index.json`, so phones never download the 2 MB setlist file. Songs with no live plays say so. `/song` lists all songs with a filter box. Debut and latest dates are setlist.fm's and can be wrong if its data is incomplete; the page says so.

### 4.7 Bring It All Back (daily game)
One real setlist a day, the same for everyone, from a pool of 967 shows (1985-2016, 10+ songs, fixed-seed order). Guess the month and year in five tries; both must be right to win. Each miss says only whether the year and the month are right (no Earlier or Later), adds a coloured square (month and year, right year only, within 2 years, farther) and unlocks a hint in order: country, tour, then city and state. Result screen reveals the show, links to play it or see it on the map, and shows the game's points (100 for the first guess, then 80, 60, 40, 20; a miss is 0), played, win %, streak, best, total points, and the guess distribution, with a no-spoiler share text, a no-spoiler score card image (Facebook, Instagram post, Instagram story), and a countdown to the next puzzle. State lives only in the visitor's `localStorage` (`tth_bia_v2`). Puzzle #1 is **2026-10-30**; before that the page says when it opens. `?day=N` and `?reset=1` work on localhost only.

### 4.8 Live Show Stats, Unplucked Gems, videos, links
- **38 Years Old**: most-played songs, openers and closers, one-timers, longest shelvings, songs never played live, all from setlist data.
- **Unplucked Gems**: every known unreleased recording, demo, outtake and alternate version by era, with availability and quality. Compiled by Alonx via TrackerHub; loaded from a sessions CSV by `parse-sessions-csv.js`.
- **Video For New Recruits**: 380 curated YouTube concerts, bucketed by era, and linked both ways with the tour map by show date.
- **They Shot A Movie Once**: the 36 official music videos.
- **Yer Hip Links**: fan sites, podcasts and community.

---

## 5. Data

All data is static JSON in `data/`, loaded by the browser. Shows are keyed by their **setlist.fm id** everywhere, which is what joins setlists, recordings, videos, the Passport and the game.

| File | What | Used by |
|---|---|---|
| `discography.json` | 36 releases and tracklists | discography, song pages |
| `setlists.min.json` | 1,355 setlists, 1,089 with songs (1985-2022) | explorer, stats, home, Passport |
| `tth-tour-data.json` | 1,355 gigs with coordinates, Archive links and track lists (2.6 MB) | tour map |
| `show-index.json` | Slim per-show lookup: coordinates and has-recording flag | Passport |
| `show-videos.json`, `youtube-videos.json`, `music-videos.json` | Video data and the show-to-video join | video pages, tour map |
| `lyrics.json` | Lyrics for 169 songs | lyrics search |
| `unplucked-gems.json`, `missing-lyrics.json` | Sessions tracker, songs without lyrics | gems page, lyrics page |
| `*-play-counts*.json`, `live-play-counts-merged.json` | Hipbase and setlist.fm play counts, merged | stats |
| `canonical-songs.json` | jD's official song list (191 songs, versions folded in), with each song's setlist spellings and live-play count | Passport, song index |
| `song-index.json` | Per-song debut, last, plays, recordings, albums, ranking | song pages |
| `game-pool.json` | The 967 puzzle shows in fixed order | game |

**The official song list** is the 214 options in jD's public Google Form, plus 'Apartment Song' (jD confirmed it belongs). Demos, outtakes and alternate versions fold into their parent song, giving 191. 168 have been played live per setlist.fm; 23 have never appeared in a setlist.

**Matching rules** (identical in the Passport, song index and `build-canonical-songs.js`): names are lower-cased with accents and punctuation stripped; a medley ('A / B') counts as both songs; covers and tape are skipped; 'It's Just as Well' is treated as 'Just As Well'; a title before its bracket ('Courage' for 'Courage (For Hugh MacLennan)') matches unless that is another song's own title.

**Sources** (credit them on the site): setlist.fm (setlists), Hipbase.com by Lance Robinson (gig data and play counts), The Hip Archive by Darrin Cappe (recordings), CARTO and OpenStreetMap (map), Alonx via TrackerHub (the Unplucked Gems sessions tracker).

**Refresh scripts** (each is Node or Python with no dependencies beyond the standard library; the order below is **(inferred)** from their inputs and outputs):

1. `fetch-setlist-data.js` -> `tth-tour-data.json`; `fetch-setlists.js` -> `setlists.json` (full copy, gitignored; the minified `setlists.min.json` is made from it, but the minify step is not in `scripts/`)
2. `fetch-setlistfm.js` + `scrape-hipbase.js` -> play counts, then `merge-live-counts.js` -> `live-play-counts-merged.json`
3. `scrape-archive.js`, `upload-audio-to-b2.py`, `run-upload-workers.sh`, `fix-track-names.py` -> recordings and track lists
4. `build-lyrics.js`, `build-missing-lyrics-doc.js` -> lyrics
5. `parse-sessions-csv.js` (reads the TrackerHub sessions CSV) -> `unplucked-gems.json`; `build-youtube-videos.js` then `build-show-video-map.js` -> video data
6. v5, run in this order when setlist data changes: `build-canonical-songs.js` (needs network, reads the Google Form), `build-show-index.js`, `build-game-pool.js`, `build-song-index.js` (also rewrites the song block in `sitemap.xml`)
7. Always finish with `node scripts/audit-site.js`

Needs a `SETLIST_FM_API_KEY` for the fetch scripts, kept in a gitignored `.env`.

---

## 6. Members and Supabase

- One Supabase project, called straight from the browser with the **public anon key** in `js/tth-member-gate.js`. That key ships to every visitor by design. The real protection is the database's row-level security and the signatures of its functions.
- Known objects: table `forum_members` (first name, last name, favourite song, membership number), and functions `unlock_member(p_first_name, p_number)` and `update_attended_shows(p_first_name, p_number, p_shows)`. The table and function definitions are not in this repo (`supabase/` holds only a CLI config), so they live only in the Supabase dashboard. **Keep a copy of their SQL in the repo.**
- A member is identified by first name plus number. That is not authentication: anyone who knows both can act as that member. It is fine for attended-show lists and a fun poll. It is not fine for anything that needs trust.
- Free-tier Supabase pauses after 7 days of no activity, which would lock members out. A GitHub Action (`supabase-keepalive.yml`) pings it Monday, Wednesday, Friday and Sunday. If it fails, the project is paused: restore it in the Supabase dashboard.
- Privacy statement used on the claim page: "All I keep is yer name, yer favourite song if you share it, and yer number. No email, no password, no spam."

---

## 7. Caching and offline

`service-worker.js` precaches the core pages, CSS, JS and key data files (`CORE_ASSETS`). HTML pages and `/data/*.json` are network-first with a cache fallback, so updates reach people. Other assets are cache-first. An unvisited `/song/<slug>` offline falls back to `song.html`. The worker file itself is served `no-cache`.

**Every release must bump `CACHE_NAME`** (`thc-v5.1` today) or returning visitors keep stale JS and CSS. New pages, scripts and styles must be added to `CORE_ASSETS`. When testing, unregister the worker and delete all caches between checks or you will see old files.

---

## 8. Releases and workflow

- **Naming:** major releases are Hip albums, minor releases are that album's tracks in order. v5 is "Day for Night"; v5.1 'Grace, Too'; v5.2 'Daredevil'; v5.3 'Greasy Jungle'; v5.4 'Yawning or Snarling'; v5.5 'Fire in the Hole'; and so on. Check the order against `data/discography.json`. Patches add a third digit. Older versions (v2 to v4) followed the same idea less strictly.
- **Where it is recorded:** the footer label (`js/shared-footer.js`), the cache name, and `docs/CHANGELOG.md` (newest first, one entry per release).
- **Branches:** work on a branch, merge to `main` to publish. `main` pushes go live automatically.
- **Before shipping:** run `node scripts/audit-site.js`, load every page at phone width (375x812) and laptop width, check the console, and test with the live headers in mind (see below).
- **Local preview quirks:** the preview server (`npx serve`, port 8765, `hip-webapp` in `.claude/launch.json`) ignores `_headers` and `_redirects` and strips query strings when it redirects `.html` to the clean URL. Use `/page?x=1`, not `/page.html?x=1`. The gate is skipped on localhost; open `http://[::1]:8765/` to see it.
- **Testing members:** use guest sessions (`guest: true`). A non-guest test session sends real writes to the live database.
- **Git on this Mac:** `git push` works from the shell only with the sandbox off (macOS keychain). (A pair of stray `main 2` refs that broke `git fetch` was removed on 2026-10-28.)

---

## 9. Analytics

Umami, cookieless, events by name only. Current events: `Gate - Shown`, `Gate - Start exploring`, `Gate - Member unlock`, `Gate - Unlock failed`, `Gate - Claim click`, `Claim - Number claimed`, `Passport - Card made - <size>`, `Passport - Card saved`, `Passport - Card shared`, `Song - Play recording`, `Game - Started`, `Game - Won`, `Game - Lost`, `Game - Shared`. Visits from the live domain count, including test visits.

---

## 10. Voice and brand rules

- Voice: warm, direct, conversational, "yer" where it fits, never corporate. Community copy opens "Hey, it's jD here."
- Song titles in single quotes, album titles in double quotes. Single hyphens, no em dashes. No "level up", "tribe", "journey", "exclusive content". Newsletter is *Yer Letter*.
- Poppins only. No rogue colours or fonts. White interior pages and Dark Purple `#140038` covers apply to PDFs and show notes, not the site.
- Attribute data sources on the pages that use them.

---

## 11. How it should work versus how it works now

### Intended behaviour (design principles)
1. **Free and open at the door.** Guests see everything. A membersHIP number only adds saving shows across devices.
2. **One home, one purpose per page.** Home is the front door; each feature has its own address and header.
3. **Everything computed in the browser from static data.** No server code to run, break or pay for, apart from the member database.
4. **Anonymous analytics only.** Event names, never people.
5. **Every claim on a page is true to the data.** Counts come from the data files, not typed in.
6. **Shows are the unit.** Setlist.fm ids join every feature.

### Known problems and gaps (as of 2026-10-28)
Fixed on 2026-10-28 and live in v5.1.1: the Passport share card being blocked by the CSP, and home search results being clipped.

1. The home "Bring It All Back" card says "A new show every day" but the game does not open until 2026-10-30. jD is fine with this.
2. Copy says "1985 to 2016" in places, but the data runs to 2022 (two later shows: 2021-06-06 Massey Hall, 2022-09-16 National Arts Centre).
3. 22 official songs never appear in any setlist and 'Dare Devil (Reprise)' has no plays, so 23 can never be ticked in the Passport. This may be setlist.fm gaps.
4. 15 songs have no album shown on their song page because the discography data does not list them (for example 'Hush', 'Skeleton Park').
5. The Google Form behind the song list has no "Choose yer number 3" question, lists 'Lake Fever' twice, and lacks 'Apartment Song'.
6. Dead code: the old My Shows section and `FEATURE_VIEWS['my-shows']` in `discography.html` and `discography-app.js` only forward old links now. Comments in `tth-member-gate.js` still mention a removed `tth-launch-gate.js`.
7. `package-lock.json` (named `thc-compendium-functions`, left from an old experiment) is served publicly. Harmless, but unused.
8. The Supabase table and function definitions are not stored in the repo.

### Risks to decide on
- **Lyrics are copyrighted and published in full.** `data/lyrics.json` holds the complete words to 169 songs (about 169,000 characters), pulled on 2026-03-19 from the lyrics.ovh service by `scripts/build-lyrics.js`. The pages only show excerpts (up to three matching lines per song in Lyrics Search, the first 400 characters in the old song view), but the whole file is a public download at `/data/lyrics.json`, sits in the public GitHub repo and its history, and is copied into every visitor's browser. The site also asks fans to email in missing lyrics. Nothing in the repo shows a licence for any of it. **Decision (jD, 2026-10-28): keep it as it is.** Options that were on the table: replace it with search-only plus links to licensed lyric sites, or license it. Removing the file now would not remove it from git history or forks.
- **Weak identity.** Name plus number lets anyone impersonate a member. Do not build anything on it that needs trust.
- **Third parties can break pages:** CARTO tiles (need a key), Backblaze B2 audio, setlist.fm, Hipbase, the Hip Archive, YouTube, Umami, Supabase. The weekly audit and YouTube check catch some of this.
- **Setlist.fm is community data** and can be incomplete. Debuts, last plays and "never played" claims inherit that.

---

## 12. What is planned

- **v5.2 'Daredevil': guided listening paths** in three tiers (getting familiar, a deeper dive, fanatic). Approved. Needs jD's own picks; no "essential" shows should be invented.
- **v5.3 'Greasy Jungle': fan voting** (Top 10 ballot from the song list). Not decided. Needs the poll's purpose and dates, and jD to run SQL in Supabase. Defaults sketched: members only, ranked 10 to 1, one ballot per number, replaceable until close, results hidden until reveal.
- **Podcast episode links on song pages** for songs outside the Top 40 vote, from a mapping jD supplies (`data/song-episodes.json`, to be created).
- **After the October 29 promo:** read Umami's Gate events to decide whether the member gate should stay on the home page.
- **Out:** "I was there" member memories on show pages. Do not propose them again.

---

## 13. Quick reference

| To do this | Run |
|---|---|
| Check the whole site's links, assets, data and CSP | `node scripts/audit-site.js` (add `--no-network` to skip external checks) |
| Check linked YouTube videos are alive | `node scripts/check-youtube-videos.js` |
| Rebuild song pages and sitemap song block | `node scripts/build-song-index.js` |
| Rebuild the official song list | `node scripts/build-canonical-songs.js` |
| Local preview | `hip-webapp` in `.claude/launch.json` (`npx serve`, port 8765) |
| Publish | Merge to `main` and push. Bump `CACHE_NAME` and the footer version first. |
