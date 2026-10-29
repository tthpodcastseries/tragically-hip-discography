# The Hip Handbook - Data Fact Check - October 2026

Date: 2026-10-29 · Version checked: v5.1.4 (local repo, `main` @ 6f0be98)

> **Status (v5.1.5, 2026-10-29):** Sections 1, 2, 3, and 5 are fixed, along with the confirmed items in 4 and 6. See `docs/CHANGELOG.md`.
>
> **Corrections to this report after more research:**
> - **Pinkpop 1991 (2.1) was a real gig.** The Hip Archive has a recording of the 1991 set (Blow at High Dough, Twist My Arm, Little Bones), and a fan concert archive lists the Hip on the 1991 bill. setlist.fm had added three 1995 songs, so the set was trimmed and the date kept.
> - **Vancouver, July 1, 1992 is likely real.** A soundboard video and a MusicBrainz bootleg are both dated that day, so it isn't flagged. The Barrie recording that was attached to it was detached.
> - **"Jan 1, 2004" Sydney** turned out to be a duplicate of Dec 4, 2004, and was removed.
> - **"Jan 1, 2000" ACC** is a 2000 Music @ Work-era show with an unknown date, not New Year's Eve 1999. That show is a separate entry already in the data.
> - **Medleys (2.3) were already split** by the song index, the Passport, and the canonical song list, so no change was needed.
> - **Skeleton Park (1.8)** is on a We Are the Same edition (MusicBrainz), so its tag stays.
>
> **Still open (section 8 and the unverified rows):**
> - music video directors
> - Vault release dates
> - first-week sales figures
> - Juno for the Bobcaygeon doc
> - the Yer Favourites release date (Nov 1 vs Nov 8)
> - Saskadelphia's Canadian peak (#1 vs #2)
> - solo track lists
> - the full Top 40 against `TTH Top 40.numbers`
> - cover art for the 2016 live album
> - two missing releases that need track lists: Live at CBGB and Coke Machine Glow: Songwriters' Cabal

**Scope:** every hardcoded fact in `js/discography-app.js` (albums, track lists, singles, Junos, chart peaks, certifications, box sets, video releases, solo projects, Top 40), the `data/` JSON files (setlists, tour data, milestones / On This Day, music videos), and the stat blocks.

**Sources used:**
- MusicBrainz API: track listings for every release, pulled programmatically and diffed.
- Wikipedia: the Hip discography, The Tragically Hip and Gord Downie pages, and the Saskadelphia page.
- setlist.fm: spot checks.
- jD's own TTHTop40 transcripts in `Documents/Podcasts/TTH Top 40/TTHTop40 - Transcripts`.

**Confidence key:**
- **Confirmed:** a primary source says otherwise.
- **Likely:** strong evidence, but worth a second look.
- **Unverified:** I couldn't confirm it either way.

---

## 1. Fix these first (confirmed errors)

### 1.1 Fully Completely track order is wrong
Tracks 9 and 10 are swapped. The real order is **9. Fifty Mission Cap, 10. Wheat Kings**. The site has Wheat Kings first in two places:
- `js/discography-app.js:60` (studio album)
- `data/discography.json` (Fully Completely entry)

The box-set entry (`:322`) already has the correct order. Source: MusicBrainz, original 1992 MCA CD.

### 1.2 Three box set track lists are mostly invented
Disc 1 of each box set is a different album from the one the site shows, and the bonus discs listed on the site don't exist.

| Box set | What the site shows | What's actually in it (MusicBrainz) |
|---|---|---|
| **Road Apples (2021)** `:327` | Disc 1 is missing Twist My Arm and On the Verge, and adds "Here in the House" and "Road Apples". Also lists 13 fake "(Live)" tracks plus "Killer Whale", "Frozen in the Middle", "Baby Blue", "The Land Between", "Hurry Up and Wait", "This Is Nowhere". | Disc 1: Road Apples · Disc 2: Saskadelphia · Disc 3: *Live at the Roxy, May 3, 1991* · Disc 4: *Hoof Hearted* (9 demos and outtakes: Cordelia outtake, Bring It All Back Feb 1990 demo, Fiddler's Green alternate, Fight outtake, Born in the Water outtake, Little Bones acoustic, If You Lived Here, Angst on the Planks, The Last of the Unplucked Gems full length) · Blu-ray. Released Nov 5 (digital) / Nov 12, 2021 (box). The site says Oct 15. |
| **Phantom Power (2023)** `:332` | Opens with "Filtration Kiss". Includes "Phantom Power" (a fake song) and "Insomniacs of the World, Goodnight" (a Gord solo song). Disc 1 is missing Poets and Chagrin Falls. The live disc and alternate versions are invented. | Disc 1: the 12 album tracks + Bumblebee, Insomniacs, Songwriter's Cabal, Vegas Strip, Mystery · Disc 2: *Live at Metropol, Oct 2, 1998* (15 tracks) · Disc 3: Poets (Super Farmer Nano Baby version) + 6 alternate mixes |
| **Up to Here (2024)** `:337` | Disc 1 is in the wrong order. It adds Take Forever (a Now for Plan A song), The Darkest One and Twist My Arm, and drops I'll Believe in You. All the "(Live)" and "(Demo)" tracks are invented. | Disc 1: the 11 album tracks + She's Got What It Takes, Get Back Again, Rain, Hearts and Fire, Wait So Long · Disc 2: *Live at the Misty Moon* (14 tracks) · Disc 3: *How We Got Here - The 1988 Demos* (10 tracks, incl. Hailstone Hands of God, Just Another Midnight) |
| **Fully Completely (2014)** `:322` | Disc 1 is right. The live disc is invented: wrong order, includes Highway Girl and New Orleans Is Sinking, and is missing Twist My Arm. | Disc 2: *Live at the Horseshoe Tavern, Sept 13, 1992*. In order: At the Hundredth Meridian, Fifty Mission Cap, We'll Go Too, Fully Completely, Pigeon Camera, Twist My Arm, Lionized, Wheat Kings, Eldorado, Looking for a Place to Happen, Courage, Locked in the Trunk of a Car, The Wherewithal |

The descriptions are generic too ("remastered audio, bonus tracks, live recordings"). They should name the actual bonus discs listed above.

### 1.3 On This Day milestones: three are wrong (`data/discography.json` → `milestones`)
- **"Inducted into the Rock and Roll Hall of Fame - Nov 18, 2024."** I found no evidence this happened. Wikipedia's band article lists no Rock and Roll Hall of Fame induction. **Remove it.**
- **"Inducted into the Canadian Music Hall of Fame - Dec 11, 2024."** Wrong year. They were inducted in **2005**, at the Juno Awards in Winnipeg (April 3, 2005).
- **"Inducted into the Canadian Songwriters Hall of Fame - June 22, 2024."** Wrong year. They were **announced April 28, 2026 and inducted in September 2026** (CTV/CP24 coverage dated Sept 27, 2026).
- *Likely:* "Formed Jan 1, 1984" is a placeholder date. Only the year is known. Showing it every New Year's Day presents a guess as fact.
- *Likely:* "First official gig at Kingston's Trash Can, Feb 5, 1986" conflicts with your own setlist data, which has gigs from 1985 (Copper Penny, Feb 27, 1985). Either reword it or drop it.
- *Missing:* Canada's Walk of Fame (2002) is a real milestone that isn't listed.

### 1.4 Live Between Us
- Release date: the site says **November 18, 1997**. It was **May 20, 1997** (Wikipedia; MusicBrainz says late May 1997).
- Certification: the site says **6x Platinum**. Wikipedia says **4x Platinum**.

### 1.5 Yer Favourites (`:306`, `data/discography.json`)
- Chart: the site says it **debuted at #8**. Wikipedia lists it at **#1, certified Diamond**.
- Release date: the site says **Nov 1, 2005**. Wikipedia says **Nov 8**. MusicBrainz says Nov 1, so this one is *Likely* rather than certain. The chart peak is the bigger problem.

### 1.6 Up to Here chart peak
The site says **#13** (`:15`). Wikipedia says **#9 in Canada** (and #170 US).

### 1.7 Saskadelphia (`:352`)
- **"Recorded at Barris Studios in New Orleans" is wrong.** It was recorded at **Kingsway Studio** (Daniel Lanois's place), in the same sessions as Road Apples. Bruce Barris was the engineer, which is probably where "Barris" came from. This also contradicts the site's own Road Apples entry, which correctly says Kingsway.
- "#66 in the U.S." is the Billboard **Top Current Albums** chart, not the Billboard 200. Say which chart.
- Canadian peak: the site says #2. The Wikipedia discography also says #2, but Billboard Canada reported a **#1 debut**. The sources disagree, so pick one and cite it.

### 1.8 Wrong album tags in the Top 40 list (`beyondTop40`, `:1150`)
- **#155 The Drop-Off** is tagged *In Between Evolution*. It's a *World Container* track (the site's own track list agrees).
- **#157 Skeleton Park** is tagged *We Are the Same*. It isn't on any standard edition of We Are the Same. *Unverified* where it came from (possibly a bonus or iTunes track). Check this.

### 1.9 Nine singles are marked "Unranked" but have a rank
These singles show "Unranked" on the album pages, but each has a rank in your own 169-song vote:

| Single | Album | Actual rank |
|---|---|---|
| On the Verge | Road Apples | #91 |
| 700 Ft. Ceiling | Trouble at the Henhouse | #76 |
| Something On | Phantom Power | #61 |
| The Completists | Music @ Work | #116 |
| It Can't Be Nashville Every Night | In Between Evolution | #52 |
| Family Band | World Container | #103 |
| Morning Moon | We Are the Same | #73 |
| Speed River | We Are the Same | #161 |
| What Blue | Man Machine Poem | #135 |

The singles that already use "Road #N" labels show the right pattern.

### 1.10 Countdown year
- The Top 40 stat says **"Countdown Year: 2024"** (`:519`), and the view description says "2024-25 countdown" (`:2730`).
- Your transcripts date the countdown **May-October 2025**, and about-me.md says 2025.
- The vote may have been taken in 2024. If so, label it "Vote: 2024 · Countdown: 2025". If not, change it to 2025.

---

## 2. Setlist and tour data

All of this is inherited from setlist.fm (pulled March 17, 2026). The site is faithfully copying setlist.fm's mistakes. Fix them here, and if you want, also on setlist.fm.

### 2.1 Impossible dates
- **Pinkpop, Landgraaf - dated May 20, 1991** (`bdbbde2`). The setlist includes Nautical Disaster, Fire in the Hole and Ahead by a Century, songs that didn't exist until 1994-96. This is almost certainly the **1995** Pinkpop set, misdated. *Confirmed* on setlist.fm itself: the page shows those songs under 1991.
- **Lux Steakhouse, Edmonton - Feb 27, 2007** (`13b05dd1`). It sits between Long Beach on Feb 26 and Phoenix on Feb 28, and it includes **Ocean Next**, a 2016 song. The date is wrong.
- **Shows in two or three cities on the same day:**
  - **Dec 31, 1989:** Club Soda, Montreal *and* 86 Street, Vancouver
  - **July 1, 1992:** St. John's, Barrie, *and* Vancouver
  - **July 1, 1989:** Ottawa plus two separate Barrie entries
- **Duplicate entries for the same show:**
  - Calgary, Sept 7, 2013 (one with 0 songs, one with 21)
  - Kingston, Oct 21, 1985
  - Martyrs', Chicago, Aug 6, 1998 (this might be a real early and late show)
- **Placeholder Jan 1 dates:**
  - **Centre 200, Sydney NS - "Jan 1, 2004".** It has a full In Between Evolution set, so it's a placeholder.
  - **Air Canada Centre - "Jan 1, 2000".** This is probably the New Year's Eve 1999 show.
  - Kingston - "Jan 1, 1995"
  - Alfie's - "Jan 1, 1988"
  - These dates also feed On This Day and the Bring It All Back game, so a guessed date gets presented as an answer.

### 2.2 Wrong tour labels
- **Five Netherlands shows from Nov 28 to Dec 4, 1994** are tagged "Fully Completely Tour". They're the European leg of the **Day for Night** tour. The Brussels show the next night (Dec 5, 1994) is literally Vault Vol. 4, "Day for Night world tour".
- **About 25 Day for Night shows from Sept-Dec 1994 have no tour tag at all**, so the "Day For Night" tour appears to start Jan 1, 1995.
- **520 of 1,358 shows (38%) have no tour.** The "23 Tours" stat counts radio broadcasts and one-off festivals (Q107 Broadcast, Music Without Borders, Ovation Music Festival) as tours.

### 2.3 Other setlist noise
- **33 blank song entries across 26 shows.** One of them is in the **final Kingston show**, so that setlist shows 31 songs instead of 30.
- **Non-song items counted as songs**, which inflates per-show counts and live stats:
  - "Interview 1/2", "Show Intro", "Band Intro", "Introduction", "Jamming", "New Song", "Past..."
  - 31 medley entries like "New Orleans Is Sinking / Nautical Disaster" that don't count toward either song.
- **Song name typos:** "Raining Hearts of Fire" should be *Rain, Hearts and Fire*. "She's Got All It Takes" should be *She's Got What It Takes*.
- **14 shows have a blank venue name** in both `setlists.min.json` and `tth-tour-data.json`.
- **Two non-concert entries are counted in the "1,358 live shows":** Massey Hall, June 6, 2021 (the Junos performance) and NAC Ottawa, Sept 16, 2022. The site says "1985 to 2016", but the raw data runs to 2022.

### 2.4 Checked and fine
- **Final show (Aug 20, 2016) vs *A National Celebration*:** same 30 songs in the same order, once the blank entry is removed. The only difference is that A National Celebration says "Music at Work" instead of *My Music at Work* (`:380`).
- **`tth-tour-data.json` vs `setlists.min.json`:** IDs, dates, cities and song counts all agree.
- **Site counts:** 1,358 shows, 302 cities, 169 lyrics and 625 playable shows all match the data.

---

## 3. Track listings - checked and correct
These match MusicBrainz track for track:
- All 13 studio albums (except the Fully Completely swap in 1.1)
- The 1987 EP
- Saskadelphia
- Live Between Us
- Live at the Roxy
- All six Live From The Vault volumes
- Yer Favourites
- That Night in Toronto

Small title fixes:
- **Vault Vol. 5:** "My Music @ Work" should be *My Music at Work*.
- **Title spelling:** the official title is *Fifty Mission Cap* (no hyphen) on the original release. MusicBrainz uses a hyphen. Your call, but be consistent.

---

## 4. Album facts

| Item | Site says | Source says | Status |
|---|---|---|---|
| Release dates (Up to Here, Road Apples, Day for Night, and the rest of the studio albums) | as listed | Match Wikipedia | OK |
| Studio chart peaks (except Up to Here) and "9 Canadian #1s" | as listed | Match Wikipedia | OK |
| Road Apples, Fully Completely certified Diamond | Diamond | Diamond | OK |
| Trouble at the Henhouse Junos | Album + Rock Album 1997 | Same, plus **Group of the Year 1997** | Add Group of the Year |
| Phantom Power Junos, Bobcaygeon Single 2000, Music @ Work 2001, Man Machine Poem 2017 | as listed | Match | OK |
| Hipeponymous Juno | "Best Album Design (2006)" | **CD/DVD Artwork Design of the Year *and* Music DVD of the Year (2006)** | Fix the name, add the second award |
| Bobcaygeon doc - "Music DVD of the Year (2013)" | listed | Not in Wikipedia's list of Hip Juno wins | Unverified - check junoawards.ca |
| Now for Plan A "highest US chart: #129 Billboard 200" | #129 | True among the studio albums (Henhouse 134, Music @ Work 139, Phantom Power 143...) | OK, but see 1.7 for the Saskadelphia wording |
| Final show: 11.7M viewers, Aug 20, 2016, K-Rock Centre | as listed | Match | OK |
| Day for Night "300,000 in first 4 days" / Phantom Power "108,000 first week" / Fully Completely "300,000 first year" | listed | No source found | Unverified |
| Road Apples "First album with all lyrics by Gord Downie" | listed | No source found. Hip songwriting is credited to the band | Unverified - consider removing |
| Long Time Running release | Sept 14, 2017 | That's the TIFF premiere. The DVD/Blu-ray came out Nov 2017 | Clarify |
| The Completists as a Music @ Work single | listed | Not in Wikipedia's singles list (My Music at Work, Lake Fever, Freak Turbulence) | Unverified |

---

## 5. Missing releases
The site's "complete" discography is missing these:
- **The Tragically Hip: Live July 22 - August 20, 2016.** Released **Aug 21, 2026**, #46 in Canada (Wikipedia and MusicBrainz). This is a major omission. The Live category still says "Latest Release: 2022".
- **Live at CBGB.** Record Store Day vinyl, April 20, 2024 (MusicBrainz).
- **Coke Machine Glow: Songwriters' Cabal (2021).** A Gord solo release that charted at #10 in Canada (Wikipedia). It isn't in the solo list, which also makes the "19 Solo Releases" stat low.

---

## 6. Solo projects
- **Away Is Mine: "Produced by Nilling & LaBelle"** - I found no source for this. Wikipedia says it was co-written with Josh Finlayson. *Likely wrong, remove it.* Also *unverified:* the 10 "(Acoustic)" bonus tracks listed.
- **Mercury Sea: "Mixed by David Botrill"** - the producer's name is spelled **David Bottrill**.
- **Introduce Yerself** (first #1, released 10 days after his death) - confirmed.
- **Lustre Parfait** (2023, with Bob Rock) - confirmed. Wikipedia gives May 5, 2023.
- **Live at 6 O'Clock** (Feb 2026) - confirmed.
- **Downie bio: "His final completed project, Secret Path (2016)"** is arguable. Introduce Yerself was finished after it. Consider "his last album released in his lifetime".
- **Stripper's Union, Paul Langlois, Gord Sinclair and Johnny Fay track lists and dates:** *unverified.* These releases are too small for MusicBrainz or Wikipedia coverage. Worth checking against the actual records or Bandcamp pages.

---

## 7. Top 40
- **Internal consistency is solid.** All 169 ranks are unique and contiguous. Points descend correctly. Every "Top 40 #N" single label matches the list. Each album's `bestRank` matches its best-ranked track. The song pages are built from the same array, so there's no drift between pages.
- **Against your transcripts:** I spot-checked #40 (We Want to Be It), #32 (Emperor Penguin), #25 (Boots or Hearts), #22 (Long Time Running), #8 (Locked in the Trunk of a Car), #7 (Nautical Disaster), #6 (Blow at High Dough), #5 (Little Bones), #3 (38 Years Old) and #2 (Ahead by a Century). All match.
- **Not checked:** the full 1-169 ranking and points against your master sheet (`TTH Top 40.numbers`). I can't read Numbers files directly. If you export it to CSV, I can diff all 169 in one pass.
- **Real fixes here:** see 1.8, 1.9 and 1.10.

---

## 8. Not verified (flagged, not judged)
- **Music video directors (34):** no reliable public source covers most of them. IMVDb confirms only Bruce McCulloch (My Music at Work) and Max Montalvo (The Lookahead). Some names look off to me ("Roger Evan Larry" for Little Bones). I'd treat the whole column as unconfirmed until it's checked against MuchMusic or label credits.
- **Live From The Vault release dates:** these were sold only through the band's website, and MusicBrainz's digital dates (Dec 2008 / Apr 2009 / Dec 2009) don't match the site's six separate dates. I can't settle it.
- **Heksenketel** ("original working title for the tour"), **No Dress Rehearsal** (IMDb 9.3, "most-watched Canadian doc series on Prime"), and **That Night in Toronto** directors: unverified. The IMDb score will drift over time, so consider dropping it.
