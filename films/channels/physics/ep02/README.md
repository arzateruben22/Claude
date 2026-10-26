# Rest Frame No. 002, "The swing's secret"

Episode 2 of Rest Frame, the physics channel (films/channels/physics). It is 71.7 s long, 9:16, narrated by
af_bella at speed 1.0 (a synthetic voice, labelled as AI). It pays off episode 1's tease ("one pendulum, big swing
against small. It's almost a tie.") and sets up episode 3. **Nothing has been posted.** A physicist signs off the
script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish, −14.1 LUFS / −1.9 dBTP; `qa.py` PASS) | `out/rest-frame-002-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep02.jpg` (PNGs in `build/stills/final/9x16/frames/`, not committed) |
| Soundtrack | `build/audio/mix.wav`, `mix.m4a`, `qa.json`, `spectrogram.png` (not committed) |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Which swing gets back *first*? Big? Or small?" | Both swings just before the bottom, ×1/10, freezing on the question; the title drops |
| normal | "Each string is just under a meter, as in a grandfather clock. One swing: about *one second*. Ghosts every tenth of a second bunch up at the turns." | The camera pulls back to an ink-drawn 2 m long-case clock whose pendulum swings with the small one (the human-scale anchor); one swing in real time lands on "second", then ×1/3 with the ghost ladder |
| change | "Pull one three times farther. Let both go. Three times the path… and still, *neck and neck*." | The back pendulum is pulled to 30°; both pass the bottom 2 frames apart on "neck" |
| why | Galileo claimed every swing takes the same time; for small swings he was nearly right; three times farther out the pull is almost three times stronger; nearly triple the speed: *nearly* the same time | Galileo's claim as a card; pull arrows (×2.9 and ×1); speed arrows at the bottom; rungs join same-moment ghosts |
| whoa | "So hang fifteen, each a little shorter. Only length changes. For about a minute, they drift apart. Then, all at once… back in *line*." | Harvard's 15-pendulum design, end-on (fifteen look like one), craning up over the row; ×10 with log ramps; realigned exactly on "line" |
| measure | "*Measure it*: twenty swings, and the big one is three tenths of a second *behind*. At thirty degrees, Galileo is off by about one part in sixty." | ×5; the spine counts 20 swings and freezes with the big one 0.31 s from home |
| takeaway | "Length sets the beat. A wider swing just moves faster: *almost* fast enough." | Both swinging in real time; "Ideal pendulums: no air, no friction" |
| tease | "Next: a dropped ball, bouncing back. It never reaches your *hand*." | Both re-released so the last frame is frame 0 (a seamless loop) under the end card; footnote: Huygens's 1656 pendulum clock |

## Picture rules (WRITING.md, "The picture") applied

- **One world:** every beat but the whoa is the same swing set, with camera moves across beats; the whoa cuts (on its section sound) to the pendulum-wave rig and back.
- **Spine readout** (top left, on a light plate): one swing 1.00 s → to the bottom 0.50 s → pull ×2.88 → speed ×2.97 → the wave's minute 0–60.3 s → swings 0–20 → big one behind 0.31 s.
- **Human scale:** the 2 m grandfather clock beside the 99.4 cm pendulum.
- **Loop:** the tease re-releases both so the final frame equals frame 0's moment in the hook's framing.
- **Footnote** on the end card (Huygens, 1656).
- **Score:** energy 0.8 in the whoa, 0.3 in the measure (the drop for the reveal).

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words (172 spoken, 17 claims) and the pronunciation (Galileo) |
| `vo/` | The voice: 8 WAVs, `lines.json`, `words.json` |
| `compile.py` | The direction → `film.json`, `sheet.json`. Releases are solved back from their words through the exact pendulum and the clock (ports in `../set/bench_py.py`) |
| `scene.mjs` | The picture: the channel's set plus this episode's staging |
| `../set/swing.js`, `../set/pendulum.js` | **New reusable blocks** (B6): the exact pendulum and the gantry prop |

## Rebuild

```
E=films/channels/physics/ep02; V=$HOME/.cache/cinema-voice    # kits/cinema/voice/setup.sh builds it
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
$V/venv/bin/python -I kits/cinema/voice/tts.py $E/script.md $E/vo --voice af_bella --speed 1.0 --lexicon $E/pron.json --models $V/models
$V/venv/bin/python -I kits/cinema/voice/align.py $E/vo $V/models
python3 -I kits/cinema/script/lint.py $E --segment measure --bpm 112.5
python3 -I $E/compile.py && node kits/cinema/film/render.mjs --film $E --cues && python3 -I $E/compile.py
(cd $E && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .)
node kits/cinema/film/render.mjs --film $E --tier animatic
kits/cinema/film/run.sh $E --tier final
node kits/cinema/film/render.mjs --film $E --tier final --assemble --audio $E/build/audio/mix.wav
cp $E/build/final/9x16/contact-sheet.jpg $E/out/rest-frame-002-9x16-contact.jpg
python3 -I kits/cinema/film/qa.py $E && python3 -I kits/cinema/film/scorecard.py $E --log $E/build/final/9x16/render.log
```

## Timing

| Beat | Film s | What lands on what |
|---|---|---|
| hook | 0–3.47 | Frame 0 is 0.33 s into both falls (ghosts 0–3 stamped). Frozen at 0.485 s, just short of the bottom, on "Big?" |
| normal | 3.47–13.60 | Released at ×1 at 8.37 s, so the far side is reached on "second" (9.37 s); then ×1/3 for the ghost ladder of the swing back |
| change | 13.60–20.00 | Released at ×1/5 at 16.00 s; the small one passes the bottom on "neck" (18.50 s), the big one 2 frames later (18.54 s) |
| why | 20.00–38.13 | Held at the release angles through Galileo and the pull; released at 31.50 s so the small one's bottom pass lands on "speed" (34.00 s) |
| whoa | 38.13–49.60 | Released at 38.32 s; ×1 → ×10 (1.2 s log ramp) → ×1 ending on "line" (46.03 s), where τ = 60.26 s and all fifteen are back in phase |
| measure | 49.60–59.73 | Released at 49.70 s at ×5; the small one's 20th swing completes on "behind" (53.83 s) as the clock freezes; the big one is at −17.3°, 0.31 s from home |
| takeaway | 59.73–65.60 | ×1 from the frozen state |
| tease | 65.60–71.73 | ×1/10; re-released at 68.43 s so τ at the last frame equals frame 0's |

## Kit and pipeline notes

- Re-delivered on 26 Oct in the recheck pass: phrase-broken captions (`../set/captions_py.py`), the spine readout pinned
  clear of the cards (`../set/spine.js`), WRITING.md rule 8 ("One line wins"), and the kit's readability pass (merged
  from the coordinating branch: larger counter labels and card text, labels that avoid all text, masters at CRF 12 and
  deliveries at CRF 15). No kit file was changed here (`../KIT-CHANGES.md`).
- `render.mjs --build` is relative to the working directory, not the film: run stills with `--build <film>/build/stills` from the repo root.
- Kokoro (af_bella, 1.0) speaks short lines at 3.1–4 words a second. The voiced lint (≤ 3.0) needed lines with full stops and longer words; `kits/cinema/voice` has no per-line speed, and the channel's speed stays 1.0.
- The cyc's wall curves forward on the left (z −44 at x −50): a rig whose back lane sat at z −50 put the big pendulum inside the wall. The rig stands 30 cm forward.
