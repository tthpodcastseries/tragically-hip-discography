# The Hip Handbook - Crossword Clue Bank (Words Into Birds)

Answers and clues for the weekly crossword. Each puzzle uses exactly 20. The puzzles themselves live in `data/bird-puzzles.json`; this file says where each clue's fact comes from and what is waiting in the bank. When a banked clue goes into a puzzle, move it to that puzzle's list so you can see when it was last used. Answers can be recycled, but not within a month: an answer can come back 5 or more puzzles after its last use (jD, November 5, 2026). `audit-site.js` and the grid builder both stop anything sooner.

Status: "Site data" means the fact is in the Handbook's own data files. "jD" means it came from jD. "Needs jD" means don't ship it until he confirms.

Size: a puzzle's 20 answers need to add up to about 170 letters or fewer, or the grid won't fit 15 squares wide. `node scripts/build-bird-grids.js` says when one doesn't fit.

## Puzzles drafted (not open yet, so all of these can still change)

**Approved by jD on November 5, 2026: Puzzles 1, 2 and 3.** Puzzles 4 to 15 are still waiting on his read-through (the vetting PDF is `docs/The Hip Handbook - New Games Puzzle Vetting.pdf`, on jD's Mac only).

Every clue below is from the site data unless it says otherwise. Sources: Top 40 ranks, producers, studios, Junos and solo records from `js/discography-app.js`; release dates, track lists and milestones from `data/discography.json`; tours and venue counts ("by the Handbook's count") from `data/tth-tour-data.json`; podcast facts from `data/podcast-shows.json`.

**Puzzle 1** (approved, the mockup grid): GRACETOO, BOBCAYGEON, ABACUS, SIRIUSXM, LEGROS, ROADAPPLES, PHANTOMPOWER, BOBROCK, DONSMITH, BATHOUSE, JAKEGOLD, BILLYRAY, SINCLAIR, LANGLOIS, BAKER, FAY, SECRETPATH, KINGSTON, HORSESHOE, ROADSIDE.
- jD: JAKEGOLD ("Longtime manager of The Hip"), confirmed by jD on November 5, 2026. The site data only has him on The Tragically Hip Interview Series.
- jD: BILLYRAY (Dave Koster, stage manager, title from Jake Gold via jD, November 5, 2026).
- HORSESHOE also names GEDfest Toronto 2026, from the shared rules.

**Puzzle 2** (approved, 167 letters, 14 wide): LIONIZED, UPTOHERE, MEMPHIS, OPIATED, TSANGARIDES, BAHAMAS, ADAMKASPER, GAVINBROWN, HARMER, COBOARENA, MASSEYHALL, HALIFAX, DAYFORNIGHT, AWAYISMINE, NORTHEY, MARCHICA, ALS, FIREWORKS, LITTLEBONES, KINGSWAY.
- DAYFORNIGHT is clued as the tour (101 shows in the show list), not the album.
- MEMPHIS and OPIATED dodge naming "Up to Here", since UPTOHERE is in the same grid.

**Puzzle 3** (approved, 161 letters, 15 wide): COURAGE, GIFTSHOP, POETS, FLAMENCO, HENHOUSE, MUSICATWORK, WORLDCONTAINER, HUGHPADGHAM, BATH, STEVEBERLIN, KEVINDREW, ROXY, CLEVELAND, AUSTIN, COPPS, LUSTREPARFAIT, LYDEN, CBC, GUESSWHAT, FIRSTAVENUE.
- MUSICATWORK: the clue says the title is written with an at-sign.

**Puzzle 4** (164 letters, 15 wide): WHEATKINGS, CORDELIA, THREEPISTOLS, LAKEFEVER, SCARED, TWISTMYARM, DAREDEVIL, ELDORADO, SASKADELPHIA, METRO, NOWFORPLANA, KENGREER, VREEKEN, COMMODORE, TIVOLI, PHOENIX, KIRKLANE, STLOUIS, JUNO, HAMILTON.
- HAMILTON names Theatre Aquarius, from the shared rules (the musical's premiere).

**Puzzle 5** (164 letters, Saturday, December 19, 2026): AHEADBYACENTURY, MEMBERSHIP, CHAGRINFALLS, HUSH, SHERPA, LEAVE, EMERGENCY, STAY, LOSLOBOS, MARKHOWARD, WAREHOUSE, FILLMORE, MOLSONPARK, COPPERPENNY, SADIES, CHING, MONDAY, AREWEFAMILY, ARTPARK, WINNIPEG.
- AREWEFAMILY is the song on "In Between Evolution", clued as the name of the Handbook's other weekly game (both drop the same Saturday).
- COPPERPENNY: the earliest show in `data/tth-tour-data.json`, February 27, 1985, Kingston.

**Puzzle 6** (163 letters, December 26): FIGHT, HOTMIC, MACHINE, MAUI, JENSEN, BILLBOARD, DETROIT, ABOUTTHISMAP, COMPLETISTS, SKELETONPARK, GRANDBOUNCE, DEUCE, NOTGUILTY, ORPHEUM, GROTEZAAL, SYRACUSE, PANEL, SONGWRITERS, THIRTEEN, CRAIGROGERS.
- HOTMIC and MACHINE say "The Hip's final studio album" instead of naming "Man Machine Poem", which would give MACHINE away.
- ABOUTTHISMAP: the Handbook's tour map page is named for it (`docs/The Hip Handbook - Overview.md`).
- MAUI calls it an island; the site data only says "Recorded in Toronto, Vancouver, and Maui".

**Puzzle 7** (167 letters, January 2, 2027): GREASYJUNGLE, INVIOLETLIGHT, WASHINGTON, BRUSSELS, LOSANGELES, HEKSENKETEL, FLY, PRETEND, HIPEPONYMOUS, TIGERTHELION, SHARKS, OUCH, EVELYN, MONTREAL, SEATTLE, HORDE, STRATFORD, THEPLAYERS, PODLIST, GEDFEST.
- HORDE is the H.O.R.D.E. festival (1996, Saratoga Springs), from the tour names. GEDFEST is from the shared rules (October 17, 2026, Horseshoe Tavern) and the network's specials feed.

**Puzzle 8** (167 letters, January 9, 2027): MANMACHINEPOEM, HALLOFFAME, HOUSEOFBLUES, WELLINGTON, CURTAINUP, GREATSOUL, PUTITOFF, COUNTRYDAY, THUGS, LUXURY, EDMONTON, LONDON, TORONTO, MEANSTREAK, USEITUP, NOTHREAT, BELGIQUE, YOUTUBE, FIFTEEN, ABACUS.
- jD: WELLINGTON (Ricky Wellington, head of security, jD, November 5, 2026).
- ABACUS comes back from Puzzle 1, seven weeks later: the first recycled answer, and allowed by the five-week rule.

**Puzzle 9** (165 letters, January 16, 2027): CAULDRON, LANOIS, CASSETTE, LAMOUREUX, BIGMUSICFEST, METROPOL, MISTYMOON, FAMILYBAND, PROMISING, THUNDERBAY, SAINTJOHN, LOUIS, REDUX, FLASHBACKS, DOBA, TAXIDANCERS, RADIOSHOW, WHATBLUE, KILLINGTIME, TIFF.
- Box sets, films and Junos come from the album notes in `js/discography-app.js` ("Heksenketel" is Dutch for "witch's cauldron"; the 1987 EP had seven tracks on cassette, eight on CD).
- FAMILYBAND names the Handbook's setlist explorer (`docs/The Hip Handbook - Overview.md`).

**Puzzle 10** (162 letters, January 23): BAICHWAL, DAVERUSSELL, PRIMEVIDEO, MACROSCOPIC, HOOFHEARTED, BUMBLEBEE, NEWRECRUITS, INVIEW, DESIGN, COREL, WETLANDS, SPOKANE, ODDS, BOTTRILL, WENJACK, AVERAGES, NEWORLEANS, SILVERJET, COFFEEGIRL, MAN.
- NEWRECRUITS and INVIEW name Handbook pages (the videos page and the Passport).

**Puzzle 11** (165 letters, January 30): FIREINTHEHOLE, SOMETHINGON, RULES, TRICKLEDOWN, ONTHEVERGE, DIREWOLF, OCEANNEXT, JUSTASWELL, NEWMAYBE, LUV, SASKATOON, TILBURG, RENFREW, ROTTERDAM, MIKEDOWNIE, CONQUERING, MERCURYSEA, TEN, RANDOM, THIRTY.

**Puzzle 12** (165 letters, February 6): BLOWATHIGHDOUGH, COMPASSPOINT, COCONUTCREAM, HONEYPLEASE, INSARNIA, MYSTERY, GROUP, VICTORIA, ROCHESTER, MARTYRS, AVALON, SADDLEDOME, PODUMENTARY, DISCOVERY, KINGSTON, ORBITROOM, BEAR, DUTCH, EIGHTH, SIX.
- KINGSTON comes back from Puzzle 1 with a new clue (Alfie's Pub).

**Puzzle 13** (162 letters, February 13, the day before Valentine's Day): LOVEISAFIRST, LETSSTAYENGAGED, BOOTSORHEARTS, FORUM, TOADS, ATLANTA, COLUMBUS, BARRYMORES, PITTSBURGH, INSOMNIACS, GETBACKAGAIN, WAITSOLONG, ROBBY, ONETHIRD, FOUR, HORSESHOE, ENCORES, CBC, ROXY, KAYAK.
- Recycled with new clues: HORSESHOE (the "Fully Completely" box set's live disc), CBC ("A National Celebration"), ROXY (the "Road Apples" box set).

**Puzzle 14** (167 letters, February 20): THEATREAQUARIUS, DARKESTONE, LASTRECLUSE, DONEANDDONE, NOTNECESSARY, CALGARY, OTTAWA, DEPENCIER, ANDYKEEN, SAMCOYLE, BANGERFILMS, KENGREER, PASSPORT, PILGRIMAGE, SECRETPATH, GUS, TIFF, PIERRE, DIAMOND, ALS.
- Recycled with new clues: KENGREER (the $5,000 EP), SECRETPATH, TIFF (five weeks after Puzzle 9, the shortest gap allowed), ALS.

**Puzzle 15** (161 letters, February 27): YERNOTTHEOCEAN, POETS, MORNINGMOON, WEWANTTOBEIT, PUTTINGDOWN, HIGHWAYGIRL, HALIFAX, VEGASSTRIP, WORKINGTITLE, LABEL, CHICAGO, PORTLAND, CHARLESTON, AMAZON, OVERDUBS, ROADSIDE, TOURBUS, DVD, INN, PUB.
- Recycled with new clues: POETS (names the lyrics search), HALIFAX (the Misty Moon), ROADSIDE (the tour "Heksenketel" follows).

## Banked

| Answer | Letters | Clue | Type | Status | Source |
|---|---|---|---|---|---|
| RICKY | 5 | First name of The Hip's head of security, Mr. Wellington | Crew | jD | jD, November 5, 2026 (WELLINGTON is in Puzzle 8, so not before Puzzle 13) |
| SOHARDDONEBY | 2, 4, 4, 2 | Sixth track on "Day for Night" | Song | Site data | data/discography.json (cut from Puzzle 8 for size) |
## Clue types to draw from

Release dates, venues, songs, album titles, band members, people around the band (managers, producers, crew), tour names, Top 40 and podcast clues, musical instruments, and music ephemera (tickets, passes, setlists, posters).

Instrument and gear clues need jD's say-so: the site data only says Johnny Fay was "behind the kit".

Keep a clue from giving away another answer in the same grid (a clue that names "Up to Here" can't sit beside UPTOHERE).

The Tragically Hip Album Countdown launches January 4, 2027: no clue may name a record's place in it before that episode drops.
