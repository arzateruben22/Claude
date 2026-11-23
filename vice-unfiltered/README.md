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
| `tools/` | `intake.py`, `render_clip.py`, `thumbnail.py`, `qc.py`, `inventory.py` | Run with `python3 -I` from `vice-unfiltered/` |
| `studio/` | The control room page source | Published as a private claude.ai page |
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

## Thumbnail styles

`tools/thumbnail.py <job.json>` builds a 1080×1920 PNG + JPG from real clip frames, with type set in code (Anton/Oswald/Bebas). It never generates faces or lettering. Samples are in `thumbnails/TEMPLATE_SAMPLES/` and in the studio under Assets → Thumbnail styles.

| Style | Template | Modelled on | Best for |
|---|---|---|---|
| A | `poster` | IMAGE-1 / Nightclub Chaos poster | a strong face reaction |
| B | `blocks` | the six authentic KreekCraft covers | when the gameplay moment is the story |
| C | `tabloid` | "Bro Thought He Was Tuff" layout, rebuilt with flat type | a two-beat payoff (before/after) |

**Rotation.** Every batch uses all three styles, and each streamer moves one style along per batch:

- Batch 01: Dom A, KreekCraft B, Steveeeyyy C
- Batch 02: Dom B, KreekCraft C, Steveeeyyy A
- Batch 03: Dom C, KreekCraft A, Steveeeyyy B

Then repeat. Record the style in the tracker's `thumb_style` column.

## The studio (control room)

Private page: https://claude.ai/artifact/ScqKbuLk3EXQ4kEHvEhFBS (source: `studio/vice-studio.html`). It follows the Prism Studio layout with Vice Unfiltered's own look:

- **Home:** a poster per streamer.
- **Streamer room:** a strip of the other streamers, the header, the batch bar, *Ready to post* (one card per account) and *In the edit*.
- **Upload Desk** and **Review** (approve the clip or request changes).
- **More:** Library, Campaign rules, Accounts.

All records live in the page's database, never in the page source:

| Collection | Doc id | Fields |
|---|---|---|
| `streamers` | slug | name, platform_note, accent, accent_ink, order, archived, campaign {name, cta, hashtags, overlay, audio, disclosure, notes, verified_at} |
| `accounts` | youtube / tiktok / instagram | handle (null until you give it), active (false = switched off everywhere) |
| `batches` | batch01… | label, created_at, streamers[], active |
| `clips` | `<slug>-<NN>-<moment>-v<n>` | streamer, clip_no, moment, version, batch, status (editing, qc, ready_for_review, revision, approved, archived), runtime_s, video_url, thumb_url, title, titles[], exports {youtube/tiktok/instagram: {title, caption, hashtags, disclosure}}, edit_notes, qc, review_note, created_at |
| `publications` | `<clipId>__<platform>` | written only by the page's buttons: status (ready / uploaded / submitted), uploaded_at, submitted_at |

**Delivering a clip into the studio:** once the clip passes QC, upload the MP4 and thumbnail to the studio's asset store (Artifact publish with `url`, `asset: true`, `file_paths`; 20 MiB cap per file). Then write the `clips` doc with the returned URLs and status `ready_for_review`. The clip shows up under Review. When it is approved, its cards appear in the streamer's room and on the Upload Desk. A *Request changes* note lands in `review_note`, which is read back for the next version.

## Git

Only this README, `CLAUDE.md`, `.gitignore` and `tools/` are tracked. The host repo `arzateruben22/Claude` is **public**, so media, brand files, meme audio, the master prompt, `ASSET_NOTES.md` and `BATCH_TRACKER.csv` stay out of it until a private repo exists.
