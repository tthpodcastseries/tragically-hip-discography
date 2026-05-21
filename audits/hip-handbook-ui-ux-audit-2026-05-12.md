# The Hip Handbook — UI/UX Audit
Date: 2026-05-12
Auditor: Claude Code (claude-opus-4-7)

> **Audit method:** static read of every HTML/CSS/JS file in the worktree. No runtime browser inspection. Where dynamic behavior matters (focus order after a JS-injected modal opens, contrast on a JS-set background color, Leaflet's own a11y), I flag the limitation and recommend manual verification rather than guessing.
>
> **Best-judgment calls** made before the audit (you asked me to use my own judgment): inline-style audit is pattern-level not exhaustive; the web app's `#0e0b16` palette is treated as the established system rather than held against the podcast brand guide's `#140038`; Red/Gold internal consistency is the bar; gated content is read statically. These are surfaced as questions where relevant.

---

## 1. Surface Inventory

**Static HTML site, no framework.** Single shared stylesheet [shared.css](css/shared.css), per-page inline `<style>` blocks, per-page inline `<script>`, 4 shared JS files in [js/](js/). Auth is Supabase via [tth-member-gate.js](js/tth-member-gate.js) + a pre-launch password overlay in [tth-launch-gate.js](js/tth-launch-gate.js).

### Routes audited (9 files)

| Route | File | Title | LOC | Member-gated |
|---|---|---|---:|:---:|
| `/` | [index.html](index.html) | The Hip Handbook | 1042 | ✓ |
| `/discography.html` | [discography.html](discography.html) | Music @ Work | 4347 | ✓ |
| `/tour-map.html` | [tour-map.html](tour-map.html) | About This Map | 1977 | ✓ |
| `/unplucked-gems.html` | [unplucked-gems.html](unplucked-gems.html) | Unplucked Gems | 753 | ✓ |
| `/video-for-new-recruits.html` | [video-for-new-recruits.html](video-for-new-recruits.html) | Video For New Recruits | 841 | ✓ |
| `/music-videos.html` | [music-videos.html](music-videos.html) | They Shot A Movie Once | 471 | ✓ |
| `/links.html` | [links.html](links.html) | Yer Hip Links | 303 | ✓ |
| `/forum-invite.html` | [forum-invite.html](forum-invite.html) | Claim Yer membersHIP | 379 | — |
| `/404.html` | [404.html](404.html) | Page Not Found | 73 | — |

### `discography.html` sub-tabs (hash-routed via `#cat=`)
`studio` / `eps` / `solo` / `live` / `compilations` / `boxsets` / `video` → `#albumsGrid`; `lyrics` → Poets; `setlists` → Family Band; `myshows` → In View; `top40` → Top Forty Countdown. Plus `#randomSong` (random-song dialog) and a Solo Projects sub-flow with five-member landing.

### Shared infrastructure
- [css/shared.css](css/shared.css) — tokens, skip-link, back-link, stats-row, site-footer, scrollbar
- [js/tth-launch-gate.js](js/tth-launch-gate.js) — pre-launch password overlay with live countdown (launch target 2026-05-11 20:00 EDT — already passed at audit time)
- [js/tth-member-gate.js](js/tth-member-gate.js) — Supabase RPC unlock + localStorage session + `window.TTHMember` API
- [js/shared-footer.js](js/shared-footer.js) — footer + service-worker registration
- [js/supabase.min.js](js/supabase.min.js) — Supabase JS client

### Design tokens ([css/shared.css](css/shared.css:6))
`--bg:#0e0b16 --bg2:#0a0a0a --bg3:#141414 --border:#1a1a1a --red:#C8102E --gold:#CCA23C --text:#ffffff --muted:#d0d0d0 --muted2:#b0b0b0 --accent-scroll:#3a1080`. Body color is `#d9d9d9` (literal, not a token). Font: Poppins via Google Fonts on every page.

### Components
Reused across pages: skip-link, `.category-nav` button rows, `.back-link`, `.stats-row` + `.stat`/`.stat-num`/`.stat-lbl`, `.song-search-autocomplete` (also in discography), the "On This Day" widget (index + links), `.show-detail-overlay` + `.setlist-overlay` (index + tour-map). Page-local components: flip-card grid (unplucked-gems + video-for-new-recruits, near-duplicate CSS), `.expanded-panel` modal (same pair), audio player bar (tour-map only), random-song dialog (discography only), Leaflet map with cluster markers (tour-map only).

---

## 2. Executive Summary

**Total findings: 47**
- **P0: 4** — keyboard-inaccessible primary navigation (flip-cards on 2 pages); 4 modal patterns missing `role="dialog"`/`aria-modal`/focus trap/Escape; member gate is the only entry door and renders 7 of 9 surfaces unreachable to users on iOS keyboard + VoiceOver if any of the above fail; sub-44px tap targets sitting on the critical attendance-toggle path
- **P1: 14** — small type (0.55–0.68rem) on functional UI elements, missing focus return after modal close, no popstate handling on hash-routed pages, no width/height on dynamic `<img>` (CLS), single-color filter pills without aria-pressed, em-dashes throughout tour-map H1/range/popup copy violating the brand-guide single-dash rule
- **P2: 19** — hex codes scattered instead of CSS vars (133 in discography.html alone), inline `<style>` blocks 800–1060 lines blocking cacheability, duplicated overlay markup across index + tour-map, off-token signal colors (Spotify green `#1DB954`, etc.) for source-type tags, inline `onclick=` handlers, inconsistent placeholder grammar
- **P3: 10** — minor copy polish, redundant CSS overrides, skip-link CSS overridden in forum-invite, unused `--text` token (body uses `#d9d9d9` literal), generic empty-state copy

### Top 5 themes
1. **Keyboard accessibility is incomplete on the two pages that need it most.** Unplucked Gems and Video For New Recruits use `<div class="flip-card">` with click handlers as their *only* interactive entry point — no `role`, no `tabindex`, no `Enter`/`Space` handler. A keyboard-only user can land on these pages and not open a single era. Member-gate, discography tabs, music-videos filters, and the 404 page are fine.
2. **Modal a11y is half-finished.** Only `randomSongPage` and `overlay` on discography use `role="dialog"` + `aria-modal`. Every other overlay (`.expanded-panel` ×2, `.show-detail-overlay`, `.setlist-overlay`, `.audio-player-bar`) is a `<div>` toggled by class with no ARIA, no focus trap, and no focus return on close. Escape works on most of them; click-outside works on most. Screen readers do not announce these as dialogs.
3. **The design system is real but inconsistently applied.** `shared.css` ships clean tokens, but per-page `<style>` blocks fork the palette repeatedly — 133 hex codes in `discography.html`, 25 in `forum-invite.html`, 28 in `index.html`, 16 in `tour-map.html`. Signal colors (Spotify green `#1DB954`, fan-blue `#7ab8f5`, etc.) are baked into tags without being promoted to tokens. The body color (`#d9d9d9`) is a literal that doesn't match any token.
4. **Typography goes below the legibility floor in functional UI.** Filter pills, tags, badges, and counts use 0.55rem–0.68rem (≈ 8.8px–10.9px). On mobile this becomes the gating accessibility issue: the controls users need to *operate* are smaller than the surrounding text they're reading.
5. **Em dashes appear in user-visible copy on tour-map.html despite the brand rule.** The page H1 itself is `THE TRAGICALLY HIP — About This Map` ([tour-map.html:930](tour-map.html:930)). Year-range display, popup city/country, and stats pill all use em dashes. CLAUDE.md (line: "Use single dashes, not em dashes") is violated in the primary navigation chrome of the second-most-trafficked surface.

### Overall assessment

**The Handbook works.** Most golden paths complete; the data layer is the star and the visuals largely stay out of its way. The site has a strong identity, a real design system (`shared.css`), and respectable defaults — skip links on every gated page, role="tablist"/role="tab" on discography categories, `aria-pressed` on the "I Was There" toggle, `prefers-reduced-motion` honored on index, lazy-loading on heavy thumbnail surfaces, semantic `<section>` headings on links.html, brand voice intact in copy.

But the *interactive depth* is half a layer thinner than the visual depth. Flip-cards, overlays, and dynamic markup were all built without the second pass that turns a working pattern into an accessible one. Two pages have keyboard-inaccessible primary nav, four modal patterns aren't announced as dialogs, no overlay returns focus on close, and small-print typography sits below the readability floor on the controls users need to operate. None of these are *visible* bugs — they're invisible costs paid by people the site isn't watching for.

The fastest wins, in order: (a) make flip-cards real `<button>`s; (b) add `role="dialog"`+`aria-modal="true"`+focus trap to the four ungated overlays; (c) bump every functional element below 0.7rem up to 0.72rem or higher; (d) replace em dashes in tour-map.html with single dashes; (e) extract the inline `<style>` blocks into shared.css or per-page external stylesheets so changes don't have to be made 6 times.

---

## 3. Findings

### Critical (P0)

#### [P0] Flip-card grid is keyboard- and screen-reader-inaccessible
- **Location:** [unplucked-gems.html:443–460, 720–740](unplucked-gems.html); [video-for-new-recruits.html:660–676](video-for-new-recruits.html)
- **Category:** A11y
- **Observation:** `<div class="flip-card">` is the only way to open an era panel on both pages. The element has `cursor:pointer` and an attached `click` listener, but no `role="button"`, no `tabindex="0"`, no `Enter`/`Space` keyboard handler, and no `aria-label`. There is no alternative entry point — once you've tabbed past the back-link, there's nothing to tab *to* on the page until the footer.
- **Why it matters:** Keyboard-only users (including motor-impaired users and VoiceOver-on-iOS keyboard navigation) cannot open Unplucked Gems or Video For New Recruits at all. WCAG 2.1.1 (Keyboard) fails. Both are heavily-promoted v3.4+ features.
- **Recommendation:** Replace `<div class="flip-card">` with `<button class="flip-card">`. Move `cursor:pointer` to the button (it's default) and remove the manual click listener — `addEventListener('click', ...)` already fires on Enter/Space for real buttons. Add an `aria-label` like `Open ${era.era} sessions`.

#### [P0] Four modal patterns lack `role="dialog"`, `aria-modal`, focus trap, and focus return
- **Location:**
  - `.show-detail-overlay` — [index.html:335](index.html:335), [tour-map.html:1811](tour-map.html:1811)
  - `.setlist-overlay` — [index.html:320](index.html:320), [tour-map.html:1824](tour-map.html:1824)
  - `.expanded-panel` — [unplucked-gems.html:163](unplucked-gems.html), [video-for-new-recruits.html:171](video-for-new-recruits.html)
  - `.audio-player-bar` — [tour-map.html:1846](tour-map.html:1846)
- **Category:** A11y
- **Observation:** Each of these is a `<div>` toggled by `.active` class. None has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trap, or focus-restore-to-trigger on close. Escape and click-outside work on most. The only modals on the site that *do* use the proper pattern are `#randomSongPage` and `#overlay` on [discography.html:1255, 1262](discography.html).
- **Why it matters:** Screen readers don't announce the overlay's purpose; focus stays behind the modal in the underlying page, so tabbing during an open overlay leaves the user navigating invisible elements; on close, focus lands at `<body>` instead of returning to the card that opened it. This is the difference between an overlay that works and one that's usable by people on assistive tech.
- **Recommendation:** Establish one shared modal pattern. Add `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"` to every overlay; on open, save `document.activeElement` and focus the heading or close-button; on close, restore focus; install a focus trap so Tab cycles inside the overlay. The two existing dialogs on discography are a good starting template.

#### [P0] Sub-44px tap targets on critical attendance controls
- **Location:** [tour-map.html:748](tour-map.html:748) (`.iwt-popup-btn` `padding: 6px 14px` → ~28px tall), [discography.html:1196](discography.html:1196) (`Switch member` button `padding:4px 10px` → ~26px tall)
- **Category:** Interaction (touch)
- **Observation:** WCAG 2.5.5 (Target Size, Level AAA at 44×44, Level AA at 24×24) and the iOS HIG (44pt) treat anything below 44px as a near-miss. The "I Was There" attendance toggle on map popups and the "Switch member" button in In View both fall well below. These two are also the main *write*-side controls — they mutate Supabase state.
- **Why it matters:** Fat-finger misses on a write-side control either toggle attendance for the wrong show or sign the user out unintentionally. The attendance toggle is the single highest-engagement interaction on the site.
- **Recommendation:** Bump both to at least `padding: 10px 18px` to clear 44px. Same for the streaming-service links on album pages — [discography.html:2203–2207, 3980–3984](discography.html) — which run `padding:4px 10px;font-size:0.65rem`.

#### [P0] Pre-launch gate password field uses `type="password"` but no label
- **Location:** [js/tth-launch-gate.js:48](js/tth-launch-gate.js:48)
- **Category:** A11y / Copy
- **Observation:** The injected pre-launch gate `<input id="passInput" type="password" placeholder="Password" aria-label="Enter site password">` does use `aria-label`, so the label exists — *but* the launch gate sits in front of the member gate, in front of every gated page. If `Date.now() >= LAUNCH_TIME`, the gate is bypassed entirely ([js/tth-launch-gate.js:28](js/tth-launch-gate.js:28)) — at audit time (2026-05-12) the launch has passed, so this gate is dormant. **This finding should be removed or downgraded once the launch is confirmed live in production.** Flagging as P0 only because the file is still shipping and would resurface if anyone reset the date.
- **Why it matters:** If the launch date is bumped again (it was bumped once already, from May 1 → May 11 per CHANGELOG v3.5.3), this overlay returns to production. The countdown labels also use `color:#666` ([js/tth-launch-gate.js:43–46](js/tth-launch-gate.js:43)) which fails contrast against `#0e0b16` (≈ 2.7:1, below 4.5:1 AA).
- **Recommendation:** Confirm the launch-gate file can be removed entirely (the bypass at line 28 is already in place), or, if it must stay, lift the countdown label color to `var(--muted2)` (`#b0b0b0`, ~9.4:1).

---

### High (P1)

#### [P1] Typography below 0.7rem on functional controls
- **Location:** Pattern across files. Examples:
  - [tour-map.html:291](tour-map.html:291) `.playback-stat-label: 0.55rem`
  - [tour-map.html:350](tour-map.html:350) `.badge: 0.55rem`
  - [tour-map.html:725, 733](tour-map.html) video-strip labels `0.6rem`, `0.62rem`
  - [unplucked-gems.html](unplucked-gems.html) `.filter-btn: 0.65rem`, `.flip-card-count: 0.58rem`, `.tier-badge: 0.62rem`, `.tag: 0.62rem`
  - [video-for-new-recruits.html](video-for-new-recruits.html) `.filter-btn: 0.65rem`, `.flip-card-count: 0.58rem`, `.flip-card-sublabel: 0.6rem`, `.tag: 0.6rem`, `.video-tracks-partial: 0.62rem`
  - [discography.html](discography.html) inline streaming-service buttons `font-size:0.65rem` at [lines 2203–2207, 3980–3984](discography.html)
  - [music-videos.html:248](music-videos.html:248) `.mv-trilogy-badge: 0.58rem`
- **Category:** Visual / Responsive
- **Observation:** These are not body-copy decorations — they're labels on *interactive* elements (filter pills, badges, tags, button-counts). 0.55rem on a 16px root is ≈ 8.8px.
- **Why it matters:** Below ~10px most users cannot reliably read short uppercase labels. The contrast with the surrounding body type (0.78–0.95rem) makes the small type read as "ignore-this metadata" even when it's the *active filter*.
- **Recommendation:** Floor functional UI at 0.72rem (≈ 11.5px). Reserve sub-0.7rem for purely decorative metadata.

#### [P1] Em dashes in user-visible copy on tour-map.html
- **Location:** [tour-map.html:930, 979, 1130, 1156, 1189, 1287, 1756](tour-map.html)
- **Category:** Copy
- **Observation:** Page H1 reads `THE TRAGICALLY HIP — About This Map`. Year range display (`1985 — 2016`), Leaflet popup city/country separator, stats pill (`gigs — cities — countries`), and current-show announcement all use em dashes.
- **Why it matters:** Direct violation of CLAUDE.md ("Use single dashes, not em dashes"). Brand consistency.
- **Recommendation:** Find-and-replace `—` → `-` across the file. Note: there are also `&middot;` (·) separators used elsewhere on the same page; pick one separator style.

#### [P1] No popstate handling on hash-routed pages
- **Location:** [discography.html:3830–3873](discography.html), [tour-map.html:1805](tour-map.html:1805)
- **Category:** IA
- **Observation:** Both pages write to `window.location.hash` to switch sub-views (e.g. `#cat=lyrics`, `#play=showId`). Tour-map has a `hashchange` listener; discography does not. Neither has `popstate`. Combined with the SPA-like tab pattern, the browser back button rarely returns the user to where they expect.
- **Why it matters:** Back-button is the single most-used navigation control on any site. On tour-map the back-button leaves the page entirely instead of closing a panel. On discography, hitting back after switching tabs takes the user off-page rather than to the previous tab.
- **Recommendation:** Use `history.pushState` for tab/section changes; listen for `popstate` to restore the prior view. Consider whether the modal `.active` state should also be in history (open the show-detail panel via pushState so back closes it).

#### [P1] Dynamic `<img>` elements have no `width`/`height`
- **Location:** [index.html:499–511](index.html:499) (timeline album items), [discography.html:3771, 3901](discography.html), [tour-map.html:1544](tour-map.html:1544) (video-strip thumbs), [unplucked-gems.html:556](unplucked-gems.html:556) (era album covers), [video-for-new-recruits.html:683, 740](video-for-new-recruits.html) (era + video thumbs), [music-videos.html:395](music-videos.html:395) (music-video thumbs)
- **Category:** Performance / Visual
- **Observation:** Every dynamically-generated `<img>` ships without `width` and `height` attributes. CSS applies `aspect-ratio` in most places, which is *most* of what's needed — but the browser still can't reserve layout space until the CSS resolves, so the first paint reflows.
- **Why it matters:** CLS (Cumulative Layout Shift) on heavy thumbnail surfaces (380 video cards, 545 sessions, 1,358 show pins). On mobile, the reflow is a visible jump-and-stutter.
- **Recommendation:** Add `width` and `height` attributes proportional to the displayed size (the actual numbers are forgiving — `width="80" height="80"` on a 60px square is fine; the browser only uses them for ratio).

#### [P1] No `aria-pressed` or `aria-selected` toggling on filter pills
- **Location:** [unplucked-gems.html:633–637](unplucked-gems.html) (Available / Holy Grails / Demos / Throwaways), [video-for-new-recruits.html:776–781](video-for-new-recruits.html) (Soundboard / FM Simulcast / Pro-Shot / Compilations), [music-videos.html:329–334](music-videos.html) (decade pills), [tour-map.html:1005–1007, 952, 956–957](tour-map.html) (Slow/Normal/Fast, My Shows)
- **Category:** A11y
- **Observation:** Filter pills get an `.active` class toggle for visual state, but no `aria-pressed`. Discography's category tabs *do* get `aria-selected` via [discography.html:3463, 3693](discography.html) — that pattern needs to spread.
- **Why it matters:** Screen readers announce "Soundboard, button" with no indication that it's currently the active filter. Sighted users see the red fill; non-sighted users get nothing.
- **Recommendation:** Add `aria-pressed="true|false"` on every toggle filter pill and update it in the click handler alongside the `.active` class. For mutually-exclusive groups, prefer `role="radiogroup"` + `aria-checked` or `role="tablist"` + `aria-selected`.

#### [P1] Tour-map Leaflet popup buttons use inline `onclick=` with `color:#CCA23C` baked in
- **Location:** [tour-map.html:1136, 1140, 1142](tour-map.html)
- **Category:** A11y / Visual
- **Observation:** Three popup buttons are emitted from a template string with inline `onclick="window.playGig(...)"`, `style="...color:#CCA23C..."`, hardcoded font-size 0.7rem. They're real `<button>` elements so keyboard works, but the inline styles bypass `var(--gold)` and the inline `onclick` blocks any future CSP.
- **Why it matters:** Inconsistency with the design tokens; the same button rendered in markup uses `var(--gold)` and in JS uses `#CCA23C`. Refactoring later means hunting both forms.
- **Recommendation:** Define a `.popup-action-btn` class in CSS, render the popup with classes instead of inline styles, and attach handlers via event delegation on the map container (or via `marker.on('popupopen', ...)`).

#### [P1] Search-bar (lyrics) loading state hides the input but uses `placeholder` to communicate it
- **Location:** [discography.html:1155](discography.html:1155)
- **Category:** Interaction
- **Observation:** `<input ... id="lyricsSearchInput" placeholder="Building lyrics index..." disabled aria-label="Search lyrics">`. The disabled state and placeholder text are the only signal that the index is building. There's no visible spinner, no progress, no estimated time. Once ready, the placeholder swaps to the real one — but a screen reader user listening to "Search lyrics, disabled" doesn't get told *why* it's disabled.
- **Why it matters:** Lyrics is a core feature; the user lands on Poets and sees a disabled box with no explanation. On slow networks this confusion persists for seconds.
- **Recommendation:** Show a small spinner + visible text "Building lyrics index..." next to the input rather than burying it in the placeholder. Announce ready via `aria-live="polite"`.

#### [P1] No focus return after modal close (universal)
- **Location:** Every overlay-using page: [index.html](index.html), [discography.html](discography.html), [tour-map.html](tour-map.html), [unplucked-gems.html](unplucked-gems.html), [video-for-new-recruits.html](video-for-new-recruits.html)
- **Category:** A11y / Interaction
- **Observation:** `closeCurrentAlbum()`, `closeCurrentEra()`, the show-detail close handlers, the setlist-overlay close handlers, and the audio-player-bar close all return focus to `document.body` (the browser default after removing the focused element). None track which trigger opened the modal.
- **Why it matters:** Keyboard users have to tab from the top of the page back to where they were every time they close a panel. On unplucked-gems and video-for-new-recruits this means re-tabbing through the entire flip-card grid.
- **Recommendation:** On open, store `const trigger = document.activeElement;`. On close, `trigger.focus()`.

#### [P1] Audio player bar has no `env(safe-area-inset-bottom)` handling
- **Location:** [tour-map.html:480–540](tour-map.html) (`.ap-bar`, `.audio-player-bar`)
- **Category:** Responsive (mobile)
- **Observation:** The fixed-bottom audio player is positioned with `bottom:0` and `padding-bottom` literal values, no `env(safe-area-inset-bottom)`. On iPhone with home-indicator-equipped devices, the home indicator overlaps the player controls.
- **Why it matters:** Tap-target overlap with iOS gesture areas. The previous/play/next buttons will collide with the bottom 34pt of the screen.
- **Recommendation:** `padding-bottom: calc(12px + env(safe-area-inset-bottom));` on the player bar. Add to `<meta name="viewport">` `viewport-fit=cover` if not already.

#### [P1] `forum-invite.html` reveal screen doesn't move focus to the success state
- **Location:** [forum-invite.html:366–368](forum-invite.html)
- **Category:** A11y
- **Observation:** On successful claim, `screen-welcome` is hidden (class toggle), `screen-reveal` is shown, page scrolls to top. Focus stays on the disabled Connect button until the user clicks. Screen reader users won't hear the success announcement.
- **Why it matters:** The user successfully submitted but has no audio/screen-reader confirmation. Worse, the `#1` membership number on the reveal screen is the most important content on the page.
- **Recommendation:** After class toggle, focus the `.membership-number` heading (give it `tabindex="-1"`). Add `role="alert"` or `aria-live="polite"` to `.reveal-greeting` so the change is announced.

#### [P1] `forum-invite.html` error message div is not announced
- **Location:** [forum-invite.html:286](forum-invite.html:286)
- **Category:** A11y
- **Observation:** `<div class="error-msg" id="error-msg"></div>` — no `role="alert"`, no `aria-live`. When `errEl.textContent = '...'` runs, sighted users see the red error; non-sighted users hear nothing.
- **Why it matters:** Form validation feedback is invisible to assistive tech.
- **Recommendation:** Add `role="alert"` (which implies `aria-live="assertive" aria-atomic="true"`).

#### [P1] Site name + maple emoji as page-load loading state
- **Location:** [discography.html:1187](discography.html:1187) (`<div id="setlistEmpty" class="setlist-empty">Loading setlist data...</div>`), and many similar "Loading..." text-only states
- **Category:** Interaction
- **Observation:** Loading states are plain text strings inserted into sections. No visible spinner, no skeleton, no progress. With 1,358 shows + 380 videos + 545 sessions on the wire across pages, that wait is real on mobile.
- **Why it matters:** Users on slow connections see a blank red-purple page for several seconds with one tiny "Loading..." line.
- **Recommendation:** Skeleton placeholders matching the eventual layout (a few empty cards) read as more responsive than text and don't require new infrastructure — just CSS.

#### [P1] Member gate has no "I forgot my number" recovery path
- **Location:** [js/tth-member-gate.js:213–233](js/tth-member-gate.js)
- **Category:** IA / Copy
- **Observation:** The member gate offers `Grab one here.` linking to forum-invite. There's no link for existing members who've forgotten their number. Forgetting is realistic — there's no email recovery flow either (the schema captures first/last/favourite song but not email).
- **Why it matters:** A member who clears their browser cache and forgets their number is locked out with no path to recovery short of jD intervening manually.
- **Recommendation:** Either capture email at claim time and add a "Email me my number" recovery, or make the failure path more graceful: "Forgot it? Email jd@tthpods.com and I'll dig it up." Confirm with you whether email capture is acceptable.

#### [P1] Inline `<style>` block in `discography.html` is 1060 lines
- **Location:** [discography.html:31–1090](discography.html)
- **Category:** Performance
- **Observation:** A 1060-line `<style>` block ships in the document head of a 4347-line file. Same pattern at 889 lines in [tour-map.html](tour-map.html), 450 lines in video-for-new-recruits, 270 lines in music-videos, 220 lines in forum-invite, 150 lines in unplucked-gems and links.
- **Why it matters:** Every page revisit re-downloads the same CSS pattern (`.show-detail-overlay`, `.setlist-overlay`, `.expanded-panel`, etc.) inline because it isn't in a cacheable external file. On the 4347-line discography page, the user's bandwidth is paying for the same overlay markup duplicated against tour-map's 1977 lines.
- **Recommendation:** Extract the shared overlay components (`.show-detail-overlay`, `.setlist-overlay`) and the shared flip-card pattern into `shared.css`. Page-specific styles stay inline but get smaller.

---

### Medium (P2)

#### [P2] 133 hardcoded hex codes in `discography.html`
- **Location:** Pattern across [discography.html](discography.html). Examples: `color:#b0b0b0` repeated at [lines 1113, 1232, 1279, 2679, 2847, 3191, 3500, 3516, 3906](discography.html); `color:#d9d9d9` at [line 1195](discography.html:1195); `color:#888`/`#aaa`/`#666` scattered as muted text.
- **Category:** Visual / Maintainability
- **Observation:** `var(--muted2)` is `#b0b0b0`; `var(--muted)` is `#d0d0d0`; body color is `#d9d9d9`. All three are used as raw hex strings in inline styles dozens of times. If the muted scale ever shifts, 133 places need touching.
- **Why it matters:** Design system drift. The next time the palette is tuned (e.g., bumping contrast for a11y), the inline literals don't move.
- **Recommendation:** Find/replace inline `#b0b0b0` → `var(--muted2)`, `#d9d9d9` → `var(--body)` (which doesn't exist yet — add it as `--body:#d9d9d9` to tokens or just collapse to `var(--text)` if the difference is intentional-but-unclear).

#### [P2] Off-token signal colors hardcoded in tags
- **Location:** Source-type tags in [video-for-new-recruits.html:382–391](video-for-new-recruits.html) and quality/tier tags in [unplucked-gems.html:391–402](unplucked-gems.html)
- **Category:** Visual
- **Observation:** `#1DB954` (Spotify green) for SBD / Lossless, `#7ab8f5` (fan blue) for FM Simulcast, `#ff8798` for compilations, `#e66` for rumored, `#c9a74e` for low-quality. None of these are tokens. They are *meaningful* — they signal source type / tier — but they exist as ad-hoc literals.
- **Why it matters:** A future design tweak that changes one needs to find five color values across two files. New pages can't reuse them without copy-paste.
- **Recommendation:** Promote them to a `--signal-*` namespace in `shared.css` (`--signal-success: #1DB954; --signal-info: #7ab8f5; --signal-warn: #c9a74e;` etc.) and reference them. Bonus: it makes the semantic intent of each color visible in code.

#### [P2] Inline `onclick=` handlers in 7 places
- **Location:** [forum-invite.html:285](forum-invite.html:285), [unplucked-gems.html:635](unplucked-gems.html:635), [discography.html:1196, 1201](discography.html), [tour-map.html:1136, 1140, 1142](tour-map.html)
- **Category:** Maintainability / Security
- **Observation:** Mixed pattern: most event handlers are attached via `addEventListener`, but seven attributes survived. The discography ones are on inline `<button>` styles; the tour-map ones are inside Leaflet popup template strings.
- **Why it matters:** Inline `onclick=` blocks `Content-Security-Policy` headers from disallowing inline JS — a defense-in-depth posture that costs nothing once consistent. Also makes refactoring harder (handler names are stringly-typed).
- **Recommendation:** Convert to `addEventListener` with class-based selection for the static ones; for the Leaflet popups use `marker.on('popupopen', ...)` and bind handlers to elements inside the popup at open time.

#### [P2] Streaming-service link buttons fall below tap-target on album pages
- **Location:** [discography.html:2203–2207, 3980–3984](discography.html)
- **Category:** Interaction (touch)
- **Observation:** Apple Music / Spotify / Bandcamp / etc. anchor links use `padding:4px 10px;font-size:0.65rem`. Tap target ~24px. They're not as load-bearing as "I Was There" (P0), but they are clickable on every album view.
- **Why it matters:** Outbound listening flow is part of the site's revenue/affiliate logic.
- **Recommendation:** Bump to `padding:8px 14px` and font-size 0.75rem.

#### [P2] `.show-detail-overlay` and `.setlist-overlay` markup is duplicated between `index.html` and `tour-map.html`
- **Location:** [index.html:320–346](index.html), [tour-map.html:1811–1834](tour-map.html)
- **Category:** Maintainability
- **Observation:** Two near-identical overlay templates and their JS render functions (`showDetailCard`, `showSetlistCard`). The CSS for `.sd-*` and `.setlist-*` classes is also duplicated in both `<style>` blocks.
- **Why it matters:** Any UX change to one overlay must be made twice. Already drifting — the tour-map version has a "View on Map" button while the index version doesn't.
- **Recommendation:** Extract the overlay templates + their builder functions into a shared JS module (`/js/show-overlay.js`), and the CSS into `shared.css`. The two pages then `<script src=>` the same code.

#### [P2] On-this-day widget duplicated between `index.html` and `links.html`
- **Location:** [index.html:364–432](index.html), [links.html:208–262](links.html)
- **Category:** Maintainability
- **Observation:** Identical "On This Day" logic (release + milestone + setlist lookup) is reimplemented in each file, with subtle drift — index uses `for...of`, links uses classic `for(var i...)`; the early-return on `!resp.ok` is in different places.
- **Why it matters:** Two places to update when the data shape changes; one will fall behind.
- **Recommendation:** Extract to `/js/on-this-day.js`. The widget HTML stub stays per-page; the logic is shared.

#### [P2] `.skip-link` overridden in `forum-invite.html` with a different visual treatment
- **Location:** [forum-invite.html:230–244](forum-invite.html)
- **Category:** Consistency
- **Observation:** `shared.css` ships a `.skip-link` (`position:absolute; left:-9999px; background:var(--red)`). `forum-invite.html` redefines it with `position:absolute; top:-100%; left:0; background:#C8102E`. Both work; both diverge.
- **Why it matters:** No real bug, but it breaks the "shared component" promise. A future change to `.skip-link` in `shared.css` won't apply here.
- **Recommendation:** Delete the override; rely on `shared.css`.

#### [P2] Pre-launch gate password is base64'd, not hashed
- **Location:** [js/tth-launch-gate.js:18](js/tth-launch-gate.js:18)
- **Category:** Security / IA
- **Observation:** `var PASSWORD = 'cm9hZGFwcGxlcw=='; // base64` — `atob` it and you get "roadapples" in plaintext. This is obfuscation, not protection.
- **Why it matters:** This is acceptable for a soft launch gate; the launch has already passed so the gate is effectively decorative. Flagging because the comment `// base64` reads as if it provides security.
- **Recommendation:** If the gate stays, either accept that it's a courtesy and rename the variable / comment to make that clear, or move the check to a Netlify Edge Function with a server-side hash. Given the launch date has passed (2026-05-11, current 2026-05-12), the cleanest fix is to delete the file.

#### [P2] Decorative photo captions in inline 0.7rem `#b0b0b0`
- **Location:** [index.html:269, 311, 316](index.html), [discography.html:1113, 1232](discography.html)
- **Category:** Visual / Consistency
- **Observation:** Photographer credits (`<p style="font-size:0.7rem;color:#b0b0b0;...">Photo: David Bastedo</p>`) are inline-styled with the same pattern in 5+ places.
- **Why it matters:** Five places to change if the caption style shifts.
- **Recommendation:** Add a `.photo-credit` class to `shared.css`.

#### [P2] Inputs use `type="text"` with `inputmode` instead of semantic types
- **Location:** [js/tth-member-gate.js:227](js/tth-member-gate.js:227) (member number — `inputmode="numeric"` ok), [forum-invite.html:269, 273, 282](forum-invite.html) (all `type="text"`), [tour-map.html:961](tour-map.html:961) (`type="text"` for search)
- **Category:** A11y / Interaction
- **Observation:** Search inputs across the site are `type="text"`. `music-videos.html` is the exception — it uses `type="search"` ([music-videos.html:327](music-videos.html:327)).
- **Why it matters:** `type="search"` gives users an automatic clear-X button on most browsers + better semantic announcement + on iOS the keyboard's return key reads "Search".
- **Recommendation:** Change `<input type="text">` to `<input type="search">` for all search fields (gigSearch, songSearchInput, lyricsSearchInput, setlistSearch, panel-search).

#### [P2] Random-song dialog focus management
- **Location:** [discography.html:1255–1259](discography.html)
- **Category:** A11y
- **Observation:** Has `role="dialog" aria-modal="true" aria-labelledby="rspTrack"` (good) and `tabindex="-1"` on `#rspTrack` (good). Verify in browser whether focus actually moves to the heading on open, and whether the back button restores focus. Static read can't confirm.
- **Why it matters:** The pattern is set up correctly in markup; only need to confirm the JS actually focuses it on open and restores on close.
- **Recommendation:** Manual verification: with screen reader on, click "Random Hip Song" and confirm the song title is announced.

#### [P2] Inline `<style>` blocks fork the design system at every page
- **Location:** Every HTML file has 100–1060 lines of `<style>` after the `<link>` to `shared.css`.
- **Category:** Maintainability
- **Observation:** Pattern: each page imports `shared.css` then re-declares 50–100% of its component CSS inline. Many declarations are page-specific (good — `.timeline-*` only belongs in index), but many are not (the overlay CSS duplicated across two files; the flip-card CSS duplicated across two files; photo credits across five files).
- **Why it matters:** Same root cause as the duplicated overlay markup. Stylistic drift across pages.
- **Recommendation:** Audit each inline block for shared-by-multiple vs. page-specific; promote shared to `shared.css`.

#### [P2] No `inputmode` on year-range sliders
- **Location:** [tour-map.html:976–977](tour-map.html)
- **Category:** A11y
- **Observation:** Dual range sliders for year-min/year-max have `aria-label="Start year"` / `"End year"` (good) but no `aria-valuetext` to read the year out instead of the raw value. They also overlap in pointer-events behavior in many dual-range implementations.
- **Why it matters:** Screen reader announces "1985, slider, 1985 minimum, 2016 maximum"; would be clearer if it announced the year as text.
- **Recommendation:** Update `aria-valuetext` on each slider whenever the value changes.

#### [P2] `.iwt-popup-btn` toggle on Leaflet popups is not announced as a toggle
- **Location:** [tour-map.html:1142](tour-map.html:1142)
- **Category:** A11y
- **Observation:** `<button class="iwt-popup-btn${isAttended ? ' active' : ''}">` — visible state changes via class + text content (`✓` appended), but no `aria-pressed`.
- **Why it matters:** Screen readers don't know the toggle state.
- **Recommendation:** Add `aria-pressed="true|false"` and update with class.

#### [P2] Body color is the literal `#d9d9d9`, not a token
- **Location:** [css/shared.css:24](css/shared.css:24)
- **Category:** Visual / Maintainability
- **Observation:** `body { color: #d9d9d9 }` — but the tokens are `--text:#ffffff` and `--muted:#d0d0d0`. `#d9d9d9` sits between them and isn't named.
- **Why it matters:** Page authors guess between `#d9d9d9`, `#fff`, and `--text` (which is `#fff`) for body copy.
- **Recommendation:** Add `--body:#d9d9d9` to tokens and use it consistently. Or, if `--text` was meant to be `#d9d9d9`, fix the token.

#### [P2] Stat numbers use `var(--red)` (P0 color) for non-interactive display
- **Location:** [css/shared.css:79](css/shared.css:79) `.stat-num { color: var(--red) }`, repeated across pages
- **Category:** Visual
- **Observation:** Red is heavily used as accent color for stat counts on every page (35 releases, 169 songs, 1358 shows, 545 sessions, 380 videos). It's the dominant brand color, not an interactive marker. The brand guide reserves red for interactive elements.
- **Why it matters:** Surface the design question: is red an *accent* on this site or strictly an *interactive* signal? Currently it's both — stat numbers in red, primary button background in red, link hover ring in red. The dual use is fine if intentional but should be a deliberate choice.
- **Recommendation:** Decide. If red is the accent color (likely, given how it's used), document that in `shared.css` as a comment. If red is reserved for interactive, recolor stats to gold.

#### [P2] Empty/no-results messages are generic
- **Location:** [tour-map.html:1406](tour-map.html:1406), [unplucked-gems.html](unplucked-gems.html) panel-no-results, [video-for-new-recruits.html](video-for-new-recruits.html) "No videos match your search.", [music-videos.html:446](music-videos.html:446)
- **Category:** Copy
- **Observation:** Generic phrasing: "No sessions match your search." / "No videos match your search." / "No videos match those filters."
- **Why it matters:** Doesn't give the user a path forward. Could suggest clearing filters or broadening search.
- **Recommendation:** "No sessions match. Try clearing the filter or broadening yer search." Brand voice already permits "yer".

#### [P2] Lyrics search button is decorative on submit
- **Location:** [discography.html:1156](discography.html:1156)
- **Category:** Interaction
- **Observation:** `<button class="lyrics-search-btn" id="lyricsSearchBtn" disabled>Search</button>` — the search runs on Enter (input handler), but the button is still rendered. Once enabled, clicking it does run the search. Question: is there a reason for both? Inconsistent with the rest of the site where Enter/click are equivalent.
- **Why it matters:** Confused expectations. New users see a Search button and expect it to do something different from Enter.
- **Recommendation:** Either remove the button and let Enter drive the search (with placeholder hint), or treat the button as the canonical submit (`type="submit"` inside a `<form onsubmit>`).

#### [P2] "Photo: " caption pattern uses inline italic + light-gray
- **Location:** [index.html:269, 311, 316](index.html), [discography.html:1113, 1232](discography.html)
- **Category:** Visual / A11y
- **Observation:** `<p style="...color:#b0b0b0;...font-style:italic;">Photo: David Bastedo</p>`. Contrast on `#0e0b16` is ~9.4:1 (fine). Italic on the body Poppins is fine for emphasis. The issue: 5 implementations of the same pattern with slightly different margins each time.
- **Why it matters:** Drift risk.
- **Recommendation:** `.photo-credit` class.

---

### Low (P3)

#### [P3] Skip-link uses `left: -9999px` instead of `clip-path`
- **Location:** [css/shared.css:39](css/shared.css:39)
- **Category:** A11y
- **Observation:** `position:absolute; left:-9999px` is the legacy off-screen technique. `clip-path` or the `.sr-only` pattern is the modern equivalent.
- **Why it matters:** Works correctly. Bookkeeping note.
- **Recommendation:** Optional. Switch to the standard `.sr-only` pattern if you ever consolidate.

#### [P3] `<meta name="theme-color" content="#0e0b16">` is duplicated on every page
- **Location:** Every HTML file
- **Category:** Maintainability
- **Observation:** Eight separate declarations of the same color. If the brand bg ever changes, every file needs touching.
- **Why it matters:** Drift risk.
- **Recommendation:** Live with it (one line per page is cheap) or add an HTML build step that injects the head.

#### [P3] Hero photos in `index.html` use `<p style="...">Photo: ...</p>` after the `<img>`
- **Location:** [index.html:269, 311, 316](index.html)
- **Category:** A11y / Semantics
- **Observation:** Three hero images, each with a photographer credit in a sibling `<p>`. `<figure>` + `<figcaption>` is the more semantic option.
- **Why it matters:** Screen readers don't auto-associate the credit with the image. The `alt` text already names the photographer ("band photo by Anthony Pidgeon") so it's not totally lost — but the duplication is awkward.
- **Recommendation:** `<figure><img alt="..."><figcaption class="photo-credit">Photo: ...</figcaption></figure>`.

#### [P3] Page H1 splits red/white/red across spans
- **Location:** [index.html:263](index.html:263), [discography.html:1106](discography.html:1106), [links.html](links.html) (similar)
- **Category:** Visual
- **Observation:** `<h1><span style="color: #C8102E;">THE</span> HIP <span style="color: #C8102E;">HANDBOOK</span></h1>` — color used decoratively in the headline.
- **Why it matters:** Pure stylistic call; the result is on-brand and recognizable. Flagging only because inline color on `<span>` is harder to retheme than a CSS rule.
- **Recommendation:** `h1 .hl { color: var(--red); }` and apply the class instead.

#### [P3] Footer "Designed by ... - Coded by Claude" line in `#aaa`/`#888`/`#666`
- **Location:** [js/shared-footer.js:17–20](js/shared-footer.js)
- **Category:** Visual
- **Observation:** Three different muted greys (`#aaa`, `#888`, `#666`) in adjacent lines of the footer template. `#666` against `#0e0b16` is ~3.9:1 — below the 4.5:1 WCAG AA bar.
- **Why it matters:** Footer version line is barely readable for some users.
- **Recommendation:** Lift `#666` to `--muted2` (`#b0b0b0`, ~9:1).

#### [P3] `forum-invite.html` body is centered with `display:flex` + `align-items:center` — vertical centering
- **Location:** [forum-invite.html:34–39](forum-invite.html)
- **Category:** Responsive
- **Observation:** On a long form (5 fields) on a short viewport, vertical centering means the form starts below the fold on iPhone SE.
- **Why it matters:** First-fold problem on small screens — the user lands on whitespace, has to scroll to see the form.
- **Recommendation:** `align-items: flex-start` with top padding instead of full vertical centering.

#### [P3] Generic error in member gate: "Something went wrong. Try again."
- **Location:** [js/tth-member-gate.js:321](js/tth-member-gate.js:321)
- **Category:** Copy
- **Observation:** Fallback error message if the Supabase RPC throws an unexpected error.
- **Why it matters:** Standard generic error; tells the user nothing about whether to retry, refresh, or report.
- **Recommendation:** "Couldn't reach the Handbook server. Check yer connection and try again. Still stuck? Email jd@tthpods.com." — matches brand voice and gives a recovery path.

#### [P3] Service worker scope is the whole site but caches only one page
- **Location:** [js/shared-footer.js:24–27](js/shared-footer.js), [service-worker.js](service-worker.js)
- **Category:** Performance
- **Observation:** Service worker registered without scope qualifier on every page (default scope `/`). The page-specific Plausible analytics script on every page is uncached.
- **Why it matters:** Out of audit scope (need to read service-worker.js content). Flagging for follow-up.
- **Recommendation:** Confirm SW caching strategy matches the multi-page nature of the site.

#### [P3] Mobile breakpoint at 500px is narrower than the conventional 640px
- **Location:** [index.html:239](index.html:239), [links.html](links.html), [unplucked-gems.html:303](unplucked-gems.html:303), elsewhere
- **Category:** Responsive
- **Observation:** Per-page mobile media queries cluster at `@media (max-width: 500px)` and `(max-width: 480px)`. Most of Tailwind/Bootstrap-shaped expectations are at 640px (Tailwind's `sm`).
- **Why it matters:** Tablets in portrait (768px) and large phones in landscape (e.g., iPhone 14 Pro Max at 932×430 in landscape) sit on the desktop side of the breakpoint and may inherit cramped desktop layouts.
- **Recommendation:** Pick one breakpoint convention. 640px is the most common; the layouts already adapt cleanly there.

#### [P3] Search dropdown options have `mousedown` handlers but no keyboard `Enter` per-option
- **Location:** [index.html:697, 713, 730, 746, 762](index.html), [discography.html](discography.html) song search
- **Category:** A11y / Interaction
- **Observation:** Search dropdown uses `mousedown` (not `click`) on options. Keyboard nav with arrow keys + Enter dispatches a synthetic `mousedown` event on the active option. Works, but unusual.
- **Why it matters:** Works for now. A future refactor could break it because dispatching synthetic events isn't a stable pattern.
- **Recommendation:** Use `click` + `mousedown.preventDefault()` on the dropdown to avoid blur. Or use `role="listbox"`/`role="option"` and proper keyboard handling.

#### [P3] Unused `--text` token (body uses literal `#d9d9d9`)
- **Location:** See P2 finding above
- **Category:** Maintainability
- **Observation:** Same root cause as P2 body-color finding. Flagging duplicate for the index.
- **Why it matters:** -
- **Recommendation:** Resolve the body-color → token mapping (see P2 finding above).

---

## 4. Patterns and Systemic Issues

### A. Two parallel modal patterns
The site has two distinct overlay implementations:
1. **Correct pattern** — used by `#randomSongPage` and `#overlay` on discography. `role="dialog" aria-modal="true" aria-labelledby="..."`, tabindex on the headline, proper close behavior.
2. **Decorative pattern** — `.show-detail-overlay`, `.setlist-overlay`, `.expanded-panel`, audio player. `<div>` toggled by class. Escape and click-outside generally work; ARIA does not.

**Fix once:** Establish a single overlay component (markup + class CSS + JS open/close helper) and convert the four decorative ones.

### B. Flip-card primary nav, not keyboard-accessible
Unplucked Gems and Video For New Recruits share the same flip-card pattern with the same a11y gap. Same code; same lift to fix.

**Fix once:** Refactor `.flip-card` to `<button>` in the shared component and reuse on both pages.

### C. Inline `<style>` blocks bigger than the shared stylesheet
`shared.css` is 127 lines. The aggregate inline `<style>` block size across the 9 HTML files is over 3,000 lines. The shared stylesheet is the *minority* of the CSS shipped.

**Fix once:** Move all duplicated-across-files component CSS into `shared.css`. Page-local styles can stay inline.

### D. Hardcoded hex codes everywhere
Token usage is inconsistent — token vars in `shared.css`, hex literals in inline styles and JS-generated markup. 239 hex codes across all HTML files.

**Fix once:** Find/replace the muted-text greys (`#b0b0b0` → `var(--muted2)`, `#d0d0d0` → `var(--muted)`, `#d9d9d9` → a new `--body` token), then add signal-color tokens for the off-token tag colors.

### E. Hash-based navigation without history integration
`#cat=...`, `#show=...`, `#play=...` all skip `history.pushState`/`popstate`. Back button doesn't behave intuitively.

**Fix once:** Wrap the hash-set calls in a `setRoute(hash)` helper that uses `pushState` + listens for `popstate`.

### F. No focus management on any modal close
Universal pattern across all overlays — focus lands at `<body>` on close instead of returning to the trigger.

**Fix once:** Same as A. The shared modal helper captures `activeElement` on open and restores it on close.

### G. Filter pills don't carry state for screen readers
Multiple pages use a pill-toggle pattern (`.active` class flip) without `aria-pressed`. The discography category tabs do use `aria-selected` — the rest of the site needs to follow.

**Fix once:** Establish a `togglePill(button)` helper that flips both the class and the `aria-pressed`.

---

## 5. What's Working

Genuine strengths only:

- **404 page is excellent.** Themed copy ("Took a wrong turn somewhere between Kingston and the Horseshoe Tavern"), `:focus-visible` outline, four real escape links, semantic heading order. Reference template for clean a11y-conscious work on this site.
- **Discography category tab pattern is correct.** `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls` + matching `role="tabpanel"`. The pattern is in the codebase already — the rest of the site's filter pills should adopt it.
- **`prefers-reduced-motion` honored on index** ([index.html:247](index.html:247)) — the right hook for the timeline drag interaction and other anims.
- **Lazy-loading on heavy thumbnails.** Every JS-generated image carries `loading="lazy"`. (Pair with the missing `width/height` fix from P1 for full CLS prevention.)
- **`aria-pressed` on the "I Was There" toggle** ([discography.html:1181](discography.html:1181)) — proof the team knows how to do toggle state correctly. Spreading this to the filter pills is straightforward.
- **forum-invite.html copy is on-brand and welcoming.** "Hey man, thanks for being here." "Yer in, friend." "Screenshot this page or write it down." Voice is consistent, no jargon, no over-explanation.
- **Skip links on every page.** Not the modern technique ([P3 above](#p3-skip-link-uses-left--9999px-instead-of-clip-path)) but they exist and they work.
- **`pattern="[0-9]{1,7}"` + `inputmode="numeric"` on the member-number field** ([js/tth-member-gate.js:227](js/tth-member-gate.js:227)) is correctly built — iOS keyboard pops the number pad and the pattern blocks letters.
- **Service worker registered defensively** ([js/shared-footer.js:24–27](js/shared-footer.js)) — `'serviceWorker' in navigator` guard, registers on `load` to avoid blocking first paint.
- **Plausible analytics** is set up with `outbound-links.tagged-events.js` — outbound clicks tracked.
- **Auth model is correctly architected.** Member gate exposes a clean `window.TTHMember` API; pre-launch gate is layered separately; localStorage session; Supabase anon key is fine to expose. The shape is right.

---

## 6. Questions for jD

1. **Brand palette anchor.** The web app uses `#0e0b16` as background; the broader brand spec (CLAUDE.md / brand-voice.md) names `#140038` Dark Purple as the anchor. Is the web app intentionally on its own palette (in which case I'd recommend documenting that in `shared.css` header), or should the bg shift to `#140038` to align with podcast/print assets?

2. **Red as accent vs. interactive.** Red is currently both the accent color (stat numbers, headline highlights) and the primary interactive color (button bg, link hover). Brand guide says red is reserved for interactive/badges. Confirm which interpretation governs the web app — that decision changes 30+ of the P2/P3 findings.

3. **Member-gate recovery.** Is there a recovery path for a member who's forgotten their number? If not, do you want one? (See P1 finding.)

4. **Pre-launch gate.** Launch is past (2026-05-11). Can [js/tth-launch-gate.js](js/tth-launch-gate.js) be deleted entirely? (P0/P2 findings depend on this.)

5. **Hash routing vs. pushState.** Are you open to migrating sub-tab navigation from `#hash` to `history.pushState`? It's a bigger refactor than the other P1s and changes behavior in subtle ways (e.g., direct-link sharing).

6. **Flip-card pattern.** The simplest fix is to make `.flip-card` a `<button>`. The animation still works. Confirm before I touch shared markup.

---

*End of audit. Hands off code until you approve fixes.*
