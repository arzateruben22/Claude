# La Noche — Taqueria Los Güeros brand film

A 20-second code-rendered film in two separate compositions, 16:9 (1920×1080) and
9:16 (1080×1920), at 24 fps. Every frame is deterministic and seekable. Picture
and sound are built from a single timeline file.

## Render

```bash
node films/los-gueros-la-noche/scripts/render.cjs                  # full render, both formats → film/out/
node films/los-gueros-la-noche/scripts/render.cjs --contact        # contact sheets only (one frame / 0.5 s)
node films/los-gueros-la-noche/scripts/render.cjs --range 11-15    # re-render a section (seconds), then re-encode
node films/los-gueros-la-noche/scripts/render.cjs --format 9x16    # one composition
node films/los-gueros-la-noche/scripts/render.cjs --qa && python3 -I films/los-gueros-la-noche/scripts/qa.py   # measured review
```

Requirements are Node 18+ with Playwright and its Chromium, ffmpeg, and Python 3 with
numpy and Pillow. No build step and no network: fonts, GSAP and footage come from this repo.

To preview and scrub in a browser, run `npx http-server .` at the repo root and open
`/films/los-gueros-la-noche/src/index.html?format=9x16`. Run the render once first so `film/build/plate/` exists.
Add `&t=12.4` to jump to a time.

## Why this renderer

The film is an **HTML/CSS + GSAP composition captured frame by frame in headless Chromium
(Playwright)**, with ffmpeg doing the encode and numpy doing the sound.

- **The brand already lives in HTML.** The site's typography (self-hosted Cormorant
  Garamond and Jost), its color tokens, and its intro motion (GSAP ease curves, ember
  curtain, ember particles) carry over as-is. Nothing is approximated in a second tool.
- **Seekable and deterministic by construction.** One paused GSAP timeline is seeked to
  `frame / 24`. The camera is a pure function of the keyframes. Footage is pre-extracted
  frames, not `<video>` seeking, which is non-deterministic in headless browsers. Embers
  and grain use seeded PRNGs. Any frame renders the same in isolation, so sections
  re-render independently.
- **One timeline.** `src/timeline.json` holds the shots, camera keys, transitions, type
  events and their sound cues. `film.js` builds the picture from it, and `audio.py` builds
  the sound from the same file. Moving a beat in the JSON moves both.
- **Static-first, like the studio.** There is no React or bundler as Remotion would need,
  and no After Effects project that only one machine can open. The source is
  hand-editable HTML, CSS and JSON.

## Files

| Path | What it is |
|------|-----------|
| `style-guide.md` | Identity rules, sourced from the repo's own assets |
| `shotlist.md` | Timestamps, entry and exit states, and purpose for every shot |
| `src/timeline.json` | **The timeline**: shots, camera, transitions, type and sound events |
| `src/index.html` · `film.css` · `film.js` | The composition (`?format=16x9` or `9x16`) |
| `src/audio.py` | Sound design synthesized from the timeline (seeded, deterministic) |
| `scripts/plate.py` | Builds the seamless 84-frame footage loop from `media/hero-loop.mp4` |
| `scripts/render.cjs` | Capture → audio → loudness normalize → H.264 encode → posters → contact sheets |
| `scripts/contact_sheet.py` | Labelled contact sheets |
| `scripts/qa.py` | Measured review: hook, readability, continuity, motion, sound sync |
| `review/` | Scorecards and the human-review note |
| `out/` | Delivered videos, posters and contact sheets |
| `build/` | Intermediates (frames, plate, audio). Git-ignored and fully regenerable |
