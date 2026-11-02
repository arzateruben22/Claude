# Outer Layer No. 005: "Same cells, every colour"

72.8 s, 9:16. **Status: review passed (draft 5; the compelling-pass scores are in `review/scorecard.md`); final delivered: `out/outerlayer-005-9x16.mp4` (1080×1920, 72.8 s, −14.1 LUFS / −1.9 dBTP, qa.py PASS), `out/outerlayer-005-9x16-youtube.mp4` (1440×2560), poster and contact sheet.** Narration: synthetic voice
(Kokoro bf_isabella, one speed per line). Score: original (studio preset `outerlayer-slide`). Nothing has been posted.

- Draft preview: `review/outerlayer-005-9x16-draft-preview.mp4` (540×960, 15 fps)

## The story

Which skin has more pigment cells? Most would guess the darkest. Count them in the bottom row: about the same. What
differs is the work each one does: deeper skin's make more of the dark melanin, in larger grains, handed out one by one
(Thong et al. 2003). Why? Nina Jablonski and George Chaplin set skin colour beside sunlight around the world, and the
two matched (2000). Their idea: under fierce sun, more melanin protected folate; under weak sun, less let enough light
through to make vitamin D (badged "hypothesis"). To scale: pigment cells sit about 32 µm apart, a third of a paper's
thickness. Callback: "So, which has more? None of them. Same cells, every colour, each answering its own sky."

Tone is this episode's subject, so it is the bible's one exception to one tone per episode: the light, medium and deep
sections are always on screen together (never one tone alone with a line).

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` (13, search excerpts), `pron.json` | The words, the claims ledger, the pronunciations (folate, Jablonski) |
| `voice.py`, `vo/` | Voice with one Kokoro speed per line; 8 WAVs, `lines.json`, `words.json` |
| `compile.py` | The direction → `film.json`, `sheet.json` (6 shots, 3 irises, the count, the bracket, captions, end card) |
| `scene.mjs` | The picture, a pure function of t |
| `../set/grains05.js`, `globe05.js` | This episode's blocks: one cell's grains per tone (Thong et al.'s pattern), the globe of UV and skin colour (a model, no map) |
| `../set/melanocyte04.js`, `section.js`, `rays.js`, `motif.js`, `rig.js`, `look.js` | Shared and No. 004's set |

## Review round 1 and what changed

- **Tone tied to health (serious):** "darker skin guards folate, which healthy pregnancies need" (present tense, one tone on
  screen) → "Their idea: under fierce sun, more melanin protected a vitamin called folate. Under weak sun, less of it let
  enough light through to make vitamin D." All three sections stay in frame under their own skies; no single-tone close-ups.
- **The wrong idea restarted the thread at 26 s** → the guess ("Most would guess the darkest.") opens the normal line; the
  why opens on "So why would the work differ?".
- **Eight dips** → one continuous shot for the hook, the rows and the count; irises on the three scale jumps; the to-scale
  and close shots are camera moves.
- **The count wasn't shown** → the pigment cells glow and light in step; a tally under each section names its tone.
- **The to-scale card covered the light section; the 32 µm wasn't tied to cells** → two pigment cells per section drawn 32 µm
  apart, a bracket spans them, and the camera keeps all three sections clear of the card.
- **End card** → "Same body site, every skin colour …, averaged across sites (JAAD meta-analysis, 2017). Narration: synthetic voice (AI)."
- Captions re-paged; grains spaced so "one by one" reads; folate and vitamin D markers neutral; c12's claim text corrected.
