# The Hip Handbook - Test Run - 2026-10-28

Tested against v5.1.1 (Grace, Too - Patch), locally (`serve`) and live at thehiphandbook.tthpods.com. Live test visits ran with `umami.disabled` set, so they did not add to the analytics.

## Bugs

> **Status:** 1-4 fixed in v5.1.2 (same day). See `docs/CHANGELOG.md`. Item 3: the right ID is `2FI07Cg55A8xTuowS3uprb`, "That Night In Toronto (Live)".

1. **'Toronto #4' will not play in 10 recorded shows.** `tour-map.html:1106` builds the audio URL as `${AUDIO_BASE}/${t.url}` without encoding it. The browser reads `#4.mp3` as a fragment and requests `.../09 Toronto ` -> 404. Encoded, the same file returns 206. Affected: 2000-06-20 Montreal, 2000-06-21 Montreal, 2000-06-29 Somerville, 2000-10-19 Tucson, 2000-10-27 Fort Collins, 2000-11-04 Portland, 2000-11-28 Brandon, 2000-12-02 Detroit, 2000-12-20 Buffalo, 2000-12-23 Toronto. Fix: encode each path segment (`t.url.split('/').map(encodeURIComponent).join('/')`).
2. **Bring It All Back: the tour hint gives away the answer in 75 of 971 puzzles (7.7%).** Hint 2 shows the tour name, and five tour names contain the year: Another Roadside Attraction 1993 / 1995 / 1997, Summer Tour 2011, Fully and Completely North American Tour 2015 (50 shows). Fix: strip a trailing year from the tour name in the hint only. The result screen can keep the full name.
3. **Dead Spotify link: "That Night in Toronto".** `js/discography-app.js:572` -> `open.spotify.com/album/6cUEjW9uMfewWYDl46waFn` returns 404. The other 93 Spotify links are live.
4. **`scripts/check-spotify-urls.js` checks nothing.** It uses its own old 26-release placeholder dataset with no URLs filled in, so it reports "0 checked, 0 broken" every time. It also writes its report into `data/`, which is the publish root. Either point it at the URLs in `js/discography-app.js` or retire it.

## Needs jD's call

5. **Setlist Explorer opens on 2021 and 2022.** The two newest entries in setlist.fm's data are one-song entries: 2021-06-06 Massey Hall and 2022-09-16 National Arts Centre (no tour). They are the first two results on `/setlists` and count toward the 1,358, while the page copy says "1985 to 2016". Keep, label, or exclude?

## UX and accessibility

6. **Tour map on phones:** at 375x812 the filters take up the first 584px, so only about 230px of map shows on the first screen. Consider folding the filters into a collapsible bar on mobile.
7. **Song page plays-by-year bars are 8px wide on phones** (16px on desktop), and the page says "Tap a bar for a year". They are hard to hit. Consider widening the tap area beyond the visible bar.
8. **Member gate is not marked as a dialog.** Focus is trapped correctly (Tab cycles inside it), but it has no `role="dialog"`/`aria-modal`, and on load focus sits on `<body>`. Screen readers can still browse the page behind it. Add the role and move focus to "Start exploring".
9. **Contrast below WCAG AA (4.5:1) for small text:**
   - Footer version label `#666` on dark, 3.4:1, on every page
   - Brand red `#C8102E` used as small text, 3.1-3.3:1: On This Day years (home), "Encore" label (game), "Free for every Hip fan" eyebrow (claim page)
   Red is fine for large text and badges. For small text, use a lighter red or gold.
10. **Music videos search box has no label**, only placeholder text (`music-videos.html`, `#filterSearch`). Add an `aria-label`.
11. **Rogue font:** the album modal close button (✕) renders in Arial because buttons don't inherit Poppins there. Add `font-family: inherit` to `.modal-close`.
12. **Unknown song addresses are soft 404s:** `/song/not-a-real-song` returns HTTP 200 with "No song at that address". It's fine for people, but search engines may index it. Low priority.

## What passed

- `scripts/audit-site.js`: all checks pass (13 pages, service worker precache, manifest, sitemap, data cross-references, CSP image hosts, 36 external URLs)
- YouTube liveness: all 440 linked videos watchable
- JS syntax (all files), JSON validity (all data files)
- All 17 live routes return 200. Blocked paths (`/scripts`, `/docs`, `/audits`, `.md` context files, `.env`, unmatched list) return 404. Security headers and CSP are present. The service worker registers and activates, cache is `thc-v5.1.1`, and the footer shows v5.1.1.
- No console errors on any live page
- Flows: home search (mouse and keyboard to result), album modal (focus moves in, Escape closes, focus returns), Setlist Explorer I Was There -> Passport stats, share card (1200x630 PNG via blob), game guesses/validation/hints/result screen/stats, pre-launch "opens October 30" message live
- 15 sampled show recordings on Backblaze return 206
- Mobile 375px: no horizontal scroll on any page tested
- Images all have alt text; every page has one h1, `lang="en"`, and no skipped heading levels; Poppins everywhere except item 11
- Data is served brotli-compressed (setlists 2 MB -> 111 KB on the wire)
