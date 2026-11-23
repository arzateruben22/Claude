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

`tools/thumbnail.py <job.json>` builds a 1080×1920 PNG + JPG from real clip frames, with type set in code. It never generates faces or lettering. Samples are in `thumbnails/TEMPLATE_SAMPLES/` and in the studio under Assets → Thumbnail styles.

| Style | Template | Status | Look |
|---|---|---|---|
| Tabloid Strip | `tabloid` | **In use** | Full-bleed portrait, black torn headline slab (Anton), two-panel strip |
| Hype Reaction | `hype` | **In use** | The owner's three references: real streamer cut-out with white rim and glow, Montserrat Black Italic headline with a neon key word, brush underline, emoji, bursts, speed lines, optional arrow, inset and logo |
| Comic Pop Poster | `poster` | Retired (kept) | |
| Color Block Cover | `blocks` | Retired (kept) | |

**Rotation.** Alternate the two styles in use and flip each streamer every batch:

- Batch 01: Dom Hype, KreekCraft Tabloid, Steveeeyyy Hype
- Batch 02: Dom Tabloid, KreekCraft Hype, Steveeeyyy Tabloid

A third style gets added when the owner has one. Record the style in the tracker's `thumb_style` column.

**Hype job extras:**

- `emoji`: one character, rendered with Noto Color Emoji.
- `fill`: green / yellow / pink / white.
- `underline`, `glow`, `burst`: hex colours.
- `arrow`: `{"from":[x,y],"to":[x,y]}` in canvas fractions.
- `second`: an inset reaction box.
- `logo`: a logo file the owner supplies. Never recreated. Use it only on confirmed GTA VI clips.

**One-time setup for cut-outs** (fresh session):

```bash
pip install onnxruntime scipy
```

```bash
mkdir -p assets/models && curl -L -o assets/models/birefnet_lite.onnx https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx
```

Also get the person-only model, which excludes chairs (used automatically when present; MIT, ~970 MB):

```bash
curl -L -o assets/models/birefnet_portrait.onnx https://huggingface.co/onnx-community/BiRefNet-portrait-ONNX/resolve/main/onnx/model.onnx
```

About 16 s per cut-out on CPU. Edges are choked 1 px and colour-decontaminated, so no background tint stays in the fringe. The white outline is 5 px (`rim`, 0 to turn it off).

**Hand cleanup** when a sliver of chair survives: `"erase": [{"box":[x,y,w,h], "dark_below":75, "keep_ellipse":[cx,cy,rx,ry]}]` in portrait-crop pixels. This removes only near-black pixels in the box and protects the ellipse (e.g. a headphone cup).

**GTA VI logo:** `assets/BRAND_USER/gta6_logo.png`, supplied by the owner. Set `"logo": "assets/BRAND_USER/gta6_logo.png"` only for confirmed GTA VI clips.

## Titles and captions (ChatGPT)

`tools/titles.py <job.json>` sends ONLY facts verified from the footage to ChatGPT (OpenAI API, model picked automatically). It asks for 5 emoji-heavy, clickbait-but-true titles, a favourite, and YouTube, TikTok and Instagram captions. It then checks emoji counts, length, unverified quotes, an unconfirmed game name, the streamer name, and campaign CTA/hashtags/disclosure copied verbatim. A person still checks every option against the clip before delivery.

The API key comes from the environment's network secret for `api.openai.com`. No key is stored in files.

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
