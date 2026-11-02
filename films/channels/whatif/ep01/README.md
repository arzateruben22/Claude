# Back of the Envelope No. 001, "Through the Earth"

Episode 1 of Back of the Envelope (`films/channels/whatif`). How long would it take to fall through a straight
tunnel through the centre of the Earth? About 38 minutes with the real (PREM) density, not the textbook's 42 for a
uniform Earth. It runs 74.4 s at 9:16 and is narrated by a synthetic voice (am_puck), which must be labelled as AI.
**Nothing has been posted.** A physicist signs off the claims (`review/CLAIMS-REVIEW.md`) before it posts.

| | |
|---|---|
| **Final** | `out/envelope-001-9x16.mp4`: 1080×1920, 30 fps, 2232 frames, 74.4 s, −14.1 LUFS, −1.6 dBTP, 0 flashes, QA PASS. Rendered by the render worker from commit bf7edce |
| YouTube version | `out/envelope-001-9x16-youtube.mp4`: 1440×2560, 2232 frames, 74.4 s, sound copied from the final (`kits/cinema/film/youtube1440.py`) |
| Poster | `out/envelope-001-9x16.jpg` (the boxed answer, film.json `poster` 47.77 s) |
| Contact sheet | `out/envelope-001-9x16-contact.jpg` |
| Ten stills | `review/stills-ep01.jpg`: from the final at 0.5, 8.6, 16.7, 24.8, 32.9, 41.0, 49.2, 57.3, 65.4 and 73.5 s (the last is the end card) |
| Measured gates | `review/scorecard.md` |
| Before posting | `review/HUMAN-REVIEW.md`, `review/CLAIMS-REVIEW.md` |

## Files

| File | What it is |
|---|---|
| `calc.py` | The numbers: PREM density integrated for g(r), the fall time and top speed; the uniform and constant-g models; the core ±10% rows. `python3 calc.py` prints them; `compile.py` reads its `RESULTS` |
| `script.md`, `claims.json` | The words (Flow standard) and the claims ledger (13 claims, 4 sources) |
| `voice.py`, `pron.json`, `vo/` | The voice: one call and speed per sentence, measured pauses (0.38 s; 0.6 s after a question). 8 WAVs, `lines.json` (speeds, gaps, model hashes), `words.json` (word timings) |
| `compile.py` → `film.json`, `sheet.json` | The direction (shots, beats, camera, spine, labels, badges, counters, captions, end card) and the studio's cue sheet (preset `envelope-working`) |
| `scene.mjs` | The picture, a pure function of t, on the channel set `../set/` (desk, globe, anchor, spine, motif) |
| `sound/` | The delivery soundtrack `envelope-001-mix.m4a` and its `qa.json` (byte-identical to `build/audio/mix.m4a` and `qa.json`) |
| `assets.md` | Where everything comes from, and the licences |
| `review/` | `REVIEW-ROUND1.md` (draft review), `preview-ep01.mp4` (the reviewed draft, history), stills, scorecard, sign-off sheets |

## Rebuild

Nothing below was run for this hand-off; the final already exists. Paths relative to the episode folder.

```
E=films/channels/whatif/ep01; V=$CINEMA_VOICE/venv/bin/python; M=$CINEMA_VOICE/models
cd $E
python3 calc.py                                                       # the numbers
# 1. voice (only when a vo line changes), word timings, clamp, lint
$V -I voice.py --models $M
$V -I ../../../../kits/cinema/voice/align.py vo $M
$V -I voice.py --clamp
python3 -I ../../../../kits/cinema/script/lint.py . --segment work
# 2. direction → film.json + sheet.json
python3 -I compile.py
# 3. soundtrack (sheet.json names the preset envelope-working)
python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .
cp build/audio/mix.m4a sound/envelope-001-mix.m4a; cp build/audio/qa.json sound/qa.json
# 4. picture: animatic and draft for checking, then the final (chunked, resumable)
node ../../../../kits/cinema/film/render.mjs --film . --tier animatic --share-cpu --fresh
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --share-cpu --fresh
../../../../kits/cinema/film/run.sh . --tier final --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --assemble --audio sound/envelope-001-mix.m4a
# 5. measure, then the YouTube version
python3 -I ../../../../kits/cinema/film/qa.py .
python3 -I ../../../../kits/cinema/film/youtube1440.py .
```

The exact soundtrack and assemble commands were not recorded in `PRODUCTION.md` or `sound/`; steps 3 and 4 use the
kit's documented forms. The soundtrack is byte-identical to `build/audio/mix.m4a`, so it came from this sheet.

## Timing (film.json)

| Beat | Shot | Film s | What lands |
|---|---|---|---|
| hook | front | 0–4.8 | Frame 0: title "Through the *Earth*", the cutaway Earth, the figure labelled "you", "thought experiment" and "figure not to scale". The question is spoken 0.1–1.69 s |
| normal | drive | 4.8–13.8 | Running sum "12,700 km" (5.23 s), then "÷ 100 km/h ≈ 5 days" with the car and a days counter (9.13–13.5 s); badge "∵ no air · no heat · no spin" from 6.9 s; "falling it ≈ ? min" (12.27 s) |
| change | fall | 13.8–26.4 | The jump at 13.78 s; time 200× faster; the speed counter peaks at the centre and the figure stops at the far rim (25.23 s) |
| why | layers | 26.4–42.6 | "uniform Earth → 42 min" (28.7 s); textbook gravity line; "Klotz, 2015: the real Earth" (35.77 s); PREM badge, mantle and core labels, "real gravity peaks here" (39.1 s) |
| whoa | answer | 42.6–55.2 | The box closes on "≈ 38 min" (46.57 s); time 1000× faster for the swing (49.73–52.02 s); "round trip 76 min"; "∵ frictionless" |
| work | work | 55.2–61.2 | Show your work: real Earth ≈ 38, core 10% lighter ≈ 39, uniform 42; assumptions no air, no heat, no spin, straight through the centre |
| takeaway | core | 61.2–68.4 | "4 min sooner: the weight of the core" (61.47 s); the core glows, labelled (67.1 s) |
| tease | end | 68.4–74.4 | End card from 68.47 s (held 5.9 s): "≈ 38 min", "Next envelope: *everyone, one place*", the Klotz footnote, chip "Back of the Envelope · No. 002" |

The grid is 50 BPM (A lydian). Captions: 29 pages, burned in.

## Claims and TODOs

- 13 claims in `claims.json`, all status `ok`, **all checked from a search excerpt only**. A physicist opens each of
  the 4 sources (NASA Earth fact sheet, PREM 1981, Klotz 2015, Live Science 2015) and ticks `review/CLAIMS-REVIEW.md`.
  `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep01 --sources` prints the post's source list.
- TODO: channel handle and trademark checks (bible); the posting accounts; a pinned sources page; the AI-voice label
  and "Voice: synthetic" in the post. No phone numbers, emails, prices or hours appear in this episode.

## For a human to review

- **The model.** Real-Earth fall (PREM density) against the uniform-Earth 42 min; no air, no heat, no spin
  (rotation), frictionless, straight through the centre. The constant-g model (also 38 min in `calc.py`) is not
  shown. The 100 km/h drive is an assumed round speed.
- **Footnote seconds.** The card quotes the paper: 38 min 11 s and 42 min 12 s uniform. `calc.py` gives 2290.6 s
  (38 min 11 s) and 2530.4 s (42 min 10 s); the footnote is attributed, so this is expected.
- **End card.** The card's "everyone, one place" against the voice's "could everyone alive stand in one city?";
  the chip reads "No. 002" (the next episode, kept after review round 1), while the script's end-card line says
  "No. 001". Check the footnote is readable on a phone.
- **Pace of the middle.** The coordinator noted the middle holds one composition (the cutaway) too long; not
  changed for this episode.
- **Listen:** "ten kilometers a second", "forty-two", "thirty-eight", "textbook's"; the 0.6 s pause after the hook's
  question.
