---
name: cinema-kit
description: Run the studio's code-rendered film process with the cinema kit in kits/cinema. Use when the user asks for a code-rendered film, a motion clip, an explainer animation, a lesson video, a launch reel, or to give an existing three.js scene "the film look" / "cinema style". Runs the intake, writes the style guide and shot list before building, keeps one timeline for camera, motion, UI and sound, adds the cinema3d.js finish (motion blur, bokeh, bloom, ACES), measures before anyone watches, and exports each aspect as its own composition.
---

# Cinema Kit — Studio Film Process

Films are rendered in code: three.js in headless Chromium, captured frame by frame through
Playwright, encoded with ffmpeg, sound synthesized in Python. Two reference builds:

- `films/made-with-claude/` — a film from scratch (12 s, 16:9 + 9:16, score and foley).
  Copy its structure for a new film. Read its `README.md`, `style-guide.md`, `shotlist.md`.
- `films/skin-school-pilot/` — the finish dropped into someone else's seekable three.js
  scene, then directed. Copy its adoption. Read its `README.md`.

The kit is `kits/cinema/` (read `kits/cinema/README.md` first):

| File | What it is |
|---|---|
| `kits/cinema/cinema3d.js` | One-file finish for any three.js r160+ scene that exposes `window.seek(t)`: probe → K jittered sub-frames over a 180° shutter → centre depth → bokeh DOF focused by `window.CINEMA_FOCUS(t)` → bloom → ACES, premultiplied for DOM pages. `cinemaRenderer()` replaces `new THREE.WebGLRenderer()` (r160 `render()` is an instance method, so prototype patches never run). `window.cinemaFrame(t)` renders one frame. |
| `kits/cinema/keys.js` | Keyed camera (per-key eases, portrait scale/lens overrides) and focus keys racked over ~0.45 s. |

## Step 0 — Where does it live?

- **New film** → `films/<slug>/`, self-contained: vendored three.js (pinned), fonts, no network.
- **Existing scene** → stay in that project; copy `cinema3d.js` next to the scene. On another
  client's branch, pilot in a separate folder first and mark every change `cinema:` / `directed:`.

## Step 1 — Intake (always, before building)

Use AskUserQuestion. Cover all five:

1. **Purpose** — launch reel, explainer, lesson, ad? The one thing the viewer must remember.
2. **Audience & venue** — social feed (muted autoplay), site hero, lesson player, broadcast.
3. **Duration & formats** — seconds, fps (30 default), 16:9 / 9:16 / both.
4. **Sound** — silent (captions carry it), score + foley, or VO later. Target −14 LUFS for
   social, −18 LUFS under a voice.
5. **Brand identity** — the client's palette, type, mark or mascot, references. **Never reuse
   another client's palette or type** (not Los Güeros espresso/amber, not Claude coral, not
   Lumevina rose). Reuse the machinery and the quality bar, never the identity.

## Step 2 — Style guide + shot list (show them before building)

Write `style-guide.md` and `shotlist.md` in the film folder, modelled on made-with-claude's:

- **Style guide**: references inspected (observed → carried over), palette tokens with roles,
  type, and look and motion rules: lens range, 180° shutter, glow budget (UI text never
  blooms), physics, beat grid, finish.
- **Shot list**: per shot, time (s and frames), entry state, action, exit state, purpose and
  sound. Add a reading budget (words vs clean seconds on screen; final hold ≥ 1.5 s) and
  continuity rules. Frame 0 is already composed; the last frame works as poster and loop point.

Show both to the user and get a go-ahead before any scene code.

## Step 3 — One timeline

Camera keys, focus keys, object and character motion, UI or caption beats and every sound
cue live in one source: `src/timeline.json` for a new film, or the scene's key and event
tables for an adopted scene. The picture and the sound both read it; never hand-place a cue.
Sit beats on a grid (120 BPM: a beat is 0.5 s, 15 frames). Seed all noise and use no wall
clock: every frame is a pure function of t.

## Step 4 — Build

**New film** — follow `films/made-with-claude/`:
- `src/main.js`: scene, camera solver, AccumPass motion blur with adaptive K, DOFPass
  (scatter-as-gather bokeh, tile-max CoC), bloom, ACES, grade, `window.film.seek(frame)`.
- `src/timeline.json`: camera keys absolute or mascot-relative (`"rel": true` plus `"aim"`),
  so tracking shots never lose the hero; focus targets. 9:16 gets its own keys.
- `src/mascot.js`: squash and stretch, anticipation, landing spring (40 ms attack), yaw
  continuity. `src/ui.js`: real type in canvas 2D on textures. `src/audio.py`: seeded
  synthesis from the timeline, then loudnorm. `scripts/`: copy all; swap every identity value.

**Existing seekable three.js scene (r160+)** — adopt `cinema3d.js` in three steps:
1. Inject `kits/cinema/cinema3d.js` right after the scene's three.js import (before any
   other patch that wraps rendering).
2. Rewrite `new THREE.WebGLRenderer(` → `cinemaRenderer(`.
3. In the frame loop call `window.cinemaFrame(t)` instead of `window.seek(t)` when it exists,
   with `window.CINEMA.fps` set to the final fps.

Then direct it; the finish alone changes little:
- Replace orbits with keyed camera per shot (`kits/cinema/keys.js`); portrait gets its own
  scale and lens, framed for 9:16 safe zones.
- Add `window.CINEMA_FOCUS(t)` from focus keys on whatever the caption or label names.
- Physical animation: gravity, bounce, squash on landing, stretch on fall, sprung squash
  settle, contact accents (splash rings, additive so they bloom). Keep a `--plain` A/B path.

## Step 5 — Stills and contact sheet before the full render

Final renders take hours in SwiftShader (about 3–8 s a frame directed; made-with-claude
took 4–5 h for both formats). So render a contact sheet and stills at the key moments
(hook, landings, whips, end card) first, and show them. **Stills keep the final shutter**:
the pilot's `--quick` does; in made-with-claude use `--times` at the default `--q final`
(`--q preview` caps K at 6 and hides blur problems; `--scale 0.5` is fine).

## Step 6 — Measure, fix the worst three, re-render

Before anyone watches:
- **Framing** — the hero inside the safe frame every frame; only deliberate whips flagged.
- **Copy** — every text inside the safe frame, not overlapping, clean for its reading budget.
- **Legibility with motion** — readable on the blurred frames too, not just the sharp ones.
- **Contrast** — captions ≥ 4.5:1 over the frame behind them; add a scrim where needed.
- **Sync** — every cue within a frame of its picture event; loudness and true peak (−1 dBTP).
- **Determinism** — a frame is byte-identical whatever the render order.

Fix the worst three, re-render only the frames an edit touched (signatures diff →
`--frames`), and write `review/scorecard.md` (score per axis, pass vs pass).

## Step 7 — Export

- **Each aspect is its own composition**: own camera keys, safe zones, restacked end card.
  Never crop 16:9 into 9:16.
- `out/`: H.264 (CRF ~19, yuv420p, faststart), AAC 256k, posters (hook + final frame),
  contact sheets per format. Near-lossless masters stay in `build/` (not committed).
- `assets.md`: every input, vendored library and font with its license, what is generated.
- `review/HUMAN-REVIEW.md`: what code could not check (brand and trade-dress approval,
  AI-content labelling, photosensitivity: ≤ 3 flashes/s and an analyzer before broadcast,
  a listen on phone speakers and headphones, taste calls). List TODO placeholders.

## Step 8 — Ship

Commit and push only at the end, with clear messages; no PR unless the user asks. Never commit
`build/`, kill a running render, or delete another render's `.tmp/` or `out/`.

## Commands

New-film pipeline (Node 18+ with Playwright, ffmpeg, Python 3 with numpy + Pillow):
```bash
F=films/made-with-claude
node $F/scripts/render.cjs                                  # both formats → out/
node $F/scripts/render.cjs --contact                        # pre-render contact sheets
node $F/scripts/render.cjs --times 2.0,4.5 --label check    # stills, final shutter
node $F/scripts/render.cjs --range 4-5.5 --format 9x16      # re-render a section
node $F/scripts/render.cjs --frames 60,75,90 --resume       # exact frames; keep what's on disk
node $F/scripts/probe.cjs && python3 -I $F/scripts/qa.py pass3     # measured review
node $F/scripts/framing.cjs 9x16                            # hero position, every frame
python3 -I $F/scripts/probe_range.py 9x16 4 5 0.1 glow,title       # copy + framing over a window
node $F/scripts/camsolve.cjs 9x16 keys.json glow,title      # try camera keys without rendering
node $F/scripts/signatures.cjs all > sigs.json              # per-frame scene hashes
node $F/scripts/signatures.cjs --diff old.json new.json     # → frames an edit touched
```

Adopted-scene pipeline (the pilot):
```bash
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
P=films/skin-school-pilot/motion
node $P/render.mjs                                          # directed, 16:9, with the finish
node $P/render.mjs --aspect 9x16                            # the Reels cut
node $P/render.mjs --quick --times 4,9.5,19.3 --label check # stills → build/review/, final shutter
node $P/render.mjs --scenes original                        # the client's scene + finish only
node $P/render.mjs --scenes original --plain                # the client's renderer exactly
node $P/render.mjs --verify                                 # re-render a sample, compare hashes
```
