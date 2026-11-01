#!/usr/bin/env node
// build-seo-pages.js - writes the pages that link-preview robots and search engines read.
//
// Facebook, iMessage and most search crawlers read the raw HTML and do not run
// JavaScript, so a page served by one shared file (song.html for every song,
// discography.html for /lyrics, /setlists and /top-40) shows the same preview for
// every address. This writes one real file per address, each with its own title,
// description, canonical and og tags, so Netlify serves it as-is:
//
//   song/<slug>.html   one per song in data/song-index.json (from song.html)
//   lyrics.html, setlists.html, top-40.html   (from discography.html)
//
// Do not edit those files by hand. Change song.html, discography.html, the
// FEATURE_VIEWS block in js/discography-app.js, or this script, then re-run:
//
//   node scripts/build-song-index.js     (only if the setlists changed)
//   node scripts/build-seo-pages.js
//
// scripts/audit-site.js fails if the files on disk differ from what this writes.
// The song title and description text copies js/song.js (setMeta) - keep them in step.
// Node 22, no packages. --check prints stale files and exits 1 without writing.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://thehiphandbook.tthpods.com';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CATEGORY_NOTE = ' - The Hip Handbook';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plural = (n, one, many) => n.toLocaleString('en-CA') + ' ' + (n === 1 ? one : many);
const fmtDate = iso => { const p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; };

// Swap one tag in the template; stop loudly if the template no longer has it.
function swap(html, re, replacement, label) {
  if (!re.test(html)) throw new Error('template is missing ' + label);
  return html.replace(re, typeof replacement === 'function' ? replacement : () => replacement);
}

function setHead(html, h) {
  html = swap(html, /<title>[^<]*<\/title>/, '<title>' + escText(h.title) + '</title>', '<title>');
  html = swap(html, /<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(h.desc) + '">', 'meta description');
  html = swap(html, /<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(h.title) + '">', 'og:title');
  html = swap(html, /<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(h.desc) + '">', 'og:description');
  html = swap(html, /<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + h.url + '">', 'og:url');
  html = swap(html, /<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + h.url + '">', 'canonical');
  return html;
}

// Search results show about 155 characters of a description (audit SEO-02)
const DESC_MAX = 155;
// The song description: the longest version that fits DESC_MAX, dropping "by The
// Tragically Hip" first. js/song.js (songDesc) writes the same text - keep them in step.
function songDesc(song, plays, recs, origin) {
  const t = "'" + song.t + "'";
  const fit = list => list.find(d => d.length <= DESC_MAX) || list[list.length - 1];
  if (plays.length) {
    const first = plays[0], last = plays[plays.length - 1];
    const live = plays.length === 1 ? 'played live once, on ' + fmtDate(first.iso) + '.' : 'played live ' + plural(plays.length, 'time', 'times') + ', ' + fmtDate(first.iso) + ' to ' + fmtDate(last.iso) + '.';
    const recLong = recs.length ? ' Plays by year and ' + plural(recs.length, 'recording', 'recordings') + ' in The Tragically Hip Archive.' : ' Plays by year.';
    const recShort = recs.length ? ' Plays by year and ' + plural(recs.length, 'recording', 'recordings') + '.' : ' Plays by year.';
    return fit([t + ' by The Tragically Hip: ' + live + recLong, t + ': ' + live + recLong, t + ': ' + live + recShort, t + ': ' + live]);
  }
  // Never played live: say where it came out, so the description isn't one thin line
  const from = origin ? ' From "' + origin[0] + '" (' + origin[1] + ').' : '';
  return fit([
    t + ' by The Tragically Hip.' + from + ' No live performances on record. Albums and fan ranking.',
    t + '.' + from + ' No live performances on record. Albums and fan ranking.',
    t + '.' + from + ' Albums and fan ranking.',
  ]);
}

// A plain paragraph with the song's live history, in the HTML as sent, for search engines
// and link-preview robots that don't run scripts (audit SEO-03). js/song.js hides it once
// the full page has drawn, since the stats there say the same.
function songSummary(song, plays, recs, rows) {
  const at = i => { const r = rows[i]; return fmtDate(r[1]) + ([r[2], r[3]].filter(Boolean).length ? ', ' + [r[2], r[3]].filter(Boolean).join(', ') : ''); };
  const bits = [];
  if (plays.length === 1) bits.push('Played live once on record: ' + at(song.p[0]) + '.');
  else if (plays.length) bits.push('First live performance on record: ' + at(song.p[0]) + '. Latest: ' + at(song.p[song.p.length - 1]) + '.');
  else bits.push('No live performances on record.');
  const releases = new Set(song.a.map(a => a[0])).size;
  if (releases) bits.push(releases === 1 ? 'On one official release.' : 'On ' + releases + ' official releases.');
  if (recs.length) bits.push(plural(recs.length, 'recording', 'recordings') + ' in The Tragically Hip Archive.');
  return bits.join(' ');
}

// Structured data for the song (audit SEO-03): the composition, recorded by The Hip,
// first released on its origin album
function songJsonLd(song, origin) {
  const rec = { '@type': 'MusicRecording', name: song.t, byArtist: { '@type': 'MusicGroup', name: 'The Tragically Hip', url: SITE + '/' } };
  if (origin) rec.inAlbum = { '@type': 'MusicAlbum', name: origin[0], datePublished: String(origin[1]) };
  const ld = { '@context': 'https://schema.org', '@type': 'MusicComposition', name: song.t, url: SITE + '/song/' + song.s, recordedAs: rec };
  return '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
}

// ---- song pages ----
function songPages() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/song-index.json'), 'utf8'));
  const template = fs.readFileSync(path.join(ROOT, 'song.html'), 'utf8');
  const shows = data.shows.map(r => ({ iso: r[1] }));
  const out = {};
  for (const song of data.songs) {
    const plays = song.p.map(i => shows[i]);
    const recs = song.r.map(r => r[0]).filter((x, i, all) => all.indexOf(x) === i);
    const sorted = [...song.a].sort((x, y) => x[1] - y[1]);
    const origin = sorted.find(a => (a[2] === 'studio' || a[2] === 'eps') && !a[4]) || sorted[0];

    const bits = [];
    if (origin) bits.push('From "' + origin[0] + '" (' + origin[1] + ')');
    // One play reads "played live once, on Dec 9, 1993" (audit BRAND-09)
    const once = plays.length === 1 ? 'played live once, on ' + fmtDate(plays[0].iso) : '';
    bits.push(once || (plays.length ? 'played live ' + plural(plays.length, 'time', 'times') : 'no live performances on record'));
    const lead = bits.join(' - ') + '.';

    const title = "'" + song.t + "' - Song" + CATEGORY_NOTE;
    const desc = songDesc(song, plays, recs, origin);

    let html = setHead(template, { title, desc, url: SITE + '/song/' + song.s });
    html = swap(html, /(<h1 id="spTitle">)[^<]*(<\/h1>)/, (m, a, b) => a + escText(song.t) + b, 'spTitle');
    html = swap(html, /(<p class="header-desc" id="spDesc">)[^<]*(<\/p>)/, (m, a, b) => a + escText(lead) + b, 'spDesc');
    html = swap(html, /(<p id="spSummary" class="sp-summary">)[^<]*(<\/p>)/, (m, a, b) => a + escText(songSummary(song, plays, recs, data.shows)) + b, 'spSummary');
    html = swap(html, /\n<\/head>/, () => '\n  ' + songJsonLd(song, origin) + '\n</head>', '</head>');
    out['song/' + song.s + '.html'] = html;
  }
  return out;
}

// ---- /lyrics, /setlists, /top-40 ----
// The view text lives in js/discography-app.js (FEATURE_VIEWS); read it from there.
function featurePages() {
  const js = fs.readFileSync(path.join(ROOT, 'js/discography-app.js'), 'utf8');
  const m = js.match(/const FEATURE_VIEWS = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('FEATURE_VIEWS not found in js/discography-app.js');
  const views = new Function('return ' + m[1])();
  const template = fs.readFileSync(path.join(ROOT, 'discography.html'), 'utf8');
  const out = {};
  for (const key of ['lyrics', 'setlists', 'top-40']) {
    const v = views[key];
    if (!v) throw new Error('FEATURE_VIEWS has no ' + key);
    const title = v.label + ' (' + v.title + ')' + CATEGORY_NOTE;
    let html = setHead(template, { title, desc: v.desc, url: SITE + v.path });
    html = swap(html, /(<div class="subtitle" id="pageSubtitle">)[^<]*(<\/div>)/, (m, a, b) => a + escText(v.label) + b, 'pageSubtitle');
    html = swap(html, /(<h1 id="pageTitle">)[^<]*(<\/h1>)/, (m, a, b) => a + escText(v.title) + b, 'pageTitle');
    html = swap(html, /(<p class="header-desc" id="pageDesc">)[^<]*(<\/p>)/, (m, a, b) => a + escText(v.desc) + b, 'pageDesc');
    out[key + '.html'] = html;
  }
  return out;
}

const files = Object.assign({}, songPages(), featurePages());
const checkOnly = process.argv.includes('--check');
const stale = [];

for (const [rel, html] of Object.entries(files)) {
  const file = path.join(ROOT, rel);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === html) continue;
  stale.push(rel);
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
}

// Song files whose song is gone from song-index.json
const songDir = path.join(ROOT, 'song');
const extra = fs.existsSync(songDir)
  ? fs.readdirSync(songDir).filter(f => f.endsWith('.html') && !files['song/' + f])
  : [];
if (!checkOnly) extra.forEach(f => fs.unlinkSync(path.join(songDir, f)));

const total = Object.keys(files).length;
if (checkOnly) {
  if (stale.length || extra.length) {
    stale.slice(0, 10).forEach(f => console.error('stale or missing: ' + f));
    extra.slice(0, 10).forEach(f => console.error('no longer a song: song/' + f));
    console.error((stale.length + extra.length) + ' file(s) out of date. Run: node scripts/build-seo-pages.js');
    process.exit(1);
  }
  console.log('OK: ' + total + ' generated pages are current.');
} else {
  console.log(total + ' pages (' + (total - 3) + ' songs + 3 routes): ' + stale.length + ' written, ' + extra.length + ' removed.');
}
