#!/usr/bin/env node
// add-archive-recordings.js
// Puts the Hip Archive recordings listed under "addRecording" in
// data/setlist-corrections.json onto their shows: downloads each zip, puts the
// MP3s on Backblaze B2 (bucket tth-audio, one folder per show, the same layout
// as the first 614), and writes the track list into data/tth-tour-data.json.
//
// Only adds: a show that already has a recording is skipped, and a file that is
// already on B2 isn't uploaded twice, so it's safe to re-run after a failure.
// Track names come from "trackNames" (in tape order); without them the file
// names are tidied up the way the original upload did it.
//
// A recording jD already has as an MP3 (say, the audio of a YouTube full show)
// uses "localFile" (the file's name) and "sourceUrl" (where it came from) instead
// of "archiveUrl". The file is read from the --from folder (the Desktop by default).
//
// Needs the internet, the macOS unzip command, and a Backblaze application key
// with write access to tth-audio in .env (B2_KEY_ID, B2_APP_KEY):
//   node --env-file=.env scripts/add-archive-recordings.js
// Options:
//   --dry-run   download and unpack, print the track list, upload and save nothing
//   --only ID   just that show
//   --from DIR  where the localFile MP3s are (default: ~/Desktop)
// Then run the data pipeline from step 1 (apply-setlist-corrections.js adds the notes).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOUR = path.join(ROOT, 'data', 'tth-tour-data.json');
const BUCKET = process.env.B2_BUCKET || 'tth-audio';
const DRY = process.argv.includes('--dry-run');
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt > -1 ? process.argv[onlyAt + 1] : null;
const fromAt = process.argv.indexOf('--from');
const FROM = fromAt > -1 ? path.resolve(process.argv[fromAt + 1]) : path.join(os.homedir(), 'Desktop');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fix = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'setlist-corrections.json'), 'utf8'));
const tour = JSON.parse(fs.readFileSync(TOUR, 'utf8'));
const byId = new Map(tour.map(g => [g.id, g]));

const todo = Object.entries(fix.addRecording || {}).filter(([id]) => !ONLY || id === ONLY);
if (!todo.length) { console.log(ONLY ? `addRecording has no show ${ONLY}.` : 'addRecording is empty. Nothing to do.'); process.exit(0); }
if (!DRY && !(process.env.B2_KEY_ID && process.env.B2_APP_KEY)) {
  console.error('STOPPED - no Backblaze key. Put B2_KEY_ID and B2_APP_KEY in .env, then run:');
  console.error('  node --env-file=.env scripts/add-archive-recordings.js');
  console.error('(--dry-run works without a key.)');
  process.exit(1);
}

// ─── Backblaze B2 native API (no packages) ───
let b2 = null;
async function b2Call(op, body) {
  const res = await fetch(`${b2.apiUrl}/b2api/v2/${op}`, { method: 'POST', headers: { Authorization: b2.token }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(`Backblaze ${op}: ${j.code || res.status} ${j.message || ''}`);
  return j;
}
async function b2Login() {
  const basic = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', { headers: { Authorization: `Basic ${basic}` } });
  const j = await res.json();
  if (!res.ok) throw new Error(`Backblaze sign-in failed: ${j.code || res.status} ${j.message || ''}`);
  b2 = { apiUrl: j.apiUrl, token: j.authorizationToken, bucketId: j.allowed && j.allowed.bucketName === BUCKET ? j.allowed.bucketId : null };
  if (!b2.bucketId) {
    const { buckets } = await b2Call('b2_list_buckets', { accountId: j.accountId, bucketName: BUCKET });
    if (!buckets.length) throw new Error(`this key can't see the ${BUCKET} bucket`);
    b2.bucketId = buckets[0].bucketId;
  }
}
async function b2Existing(prefix) {
  const { files } = await b2Call('b2_list_file_names', { bucketId: b2.bucketId, prefix, maxFileCount: 1000 });
  return new Set(files.map(f => f.fileName));
}
let uploadTarget = null;
async function b2Upload(key, file) {
  const data = fs.readFileSync(file);
  const sha1 = crypto.createHash('sha1').update(data).digest('hex');
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!uploadTarget) uploadTarget = await b2Call('b2_get_upload_url', { bucketId: b2.bucketId });
    try {
      const res = await fetch(uploadTarget.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: uploadTarget.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(key).replace(/%2F/g, '/'),
          'Content-Type': 'audio/mpeg',
          'X-Bz-Content-Sha1': sha1,
        },
        body: data,
      });
      if (res.ok) return;
      const j = await res.json().catch(() => ({}));
      if (res.status !== 401 && res.status !== 408 && res.status !== 429 && res.status < 500) throw new Error(`Backblaze upload: ${j.code || res.status} ${j.message || ''}`);
    } catch (e) {
      if (/Backblaze upload:/.test(e.message)) throw e;
    }
    uploadTarget = null; // B2 wants a fresh upload URL after any hiccup
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`gave up uploading ${key}`);
}

// ─── Zips ───
async function download(url, dest) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TheHipHandbook/1.0 (thehiphandbook.tthpods.com)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) {
      if (attempt === 2) throw new Error(`couldn't download ${url} (${e.message})`);
      await sleep(5000 * (attempt + 1));
    }
  }
}
function audioFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__MACOSX') walk(p); continue; }
      // macOS ._ files carry an audio extension but no audio (the 740 phantom tracks of v4.3.3)
      if (e.name.startsWith('._') || !/\.mp3$/i.test(e.name)) continue;
      out.push(p);
    }
  })(dir);
  return out.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
// Same clean-up as the original upload script
const safeName = f => path.basename(f).replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
function tidyName(f) {
  let n = path.basename(f, path.extname(f));
  n = n.replace(/^\d{1,3}[\s._-]+/, '').replace(/^\d{4}-\d{2}-\d{2}[\s._-]*/, '').replace(/[_-]/g, ' ');
  return n.replace(/\s+/g, ' ').trim() || path.basename(f);
}

(async () => {
  if (!DRY) await b2Login();
  let added = 0, skipped = 0, failed = 0;
  for (const [id, rec] of todo) {
    const gig = byId.get(id);
    if (!gig) { console.log(`  ${id}: not in tth-tour-data.json yet (run add-setlistfm-shows.js first), skipped`); skipped++; continue; }
    const label = `${gig.isoDate} ${gig.venue}, ${gig.city}`;
    if ((gig.tracks || []).length) { console.log(`  ${label}: already has a recording, skipped`); skipped++; continue; }

    const local = rec.localFile ? path.join(FROM, rec.localFile) : null;
    if (local && !fs.existsSync(local)) { console.log(`  ${label}: ${rec.localFile} isn't in ${FROM}, skipped`); skipped++; continue; }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-archive-'));
    try {
      let files;
      if (local) {
        console.log(`  ${label}: using ${rec.localFile}`);
        files = [local];
      } else {
        console.log(`  ${label}: downloading ${path.basename(rec.archiveUrl)}`);
        const zip = path.join(tmp, 'show.zip');
        await download(rec.archiveUrl, zip);
        const out = path.join(tmp, 'x');
        execFileSync('unzip', ['-qq', '-o', zip, '-d', out]);
        fs.unlinkSync(zip);
        files = audioFiles(out);
        if (!files.length) throw new Error('no MP3s in the zip');
      }
      if (rec.trackNames && rec.trackNames.length !== files.length) {
        throw new Error(`the zip has ${files.length} MP3s but trackNames lists ${rec.trackNames.length}: ${files.map(f => path.basename(f)).join(' | ')}`);
      }
      const folder = `${gig.isoDate}-${(gig.city || 'unknown').replace(/ /g, '-')}${gig.state ? '-' + gig.state.replace(/ /g, '-') : ''}`;
      const tracks = files.map((f, i) => ({ name: rec.trackNames ? rec.trackNames[i] : tidyName(f), url: `${folder}/${safeName(f)}`, filename: safeName(f) }));
      if (new Set(tracks.map(t => t.url)).size !== tracks.length) throw new Error('two MP3s in the zip end up with the same name');

      if (DRY) {
        tracks.forEach((t, i) => console.log(`      ${String(i + 1).padStart(2)}. ${t.name}  <-  ${t.filename}`));
        console.log(`      would upload to ${BUCKET}/${folder}/`);
      } else {
        const already = await b2Existing(folder + '/');
        for (let i = 0; i < files.length; i++) {
          if (already.has(tracks[i].url)) continue;
          process.stdout.write(`\r      uploading ${i + 1}/${files.length}   `);
          await b2Upload(tracks[i].url, files[i]);
        }
        process.stdout.write('\n');
        gig.archiveUrl = rec.archiveUrl || rec.sourceUrl;
        gig.archiveFormat = 'mp3';
        gig.tracks = tracks;
        // Saved after every show, so a failure later on loses nothing
        fs.writeFileSync(TOUR, JSON.stringify(tour, null, 2) + '\n');
        console.log(`      done: ${tracks.length} tracks`);
      }
      added++;
    } catch (e) {
      console.error(`      FAILED: ${e.message}`);
      failed++;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`addRecording: ${added} ${DRY ? 'checked' : 'added'}, ${skipped} skipped, ${failed} failed.${DRY ? ' Dry run: nothing uploaded or saved.' : ''}`);
  if (failed) process.exit(1);
})().catch(e => { console.error('STOPPED - ' + e.message); process.exit(1); });
