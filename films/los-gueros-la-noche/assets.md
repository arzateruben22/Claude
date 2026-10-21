# La Noche — assets list

Every input the film uses, where it comes from, and what still needs confirming.
No asset from outside this repo was used, and no stock footage, music or sound effects were downloaded.

## Supplied assets (from this repo)

| Asset | Path | Used for | Provenance / license | Needs confirming |
|-------|------|----------|----------------------|------------------|
| Hero footage | `media/hero-loop.mp4` (864×1080, 24 fps, 4.0 s, no audio) | Every footage shot (S1–S5), via a seamless 84-frame loop and virtual camera crops | Shipped with the client site; origin not recorded in the repo | **Rights and origin.** The clip looks synthetic or AI-generated. Confirm the client may use it in paid social, and whether the platform requires an AI-content label. |
| LG monogram | `icons/icon-512.png` | End-card lockup (S6) | Studio-made app icon for the client | None |
| Cormorant Garamond 500/600, 500 italic | `fonts/cormorant-garamond-latin-*.woff2` | Display, Spanish lines, wordmark | SIL Open Font License 1.1 (Fontsource) | None |
| Jost 300/400/500 | `fonts/jost-latin-*.woff2` | Eyebrows, body, address, CTA | SIL Open Font License 1.1 (Fontsource) | None |
| GSAP 3.12.5 | `js/vendor/gsap.min.js` | Timeline and easing (render-time only, not shipped in the video) | GreenSock standard license, which covers commercial use | None |
| Copy | `index.html` | All on-screen words, verbatim (see style guide §5) | Client-approved site copy | Address "628 W La Palma Ave" (shown on the end card) |
| Palette and motion values | `css/styles.css`, `js/main.js` | Colors, curtain gradient, ember model, ease curves | Studio design system for the client | None |

## Generated in code (no external source)

| Asset | Made by | Notes |
|-------|---------|-------|
| Seamless footage loop | `scripts/plate.py` | Source frames 12–95, with the last 12 cross-faded into frames 0–11, upscaled 2× with Lanczos |
| Ember particles, film grain | `src/film.js` | Seeded PRNG |
| Ember curtain, flame bloom, vignette, scrims | `src/film.css` | CSS gradients in the site palette |
| Entire soundtrack | `src/audio.py` | Fire bed (noise synthesis), marimba (modal synthesis), whooshes, thump, pad. Seeded and loudness-normalized to −16 LUFS |

## Delivered files (`film/out/`)

| File | What |
|------|------|
| `los-gueros-la-noche-16x9.mp4` | 1920×1080 · 24 fps · H.264 High CRF 16 · AAC 192k · 20.0 s |
| `los-gueros-la-noche-9x16.mp4` | 1080×1920 · 24 fps · H.264 High CRF 16 · AAC 192k · 20.0 s |
| `poster-<fmt>-hook.jpg` | Frame at 1.9 s ("The night tastes better." over fire), the social thumbnail |
| `poster-<fmt>-lockup.jpg` | Last frame (full lockup), for the end slate or a website poster |
| `contact-<fmt>-prerender.jpg` | Gate 2 sheet, rendered before the full render |
| `contact-<fmt>-final.jpg` | Sheet from the final frame sequence |
