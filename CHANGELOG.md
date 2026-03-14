# Changelog

## v2.6.3
**UI Polish**
- Album vote breakdown now alternates gold and red text for voted songs, improving readability across cards
- Progress bars in the breakdown section restored to solid gold

## v2.6.2
**Data Accuracy & Badge Colors**
- Fixed "Buy at TheHip.com" button to link to thehip.com/pages/listen
- Track ranking badges now use two colors: gold for the Top 40 (#1-40) and red for #41-169
- Fixed Music @ Work chart position to #1 (was incorrectly unmarked)
- Fixed In Violet Light chart position to #2 (was incorrectly marked #1)
- Updated Canadian #1 albums count from 8 to 9
- Corrected Up to Here tracklist — removed EP tracks (Highway Girl, I'm a Werewolf Baby), added missing album tracks (Another Midnight, Opiated)
- Fixed #47 from "Dusk" to "Thugs"
- Fixed "Honey Please" spelling to "Honey, Please"
- Fixed Live at the Roxy track name to "I'll Believe in You"

## v2.6.1
**TTH Top 40 Expansion & TheHip.com**
- Added all 169 voted songs from the fan countdown (previously only Top 40)
- Ranking badges now appear on every voted track across all album pages
- Added collapsible "The Full 169" section showing songs #41-169 with point totals
- Added Album Vote Breakdown — visual cards showing which albums had the most voted songs, with voted/unvoted track lists and percentage bars
- Added "Buy at TheHip.com" pill button on every album modal, linking out in a new tab
- Apple Music "Open in Apple Music" buttons added to album modals and Random Hip Song results

## v2.6.0
**Apple Music, Spotify Fixes & Deployment**
- Deployed app to GitHub Pages at tthpodcastseries.github.io for permanent HTTPS hosting
- Added GitHub Actions workflow for automatic deployment on push
- Added Apple Music link buttons on album modals (pink pill, opens Apple Music)
- Added Apple Music link on Random Hip Song results
- Fixed Spotify OAuth — redirect URI updated from localhost to GitHub Pages URL
- Fixed Spotify auth persistence — switched from sessionStorage to localStorage so login survives page reloads
- Added "Requires Spotify Premium" note under the Connect Spotify button
- Removed red single indicator dots from track listings (cleaner look)
- Updated version to v5.6 in footer
