# The Hip Handbook - Crossword Clue Bank (Words Into Birds)

Answers and clues for the weekly crossword. Each puzzle uses exactly 20. The puzzles themselves live in `data/bird-puzzles.json`; this file says where each clue's fact comes from and what is waiting in the bank. When a banked clue goes into a puzzle, move it to that puzzle's list so you can see when it was last used. Answers can be recycled, but not within a month: an answer can come back 5 or more puzzles after its last use (jD, November 5, 2026). `audit-site.js` and the grid builder both stop anything sooner.

Status: "Site data" means the fact is in the Handbook's own data files. "jD" means it came from jD. "Needs jD" means don't ship it until he confirms.

Mix (jD, November 6, 2026): every puzzle is 15 clues about The Hip plus 5 linking words, still 20 in all. The linking words are music words (instruments, the studio, the road, the page, the record) and a few plain crossword staples, kept in `data/bird-links.json` with two clues each. Only the 15 Hip clues are written by hand: `node scripts/build-bird-grids.js` lays them out, then picks the 5 linking words that cross the most Hip answers. A linking word can come back 2 or more puzzles after its last use (jD, November 6, 2026), with its next clue. The 15 Hip answers keep the 5-puzzle rule.

Size: a puzzle's 15 Hip answers need to add up to about 130 letters or fewer, or the grid won't fit 15 squares wide. `node scripts/build-bird-grids.js` says when one doesn't fit.

## Puzzles drafted (not open yet, so all of these can still change)

**Reworked November 6, 2026 for linking words: all 15 need jD's read-through, including 1, 2 and 3** (approved November 5 as all-Hip grids, then 5 Hip answers each moved to the bank below). Linking words are listed after each puzzle's Hip answers (the vetting PDF is `docs/The Hip Handbook - New Games Puzzle Vetting.pdf`, on jD's Mac only).

Every clue below is from the site data unless it says otherwise. Sources: Top 40 ranks, producers, studios, Junos and solo records from `js/discography-app.js`; release dates, track lists and milestones from `data/discography.json`; tours and venue counts ("by the Handbook's count") from `data/tth-tour-data.json`; podcast facts from `data/podcast-shows.json`.

**Puzzle 1** (122 Hip letters, 13 wide): BOBCAYGEON, DONSMITH, FAY, BILLYRAY, GRACETOO, SINCLAIR, PHANTOMPOWER, KINGSTON, ROADAPPLES, HORSESHOE, SECRETPATH, JAKEGOLD, SIRIUSXM, LEGROS, ABACUS. Linking words: REST, SHARP, HOOK, CYMBAL, NEAR.
- jD: JAKEGOLD ("Longtime manager of The Hip"), confirmed by jD on November 5, 2026. The site data only has him on The Tragically Hip Interview Series.
- jD: BILLYRAY (Dave Koster, stage manager, title from Jake Gold via jD, November 5, 2026).
- HORSESHOE also names GEDfest Toronto 2026, from the shared rules.

**Puzzle 2** (127 Hip letters, 14 wide): MEMPHIS, BAHAMAS, NORTHEY, AWAYISMINE, ADAMKASPER, LITTLEBONES, DAYFORNIGHT, HARMER, UPTOHERE, COBOARENA, FIREWORKS, MASSEYHALL, HALIFAX, LIONIZED, OPIATED. Linking words: ROADIE, SETLIST, BANJO, VENUE, ALE.
- DAYFORNIGHT is clued as the tour (101 shows in the show list), not the album.
- MEMPHIS and OPIATED dodge naming "Up to Here", since UPTOHERE is in the same grid.

**Puzzle 3** (116 Hip letters, 15 wide): MUSICATWORK, FLAMENCO, GUESSWHAT, WORLDCONTAINER, POETS, CLEVELAND, GIFTSHOP, STEVEBERLIN, CBC, ROXY, KEVINDREW, BATH, HENHOUSE, COURAGE, AUSTIN. Linking words: EAR, TOUR, SOLO, PEDAL, ETUDE.
- MUSICATWORK: the clue says the title is written with an at-sign.

**Puzzle 4** (131 Hip letters, 15 wide): NOWFORPLANA, SASKADELPHIA, TWISTMYARM, THREEPISTOLS, STLOUIS, SCARED, JUNO, DAREDEVIL, COMMODORE, HAMILTON, WHEATKINGS, ELDORADO, LAKEFEVER, CORDELIA, KENGREER. Linking words: FADER, TUBA, LOOP, SITAR, SETLIST.
- HAMILTON names Theatre Aquarius, from the shared rules (the musical's premiere).

**Puzzle 5** (123 Hip letters, Saturday, December 19, 2026, 15 wide): STAY, SHERPA, MEMBERSHIP, EMERGENCY, MONDAY, CHAGRINFALLS, AHEADBYACENTURY, WINNIPEG, FILLMORE, LOSLOBOS, SADIES, AREWEFAMILY, COPPERPENNY, HUSH, LEAVE. Linking words: RIFF, TEMPO, TICKET, DEMO, FLAT.
- AREWEFAMILY is the song on "In Between Evolution", clued as the name of the Handbook's other weekly game (both drop the same Saturday).
- COPPERPENNY: the earliest show in `data/tth-tour-data.json`, February 27, 1985, Kingston.

**Puzzle 6** (126 Hip letters, December 26, 13 wide): NOTGUILTY, SONGWRITERS, MACHINE, BILLBOARD, COMPLETISTS, CRAIGROGERS, SKELETONPARK, GROTEZAAL, PANEL, FIGHT, HOTMIC, ABOUTTHISMAP, THIRTEEN, DETROIT, MAUI. Linking words: TONE, OUTRO, INTRO, NEEDLE, REST.
- HOTMIC and MACHINE say "The Hip's final studio album" instead of naming "Man Machine Poem", which would give MACHINE away.
- ABOUTTHISMAP: the Handbook's tour map page is named for it (`docs/The Hip Handbook - Overview.md`).
- MAUI calls it an island; the site data only says "Recorded in Toronto, Vancouver, and Maui".

**Puzzle 7** (123 Hip letters, January 2, 2027, 14 wide): HIPEPONYMOUS, EVELYN, BRUSSELS, FLY, GREASYJUNGLE, TIGERTHELION, SHARKS, PRETEND, INVIOLETLIGHT, HEKSENKETEL, PODLIST, GEDFEST, THEPLAYERS, HORDE, OUCH. Linking words: MIXER, MERCH, VENUE, LUTE, SIDE.
- HORDE is the H.O.R.D.E. festival (1996, Saratoga Springs), from the tour names. GEDFEST is from the shared rules (October 17, 2026, Horseshoe Tavern) and the network's specials feed.

**Puzzle 8** (131 Hip letters, January 9, 2027, 14 wide): LUXURY, NOTHREAT, HOUSEOFBLUES, GREATSOUL, MANMACHINEPOEM, CURTAINUP, USEITUP, YOUTUBE, COUNTRYDAY, MEANSTREAK, HALLOFFAME, WELLINGTON, PUTITOFF, THUGS, ABACUS. Linking words: NOTE, RIFF, ART, BEAT, OPENER.
- jD: WELLINGTON (Ricky Wellington, head of security, jD, November 5, 2026).
- ABACUS comes back from Puzzle 1, seven weeks later: the first recycled answer, and allowed by the five-week rule.

**Puzzle 9** (124 Hip letters, January 16, 2027, 14 wide): RADIOSHOW, FLASHBACKS, BIGMUSICFEST, LANOIS, TIFF, CAULDRON, DOBA, REDUX, WHATBLUE, PROMISING, TAXIDANCERS, MISTYMOON, KILLINGTIME, FAMILYBAND, CASSETTE. Linking words: ARENA, MIC, GIG, TREBLE, ECHO.
- Box sets, films and Junos come from the album notes in `js/discography-app.js` ("Heksenketel" is Dutch for "witch's cauldron"; the 1987 EP had seven tracks on cassette, eight on CD).
- FAMILYBAND names the Handbook's setlist explorer (`docs/The Hip Handbook - Overview.md`).

**Puzzle 10** (126 Hip letters, January 23, 14 wide): HOOFHEARTED, DAVERUSSELL, NEWORLEANS, NEWRECRUITS, COFFEEGIRL, INVIEW, AVERAGES, MACROSCOPIC, ODDS, DESIGN, MAN, WENJACK, PRIMEVIDEO, BUMBLEBEE, SILVERJET. Linking words: UNISON, FRET, VERSE, VENUE, NEAR.
- NEWRECRUITS and INVIEW name Handbook pages (the videos page and the Passport).

**Puzzle 11** (130 Hip letters, January 30, 15 wide): RANDOM, JUSTASWELL, MERCURYSEA, ONTHEVERGE, CONQUERING, MIKEDOWNIE, OCEANNEXT, DIREWOLF, FIREINTHEHOLE, RULES, NEWMAYBE, SOMETHINGON, TRICKLEDOWN, LUV, THIRTY. Linking words: STRAP, AIR, EAR, CAPO, OPENER.

**Puzzle 12** (125 Hip letters, February 6, 15 wide): DISCOVERY, MYSTERY, SIX, BLOWATHIGHDOUGH, GROUP, INSARNIA, COMPASSPOINT, KINGSTON, ORBITROOM, EIGHTH, PODUMENTARY, COCONUTCREAM, HONEYPLEASE, BEAR, DUTCH. Linking words: FORTE, ECHO, ODE, BAR, BEAT.
- KINGSTON comes back from Puzzle 1 with a new clue (Alfie's Pub).

**Puzzle 13** (127 Hip letters, February 13, the day before Valentine's Day, 15 wide): FOUR, PITTSBURGH, ROXY, CBC, KAYAK, LOVEISAFIRST, INSOMNIACS, LETSSTAYENGAGED, ONETHIRD, ENCORES, ROBBY, GETBACKAGAIN, BOOTSORHEARTS, WAITSOLONG, HORSESHOE. Linking words: OUTRO, LYRIC, INTRO, STAND, AREA.
- Recycled with new clues: HORSESHOE (the "Fully Completely" box set's live disc), CBC ("A National Celebration"), ROXY (the "Road Apples" box set).

**Puzzle 14** (129 Hip letters, February 20, 15 wide): SECRETPATH, DEPENCIER, THEATREAQUARIUS, DARKESTONE, NOTNECESSARY, GUS, DONEANDDONE, PASSPORT, PILGRIMAGE, TIFF, KENGREER, ALS, LASTRECLUSE, ANDYKEEN, DIAMOND. Linking words: SNARE, CLEF, NOTE, REED, ERA.
- Recycled with new clues: KENGREER (the $5,000 EP), SECRETPATH, TIFF (five weeks after Puzzle 9, the shortest gap allowed).

**Puzzle 15** (130 Hip letters, February 27, 15 wide): VEGASSTRIP, AMAZON, YERNOTTHEOCEAN, DVD, WEWANTTOBEIT, MORNINGMOON, ROADSIDE, HIGHWAYGIRL, LABEL, TOURBUS, PUTTINGDOWN, POETS, WORKINGTITLE, OVERDUBS, HALIFAX. Linking words: CHART, ETUDE, ROADIE, MONO, STEREO.
- Recycled with new clues: POETS (names the lyrics search), HALIFAX (the Misty Moon).

## Banked

| Answer | Letters | Clue | Type | Status | Source |
|---|---|---|---|---|---|
| RICKY | 5 | First name of The Hip's head of security, Mr. Wellington | Crew | jD | jD, November 5, 2026 (WELLINGTON is in Puzzle 8, so not before Puzzle 13) |
| SOHARDDONEBY | 2, 4, 4, 2 | Sixth track on "Day for Night" | Song | Site data | data/discography.json (cut from Puzzle 8 for size) |
| ROADSIDE | 8 | Another ___ Attraction: the festival tour of 1993, 1995, and 1997 | Drafted | Site data | Cut from Puzzle 1 for linking words (November 6, 2026) |
| BAKER | 5 | Rob who formed Stripper's Union with Craig Northey | Drafted | Site data | Cut from Puzzle 1 for linking words (November 6, 2026) |
| BATHOUSE | 8 | The studio where "Music @ Work" was made | Drafted | Site data | Cut from Puzzle 1 for linking words (November 6, 2026) |
| LANGLOIS | 8 | Paul whose "Smooth Rock Falls" was a surprise release in February 2026 | Drafted | Site data | Cut from Puzzle 1 for linking words (November 6, 2026) |
| BOBROCK | 3, 4 | Producer of "World Container" and "We Are the Same" | Drafted | Site data | Cut from Puzzle 1 for linking words (November 6, 2026) |
| MARCHICA | 8 | Pete ___, hearing The Hip for the first time on Getting Hip to The Hip | Drafted | Site data | Cut from Puzzle 2 for linking words (November 6, 2026) |
| ALS | 3 | The ___ Society of Canada, fundraising partner of The Tragically Hip Top Forty Countdown | Drafted | Site data | Cut from Puzzle 2 for linking words (November 6, 2026) |
| TSANGARIDES | 11 | Chris ___, producer of "Fully Completely" | Drafted | Site data | Cut from Puzzle 2 for linking words (November 6, 2026) |
| KINGSWAY | 8 | New Orleans studio where "Road Apples" was recorded | Drafted | Site data | Cut from Puzzle 2 for linking words (November 6, 2026) |
| GAVINBROWN | 5, 5 | Producer of "Now for Plan A" | Drafted | Site data | Cut from Puzzle 2 for linking words (November 6, 2026) |
| COPPS | 5 | ___ Coliseum, the Hamilton arena of "From the Vault: Vol. 3", February 6, 2007 | Drafted | Site data | Cut from Puzzle 3 for linking words (November 6, 2026) |
| FIRSTAVENUE | 5, 6 | Minneapolis club The Hip played seven times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 3 for linking words (November 6, 2026) |
| HUGHPADGHAM | 4, 7 | Co-producer of "In Violet Light" with Terry Manning | Drafted | Site data | Cut from Puzzle 3 for linking words (November 6, 2026) |
| LYDEN | 5 | Tim ___, hearing The Hip for the first time on Getting Hip to The Hip | Drafted | Site data | Cut from Puzzle 3 for linking words (November 6, 2026) |
| LUSTREPARFAIT | 6, 7 | 2023 record from Gord Downie and Bob Rock | Drafted | Site data | Cut from Puzzle 3 for linking words (November 6, 2026) |
| METRO | 5 | Chicago club The Hip played seven times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 4 for linking words (November 6, 2026) |
| TIVOLI | 6 | Utrecht room The Hip played eight times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 4 for linking words (November 6, 2026) |
| PHOENIX | 7 | The ___ Concert Theatre, a Toronto room The Hip played seven times by the Handbook's count | Drafted | Site data | Cut from Puzzle 4 for linking words (November 6, 2026) |
| VREEKEN | 7 | Mark ___, co-producer of "Trouble at the Henhouse", "Phantom Power", and "Music @ Work" | Drafted | Site data | Cut from Puzzle 4 for linking words (November 6, 2026) |
| KIRKLANE | 4, 4 | Discovering Downie panelist alongside Craig Rogers | Drafted | Site data | Cut from Puzzle 4 for linking words (November 6, 2026) |
| CHING | 5 | ___ Music, the label behind Paul Langlois' solo debut "Fix This Head" | Drafted | Site data | Cut from Puzzle 5 for linking words (November 6, 2026) |
| ARTPARK | 7 | Lewiston stage The Hip played seven times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 5 for linking words (November 6, 2026) |
| MARKHOWARD | 4, 6 | Co-producer of "Day for Night" with The Hip | Drafted | Site data | Cut from Puzzle 5 for linking words (November 6, 2026) |
| WAREHOUSE | 9 | The ___ Studio, in Vancouver, where part of "In Between Evolution" was recorded | Drafted | Site data | Cut from Puzzle 5 for linking words (November 6, 2026) |
| MOLSONPARK | 6, 4 | Barrie grounds The Hip played seven times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 5 for linking words (November 6, 2026) |
| SYRACUSE | 8 | City of the Landmark Theatre, eight shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 6 for linking words (November 6, 2026) |
| GRANDBOUNCE | 5, 6 | The ___ (2010), from Gord Downie and the Country of Miracles | Drafted | Site data | Cut from Puzzle 6 for linking words (November 6, 2026) |
| DEUCE | 5 | The ___ (2011), from Stripper's Union | Drafted | Site data | Cut from Puzzle 6 for linking words (November 6, 2026) |
| ORPHEUM | 7 | The ___, a Vancouver theatre The Hip played six times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 6 for linking words (November 6, 2026) |
| JENSEN | 6 | Ted ___, who remastered "Live at the Roxy" at Sterling Sound | Drafted | Site data | Cut from Puzzle 6 for linking words (November 6, 2026) |
| SEATTLE | 7 | City of the Moore Theatre, seven shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 7 for linking words (November 6, 2026) |
| STRATFORD | 9 | City of the Ovation Music Festival show, September 9, 2006 | Drafted | Site data | Cut from Puzzle 7 for linking words (November 6, 2026) |
| WASHINGTON | 10 | City of the 9:30 Club, sixteen shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 7 for linking words (November 6, 2026) |
| LOSANGELES | 3, 7 | City of "From the Vault: Vol. 5", recorded in 2004 | Drafted | Site data | Cut from Puzzle 7 for linking words (November 6, 2026) |
| MONTREAL | 8 | City of Le Spectrum, six shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 7 for linking words (November 6, 2026) |
| EDMONTON | 8 | City of Rexall Place, six shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 8 for linking words (November 6, 2026) |
| TORONTO | 7 | City of the Air Canada Centre, sixteen shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 8 for linking words (November 6, 2026) |
| LONDON | 6 | City of Shepherd's Bush Empire, six shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 8 for linking words (November 6, 2026) |
| BELGIQUE | 8 | Ancienne ___, the Brussels hall The Hip played six times, by the Handbook's count | Drafted | Site data | Cut from Puzzle 8 for linking words (November 6, 2026) |
| FIFTEEN | 7 | How many releases fans rate in The Tragically Hip Album Countdown | Drafted | Site data | Cut from Puzzle 8 for linking words (November 6, 2026) |
| LAMOUREUX | 9 | Pierre and Francois ___, who directed "That Night in Toronto" | Drafted | Site data | Cut from Puzzle 9 for linking words (November 6, 2026) |
| LOUIS | 5 | Saskatoon room The Hip played five times by the Handbook's count (an apostrophe follows the S) | Drafted | Site data | Cut from Puzzle 9 for linking words (November 6, 2026) |
| SAINTJOHN | 5, 4 | City of Harbour Station, five shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 9 for linking words (November 6, 2026) |
| THUNDERBAY | 7, 3 | City of Fort William Gardens, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 9 for linking words (November 6, 2026) |
| METROPOL | 8 | Pittsburgh room of the live disc in the "Phantom Power" box set, October 2, 1998 | Drafted | Site data | Cut from Puzzle 9 for linking words (November 6, 2026) |
| WETLANDS | 8 | ___ Preserve, a New York club The Hip played five times by the Handbook's count | Drafted | Site data | Cut from Puzzle 10 for linking words (November 6, 2026) |
| BAICHWAL | 8 | Jennifer ___, co-director of "Long Time Running" with Nicholas de Pencier | Drafted | Site data | Cut from Puzzle 10 for linking words (November 6, 2026) |
| SPOKANE | 7 | City of the Metropolitan Performing Arts Center, five shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 10 for linking words (November 6, 2026) |
| COREL | 5 | ___ Centre, the Ottawa arena The Hip played five times by the Handbook's count | Drafted | Site data | Cut from Puzzle 10 for linking words (November 6, 2026) |
| BOTTRILL | 8 | David ___, who mixed Johnny Fay's "Mercury Sea" | Drafted | Site data | Cut from Puzzle 10 for linking words (November 6, 2026) |
| TEN | 3 | Fans rate every record out of this in The Tragically Hip Album Countdown | Drafted | Site data | Cut from Puzzle 11 for linking words (November 6, 2026) |
| ROTTERDAM | 9 | City of Nighttown, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 11 for linking words (November 6, 2026) |
| RENFREW | 7 | Town of Butson's Valley Hotel, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 11 for linking words (November 6, 2026) |
| SASKATOON | 9 | City of Saskatchewan Place, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 11 for linking words (November 6, 2026) |
| TILBURG | 7 | City of Noorderligt, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 11 for linking words (November 6, 2026) |
| AVALON | 6 | Boston club The Hip played four times by the Handbook's count | Drafted | Site data | Cut from Puzzle 12 for linking words (November 6, 2026) |
| MARTYRS | 7 | Chicago room, with an apostrophe at the end, that The Hip played five times by the Handbook's count | Drafted | Site data | Cut from Puzzle 12 for linking words (November 6, 2026) |
| SADDLEDOME | 10 | Calgary arena, then the Canadian Airlines ___, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 12 for linking words (November 6, 2026) |
| VICTORIA | 8 | City of the Save-On-Foods Memorial Centre, six shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 12 for linking words (November 6, 2026) |
| ROCHESTER | 9 | City of the Auditorium Theatre, six shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 12 for linking words (November 6, 2026) |
| BARRYMORES | 10 | Ottawa music hall The Hip played four times by the Handbook's count | Drafted | Site data | Cut from Puzzle 13 for linking words (November 6, 2026) |
| COLUMBUS | 8 | City of the Newport Music Hall, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 13 for linking words (November 6, 2026) |
| ATLANTA | 7 | City of the Variety Playhouse, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 13 for linking words (November 6, 2026) |
| TOADS | 5 | ___ Place, a New Haven club with four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 13 for linking words (November 6, 2026) |
| FORUM | 5 | Ontario Place ___, the Toronto stage The Hip played five times by the Handbook's count | Drafted | Site data | Cut from Puzzle 13 for linking words (November 6, 2026) |
| CALGARY | 7 | City of the Southern Alberta Jubilee Auditorium, five shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 14 for linking words (November 6, 2026) |
| SAMCOYLE | 3, 5 | Producer of "No Dress Rehearsal" with Mike Downie and Scot McFadyen | Drafted | Site data | Cut from Puzzle 14 for linking words (November 6, 2026) |
| OTTAWA | 6 | City of the Corel Centre, five shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 14 for linking words (November 6, 2026) |
| BANGERFILMS | 6, 5 | Company behind "No Dress Rehearsal", with Amazon MGM Studios | Drafted | Site data | Cut from Puzzle 14 for linking words (November 6, 2026) |
| PIERRE | 6 | ___ and Francois Lamoureux, directors of "That Night in Toronto" | Drafted | Site data | Cut from Puzzle 14 for linking words (November 6, 2026) |
| PORTLAND | 8 | City of the Roseland Theater, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 15 for linking words (November 6, 2026) |
| CHARLESTON | 10 | City of the Music Farm, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 15 for linking words (November 6, 2026) |
| PUB | 3 | Alfie's ___, the Kingston room The Hip played four times by the Handbook's count | Drafted | Site data | Cut from Puzzle 15 for linking words (November 6, 2026) |
| CHICAGO | 7 | City of the Vic Theatre, four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 15 for linking words (November 6, 2026) |
| INN | 3 | Dancin' Shoes in the Mayfield ___, an Edmonton room with four shows by The Hip by the Handbook's count | Drafted | Site data | Cut from Puzzle 15 for linking words (November 6, 2026) |

The 75 answers cut from Puzzles 1 to 15 on November 6, 2026 keep the clue they were drafted with. Recheck a clue against the puzzle it lands in (no clue may name another answer in the same grid), and the five-puzzle gap still counts from the last puzzle an answer is actually in.

## Clue types to draw from

Release dates, venues, songs, album titles, band members, people around the band (managers, producers, crew), tour names, Top 40 and podcast clues, musical instruments, and music ephemera (tickets, passes, setlists, posters).

Linking words (the 5 a week) are general music knowledge and live in `data/bird-links.json`, not here. Instrument and gear clues about The Hip themselves still need jD's say-so: the site data only says Johnny Fay was "behind the kit".

Keep a clue from giving away another answer in the same grid (a clue that names "Up to Here" can't sit beside UPTOHERE).

The Tragically Hip Album Countdown launches January 4, 2027: no clue may name a record's place in it before that episode drops.
