# Skyline wallpaper

Prism Studio's background is a dark, gothic Manhattan at 2 a.m., in the spirit of Gotham. It is
**original art rendered from code**. No photograph is used, traced or sampled. The owner's
reference images only guided the general composition (an aerial view looking north up the
island, with towers rising on both sides). None of their pixels, colours or details are in
these files.

| File | Size | Use |
|---|---|---|
| `skyline-landscape.jpg` | 3840×2160 | 720 px and wider on 2x screens: the home rig and sign-in, and every inner page under a heavy scrim |
| `skyline-landscape-1920.jpg` | 1920×1080 | The same picture for 1x screens (CSS `image-set`) |
| `skyline-portrait.jpg` | 1440×3120 | Under 720 px, for the same pages. The camera is recomposed for portrait, not cropped |

## What is in the picture

- A procedural street grid: about 15,000 instanced boxes, pyramids and cylinders make up
  setback towers, art-deco and gothic crowns, spires, roof plant and water tanks.
- Windows come from a shader. Most floors are dark, and lit windows come in small groups of
  sodium amber, warm lamp light or pale white. Some have their blinds half drawn.
- One spire tower stands alone in the upper-middle third. Its stepped crown is floodlit in a
  muted gold. Left of centre (landscape) a second landmark rises: a stepped crown of
  diminishing lit arches with a needle, in the Chrysler manner.
- Near facades carry stone piers between the window bays and a spandrel under each floor, and
  the top course of every block and each roof parapet catch a little warm street light, so the
  foreground has texture at 1x.
- About 38,000 point-sprite lamps: the avenues read as thin, dull amber lines far below, plus
  late traffic, the embankments and a bridge. The far shore's lights run all the way to the
  horizon.
- Height haze and a low deck of stratocumulus cloud, lit warm from below by the city and
  dark steel overhead.
- One plain, faint searchlight beam. There is no emblem, sign, billboard, logo or readable
  text anywhere in the picture.
- The middle of the frame is kept low and quiet, and slightly darkened, so the monitor rig
  and light UI text sit over it with only a light scrim. Mean luminance is about 24.5/255
  (landscape) and 22.3/255 (portrait); keep it under 26.

## Re-rendering

```bash
npm run wallpaper                                   # every file, about 3 minutes
node scripts/wallpaper/render.mjs --only portrait   # one composition
node scripts/wallpaper/render.mjs --preview --out /tmp/wp   # quick half-size, 1x check
```

The source is in `scripts/wallpaper/`. `scene.js` holds the three.js scene, with the city,
shaders, lamps, compositions and grade. `scene.html` is its page, and `render.mjs` is the
headless driver. The render needs the globally installed Playwright, whose Chromium renders
WebGL2 in software (SwiftShader, so no GPU is needed), and three.js r160 from
`../kits/cinema/vendor/three.module.min.js` (override with `THREE_PATH`).

The output is deterministic: a fixed city seed, hashed windows and noise, and no clock or
`Math.random`. Each frame is drawn in tiles at 2× resolution with 4× MSAA into a half-float
target, then box-downsampled, bloomed, ACES-tone-mapped, graded (desaturated, with steel
shadows), dithered and saved as a quality-88 JPEG. The render prints a check-list line for
each file: mean luminance, mean saturation, the share of neon-hued pixels (it should stay
0), and centre versus edge luminance.

To change the look, start with `LOOK` (haze colours, window, flood and lamp gains,
exposure, saturation, how quiet the centre is) and `COMPOSITIONS` (camera, landmark towers,
searchlight) at the top of `scene.js`.
