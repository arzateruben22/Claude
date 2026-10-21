# Cinema kit

The studio's kit for code-rendered film: three.js scenes rendered frame by frame in headless
Chromium, captured through Playwright and encoded with ffmpeg. It has two tiers:

- **A. The finish**: `cinema3d.js` gives any seekable three.js scene motion blur, bokeh depth of
  field, bloom and ACES, while each frame stays a pure function of `t`.
- **B. The craft**: how the studio directs, measures and scores a film. It is distilled from
  `films/made-with-claude`. The finish alone changes little; most of the look comes from B.

| File | What it is |
|---|---|
| `cinema3d.js` | The finish. One file, three.js r160+ core only, no build step |
| `keys.js` | Keyed camera, handheld micro-motion and focus keys for `window.CINEMA_FOCUS`. A plain ES module with no imports, so it works with any three.js version |
| `liquid2d.js` | Liquid-chrome text morph for canvas 2D: a blob pinches into one bead per glyph and each bead swells into its letter (a metaball field shaded as chrome). Deterministic; `res` for density-scaled canvases, `palette` for the environment. Used for OPUS 5.5 in `films/made-with-claude` |
| `metaballs.js` | Liquid that beads, necks and merges in 3D: three.js's marching cubes, built from the THREE you pass (any version), with a world-space `liquid(THREE, {material, center, size, resolution}).set([{p, r}, …])`. Real geometry, so it gets the scene's light, shadows, depth of field and motion blur. Used for the serum drops in `films/skin-school-pilot` |
| `README.md` | This file |

The studio process that uses the kit is the `cinema-kit` skill (`.claude/skills/cinema-kit/SKILL.md`).
The kit carries no palette, type or grain. Those belong to each client and live in the scene and
page (house rule: every client gets a distinct identity).

## A. The finish: cinema3d.js

Each frame becomes a short exposure instead of one sharp instant:

1. **Probe.** The scene is sought at both ends of a 180° shutter. The largest on-screen travel
   (`px`) of any visible mesh, or of five camera points at mid-depth, sets the number of
   sub-frames: `K = clamp(ceil(px / pxPerSample), kMin, kMax)`.
2. **Accumulate.** The scene is sought at K moments across the shutter. Each moment is drawn into
   a half-float target with a Halton sub-pixel jitter, and the results are averaged. That gives
   real motion blur, plus anti-aliasing. When K ≤ 2 there is no jitter and 4× MSAA is used instead.
3. **Depth.** One more seek, at the frame's own moment. This leaves any DOM labels where they
   belong at `t`, and draws depth.
4. **Post.** A scatter-as-gather bokeh DOF (tile-max CoC at 1/16 size, dilated 3×3), focused by
   `window.CINEMA_FOCUS`. Then a soft-knee bloom, ACES and sRGB, written premultiplied so the
   page behind the canvas still shows through.

### Adopt it in three steps

1. **Load it right after the scene's three.js import.** It is a script fragment, not a module:
   it needs `THREE` in scope, and it defines `window.CINEMA`, `window.cinemaRenderer` and
   `window.cinemaFrame`. If the scene module is assembled as a string, splice the file in, the
   way `films/skin-school-pilot/motion/render.mjs` does:
   ```js
   const kit = fs.readFileSync(path.join(repo, "kits/cinema/cinema3d.js"), "utf8");
   const imp = 'import * as THREE from "../vendor/three.module.min.js";';
   src = src.replace(imp, () => imp + "\n" + kit);   // a function, so "$" in the kit is not a pattern
   ```
   For a hand-written module, paste the file in below the import. Put it before any other code
   that wraps rendering.
2. **Build the renderer with `cinemaRenderer(opts)`**, not `new THREE.WebGLRenderer(opts)`. It takes
   the same options. The pilot rewrites `new THREE.WebGLRenderer(` → `cinemaRenderer(` in the scene
   source. Use `alpha: true` if the page should show through, and `preserveDrawingBuffer: true` so
   that screenshots see the frame.
3. **Call `cinemaFrame(t)` once per frame instead of `seek(t)`**, then capture:
   ```js
   const info = await page.evaluate(([t, fps]) => {
     if (window.cinemaFrame) { window.CINEMA.fps = fps; return window.cinemaFrame(t); }
     window.seek(t); return null;
   }, [t, 30]);                       // info = { px, K, focusDist, fstop }; log K per frame
   ```
   A plain `seek(t)` still draws the scene unfinished (`CINEMA.mode` is `"direct"` outside
   `cinemaFrame`). Use that for interactive scrubbing and DOM audits.

What the scene must provide:

- `window.seek(t)`: a pure function of `t` that draws the frame with one
  `renderer.render(scene, camera)` call, on a `THREE.Scene` with a `PerspectiveCamera`. Other render
  calls pass straight through.
- `window.SCENE = { dur }`. This clamps the sub-frame times to `[0, dur)`. Without it, only
  negative times are clamped.
- One cinema renderer per page. Its targets are built on first use, at that canvas's
  drawing-buffer size.
- The scene's own tone mapping and sRGB output are replaced: it now renders linear HDR into float
  targets. `renderer.toneMappingExposure` still sets the exposure.

### Tunables: `window.CINEMA`

| Key | Default | Meaning |
|---|---|---|
| `fps` | 30 | The delivery frame rate. It sets the shutter length, so set it even for quick previews |
| `shutter` | 0.5 | Fraction of a frame the shutter is open (0.5 = 180°) |
| `kMin` / `kMax` | 2 / 32 | Bounds on sub-frames. Raise `kMin` from the frame loop for effects the probe cannot see (see B) |
| `pxPerSample` | 3.5 | Target screen travel per sub-frame |
| `fstop` | 0.45 | Used when `CINEMA_FOCUS` gives none. CoC scale is `fstop × frame height × 0.034` |
| `maxCoc` | 0.032 | Largest blur radius, as a fraction of frame height |
| `bloom` / `threshold` | 0.6 / 0.85 | Bloom strength, and the brightness where bloom starts (soft knee) |
| `mode`, `probe`, `K`, `s`, `last` | — | Internal state. Leave them alone |

### The `CINEMA_FOCUS` contract

`window.CINEMA_FOCUS(t)` returns `{ point, fstop?, bloom? }`:

- `point` is a `THREE.Vector3` or an `[x, y, z]` array in world space.
- `fstop` and `bloom` override the defaults for that frame.
- Focus distance is the camera's distance to `point`, never less than 0.5.

It is called during the depth seek, from inside `renderer.render`, so whatever `seek` moved
before that point is current. A falling drop can be followed this way.

**Its argument is `window.M.t`**, which the Skin School runtime sets in `M.stage(t)`, or 0 when
there is no `window.M`. Any other scene sets it at the top of `seek`: `(window.M ||= {}).t = t;`.

Without `CINEMA_FOCUS`, or without a `point`, the focus falls on `STUDIO.center` when the module
defines a `STUDIO` (the Skin School set), and on the origin otherwise.

`keys.js` builds this function from focus keys: `window.CINEMA_FOCUS = focusTrack(FOC, { portrait, targets })`.

### keys.js

Every export is documented in the file's header. In short:

- `EASE` and `ease(name)`: the pilot's names (`sine`, `p2`, `p3`, `out`) plus the GSAP-style names
  in made-with-claude's timeline (`power2.inOut`, …).
- `camAt(keys, t, opts)` and `placeCamera(camera, keys, t, opts)`: keys are
  `{ t, pos, look, fov, ease }`. Portrait overrides are a distance scale (default 1.32×, or `ps`
  per key), a fov add (default +12°, or `pfov` per key) and `pl`, a portrait-only look target.
  Made-with-claude's subject-relative keys are `rel` (offset from `opts.track(t)`) and `aim`
  (tilt toward `opts.subject(t)`).
- `handheld(t, amp)`: a deterministic hand on the camera.
- `focusAt` and `focusTrack`: focus keys `{ t, at, f }` that rack over `opts.rack` (0.45 s).
  `at` is a point or the name of a live target.

`films/skin-school-pilot/motion/scenes3d.mjs` inlines the same logic. With the default options,
`keys.js` reproduces its camera and focus exactly, frame by frame, in both aspects.

### Cost (from the pilot)

In SwiftShader at 1280×720, a directed frame takes about 3–8 s, against about 0.5 s for a plain
frame. Most of that is the K sub-frames on fast moves, plus the DOF. A 26 s clip renders in
roughly an hour per aspect on a 4-core container. Render stills first, then the full clip.

## B. The craft (from films/made-with-claude)

Read `films/made-with-claude/README.md`, `style-guide.md` and `shotlist.md` before starting a film.
Paths in this section are relative to `films/made-with-claude/` unless they say "the pilot's"
(`films/skin-school-pilot/`).

**Shot list first.** Write the style guide (what the references show and what carries over,
palette roles, type, lens, shutter, glow budget, physics, the beat grid) and the shot list
before any scene code. For each shot, give the time in seconds and frames, the entry state, the
action, the exit state, the purpose and the sound. Then add:

- a reading budget (words against clean seconds on screen; the final hold is at least 1.5 s);
- continuity rules;
- a composed frame 0;
- a last frame that works as the poster and the loop point.

**One timeline drives picture and sound.** `src/timeline.json` holds the shots, the camera keys,
the subject's moves, the UI beats and the music grid. `main.js`, `mascot.js`, `fx.js`, `ui.js`
and `audio.py` all read it, so moving a beat moves both picture and sound. Story beats sit on the
grid (120 BPM: a beat is 0.5 s, or 15 frames; landings and keystrokes fall on 8ths or 16ths).

**Camera keys** come in three kinds: absolute, subject-relative (`"rel": true` is an offset from a
smoothed ground track of the subject, so a tracking shot cannot lose it) and `"aim"` (0–1 tilts
the look target toward the subject's body, which keeps big jumps in frame). Each aspect gets its
own keys. For 9:16 that means higher vantage points and a wider lens. Sweep candidate keys with
`scripts/camsolve.cjs` instead of rendering them.

**Focus pulls on what the caption names.** Each camera key or focus key names its target: the
subject, a UI element, a label anchor. Rack it as the copy lands. Open the aperture on close-ups
and close it on wides.

**Motion grammar** (`src/mascot.js`):

- **Anticipation**: a crouch in the 0.1 s before take-off. It dips to 0.8 and is back at 1 on the
  take-off frame. It is skipped when the take-off is also a landing.
- **Stretch with speed**: the stretch relaxes to 1 at lift-off and at contact, so a shutter never
  straddles a snap in shape. Width is `1/√sy`, which keeps the volume.
- **Landing squash**: a 40 ms attack after contact, then a damped spring (amplitude 0.22, or 0.34
  for big landings), so the shape never flips from stretch to squash in a single frame.
- **Overshoot on pop-ins**: a scale pulse, `1 + 0.16·sin(πq)·(1−q)`, over 0.16 s.
- **Keystroke bounces**: an 8% squash and an arm flick in 0.12 s on every key.
- **Yaw continuity**: each move starts from the yaw the previous move actually ended on.

The pilot adds a real fall (accelerating), an exponentially damped bounce, a stretch on the fall
(capped at 1.55), and a sprung squash with an additive splash ring that blooms.

**Shutter and K budget.**

- Use a 180° shutter (`0.5 / fps`).
- Keep the travel per sub-frame at or under about 4.5 px. Made-with-claude takes
  `max(ceil(px/3) capped at 16, ceil(px/4.5))`, with up to 64 sub-frames. Its `px` is the maximum
  over the frame and its two neighbours, so the blur never dips for a single frame. The finish
  uses 3.5 px.
- Set floors for effects the probe cannot see. Probes measure object origins, so spin,
  deformation and particles inside one mesh do not register. Made-with-claude puts at least 40
  sub-frames on the shatter and at least 24 on the light streak.
- QA flags strobing when a frame moves more than 6 px per sub-frame.

**Determinism.**

- `seek` is a pure function of `t`: no state carried between frames, and no
  `requestAnimationFrame`, `Date`, `performance.now` or `Math.random`. The pilot's engine also
  stubs these as a backstop.
- All noise is seeded: hash functions in the scene, grain seeded by frame number, and
  `rng(crc32(tag))` in the audio.
- Every render target is cleared explicitly (color, depth and stencil, masks re-enabled first) at
  the start of each frame or sub-frame. Nothing is left over from the previous frame.
- Check the result: frames must be byte-identical whatever the render order. The pilot's
  `render.mjs --verify` re-renders sampled frames and compares their hashes with the log, and `scripts/signatures.cjs` diffs scene hashes so that only the
  frames an edit touched are re-rendered.

**QA gates, measured before anyone watches** (`scripts/qa.py`, `probe.cjs`, `framing.cjs`, and the
audit in the pilot's `render.mjs`):

- **Framing.** The subject stays inside the safe frame on every frame, except deliberate whips.
  For 16:9 the safe frame has 4% margins. For 9:16 it is x 6–94% and y 8–80%, which keeps type out
  of the bottom 20% where the platform UI sits.
- **Copy legibility, including motion.** A word counts as legible only if it is in frame, at
  least 14 px tall, has a CoC under ¼ of its height, and travels less than ¼ of its height in half
  a frame (the 180° shutter smears half a frame of travel). No text may run past the frame or sit
  on other text at a shot's settled moments. No dead air longer than 2.5 s.
- **Contrast, glyph core against background.** Take the median luminance of the glyph cores and
  compare it with the background outside a 20 px dilation of the glyphs: it must be at least 4.5:1.
  Glyphs against the gaps between letters must be at least 2:1, so a glow cannot flood the letters.
- **Sync.** A matched filter finds each foley cue in the stem. It must sit within −45/+60 ms of the
  first frame that shows its event. Beats must be on the 16th-note grid within 5 ms. Check the mux
  offset, the loudness (within 1 LU of target) and the true peak.

**Sound recipe.** `src/audio.py` synthesizes the score and foley from the same event times as the
picture, with seeded noise, and writes the mix, a foley stem and a list of cues. Then a two-pass
ffmpeg `loudnorm` (linear) brings it to target:

- −14 LUFS and −1 dBTP for social (made-with-claude);
- −18 LUFS when it has to sit under a voice (the pilot's optional `audio/score.py` cut);
- silent when the captions carry every line (the pilot's main cut).

**Review loop.**

1. Score: `qa.py` rates hook, readability, continuity, motion and sync from 1 to 10, from
   explicit deductions.
2. Fix the worst three.
3. Re-render only the frames the fixes touched.
4. Write a scorecard, pass against pass. `review/qa-pass1.md` is the first pass;
   `review/HUMAN-REVIEW.md` lists what code cannot judge.

The "Passes" section of made-with-claude's `README.md` shows the loop as it was run.

## Where it is used

- `films/skin-school-pilot`: the finish dropped into someone else's seekable scene, then
  directed. `motion/render.mjs` reads `kits/cinema/cinema3d.js` directly, and `motion/scenes3d.mjs`
  inlines the `keys.js` logic. `motion/scenes3d-original.mjs` is the undirected scene, for A/B.
  See its `README.md`.
- `films/made-with-claude`: the film the kit was distilled from. It has its own fuller pipeline in
  `src/main.js` (three.js r170: AccumPass with adaptive K, DOFPass, bloom, ACES, grade), and it
  does not load `cinema3d.js`. Tier B is its process.

## Gotchas

- **three r160+ assigns `render()` on each renderer instance**, in the constructor. A patch on
  `WebGLRenderer.prototype.render` never runs. Patch the instance, which is what `cinemaRenderer`
  does.
- **three's ShaderMaterial already defines `RRTAndODTFit`.** When a pass draws to the screen with
  tone mapping on, three adds its tone-mapping chunk to the shader, so a custom ACES function with
  that name fails to compile. Rename yours; the kit uses `cinRRT` and `cinAces`.
- **`clear()` does not reset the depth mask.** After a `depthWrite: false` draw, a clear leaves
  stale depth behind, and frames start to depend on earlier frames. Call
  `state.buffers.depth.setMask(true)` (and the color mask) before every clear.
- **Probe by object id.** Motion is measured only for objects present at both ends of the shutter.
  Something that appears or vanishes mid-shutter must not count as motion, or a pop-in reads as a
  huge move and K hits its maximum.
- **Looping objects must vanish at the wrap.** A jump from the end of a loop back to its start is a
  teleport: the blur smears it across the frame. Scale the object to zero before the wrap and grow
  it back after, as the pilot's oil drops do.
- **Quick previews must keep the final fps shutter.** A 6 fps preview with a 6 fps shutter blurs 5×
  too much and hides real problems. The pilot sets `CINEMA.fps` from `--fps` (default 30) even with
  `--quick`. In made-with-claude, `--q preview` also caps K at 6, so review stills there at
  `--q final`, with their own `--out` folder (otherwise `--times` frames land in
  `build/frames/<fmt>/`, the set the encode reads).
- **Runs of the pilot's `render.mjs` share state on disk.** Each run deletes `motion/.tmp/` on exit
  (unless `KEEP_TMP=1`) and rewrites `build/render-log.json` from the copy it read at start, so a
  second run started next to a long render needs `KEEP_TMP=1` and should finish first.

## Determinism, measured

The film renders byte-identical frames in any order. The pilot is identical in all but a handful of
frames: 4 of 780 differ between runs by 1 colour level in about 2 pixels near the DOM caption, which
comes from Chromium compositing the page, not from the finish. So Skin School's `--verify` can report
51 of 52 sampled frames matching. Treat a mismatch of that size as compositor noise; anything larger is
a real non-determinism to fix.
