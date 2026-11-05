#!/usr/bin/env node
// build-podcasts.js - the Radio Show pages: /podcasts and one page per show (v5.7).
//
// The whole network is one RedCircle feed ("The Tragically Hip Podcast Series"), so this
// sorts every episode onto its show by title, season and date (RULES below), and writes:
//
//   podcasts.html               the hub: one button per show
//   podcasts/<slug>.html        one page per show: artwork, description, episode guide
//   sitemap.xml                 the block between <!-- podcasts:start --> and <!-- podcasts:end -->
//
// The show names, years, artwork and descriptions are hand-edited in data/podcast-shows.json.
// The feed itself is saved in data/podcast-feed.json (generated: never edit it by hand).
// Do not edit the pages by hand either: change the JSON or this script and re-run.
//
//   node scripts/build-podcasts.js --fetch   read the feed again (needs the internet), then build
//   node scripts/build-podcasts.js           build from the saved feed (no internet)
//   node scripts/build-podcasts.js --check   only report out-of-date files (audit-site.js runs this)
//
// After a --fetch, any new episode the rules can't place is listed as "not sorted": add a
// rule (or a SKIP line) here and build again. Node 22, no packages.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://thehiphandbook.tthpods.com';
const SHOWS_FILE = path.join(ROOT, 'data/podcast-shows.json');
const FEED_FILE = path.join(ROOT, 'data/podcast-feed.json');
const CHECK = process.argv.includes('--check');
const FETCH = process.argv.includes('--fetch');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = iso => { const p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; };
const fmtLength = sec => {
  const m = Math.round(sec / 60);
  if (m < 60) return Math.max(m, 1) + ' min';
  return Math.floor(m / 60) + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
};
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// ---- What goes where (jD's rulings, November 5, 2026) ----

// Left off the pages entirely. First match wins.
const SKIP = [
  [/sunday evening jam|^sunday, february 09$/i, 'Sunday Evening Jam (scrapped)'],
  [/in memoriam/i, 'In Memoriam (scrapped)'],
  [/merry christmas/i, 'Christmas episode (scrapped)'],
  [/evening for sara j/i, 'An Evening For Sara J (scrapped)'],
  [/forest of whispering speakers/i, 'retired name (scrapped)'],
  // Anniversary re-releases: the same audio as an earlier episode, which stays on its show
  [/ @ (thirty-six|31|33)$| at (19|5|twelve)$| turns 21$|^coke machine glow - 24$/i, 're-release of an earlier episode'],
  [/^(gordon edgar downie\b|for gord\.\.\.$|gord\.?$)/i, 'Gord tribute (scrapped)'],
  [/^remember montreal/i, 'Remember Montreal (scrapped)'],
  [/^survivor pool results/i, 'Survivor Pool Results (scrapped)'],
  // Calls, announcements, updates and trailers (jD, 2026-11-05)
  [/call for|^pod list iv 911$|introducing pod-list|^i need yer hipstories$|^house keeping$|announcement$|update|^a celebration of the hip for als$|^and that's a wrap$/i, 'call or announcement (scrapped)'],
  [/trailer|sneak preview|is coming\.\.\.$|^discovering downie$|^the tragically hip top 40 countdown$|an evening for the downie wenjack fund/i, 'trailer (scrapped)'],
];

// One copy of each: these were replaced by a corrected or later upload
const OLDER_COPY = [
  ep => ep.title === 'Fully & Completely: redux - Day For Night', // the "(corrected)" upload replaces it
  ep => ep.title === 'Flashback #15', // replaced by 'Flashback #15 *My Music at Work"'
  ep => ep.title === '"March 25 1995"', // replaced by the 2026 podUMENTARY
  ep => isPodList(ep) && ep.date < '2026-04-01', // every podList was uploaded again in spring 2026
];

const isPodList = ep => /^pod-?\s?list/i.test(ep.title);

// Where a kept episode goes: a list of [show slug, section name or null]
function place(ep) {
  const t = ep.title, d = ep.date, s = ep.season;
  if (isPodList(ep)) return [['the-completists', 'podList']];
  if (/podumentary/i.test(t)) return [['the-completists', 'podUMENTARY']];
  if (/^gedfest past/i.test(t)) return [['the-completists', 'GEDfest Past, Present, & Future']];
  if (/on shuffle/i.test(t) || t === 'The Tragically Hip - Live Stream: The Darkest One') return [['on-shuffle', null]];
  if (/album countdown/i.test(t)) return [['album-countdown', null]];
  if (/^yer hipstories/i.test(t)) return [['yer-hipstories', null]];
  if (/it's a good life/i.test(t) || (d >= '2026-10-01' && /^episode (one|two|three|four|five) - /i.test(t))) return [['its-a-good-life', null]];
  if (/interview series/i.test(t)) return [['interview-series', 'The Interview Series']];
  // Conversations recorded on the other shows live on the Interview Series only (jD, 2026-11-05)
  if (/^hipstories - |^strippers union interview$/i.test(t)) return [['interview-series', 'From Fully & Completely']];
  if (/^talking with /i.test(t)) return [['interview-series', 'From Getting Hip to The Hip']];
  if (/introduce yerself[:\s-]+(dale robertson|josh finlayson|nathan astin|tribute singers|alan cross)$/i.test(t)) return [['interview-series', 'From Discovering Downie']];
  if (/the gord downie interview$/i.test(t)) return [['interview-series', 'From The Tragically Hip Top Forty Countdown']];
  if (/redux/i.test(t)) return [['fully-and-completely', 'Fully & Completely: redux (2026)']];
  if (d < '2023-05-01') return [['fully-and-completely', 'The Original (2018-2022)']];
  if (s === '3' || /getting hip to the hip|ghtth/i.test(t) || (d >= '2023-05-01' && d < '2024-01-01')) return [['getting-hip-to-the-hip', null]];
  if (s === '4' || /introduce yerself|live at six/i.test(t) || (d >= '2024-01-01' && d < '2024-09-17')) return [['discovering-downie', null]];
  if (/top forty|top 40|tthtop40/i.test(t) || (d >= '2024-09-17' && d < '2026-01-01')) return [['top-forty-countdown', top40Section(t)]];
  return null;
}

function top40Section(t) {
  if (/road to the top 40/i.test(t)) return 'The Road to the Top 40';
  if (/^flashback/i.test(t)) return 'Flashbacks';
  if (/top forty countdown/i.test(t) && /\bsong\b/i.test(t)) return 'The Countdown';
  return 'Round Tables and Specials';
}

// Sorted as if published on another day (the real date still shows)
const SORT_AS = [
  // Song Thirty-Four went up in June 2026; it belongs between Thirty-Five and Thirty-Three
  [ep => /Song Thirty-Four - Tyler/.test(ep.title), '2025-02-17'],
  // Discovering Downie's 'Secret Path' episode is a 2026 upload; placed in discography order
  [ep => ep.title === 'Secret Path' && ep.season === '4', '2024-06-24'],
];

// ---- The feed ----

function decode(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const torontoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });

async function fetchFeed(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TheHipHandbook-build' } });
  if (!res.ok) throw new Error('feed answered ' + res.status);
  const xml = await res.text();
  const tag = (item, name) => { const m = item.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>')); return m ? decode(m[1]).trim() : ''; };
  const episodes = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const id = (item.match(/<enclosure [^>]*url="[^"]*\/episodes\/([0-9a-f-]{36})\//) || [])[1];
    if (!id) throw new Error('an episode has no RedCircle id: ' + tag(item, 'title'));
    return {
      id,
      // Brand guide: no em or en dashes on the site, so the two published titles that have
      // one show " - " instead. Everything else stays exactly as published.
      title: tag(item, 'title').replace(/\s*[—–]\s*/g, ' - ').replace(/\s+/g, ' '),
      date: torontoDate.format(new Date(tag(item, 'pubDate'))),
      seconds: +tag(item, 'itunes:duration') || 0,
      season: tag(item, 'itunes:season'),
      type: tag(item, 'itunes:episodeType'),
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  if (episodes.length < 300) throw new Error('feed has only ' + episodes.length + ' episodes - not saving it');
  return episodes;
}

// ---- Pages ----

function head(h) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(h.title)}</title>
  <meta name="description" content="${esc(h.desc)}">
  <meta property="og:title" content="${esc(h.title)}">
  <meta property="og:description" content="${esc(h.desc)}">
  <meta property="og:image" content="${SITE}/assets-optimized/podcasts/${h.image}.jpg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:image:alt" content="${esc(h.imageAlt)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${h.url}">
  <meta property="og:site_name" content="The Hip Handbook">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${h.url}">
  <script defer src="https://cloud.umami.is/script.js" data-website-id="5a328248-7e6f-4440-aa23-1add33d46f33" data-domains="thehiphandbook.tthpods.com,forum-portal.tthpods.com" data-do-not-track="true" data-exclude-search="true"></script>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍁</text></svg>">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <meta name="apple-mobile-web-app-title" content="The Handbook">
  <meta name="theme-color" content="#0e0b16">
  <link rel="preload" href="/fonts/poppins-400-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/poppins-600-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/podcasts.css">
</head>
<body>
<script src="/js/tth-member-gate.js"></script>
<a href="#main-content" class="skip-link">Skip to content</a>
`;
}

const FOOT = `
<footer id="site-footer"></footer>

<script src="/js/shared-footer.js"></script>
</body>
</html>
`;

// Search results show about 155 characters
function shortDesc(text) {
  if (text.length <= 155) return text;
  const cut = text.slice(0, 152);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '...';
}
const firstSentence = text => (text.match(/^.*?[.!?](?=\s|$)/) || [text])[0];

function hubPage(cfg, counts) {
  const card = show => `      <li><a class="pod-card" href="/podcasts/${show.slug}">
        <img src="/assets-optimized/podcasts/${show.slug}.webp" width="600" height="600" alt="" loading="lazy">
        <span class="pod-card-name">${esc(show.name)}</span>
        <span class="pod-card-meta">${esc([show.years, counts[show.slug] ? plural(counts[show.slug], 'episode', 'episodes') : 'Coming soon'].filter(Boolean).join(' · '))}</span>
      </a></li>`;
  const main = cfg.shows.filter(s => !s.extra), extra = cfg.shows.filter(s => s.extra);
  return head({
    title: 'Radio Show - The Hip Handbook',
    desc: 'Every show from The Tragically Hip Podcast Series, with a full episode guide for each one and every episode a tap away on RedCircle.',
    url: SITE + '/podcasts',
    image: 'the-completists',
    imageAlt: 'The Tragically Hip Podcast Series logo: a record and a microphone inside a dark purple circle',
  }) + `
<header class="page-header">
  <div class="subtitle">Podcasts</div>
  <h1>Radio Show</h1>
  <p class="header-desc">Nine shows from The Tragically Hip Podcast Series, each with its full episode guide.</p>
  <a href="/" class="back-link">&larr; Home</a>
</header>

<main id="main-content" class="pod-main">
${cfg.hub.intro.map(p => '  <p class="pod-intro">' + esc(p) + '</p>').join('\n')}

  <section aria-labelledby="podShows">
    <h2 class="pod-heading" id="podShows">The Shows</h2>
    <ul class="pod-grid">
${main.map(card).join('\n')}
    </ul>
  </section>

  <section aria-labelledby="podExtras">
    <h2 class="pod-heading" id="podExtras">Also on the Feed</h2>
    <ul class="pod-grid">
${extra.map(card).join('\n')}
    </ul>
  </section>

  <p class="pod-note">Every episode is free on <a href="${cfg.showPage}" target="_blank" rel="noopener noreferrer">RedCircle</a> and wherever you get yer podcasts.</p>
</main>
` + FOOT;
}

function showPage(cfg, show, eps) {
  const sections = show.sections || [null];
  const groups = sections.map(name => ({ name, eps: eps.filter(e => e.section === name) })).filter(g => g.eps.length);
  const row = e => `      <li><a href="${cfg.episodePage}${e.id}" target="_blank" rel="noopener noreferrer"><span class="ep-title">${esc(e.title)}</span><span class="ep-meta"><time datetime="${e.date}">${fmtDate(e.date)}</time>${e.seconds ? ' · ' + fmtLength(e.seconds) : ''}</span></a></li>`;
  const guide = !eps.length
    ? `    <p class="pod-empty">${esc(show.empty || 'No episodes yet.')}</p>`
    : `    <p class="pod-count">${plural(eps.length, 'episode', 'episodes')}, oldest first. Each one opens on RedCircle.</p>
` + groups.map(g => (g.name ? `    <h3 class="pod-section">${esc(g.name)} <span>${g.eps.length}</span></h3>\n` : '') + `    <ol class="pod-eps">
${g.eps.map(row).join('\n')}
    </ol>`).join('\n');
  return head({
    title: show.name + ' - Radio Show - The Hip Handbook',
    desc: shortDesc(show.name + ': ' + firstSentence(show.about[0])),
    url: SITE + '/podcasts/' + show.slug,
    image: show.slug,
    imageAlt: show.imageAlt,
  }) + `
<header class="page-header">
  <div class="subtitle">${esc(show.eyebrow || show.years || 'Podcast')}</div>
  <h1>${esc(show.name)}</h1>
  <a href="/podcasts" class="back-link">&larr; Radio Show</a>
</header>

<main id="main-content" class="pod-main">
  <section class="pod-about" aria-label="About the show">
    <img class="pod-art" src="/assets-optimized/podcasts/${show.slug}.webp" width="600" height="600" alt="${esc(show.imageAlt)}">
    <div class="pod-about-text">
${show.about.map(p => '      <p>' + esc(p) + '</p>').join('\n')}${show.link ? `\n      <p><a class="pod-link" href="${show.link.href}">${esc(show.link.text)}</a></p>` : ''}
    </div>
  </section>

  <section class="pod-guide" aria-labelledby="podGuide">
    <h2 class="pod-heading" id="podGuide">Episode Guide</h2>
${guide}
  </section>
</main>
` + FOOT;
}

function sitemapBlock(cfg) {
  const url = (loc, pr) => `  <url>\n    <loc>${loc}</loc>\n    <priority>${pr}</priority>\n  </url>`;
  return ['  <!-- podcasts:start -->', url(SITE + '/podcasts', '0.7'), ...cfg.shows.map(s => url(SITE + '/podcasts/' + s.slug, '0.6')), '  <!-- podcasts:end -->'].join('\n');
}

// ---- Run ----

(async () => {
  const cfg = JSON.parse(fs.readFileSync(SHOWS_FILE, 'utf8'));
  let feed;
  if (FETCH) {
    feed = { source: cfg.feed, fetched: torontoDate.format(new Date()), episodes: await fetchFeed(cfg.feed) };
    fs.writeFileSync(FEED_FILE, JSON.stringify(feed, null, 1) + '\n');
    console.log(`saved ${feed.episodes.length} episodes to data/podcast-feed.json`);
  } else {
    feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  }

  const slugs = new Set(cfg.shows.map(s => s.slug));
  const byShow = Object.fromEntries(cfg.shows.map(s => [s.slug, []]));
  const skipped = {}, unsorted = [];
  for (const ep of feed.episodes) {
    const skip = SKIP.find(([re]) => re.test(ep.title));
    if (skip) { (skipped[skip[1]] = skipped[skip[1]] || []).push(ep); continue; }
    if (OLDER_COPY.some(f => f(ep))) { (skipped['older copy'] = skipped['older copy'] || []).push(ep); continue; }
    const spots = place(ep);
    if (!spots) { unsorted.push(ep); continue; }
    const sortKey = (SORT_AS.find(([f]) => f(ep)) || [])[1] || ep.date;
    for (const [slug, section] of spots) {
      if (!slugs.has(slug)) throw new Error('RULES name a show that is not in data/podcast-shows.json: ' + slug);
      const show = cfg.shows.find(s => s.slug === slug);
      if (section && !(show.sections || []).includes(section)) throw new Error(`${slug} has no section "${section}" in data/podcast-shows.json`);
      byShow[slug].push({ ...ep, section, sortKey });
    }
  }
  for (const list of Object.values(byShow)) list.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const counts = Object.fromEntries(Object.entries(byShow).map(([k, v]) => [k, v.length]));

  const files = { 'podcasts.html': hubPage(cfg, counts) };
  for (const show of cfg.shows) files['podcasts/' + show.slug + '.html'] = showPage(cfg, show, byShow[show.slug]);

  const smPath = path.join(ROOT, 'sitemap.xml');
  const sm = fs.readFileSync(smPath, 'utf8');
  const block = sitemapBlock(cfg);
  const smNew = /  <!-- podcasts:start -->[\s\S]*?<!-- podcasts:end -->/.test(sm)
    ? sm.replace(/  <!-- podcasts:start -->[\s\S]*?<!-- podcasts:end -->/, () => block)
    : sm.replace('  <!-- songs:start -->', () => block + '\n  <!-- songs:start -->');

  const stale = Object.entries(files).filter(([f, html]) => !fs.existsSync(path.join(ROOT, f)) || fs.readFileSync(path.join(ROOT, f), 'utf8') !== html).map(([f]) => f);
  if (smNew !== sm) stale.push('sitemap.xml (podcasts block)');
  const extraFiles = fs.existsSync(path.join(ROOT, 'podcasts')) ? fs.readdirSync(path.join(ROOT, 'podcasts')).filter(f => f.endsWith('.html') && !files['podcasts/' + f]) : [];

  if (CHECK) {
    if (stale.length || extraFiles.length) {
      if (stale.length) console.error(`${stale.length} podcast file(s) out of date (run node scripts/build-podcasts.js): ${stale.join(', ')}`);
      if (extraFiles.length) console.error(`podcasts/ has page(s) for no show: ${extraFiles.join(', ')}`);
      process.exit(1);
    }
    console.log(`podcast pages up to date (${cfg.shows.length} shows, ${feed.episodes.length} episodes in the saved feed)`);
    return;
  }

  fs.mkdirSync(path.join(ROOT, 'podcasts'), { recursive: true });
  for (const [f, html] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, f), html);
  if (smNew !== sm) fs.writeFileSync(smPath, smNew);
  console.log(`wrote podcasts.html and ${cfg.shows.length} show pages (${stale.length} changed)`);
  for (const show of cfg.shows) console.log(`  ${show.name}: ${counts[show.slug]}`);
  for (const [why, list] of Object.entries(skipped)) console.log(`  left out, ${why}: ${list.length}`);
  if (extraFiles.length) console.log(`  podcasts/ also has ${extraFiles.join(', ')}, which no show uses`);
  if (unsorted.length) {
    console.log(`\n${unsorted.length} episode(s) not sorted onto any show (add a rule in scripts/build-podcasts.js):`);
    unsorted.forEach(e => console.log(`  ${e.date}  ${e.title}`));
  }
})().catch(err => { console.error('build-podcasts: ' + err.message); process.exit(1); });
