# Made with Claude — Breakout

A 12-second code-rendered motion film, built from the two reference cuts
(`claude_visual.mp4` and `claude_visual_2.mp4`). It runs at 30 fps on a 120 BPM grid,
as two separate compositions: 16:9 at 1920×1080 and 9:16 at 1080×1920.

A coral voxel mascot breaks out of a motion editor's comp viewer on the music drop. It hops
along the toolbar, types "glow" into Effects & Presets, and rides the playhead while lasering
keyframes into the timeline. It lands next to the finished **MADE WITH CLAUDE · OPUS 5.5**
card.

## Render

```bash
node films/made-with-claude/scripts/render.cjs                         # both formats → out/
node films/made-with-claude/scripts/render.cjs --contact               # pre-render contact sheets
node films/made-with-claude/scripts/render.cjs --range 4-5.5 --format 9x16   # re-render a section
node films/made-with-claude/scripts/render.cjs --scale 0.5 --q preview # fast draft
node films/made-with-claude/scripts/probe.cjs && python3 -I films/made-with-claude/scripts/qa.py pass1   # measured review
node films/made-with-claude/scripts/framing.cjs 9x16                   # where the mascot sits, every frame
```

You need Node 18+ with Playwright and its bundled Chromium, plus ffmpeg and Python 3 with
numpy and Pillow. There's no build step and no network access: three.js r170 (MIT) and the
Inter and Montserrat fonts (OFL) are vendored in `vendor/`.

A full final-quality render takes about 50 minutes for both formats on a 4-core CPU with
SwiftShader (software WebGL). Drafts at `--scale 0.5 --q preview` take a few seconds per
frame.

To preview and scrub, run `npx http-server films/made-with-claude` and open
`/src/index.html?format=16x9&t=4.4` (`?scale=0.5` is faster).

## Why this renderer

The film is **Three.js in headless Chromium, captured frame by frame through Playwright**.
ffmpeg encodes it and numpy synthesizes the sound.

- **It's a 3D film.** The references are real 3D: a perspective camera skimming a UI slab,
  bokeh depth of field, sub-frame motion blur, soft shadows, and reflections in a glossy
  screen. A 2D compositor (CSS/GSAP, Remotion) would fake all of that. Three.js renders it,
  and the scene is plain, editable JavaScript.
- **The editor is real UI type.** Every panel is drawn with canvas 2D (Inter and
  Montserrat), then mapped onto the slab as a texture. Labels, the typed search and the
  timecode are all live text driven by the timeline.
- **It's deterministic and seekable.** `film.seek(frame)` is a pure function of the frame
  number. The camera, mascot pose, effects and UI state are evaluated from
  `timeline.json`. Noise is seeded and no wall clock is involved. Motion blur averages *K*
  sub-frames across a 180° shutter, and *K* adapts to measured screen motion. Every buffer is
  explicitly cleared, and each frame is verified byte-identical regardless of render order.
  Any frame range can be re-rendered on its own.
- **One timeline.** `src/timeline.json` holds the shots, camera keys (absolute or
  mascot-relative), mascot moves, UI beats, keyframes and the music grid and chords. The
  picture (`main.js`, `mascot.js`, `fx.js`, `ui.js`) and the sound (`audio.py`) both
  read it.

## Files

| Path | What it is |
|------|-----------|
| `style-guide.md` · `shotlist.md` | Look and story rules, beat-by-beat shot list |
| `src/timeline.json` | **The timeline**: camera, mascot, UI events, keyframes, music |
| `src/main.js` | Scene, lights, slab, camera solver, post pipeline, `window.film` API |
| `src/ui.js` | The editor UI (original, generic) drawn in canvas 2D, with state from the timeline |
| `src/mascot.js` | Procedural mascot plus pose solver (ballistic hops, squash and stretch, facing, eyes) |
| `src/fx.js` | Voxels, glass shards, playhead, beams, keyframes, streak, shockwave, shadows |
| `src/audio.py` | Score and foley synthesized from the timeline (seeded) |
| `scripts/render.cjs` | Capture → audio → loudness → H.264 → posters → contact sheets |
| `scripts/probe.cjs` · `qa.py` · `framing.cjs` | Measured review tooling |
| `scripts/camkeys.py` | Edit camera keys from the command line |
| `review/` | Scorecards and the human-review note |
| `out/` | Final videos, posters and contact sheets |
