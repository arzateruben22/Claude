# Skin School cinema pilot: lesson 8-2, "Inside a pore"

A pilot for giving Lumevina's Skin School solid scenes the look of the code-rendered films
in this repo (`films/made-with-claude`): directed camera moves, focus pulls, real motion blur,
bloom and a filmic finish. It is built on Evelyn's own scene: the same voxel set, colors, shot
list, captions and labels, and the same frame engine. It sits on this branch so that nothing in
the Lumevina branch changes until her session adopts it.

```
films/skin-school-pilot/
  motion/cinema3d.js            the kit: one file, three.js r160 core only
  motion/scenes3d.mjs           8-2 directed in the film style (changes marked "directed:")
  motion/scenes3d-original.mjs  her 8-2 as it is on the Lumevina branch, for A/B
  motion/render.mjs             her frame engine with the finish added (changes marked "cinema:")
  motion/motion.js, studio3d.js, vendor/   hers, unchanged
  audio/score.py                the optional sound (the main cut stays silent, like hers)
  fonts/inter-var.woff2         hers (OFL)
  out/                          the pilot clips and posters
  build/                        review sheets, render log, her current clips for comparison (not committed)
```

## Run it

```
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
node films/skin-school-pilot/motion/render.mjs                         # directed 8-2, 16:9, with the finish
node films/skin-school-pilot/motion/render.mjs --aspect 9x16           # the Reels cut
node films/skin-school-pilot/motion/render.mjs --scenes original       # her scene + the finish only
node films/skin-school-pilot/motion/render.mjs --scenes original --plain   # her renderer exactly
node films/skin-school-pilot/motion/render.mjs --quick --times 4,9.5,19.3 --label check   # stills → build/review/
```

## What the kit does (cinema3d.js)

Each frame becomes a short exposure instead of one sharp instant, and it stays a pure function of `t`:

1. **Probe**: the scene is sought at both ends of a 180° shutter, and the on-screen travel of every
   object and of the camera decides how many sub-frames the exposure needs (K = 2 to 32).
2. **Accumulate**: the scene is sought at K moments across the shutter. Each moment is drawn with a
   sub-pixel jitter into a float target and the results are averaged. That gives real motion blur,
   and anti-aliasing for free.
3. **Depth**: one more seek, at the frame's own moment. This also leaves the labels and captions where
   they belong. The depth from it drives a bokeh depth of field focused where the scene says
   (`window.CINEMA_FOCUS(t)` returns a point and an f-stop).
4. **Finish**: bloom on whatever is brighter than white (her oil and bacteria now glow), then ACES and
   sRGB, kept premultiplied so the page's own background shows through as before.

The DOM layer (header, labels, captions, dust, grain) is untouched.

## What the directed version changes (scenes3d.mjs)

| Shot | Hers | Directed |
|---|---|---|
| healthy 0–6 s | wide orbit | macro on the pore mouth with the oil glowing up the hair, then a crane back into the cross-section; focus pulls hair → gland → oil as each label lands |
| clog 6–12 s | same orbit | a push into the slot; the plug cells fall with gravity, bounce and squash; tilt up to the blackhead as it oxidizes |
| inflame 12–18 s | same orbit | a pull back, then a slow push while the bacteria pop in, jiggle and glow; focus racks to the inflamed wall |
| clear 18–26 s | same orbit | a crane over the drops: each one stretches as it falls, lands with a sprung squash and a splash ring; then a pull back to the hero wide for the day counter |

The light is warmer, with falloff and a rose rim from behind. A soft scrim keeps her header legible
over full-bleed shots.

## Found on the way: studio3d.js never runs

three.js r160 assigns `render()` on each renderer instance, in the WebGLRenderer constructor.
A patch on `THREE.WebGLRenderer.prototype.render` is therefore shadowed and never called.
So `studio3d.js`'s floor, rim light, set dressing and camera drift ("Skin School motion: softer,
after the reference clips") do not appear in any rendered clip today. Only its `SoftBox` swap
works, because that one is a source rewrite.

The fix is the same one the kit uses: build the renderer through a factory that sets
`renderer.render` to the patched function. Turning the studio patch on changes every solid clip,
though, and its floor fade has never been seen rendered. It needs a look before it ships.

## Adopting it in Skin School (for the Lumevina session)

1. Copy `cinema3d.js` next to `studio3d.js`.
2. In `render.mjs`, insert it right after the three.js import (before `studio3d.js`), rewrite
   `new THREE.WebGLRenderer(` → `cinemaRenderer(`, and call `window.cinemaFrame(t)` instead of
   `window.seek(t)` when it exists. All three changes are marked `cinema:` in the pilot's
   `render.mjs`.
3. Per scene: add `window.CINEMA_FOCUS` (focus keys on the label anchors) and replace the orbit with
   camera keys. The finish works without them, but the look comes mostly from the direction.

## Cost

A directed frame takes about 3–8 s in SwiftShader at 1280×720, against about 0.5 s for a plain
frame. Most of it is the K sub-frames on fast moves and the depth of field. A 26 s clip renders in
roughly an hour per aspect on a 4-core container.

## Open questions

- **Sound.** Her clips are silent on purpose, and the captions carry every line. So the pilot's main
  cut is silent too, and `out/8-2-sound.mp4` is an alternative to compare. `audio/score.py`
  synthesizes it from the scene's own event times:
  - a soft pad in D major that changes chord on each shot;
  - glass ticks as each label lands;
  - a woody tap as each plug cell settles;
  - fizz under the bacteria;
  - a whistle, plop and splash for each drop;
  - counter ticks and a closing chime.

  It is mixed to −18 LUFS, so it stays under any voice. It's seeded, so the same file comes out
  every run.
- **Portrait.** The pilot frames the same moves from 1.32× further back, with a lens 12° wider. Each
  shot still needs a pass for the 9:16 safe zones.
- **The flat scenes** (DOM/SVG) need a different treatment: camera moves on the stage and sub-frame
  blending of screenshots. That is not part of this pilot.
