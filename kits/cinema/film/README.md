# kits/cinema/film: the brand-neutral film runtime and renderer

The runtime, page and renderer that the three science channels (`films/channels/`: body, space,
physics) render on. None of it depends on Lumevina's page or code: no `motion.js`, no `studio3d.js`,
no Inter, no rose and gold. A channel brings its look as a `theme.json`, and an episode brings its
timing as a `film.json` and its picture as a `scene.mjs`.

| File | What it is |
|---|---|
| `page.mjs` | `page(scene, W, H, theme)` → the HTML a frame is drawn on, plus `loadTheme(file)` and `importMap()` |
| `runtime.js` | The helpers scenes and the HUD share: `seg`, eases, `keyed`, `hash`/`rng`, `presence`/`enter`/`leave`/`show`, and the shot stage `stage(t)`. Written fresh; a plain ES module |
| `render.mjs` | The chunked, resumable renderer, generalized from `films/skin-school-tiktok/motion/render.mjs` (that file is unchanged) |
| `run.sh` | Detached start, resume, status and stop for one film folder |
| `demo/` | A 6 s demo episode that uses every part once (also the test film) |
| `../sci/hud.js` | The overlay: word-lit captions, labels with leaders, badges, counters, scale pill, title and end cards |
| `../sci/clock.js` | Time warp: playback-rate keys integrated in closed form into scene time τ(t), plus badge text |
| `../vendor/three.module.min.js` | three.js r160, the build the pilot uses (MIT, `THREE-LICENSE`) |

## Folders

```
films/channels/space/
  theme.json            the channel's look (tokens, roles, faces, safe box, extra CSS)
  fonts/                its self-hosted faces (OFL; .woff2, or .ttf where a project ships no WOFF2), named in theme.json
  ep01/
    film.json           the episode's clock: id, dur, fps, poster, shots, captions, cues ... (compile.py writes it)
    scene.mjs           the picture: a browser module, window.seek(t)
    build/              everything render.mjs writes (git-ignored by films/channels/.gitignore)
    out/                the delivery mp4 and its poster
```

The renderer finds the theme in this order: film.json's `"theme"` path (relative to the film
folder), then `../theme.json` (the channel's), then `./theme.json`. `"scene"` in film.json names
another scene module (default `scene.mjs`).

## Run it

```
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium   # run.sh sets both
R=kits/cinema/film

node $R/render.mjs --film <dir> --tier animatic                 # the whole film, 540x960, 6 fps, no finish
node $R/render.mjs --film <dir> --tier final --times 2,9,20     # stills with the full finish
node $R/render.mjs --film <dir> --tier final --assemble --audio <the studio's .m4a>
node $R/render.mjs --film <dir> --cues                          # build/cues-<id>-<aspect>.json, renders nothing
$R/run.sh <dir> --tier final                                    # detached; log in <dir>/build/final/9x16/render.log
$R/run.sh <dir> status | stop                                   # and a bare `run.sh <dir>` resumes with the same options
```

Options, tiers, chunks and assembly are the Skin School renderer's (its `README-render.md` has the
long version). In short: tiers `animatic` (540×960, 6 fps, no finish), `draft` (540×960, 15 fps,
finish with K ≤ 6) and `final` (1080×1920 at `--fps`, default film.json `fps` or 30); `--from/--to`
or `--times`; `--chunk` (default 10 s, a whole number of frames); `--resume`, `--fresh`,
`--force-mixed`, `--keep-png`, `--plain`, `--build`, `--page-frames`, `--frame-timeout`, `--where`.
The shutter always follows the delivery rate.

New here:

- `--film <dir>` (required). Build and out folders live inside it.
- **One Chromium job per box.** Besides the per-film lock (`<film>/build/.render.lock`), a render or
  `--cues` refuses (exit 2) while any other `render.mjs` runs on the box, including the Skin School
  renderer. `--share-cpu` runs anyway (both slow down 1.6–1.8×).
- **Missing theme fonts.** They are left out and the system-safe stack stands in. Drafts and animatics
  warn. The final tier refuses unless you pass `--fallback-fonts`, because a final set in the
  stand-in face is hours wasted.
- **The code hash** covers the scene, film.json, theme.json and its CSS file, cinema3d.js (except on
  the plain path), the three.js build, every theme font file, and every kit module the scene
  imports. The renderer finds those by following the static imports from the scene ("three",
  "cinema/...", relative paths). The page also logs each file:// URL it loads. Any file outside the
  hash is reported, because a change to it would go unnoticed on resume. The page sha256 covers
  everything inline: page.mjs's template, the splice, film.json and the theme.
- **The audit** also reports text outside the safe box (`window.HUD_SAFE`). It skips overlaps inside
  one HUD part, such as the words of one caption.
- `--cues` uses the HUD's own table when the scene defines none (labels, counters, pills, badges,
  title and end card), with `pos` and `shown` as before. It reads positions at `t + 0.7` and never
  seeks before 0 or past the end.

## The scene contract

```js
import * as THREE from "three";                      // first: cinema3d.js is spliced in right after this line
import { stage } from "cinema/film/runtime.js";      // kit modules by absolute URL through the import map
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
const FILM = window.FILM, W = window.W, H = window.H;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), alpha: true, preserveDrawingBuffer: true });
// ... build the set once ...
window.seek = (t) => { stage(t); /* camera, objects, from t alone */ hud.update(t); renderer.render(scene, camera); };
```

- `seek(t)` is a pure function of t. It makes exactly one `renderer.render(scene, camera)` call, and
  it calls `stage(t)` first: that sets `window.M.t`, which cinema3d.js passes to `CINEMA_FOCUS`.
- The renderer rewrites `new THREE.WebGLRenderer(` to `cinemaRenderer(` and splices
  `kits/cinema/cinema3d.js` in after the import line, as the pilot does. A scene without that exact
  line is refused, so it can never render silently without the finish.
- The page gives the scene:
  - `window.W`, `H`, `FILM` (film.json), `THEME` (`{ id, tokens, safe, captionY, aspect }`, with the
    safe box as fractions for this aspect), `SCENE` (`{ id, dur, poster, shots }`) and `M`;
  - the canvas `#gl` and the overlay root `#hud` in a full-bleed `.stage`;
  - `<base href>` at the scene module's folder, so its relative imports work.
- A scene that loads anything asynchronously sets `window.SCENE_READY` to a promise; the renderer
  waits for it. Fonts are loaded before the first frame (`window.FONTS_READY`).
- Never use `Math.random`, `Date`, timers or `requestAnimationFrame` (the renderer seeds them
  anyway). Use `hash(i)` or `rng(seed)` from runtime.js.

## theme.json

```json
{
 "id": "lightminute",
 "tokens": { "bg": "#080A1C", "surface": "#151A3D", "text": "#EEF0FF", "text-2": "#A9B0D9", "teal": "#4FE3C6" },
 "roles": { "accent": "teal", "plate": "rgba(21, 26, 61, .85)", "cap-lit": "teal" },
 "fonts": [
  { "family": "Unbounded", "file": "fonts/Unbounded-var.woff2", "weight": "200 900" },
  { "family": "Lexend", "file": "fonts/Lexend-var.woff2", "weight": "100 900" },
  { "family": "Martian Mono", "file": "fonts/MartianMono-var.woff2", "weight": "100 800" }
 ],
 "type": { "display": "Unbounded", "text": "Lexend", "mono": "Martian Mono" },
 "safe": { "9x16": { "x": [90, 900], "y": [250, 1420], "frame": [1080, 1920] } },
 "captionY": { "9x16": 0.61 },
 "css": "hud.css"
}
```

- **tokens** become `--<name>` on `:root`. Keep them plain colours, so that one contrast checker
  can read every channel's file.
- **roles** become `--hud-<role>`. A value that names a token becomes `var(--token)`; any other
  value is used as written. The roles hud.js reads, with their defaults:
  - text: `text`, `text-2`, `accent`;
  - captions: `plate`, `cap-next` (words still to come), `cap-said`, `cap-lit` (the spoken word) and
    `cap-lit-bg` (a highlighter band, as in physics);
  - labels: `label-bg`, `label-text`, `ring` (the ring around a leader's dot);
  - badges: `badge-bg`, `badge-text`, `badge-border`;
  - the rest: `scrim`, `scale-line`, `shadow`, `text-shadow`.
  - Sizes can be set too: `cap-size`, `label-size`, `badge-size`, `counter-size`, `title-size`,
    `end-size`, plus radii and weights. See the `CSS` block in hud.js.
- **fonts**: paths are relative to theme.json. Each face becomes an `@font-face` with an absolute
  file:// URL and is loaded before the first frame.
- **type**: names the face for each role: `--font-display`, `--font-text`, `--font-mono` (counters,
  badges, scale pill) and `--font-glyph`. Every stack ends in DejaVu, then the generic family.
  **Never rely on the generic family on this box:** fontconfig maps `sans-serif` and `system-ui`
  to Inter here, which is Lumevina's face.
- **safe** (in px of a reference frame) and **captionY** (the caption plate's top, as a fraction of
  H) are per aspect. The defaults are TikTok's organic safe box for 9x16 (above) and 5% margins
  for 16x9.
- **css** (a file) or **cssText** holds a channel's extra rules: its title-card motif, its own label
  shape, a stage gradient. They load after hud.js's CSS, so they win.

## hud.js and clock.js in one breath

Their file headers document every option. A sketch:

- `createHud({ camera })`.
- `hud.captions(FILM.captions)`: one page at a time, the spoken word lit, measured and shrunk to fit
  the box, centred in the safe box at `captionY`. Captions sit above the end card's scrim, because
  the tease is spoken over the card.
- `hud.label(id, { text, glyph, mark, color, at: (t) => [x, y, z], t0, t1 })`:
  - `mark` is `dot`, `ring`, `dashed`, `bar` or `none`, and `glyph` is extra text before the name,
    so colour is never the only cue;
  - the anchor is any pure function of t (`screen: (t) => [px, py]` for a 2D anchor);
  - candidate spots, in order: the preferred side, the other side, above, below, then the four
    corners, each clamped into the safe box and above the captions;
  - it takes the first spot that covers no anchor, no other label and no other HUD part, or else the
    least-overlapping one;
  - a leader line and a dot are drawn in the label's colour. `fixed: true` keeps a label on its
    preferred spot.
- `hud.badge(id, { from: clk })`: the clock's "slowed ×20" segments. `{ text, t0, t1, slot }` gives a
  fixed badge such as "not to scale".
- `hud.counter(id, { value | keys, fmt, unit, label, lit, at, minCh })`: tabular figures in the mono
  face.
- `hud.scale(id, { text, bar: (t) => px })`: a pill with a live bar.
- `hud.title({ series, title: "If the Sun *vanished*", t1, sig })` and
  `hud.end({ t0, title, next, follow })` are shells. A channel adds its motif (the ring, the pulse
  line, the drop) to the element each one returns.
- Everything except the captions gives way as the end card arrives.
- `hud.update(t)` redraws everything from t. `hud.cues()` lists the overlay's events.
- `clock(keys, { words })`:
  - keys are `{ t, rate, ramp, curve, badge }` (×1, 0.05, 0 = freeze, 1e6);
  - it gives `tau(t)`, `rate(t)`, `tOf(τ)` (the film time of a scene event, for the cue sheet),
    `badge(t)` and `badges`;
  - ramps are log-blended between positive rates and linear into or out of a freeze, in closed form
    both ways.

## Tested on this container (2026-10-22)

All numbers come from 4 CPUs with SwiftShader and Chromium 141.0.7390.37. **Every run shared the
CPU with the Skin School final render** (`--share-cpu`), so an idle box is faster.

| Test | Result |
|---|---|
| Animatic, the whole demo (36 frames, 540×960, 2 chunks of 3 s) | 0.13 s/frame (0.19 s with page loads and encodes), 7 s; assembled to `demo/out/kit-demo-9x16-animatic.mp4` with poster and contact sheet; audit clean |
| Final stills, 1080×1920, full finish, t = 1.0 and 2.6 s | 2.38 s (K 4) and 2.20 s (K 2) per frame; 3.0 s each with the page load |
| Draft, 2 s (30 frames, 540×960, 15 fps) | 0.44 s/frame, K avg 2.8, max 4 |
| Kill and resume | See below |
| `--cues` | 8 cues (signature ×2, label ×2, badge ×2, counter.show, scale), each with pos and shown; 3.6 s |
| Purity of the plain path | The 36 animatic frames sought in a shuffled order on one page: 36/36 identical to the sequential render. Each on a fresh page: 12/12 identical |
| Clock | `tau` against a numeric integral of `rate` (200,000 steps): relative error ≤ 1.3e-8 for ramps between ×1, ×1/20, freeze and ×10⁶; `tOf(tau(t))` back to t within 5e-10 s |
| Refusals | An edited scene or kit module with `--resume` (exit 2, "changed: scene, kits/cinema/sci/hud.js"); another `--chunk`; no `--resume` over frames on disk; a final with a missing theme font; any render while another `render.mjs` runs, without `--share-cpu` |
| Theme resolution | A scratch channel with `../theme.json`, two self-hosted faces (loaded from file:// URLs) and one missing face (dropped with a warning, DejaVu stands in) |

**Kill and resume** (draft, frames 0–29, one 2 s chunk):

1. Run A was started with run.sh and killed by PID with SIGKILL after 12 frames.
   - No Chromium was left behind: 11 chrome processes remained, all of them Skin School's.
   - run.sh did not restart it (exit 137).
2. Frame 10's PNG was cut to 20 KB, half a frames.jsonl line was appended, and a stray `.png.tmp`
   was added.
3. A bare `run.sh <dir>` resumed. It reported the cut-off line and the hash mismatch, kept 11 of 30
   frames, and rendered 19.
4. All 30 per-frame sha256s matched clean run B, every PNG matched its log line, and the chunk mp4
   was byte-identical.
5. `run.sh stop` (SIGTERM) mid-chunk exited with 143. It left nothing running and released the lock.

**Found in the finish (cinema3d.js, not edited here).** Both concern silhouettes against empty space
on a transparent canvas, which is the space channel's sky and the body channel's alpha canvas over a
CSS gradient:

- **Depth of field draws a dark rim.** At any fstop > 0, the finish draws a dark, aliased 1–2 px rim
  around each silhouette. Empty pixels read as the far plane, which gets the largest blur, and the
  depth target is not multisampled, so edge pixels take the blurred empty background. The demo uses
  `fstop: 0`.
- **A faint grey edge remains with no depth of field.** It is about 1 px, where premultiplied alpha
  meets a bright HDR object, and visible only when zoomed in.
- **Fix in the scene:** an opaque backdrop at a finite depth (a sky sphere, the cyc) avoids both.
- **Fix in the finish:** for the probe2 work, take the depth-of-field weight from alpha (no blur
  where alpha is 0) and resolve depth with MSAA.

## Not done yet

- A render with a channel theme: the three `films/channels/<channel>/theme.json` files and their
  fonts exist (checked by `kits/cinema/sci/contrast.py` and in Chromium by the themes package), but
  no episode has gone through this renderer with one yet.
- Sounds for the HUD's `badge` and `scale` kinds: their rows are in `kits/cinema/events.json`, but no
  preset maps them yet. The clock's own moments (`time.slow`, `time.normal`) are left to the
  compiler: `clk.keys` and `clk.tOf(τ)` give their times.
- `sci/path.js`, `swarm.js`, `front.js`, `strobe.js` and the other shared blocks (separate packages).
- A 16x9 pass: the code handles it (safe box, caption line), but it has not been rendered.
