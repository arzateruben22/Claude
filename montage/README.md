# POV Montage Pipeline

Turn raw Meta Ray-Ban (or any camera) POV footage into a finished 1–2 minute
montage — city nightlife, gym PRs, drives, whatever. You mark the moments,
the pipeline builds the cut.

**You are the eyes; these scripts are the editor's hands.** They don't decide
what's a highlight — `detect_highlights.py` *suggests* candidates from scene
changes and loud audio (revs, clangs, bass, crowds), and you make the final call.

---

## 0. One-time setup: install ffmpeg

Everything here needs `ffmpeg` (and `ffprobe`, which ships with it) on your PATH.

- **macOS:** `brew install ffmpeg`
- **Windows:** `winget install Gyan.FFmpeg`  (or `choco install ffmpeg`)
- **Linux:** `sudo apt install ffmpeg`

Check it: `ffmpeg -version`

Python 3.9+ is also required (only the standard library is used — no pip installs).

---

## 1. Get your footage onto a computer at full quality

This is the step where most people silently lose quality. **Do not** re-share
clips through Instagram/WhatsApp/Messenger and pull them back — every pass
recompresses. Export the **originals** from the Meta AI app to your phone, then
transfer to the computer (AirDrop, cable, or upload). Edit from those.

Put the clips in a folder, e.g. `./clips/`.

---

## 2. Auto-scan for candidate moments (optional but fast)

```bash
python3 detect_highlights.py ./clips --pad 1.5 --len 5
```

This writes **`highlights.txt`** pre-filled with candidate clips. Each line is:

```
clips/miami1.mp4 | 0:45 | 0:52 | CAPTION
```

Tuning:
- `--scene 0.25` → more/looser cut points (lower = more sensitive)
- `--noise -25` → only the *loudest* moments (higher number = louder-only)
- `--pad` → seconds to start *before* the detected moment
- `--len` → default candidate length

You can also skip this entirely and just write `highlights.txt` by hand
(see `highlights.example.txt`).

---

## 3. Trim the edit list

Open `highlights.txt` and:
- fix the in/out times to the exact moment (revs peaking, the rep locking out, the drop hitting),
- add short captions (a city name, "FULL ROM", etc.) or leave blank,
- **delete every line you don't want**, and reorder lines into the flow you want.

Keep the total under ~90–120s for a tight montage. The renderer warns you if
you go over.

---

## 4. Render

**Vertical (TikTok / Reels / Shorts) with a music bed:**
```bash
python3 build_montage.py highlights.txt --vertical --music track.mp3 -o miami_ep1_vertical.mp4
```

**Horizontal (YouTube), 60fps:**
```bash
python3 build_montage.py highlights.txt --horizontal --fps 60 --music track.mp3 -o miami_ep1_yt.mp4
```

Render both from the **same edit list** so your vertical and horizontal cuts match.

Useful flags:
| flag | what it does | default |
|------|--------------|---------|
| `--vertical` / `--horizontal` / `--square` | canvas orientation | vertical (1080×1920) |
| `--fps 60` | output frame rate | 30 |
| `--music FILE` | music bed (looped to length) | none |
| `--music-vol 0.85` | music loudness 0–1 | 0.85 |
| `--duck 0.28` | original audio under the music (0 = mute it) | 0.28 |
| `--no-color` | skip the light contrast/saturation punch | off (punch on) |
| `--bitrate 45M` | override output bitrate | auto by resolution |
| `-o NAME.mp4` | output filename | montage.mp4 |

---

## 5. Keeping the highest quality (the whole point)

The pipeline already does the right things — you just need to feed it well and
publish right:

1. **Edit from originals**, never from app-recompressed re-downloads (step 1).
2. **Segments are re-encoded at CRF 16** (near-lossless) before stitching, so
   cuts don't degrade the footage.
3. **Master exports at high bitrate** — 1080p ≈ 18 Mbps, 4K ≈ 45 Mbps
   (auto-picked; override with `--bitrate`).
4. **Upload the master straight to the platform.** Let YouTube/TikTok do the
   *one* compression. Never pre-compress small and then upload — that's two
   lossy passes stacked.
5. **Match the platform's frame:** vertical master for TikTok/Reels/Shorts,
   horizontal for YouTube. Both come from the same edit list.
6. Shoot at the **highest resolution/fps** your glasses support, in good light —
   the small sensor is the real quality ceiling, not the pipeline.

---

## Files

- `detect_highlights.py` — scans clips, proposes candidate moments → `highlights.txt`
- `build_montage.py` — renders the montage from an edit list
- `highlights.example.txt` — the edit-list format, annotated

## What this does NOT do (yet)

- It doesn't "watch" and judge highlights for you — detection is a hint, you decide.
- No true musical beat-sync (cuts land where *you* set them). Set your in/out
  points on the beat if you want that feel.
- No automatic face/plate blurring — mind consent and platform rules for
  nightlife footage of strangers.
