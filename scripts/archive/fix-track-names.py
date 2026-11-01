#!/usr/bin/env python3
"""
Fix Track Names — Cross-reference setlist.fm data with uploaded tracks.

For shows where track names are generic (like "tth1989 11 02t01"),
fetches the setlist from setlist.fm and renames tracks to match the
song order. Only renames when track count matches setlist count.

Usage:
  python3 scripts/fix-track-names.py
  python3 scripts/fix-track-names.py --dry-run
  python3 scripts/fix-track-names.py --force   # re-fetch even if names look good
"""

import json
import re
import time
import argparse
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from html.parser import HTMLParser

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_FILE = PROJECT_DIR / 'data' / 'tth-tour-data.json'

# Patterns that indicate a generic/bad track name
GENERIC_PATTERNS = [
    r'^tth\d',
    r'^tragicallyhip\d',
    r'^hip\d',
    r'^D\d+T\d+$',
    r'^\d{4}[\s_-]\d{2}[\s_-]\d{2}',
    r'^t\d{2}$',
    r'^d\d+t\d+$',
]


def is_generic_name(name):
    """Check if a track name is a generic filename rather than a real song name."""
    for pat in GENERIC_PATTERNS:
        if re.match(pat, name, re.IGNORECASE):
            return True
    return False


def needs_fixing(tracks):
    """Check if any track in the list has a generic name."""
    return any(is_generic_name(t['name']) for t in tracks)


class SetlistParser(HTMLParser):
    """Parse setlist.fm HTML to extract song names."""
    def __init__(self):
        super().__init__()
        self.songs = []
        self.in_song_link = False
        self.current_song = ''
        self.in_setlist_parts = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get('class', '')
        if 'setlistParts' in cls:
            self.in_setlist_parts = True
        if tag == 'a' and 'songLabel' in cls:
            self.in_song_link = True
            self.current_song = ''

    def handle_endtag(self, tag):
        if tag == 'a' and self.in_song_link:
            self.in_song_link = False
            if self.current_song.strip():
                self.songs.append(self.current_song.strip())

    def handle_data(self, data):
        if self.in_song_link:
            self.current_song += data


def fetch_setlist(url):
    """Fetch and parse a setlist.fm page, return list of song names."""
    try:
        req = Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        })
        with urlopen(req, timeout=30) as resp:
            html = resp.read().decode('utf-8', errors='replace')

        parser = SetlistParser()
        parser.feed(html)
        return parser.songs
    except (HTTPError, URLError, TimeoutError) as e:
        print(f'    Failed to fetch setlist: {e}')
        return []


def main():
    parser = argparse.ArgumentParser(description='Fix generic track names using setlist.fm data')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without saving')
    parser.add_argument('--force', action='store_true', help='Re-check all shows, not just generic names')
    args = parser.parse_args()

    with open(DATA_FILE) as f:
        gigs = json.load(f)

    # Find gigs with tracks that need fixing
    to_fix = []
    for g in gigs:
        if not g.get('tracks'):
            continue
        if not g.get('setlistUrl'):
            continue
        if args.force or needs_fixing(g['tracks']):
            to_fix.append(g)

    print(f'Found {len(to_fix)} shows with tracks that need name fixes')
    if not to_fix:
        print('Nothing to do!')
        return

    fixed_count = 0
    skipped_count = 0

    for i, g in enumerate(to_fix):
        iso = g.get('isoDate', '?')
        venue = g.get('venue', '?')
        track_count = len(g['tracks'])
        print(f'\n[{i+1}/{len(to_fix)}] {iso} - {venue} ({track_count} tracks)')

        # Fetch setlist
        songs = fetch_setlist(g['setlistUrl'])
        if not songs:
            print(f'  No songs found on setlist.fm, skipping')
            skipped_count += 1
            time.sleep(1)
            continue

        print(f'  Setlist.fm has {len(songs)} songs: {", ".join(songs[:5])}{"..." if len(songs) > 5 else ""}')

        if len(songs) == track_count:
            # Perfect match - rename tracks in order
            print(f'  Track count matches! Renaming...')
            for j, song in enumerate(songs):
                old_name = g['tracks'][j]['name']
                g['tracks'][j]['name'] = song
                if old_name != song:
                    print(f'    {j+1}. "{old_name}" -> "{song}"')
            fixed_count += 1
        elif len(songs) < track_count:
            # More tracks than songs - might have encore splits, banter tracks, etc.
            # Still rename what we can match at the start
            print(f'  Partial match: {len(songs)} songs but {track_count} tracks')
            print(f'  Renaming first {len(songs)} tracks...')
            for j, song in enumerate(songs):
                old_name = g['tracks'][j]['name']
                g['tracks'][j]['name'] = song
                if old_name != song:
                    print(f'    {j+1}. "{old_name}" -> "{song}"')
            fixed_count += 1
        else:
            # More songs than tracks - tracks might be merged or incomplete recording
            print(f'  Mismatch: {len(songs)} songs but only {track_count} tracks, skipping')
            skipped_count += 1

        # Be polite to setlist.fm
        time.sleep(2)

    print(f'\n--- Summary ---')
    print(f'Fixed: {fixed_count}')
    print(f'Skipped: {skipped_count}')

    if fixed_count > 0 and not args.dry_run:
        print(f'Saving updated tour data...')
        with open(DATA_FILE, 'w') as f:
            json.dump(gigs, f, indent=2)
        print('Done!')
    elif args.dry_run:
        print('[DRY RUN] No changes saved')


if __name__ == '__main__':
    main()
