# Vice Unfiltered Studio

One folder per stage. Each job moves left to right, and nothing upstream is ever overwritten.

```
sources/ ──► work/ ──► exports/ + thumbnails/ ──► deliverables/
   ▲            ▲
assets/      tools/
```

| Folder | What lives there | Rule |
|---|---|---|
| `assets/CORE_2026-11-22/` | The CORE pack exactly as uploaded: SFX, brand, inserts, roses, style refs, covers, GIFs | Read-only, never edited |
| `assets/EXAMPLE_FINAL_EDITS/` | Past edits, kept as pacing references | Read-only |
| `assets/fonts/` | Anton, Bebas Neue, Oswald (SIL OFL, licenses alongside) | Your brand fonts take priority if supplied |
| `assets/ASSET_INVENTORY.csv` | Every asset: hash, duration, size, fps, audio, alpha, manifest match | Regenerated on every upload |
| `sources/<Streamer>/` | Raw stream footage, one folder per creator | Never deleted |
| `work/<Streamer>_<NN>_<Moment>/` | EDL, segments, frame checks, QC output for one clip | Scratch; safe to rebuild |
| `exports/` | `<Streamer>_<NN>_<Moment>_V<n>.mp4` | New version = new file; approved versions are never overwritten |
| `thumbnails/` | `<Streamer>_<NN>_<Moment>_THUMBNAIL_V<n>.png` + `.jpg` | Same versioning |
| `deliverables/<batch>/` | The finished package: MP4, thumbnail, `EDIT_NOTES.txt`, caption, titles, ZIP | Only QC-passed files |
| `tools/` | `inventory.py`, `qc.py` | Run with `python3 -I` |
| `BATCH_TRACKER.csv` | One row per clip (spec §8 columns) | Updated at every version |

## Job flow

1. **Upload**: attach source MP4s (plus any new assets) in the chat.
2. **Intake**: each file goes into its own folder under `sources/` or `assets/`, then `tools/inventory.py` refreshes the inventory and checks hashes.
3. **Review**: contact sheets, audio levels and a transcript draft go in `work/…`, and the strongest true moment is picked.
4. **EDL**: `work/…/EDL.csv` maps source time to output time for every cut, insert, freeze and SFX hit.
5. **Render**: FFmpeg segments are concatenated, and the export goes to `exports/`.
6. **QC**: `tools/qc.py` runs, plus a visual check of every insert, transition, freeze and the final frame.
7. **Thumbnail**: real frame cutouts plus a programmatic type layer, saved to `thumbnails/`.
8. **Deliver**: the package goes to `deliverables/<batch>/`, a tracker row is added, and the files are sent in the chat.

## Git

Only this README, `CLAUDE.md`, `.gitignore` and `tools/` are tracked. The host repo `arzateruben22/Claude` is **public**, so media, brand files, meme audio, the master prompt, `ASSET_NOTES.md` and `BATCH_TRACKER.csv` stay out of it until a private repo exists.
