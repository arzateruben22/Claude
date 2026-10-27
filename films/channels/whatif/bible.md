# Series bible: Back of the Envelope

Prism Studio slug `whatif`. Owner decision, 27 Oct 2026: the name is **Back of the Envelope**.
TODO before launch: handle and trademark checks (USPTO, EUIPO, TikTok, YouTube, Instagram); only the
open web has been searched for any channel so far.

**Tagline:** *Impossible questions, honest assumptions, real calculations.*

**Promise:** one absurd "what if", worked out properly on the back of an envelope, in about a minute.
The premise is a game; the arithmetic is not. Every assumption is on screen, every input has a
source, and the answer is said with the precision it deserves (one or two figures, "about").

**Audience:** curious adults and teens who like a thought experiment done properly. They know what a
kilometre and a minute feel like; they do not need algebra, but they like seeing the sum.

**Tone:** playful premise, rigorous middle, satisfying number at the end. Never smug, never a
prediction, never advice. Nothing in an episode is something to try.

## 1. Look: "graphite and marker"

The other channels took the colour wheel's obvious corners: Meanwhile, Inside is dark green with
chartreuse and pink; Light Minute indigo with teal and lilac; Rest Frame warm paper with ink, cobalt
and yellow. Back of the Envelope takes a **neutral graphite** ground (a pencil, a slate desk at
night) and one loud colour that no one else uses: a **violet-magenta highlighter** for the running
calculation. Two quieter colours have strict jobs: **tally green** means "assumption" and only that;
**ballpoint blue** means "the human-scale anchor" (you, your street, your kitchen). No amber, gold,
rose, coral, espresso, teal or chartreuse. (The Prism catalogue's placeholder colour `#F2A93B` is too
close to Los Güeros' amber, so the channel does not use it; the catalogue colour should follow the
theme, which is the coordinator's call.)

| Token | Hex | Role |
|---|---|---|
| `graphite` | `#131417` | Background (neutral, C* < 12) |
| `graphite-hi` | `#1D1F24` | Gradient top, the desk under the lamp |
| `surface` | `#25282E` | Caption plate (88%), pills, the spine bar |
| `chalk` | `#F4F2EC` | Captions, titles, the world's line work |
| `chalk-2` | `#A7AAB2` | Secondary text, units, words still to come |
| `marker` (accent) | `#EB63FF` | **The calculation:** the spine readout's live term, the spoken word, the boxed answer |
| `assume` | `#3DDC84` | **Assumptions only:** honesty badges, the "assume" tags on the spine |
| `anchor` | `#4DA3FF` | **Human scale only:** the person, the street, the everyday object the number is compared to |
| `grid` | `chalk` at 7% | The graph-paper ruling on the ground plane |

Every pill also carries a glyph (≈ estimate, ∵ assumption, ◆ anchor), so colour is never the only
cue.

**Contrast (WCAG 2.x, computed with `kits/cinema/sci/contrast.py`'s maths):**

| Text | on graphite | on graphite-hi | on surface |
|---|---|---|---|
| chalk | 16.5 | 14.7 | 13.2 |
| chalk-2 | 7.9 | 7.1 | 6.4 |
| marker | 6.8 | — | 5.5 |
| assume / anchor | 10.3 / 7.0 | 9.2 / 6.3 | 8.3 / 5.6 |

`graphite` text on a marker, assume or anchor chip: 6.8 / 10.3 / 7.0.

**Distance (ΔE76) to every other identity's chromatic colours,** nearest first: marker 35 (Rest
Frame's wave `#6D3FC8`); assume 33 (Light Minute's teal); anchor 26 (Light Minute's lilac). All
above the checker's warn line of 20. The ground is neutral and differs from the dark channels' grounds
and from Los Güeros' espresso and Lumevina's black (`contrast.py` gates this when `theme.json` lands).

**Type** (all SIL OFL 1.1, self-hosted, unmodified, no family shared with any channel or client):
- **Display: Bricolage Grotesque** (Mathieu Triay), variable wght/wdth/opsz, at 700 condensed for
  titles and the boxed answer: a grotesque with ink traps that looks drawn in a hurry but reads
  perfectly. https://github.com/ateliertriay/bricolage
- **Text: Figtree** (Erik Kennedy), variable 300–900, 700 for captions, 600 for labels: open,
  geometric, very legible small. https://github.com/erikdkennedy/figtree
- **Mono: JetBrains Mono**, variable 100–800, for the spine readout, badges and every number that
  changes (tabular by design, so a running counter never jitters).
  https://github.com/JetBrains/JetBrainsMono
- **Hand: Caveat** (Impallari), only for the scribbled working on the envelope (the "≈", arrows,
  the box around the answer's label). Never captions, never a number the viewer must read.
  https://github.com/googlefonts/caveat

**Motif: the boxed answer.** The final number of every episode is boxed with a hand-drawn
rectangle in marker, the way a student boxes the answer. It is the avatar too (a box around "≈").
Space owns the ring, physics the strobe ladder, body the pulse line; this channel owns the box.

**Second motif: honesty badges.** JetBrains Mono, tally green, `∵ assume: …`, `≈ estimate`,
`thought experiment`, `not to scale`, `rounded`, `idealised`. One tier below labels in size and
colour (WRITING.md picture rule 8).

**Title card:** a band at y 250–470. An envelope flap folds down (one beat), BACK OF THE ENVELOPE in
Bricolage caps, the question written below in Figtree as if just jotted. **End card:** the boxed
answer, large, then "Next envelope: …" below it, held ≥ 1.5 s, and the episode's footnote fact.

## 2. The visual grammar

From the catalogue: one continuous world, a spine readout, a human-scale anchor, a loopable last
frame.

- **One world per episode, on graph paper.** The subject is a 3D diorama (the Earth and its tunnel,
  a city block, an ant on a kitchen scale) standing on an infinite graph-paper plane under a single
  warm-white desk light. The camera moves through it; scale changes are pushes, never cuts.
- **The spine readout: the running sum.** A bar at y 250–330 (inside the top safe band) that builds
  the calculation term by term in JetBrains Mono: `6,371 km` → `× 2` → `÷ speed` → `≈ 38 min`. The
  live term is marker; finished terms are chalk; assumptions carry a green `∵` tag. When it reaches
  its answer it holds there, lit, through the whoa and takeaway, and its label changes to say what
  the number means (WRITING.md picture rule 2).
- **The human-scale anchor**, in ballpoint blue, at least once: a person, your street, a kitchen
  scale, a stopwatch on a wrist.
- **The loop:** the last frame returns to frame 0's composition with the answer boxed, so a replay
  asks the question again.

## 3. Sound: "pizzicato working"

**D lydian at 90 BPM:** a beat is 20 frames, a 16th exactly **5 frames** (Meanwhile is 6, Light
Minute 8, Rest Frame 4). Lydian's raised fourth (G♯) is the sound of a question that is enjoying
itself; no other channel uses lydian (E♭ major, E dorian, G mixolydian).

- **Instruments:** a plucked string (new `pluck` voice: Karplus–Strong, a pizzicato that walks the
  sum in eighths and turns to 16ths when the energy rises), a soft low pad, a bowed-bass sub only
  above energy 0.6. No felt piano (Lumevina), no bells (Lumevina), no pings (space), no mallets or
  thumps (body), no knocks or shutters (physics).
- **Foley, "pencil on paper":** a pencil `scratch` as each spine term is written, a pencil `tally`
  tick for counters, a soft `stamp` (a damped low pluck, not a thump) when an assumption badge lands,
  the box `draw` (a rising scratch whose end lands on the frame the box closes).
- **Room:** a small, dry study; the voice close and dry.
- **Sonic signature, "carry the one":** plucks **D5 → A5 → G♯5** at 0, +5, +10 frames. Root,
  fifth, then the lydian ♯4 just under it: it ends on a raised eyebrow, not a full stop. It plays on
  the title card, on the box closing around the answer, and on the end card.

New kit pieces (logged in `KIT-CHANGES.md` when built; additive, old films byte-identical): the
`pluck` and `scratch` voices in `studio/instruments.py`, `pluck` as a melodic voice in
`compose.py`, and the event kinds `term.write`, `answer.box`, `assume.badge` in `events.json`.

## 4. Narrator

Auditions in `auditions/` (am_puck, bm_fable, af_kore; measured in its README). Recommendation:
**am_puck**, the most animated intonation (13.7 semitones of range on the explanatory line); the
owner decides. Labelled "Narration: synthetic voice (AI)" on every film and post. Expect
`--speed` about 0.92–0.95: all three ran 3.2–3.8 words a second at 1.0.

## 5. The recurring segment: "Show your work"

Near the end of every episode (before the takeaway), 5–7 s: the spine readout expands into the whole
calculation on one line, every input with its unit, every assumption tagged green, and the
**sensitivity line** spoken or shown: "Double the cats: still about…", "Halve the density: …". It is
the channel's promise kept on screen every week.

## 6. Honesty rules (on top of WRITING.md)

1. **Each episode's numbers come from `calc.py`** in the episode folder: inputs with units, values
   and their sources; outputs rounded honestly; a sensitivity table. `compile.py` imports it, so the
   voice, captions, spine readout and `claims.json` cannot disagree.
2. **Every assumption is on screen** as a green badge when it starts to matter.
3. **One or two significant figures,** said with "about" or "nearly". No fake precision: the spine
   may show the input "8.2 billion" but never an answer like "37.84 minutes".
4. **A scenario is a thought experiment, never a prediction.** The hook may say "what if"; the
   takeaway says what the sum teaches about the real world.
5. **Nothing dangerous to try:** no stunts, no chemicals, no heights. If the premise is physical,
   it is impossible on purpose (a tunnel through the Earth).

## 7. Episode template (60–75 s, 150–180 words)

The seven beats of WRITING.md, with "Show your work" as the segment between whoa and takeaway:
hook (≤ 2 s question, frame 0 already shows the world and an empty spine) · normal (the inputs, one
human-scale number) · change (the premise switches on) · why (the person or wrong idea, 2 s
picture-only) · whoa (the bigger version, 3 s picture-only) · show your work (the sum and its
sensitivity) · takeaway (one reframe) · tease ("Next envelope: …", end card ≥ 1.5 s).

## 8. Six episodes, ranked

| # | Title | Hook (spoken by 2 s) | Person / wrong idea / stakes | Whoa | Answer (to be computed in calc.py) |
|---|---|---|---|---|---|
| 1 | **Through the Earth** | "Jump into a tunnel through the Earth. When do you come out?" | Wrong idea: the textbook "42 minutes" assumed Earth is the same density all the way down. Alexander Klotz (2015) used the real density profile: about 38 | In the uniform model the trip takes as long as half an orbit skimming the surface, and *every* straight tunnel, between any two cities, takes the same 42 minutes | ≈ 38 min (real Earth), 42 min (uniform) |
| 2 | **Everyone, one place** | "Could all eight billion of us stand in one city?" | Wrong idea: "there's no room left." Stakes: crowd density limits (4–5 people per m² is already a crush risk, so the episode uses a safe 2 per m²) | Everyone fits in about 4,000 km², a square about 65 km on a side: smaller than many metro areas | ≈ 4,000 km² at 2/m²; sensitivity 1/m² and 4/m² |
| 3 | **All the ants** | "Put every ant on Earth on one scale. Who's heavier, them or us?" | Wrong idea: the old line that ants outweigh humans. Schultheiss et al. (PNAS 2022) counted about 20 quadrillion ants: about 12 megatonnes of carbon, about a fifth of humanity's | Ants still outweigh all wild birds and wild mammals put together | ants ≈ ⅕ of us; > wild birds + mammals |
| 4 | **Count to a billion** | "Count to a billion out loud. How long does it take?" | Person: Jeremy Harper counted to a million on a webcast in 2007; it took 89 days | One a second is 32 years, but big numbers are long words: at a real speaking rate, with sleep, it takes more than a lifetime | ≈ 32 yr (naive) vs > 100 yr (real) |
| 5 | **Everybody jump** | "Everyone on Earth jumps at once. Does the Earth move?" | Wrong idea: "it would knock us out of orbit." Newton's third law: it moves, by m·h/M | The Earth moves by a few hundredths of a trillionth of a metre: smaller than an atom's nucleus is wide | ≈ 3 × 10⁻¹⁴ m |
| 6 | **Every cat at once** | "Every cat on Earth meows at the same moment. How loud is it?" (the catalogue's example) | Wrong idea: loudness doesn't add the way numbers do; decibels are logarithmic, and you hear only the cats near you | All the world's meows together carry about the sound power of a few kettles' worth of electricity, and less than one jet engine | needs sourcing (see below) |

**Sources each needs** (all checked as search excerpts until a person opens the links; claims.json
records which):
1. Klotz, "The gravity tunnel in a non-uniform Earth", *Am. J. Phys.* 83, 231 (2015),
   https://arxiv.org/abs/1308.1342 · PREM (Dziewonski & Anderson 1981) for density · Earth's radius
   and mass (NASA Earth fact sheet) · low-orbit period (computed).
2. UN World Population Prospects 2024 (population) · crowd-density guidance (UK Green Guide / Still,
   crowd science) · metro-area sizes (census bureaus).
3. Schultheiss et al., "The abundance, biomass, and distribution of ants on Earth", *PNAS* 119
   (2022) · Bar-On, Phillips & Milo, "The biomass distribution on Earth", *PNAS* 115 (2018).
4. Guinness World Records / news coverage of Jeremy Harper (2007) · English speaking rate in
   syllables per second (e.g. Pellegrino et al., *Language* 2011) · syllables per number word
   (computed by code over every number to a billion, sampled).
5. UN population · mean adult body mass (Walpole et al., *BMC Public Health* 2012) · a standing jump
   height · Earth's mass (NASA).
6. Weak today: world cat counts are rough (600 million to 1 billion; pet surveys about 370 million)
   and no peer-reviewed meow loudness was found (a 2019 *Animals* study measured other cat calls at
   56–61 dB). If a solid meow-level source isn't found before production, episode 6 becomes the
   backup: **"Every raindrop at once"** (the world's daily rainfall dropped in one second).

Episode 1 builds the set and the kit pieces; 2–5 reuse them. The long video (vol01) is episodes 1–5.

## 9. Risks

- **xkcd's What If?** covered "everybody jump". Our version must be our own: the sum on screen,
  sourced inputs, and the nucleus comparison; no borrowed jokes, art or lines.
- **Fake precision** is the brand's sin: the review checks every on-screen number against calc.py.
- **Crowd density** (ep 2) is a safety topic: say the safe density, never show a crush.
- **Platform:** AI-voice labels on TikTok, YouTube and Meta; each episode a distinct calculation, a
  script a person wrote and checked, and sources in the description (≤ 15).
- **Photosensitivity:** ≤ 3 flashes a second; the box and term flashes are fades ≥ 0.2 s.
