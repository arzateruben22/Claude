# Meanwhile, Inside No. 03, "The jump"

Episode 3 of Meanwhile, Inside (`films/channels/body`). It runs 74.8 s at 9:16, narrated by bf_emma (a synthetic
voice, labelled as AI). It pays off episode 2's tease ("In the fastest, it doesn't crawl; it jumps") and sets up
episode 4 ("The gap"). **Nothing has been posted.** A physiologist signs off the script and the pictures first.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-003-9x16.mp4`, poster `out/meanwhile-inside-003-9x16.jpg`, contact sheet `out/meanwhile-inside-003-9x16-contact.jpg` |
| Measured gates | `review/scorecard.md` |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (20 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** a spark mid-leap between two gaps of a myelinated fibre; the readout asks "? m/s". "How fast is this
  spark? The leading expert doubted it could ever be timed."
- **Normal:** a nerve signal on one cell's thin fibre; some fibres reach from spine to toe, about a metre. "How long does
  that take?"
- **Change (the person and the wrong idea):** Johannes Müller thought it might be as fast as light; in 1850 his former
  student Helmholtz timed it (an illustration of his method: a frog muscle on its nerve, a lever and a pen on a turning
  drum, two twitch traces a beat apart). About thirty metres a second: cheetah speed.
- **Why (answering the surprise):** it isn't current in a wire; the cell re-fires it, step by step (a bare fibre's slow
  glow). Many of your fibres wear myelin and re-fire only at the gaps, so the signal leaps. Where myelin is damaged (a fibre
  labelled brain and spinal cord), signals can slow or stall.
- **Whoa:** a race on one start line: the thinnest bare fibre crawls (about 1 m/s), the thick wrapped one hits up to 150 m/s,
  faster than a Formula One car (540 against 373 km/h).
- **Takeaway (human scale):** a stubbed toe can hurt twice: on a large body silhouette, two signals leave the toe
  together in real time, the jolt arrives in about 0.1 s, the ache about 2.1 s later.
- **Meanwhile:** a heart at rest beat about eighty times (75 a minute from frame 0); each began with a spark.
- **Tease:** the hero fibre's terminal, a dark gap beyond it: "A gap most signals can't jump." The end card irises back
  to frame 0's spark and carries a fact: Helmholtz, 1850, about 27 m/s in a frog.

An independent script review (only the script, the ledger and WRITING.md) scored the first draft 6/10. Fixed before
voicing: the why now answers the change's surprise (why so slow) before explaining myelin; "swore" → "doubted";
"outrun light" → "as fast as light" (the 60× figure was an estimate Müller cited, not his guess); "his student" → "his
former student" (in 1850 Helmholtz was a professor); "bare fibres crawl" → "the thinnest bare fibres"; the toe's first
pain rides *faster* (thinly myelinated) fibres, not the 150 m/s ones; the MS fibre is shown as brain and spinal cord;
"a gap most signals can't jump" (electrical synapses exist); the km/h repeat became a Formula One comparison; the hook
shows a "? m/s" readout; the ending loops with a fact.

The 26 Oct audit (an independent fact check; every number checked out) changed four lines, re-voiced: "Your longest
run from spine to toe" → "Some fibres reach from spine to toe", and the readout "your longest nerve cells" → "spine
to toe: about 1 m" (the toe's sensory fibres, up the spinal cord to the brainstem, are longer still, about 1.5 m;
"your longest run" was also heard as a jog); "Wrapped ones" → "Thick wrapped ones" (the 150 m/s fibres are the
thickest; at equal thickness myelin gives about 20–30 times, the rest is thickness), with the race's wrapped fibre
drawn thicker and labelled "thick wrapped fibre"; "Many of yours" → "Many of your fibres" (nothing for "yours" to
point back to); "faster wires" → "faster fibres" (the why has just said it isn't current in a wire).

## The picture

One world, few cuts (WRITING.md, "The picture"): three fibres stacked along x in µm, internodes compressed and badged
(set/neuron.js): the hero (myelinated, its cell body at x < 0 and its terminal at x = 660), a thin bare fibre above it,
and a fibre below with one damaged sheath. Each leap is an arc of light from gap to gap just over the sheath, a
stylisation (the current flows inside; the action potential is re-fired at the gaps). One illustrated slide: the
drum. Three cuts in all, each on the iris. The spine readout (one place, its label naming the beat): ? m/s → spine to
toe: about 1 m → Müller: as fast as light? (300,000,000 m/s) → Helmholtz, 1850, frog: 27 m/s → gaps re-fired so far →
thinnest bare fibres, about 1 m/s → thick wrapped fibres, up to 150 m/s → 540 km/h (Formula One record: 373) → since the
stub, real time: 0 → 2.2 s → the tally. The body locator marks the toe in the normal beat; the takeaway's silhouette
is the human anchor. The score rises to 0.75 at the race and drops to 0.3 for the toe.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | 8 lines, 177 words; 20 claims, all from search excerpts |
| `pron.json` | `Johannes` (Kokoro read JOE-hanz) |
| `voice.py` | Episode 1's wrapper; speeds per sentence; the tease breathes 0.4 s after "the end of the line", the whoa 0.38 s before "Thick wrapped ones" |
| `vo/` | 8 WAVs, `lines.json`, `words.json` (15 word ends clamped) |
| `compile.py` | The direction → `film.json`, `sheet.json` |
| `scene.mjs` | The fibres, the drum, the body silhouette (HUD SVG, the locator's figure enlarged) |
| `qa/` | Episode 1's tools (unchanged copies) |

One kit change, opt-in: the balanced caption pager (`../KIT-CHANGES.md`). `set/neuron.js` (added with episode 2) is
used as is; this episode's damaged sheath, arcs, cell body and terminal live in `scene.mjs`.

## Rebuild

As episode 2 (`../ep02/README.md`), with this folder and the stills at
`0,3,8.3,11,17,22.6,30,38.5,47,57.5,64,71.5`.

## For a human to review

- **Shown but not claimed:** the arcs over the sheath (a stylisation of saltatory conduction); internodes of 40 µm
  (real ones are about 0.2–2 mm), badged "not to scale"; the race slowed and compressed but at the true 150 : 1 ratio;
  the race's wrapped fibre drawn 1.5× thicker than elsewhere in the film (it thickens during the camera's move into
  the race and thins back under the dimmed meanwhile; the race camera sits 2 µm lower so its lower edge clears the
  caption plate; a real fast wrapped fibre, about 13–20 µm, is ten or more times
  as wide as a thin bare one, about 1 µm, so the thicknesses stay not to scale); the damaged sheath's look; the 1850
  apparatus (an illustration of the method, not Helmholtz's actual instrument); the toe route on the silhouette
  (A-delta at about 15 m/s and C at about 0.7 m/s over 1.5 m, real time).
- **The readouts** are claims too: 1 m (c3), 300,000,000 m/s (c20: light's 299,792,458 m/s, rounded, labelled "Müller: as fast as light?"),
  27 m/s (c6), 1 and 150 m/s (c10, c11), 540 and 373 km/h (c12), 0.1 and 2.2 s (c13, c19 notes), the beats (c14).
- **Listen at T0:** Johannes (fixed in pron.json), Müller, Helmholtz, myelin, sclerosis.
