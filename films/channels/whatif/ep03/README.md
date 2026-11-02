# Back of the Envelope No. 003, "All the ants"

Episode 3 of Back of the Envelope (`films/channels/whatif`). Who weighs more, all the ants or all of us? The old sum
(Hölldobler & Wilson, 1994) said about 10 quadrillion ants weigh about as much as all of us. Schultheiss et al.
(PNAS 2022) counted about 20 quadrillion, twice as many, but weighed as carbon they come to 12 Mt against our
60 Mt: about a fifth. The picture is a pan balance whose beam leans with the story; a second balance weighs the ants
against every wild bird and mammal, and a to-scale carpet shows your share, about 2.5 million ants. It runs 73.8 s
at 9:16 and is narrated by a synthetic voice (am_puck), which must be labelled as AI.
**Nothing has been posted.** An entomologist or ecologist signs off the claims (`review/CLAIMS-REVIEW.md`) before
it posts.

| | |
|---|---|
| **Final** | `out/envelope-003-9x16.mp4`: 1080×1920, 30 fps, 2214 frames, 73.8 s, −14.1 LUFS, −1.8 dBTP, 0 flashes, QA PASS. Rendered by the render worker from commit cdad9d3 |
| YouTube version | `out/envelope-003-9x16-youtube.mp4`: 1440×2560, 2214 frames, 73.8 s, sound copied from the final (same AAC packets) |
| Poster | `out/envelope-003-9x16.jpg` (the boxed "20%" over the balance tipped our way, film.json `poster` 40.03 s) |
| Contact sheet | `out/envelope-003-9x16-contact.jpg` |
| Ten stills | `review/stills-ep03.jpg`: from the final at 0.5, 8.6, 16.7, 24.8, 32.9, 40.9, 49.0, 57.1, 65.2 and 73.3 s (the last is the end card) |
| Measured gates | `review/scorecard.md` |
| Before posting | `review/HUMAN-REVIEW.md`, `review/CLAIMS-REVIEW.md` |

## Files

| File | What it is |
|---|---|
| `calc.py` | The numbers: ants' carbon over ours (and at the lightest and heaviest published estimates), ants per person, carbon per ant, the count against the 1994 figure. `python3 calc.py` prints them; `compile.py` reads its `V` and `RESULTS` |
| `script.md`, `claims.json` | The words (Flow standard) and the claims ledger (9 claims, 6 sources) |
| `voice.py`, `vo/` | The voice: one call and speed per sentence, measured pauses (0.32 s; 0.55 s after a question). 8 WAVs, `lines.json` (speeds, gaps, model hashes), `words.json` (word timings). No `pron.json`: no special pronunciations (the names are on screen, not spoken) |
| `compile.py` → `film.json`, `sheet.json` | The direction (shots, beats, camera, the beam's tilt and the heaps' fill, the carpet, spine, labels, badges, work card, captions, end card) and the studio's cue sheet (preset `envelope-working`) |
| `scene.mjs` | The picture, a pure function of t, on the channel set `../set/` (desk, balance and ant, crowd as the ant carpet, anchor, spine, motif). Opts into `CINEMA.holdCuts` and sets `kMax` 24 |
| `sound/` | The delivery soundtrack `envelope-003-mix.m4a` and its `qa.json` (byte-identical to `build/audio/mix.m4a` and `qa.json`) |
| `assets.md` | Where everything comes from, and the licences |
| `review/` | `preview-ep03.mp4` and `preview-ep03.jpg` (the reviewed draft, 540×960, 15 fps, history), stills, scorecard, sign-off sheets |

## Rebuild

Nothing below was run for this hand-off; the final already exists. Paths relative to the episode folder.

```
E=films/channels/whatif/ep03; V=$CINEMA_VOICE/venv/bin/python; M=$CINEMA_VOICE/models
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
cp build/audio/mix.m4a sound/envelope-003-mix.m4a; cp build/audio/qa.json sound/qa.json
# 4. picture: animatic and draft for checking, then the final (chunked, resumable)
node ../../../../kits/cinema/film/render.mjs --film . --tier animatic --share-cpu --fresh
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --share-cpu --fresh
../../../../kits/cinema/film/run.sh . --tier final --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --assemble --audio sound/envelope-003-mix.m4a
# 5. measure, then the YouTube version
python3 -I ../../../../kits/cinema/film/qa.py .
python3 -I ../../../../kits/cinema/film/youtube1440.py .
```

The exact soundtrack and assemble commands were not recorded in `PRODUCTION.md` or `sound/`; steps 3 and 4 use the
kit's documented forms (as for No. 001 and No. 002). The soundtrack is byte-identical to `build/audio/mix.m4a`, so it
came from this sheet. `qa.py --file` takes a path from the working directory, not from the episode folder.

## Timing (film.json)

| Beat | Shot | Film s | What lands |
|---|---|---|---|
| hook | macro | 0–5.4 | Frame 0: title "All the *ants*", "a thought experiment", the chip "Back of the Envelope · No. 003"; low behind one walking ant, the broadside balance level and empty 2.3 m beyond it. The question is spoken 0.12–1.66 s; title signature 4.70 s |
| normal | scale | 5.4–15.6 | Cut to the whole balance at a wide angle; the heaps fill from 5.63 s; labels "all the ants", "all of us" (13.0, 13.3 s); level on "balance", spine "Hölldobler & Wilson, 1994: 10 quadrillion ≈ our weight" (14.13 s); badge "Heaps not to scale" from 5.9 s |
| change | scale, sites | 15.6–27.0 | Up over the paper (16.7 s): 489 count sites light one by one; down again; spine "20 quadrillion ants = ×2" (22.87 s); the ants' heap doubles and the beam dips 14° to their side (22.87–24.07 s) |
| why | tiny, scale2 | 27.0–42.0 | Macro (30.3 s): a worker ant on the millimetre ruling beside a true-size fingertip, labelled "a worker ant, a few mm" and "your fingertip"; back to the balance (34.3 s), badge "∵ weighed as carbon (dry)"; on "fifth" (38.53 s) the beam swings 25° our way, boxed "12 Mt C ÷ 60 Mt C ≈ 20%" |
| whoa | wild, each | 42.0–55.2 | A second balance swings in (43.87 s): the ants against "every wild bird and mammal", a modest 9° lean toward the ants; spine "for each person ≈ 2.5 million ants" (47.3 s); on "each" (47.8 s) top-down among 5 mm-apart specks, rising until "you" appear from above (49.6 s), then down to the side view of the whole 7.8 m square |
| work | work | 55.2–61.2 | Show your work over both balances: 12 ÷ 60 Mt C ≈ 20%; heaviest estimate, 50 Mt C ≈ 83%; lightest, 3.6 Mt C ≈ 6%. Badge "Heaps not to scale" again from 55.5 s |
| takeaway | home | 61.2–67.2 | Back to the tipped balance, the box "12 Mt C ÷ 60 Mt C ≈ 20%" kept; held through "by a lot", then one move down to the walking ant on "count" (64.47–65.77 s) |
| tease | end | 67.2–73.8 | End card from 67.27 s (held 6.5 s): "≈ ⅕ of us", "Next envelope: *count to a billion*", the Schultheiss footnote, chip "Back of the Envelope · No. 004"; the ant walks back into its frame-0 step for the loop |

The grid is 50 BPM (A lydian). Captions: 24 pages, burned in. 160 words, 2.4–2.9 words/s per line.

## Claims and TODOs

- 9 claims in `claims.json`, all status `ok`, **all checked from a search excerpt only**. An entomologist or
  ecologist opens each of the 6 sources (Hölldobler & Wilson 1994 as quoted on a Serendip slide, Schultheiss et al.
  2022, Bar-On, Phillips & Milo 2018, Phys.org on the 2022 count, Fayle & Klimeš 2022) and ticks
  `review/CLAIMS-REVIEW.md`. `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep03 --sources` prints the
  post's source list. The Schultheiss DOI was written from memory and the study count (465 or 489) needs the paper.
- The 8.2 billion people behind "ants per person" is claim c9 (UN World Population Prospects 2024, as in No. 002).
- TODO: channel handle and trademark checks (bible); the posting accounts; a pinned sources page; the AI-voice label
  and "Voice: synthetic" in the post. No phone numbers, emails, prices or hours appear in this episode.

## For a human to review

- **The model.** Heaps not to scale (badged); weighed as dry carbon (badged), the unit both censuses use; the beam
  leans in proportion (`tilt_for` in `compile.py`), not all the way as a real balance would. The second balance's
  9° lean is modest on purpose: c5 says only "exceeds", no ratio.
- **The carpet.** An idealised square grid of 2,439,844 ants 5 mm apart (4 per cm²) in a 781 cm square round one
  170 cm figure; real ants are neither evenly spaced nor in one place. The spine rounds it to "≈ 2.5 million".
- **The fingertip.** A true-size fingertip (1.5 cm across) beside an ant 4.5 mm long, labelled "a few mm".
- **End card.** "Next envelope: *count to a billion*" against the voice's "how long would it take to count to a
  billion?"; the chip reads "No. 004" (the next episode, as in No. 001 and No. 002).
- **Listen:** "two and a half million", "a fifth", "deserts", "mammal", "combined"; the 0.55 s pause after the hook's
  question.
