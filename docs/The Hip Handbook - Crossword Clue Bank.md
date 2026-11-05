# The Hip Handbook - Crossword Clue Bank (Words Into Birds)

Answers and clues for the weekly crossword. Each puzzle uses exactly 20. The puzzles themselves live in `data/bird-puzzles.json`; this file says where each clue's fact comes from and what is waiting in the bank. When a banked clue goes into a puzzle, move it to that puzzle's list so you can see when it was last used. Answers can be recycled, but not within a month: an answer can come back 5 or more puzzles after its last use (jD, November 5, 2026). `audit-site.js` and the grid builder both stop anything sooner.

Status: "Site data" means the fact is in the Handbook's own data files. "jD" means it came from jD. "Needs jD" means don't ship it until he confirms.

Size: a puzzle's 20 answers need to add up to about 170 letters or fewer, or the grid won't fit 15 squares wide. `node scripts/build-bird-grids.js` says when one doesn't fit.

## Puzzles drafted (not open yet, so all of these can still change)

Every clue below is from the site data unless it says otherwise. Sources: Top 40 ranks, producers, studios, Junos and solo records from `js/discography-app.js`; release dates, track lists and milestones from `data/discography.json`; tours and venue counts ("by the Handbook's count") from `data/tth-tour-data.json`; podcast facts from `data/podcast-shows.json`.

**Puzzle 1** (the mockup grid): GRACETOO, BOBCAYGEON, ABACUS, SIRIUSXM, LEGROS, ROADAPPLES, PHANTOMPOWER, BOBROCK, DONSMITH, BATHOUSE, JAKEGOLD, BILLYRAY, SINCLAIR, LANGLOIS, BAKER, FAY, SECRETPATH, KINGSTON, HORSESHOE, ROADSIDE.
- jD: JAKEGOLD ("Longtime manager of The Hip"), confirmed by jD on November 5, 2026. The site data only has him on The Tragically Hip Interview Series.
- jD: BILLYRAY (Dave Koster, stage manager, title from Jake Gold via jD, November 5, 2026).
- HORSESHOE also names GEDfest Toronto 2026, from the shared rules.

**Puzzle 2** (167 letters, 14 wide): LIONIZED, UPTOHERE, MEMPHIS, OPIATED, TSANGARIDES, BAHAMAS, ADAMKASPER, GAVINBROWN, HARMER, COBOARENA, MASSEYHALL, HALIFAX, DAYFORNIGHT, AWAYISMINE, NORTHEY, MARCHICA, ALS, FIREWORKS, LITTLEBONES, KINGSWAY.
- DAYFORNIGHT is clued as the tour (101 shows in the show list), not the album.
- MEMPHIS and OPIATED dodge naming "Up to Here", since UPTOHERE is in the same grid.

**Puzzle 3** (161 letters, 15 wide): COURAGE, GIFTSHOP, POETS, FLAMENCO, HENHOUSE, MUSICATWORK, WORLDCONTAINER, HUGHPADGHAM, BATH, STEVEBERLIN, KEVINDREW, ROXY, CLEVELAND, AUSTIN, COPPS, LUSTREPARFAIT, LYDEN, CBC, GUESSWHAT, FIRSTAVENUE.
- MUSICATWORK: the clue says the title is written with an at-sign.

**Puzzle 4** (164 letters, 15 wide): WHEATKINGS, CORDELIA, THREEPISTOLS, LAKEFEVER, SCARED, TWISTMYARM, DAREDEVIL, ELDORADO, SASKADELPHIA, METRO, NOWFORPLANA, KENGREER, VREEKEN, COMMODORE, TIVOLI, PHOENIX, KIRKLANE, STLOUIS, JUNO, HAMILTON.
- HAMILTON names Theatre Aquarius, from the shared rules (the musical's premiere).

## Banked

| Answer | Letters | Clue | Type | Status | Source |
|---|---|---|---|---|---|
| WELLINGTON | 10 | Ricky ___, head of security for The Hip | Crew | jD | jD, November 5, 2026 |
| RICKY | 5 | First name of The Hip's head of security, Mr. Wellington | Crew | jD | jD, November 5, 2026 (use one of RICKY or WELLINGTON per puzzle, not both) |
| HOUSEOFBLUES | 5, 2, 5 | Venue name that turns up most in the Handbook's show list: 48 shows in 12 cities | Venue | Site data | data/tth-tour-data.json |
| AHEADBYACENTURY | 5, 2, 1, 7 | Number Two in The Tragically Hip Top Forty Countdown | Top 40 | Site data | js/discography-app.js (15 letters: hard to fit) |
| BLOWATHIGHDOUGH | 4, 2, 4, 5 | Number Six in The Tragically Hip Top Forty Countdown, and the opening track on "Up to Here" | Top 40 | Site data | js/discography-app.js (15 letters: hard to fit) |
| COMPASSPOINT | 7, 5 | ___ Studios, in the Bahamas, where "In Violet Light" was recorded | Studio | Site data | js/discography-app.js (not with BAHAMAS) |
| GREASYJUNGLE | 6, 6 | Third track on "Day for Night" | Song | Site data | data/discography.json |
| INVIOLETLIGHT | 2, 6, 5 | Album released June 11, 2002 | Release date | Site data | data/discography.json |
| MANMACHINEPOEM | 3, 7, 4 | Album released June 17, 2016 | Release date | Site data | data/discography.json |
| HALLOFFAME | 4, 2, 4 | The Hip went into the Canadian Music ___ at the Juno Awards in Winnipeg, April 3, 2005 | Milestone | Site data | data/discography.json |
| THEATREAQUARIUS | 7, 8 | Hamilton theatre where "It's a Good Life If You Don't Weaken" premiered | Podcast | Site data | data/podcast-shows.json and the shared rules (not with HAMILTON) |

## Clue types to draw from

Release dates, venues, songs, album titles, band members, people around the band (managers, producers, crew), tour names, Top 40 and podcast clues, musical instruments, and music ephemera (tickets, passes, setlists, posters).

Instrument and gear clues need jD's say-so: the site data only says Johnny Fay was "behind the kit".

Keep a clue from giving away another answer in the same grid (a clue that names "Up to Here" can't sit beside UPTOHERE).

The Tragically Hip Album Countdown launches January 4, 2027: no clue may name a record's place in it before that episode drops.
