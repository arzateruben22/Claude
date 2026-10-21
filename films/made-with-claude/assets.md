# Made with Claude — Breakout · assets list

## Inputs

| Asset | Source | Used for | License / status |
|-------|--------|----------|------------------|
| `claude_visual.mp4`, `claude_visual_2.mp4` | Uploaded references (1920×1080, 30 fps, 12.05 s) | **Reference only**: story beats, camera grammar, mascot design, layout, sound structure. No pixels or audio from them are in the film. | Supplied by the client |
| Copy: "MADE WITH CLAUDE", "OPUS 5.5", editor labels, layer and project names, "glow" | Read off the reference frames | Title card and UI text | Supplied (see style guide §5) |
| three.js r170 (`vendor/three/`) | npm `three@0.170.0` | Renderer, post-processing passes, RoundedBoxGeometry, RoomEnvironment | MIT (`vendor/three/LICENSE`) |
| Inter 400/500/600/700 (`vendor/fonts/`) | npm `@fontsource/inter@5.1.0` | Editor UI | SIL OFL 1.1 |
| Montserrat 500–900 (`vendor/fonts/`) | npm `@fontsource/montserrat@5.1.0` | Title card | SIL OFL 1.1 |

## Generated in code (no external media)

| Element | Where |
|---------|-------|
| Editor UI: menus, toolbar icons, project, viewer, info/preview/effects, timeline | `src/ui.js` (canvas 2D vector drawing) |
| Pixel sprite (12×8) and the 3D mascot | `src/ui.js` `SPRITE`, `src/mascot.js` |
| Desk, slab, backdrop gradient, glossy screen, lighting | `src/main.js` |
| Voxels, glass shards, sparks, shockwave, playhead, beams, keyframes, Glow streak | `src/fx.js` |
| Starburst and swoosh on the title card | `src/ui.js` (procedural, not a logo file) |
| Entire soundtrack: 120 BPM score and all foley | `src/audio.py` (additive and FM synthesis, seeded noise) |

## Delivered (`out/`)

| File | Spec |
|------|------|
| `made-with-claude-16x9.mp4` | 1920×1080 · 30 fps · H.264 High CRF 15 · BT.709 · AAC 256k 48 kHz · 12.0 s · −14 LUFS |
| `made-with-claude-9x16.mp4` | 1080×1920 · same spec |
| `poster-<fmt>-hook.jpg` | Frame at 2.6 s (mascot on the toolbar, right after the breakout) |
| `poster-<fmt>-final.jpg` | Last frame: the title card with the mascot |
| `contact-<fmt>-prerender.jpg` | Gate 2 sheet (rendered before the full render) |
| `contact-<fmt>-final.jpg` | Sheet from the final frames |
