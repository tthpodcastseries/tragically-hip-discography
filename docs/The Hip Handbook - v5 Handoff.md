# The Hip Handbook - v5 "Day for Night" Handoff

Written 2026-10-28. Pick this up in a new session by reading this file first, then `docs/CHANGELOG.md`.

> Internal notes. `/docs/*` returns 404 on the live site, but this repo is public on GitHub, so keep secrets out of it.

---

## 1. Where things stand

| | |
|---|---|
| Live site | **v4.8 "Fully Completely"**, thehiphandbook.tthpods.com, auto-deployed from GitHub `main` |
| `main` | `ef09b3b`, same as GitHub. Untouched by v5. |
| v5 branch | `v5-day-for-night`, **local only, never pushed** |
| Branch commits | `25f1cdd` "v5 WIP: Yer Hip Passport, song checklist, and share card" (on top of `ef09b3b`) |
| Uncommitted work | Yes. See section 3. |
| Version strings | Still `v4.8` in `js/shared-footer.js` and `thc-v4.8` in `service-worker.js` (not bumped yet) |

**Rule from jD: do not push v5 or merge it into `main` until jD says so.** A later launch and promo are planned. Pushing `main` publishes straight to the live site.

Promo for v4.8 (the friendlier gate) drops 2026-10-29. If `main` needs a hotfix before v5 launches, patch `main`, push it, then bring the fix into the v5 branch (`git merge main` while on `v5-day-for-night`).

---

## 2. What v5 is

The retention release: personal stats, daily habits, sharing. Names agreed with jD:

- **v5.0 = "Day for Night"** (the album). Later v5.x releases take that album's tracks in order: v5.1 'Grace, Too', v5.2 'Daredevil', v5.3 'Greasy Jungle', v5.4 'Yawning or Snarling', v5.5 'Fire in the Hole', and so on through 'Impossibilium' (track 14). Check order against `data/discography.json`, not memory.
- **The game** is **'Bring It All Back'**. Its plain name is "Daily Setlist Game".
- **The Passport** is **"Yer Hip Passport"**, Hip-song label **"In View"**, served at `/my-shows`.

Feature verdicts from jD: Passport, share card, song checklist, Show of the Day, the daily game, and song pages are all in. Guided listening paths are in too, as three tiers (getting familiar, a deeper dive, fanatic). **"I was there" member memories are out - do not propose them again.** Fan voting is open (see section 7).

---

## 3. What's built and where it is

### Committed on the branch (`25f1cdd`)
- **Yer Hip Passport**: `passport.html`, `js/passport.js`, `css/passport.css`. Totals, rarities (songs played live under 10 times), most-heard songs, a checklist against the official song list, a Leaflet map of venues, the show list with remove buttons, and a share card. `/my-shows` now rewrites to `passport.html` in `_redirects` and `netlify.toml`. Old `#cat=myshows` links still forward to `/my-shows` via `discography-app.js`.
- **Data**: `data/canonical-songs.json` (built by `scripts/build-canonical-songs.js`) and `data/show-index.json` (built by `scripts/build-show-index.js`).
- `js/tth-member-gate.js`: `getSession()` now returns `guest`.
- Home card renamed "Yer Hip Passport"; service worker precache includes the passport files.

### Done but UNCOMMITTED (on disk in the working tree)
| File | Change |
|---|---|
| `scripts/build-canonical-songs.js`, `data/canonical-songs.json` | 'Apartment Song' added via an `EXTRA_SONGS` list (191 songs, 169 played live). 'It's Just as Well' alias confirmed by jD. |
| `js/passport.js`, `passport.html`, `css/passport.css` | Share card now has three sizes: Facebook 1200x630, Instagram post 1080x1350, Instagram story 1080x1920. Size picker added. Story spacing fixed. All three checked visually. |
| `index.html`, `css/home.css` | New "Today" band directly after the header: On This Day, then **Show of the Day**. New "Play" menu group with the game card. Hero photo cropped to a banner and header padding tightened so On This Day starts at about 634px on a 375x812 phone (first screen). |
| `data/game-pool.json`, `scripts/build-game-pool.js` | Puzzle pool: 971 shows with 10+ songs, 1985-2016, fixed-seed shuffle, 562 with recordings. Set labels simplified to Main/Encore. |
| `bring-it-all-back.html`, `css/bring-it-all-back.css` | Game page markup and styles are written. **The game's JavaScript is not written yet.** |

Show of the Day (in `index.html`'s inline script): picks one recorded show per day, the same for everyone. If the Hip Archive has a recording played on today's date it uses that (`dayNumber % matches`); otherwise `recorded[(dayNumber * 7919) % recorded.length]`. Tested: card renders, "Play this show" opens `tour-map.html#play=<id>` with the audio player active.

---

## 4. What's left to do

### A. Write `js/bring-it-all-back.js` (the main gap)
`bring-it-all-back.html` already contains every element id the script needs: `biaLoading biaError biaGame biaNo biaTries biaSetlist biaForm biaInput biaGuess biaMsg biaGuesses biaHints biaEnd biaResult biaReveal biaLinks biaShareText biaCopy biaShare biaStats biaCountdown`. Design agreed with jD:

- **Data**: fetch `data/game-pool.json` (shape in the header comment of `scripts/build-game-pool.js`). Puzzle number `n = max(1, daysSince(EPOCH) + 1)`; today's show is `shows[(n - 1) % shows.length]`.
- **`EPOCH`**: a constant at the top of the file = the date of puzzle #1. **Set it to the real launch day before shipping.** Placeholder idea: `'2026-11-01'`. Before the epoch every day shows puzzle #1.
- **Local testing only** (hostname `localhost` / `[::1]`): `?day=N` forces a puzzle number, `?reset=1` clears saved game state.
- **Guessing**: year, 1985-2016 (use `minYear`/`maxYear` from the pool), 5 guesses. Reject out-of-range and repeated years with a message in `#biaMsg`.
- **Feedback per guess**: "Earlier" / "Later" (the show vs the guess), plus a square: right year green, within 2 yellow, within 5 orange, farther red.
- **Hints** unlock one per miss, in this order: country (`Intl.DisplayNames`, fall back to the code), tour (or "none listed"), city and state, then month. (Jd approved "country, tour, city"; the month hint on the 4th miss is my addition - mention it.)
- **Setlist display**: numbered songs; an "Encore" label before encore runs (pool `sets` are `{l:'Main'|'Encore', s:[...]}`).
- **End state** (win or 5 misses): result line, the full reveal (weekday and date, venue, city/state/country, tour), "Play this show" if `r === 1` (`tour-map.html#play=<id>`), "View on map" (`tour-map.html#show=<id>`), stats block (played, win %, current streak, best streak, guess distribution), a countdown to local midnight that reloads the page at 0.
- **Share text**: `🍁 Bring It All Back #<n> <guesses>/5` (or `X/5`), the row of squares, then `thehiphandbook.tthpods.com/bring-it-all-back`. "Copy my score" always; "Share" button only where `navigator.share` exists. No spoilers in the text.
- **Storage**: `localStorage` key `tth_bia_v1`, wrapped in try/catch. Holds `stats` (`played, won, streak, best, dist[5], lastSolved`) and `today` (`no, guesses[], done, won`). Displayed streak is 0 if `lastSolved` is neither today's nor yesterday's puzzle number.
- **Umami events** (names only): `Game - Started` (first guess), `Game - Won`, `Game - Lost`, `Game - Shared`. Reload the page if the day rolls over (`visibilitychange`).

### B. Wire up the game
- `service-worker.js`: add `/bring-it-all-back.html`, `/css/bring-it-all-back.css`, `/js/bring-it-all-back.js` to `CORE_ASSETS` (the passport files are already there).
- `sitemap.xml`: add `/bring-it-all-back`.
- Add `data/game-pool.json` handling check: the service worker caches `/data/*.json` network-first, so nothing extra is needed.
- Run `node scripts/audit-site.js --no-network` (must pass).

### C. Test (phone 375x812 and laptop 1280x800)
- Game: win on guess 1, win on guess 3, lose after 5; hint order; duplicate and out-of-range guesses; reload mid-game keeps state; stats and streak; copy/share text; countdown. Use `?day=N` on localhost.
- Home: Today band, Show of the Day (also on a day with no recording on that date), Play card link.
- Passport: re-run the quick checks after the share-card change.
- Console clean on every page.

### D. Release housekeeping (when everything above is done)
- `js/shared-footer.js` -> `v5.0 (Day for Night)`; `service-worker.js` -> `thc-v5.0`.
- Add a `## v5.0` entry at the top of `docs/CHANGELOG.md`. Cover: Passport and checklist, share card (3 sizes), Show of the Day, 'Bring It All Back', Today band on home, header banner crop, Apartment Song added, data scripts, and the `getSession()` guest flag.
- Commit with the attribution line from the session reminder (currently `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
- Do **not** push. Wait for jD's go-ahead.

### E. Launch day (later, jD decides)
1. `git checkout main && git pull`, then `git checkout v5-day-for-night && git merge main`.
2. Re-run `node scripts/build-canonical-songs.js`, `build-show-index.js`, `build-game-pool.js` if setlist data changed.
3. Set `EPOCH` to the launch date.
4. Re-run the audit and the test list.
5. Merge to `main`, push, then check the live site: `/my-shows`, `/bring-it-all-back`, home, and the footer version.

---

## 5. Testing rules and gotchas

- **Preview server**: `hip-webapp` in `.claude/launch.json`, `npx serve` on port 8765, serving this folder. It ignores `_headers` and `_redirects`, so clean addresses like `/my-shows` and `/setlists` 404 locally. Use `passport.html` directly, and `discography?view=setlists` etc.
- **The member gate is skipped on localhost.** To see it, open `http://[::1]:8765/`.
- **Use guest sessions for tests.** Set `localStorage.tth_member_session` to `{"memberNumber":1984,"firstName":"TheHip","guest":true,"attendedShows":[...ids],"unlockedAt":<ms>}`. A non-guest test session sends a real `update_attended_shows` call to the live Supabase database. One such call (fake member Jamie #4242) went out on 2026-10-28; it was rejected (HTTP 400, `invalid_credentials`), so nothing was written.
- **Clear the service worker between checks**, or you'll see stale files: unregister it and delete all caches, then reload.
- **My live-site checks count in Umami** (they run on the real domain).
- **Git**: `git push` works from Bash only with the sandbox disabled (macOS keychain). GitHub login is saved via the `gh` CLI. Push only on jD's say-so.

---

## 6. Content and data decisions

- **Official song list** = the 214 options in jD's public Google Form (https://forms.gle/TXNCF2iBuMJR4qnPA) plus 'Apartment Song' (jD confirmed it belongs). Versions (demos, outtakes, alternate mixes) fold into their parent song, giving 191 songs. 169 have been played live per setlist.fm; the Passport checklist counts against 169.
- **Rarity** = played live fewer than 10 times ever (per setlist.fm), computed from `livePlays` in `canonical-songs.json`.
- **Medleys** ('New Orleans Is Sinking / Nautical Disaster') count as both songs.
- **Share card sizes**: Facebook 1200x630, Instagram feed 1080x1350 (4:5), Instagram story 1080x1920. Instagram has been moving its profile grid to a different ratio; I'm not certain of the current spec, so check before launch.
- **On This Day** stays on home, now first after the header (jD's request).
- Brand rules: Poppins only, no em dashes, 'Song' titles in single quotes, "Album" titles in double quotes, "yer" voice, never banned words. The soft red glow behind the home header is approved; leave it.

---

## 7. Open questions for jD

1. **Fan voting** (v5.3 idea): jD asked how it would work. Sketch given: each member ranks a Top 10 from the song list, one ballot per membersHIP number stored in Supabase, open/close dates, a tally script, results hidden until the show. Needs a new Supabase table, which jD would create in the dashboard (SQL to be written). Not decided.
2. **22 songs on the official list never appear in any setlist** (for example 'Man', 'Not Necessary', 'Hot Mic'). That's per setlist.fm; they may simply be missing from its data. They can't be checked off in the Passport.
3. **The Google Form itself**: it has no "Choose yer number 3" question, lists 'Lake Fever' twice, and lacks 'Apartment Song'.
4. **Setlist Explorer description** says 1,358 shows "from 1985 to 2016" but includes two later shows (June 6, 2021 Massey Hall; Sept 16, 2022 National Arts Centre). Unresolved.
5. **Puzzle #1 date** (`EPOCH`) - decide with the launch date.
6. **Guided listening paths** (v5.2) need jD's own picks for the three tiers. Don't invent "essential" shows.

---

## 8. Later releases (not started)

- **v5.1 'Grace, Too'**: full song pages - live debut and last performance, plays by year, every archive recording. Podcast-episode links need a data mapping from jD.
- **v5.2 'Daredevil'**: guided listening paths (three tiers).
- **v5.3 'Greasy Jungle'**: fan voting, if jD wants it.
- Cleanup: the old My Shows section and `FEATURE_VIEWS['my-shows']` code in `discography.html` / `discography-app.js` is now dead except for old-link forwarding.
- After the Oct 29 promo: read Umami's Events tab (`Gate - Shown`, `Gate - Start exploring`, `Gate - Member unlock`, `Gate - Unlock failed`, `Gate - Claim click`, `Claim - Number claimed`) to decide whether the member gate should leave the home page. Earlier numbers: 816 visitors in 90 days, 88% landed on home, 58% bounce.
- `~/Documents/CLAUDE.md` still describes the old v2.3 web app and should be updated.

---

## 9. Key files

| Area | Files |
|---|---|
| Passport | `passport.html`, `js/passport.js`, `css/passport.css` |
| Game | `bring-it-all-back.html`, `css/bring-it-all-back.css`, `js/bring-it-all-back.js` (**to write**), `data/game-pool.json`, `scripts/build-game-pool.js` |
| Song list | `data/canonical-songs.json`, `scripts/build-canonical-songs.js` |
| Show index | `data/show-index.json`, `scripts/build-show-index.js` |
| Home | `index.html` (inline script has On This Day, Show of the Day, search), `css/home.css` |
| Gate | `js/tth-member-gate.js`, `forum-invite.html` |
| Shared | `css/shared.css` (`.page-header`), `js/shared-footer.js` (version label), `service-worker.js` (cache name, precache) |
| Routing | `_redirects`, `netlify.toml` (`/lyrics`, `/setlists`, `/top-40` rewrite to `discography.html`; `/my-shows` to `passport.html`) |
| Checks | `scripts/audit-site.js` (internal links, CSP image hosts, rewrites), `scripts/check-youtube-videos.js` |

Memory notes for the assistant live in `~/.claude/projects/-Users-jd-Documents-The-Hip-Handbook/memory/` (`v5-build-progress.md`, `v5-day-for-night-features.md`, `release-naming-convention.md`, and others).
