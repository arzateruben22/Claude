# Back of the Envelope No. 002, "Everyone, one place"

Episode 2 of Back of the Envelope (`films/channels/whatif`). Could all 8.2 billion people stand in one place? At a
calm 2 people per m², everyone covers about 4,100 km²: a square 64 km across, about 2.6 Greater Londons. Packed as
bodies alone, as dense as water, everyone makes about an 800 m cube, a little shorter than an 828 m tower. It runs
74.4 s at 9:16 and is narrated by a synthetic voice (am_puck), which must be labelled as AI.
**Nothing has been posted.** A demographer or physicist signs off the claims (`review/CLAIMS-REVIEW.md`) before it
posts.

| | |
|---|---|
| **Final** | `out/envelope-002-9x16.mp4`: 1080×1920, 30 fps, 2232 frames, 74.4 s, −14.1 LUFS, −1.5 dBTP, 0 flashes, QA PASS. Rendered by the render worker from commit f9133c0 |
| YouTube version | `out/envelope-002-9x16-youtube.mp4`: 1440×2560, 2232 frames, 74.4 s, sound copied from the final (same AAC packets) |
| Poster | `out/envelope-002-9x16.jpg` (the boxed "2.6 Londons" over the Greater London square, film.json `poster` 41.43 s) |
| Contact sheet | `out/envelope-002-9x16-contact.jpg` |
| Ten stills | `review/stills-ep02.jpg`: from the final at 0.5, 8.6, 16.7, 24.8, 32.9, 41.1, 49.2, 57.3, 65.4 and 73.5 s (the last is the end card) |
| Measured gates | `review/scorecard.md` |
| Before posting | `review/HUMAN-REVIEW.md`, `review/CLAIMS-REVIEW.md` |

## Files

| File | What it is |
|---|---|
| `calc.py` | The numbers: the area at 2 and 4 per m², the square's side, Greater Londons, the share of Earth's land, the bodies' volume and cube side, and the cube at the two density bounds. `python3 calc.py` prints them; `compile.py` reads its `V` and `RESULTS` |
| `script.md`, `claims.json` | The words (Flow standard) and the claims ledger (10 claims, 7 sources) |
| `voice.py`, `vo/` | The voice: one call and speed per sentence, measured pauses (0.32 s; 0.55 s after a question). 8 WAVs, `lines.json` (speeds, gaps, model hashes), `words.json` (word timings). No `pron.json`: no special pronunciations |
| `compile.py` → `film.json`, `sheet.json` | The direction (shots, beats, camera, crowd keys, spine, labels, badges, pill, captions, end card) and the studio's cue sheet (preset `envelope-working`) |
| `scene.mjs` | The picture, a pure function of t, on the channel set `../set/` (desk, crowd, globe, anchor, tower, spine, motif) |
| `sound/` | The delivery soundtrack `envelope-002-mix.m4a` and its `qa.json` (byte-identical to `build/audio/mix.m4a` and `qa.json`) |
| `assets.md` | Where everything comes from, and the licences |
| `review/` | `preview-ep02.mp4` and `preview-ep02.jpg` (the reviewed draft, 540×960, history), stills, scorecard, sign-off sheets |

## Rebuild

Nothing below was run for this hand-off; the final already exists. Paths relative to the episode folder.

```
E=films/channels/whatif/ep02; V=$CINEMA_VOICE/venv/bin/python; M=$CINEMA_VOICE/models
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
cp build/audio/mix.m4a sound/envelope-002-mix.m4a; cp build/audio/qa.json sound/qa.json
# 4. picture: animatic and draft for checking, then the final (chunked, resumable)
node ../../../../kits/cinema/film/render.mjs --film . --tier animatic --share-cpu --fresh
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --share-cpu --fresh
../../../../kits/cinema/film/run.sh . --tier final --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --assemble --audio sound/envelope-002-mix.m4a
# 5. measure, then the YouTube version
python3 -I ../../../../kits/cinema/film/qa.py .
python3 -I ../../../../kits/cinema/film/youtube1440.py .
```

The exact soundtrack and assemble commands were not recorded in `PRODUCTION.md` or `sound/`; steps 3 and 4 use the
kit's documented forms (as for No. 001). The soundtrack is byte-identical to `build/audio/mix.m4a`, so it came from
this sheet.

## Timing (film.json)

| Beat | Shot | Film s | What lands |
|---|---|---|---|
| hook | you | 0–5.4 | Frame 0: title "Everyone, *one place*", "a thought experiment", one blue figure in a chalk square of half a square metre. The question is spoken 0.12–1.72 s; title signature 4.63 s |
| normal | you | 5.4–16.2 | Label "you" (5.2 s); a glimpse of a full street (9.17 s); back in to your half square metre (11.53 s): "8.2 billion × ½ m² each", badge "∵ 2 people per m² (a calm crowd)" |
| change | grow | 16.2–27.0 | The crowd spreads from 3.2 m to 64 km a side (16.87–24.97 s) while the camera rises; "≈ 4,100 km²" (22.3 s); "64 km × 64 km" (24.97 s); pill "64 km · about 38 min at 100 km/h" |
| why | grow | 27.0–43.2 | Squeeze to 4 per m² (27.77 s): "twice as close: unsafe", "≈ 2,100 km²"; chalk warning hatching 34.37–36.47 s; back to 2 per m² (35.87 s); Greater London square, boxed "≈ 2.6 Londons" (39.93 s). A slow orbit over the crowd runs from about 21 to 43 s |
| whoa | orbit, cube | 43.2–56.4 | The scale jump to the planet (43.43 s), everyone one marker dot, "≈ 0.003%" of Earth's land; the cube pours up (46.47 s): "8.2 billion × 62 kg ≈ 0.5 km³"; the tower rises (52.0 s), boxed "≈ 800 m cube", label "tallest tower, 828 m", then the chalk 828 m rule from the tip over the cube (53.0–53.8 s); badge "true sizes · tower drawn wider" |
| work | cube | 56.4–62.4 | Show your work: 8.2 bn × 62 kg ÷ water ≈ 800 m cube; bodies at 0.97 g/cm³ ≈ 806 m; at 1.06 g/cm³ ≈ 783 m. The cube grows and shrinks with each row |
| takeaway | home | 62.4–68.4 | Back over the whole square, its edges in view, then one dive to the figure (64.37–67.07 s); "4,100 km² ≈ 2.6 Londons" kept boxed |
| tease | end | 68.4–74.4 | End card from 68.47 s (held 5.9 s): "≈ 2.6 Londons", "Next envelope: *all the ants*", the UN footnote, chip "Back of the Envelope · No. 003"; the crowd shrinks back to your half square metre for the loop |

The grid is 50 BPM (A lydian). Captions: 25 pages, burned in.

## Claims and TODOs

- 10 claims in `claims.json`, all status `ok`, **all checked from a search excerpt only**. A demographer or physicist
  opens each of the 6 sources (UN World Population Prospects 2024, ScienceAlert on crowd density, Britannica on
  Greater London, Nations Online on land area, Walpole et al. 2012, Biology Insights on body density) and ticks
  `review/CLAIMS-REVIEW.md`. `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep02 --sources` prints
  the post's source list. The tower's 828 m is claim c10 (the CTBUH's 2010 ratification, as reported by KHL Group).
- TODO: channel handle and trademark checks (bible); the posting accounts; a pinned sources page; the AI-voice label
  and "Voice: synthetic" in the post. No phone numbers, emails, prices or hours appear in this episode.

## For a human to review

- **The model.** 2 people per m² (a calm crowd); everyone at the 62 kg world adult average (children weigh less, so
  the cube is an upper bound); bodies as dense as water; the 100 km/h drive is an assumed round speed. Greater
  London is drawn as a square of its area, not its outline.
- **The tower.** A generic stepped spire at true height (828 m), drawn 2.2× wider than true so it reads on a phone
  (badged "true sizes · tower drawn wider"); it is not a likeness of the Burj Khalifa and is not named on screen.
  The worker measured the tip and the chalk rule 8–17 px above the cube top at 1080 from 56.5 s on (8–9 px at
  58.5–60.0 s, while the cube shows its 806 m bound).
- **End card.** The card's "all the ants" against the voice's "who weighs more, all the ants or us?"; the chip reads
  "No. 003" (the next episode, as in No. 001).
- **The takeaway's wording.** "The world isn't full" is about standing room only (c9); check it does not read as a
  claim about resources or housing.
- **Listen:** "eight billion", "half a square meter", "Londons", "tallest tower"; the 0.55 s pause after the hook's
  question.
