# The Hip Handbook - Data Questions for jD

A checklist for one sitting with setlist.fm, The Hip Archive and Hipbase open. Every item says what the site shows today, where it comes from, and the one question to answer. Nothing here has been answered or "corrected" by Claude: the facts are yours.

Written 2026-11-01 from the October 31 audit (`AUDIT_REPORT.md`, findings DATA-03, GAME-04, DATA-05, DATA-06, DATA-11, GAME-11, BRAND-07 and DATA-08) and the data files in this repo.

**How to use it**

1. Work down the list. Write your answer on each "jD's answer:" line. "Not sure" or "skip" is a fine answer.
2. When you're done, start a Claude Code session and paste: "Read docs/The Hip Handbook - Data Questions for jD.md. My answers are filled in. Make the fixes through data/setlist-corrections.json and the pipeline only. List every scheduled puzzle that would change and wait for my OK by number before touching check-game-schedule.js. One patch release, don't push."
3. Links: "setlist.fm" links go to the exact entry the site copied. "Hip Archive file" links are the zip the site's player streams from (they start a large download, so skip them unless you want the tape). Hipbase has no links in the site's data, so search it by date.

**The daily-game rule.** 'Bring It All Back' puzzle No. 1 was October 30, 2026, and each day after is the next number. Today (November 1) is No. 3, so No. 1 and No. 2 are already played and locked. If an answer below changes what a future puzzle shows (its date, venue or songs), that puzzle needs your OK by number. Each section lists the puzzle numbers it touches, with their dates, so you can tick them.

---

## 1. Identical setlists on different dates (DATA-03 / GAME-04)

**What the site shows today:** these shows have exactly the same songs in exactly the same order (8 or more songs), on different dates. It's everywhere a setlist appears: the Setlists page, the Tour Map, Passport, song play counts and Live Stats, and 'Bring It All Back'. In the game, a fan who remembers the twin show's month and year guesses it and is marked wrong.

**The question for each group:** are these really different shows that happened to have the same setlist, or is it one show entered twice (and if so, which date and venue is right, and what was played at the other one)?

Groups 1 to 13 match word for word. Group 14 only differs in the capital letters of one song title, so the game treats it as identical too.

### Group 1 - Las Cruces / Syracuse, 1995 (16 songs)
- 27-05-1995, Pan American Center, Las Cruces, NM - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/pan-american-center-las-cruces-nm-6bfe720e.html) (`6bfe720e`) - puzzle **No. 1** (October 30, 2026, already played)
- 27-04-1995, Club Chameleon, Syracuse, NY - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/club-chameleon-syracuse-ny-1bfe6d5c.html) (`1bfe6d5c`) - puzzle **No. 774** (December 11, 2028) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1995-04-27-Syracuse-NY-mp3.zip (17 tracks, playable on the Tour Map)
- Note: same day of the month, one month apart.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 2 - Brussels / Lake Buena Vista, 2002 (18 songs)
- 05-11-2002, Ancienne Belgique, Brussels - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2002/ancienne-belgique-brussels-belgium-33ff0cf9.html) (`33ff0cf9`) - puzzle **No. 2** (October 31, 2026, already played) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2002-11-05-Brussels-Belgium-mp3.zip (19 tracks)
- 20-10-2002, House of Blues, Lake Buena Vista, FL - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2002/house-of-blues-lake-buena-vista-fl-3bc25020.html) (`3bc25020`) - puzzle **No. 156** (April 3, 2027) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2002-10-20-Orlando-FL-mp3.zip (18 tracks)
- Note: both shows have a recording on the site, so the two tapes can be compared.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 3 - Vancouver / Ottawa, February 1995 (20 songs)
- 25-02-1995, Pacific Coliseum, Vancouver, BC - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/pacific-coliseum-vancouver-bc-canada-43d33f33.html) (`43d33f33`) - puzzle **No. 28** (November 26, 2026)
- 07-02-1995, Ottawa Civic Centre, Ottawa, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/ottawa-civic-centre-ottawa-on-canada-bd9e1e6.html) (`bd9e1e6`) - puzzle **No. 699** (September 27, 2028) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1995-02-07-Ottawa-ON-mp3.zip (20 tracks)
- Note: No. 28 is the soonest unplayed puzzle in this list (November 26, 2026).
- jD's answer:
- Puzzles I approve changing (by number):

### Group 4 - Burlington / Ottawa, 1993 (15 songs)
- 01-10-1993, Memorial Auditorium, Burlington, VT - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1993/memorial-auditorium-burlington-vt-2bfe9c32.html) (`2bfe9c32`) - puzzle **No. 104** (February 10, 2027)
- 26-07-1993, Frank Clair Stadium, Ottawa, ON (Another Roadside Attraction 1993) - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1993/frank-clair-stadium-ottawa-on-canada-23c6b097.html) (`23c6b097`) - puzzle **No. 216** (June 2, 2027) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1993-07-26-Ottawa-ON-mp3.zip (15 tracks)
- jD's answer:
- Puzzles I approve changing (by number):

### Group 5 - Tilburg, 2001 / 2002 (19 songs)
- 11-11-2001, Poppodium 013, Tilburg - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2001/poppodium-013-tilburg-netherlands-2bd354ba.html) (`2bd354ba`) - puzzle **No. 136** (March 14, 2027)
- 11-11-2002, Poppodium 013, Tilburg (In Violet Light tour) - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2002/poppodium-013-tilburg-netherlands-23ff0c1b.html) (`23ff0c1b`) - puzzle **No. 835** (February 10, 2029) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2002-11-11-Tilburg-NL-mp3.zip (1 track)
- Note: same venue, same day and month, one year apart.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 6 - Edmonton / Vancouver, 1992 (13 songs)
- 28-11-1992, Northlands AgriCom Hall B, Edmonton, AB - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1992/northlands-agricom-hall-b-edmonton-ab-canada-4bdd8ba6.html) (`4bdd8ba6`) - puzzle **No. 151** (March 29, 2027)
- 01-07-1992, Thunderbird Stadium, Vancouver, BC - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1992/thunderbird-stadium-vancouver-bc-canada-3cc3d17.html) (`3cc3d17`) - puzzle **No. 539** (April 20, 2028)
- Note: `data/setlist-corrections.json` already says the July 1, 1992 recording filed under Vancouver is the Molson Park, Barrie set, and removes it.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 7 - Toronto / Charlottetown, 2011 (21 songs)
- 01-07-2011, Downsview Park, Toronto, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2011/downsview-park-toronto-on-canada-4bd37322.html) (`4bd37322`) - puzzle **No. 161** (April 8, 2027) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2011-07-01-Toronto-ON-mp3.zip (1 track)
- 30-06-2011, Confederation Landing Park, Charlottetown, PE - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2011/confederation-landing-park-charlottetown-pe-canada-63d0b69b.html) (`63d0b69b`) - puzzle **No. 706** (October 4, 2028)
- jD's answer:
- Puzzles I approve changing (by number):

### Group 8 - Seattle / New Orleans, 2004 (21 songs)
- 10-10-2004, Showbox Comedy and Supper Club, Seattle, WA - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2004/showbox-comedy-and-supper-club-seattle-wa-4bd33f3e.html) (`4bd33f3e`) - puzzle **No. 843** (February 18, 2029) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2004-10-10-Seattle-WA-mp3.zip (22 tracks)
- 29-09-2004, Howlin' Wolf, New Orleans, LA - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2004/howlin-wolf-new-orleans-la-4bff1342.html) (`4bff1342`) - puzzle **No. 176** (April 23, 2027)
- jD's answer:
- Puzzles I approve changing (by number):

### Group 9 - Winnipeg, two nights in 2009 (23 songs)
- 07-09-2009, Centennial Concert Hall, Winnipeg, MB - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2009/centennial-concert-hall-winnipeg-mb-canada-4bff03ba.html) (`4bff03ba`) - puzzle **No. 613** (July 3, 2028)
- 09-09-2009, Centennial Concert Hall, Winnipeg, MB - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2009/centennial-concert-hall-winnipeg-mb-canada-63d47e2f.html) (`63d47e2f`) - puzzle **No. 268** (July 24, 2027)
- Note: the audit thought this one may be genuine (two nights at one venue). Your call.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 10 - Victoria / Calgary, 2012 (20 songs)
- 13-07-2012, Juan De Fuca Recreation Centre, Victoria, BC - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2012/juan-de-fuca-recreation-centre-victoria-bc-canada-2bdd2cd2.html) (`2bdd2cd2`) - puzzle **No. 838** (February 13, 2029)
- 11-07-2012, Fort Calgary Historic Park, Calgary, AB - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2012/fort-calgary-historic-park-calgary-ab-canada-13dcad1d.html) (`13dcad1d`) - puzzle **No. 304** (August 29, 2027)
- jD's answer:
- Puzzles I approve changing (by number):

### Group 11 - Amsterdam 1994 / Hamburg 1992 (11 songs)
- 29-11-1994, Grote Zaal, Amsterdam (Day For Night tour) - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1994/grote-zaal-amsterdam-netherlands-43c1e313.html) (`43c1e313`) - puzzle **No. 368** (November 1, 2027)
- 09-12-1992, LOGO, Hamburg (Fully Completely Tour) - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1992/logo-hamburg-germany-3bfe0484.html) (`3bfe0484`) - puzzle **No. 644** (August 3, 2028) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1992-12-09-Hamburg-Germany-V1-mp3.zip (10 tracks)
- Note: two years apart, different cities.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 12 - Montreal / Saint John, February 1995 (21 songs)
- 05-02-1995, Forum de Montréal, Montreal, QC - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/forum-de-montreal-montreal-qc-canada-13d9e1d1.html) (`13d9e1d1`) - puzzle **No. 698** (September 26, 2028) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1995-02-05-Montreal-QC-mp3.zip (21 tracks)
- 03-02-1995, Harbour Station, Saint John, NB - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/harbour-station-saint-john-nb-canada-2bd0987e.html) (`2bd0987e`) - puzzle **No. 371** (November 4, 2027)
- jD's answer:
- Puzzles I approve changing (by number):

### Group 13 - The Spectrum, Toronto, twice in 1989, plus Vancouver (11 songs)
- 30-11-1989, The Spectrum, Toronto, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1989/the-spectrum-toronto-on-canada-3c4d55b.html) (`3c4d55b`) - puzzle **No. 601** (June 21, 2028) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1989-11-30-Toronto-ON-mp3.zip (11 tracks)
- 19-12-1989, The Spectrum, Toronto, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1989/the-spectrum-toronto-on-canada-63fc768f.html) (`63fc768f`) - puzzle **No. 534** (April 15, 2028)
- 31-12-1989, 86 Street Music Hall, Vancouver, BC - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1989/86-street-music-hall-vancouver-bc-canada-63c4da8f.html) (`63c4da8f`) - not a puzzle. Already flagged in `data/setlist-corrections.json` (`dateUncertain`) as a copy of the December 19 Spectrum setlist.
- jD's answer:
- Puzzles I approve changing (by number):

### Group 14 - Waterloo / Fort Erie, June 1990 (16 songs, one capital letter apart)
- 24-06-1990, Phil's Grandson's Place, Waterloo, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1990/phils-grandsons-place-waterloo-on-canada-33fe04f5.html) (`33fe04f5`) - puzzle **No. 154** (April 1, 2027) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1990-06-24-Waterloo-ON-mp3.zip (17 tracks)
- 30-06-1990, Mather Arch Park, Fort Erie, ON - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1990/mather-arch-park-fort-erie-on-canada-350f53f.html) (`350f53f`) - puzzle **No. 354** (October 18, 2027)
- jD's answer:
- Puzzles I approve changing (by number):

### 1b. The doubled block, and setlists that list one song twice

**What the site shows today:** these setlists list a song (or a run of songs) twice. Each repeat adds one play to that song's count on its song page and in Live Stats, and shows twice in the puzzle.

**The question for each:** was the song really played twice that night, or is the repeat a data-entry slip?

- 26-03-2007, The Fillmore, San Francisco - 'The Kids Don't Get It', 'Scared', 'The Lonely End of the Rink' and 'Blow at High Dough' appear twice in a row - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2007/the-fillmore-san-francisco-ca-1bfe8118.html) (`1bfe8118`) - puzzle **No. 814** (January 20, 2029)
  - jD's answer:
- 25-11-2009, De Oosterpoort, Groningen - 'Throwing Off Glass' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2009/de-oosterpoort-groningen-netherlands-23ff0087.html) (`23ff0087`) - puzzle **No. 873** (March 20, 2029)
  - jD's answer:
- 29-06-2007, Scène Molson Dry, Saint-Éphrem-de-Beauce - 'Yer Not the Ocean' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2007/scene-molson-dry-saint-ephrem-de-beauce-qc-canada-bff0572.html) (`bff0572`) - puzzle **No. 852** (February 27, 2029)
  - jD's answer:
- 19-03-2007, Gothic Theatre, Englewood - 'Courage (for Hugh MacLennan)' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2007/gothic-theatre-englewood-co-3ff05ab.html) (`3ff05ab`) - puzzle **No. 203** (May 20, 2027)
  - jD's answer:
- 05-02-2007, John Labatt Centre, London - 'New Orleans Is Sinking' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2007/john-labatt-centre-london-on-canada-63d7b28f.html) (`63d7b28f`) - puzzle **No. 911** (April 27, 2029) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/2007-02-05-London-ON-mp3.zip (24 tracks)
  - jD's answer:
- 02-03-1999, Agridome, Regina - 'Fire in the Hole' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1999/agridome-regina-sk-canada-53cc37f9.html) (`53cc37f9`) - puzzle **No. 291** (August 16, 2027) - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1999-03-02-Regina-SK-mp3.zip (22 tracks)
  - jD's answer:
- 16-11-1991, venue unknown, Amsterdam - 'At the Hundredth Meridian' twice - [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1991/unknown-venue-amsterdam-netherlands-73cf82c9.html) (`73cf82c9`) - not a puzzle - Hip Archive file: https://www.thehiparchive.com/Files/Audio/1991-11-16-Amsterdam-NL-mp3.zip (16 tracks)
  - jD's answer:
- Puzzles I approve changing (by number):

### 1c. Martyrs', Chicago, 06-08-1998: one show or two?

**What the site shows today:** two entries for the same date and venue: `33ffc899` with 17 songs ([setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1998/martyrs-chicago-il-33ffc899.html), puzzle **No. 946**, June 1, 2029) and `135e4de9` with 3 songs ([setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1998/martyrs-chicago-il-135e4de9.html), not a puzzle, Hip Archive file https://www.thehiparchive.com/Files/Audio/1998-08-06-Chicago-IL-Day-mp3.zip, 8 tracks). `data/setlist-corrections.json` already calls the 3-song one a daytime interview set.

**The question:** keep both (an evening show plus a daytime set), or are they one show?

- jD's answer:

### 1d. The Bayou, Washington, DC: which date?

**What the site shows today:** the show is dated 19-10-1993 (`23fe00ff`, [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1993/the-bayou-washington-dc-23fe00ff.html), puzzle **No. 874**, March 21, 2029), but the recording's track is titled "Tragically Hip 1993 10 12 The Bayou, Washington, DC" (Hip Archive file: https://www.thehiparchive.com/Files/Audio/1993-10-19-Washington-DC-mp3.zip).

**The question:** October 12 or October 19, 1993?

- jD's answer:

---

## 2. The same song spelled more than one way (DATA-05)

**What the site shows today:** one song, two or three spellings, depending on the page. Below is every official song that has more than one spelling in the site's data, with each spelling and where it shows. (The audit counted 34 with its own script; a fresh count today, ignoring labels like "(Live)" and "(Demo)", finds these 32. The two the audit had that aren't here may be ones its scan grouped differently.)

Where it shows, in plain words:
- "song page title" - the heading on the song's own page, and the title in search
- "album track lists on Discography" - the album flip cards, and the release list on each song page
- "lyrics" - the lyrics page and song-page lyrics
- "setlists" - the Setlists page, Tour Map, Passport and Live Stats (number = how many setlist entries)
- "'Bring It All Back' puzzles" and "'(Un)Locked' answer" - the daily games
- "Unplucked Gems" - the Unplucked Gems tracker (spelled as the tracker spreadsheet spells it)

**The question for each:** which spelling should the site use everywhere? (The plan is a display map: the site would show your spelling on every page without renaming anything in the data, so song links and puzzle answers don't break.) If you'd rather leave Unplucked Gems as the tracker spells it, say so once at the top and skip those lines.

- Leave Unplucked Gems spelled as the tracker has it? jD's answer:

**1. 700 Ft. Ceiling**

- "700 Ft. Ceiling" - song page title; album track lists on Discography: Trouble at the Henhouse, From the Vault: Vol. 6 - Cleveland 1996; lyrics (filed under "Trouble at the Henhouse"); '(Un)Locked' answer; Unplucked Gems (1)
- "700 ft. Ceiling" - setlists (130 entries); 'Bring It All Back' puzzles (126); Unplucked Gems (1)
- jD's answer: ________________

**2. Ahead by a Century**

- "Ahead by a Century" - song page title; album track lists on Discography: Trouble at the Henhouse, Live Between Us, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 5 - Los Angeles 2004, From the Vault: Vol. 6 - Cleveland 1996, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Phantom Power Box Set, That Night in Toronto, A National Celebration; lyrics (filed under "Trouble at the Henhouse"); setlists (697 entries); 'Bring It All Back' puzzles (678); '(Un)Locked' answer; Music Videos
- "Ahead By A Century" - Unplucked Gems (4)
- jD's answer: ________________

**3. An Inch an Hour**

- "An Inch an Hour" - song page title; album track lists on Discography: Day for Night; lyrics (filed under "Day for Night"); setlists (43 entries); 'Bring It All Back' puzzles (41); '(Un)Locked' answer
- "An Inch An Hour" - Unplucked Gems (1)
- jD's answer: ________________

**4. As Makeshift as We Are**

- "As Makeshift as We Are" - song page title; album track lists on Discography: From the Vault: Vol. 5 - Los Angeles 2004, That Night in Toronto; setlists (41 entries); 'Bring It All Back' puzzles (40); '(Un)Locked' answer
- "As Makeshift As We Are" - album track lists on Discography: In Between Evolution; lyrics (filed under "In Between Evolution")
- jD's answer: ________________

**5. At the Hundredth Meridian**

- "At the Hundredth Meridian" - song page title; album track lists on Discography: Fully Completely, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 4 - Brussels 1994, From the Vault: Vol. 5 - Los Angeles 2004, From the Vault: Vol. 6 - Cleveland 1996, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Fully Completely Box Set, Phantom Power Box Set, That Night in Toronto, A National Celebration; lyrics (filed under "Fully Completely"); setlists (780 entries); 'Bring It All Back' puzzles (754); '(Un)Locked' answer; Music Videos
- "At The Hundredth Meridian" - Unplucked Gems (4)
- jD's answer: ________________

**6. Bobcaygeon**

- "Bobcaygeon" - song page title; album track lists on Discography: Phantom Power, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 5 - Los Angeles 2004, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Phantom Power Box Set, That Night in Toronto, A National Celebration; lyrics (filed under "Phantom Power"); setlists (562 entries); 'Bring It All Back' puzzles (548); '(Un)Locked' answer; Unplucked Gems (4); Music Videos
- "Bob Caygeon" - Unplucked Gems (6)
- jD's answer: ________________

**7. Born in the Water**

- "Born in the Water" - song page title; album track lists on Discography: Road Apples, Road Apples Box Set; lyrics (filed under "Road Apples"); setlists (1 entry); 'Bring It All Back' puzzles (1); '(Un)Locked' answer
- "Born In The Water" - Unplucked Gems (6)
- jD's answer: ________________

**8. Butts Wigglin'**

- "Butts Wigglin'" - song page title; album track lists on Discography: Trouble at the Henhouse, From the Vault: Vol. 6 - Cleveland 1996; lyrics (filed under "Trouble at the Henhouse"); '(Un)Locked' answer
- "Butts Wigglin" - setlists (59 entries); 'Bring It All Back' puzzles (58)
- jD's answer: ________________

**9. Courage (For Hugh MacLennan)**

- "Courage (For Hugh MacLennan)" - song page title; '(Un)Locked' answer
- "Courage (for Hugh MacLennan)" - album track lists on Discography: Fully Completely, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 5 - Los Angeles 2004, From the Vault: Vol. 6 - Cleveland 1996, Yer Favourites, Hipeponymous, Fully Completely Box Set, That Night in Toronto, A National Celebration; lyrics (filed under "Fully Completely"); setlists (650 entries); 'Bring It All Back' puzzles (633); Music Videos
- "Courage" - album track lists on Discography: Live Between Us, From the Vault: Vol. 4 - Brussels 1994
- jD's answer: ________________

**10. Crack My Spine Like a Whip**

- "Crack My Spine Like a Whip" - song page title; album track lists on Discography: Road Apples Box Set, Up to Here Box Set, Saskadelphia; lyrics (filed under "Saskadelphia"); setlists (15 entries); 'Bring It All Back' puzzles (14); '(Un)Locked' answer
- "Crack My Spine Like A Whip" - Unplucked Gems (1)
- jD's answer: ________________

**11. Escape Is at Hand for the Travellin' Man**

- "Escape Is at Hand for the Travellin' Man" - song page title; album track lists on Discography: Phantom Power, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Phantom Power Box Set; lyrics (filed under "Phantom Power"); setlists (275 entries); 'Bring It All Back' puzzles (268); '(Un)Locked' answer
- "Escape Is At Hand For The Travellin' Man" - Unplucked Gems (4)
- jD's answer: ________________

**12. Fifty Mission Cap**

- "Fifty Mission Cap" - song page title; '(Un)Locked' answer
- "Fifty-Mission Cap" - album track lists on Discography: Fully Completely, From the Vault: Vol. 1 - Halifax 1995, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Fully Completely Box Set, A National Celebration; lyrics (filed under "Fully Completely"); setlists (227 entries); 'Bring It All Back' puzzles (212); Unplucked Gems (3)
- jD's answer: ________________

**13. Fire in the Hole**

- "Fire in the Hole" - song page title; album track lists on Discography: Day for Night, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 4 - Brussels 1994, From the Vault: Vol. 5 - Los Angeles 2004; lyrics (filed under "Day for Night"); setlists (346 entries); 'Bring It All Back' puzzles (334); '(Un)Locked' answer
- "Fire In The Hole" - Unplucked Gems (10)
- jD's answer: ________________

**14. Grace, Too**

- "Grace, Too" - song page title; album track lists on Discography: Day for Night, Live Between Us, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 4 - Brussels 1994, From the Vault: Vol. 5 - Los Angeles 2004, From the Vault: Vol. 6 - Cleveland 1996, Yer Favourites, Hipeponymous, Phantom Power Box Set, That Night in Toronto, A National Celebration; lyrics (filed under "Day for Night"); setlists (718 entries); 'Bring It All Back' puzzles (687); '(Un)Locked' answer; Music Videos
- "Grace Too" - Unplucked Gems (2)
- jD's answer: ________________

**15. Hailstone Hands of God**

- "Hailstone Hands of God" - song page title; album track lists on Discography: Up to Here Box Set; lyrics (filed under "Up To Here Box Set"); '(Un)Locked' answer
- "Hailstone Hands Of God" - Unplucked Gems (1)
- jD's answer: ________________

**16. I'll Believe In You (Or I'll Be Leaving You Tonight)**

- "I'll Believe In You (Or I'll Be Leaving You Tonight)" - song page title; setlists (1 entry); 'Bring It All Back' puzzles (1); '(Un)Locked' answer
- "I'll Believe in You (Or I'll Be Leaving You Tonight)" - album track lists on Discography: Up to Here, Live at the Roxy, Road Apples Box Set, Up to Here Box Set; lyrics (filed under "Up to Here")
- "I'll Believe in You (or I'll Be Leaving You Tonight)" - setlists (42 entries); 'Bring It All Back' puzzles (38)
- "I'll Believe In You" - Unplucked Gems (3)
- jD's answer: ________________

**17. I'm a Werewolf, Baby**

- "I'm a Werewolf, Baby" - song page title; album track lists on Discography: The Tragically Hip; lyrics (filed under "The Tragically Hip"); '(Un)Locked' answer
- "I’m a Werewolf, Baby" - setlists (6 entries); 'Bring It All Back' puzzles (3)
- "I'm A Werewolf Baby" - Unplucked Gems (1)
- jD's answer: ________________

**18. Inevitability of Death**

- "Inevitability of Death" - song page title; album track lists on Discography: Day for Night, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 4 - Brussels 1994; lyrics (filed under "Day for Night"); setlists (137 entries); 'Bring It All Back' puzzles (125); '(Un)Locked' answer
- "Inevitability Of Death" - Unplucked Gems (1)
- jD's answer: ________________

**19. It's a Good Life If You Don't Weaken**

- "It's a Good Life If You Don't Weaken" - song page title; album track lists on Discography: In Violet Light, From the Vault: Vol. 2 - Austin 2002, From the Vault: Vol. 3 - Hamilton 2007, From the Vault: Vol. 5 - Los Angeles 2004, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, That Night in Toronto; lyrics (filed under "In Violet Light"); '(Un)Locked' answer; Music Videos
- "It's a Good Life if You Don't Weaken" - setlists (254 entries); 'Bring It All Back' puzzles (249)
- jD's answer: ________________

**20. Just As Well**

- "Just As Well" - song page title; '(Un)Locked' answer; Unplucked Gems (5)
- "Just as Well" - album track lists on Discography: Road Apples Box Set, Up to Here Box Set, Saskadelphia; lyrics (filed under "Saskadelphia")
- jD's answer: ________________

**21. Last Night I Dreamed You Didn't Love Me**

- "Last Night I Dreamed You Didn't Love Me" - song page title; album track lists on Discography: World Container; lyrics (filed under "World Container"); '(Un)Locked' answer
- "Last Night I Dreamed You Didn’t Love Me" - setlists (12 entries); 'Bring It All Back' puzzles (12)
- jD's answer: ________________

**22. Locked in the Trunk of a Car**

- "Locked in the Trunk of a Car" - song page title; album track lists on Discography: Fully Completely, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 4 - Brussels 1994, From the Vault: Vol. 6 - Cleveland 1996, Live July 22 - August 20, 2016, Yer Favourites, Hipeponymous, Fully Completely Box Set, A National Celebration; lyrics (filed under "Fully Completely"); setlists (356 entries); 'Bring It All Back' puzzles (339); '(Un)Locked' answer; Music Videos
- "Locked In The Trunk Of A Car" - Unplucked Gems (1)
- jD's answer: ________________

**23. Looking for a Place to Happen**

- "Looking for a Place to Happen" - song page title; album track lists on Discography: Fully Completely, Yer Favourites, Hipeponymous, Fully Completely Box Set; lyrics (filed under "Fully Completely"); setlists (82 entries); 'Bring It All Back' puzzles (81); '(Un)Locked' answer
- "Looking For A Place To Happen" - Unplucked Gems (1)
- jD's answer: ________________

**24. Luv (Sic)**

- "Luv (Sic)" - song page title; setlists (34 entries); 'Bring It All Back' puzzles (34); '(Un)Locked' answer
- "Luv (sic)" - album track lists on Discography: World Container; lyrics (filed under "World Container")
- jD's answer: ________________

**25. On the Verge**

- "On the Verge" - song page title; album track lists on Discography: Road Apples, Live at the Roxy, Road Apples Box Set, Up to Here Box Set; lyrics (filed under "Road Apples"); setlists (91 entries); 'Bring It All Back' puzzles (87); '(Un)Locked' answer
- "On The Verge" - Unplucked Gems (3)
- jD's answer: ________________

**26. Ouch**

- "Ouch" - song page title; album track lists on Discography: Road Apples Box Set, Saskadelphia; lyrics (filed under "Saskadelphia"); '(Un)Locked' answer; Unplucked Gems (3); Music Videos
- "Ouch!" - setlists (13 entries); 'Bring It All Back' puzzles (13)
- jD's answer: ________________

**27. Rain, Hearts and Fire**

- "Rain, Hearts and Fire" - song page title; album track lists on Discography: Up to Here Box Set; lyrics (filed under "Up To Here Box Set"); setlists (1 entry); 'Bring It All Back' puzzles (1); '(Un)Locked' answer
- "Rain, Hearts & Fire" - Unplucked Gems (1)
- jD's answer: ________________

**28. Save the Planet**

- "Save the Planet" - song page title; album track lists on Discography: Phantom Power, Phantom Power Box Set; lyrics (filed under "Phantom Power"); setlists (125 entries); 'Bring It All Back' puzzles (122); '(Un)Locked' answer
- "Save The Planet" - Unplucked Gems (9)
- jD's answer: ________________

**29. The Last of the Unplucked Gems**

- "The Last of the Unplucked Gems" - song page title; album track lists on Discography: Road Apples, From the Vault: Vol. 1 - Halifax 1995, From the Vault: Vol. 4 - Brussels 1994, Live July 22 - August 20, 2016, Road Apples Box Set; lyrics (filed under "Road Apples"); setlists (147 entries); 'Bring It All Back' puzzles (138); '(Un)Locked' answer
- "Last of the Unplucked Gems" - album track lists on Discography: A National Celebration
- "Last Of The Unplucked Gems" - Unplucked Gems (3)
- jD's answer: ________________

**30. We'll Go Too**

- "We'll Go Too" - song page title; album track lists on Discography: From the Vault: Vol. 1 - Halifax 1995, Fully Completely Box Set; setlists (110 entries); 'Bring It All Back' puzzles (107); '(Un)Locked' answer; Unplucked Gems (1)
- "We'll Go, Too" - album track lists on Discography: Fully Completely; lyrics (filed under "Fully Completely")
- jD's answer: ________________

**31. When the Weight Comes Down**

- "When the Weight Comes Down" - song page title; album track lists on Discography: Up to Here, Up to Here Box Set; lyrics (filed under "Up to Here"); setlists (10 entries); 'Bring It All Back' puzzles (7); '(Un)Locked' answer
- "When The Weight Comes Down" - Unplucked Gems (2)
- jD's answer: ________________

**32. Yawning or Snarling**

- "Yawning or Snarling" - song page title; album track lists on Discography: Day for Night, From the Vault: Vol. 4 - Brussels 1994; lyrics (filed under "Day for Night"); setlists (56 entries); 'Bring It All Back' puzzles (54); '(Un)Locked' answer
- "Yawning Or Snarling" - Unplucked Gems (7)
- jD's answer: ________________

**Two that only differ by a curly apostrophe** (song 17 'I'm a Werewolf, Baby' and song 21 'Last Night I Dreamed You Didn't Love Me' above): the setlist copies use a curly ’ where the rest of the site uses a straight '. Fans mostly won't see the difference, but the matching code has to allow for it.

---

## 3. Album tracks that don't match their song, and the box set title (DATA-06)

**What the site shows today:** when a fan flips these album tracks on the Discography page, the card says "No live performance data available", and the song page doesn't list the release, because the track title doesn't match the song's title.

- 'Courage' - "Live Between Us", track 8, and "From the Vault: Vol. 4 - Brussels 1994", track 3. The song page is 'Courage (For Hugh MacLennan)' (650 setlist entries).
  - Question: is the official track title on those two releases 'Courage' (so the site should just link it to 'Courage (For Hugh MacLennan)'), or should the track list be retitled?
  - jD's answer:
- 'Last of the Unplucked Gems' - "A National Celebration", track 17. The song page is 'The Last of the Unplucked Gems'.
  - Question: is 'Last of the Unplucked Gems' (no "The") the official track title on that release?
  - jD's answer:
- 'Just Another Midnight (Demo)' - the Up to Here box set, track 39. This one fails only because the box set's name is spelled two ways: "Up to Here Box Set" on the Discography page (`js/discography-app.js`) and "Up To Here Box Set" in `data/discography.json` (which is what song pages print).
  - Question: which spelling of the box set's name should the site use?
  - jD's answer:
- 'Picture My Face' - "From the Vault: Vol. 3 - Hamilton 2007", track 20 on the site. It isn't on the official song list, so it has no song page.
  - Question: is it a song by The Hip that belongs on the official song list (your Google Form), and is it really on that release?
  - jD's answer:

---

## 4. Four official songs with no release on the site (DATA-11)

**What the site shows today:** 'Dare Devil (Reprise)', 'Forest Edge', 'Problem Bears' and 'Ultra Mundane' are on the official song list and each has a song page, but no release on the site lists them, so the "First released on" card is empty and the song pages show 0 live plays. Song pages:
- https://thehiphandbook.tthpods.com/song/dare-devil-reprise (its lyrics are borrowed from the "Day for Night" entry for 'Daredevil')
- https://thehiphandbook.tthpods.com/song/forest-edge
- https://thehiphandbook.tthpods.com/song/problem-bears
- https://thehiphandbook.tthpods.com/song/ultra-mundane

For reference, the lyrics file has 'Forest Edge', 'Problem Bears' and 'Ultra Mundane' filed under "In Violet Light", but the site's "In Violet Light" track list has 11 tracks and none of these three: 'Are You Ready', 'Use It Up', 'The Darkest One', 'It's a Good Life If You Don't Weaken', 'Silver Jet', 'Throwing Off Glass', 'All Tore Up', 'Leave', 'A Beautiful Thing', 'The Dire Wolf', 'The Dark Canuck'.

**The question for each:** which release (album, edition, or box set) is it on, and at what track number? If it's on a release the site doesn't list yet, name it and Claude Code will ask what else it needs.

- 'Dare Devil (Reprise)' - jD's answer:
- 'Forest Edge' - jD's answer:
- 'Problem Bears' - jD's answer:
- 'Ultra Mundane' - jD's answer:
- And should 'Dare Devil (Reprise)' keep sharing the 'Daredevil' lyrics? jD's answer:

---

## 5. Song names in the daily game that look like placeholders (GAME-11)

**What the site shows today:** these names sit in setlists that are 'Bring It All Back' puzzles. They aren't on the official song list, and the site's check lets them through only because they're on its "played but never released" list (`KNOWN_NOT_ON_LIST` in `scripts/audit-site.js`). Fans who know the band may read them as mistakes. Puzzle dates are in brackets.

**The question for each:** what is the right name (or is the name right as it is)? Renames go through `renameSongs` in `data/setlist-corrections.json`.

- "New Song" - Spokane, 26-07-1996, puzzle **No. 446** (January 18, 2028), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1996/metropolitan-performing-arts-center-spokane-wa-63ca8e0b.html); Pittsburgh, 13-06-1996, puzzle **No. 703** (October 1, 2028), where setlist.fm's own note says "Escape Is at Hand in the making", [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1996/metropol-pittsburgh-pa-5bfcf79c.html), Hip Archive file https://www.thehiparchive.com/Files/Audio/1996-06-13-Pittsburgh-PA-mp3.zip; Portland, 27-07-1996, puzzle **No. 921** (May 7, 2029), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1996/roseland-theater-portland-or-4bfcf70e.html)
  - jD's answer:
- "Past..." - Markham Fairgrounds, 22-07-1995, puzzle **No. 640** (July 30, 2028), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1995/markham-fairgrounds-markham-on-canada-13d01d5d.html), Hip Archive file https://www.thehiparchive.com/Files/Audio/1995-07-22-Markham-ON-mp3.zip
  - jD's answer:
- "Fighter fighter" - Tempe, 04-10-2004, puzzle **No. 271** (July 27, 2027), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2004/marquee-theatre-tempe-az-63cf76ab.html); Washington, DC, 25-09-2004, puzzle **No. 895** (April 11, 2029), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2004/930-club-washington-dc-6bff12ea.html); Cleveland, 19-09-2004, puzzle **No. 913** (April 29, 2029), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/2004/the-odeon-cleveland-oh-5bfcc76c.html), Hip Archive file https://www.thehiparchive.com/Files/Audio/2004-09-19-Cleveland-OH-mp3.zip
  - jD's answer:
- "Win" - The Phoenix Concert Theatre, Toronto, 09-12-1993, puzzle **No. 168** (April 15, 2027), [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1993/the-phoenix-concert-theatre-toronto-on-canada-23effcff.html)
  - jD's answer:
- Puzzle **No. 967** (June 22, 2029, the last scheduled 'Bring It All Back' puzzle) - The Theatre of Living Arts, Philadelphia, 01-10-1998, [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1998/the-theatre-of-living-arts-philadelphia-pa-2bfe0096.html), Hip Archive file https://www.thehiparchive.com/Files/Audio/1998-10-01-Philadelphia-PA-mp3.zip. Its setlist has three medley lines: "New Orleans Is Sinking / Elaborate / The Never-Ending Present", "Inevitability of Death / If You're Freaked" and "At the Hundredth Meridian / Lofty Pines / Blackflies".
  - Are "Elaborate", "The Never-Ending Present", "If You're Freaked", "Lofty Pines" and "Blackflies" the right names? jD's answer:
  - Is this a full-band show by The Hip? jD's answer:
- Puzzle **No. 891** (April 7, 2029) - Horseshoe Tavern, Toronto, 18-04-1992, [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1992/horseshoe-tavern-toronto-on-canada-1bd9d9a4.html), Hip Archive file https://www.thehiparchive.com/Files/Audio/1992-04-18-Toronto-ON-mp3.zip. It lists "You See Details" and "Blonde Solid".
  - Are those the right names? jD's answer:
  - Is this a full-band show by The Hip? jD's answer:
- "If You're Freaked" (No. 967 above) and "If You're Freaked, I'm Fucked" (Gino, Stockholm, 07-12-1994, in a medley with 'New Orleans Is Sinking', puzzle **No. 171**, April 18, 2027, [setlist.fm](https://www.setlist.fm/setlist/the-tragically-hip/1994/gino-stockholm-sweden-7bcf82c0.html)): same song?
  - jD's answer:
- The rest of the "played but never released" list, for a quick yes/no that each is a real song name: 'Heart Attack Love', 'Hiccups', 'Times Are Passing Us By', 'Waltz for Juliette', 'Running for Your Life', 'Baby Blueblood', 'Psychedelic Ramblings of Rich Kids', 'It's Snowing' (setlist.fm notes "Aka. If She's Seventeen"), 'Haven't You Heard', 'Old Wive's Tale', 'We Are the Next Us', 'I'm For Real'.
  - jD's answer:
- Puzzles I approve changing (by number):

The six setlists that list a song twice (the other half of GAME-11) are in section 1b.

FYI, no question needed: 275 of the 967 'Bring It All Back' shows have no tour name, so the second hint says "Tour: none listed". Filling those in would be a big job against setlist.fm and is not part of this list.

---

## 6. The 'Fireworks' lyrics start with a website header (BRAND-07)

**What the site shows today:** the lyrics for 'Fireworks' (https://thehiphandbook.tthpods.com/song/fireworks, and in lyrics search) start with the line "Tragically Hip Fireworks lyrics", then the first real line. It's in `data/lyrics.json` under "Phantom Power|||Fireworks". Lyrics are hand-edited, so this is your edit (or your OK for Claude Code to make it).

**The question:** OK to delete that first line, and nothing else?

- jD's answer:

---

## 7. Unplucked Gems totals (DATA-08) - fixed on the page, one question left

**What changed (Batch 10):** the four boxes at the top of Unplucked Gems now count straight from the sessions, using the same rule each album's panel already used: Full, Partial and Snippet count as "Available", everything else counts as "In the Vault". So the top now reads 545 Sessions, 15 Eras, 94 Available and 451 In the Vault (it used to say 87 and 439, which added up to 526, not 545). `data/unplucked-gems.json` itself wasn't touched.

**What's left:** 11 sessions have no availability at all in the tracker, so the page counts them as "In the Vault":
- "Day For Night": 'Fleater', 'Greasy [April 1994 Version]', 'Gun Free Japan', 'Sucker List'
- "Trouble At The Henhouse": 'Feaverish Dream Jam [January 10th 1995 Version]', 'Ahead By A Century [January 11th 1995 Version]', 'Ahead By A Century [January 12th 1995 Version]', 'Ahead By A Century [January 1996 Demo]', 'Notterdam', 'O'Brian's Song', 'Very Keef Jam'

And one says "Conflicting Sources" ('Laminar Flow', "Day For Night"), also counted as "In the Vault".

**The question:** what should each of those 12 show (Full, Partial, Snippet, Confirmed, Rumored, or leave as is)? These live in the tracker data, so the change has to come from the tracker or from you.

- jD's answer:

---

## 8. Not a question: the audio player's track names (DATA-07 / BRAND-01)

Batch 10 changed only how names are shown in the player and the home page's show card, not the data. In all, 1,788 of the 11,217 tracks (in 276 recordings) read differently; real song names are untouched.
- When a file name has a song title after its track code, the site shows just that title, with run-together words split: "T8TheWherewithal" and "tth1996 07 11d01t18 TheWherewithal" show "The Wherewithal". The title's wording and capitals are kept as the file has them (for example "Hundredth Meridian", "Dont Wake Daddy"), not swapped for the official title. 146 tracks.
- When a real title has the band name tacked on ("Poets Tragically Hip Las Vegas December 15 2012", "Courage The Tragically Hip"), it shows just the title. 57 tracks.
- When there's no readable title at all ("Track01", "thetragicallyhip1998 09 24audiencet05", or a venue line like "Tragically Hip 1985 07 01 Bath, ON"), it shows "Track 5" (its place in the recording). 1,585 tracks.

If you'd like the real song names on those "Track 5" tracks one day, that's a separate job: draft names from each show's setlist where the track count matches, you spot-check a sample, and only then apply.
