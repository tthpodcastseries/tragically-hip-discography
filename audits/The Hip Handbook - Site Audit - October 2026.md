# The Hip Handbook - Site Audit - October 2026

Date: 2026-10-28 · Version audited: v4.5 (Lionized) · Live site + local copy

Method: ran `scripts/audit-site.js` and `scripts/check-youtube-videos.js`, loaded all 10 pages in a browser at phone (375x812) and laptop (1024x768) sizes, and checked the live site's console. Nothing was changed.

---

## 1. Broken right now (live site)

### 1.1 The tour map is invisible on phones
On a 375x812 phone the map is **0px tall**: the header, filters, slider, and footer fill the whole screen, and the page can't scroll (`body { overflow: hidden; height: 100vh }` in `css/tour-map.css:9`). The map is only 171px tall even on a 1024x768 laptop. Confirmed on the live site.

**Fix:** Take the footer out of the map page's layout, collapse the filters into a "Filters" toggle on phones, and give `#map` a minimum height (around 60% of the screen).

### 1.2 YouTube thumbnails are blocked on the live site
The security header in `_headers` doesn't allow images from `i.ytimg.com`, so every YouTube thumbnail gets blocked. On a phone, *They Shot A Movie Once* shows 36 black boxes, and the live console logged 200+ blocked-image errors across pages. This doesn't show up on localhost because the local server ignores `_headers`, which is also why the weekly audit missed it.

**Fix:** Add `https://i.ytimg.com` to `img-src` in `_headers`. Add a check to `audit-site.js` that every external image host the pages use is allowed by `_headers`.

### 1.3 Internal files are publicly readable
`/audits/hip-handbook-ui-ux-audit-2026-05-12.md` and `/docs/CHANGELOG.md` both load on the live site. Nothing secret is in them, but they're internal notes.

**Fix:** Block `/audits/*` and `/docs/*` the same way `/scripts/*` is already blocked (`_redirects` + `netlify.toml`).

### 1.4 The tour map's background tiles need an API key (found while fixing 1.1)
CARTO's `dark_all` basemap (`tour-map.html:174`) now serves every tile as a grey "API KEY REQUIRED" image, no matter which site asks. The markers, clusters, and popups still work, but there's no actual map under them. The tiles return HTTP 200, so the audit can't see this.

**Fixed in v4.5.2:** got a free non-commercial CARTO key and added it to the tile URL.

**Status:** 1.1-1.3 fixed in v4.5.1, 1.4 in v4.5.2.

---

## 2. Navigation - the problem you described

### What's actually happening
`discography.html` is a second home page. It has the same big THE HIP HANDBOOK title, its own search bar, a band photo, a stats row, and the On This Day box, plus a menu for **everything**: albums, Lyrics Search, Setlist Explorer, Top 40, My Concert History, Tour Map, and Fan Links.

- **5 of the 13 home menu cards** open the discography page, not their own page: Browse the Discography, Random Hip Song, Fan-Ranked Top 40, Setlist Explorer, My Concert History, and Lyrics Search all go to `discography.html#cat=...`.
- **They land at the top of that cloned header.** On a phone, clicking "Setlist Explorer" leaves you about 1,700px (two full screens) above the setlist content, looking at a page that looks like home.
- **The home menu doesn't start until about two screens down** on a phone. The hero photo, On This Day, and stats row all come first.
- **On This Day appears on 4 pages** (home, discography, links, tour map).
- **Pages use three different header styles:**
  - THE HIP HANDBOOK title: home, discography, links
  - THE TRAGICALLY HIP - About This Map: tour map
  - Gold eyebrow + Hip-song title + description + ← Home: Unplucked Gems, Video For New Recruits, They Shot A Movie Once, Live Stats

The eyebrow pattern is the best of the three. It tells you where you landed, and it's the one to standardize on.

### Proposed structure

**Home (index.html)** - only the front door:
1. Maple leaf + THE HIP HANDBOOK
2. Short welcome note in jD's voice (2-3 sentences: what this is, who built it, that it's free)
3. Photos
4. The menu: every card shows a plain name, the Hip-song title as a small eyebrow, and **one line describing what's inside**. Example:
   > MUSIC @ WORK
   > **The Discography**
   > All 35 releases - studio albums, EPs, live records, box sets, and solo projects.
5. Footer

Moves off home: the stats row (two of its four "stats" are *Kingston / Ontario* and *Canada's / Band*, so they don't add much), and On This Day (see below). Search is your call: it's useful, but it isn't "photos, welcome, menu." My pick is a slim search bar under the welcome note.

**Every other page** uses one template: gold eyebrow, title, one-line description, **← Home** button, then content. No big site title, no second menu, no On This Day.

**Proposed page list:**

| Menu group | Page | Today | Proposed |
|---|---|---|---|
| Listen | The Discography | `discography.html` (hub) | `discography.html` - albums only (Studio, EPs, Solo, Live, Compilations, Box Sets, Video) |
| Listen | Fan-Ranked Top 40 | tab in discography | own page, e.g. `top-40.html` |
| Listen | Unplucked Gems | own page | unchanged |
| Listen | Random Hip Song / Random Live Show | buttons into other pages | keep as action buttons, styled differently from page cards |
| Live Shows | Tour Map | own page | own page, fixed (1.1) |
| Live Shows | Setlist Explorer | tab in discography | own page, e.g. `setlists.html` |
| Live Shows | My Concert History | tab in discography | own page, e.g. `my-shows.html` |
| Live Shows | Live Show Stats | own page | unchanged; good home for **On This Day** |
| Watch | Video For New Recruits | own page | unchanged |
| Watch | They Shot A Movie Once | own page | unchanged (1.2 fix) |
| Dig Deeper | Lyrics Search | tab in discography | own page, e.g. `lyrics.html` |
| Dig Deeper | Fan Community Links | own page with home-style header | new subpage header, drop On This Day |

**How I'd build it (needs your OK first - touches many files):**
- The four tab features all live in `js/discography-app.js` (187 KB). The safest way to split them is new small HTML pages that load the same script and tell it which view to show, not rewriting the script into four.
- Old links keep working: `discography.html#cat=setlists` etc. redirect to the new pages, and song permalinks (`discography.html#song=...`) stay where they are.
- Sitemap, service-worker precache, and the audit script all get updated for the new pages.
- I'd ship it in two releases:
  1. Home + header template + discography cleanup
  2. Split out the four features

---

## 3. Smaller issues

**UX / UI**
- `forum-invite.html` (the "Grab one here" page from the member gate) has no way back - no Home link, no footer.
- Tour map filters on phones: the Country dropdown is cut off ("All Countr"), and the controls stack into a tall block.
- *They Shot A Movie Once* is about 14,500px tall on a phone (36 full-width cards). Consider collapsing decades or a compact list view.
- There are two different searches: home says "Search songs, lyrics, shows...", discography says "Search for a Hip song...". It should be one search everywhere.
- Map cluster numbers render in Helvetica/Arial, not Poppins (Leaflet's default font).
- One Poppins font file is preloaded but never used on load, so it's a wasted download (console warning on every page).

**Brand / copy**
- Titles in italics instead of quotes:
  - `music-videos.html:311` - *Small Town Bringdown* and *Get Back Again* should be in single quotes.
  - `forum-invite.html:253` - *Fully Completely*. If it means the album, it should be in double quotes. If it means the podcast, it should read Fully & Completely. I'm not sure which you meant.
- Em dashes visible to users:
  - The Kingston final-concert description (`js/discography-app.js:378`)
  - The audio player's empty track title (`tour-map.html:1020`)

---

## 4. What's working

- `audit-site.js` passes: internal links and assets on all 10 pages, service-worker precache, manifest, sitemap, data cross-references (1,358 shows, 195 video mappings, 169 lyrics, 15 gem eras), and all 33 external links.
- All 440 linked YouTube videos are live.
- No JavaScript errors on any page. No horizontal scrolling at phone width.
- Version label (v4.5) and service-worker cache match on every page.
- Poppins everywhere except the map clusters noted above.
- The release count on home (35) matches `data/discography.json`.

## 5. Not checked

- Member unlock with a real membersHIP number (I only used Browse as Guest on the live site).
- Spotify playback and Hip Archive audio playback.
- GitHub Actions run history (`gh` isn't installed on this Mac).
- A full accessibility pass. The May audit covered this; I didn't re-verify which of its findings are still open.
