# Meanwhile, Inside No. 02, "A billion passengers"

Episode 2 of Meanwhile, Inside, the human-body channel (`films/channels/body`). It runs 72.8 s at 9:16 and is
narrated by bf_emma, a synthetic voice that must be labelled as AI. It pays off episode 1's tease ("Room for about a
billion passengers") and sets up episode 3 ("The jump"). **Nothing has been posted.** A physiologist signs off the
script and the pictures before it posts.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-002-9x16.mp4`, poster `out/meanwhile-inside-002-9x16.jpg`, contact sheet `out/meanwhile-inside-002-9x16-contact.jpg` |
| Ten final-tier stills | `review/stills-ep02.jpg` (taken from the delivered file at 0, 3.5, 12.5, 20.4, 27, 36.5, 44, 58.5, 62 and 71.3 s) |
| Measured gates | `review/scorecard.md` (from `kits/cinema/film/qa.py` and `scorecard.py`) |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (19 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** the hero red cell from episode 1, cut open and packed with hemoglobin, one O₂ boarding. "What's this
  cell carrying? Room for about a billion passengers."
- **Normal:** one protein, hemoglobin, about 270 million copies; four irons, four seats.
- **Change:** one hemoglobin fills. The first O₂ struggles to board; each makes the next easier (cooperative
  binding); full, it flushes from garnet to crimson.
- **Why (the wrong idea):** veins often look blue, so people guess the blood is. It never is: returning blood is darker
  red, red light sinks in and the vein swallows it, so less red comes back.
- **Whoa:** your blood comes back through your lungs about once a minute; there the empty seats fill in about a
  quarter of a second (shown 12× slower, with a 0.25 s readout).
- **Takeaway (the reframe):** the blue is your skin's trick; the red is a passenger count.
- **Meanwhile:** the tally of oxygen your blood handed out while you watched (250 mL a minute: about a cup).
- **Tease:** a myelinated fibre; the signal jumps from gap to gap. The end card irises back to frame 0's cell.

An independent script review (one agent, given only the script, the ledger and WRITING.md) scored the first draft 6/10
and caught real errors, all fixed before voicing: "land faster" (cooperativity is affinity, not speed) → "easier";
"every iron grips" → "each can hold"; "they board in a quarter of a second" → "the empty seats fill" (returning
blood is still about 75% loaded); "fuel gauge" → "passenger count" (oxygen is not fuel); the tease hedged to the
fastest fibres; the whoa no longer repeats the hook's billion but escalates to the whole body's loop.

## The picture rules (WRITING.md, "The picture", applied from this episode on)

- **A spine readout** in one place under the safe box's top edge, from the title's exit to the tally, its label naming
  the beat: O₂ seats in this one cell (about 1,000,000,000) → hemoglobins in it (about 270,000,000, as it is spoken) → O₂ aboard this hemoglobin (0 → 4 of 4, a step on each
  boarding) → seats still full in returning blood (about 75%) → seats filling, in lung time (0.00 → 0.25 s) → seats
  full, arriving → leaving (75 → 97%) → the tally (mL of oxygen handed out).
- **Human scale:** the body locator marks the forearm over the skin shot and the chest over the lung shot.
- **Every beat changes the picture:** five slides (cell, hemoglobin, skin, lung, nerve), joined by the iris on a section
  change.
- **Loop and fact:** at the end card the iris returns to frame 0's camera on the cut cell, under the card, so a replay
  is seamless. The card carries one fact: "Each red cell carries about 270 million hemoglobins, with four oxygen seats
  on each." (c1, c2).
- **Sound:** section energies rise to 0.75 at the whoa and drop to 0.3 for the reframe.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | The words (8 lines, 166 words) and the claims ledger (19 claims, all from search excerpts) |
| `pron.json` | Empty: every science word read right at T0 (phonemes in `vo/lines.json`) |
| `voice.py` | Episode 1's voice wrapper with this episode's per-sentence speeds and one per-line pause override (`GAPS`: the whoa breathes 0.45/0.55 s before its numbers). `--clamp` after align.py |
| `vo/` | 8 WAVs, `lines.json`, `words.json` (10 word ends clamped) |
| `compile.py` | The direction → `film.json` + `sheet.json`. Every cut, boarding, flush, ray, counter key and label hangs on a word |
| `scene.mjs` | The picture, a pure function of t: five slides (below) |
| `qa/` | Episode 1's peek, audit, purity and kprobe tools (unchanged copies) |

### The slides (`scene.mjs`)

| Slide | Units | What |
|---|---|---|
| cell | µm | Episode 1's hero cell (`set/rbc.js` through `cutaway.js`), cut along its axis; 150 hemoglobins on the cut face (`hbGeometry`, 0.34 µm across: hugely oversized, badged "not to scale"); four seated O₂ on each, which appear and sparkle on "billion"; one O₂ boarding at the rim on frame 0, labelled |
| hb | 1 = 0.5 nm | One hemoglobin (`set/hemoglobin.js`): four lumpy subunits, four heme discs with an iron bead. Four O₂ board on "board", "makes", "next", "easier", each approach shorter than the last; each unit warms 22% as its O₂ lands, and all flush garnet → crimson from "full" to "bright". The two halves turn a few degrees after the first boarding (the T → R shift, drawn). Badged "illustration" |
| skin | 1 = 50 µm | A block of skin cut open over a vein: the top surface carries a bluish band over the vein; in the cut face, blue light scatters back near the surface, red light sinks to the vein and fades ("swallows"), red beside the vein comes back out. Badged "illustration · not to scale" |
| lung | µm | An air sac (`cutaway.js`, flattened) with a capillary across its face (`set/vessel.js`); cells stream at 240 µm/s of lung time, shown 12× slower (the clock badge); each cell's colour runs from darker to crimson over the 60 µm where it meets the air sac; O₂ particles cross into the hero while its seats fill. Badged "not to scale" |
| nerve | µm | A myelinated fibre (`set/neuron.js`): the signal lights node after node on the 0.644 s hops that land the fourth on "jumps", a chartreuse band at each lit gap |

### New in the channel's set

- **`set/hemoglobin.js`**: `hemoglobin(THREE, L, o)` (the hero molecule with `set({ load, shift })`, `seat(i)`,
  `ironWorld(i)`), `hbGeometry()` (a merged low-poly copy for crowds) and `o2Geometry()` (two fused spheres). For any
  episode that needs oxygen on board (episode 5's air sac, for one).
- **`set/neuron.js`**: `fibre(THREE, L, o)`, B6 from the bible: an axon, optional myelin sheaths that taper into the
  gaps, and the signal as a chartreuse glow, continuous ("flow") or node by node ("jump"), with a glowing band at
  each lit node. Episode 3 builds on it; episode 4 adds the terminal.

One kit change, opt-in: the balanced caption pager (`../KIT-CHANGES.md`).

## Rebuild

```
E=films/channels/body/ep02; export CINEMA_VOICE=$HOME/.cache/cinema-voice; V=$CINEMA_VOICE/venv/bin/python
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
cd $E
$V -I voice.py --models $CINEMA_VOICE/models && $V -I ../../../../kits/cinema/voice/align.py vo $CINEMA_VOICE/models && $V -I voice.py --clamp
python3 -I ../../../../kits/cinema/script/lint.py . --segment meanwhile --bpm 75
python3 -I compile.py && node ../../../../kits/cinema/film/render.mjs --film . --cues && python3 -I compile.py
python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .
node ../../../../kits/cinema/film/render.mjs --film . --tier final --times 0,3.5,12.5,20.4,27,36.5,44,58.5,62,71.3 --build build/stills --keep-png --fresh
cd ../../../.. && kits/cinema/film/run.sh $E --tier final      # detached, resumable: a bare `run.sh $E` resumes
node kits/cinema/film/render.mjs --film $E --tier final --assemble --audio $E/build/audio/mix.wav
cp $E/build/final/9x16/contact-sheet.jpg $E/out/meanwhile-inside-002-9x16-contact.jpg
python3 -I kits/cinema/film/qa.py $E && python3 -I kits/cinema/film/scorecard.py $E --log $E/build/final/9x16/render.log
```

## For a human to review

- **Shown but not claimed:** the hemoglobin's shape (four lumpy subunits, not a crystal structure) and its half-turn
  on boarding; each O₂ boarding a little sooner (c5 says "easier", which is affinity); the lung capillary speed
  (240 µm/s) and the 60 µm over which the colour changes; the skin's layer thicknesses, the vein's depth and the
  light paths (an illustration of c10); the nerve's internodes (compressed, badged).
- **Badges:** "not to scale" on the cell (hemoglobin oversized), "illustration · slowed" on the hemoglobin (the
  boardings take seconds, not microseconds), "illustration · not to scale" on the skin, "12× slower" (the clock's own
  note, gone when the cells return to real speed on "Meanwhile") and "not to scale" on the lung, "not to scale ·
  slowed" on the nerve.
- **The readouts** are claims too: about 1,000,000,000 seats (c2, computed 1.08 billion, rounded as spoken), about 270,000,000 hemoglobins (c1), 75% in returning blood (c18), 75 → 97%
  (c19), 0.25 s (c17), the mL tally (c15).
- **Listen at T0:** hemoglobin, "the empty seats fill", the pauses before "In about a quarter of a second".
