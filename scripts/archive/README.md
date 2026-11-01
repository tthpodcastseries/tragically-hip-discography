# Old scripts - kept for reference, don't run

Moved here in v5.4.18 (audit CODE-03). None of them is part of the data refresh, and
most can't run as they are. Their paths assume they live in `scripts/`.

| Script | What it did | Why it's here |
|---|---|---|
| `upload-audio-to-b2.py` | Downloaded show ZIPs from The Tragically Hip Archive, put the MP3s on Backblaze B2 and wrote `tracks` into `data/tth-tour-data.json` | Needs Backblaze keys (not on this Mac) and `scripts/.upload-progress.json` (gone). Rewrites the file the 614 recordings live in |
| `run-upload-workers.sh` | Ran 5 copies of the upload script, then `fix-track-names.py` | Same as above |
| `fix-track-names.py` | Renamed generic track names ("Track01") from setlist.fm | Rewrites `data/tth-tour-data.json`; ask jD first |
| `build-missing-lyrics-doc.js` | Word checklist of songs missing lyrics | Needs the removed `docx` package, and no lyrics are missing now |
| `build-feature-guide.py` | "The Hip Compendium v3.0 Feature Guide" PDF | Old name and old address |
| `changelog.py` | v2.7 changelog PDF | Old; the changelog is `docs/CHANGELOG.md` |

Git history has every version of these files.
