#!/usr/bin/env python3
"""
TTH Audio Uploader — Backblaze B2
Downloads ZIP files from The Hip Archive, extracts MP3s,
uploads to Backblaze B2, and updates tth-tour-data.json with track info.

Processes one show at a time to keep disk usage low.
Resumable — skips shows already uploaded.

Usage:
  python3 scripts/upload-audio-to-b2.py

Optional flags:
  --dry-run       Show what would be uploaded without doing it
  --limit N       Only process N shows (for testing)
  --start-from N  Skip the first N shows (resume from a specific point)
"""

import json
import os
import sys
import zipfile
import tempfile
import shutil
import argparse
import time
import re
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# --- Backblaze B2 S3-compatible config ---
B2_KEY_ID = os.environ.get('B2_KEY_ID', '00650080ffc2e1c0000000001')
B2_APP_KEY = os.environ.get('B2_APP_KEY', 'K006ryvnu0azsG63INGwmeUmF/Zs5hU')
B2_BUCKET = os.environ.get('B2_BUCKET', 'tth-audio')
B2_ENDPOINT = os.environ.get('B2_ENDPOINT', 'https://s3.ca-east-006.backblazeb2.com')
B2_PUBLIC_BASE = os.environ.get('B2_PUBLIC_BASE', f'https://f006.backblazeb2.com/file/{B2_BUCKET}')

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_FILE = PROJECT_DIR / 'data' / 'tth-tour-data.json'
PROGRESS_FILE = SCRIPT_DIR / '.upload-progress.json'
TRACKS_DIR = SCRIPT_DIR / '.track-results'

# Try to import boto3 for S3-compatible upload
try:
    import boto3
    from botocore.config import Config as BotoConfig
    HAS_BOTO = True
except ImportError:
    HAS_BOTO = False


def log(msg, level='INFO'):
    ts = time.strftime('%H:%M:%S')
    print(f'[{ts}] {level}: {msg}')


def load_progress():
    """Load set of already-processed gig IDs."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return set(json.load(f))
    return set()


def save_progress(done_ids):
    """Save processed gig IDs to disk."""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(sorted(done_ids), f)


def download_zip(url, dest_path):
    """Download a ZIP file with retries."""
    # Fix URLs with spaces or control characters
    from urllib.parse import quote
    url = quote(url, safe=':/?&=#')
    url = url.replace('%0D', '').replace('%0A', '').replace('%09', '')
    for attempt in range(3):
        try:
            req = Request(url, headers={'User-Agent': 'TTH-Audio-Uploader/1.0'})
            with urlopen(req, timeout=120) as resp:
                total = int(resp.headers.get('Content-Length', 0))
                downloaded = 0
                with open(dest_path, 'wb') as f:
                    while True:
                        chunk = resp.read(1024 * 256)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = int((downloaded / total) * 100)
                            print(f'\r  Downloading: {downloaded // (1024*1024)}MB / {total // (1024*1024)}MB ({pct}%)', end='', flush=True)
                print()
            return True
        except (HTTPError, URLError, TimeoutError) as e:
            log(f'Download attempt {attempt + 1} failed: {e}', 'WARN')
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
    return False


def extract_zip(zip_path, extract_dir):
    """Extract audio files from ZIP, return list of file paths."""
    audio_exts = {'.mp3', '.m4a', '.flac', '.ogg', '.wav'}
    extracted = []
    track_num = 0
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Sort entries by name to preserve track order
            entries = sorted(zf.infolist(), key=lambda x: x.filename)
            for info in entries:
                if info.is_dir():
                    continue
                ext = os.path.splitext(info.filename)[1].lower()
                if ext in audio_exts:
                    track_num += 1
                    # Get original basename, fall back to numbered name
                    basename = os.path.basename(info.filename)
                    if not basename or basename == ext:
                        basename = f'track-{track_num:02d}{ext}'
                    # Sanitize: replace problematic chars, collapse spaces
                    basename = re.sub(r'[<>:"/\\|?*]', '_', basename)
                    basename = re.sub(r'\s+', ' ', basename).strip()
                    dest = os.path.join(extract_dir, basename)
                    # Handle duplicates
                    if os.path.exists(dest):
                        name, ext2 = os.path.splitext(basename)
                        dest = os.path.join(extract_dir, f'{name}-{track_num}{ext2}')
                    try:
                        with zf.open(info) as src, open(dest, 'wb') as dst:
                            shutil.copyfileobj(src, dst)
                        extracted.append(dest)
                    except Exception as e:
                        log(f'  Failed to extract {info.filename}: {e}', 'WARN')
    except zipfile.BadZipFile:
        log('Bad ZIP file, skipping', 'WARN')
        return []
    return sorted(extracted)


def clean_track_name(filename):
    """Extract a clean track name from the MP3 filename."""
    name = os.path.splitext(os.path.basename(filename))[0]
    # Remove common prefixes like track numbers: "01 - Song Name", "01. Song Name", "01_Song Name"
    name = re.sub(r'^\d{1,3}[\s._-]+', '', name)
    # Remove date prefixes if present
    name = re.sub(r'^\d{4}-\d{2}-\d{2}[\s._-]*', '', name)
    # Replace underscores and hyphens with spaces
    name = name.replace('_', ' ').replace('-', ' ')
    # Clean up multiple spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name if name else os.path.splitext(os.path.basename(filename))[0]


def get_s3_client():
    """Create a boto3 S3 client for Backblaze B2."""
    if not HAS_BOTO:
        log('boto3 not installed. Run: pip3 install boto3', 'ERROR')
        sys.exit(1)
    return boto3.client(
        's3',
        endpoint_url=B2_ENDPOINT,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APP_KEY,
        config=BotoConfig(signature_version='s3v4')
    )


def upload_file(s3, local_path, remote_key):
    """Upload a single file to B2."""
    content_type = 'audio/mpeg'
    ext = os.path.splitext(local_path)[1].lower()
    if ext == '.m4a':
        content_type = 'audio/mp4'
    elif ext == '.flac':
        content_type = 'audio/flac'
    elif ext == '.ogg':
        content_type = 'audio/ogg'
    elif ext == '.wav':
        content_type = 'audio/wav'

    s3.upload_file(
        local_path, B2_BUCKET, remote_key,
        ExtraArgs={
            'ContentType': content_type,
            'CacheControl': 'public, max-age=31536000'
        }
    )


def process_gig(s3, gig, dry_run=False):
    """Download, extract, upload one gig. Returns track list or None on failure."""
    archive_url = gig.get('archiveUrl')
    if not archive_url:
        return None

    gig_id = gig['id']
    iso_date = gig.get('isoDate', 'unknown')
    city = gig.get('city', 'unknown').replace(' ', '-')
    state = gig.get('state', '').replace(' ', '-')
    location_slug = f'{city}-{state}' if state else city
    folder_key = f'{iso_date}-{location_slug}'

    log(f'Processing: {iso_date} - {gig.get("venue", "?")} - {gig.get("city", "?")}')

    if dry_run:
        log(f'  [DRY RUN] Would download {archive_url}')
        log(f'  [DRY RUN] Would upload to {folder_key}/')
        return [{'name': 'Track 1 (dry run)', 'url': f'{folder_key}/track.mp3'}]

    # Create temp directory for this gig
    tmp_dir = tempfile.mkdtemp(prefix='tth-audio-')
    try:
        zip_path = os.path.join(tmp_dir, 'show.zip')
        extract_dir = os.path.join(tmp_dir, 'tracks')
        os.makedirs(extract_dir, exist_ok=True)

        # Download
        if not download_zip(archive_url, zip_path):
            log(f'  Failed to download, skipping', 'WARN')
            return None

        zip_size = os.path.getsize(zip_path) / (1024 * 1024)
        log(f'  Downloaded: {zip_size:.1f}MB')

        # Extract
        audio_files = extract_zip(zip_path, extract_dir)
        if not audio_files:
            log(f'  No audio files found in ZIP, skipping', 'WARN')
            return None
        log(f'  Extracted: {len(audio_files)} tracks')

        # Delete ZIP immediately to free space
        os.remove(zip_path)

        # Upload each track
        tracks = []
        for i, filepath in enumerate(audio_files):
            filename = os.path.basename(filepath)
            remote_key = f'{folder_key}/{filename}'
            track_name = clean_track_name(filename)

            log(f'  Uploading [{i+1}/{len(audio_files)}]: {track_name}')
            upload_file(s3, filepath, remote_key)

            tracks.append({
                'name': track_name,
                'url': f'{folder_key}/{filename}',
                'filename': filename
            })

            # Delete local file after upload
            os.remove(filepath)

        log(f'  Done: {len(tracks)} tracks uploaded')
        return tracks

    finally:
        # Clean up temp directory
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description='Upload TTH audio to Backblaze B2')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen without uploading')
    parser.add_argument('--limit', type=int, default=0, help='Max number of shows to process')
    parser.add_argument('--start-from', type=int, default=0, help='Skip first N shows')
    parser.add_argument('--worker', type=int, default=0, help='Worker ID for parallel runs (saves tracks to separate files)')
    parser.add_argument('--merge', action='store_true', help='Merge all worker track results into main JSON and exit')
    args = parser.parse_args()

    # Merge mode - combine all worker results into main JSON
    if args.merge:
        TRACKS_DIR.mkdir(exist_ok=True)
        with open(DATA_FILE) as f:
            gigs = json.load(f)
        gig_index = {g['id']: g for g in gigs}
        merged = 0
        for tf in sorted(TRACKS_DIR.glob('*.json')):
            with open(tf) as f:
                result = json.load(f)
            gig_id = result['id']
            if gig_id in gig_index and not gig_index[gig_id].get('tracks'):
                gig_index[gig_id]['tracks'] = result['tracks']
                merged += 1
        if merged:
            with open(DATA_FILE, 'w') as f:
                json.dump(gigs, f, indent=2)
        log(f'Merged {merged} shows into tour data')
        return

    # Load tour data
    log(f'Loading tour data from {DATA_FILE}')
    with open(DATA_FILE) as f:
        gigs = json.load(f)

    # Filter to gigs with archive URLs
    archive_gigs = [g for g in gigs if g.get('archiveUrl')]
    log(f'Found {len(archive_gigs)} shows with audio out of {len(gigs)} total')

    # Load progress
    done_ids = load_progress()
    remaining = [g for g in archive_gigs if g['id'] not in done_ids]
    log(f'Already processed: {len(done_ids)}, remaining: {len(remaining)}')

    if args.start_from:
        remaining = remaining[args.start_from:]
        log(f'Starting from offset {args.start_from}, {len(remaining)} shows to go')

    if args.limit:
        remaining = remaining[:args.limit]
        log(f'Limited to {len(remaining)} shows')

    if not remaining:
        log('Nothing to process!')
        return

    # Set up S3 client
    s3 = None
    if not args.dry_run:
        s3 = get_s3_client()
        log('Connected to Backblaze B2')

    # Build a lookup for updating the JSON
    gig_index = {g['id']: g for g in gigs}

    # Process shows
    success_count = 0
    fail_count = 0
    for i, gig in enumerate(remaining):
        log(f'\n=== Show {i+1}/{len(remaining)} ===')
        try:
            tracks = process_gig(s3, gig, dry_run=args.dry_run)
            if tracks:
                # Save track results
                if args.worker:
                    TRACKS_DIR.mkdir(exist_ok=True)
                    track_file = TRACKS_DIR / f'{gig["id"]}.json'
                    with open(track_file, 'w') as f:
                        json.dump({'id': gig['id'], 'tracks': tracks}, f)
                else:
                    gig_index[gig['id']]['tracks'] = tracks
                done_ids.add(gig['id'])
                save_progress(done_ids)
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            log(f'Error processing {gig.get("isoDate", "?")}: {e}', 'ERROR')
            fail_count += 1
            continue

        # Save JSON periodically (every 10 shows) - skip for workers
        if not args.worker and success_count > 0 and success_count % 10 == 0:
            log('Saving updated tour data...')
            with open(DATA_FILE, 'w') as f:
                json.dump(gigs, f, indent=2)

    # Final save - skip for workers (they use --merge)
    if not args.worker and success_count > 0 and not args.dry_run:
        log('Saving final tour data...')
        with open(DATA_FILE, 'w') as f:
            json.dump(gigs, f, indent=2)

    log(f'\nComplete! Processed: {success_count}, Failed: {fail_count}, Total done: {len(done_ids)}/{len(archive_gigs)}')


if __name__ == '__main__':
    main()
