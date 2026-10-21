# Skin School motion studio

Short explainer clips for the lessons, rendered from code. No stock footage, no
generic "big text, gradient, fade in, logo at the end": a layer stacks, a cell
rises, a wall wears and seals, a calendar fills, two actives collide, a timeline
reaches day 90. Every line and number comes from the lesson, the general
esthetics layer in `knowledge/general/`, or Evelyn's own Skin Playbook answers
(the "Evelyn says" shot in 8-3 is her sentence).

```
brief ──▶ shot list ──▶ scene (seek(t)) ──▶ render ──▶ review ──▶ deliver
  lesson     scenes.mjs    scenes.mjs       render.mjs   warnings    mp4 + poster
                                                 ▲           │
                                                 └── fix ────┘
```

## The pieces

| File | What it is |
|---|---|
| `motion.js` | The runtime inlined into every scene page: easing, `tw`, `enter`, `type`, `count`, and `M.stage(t)`, which runs the shot list (which shot is up, the slide between shots, the caption bar). |
| `scenes.mjs` | The flat scenes. Each one is a shot list (`at`, `name`, `cap`), markup, CSS, an optional `setup()` and `seek(t, st, M, C)`. `seek` sets everything on screen from time alone. |
| `scenes3d.mjs` | The solid scenes: the same contract, but the picture is a lit three-dimensional set drawn with three.js (`vendor/three.module.min.js`, MIT) into a canvas behind the header and caption. A scene carries `module`, an ES module that defines `window.seek` itself. Today: a voxel block of skin with a pore that clogs, inflames and clears (8-2), ninety dominoes falling one night at a time, four skipped, then a restart (3-3), the sun's rays and the SPF shield (10-1), a tired barrier worn and sealed (11-1), a dark spot made, carried out a month at a time and guarded (9-3), and a moisturizer decoded: humectants, emollients, occlusives (2-2). |
| `render.mjs` | The frame engine. Opens each scene at the frame size, calls `seek(i / fps)` for every frame, captures it and pipes it into ffmpeg. Writes the clip, the poster, a review sheet, the log and `docs/school/videos.js`. |
| `render-log.json` | Evidence: frames, bytes, a hash of every frame, sampled frame hashes, the warnings, when it rendered. |
| `review/` | Contact sheets (one frame every 1.5 s) for the eye. Not committed. |

## Determinism

A clip is a pure function of time. The solid scenes hash every variation from an index and render through SwiftShader, so they are reproducible too; they just take longer (a frame of the pore is about half a second). The runtime never uses timers,
`requestAnimationFrame`, CSS transitions or animations, `Date` or
`Math.random`; the renderer freezes all of them in the page before the scene
loads, and the film grain is an SVG turbulence with a fixed seed. So the same
scene renders the same bytes on any machine, and a one-line fix re-renders
just that scene.

`node docs/school/motion/render.mjs --verify` re-renders a sample of frames and
compares their hashes with the log. `deterministic: true` in the log is the
evidence.

## Review, before anyone watches

The engine checks each shot at its settled moments and warns about any text
that runs past the frame or sits on another text, and about any stretch
longer than 2.5 s where nothing on screen changes (the closing hold excepted).
Fix the scene, render again. Then look at the review sheet: the warnings catch
layout, not taste.

## Running it

```
cd lumevina
PLAYWRIGHT_DIR=<folder with node_modules/playwright> CHROMIUM=/opt/pw-browsers/chromium \
  node docs/school/motion/render.mjs                      # every scene, 16:9, into img/school/video/
  node docs/school/motion/render.mjs --only 6-2 --quick   # one scene, 6 fps, review sheet only
  node docs/school/motion/render.mjs --aspect 9x16        # the Reels/TikTok cut, into marketing/ads/out/video/
  node docs/school/motion/render.mjs --verify             # the determinism check
  node docs/school/motion/render.mjs --list
python3 docs/school/build.py                              # the player picks up docs/school/videos.js
```

Sizes are in `vmin`, so a scene renders the same at 1280×720 and 720×1280;
portrait gets its own layout rules in each scene's CSS where it needs them.
Output is H.264 (yuv420p, faststart) at CRF 22, 30 fps: flat vector frames
compress to a few hundred KB per clip.

## Sound

The clips are silent on purpose and the captions carry every line, which is
how Reels are watched. Evelyn's voice goes over them when she records: the
lesson box says "Evelyn's video next" and her 9-minute lesson video replaces
the explainer as the main video when it exists.

## Adding a scene

1. Pick the lesson and write the shot list first: three to six shots, one idea
   each, a caption that stands alone with the sound off.
2. Write the markup and CSS in the school's style (black, rose, gold; left
   aligned; sizes in `vmin`).
3. Write `seek`: for the current shot, compute every position, size and opacity
   from `st.lt` with `M.enter`, `M.tw`, `M.seg`. Nothing fades in without a
   reason; the motion is the explanation.
4. `--quick` it, read the warnings and the sheet, fix, render for real.

For a solid scene, build the set once at module load (geometry, lights, the
camera), and in `seek` set every position, rotation, color and the camera from
`t`, then `renderer.render`. Labels that name a part of the set project the
part's 3D point to the screen each frame, so they follow the camera.

The look the solid scenes chase is the one in the reference Ruben sent: a toy
set under studio light, blocks and dominoes with real shadows, a camera that
moves slowly and with intent, the explanation carried by what the objects do.
