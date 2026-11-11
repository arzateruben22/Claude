# Season 3 art from the owner (ChatGPT, 11 Nov 2026)

AI-generated paintings the owner made for "The Moon Starts Coming Closer. It Won't Stop." They set the look: a painted
night beach, teal and violet, the same headland on the left and the same small figure in every stage. Disclose them as
AI illustrations in the description, like Skin Sense's paintings. 1672x941, so upscale for the 2560x1440 film.

| File | Story beat | Use |
|---|---|---|
| `moon-01-tonight.webp` | Tonight: the opening and the last shot (the loop) | Opening, ending, part 1 cover |
| `moon-02-close.webp` | The Moon about 8 to 10 times wider (the 50,000 km beat) | **Long-film thumbnail** (tiny figure, huge Moon) |
| `moon-03-breakup.webp` | The Moon pulled apart | **Long film only, at the payoff.** Never a thumbnail or part cover: the ending stays in the long film |

Notes for the build:
- Keep the Moon's size honest between stages: tonight's Moon here is drawn bigger than a real one, so scale every later
  stage from it by the script's numbers (2x, 4x, nearly 8x wider).
- The near side of the Moon always faces us: where the face shows, use the real pattern of dark seas.
- The tides should climb as the Moon comes closer; these paintings show a normal sea.
- The script says the break-up is "not an explosion, a stretch": the debris spreads along the orbit into a band.

## Title (owner's choice, 11 Nov 2026)

**How Close Can the Moon Get Before It Breaks?** (a real physics question with a real answer, so viewers guess a
distance). Backup: "What If the Moon Never Stopped Getting Closer?". The old working title "The Moon Starts Coming
Closer. It Won't Stop." is retired: it reads like a real event. Regenerate the recording script with the new title.

## Build approach (coordinator, 11 Nov 2026)

The owner is making a Moon-free beach plate, a flooded-beach plate and the Moon alone (real near side, on black), so the
Moon is composited in code at each stage's exact angular size from calc.py, and the water level animates between the two
plates. Extra paintings coming: a daytime eclipse, the break-up as a smooth arc along the orbit, and the ring across the sky.


## Plates the engine reads (fixed file names; a new painting dropped over any name replaces only that scene)

`season3/make_plates.py` builds every code-made plate below from the owner's three paintings; `season3/engine.js` reads them by name. To swap one:
paint it at 2560x1440 (16:9) and/or 1080x1920 (9:16), save it over the name, and re-render only the beats that show it.

| File | What it is | Shown at |
|---|---|---|
| `plate-beach.png` / `plate-beach-9x16.png` | the "tonight" beach with its painted Moon painted out (the Moon is its own layer) | every stage |
| `plate-flood.png` / `plate-flood-9x16.png` | the same beach with the sea over the sand; the engine wipes it up the beach as the tide climbs | ch3-ch8 |
| `moon-disc.png`, `moon-disc-hi.png` | the Moon alone with the real near-side pattern of dark seas (Procellarum, Imbrium, Serenitatis, Tranquillitatis, Crisium...), drawn at each stage's exact angular width | every stage with a Moon |
| `eclipse.png` | the faint corona around the dark disc (the engine draws the disc: the Sun is fully hidden behind a Moon ~4x wider) | ch5 |
| `plate-breakup.png` | `moon-03-breakup` upscaled: the Moon stretched into an arc along its orbit (not an explosion) | long film only, the payoff |
| `ring.png` | the thin silver ring across the sky, horizon to horizon (16:9 only; the ending is long-film only) | long film only |
| `plate-tonight.png` | `moon-01-tonight` upscaled: the opening and the last shot (the loop) | long film |
| `plate-close.png` | `moon-02-close` upscaled: the Moon ~8-10x wider; the long-film thumbnail and the Part 7 cover | thumbnail / covers |

The 9:16 parts are their own composition: the painting sits in the middle of the frame and the sky and sea are extended in code (`portrait()` in make_plates.py);
the break-up and the ring have no 9:16 version because the ending stays in the long film.
All three paintings are AI illustrations (the owner's, made with ChatGPT): say so in every description.

## v2: the owner's nine paintings (11 Nov 2026) → plates (season3/make_plates_v2.py)

The originals are in `art/owner/` (spaces in the file names). `make_plates_v2.py` upscales them (Lanczos + gentle sharpening) to the plate names:

| Painting | Plate | Use |
|---|---|---|
| 1 Lone figure on a moonless beach (9:16) | `plate-beach-9x16.png` | every portrait stage |
| 2 Earth-facing full Moon (square, on black) | `moon-disc.png`, `moon-disc-hi.png` | the Moon at every stage (real near side, north up: Tycho at the bottom, Crisium on the right) |
| 4 Rising Tide (16:9) | `plate-flood.png` | the tide stages (long film) |
| 5 At the new waterline (9:16) | `plate-flood-9x16.png` | the tide stages (parts) |
| 6 / 7 Oversized eclipse (16:9 / 9:16) | `plate-eclipse.png` / `plate-eclipse-9x16.png` | chapter 5 (the disc is matched to the engine's angular size) |
| 8 Stretched Moon over the rising sea (16:9) | `plate-breakup.png` | the break-up (long film only) |
| 9 Solitary figure beneath a giant Moon (16:9) | `plate-close.png` | the Moon about 9.6x wider (about 40,000 km) |
| 10 Quiet beach beneath a planetary ring (16:9) | `plate-ring.png` | the ring (long film only) |

No moonless 16:9 beach (painting 3) arrived: `plate-beach.png` stays the code-made plate from the "tonight" painting.
The paintings come from separate generations and do not line up pixel for pixel: scenes crossfade under a camera drift instead of wiping.
