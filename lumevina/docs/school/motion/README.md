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
| `motion.js` | The runtime inlined into every scene page: easing, `tw`, `enter`, `type`, `count`, and `M.stage(t)`, which runs the shot list (which shot is up, the slide between shots, the caption bar). It also draws the room every page sits in, on a canvas behind the scene: a warm darkness, a pool of light on the table, a few soft bokeh discs, dust rising through the light; and once per flat scene it dresses every solid rounded element in the canvas as a thing on that table (a soft contact shadow, a touch of light across its top). |
| `scenes.mjs` | The flat scenes. Each one is a shot list (`at`, `name`, `cap`), markup, CSS, an optional `setup()` and `seek(t, st, M, C)`. `seek` sets everything on screen from time alone. |
| `scenes3d.mjs` | The solid scenes: the same contract, but the picture is a lit three-dimensional set drawn with three.js (`vendor/three.module.min.js`, MIT) into a canvas behind the header and caption. A scene carries `module`, an ES module that defines `window.seek` itself. Today: a voxel block of skin with a pore that clogs, inflames and clears (8-2), ninety dominoes falling one night at a time, four skipped, then a restart (3-3), the sun's rays and the SPF shield (10-1), a tired barrier worn and sealed (11-1), a dark spot made, carried out a month at a time and guarded (9-3), a moisturizer decoded: humectants, emollients, occlusives (2-2), a double cleanse without stripping (2-1), the acid dose, the overdose and the rest (4-2), and vitamin C in the morning, with the vial that turns brown (5-1). |
| `studio3d.js` | The studio set every solid scene shares; `render.mjs` pastes it after each module's three.js import and turns every `BoxGeometry` into a `SoftBox` (rounded, bevelled). It dresses the set on the first frame (a warm key low to the side with soft VSM shadows, a pink fill, a warm rim, a glossy brown floor with a pool of light that fades out behind the subject), moves the camera a little every frame (a slow push in, a small sway, applied inside `lookAt` so projected labels stay on their anchors), and prints each frame through its own passes: the scene into a texture with depth, ambient occlusion from that depth, a half-size bokeh blur by distance from the focus plane (the camera's look-at point), a quarter-size glow, then ACES, a warm grade and a vignette. `window.STUDIO_OPTS` can override its knobs for tuning. |
| `skin3d.js` | The living-skin look of Oct 21–26 (`--look tissue`), softer and about four times slower to render; on a phone, where the course page crops the clip to 4:3, it read as soft and stripy, so the hero and the free lessons went back to the blocks. The scenes keep modelling skin as a grid of cells (the block, its top row) and animating them one by one; `render.mjs` turns every `InstancedMesh` of cells into a stand-in that writes into one soft field, and the picture is a marching-cubes surface over that field (three's own addon, from `metaballs.js`): one piece of tissue with rounded edges, a round follicle where cells are missing, a swelling where a cell rises, a dip where one shrinks or sheds. Its shader samples the cells' colours through a 3D texture (so the layers blend and the dermal–epidermal junction undulates), relieves the surface with skin lines and pores, the dermis band of the cut with collagen fibres and the fat below with lobules, and keeps the top matte. The dead-cell plates of 4-2 become loose scales. `--cubes` renders the old blocks; `--skin bump=0,undulation=0.1,top=0.9,shade=0` turn its knobs; `--at 4,15` renders stills of any scene into `review/`. |
| `skinblock.js` | The look since Oct 26, and the default: the rounded cubes stay crisp and countable, and each cell's own material gets a touch of skin in its shader. The pale cells carry the fine polygonal line network of skin, a few pores on the faces that point up and a dewy shine there; the rose cells a soft fibrous grain, low in contrast; the yellow cells round lobules; every cell a slightly blotchy tone, a bump that catches the key light and a soft velvet rim. The layer comes from the cell's colour, the pattern from its instance number, so it moves with the cell and never swims. The lens keeps more of the block sharp (half the film finish's focus blur). `--look tissue` renders with `skin3d.js` instead, `--look cubes` (or `--cubes`) the plain blocks; `--skin lines=0.5,pores=0,bump=1,rim=1,dew=1,focus=0.5` turn its knobs. |
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
  node docs/school/motion/render.mjs --only hero --hd       # 1080p (1920×1080), about twice as long as 720p
  node docs/school/motion/render.mjs --only 8-2 --res 900   # 1600×900 (900×1600 for 9:16)
  node docs/school/motion/render.mjs --only hero --from 8 --to 14   # a preview of that stretch, into review/
python3 docs/school/build.py                              # the player picks up docs/school/videos.js
```

The hero is rendered at 1080p (`--hd`): the course page crops it to 4:3 on a phone, and a retina screen
shows every pixel. The free lessons in the blocks look (8-2, 11-1, 10-1, 9-3) are rendered at 900p
(`--res 900`): the lesson player shows the whole frame, so 1600×900 is sharper than any phone needs.

A frame costs about its pixel count (on this machine, a 1080p frame of the hero in the blocks look takes
about 6 s, so the hero takes some 75 minutes; renders don't go faster side by side). The blocks look keeps
it down: the skin shader computes only the pattern of the cell's own layer and takes the blotchy tone from
the cube's corners; the film finish takes as many motion samples as it would at 720p, draws a frame where
nothing moves once (with multisampling) instead of twice, and doesn't redraw the shadows for its depth
pass. `--at` prints, for each still, the samples it took and what it cost.

Sizes are in `vmin`, so a scene renders the same at 1280×720 and 720×1280;
portrait gets its own layout rules in each scene's CSS where it needs them.
Output is H.264 (yuv420p, faststart) at CRF 22, 30 fps: flat vector frames
compress to a few hundred KB per clip.

## Sound

Every lesson clip carries a soft music bed, and the captions still carry every
line, so a clip watched with the sound off (how most Reels are watched) loses
nothing. The bed is original, made in code, so nothing is licensed:

    node docs/school/motion/music.mjs        # → music/bed.m4a: 48 s, a slow four-chord loop in F, -20 LUFS
    node docs/school/motion/add-music.mjs    # lays it under every lesson in videos.js (--only 1-1,6-2 for some)

`music.mjs` builds a pad of soft sine voices, a round bass and a chime every
few seconds, and ffmpeg adds a little room and sets the level soft.
`add-music.mjs` copies each clip's picture as it is (no re-encode), lays the
bed under it, fading in over 0.8 s and out over the last 1.5 s, and starts
each lesson at one of three chords so lessons watched back to back don't open
the same way. It does the 16:9 MP4 and WebM and the 9:16 cut, and running it
again replaces the music rather than stacking it. `render.mjs` calls it on
every lesson it renders. The page's hero stays silent: it plays muted on a
loop. Evelyn's voice goes over the clips when she records: the lesson box says
"Evelyn's video next" and her 9-minute lesson video replaces the explainer as
the main video when it exists.

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

## From the film branch (claude/made-with-claude-film)

- `cinema3d.js` and `metaballs.js` are the cinema kit's (`kits/cinema/` on that branch): the film
  finish (motion blur, focus, bloom, ACES) and 3D liquid that beads, rolls and merges (three.js's
  marching cubes, built from the scene's own THREE). `render.mjs` injects `cinema3d.js`; a scene
  imports `../metaballs.js` itself.
- 8-2 is the film session's directed pilot (keyed camera, focus pulls, falling plug cells, the
  serum drops that land and turn to liquid). Its scored cut, for posting with sound, is
  `marketing/ads/out/video/8-2-sound.mp4` (the cut with the music bed stays the default).

## The course page's hero

`scenes3d.mjs` → `"hero"` is the Skin School page's opening picture, not a lesson: a 24-second loop of the skin block told in the course's three levels (the cells rise and the sun leaves two spots; drops of vitamin C, a retinoid and niacinamide sink in; the spots fade, the dermis brightens and the skin glows), with the camera on one slow orbit so the last frame meets the first. It carries `bare: true`, so the page template draws no header, caption bar or foot (the page under it says what each level is), and it stays out of `videos.js`. Render it with `--only hero --aspect 16x9 --hd`; `docs/school/hero.js` plays it and keeps the caption under it in step.
