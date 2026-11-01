# The Hip Handbook - notes for Claude Code

A free fan archive for The Tragically Hip, built and run by jD (Jamie Dew, TTH Podcast Series). Live at https://thehiphandbook.tthpods.com. This repo (`tthpodcastseries/tragically-hip-discography`) is public, and so is this file: never put a key, password or member detail in it or anywhere in the repo.

jD is not a developer. Explain in plain words, lead with problems, show a plan before any change that touches more than one file, and ask before deleting or overwriting anything. Never correct Hip facts (songs, dates, setlists, credits) from memory: ask jD.

## How it works

- Static HTML, CSS and plain JavaScript. No framework, no npm packages, no build step. The repo root is the site.
- Pages: one `.html` per page at the root, with its script in `js/` and its styles in `css/`. No inline scripts or `onclick=` (the Content-Security-Policy in `_headers` blocks them).
- Data: static JSON in `data/`, loaded by the browser. Shows are keyed by their setlist.fm id everywhere.
- Members (membersHIP): Supabase, called from the browser with the public anon key in `js/tth-member-gate.js`. The `forum_members` table is closed; the site only calls three database functions: `claim_member`, `unlock_member` and `update_attended_shows`. The full database setup is in `docs/The Hip Handbook - Database Schema.sql` (plus the two other `.sql` files in `docs/`). Database changes are SQL that jD runs by hand in the Supabase SQL Editor. Never write to the live database from a test: use guest sessions.
- Privacy: `privacy.html` says what the site keeps and where it goes (Supabase, Umami, Backblaze and the rest). If a change collects anything new or adds an outside service, update that page in the same release and show jD the wording.
- Outside hosts: any new one (scripts, images, audio, APIs) must be added to the CSP in `_headers`, or it works locally and breaks live. The local preview ignores `_headers` and `_redirects`.
- Redirects and blocked paths live in `_redirects` only. `netlify.toml` just sets the publish folder.
- Offline: `service-worker.js` precaches the small shell (`CORE_ASSETS`) and is network-first for pages, CSS, JS and data.
- More detail: `docs/The Hip Handbook - Overview.md`. History: `docs/CHANGELOG.md`.

## Deploying

- Netlify publishes every push to `main`, within seconds. Each deploy costs Netlify credits shared with jD's other sites, so batch the work: commit locally and **never `git push` unless jD says so in this session.**
- Before every push, and before every commit that changes data or pages, run `node scripts/audit-site.js --no-network`. It must end "All checks passed." Drop `--no-network` to also test outside links. GitHub runs the same check after every push (`.github/workflows/site-audit.yml`) and emails jD if it fails, but by then Netlify has already published, so run it first.
- Scripts expect Node 22 (`.nvmrc`). Most need no packages; the Python ones in `scripts/archive/` need `reportlab` or `boto3`.
- Local preview: `hip-webapp` in `.claude/launch.json` (port 8765).
- `git push` from this Mac needs the sandbox off (macOS keychain).

## Releases

- Version names follow The Hip's albums: the major number is an album, each minor is that album's next track, in order (check `data/discography.json`). v5 is "Day for Night": v5.4 is 'Yawning or Snarling', so the next minor is v5.5 'Fire in the Hole'. Fixes add a third digit: `v5.4.18 (Yawning or Snarling - Patch)`. jD decides when a minor or major starts.
- Every release, in one commit:
  1. `var version` in `js/shared-footer.js` (the footer label)
  2. `CACHE_NAME` in `service-worker.js`: `hh-v` plus the number. Keep the `hh-` prefix, never `thc-`.
  3. A new entry at the top of `docs/CHANGELOG.md` in the existing style, ending with the cache and footer bump line
  4. New pages, scripts and styles added to `CORE_ASSETS` (nothing over 250 KB)
  5. Commit message: `v5.4.18 (Yawning or Snarling - Patch) - Short summary`
- `scripts/audit-site.js` fails if the footer, the cache name and the newest changelog entry disagree.

## Brand rules (TTH Podcast Series Brand & Style Guide v7.1)

The guide PDF sits in `docs/` on jD's Mac only (`*.pdf` is gitignored). Where this list and the guide differ, the guide wins.

- **Poppins only**, served from `/fonts/`. No other font, ever.
- **Colours:** Deep Black `#0e0b16` background, Light Grey `#d9d9d9` text, White, Mid Grey `#929292` for faint text. Gold `#CCA23C` and Red `#C8102E` are for fills, borders, bars and underlines only, never for words (jD, 2026-10-31). No gradients, except the approved red glow behind the home header.
- **No em dashes** in anything a fan reads: use " - ". No "#" for numbers: "No. 12". Oxford comma.
- **Titles:** song titles in single quotes ('Ahead by a Century'), album titles in double quotes ("Fully Completely") in sentences. Track lists and setlists stay plain.
- **The band:** "The Tragically Hip" or "The Hip", capital T. Never "Tragically Hip" alone, and don't use "Hip" as an adjective: "Hip song" becomes "song by The Hip".
- "membersHIP" is the right name for Handbook member numbers. Voice: warm, direct, "yer" where it fits, never corporate.

## Data pipeline

Most data is built by scripts in `scripts/` (Node, no packages; run with `node scripts/<name>.js`). Never edit a generated file by hand. Lyrics (`data/lyrics.json`) and the fixes in `data/setlist-corrections.json` are edited by hand.

When setlist or show data changes, run in this order:

1. `apply-setlist-corrections.js` - layers the hand-checked fixes onto `setlists.min.json` and `tth-tour-data.json`
2. `build-canonical-songs.js` - the official song list from jD's Google Form (needs the internet) -> `canonical-songs.json`
3. `build-show-index.js` -> `show-index.json`
4. `build-show-video-map.js` -> `show-videos.json`
5. `build-light-data.js` -> `on-this-day.json`, `tour-map.json`, `tour-tracks.json`
6. `build-game-pool.js` -> `game-pool.json` ('Bring It All Back')
7. `build-song-index.js` -> `song-index.json` and the song block in `sitemap.xml`
8. `build-site-stats.js` -> rewrites the headline counts (shows, setlists, recordings, lyrics and the rest) in the pages
9. `build-seo-pages.js` -> `song/*.html`, `lyrics.html`, `setlists.html`, `top-40.html` (run after any change to songs, `song.html`, `discography.html` or `FEATURE_VIEWS`)
10. `build-trunk-pool.js` -> `trunk-pool.json` ('(Un)Locked'; uses the macOS word list)
11. `check-game-schedule.js`, then `audit-site.js`

Also: `build-youtube-videos.js` (from `data/source/youtube-videos.csv`, then step 4), `build-webp.js` for new images (needs ffmpeg). `build-site-stats.js`, `build-seo-pages.js`, `build-light-data.js` and `build-webp.js` take `--check`, which only reports.

**The daily games are append-only.** Never change, reorder or remove a scheduled puzzle. `node scripts/check-game-schedule.js` proves nothing moved; `audit-site.js` runs it against the last commit and the last push. A change jD approves by puzzle number goes in `APPROVED` at the top of that script, and only then.

**Song names:** `audit-site.js` fails when a setlist song matches nothing on the official song list. Fix a misspelling in `data/setlist-corrections.json` (`renameSongs`), then rerun from step 1. Only a song The Hip played but never released goes on `KNOWN_NOT_ON_LIST` in `audit-site.js`, and only with jD's say-so.

**Never run without jD's say-so** (they refuse unless given `--force`, and `--force` is jD's call):
- `fetch-setlist-data.js` - would wipe all 614 recordings from `tth-tour-data.json`
- `build-lyrics.js` - would replace the hand-corrected lyrics
- `parse-sessions-csv.js` - would undo hand edits in `unplucked-gems.json`
- `build-game-pool.js --force` / `build-trunk-pool.js --force` - would start a new puzzle schedule

Fetch scripts read `SETLIST_FM_API_KEY` from the gitignored `.env`: `node --env-file=.env scripts/<name>.js`. The step that turns `data/setlists.json` into `setlists.min.json` is not in `scripts/`. Old one-off scripts are in `scripts/archive/`; don't run them.

## Housekeeping

- **iCloud:** this folder is in iCloud-synced Documents. If a command hangs, check for files iCloud has moved off the Mac before running git: `find . -path ./node_modules -prune -o -flags +dataless -print | head`. If any show up, jD sets the folder to Keep Downloaded in Finder.
- `AUDIT_*.md` and `SYSTEM_MAP.md` (the October 2026 audit) stay untracked: never commit them. Same for `_MANIFEST.md`, `about-me.md`, `brand-voice.md`, `working-style.md` (jD's private files) and `.env`.
- The Supabase keepalive (`.github/workflows/supabase-keepalive.yml`) pings the database four times a week so the free project never pauses. GitHub switches scheduled workflows off after 60 days with no commits: if the repo goes quiet that long, re-enable both workflows under GitHub > Actions.
- Song-name matching is written in several places (`js/passport.js`, `js/song.js`, `js/live-stats.js`, `js/unlocked.js`, `scripts/build-song-index.js`, `scripts/build-canonical-songs.js`) and the copies differ a little. Change one and the counts on other pages can move: compare before and after.
