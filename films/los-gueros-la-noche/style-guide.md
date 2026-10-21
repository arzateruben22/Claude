# Los Güeros — "La Noche" film · style guide

**Film:** 20-second brand spot for Taqueria Los Güeros (628 W La Palma Ave, Anaheim).
**Audience:** Anaheim locals, 18–40, scrolling on their phones in the evening, plus
anyone who lands on the website.
**The one thing to remember:** *The night tastes better at Los Güeros on La Palma.*

The film borrows its identity from the live site. It does not add a new look.
Every rule below traces back to a file in this repo.

## 1. Reference files inspected

| File | What it gave the film |
|------|----------------------|
| `media/hero-loop.mp4` | The only motion footage: 4.0 s, 864×1080, 24 fps, H.264, no audio. An al pastor trompo over open flame, a taquero pressing tortillas at frame right, a wall of fire at frame left, and hanging lamps at top right. **The loop is not seamless**: the jump from the last frame to the first is about 3× bigger than a normal frame-to-frame change. |
| `media/hero-poster.jpg` | Same scene as a still. Confirms the color temperature: the flame core is about `#ED7F0E`. |
| `icons/icon-512.png` | The LG monogram: an amber disc with black serif "LG" and a chile-red flame leaf, on espresso `#100C09` with a soft amber halo. |
| `fonts/*.woff2` | Cormorant Garamond 400/500/600 plus italics, and Jost 300/400/500, all self-hosted. |
| `css/styles.css` | Color tokens, type roles, and the intro "ember curtain" (gradient, ember particles, a panel that slides up). |
| `js/main.js` | Intro motion values: words rise 44 px with `power3.out` and a 0.13 s stagger, and the curtain lifts with `power4.inOut`. Ember particle model. |
| `index.html` | Approved copy (§5). |

Footage inventory, in normalized source coordinates (`cx`, `cy`, with 0,0 at top left):

| Region | Focus point | Notes |
|--------|-------------|-------|
| Flames under the trompo | 0.45, 0.88 | Brightest, most kinetic. Survives heavy zoom because fire reads as soft anyway. |
| Whole trompo | 0.45, 0.45 | Hero object. Use at zoom ≤ 1.15 or it gets soft. |
| Trompo texture (char, glaze) | 0.38, 0.34 | Good for "Al Pastor". Zoom ≤ 1.5. |
| Taquero's hands + tortillas | 0.84, 0.72 | Sits on the frame's right edge, so the camera clamps. Zoom ≤ 1.45. |
| Wall fire, left | 0.14, 0.60 | Secondary texture. |

## 2. Palette (from `css/styles.css :root`)

| Token | Hex | Film role |
|-------|-----|-----------|
| `--ink` espresso | `#100C09` | Base field, scrims, end-card ground |
| curtain gradient | `#0A0705 → #0D0907 → #140D08` | Ember curtain (wipes and the end card) |
| `--soot` | `#1A1410` | Panel edges |
| `--cream` | `#F3E9D7` | All display type and body copy |
| `--cream-60` | `rgba(243,233,215,.62)` | Secondary lines, at 30 px and above only |
| `--flame` amber | `#E8A356` | Eyebrows, Spanish lines, CTA, glows |
| `--chile` | `#B3402F` | Not used for type. Only as a glow tint on the curtain base, as the site does. |

No new colors. Text sits on espresso, or on footage under a scrim of at least 70% espresso,
so cream and amber stay above 4.5:1 (checked per frame in QA).

## 3. Typography

| Role | Face | 16:9 size | 9:16 size | Treatment |
|------|------|-----------|-----------|-----------|
| Display | Cormorant Garamond 600 | 128 px, leading 0.98 | 136 px | Word-by-word rise of 44 px · `power3.out` (site intro) · amber text-shadow glow at 35% |
| Display italic (Spanish) | Cormorant Garamond 500 italic | 56 px | 60 px | Amber, fades up |
| Eyebrow | Jost 500 | 22 px, caps, tracking 0.4 em | 26 px | Amber, `·` separators as on the site |
| Body | Jost 300 | 30 px | 34 px | Cream-60 or cream |
| Lockup wordmark | Cormorant Garamond 600 | 150 px | 168 px | Letters stagger up (site intro) |

Rules: English first, with Spanish as the italic echo. No type smaller than 22 px at 1080 px
frame height, or 26 px on 9:16. Nothing is all-caps except eyebrows.

## 4. Motion language

- **Camera**: one virtual camera over the plate, defined by focus point and zoom. It drifts
  slowly inside shots (`sine.inOut`) and makes deliberate moves between them (`power3.inOut`).
  It never reveals the plate edge, because positions are clamped.
- **Type** rises, never slides sideways. It enters at 0.7–1.0 s and exits faster (0.35 s, `power2.in`).
- **Transitions** come from the site's vocabulary:
  1. **Pull** is a continuous camera pull-back (detail → wide). It reveals the hero object.
  2. **Ember curtain** is the site intro's panel, wiping upward with `power4.inOut`.
  3. **Whip** is a fast camera move with horizontal motion blur, landing on a new detail.
  4. **Flame bloom** is an amber radial flash in screen blend, ≤ 0.4 s, peaking at 0.8 opacity.
- **Atmosphere**: ember particles always drift up (same model as the site intro, seeded so they
  are deterministic). Film grain sits at about 6%. A warm vignette darkens the corners.
- **Reduced motion**: does not apply to a rendered film. The film never flashes more than once
  per 3 s and never goes full-white (only amber bloom), which keeps it under photosensitivity thresholds.

## 5. Approved copy (verbatim from `index.html`)

| Use | Line |
|-----|------|
| Hook | "The night / tastes better." |
| Spanish echo | "La noche sabe mejor." |
| Identity eyebrow | "Taqueria Los Güeros · Anaheim, California" |
| Craft | "Handmade tortillas," (from the hero paragraph) |
| Dish | "Al Pastor" + "marinated pork, pineapple" |
| Menu | "From the fire / to your table." · eyebrow "The Menu · La Carta" · "Tacos · Burritos · Mulitas · Horchata" (menu group and item names) |
| Lockup | "Los Güeros" · "Taqueria · Anaheim" · "628 W La Palma Ave · Anaheim, CA" · "Order now — Ordena ahora" |

Deliberately **not** used: prices (marked as samples on the site), hours (sample), the Yelp
rating (has a TODO to keep it in sync), the phone number (placeholder TODO), and the catering
offer (TODO: confirm with the owner).

## 6. Sound

The repo has no audio assets, so all sound is synthesized in code from the same timeline as the
picture (`film/src/audio.py`):

- **Fire bed**: brown-noise rumble plus seeded crackle impulses, present from frame 0.
- **Marimba hits**: modal synthesis with partials 1×, 3.9×, and 9.2×, a soft mallet, and the
  D-major pentatonic scale. One hit per type reveal, landing 2 frames after the rise starts,
  when the word becomes legible.
- **Whoosh**: band-swept noise for the pull, whip, and curtain.
- **Low thump**: a falling 90 → 45 Hz sine on the monogram bloom.
- **Pad**: a quiet D/A drone that opens to a D-major third on the lockup.
- **Master**: −16 LUFS integrated, ≤ −1.5 dBTP, 48 kHz stereo.

## 7. Formats

| Composition | Size | Layout |
|-------------|------|--------|
| `16x9` | 1920×1080 | **Split carta**: footage plate on the right 1160 px with a feathered left edge, type column on the left (x 120–860), and a centered lockup on the end card. |
| `9x16` | 1080×1920 | **Full bleed**: footage covers the frame, type sits on espresso scrims. The safe zone keeps type within y 250–1500 and x 110–970, clear of the Reels/TikTok UI. |
