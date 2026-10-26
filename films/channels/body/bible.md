# Series bible: the human body channel

Files are in `/tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/series/body/`: `BIBLE.md`, `meanwhile-pulse.json`, `ep01-script.md` and `contrast.py`. Nothing in `/home/user/Claude` was changed.

**Sourcing:** the proxy blocked page fetches. Every source below was checked only through search-result excerpts from the publisher's own pages (NCBI/StatPearls, PubMed, BioNumbers, university pages). TODO: a person opens each link and confirms the wording before a script is locked.

## 1. Channel name

| Option | Promise | Conflict search (2026-10-22) |
|---|---|---|
| **Meanwhile, Inside** (recommended) | "What your body is doing right now, while you watch." | Nothing found |
| **Lub Dub** | "Your body, one beat at a time." | "LubDub" is an Australian music duo on SoundCloud. Different field, but the handle may be taken |
| **The Quiet Machine** | "The machinery you never hear, made visible." | Only a Bandcamp album, "The Quiet Machines" |

TODO: this was only a web search. Check the handles and run trademark searches (USPTO, EUIPO).

## 2. Look: "surgical green"

A green-black background, the complementary colour to blood red. Nothing is taken from Lumevina, Los Güeros or Claude coral. The space and physics channels should avoid green backgrounds, chartreuse, watermelon red and these two typefaces.

| Token | Hex | Role |
|---|---|---|
| `bg` | `#0A1F1C` | Background and frame edges |
| `bg-hi` | `#123A33` | Radial glow behind the subject (no text on it) |
| `surface` | `#14342E` | Label pills, cards |
| `plate` | `#071513` at 82% | Caption plate |
| `text` / `text-2` | `#EFF6F2` / `#A9C7BE` | Captions and titles / units and the series line |
| `pulse` (accent 1) | `#FF6688` | Oxygen-rich blood, the "whoa" number, the accent word in the title |
| `signal` (accent 2) | `#D6F25F` | Nerve signals, the word being spoken in captions, the pulse line |
| Label colours | oxy `#FF6688` · deoxy `#CC5470` · nerve `#D6F25F` · immune `#F3EEE4` · O₂ `#8ED8FF` · CO₂ `#B4A6FF` · bone `#E8D7B0` · muscle `#E58FD8` · lining `#7FE6C5` | Used for the dot and the pill border. The label text names the part, so colour is never the only cue |
| 3D materials only (never text) | red cell `#E5334F` → `#8E2A3F` · tissue `#F0C9B8` · vessel `#E9B3A8` | Surfaces in the scene |

**Contrast ratios (WCAG, computed in `contrast.py`):**

| Pair | Ratio |
|---|---|
| text on bg / bg-hi / surface / plate | 15.6 / 11.4 / 12.3 / 17.0 |
| text-2 on bg / surface | 9.5 / 7.4 |
| pulse on bg / surface / plate | 6.1 / 4.8 / 6.7 |
| pulse on bg-hi | 4.5, too close, so pulse text never sits on the glow |
| signal (caption highlight) on plate | 14.9 |
| bg as text on a signal button | 13.6 |
| caption plate over a pure white or red frame (worst case) | text ≥ 9.9, signal ≥ 8.7 |
| deoxy swatch on surface | 3.25, so it gets a white ring |

**Type.** Both fonts are SIL OFL 1.1 and self-hosted with `OFL.txt`:
- **Display: Fraunces** 144pt SuperSoft SemiBold, for titles and numbers. Download: github.com/undercasetype/Fraunces/releases.
- **Text: Atkinson Hyperlegible Next**: 700 for captions, 600 for labels, 400 for secondary text. Download: github.com/googlefonts/atkinson-hyperlegible-next.
- Ship both unmodified, with no subsetting, because Atkinson reserves its font names.

**Title card, "the slide":** this is the poster and the last frame. The "whoa" image sits inside a 760 px circle, like a microscope's field of view. A chartreuse line circles the rim and blips "lub-dub" on the sonic signature. The title in Fraunces sits above the circle, and "Meanwhile, Inside · No. 01" below it.

**Recurring motif, the pulse line:** one chartreuse line draws the label leaders, the scale bar and the iris. Every change of scale goes through a circular iris with a scale pill, for example "×2,000 · 10 µm".

## 3. Sound

"Warm wonder": E♭ major at **75 BPM, a resting heart rate**, so a 16th note is exactly 6 frames.
- Dark pads and a low felt piano.
- Wooden mallets on labels instead of Lumevina's glass bells.
- Close, wet foley.

The new voices are described in `_new`. Every other voice already exists in `instruments.py`.

**Sonic signature:**
1. "Lub": a thump on E♭2.
2. "Dub": a thump on B♭2, 0.4 s later.
3. A mallet and bell on G5, 1.2 s after the first note.

That is the root, the fifth, then the major third two octaves up, so it opens into wonder. It plays on the end card and under scale jumps.

```json
{
  "_doc": "Meanwhile, Inside (human body), 'warm wonder': Eb major at 75 BPM, a resting heart rate (a beat is 0.8 s = 24 frames, a 16th is exactly 6 frames at 30 fps). Dark, round pads and a low felt piano; soft wooden mallets for labels; a lub-dub heartbeat as the pulse of the film; close, wet foley in a small body-sized room.",
  "_new": {
    "voices": {
      "mallet": "Soft wooden mallet (marimba-like): sine plus a quiet 3.9x partial and a 2 ms felt click, 0.35 s decay; pitched by notes like bell.",
      "thump": "Heartbeat: a sine dropping 2.2x to its note in 40 ms, a 140 Hz body and a soft click, saturated so phone speakers hear the 2nd harmonic; 'dub' is the second note, 'gap' s later, 4 dB quieter.",
      "squish": "A cell squeezing through: band-passed noise 300-1400 Hz under a resonant low-pass that falls 1800 to 500 Hz over the span, with a tiny pitched pop at the exit.",
      "zap": "A nerve spike: a 4 ms click plus a 60 ms upward chirp 800 to 3200 Hz; a saltatory run of them reads as a soft ratchet.",
      "signature": "The sonic signature: thump Eb2, thump Bb2 0.4 s later, then mallet + bell on G5 at 1.2 s."
    },
    "events": "Add to kits/cinema/events.json: beat {prio 2, span false}, cell.pass {prio 2, span true, kFloor 6}, bind {prio 3, after true}, diffuse {prio 3, span true}, breath {prio 2, span true}, title {prio 1}. 'zap' and 'impact' already exist.",
    "layers": "'pulse' needs a few lines in compose.score: one quiet thump per beat in sections whose energy is at or above 'above'."
  },
  "name": "meanwhile-pulse",
  "bpm": 75,
  "key": "Eb",
  "mode": "ionian",
  "scale": ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
  "progression": [
    {"pad": ["Eb3", "Bb3", "F4", "G4"], "root": "Eb2"},
    {"pad": ["C3", "G3", "Bb3", "Eb4"], "root": "C2"},
    {"pad": ["Ab2", "Eb3", "G3", "C4"], "root": "Ab1"},
    {"pad": ["Bb2", "F3", "Ab3", "Eb4"], "root": "Bb1"}
  ],
  "layers": {
    "pad": {"gain": -16, "bright": 2200, "attack": 1.8, "release": 2.4},
    "felt": {"gain": -20, "bright": 3400, "octave": 1, "eighths_above": 0.62},
    "sub": {"gain": -22, "above": 0.5},
    "air": {"gain": -36},
    "pulse": {"gain": -27, "note": "Eb1", "above": 0.55}
  },
  "space": {
    "music": [2.2, 0.32],
    "foley": [0.6, 0.22],
    "dialog": [0.4, 0.05]
  },
  "drive": {
    "music": 1.15,
    "effects": 1.1,
    "dialog": 0.0
  },
  "foley": {
    "label": {"voice": "mallet", "gain": -17, "notes": ["Bb4", "C5", "Eb5", "F5", "G5", "Bb5", "C6", "Eb6", "F6", "G6"]},
    "counter.show": {"voice": "mallet", "gain": -19, "notes": ["Eb5"]},
    "counter.tick": {"voice": "tick", "gain": -22},
    "counter.end": {"voice": "chime", "gain": -12, "notes": ["Eb5", "Bb5", "F6", "G6"]},
    "beat": {"voice": "thump", "gain": -13, "notes": ["Eb2", "Bb2"], "gap": 0.32},
    "impact": {"voice": "thump", "gain": -11, "notes": ["Bb1"]},
    "cell.pass": {"voice": "squish", "gain": -20},
    "bind": {"voice": "bell", "gain": -21, "notes": ["G6", "Bb6", "C7", "Eb7"]},
    "diffuse": {"voice": "sparkle", "gain": -25, "notes": ["Eb7", "G7", "Bb6", "F7"]},
    "zap": {"voice": "zap", "gain": -19},
    "swell": {"voice": "swell", "gain": -15, "note": "Eb2"},
    "breath": {"voice": "whoosh", "gain": -26, "dur": 1.6, "lo": 180, "hi": 1600},
    "dissolve": {"voice": "sparkle", "gain": -24, "notes": ["Bb6", "Eb7", "G7", "C7"]},
    "section": {"voice": "whoosh", "gain": -28, "dur": 0.9, "lo": 150, "hi": 1400},
    "title": {"voice": "signature", "gain": -12}
  },
  "master": {
    "lufs": -14.0,
    "tilt": 0.0
  }
}
```

## 4. Narrator

1. **bf_emma** (grade B−, British). Measured, documentary warmth: wonder without hype. **The recommended pick.**
2. **af_nicole** (B−, US). Soft and close, which suits "inside you". Risk: may sound breathy on phone speakers.
3. **am_michael** (C+, US male). Warm and low, but flatter.

TODO: the grades are from my memory of Kokoro's VOICES.md; confirm them. Samples of all three voices, reading a different line, are already in `/tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audition/`.

**Audition line:** "Why is this cell *folded*? Because the road ahead is narrower than the cell. Capillaries. Hemoglobin. Alveoli. Myelin. Seven micrometers."

Start `pron.json` with these words, each checked by ear: micrometers, alveoli, myelin, saltatory, sinoatrial, sarcomere. This channel takes bf_emma, so the space and physics channels should pick other voices.

## 5. The set: "The Inner Stage" (three.js r160)

**Stage.**
- An alpha canvas over a CSS gradient from `bg-hi` to `bg`.
- `FogExp2` gives depth, and about 200 drifting motes (block B3) give parallax.
- One world unit is 1 µm.
- Each scale is its own **slide**. Slides are joined by the iris, never by a continuous zoom.

| # | Block | Build | Motion as a pure function of t | Label anchors |
|---|---|---|---|---|
| B1 | **Vessel** | A cut-away tube wedge along a CatmullRom curve, with a darker cut-face rim and a Voronoi shader for the vessel lining | `r = r0(s)·(1 + 0.04·P(t − s/c))`, where P is the lub-dub wave at 75 BPM | wall(s), lumen(s), narrowest point |
| B2 | **Cell stream** | InstancedMesh of red cells made with a biconcave Lathe (~250 triangles each, ≤ 400 cells) | `s_i = τ⁻¹((τ(s0_i) + t) mod T)`, with `τ = ∫ds/v` and `v ∝ 1/r²`. Each cell scales to 0 where its path wraps around. It morphs from disc to parachute by `smoothstep(1, 0.5, r/R)` | Hero cell, computed in JS with the same function |
| B3 | **Swarm** | Instanced particles: O₂, CO₂, vesicles, ≤ 600. Variant: hemoglobin as 4 subunits plus 4 heme discs | `home + Σ A·sin(ωt + φ_i)` (seeded), plus an eased `lerp(home, target)` for diffusion and binding | Hero particle, centroid, binding site |
| B4 | **Sheet** | A bilayer membrane or lining: a 128² plane, two layers, a fresnel edge. Variant: instanced villi | `A·sin(kx − ωt)·window` | Surface, inside, outside |
| B5 | **Capsule** | A noise-deformed shell cut open by a clipping plane. Back faces are drawn flat to fill the cut. Can be instanced into clusters | Scale `1 + a·breath(t)`. The cut opens over time | Cut face, inner wall |
| B6 | **Neuron** | Cell body (B5), axon tube, myelin capsules with gaps, terminal | Uniform `front(t)`: continuous as `v·(t − t0)`, or jumping as `node[floor((t − t0)/Δ)]` | Cell body, node k, terminal, gap |
| B7 | **Fibres** | Instanced capsules with sarcomere stripes. Close-up: actin plus myosin heads. Variant: bone struts | Length `1 − c·act(t)`. Head angle `stroke(t + i·δ)`, staggered so it ripples | Fibre, sarcomere, myosin head |
| B8 | **Wanderer** | An amoeboid cell built with `metaballs.js` (6–9 balls) | The lead ball follows a path and the others trail it with a lag | Centre, leading edge |
| B9 | **Locator** | "You are here": a matte mannequin (~3k triangles) with a chartreuse ring | The ring pulses on the beat | Body region |
| B10 | **Overlays** (DOM) | Skin School's captions and `pin()` labels, plus a counter, the scale pill, the iris and the end card | Read from `film.json` | — |

**Lighting.**
- Hemisphere light: `#DDF3EC` / `#0A1F1C`, intensity 0.5.
- Warm key light from the top right: `#FFF1E6`, 2.2.
- Pink rim light from behind: `#FF8FA0`, 1.4.
- Translucency is faked with a fresnel term, never transmission.
- Only the signal and pulse colours bloom.

**Camera.**
- Macro push-ins.
- A **ride-along**: the camera is locked beside the hero cell, so the cell stays sharp while the world streams past.
- A **reveal pull** from one cell to many, for the whoa.
- Focus racks on the starred words.
- Field of view 28–40°.

**Render budget.** 2,100 frames in 3.5 h is about 6 s a frame. Skin School at 1080×1920 would take about 6.8 s a frame, so this set must be at least 15% cheaper:
- No shadow maps.
- At most 250k triangles, 2 moving InstancedMeshes and 1,000 instances.
- No transmission materials.
- Metaballs only in B8.
- `kMax` 12, with `kFloor` 6 on `cell.pass`, because the motion-blur probe can't see motion inside an instance.
- Camera travel of at most 3.5 px per sub-frame.

**Gate:** time 10 T2 stills. If the final render projects past 4 h, cut cost before rendering.

**Shareable with the space and physics channels:**
- B3 (atoms, stars)
- B5 (planet cutaways)
- B1's tube along a curve (orbits, field lines)
- B10
- `keys.js`
- The slide, iris and scale-pill grammar

## 6. Episode template (about 70 s, 150–180 words, about 2.6 words/s)

| Beat | Seconds | Words | Rule |
|---|---|---|---|
| Hook | 0–5 | 10–14 | Frame 0 is the payoff image. The question (≤ 6 words) is spoken by 2.0 s |
| Normal | 5–18 | 26–34 | Meet the thing. The locator shows where in the body we are |
| Change | 18–30 | 25–30 | Something moves, narrows or arrives |
| Why | 30–45 | 26–32 | The mechanism, plus 2.5 s with no voice |
| Whoa | 45–58 | 20–26 | The reveal pull or the number, plus 3.5 s with no voice |
| Takeaway | 58–65 | 14–19 | One line a viewer could repeat |
| Tease and end card | 65–71 | 8–11 | Names the next episode. The end card holds ≥ 2 s and doubles as the poster and loop point |

## 7. Ten episodes (ordered by how many new blocks each needs)

| # | Title · hook | Takeaway | Whoa | Blocks (new) | Claims [source] |
|---|---|---|---|---|---|
| 1 | **Single file** · "Why is this cell folded?" | A red cell's dimples let it fold through capillaries narrower than itself | The vessel narrows to half the cell's width; the cell folds into a parachute and springs back | B1 B2 B3 B9 B10 (none) | ~7 µm, biconcave, no nucleus [S1]. The narrowest capillaries are smaller than the cell, so cells go single file and deform without changing volume or surface area [S2]. Cells pass vessels about half their width [S3]. ~25 trillion red cells, ~84% of the body's cells [S4]. Parachute shape [S5]. Lifespan ~120 days [S6] |
| 2 | **A billion passengers** · "What's this cell carrying?" | ~270 million hemoglobins, four O₂ each: about a billion O₂ per cell | Four O₂ dock and a hemoglobin flushes from garnet to crimson. A counter runs to 1,000,000,000 | B2, B3 hemoglobin cluster (none) | ~270 million hemoglobin per cell [S8]. Each heme iron binds one O₂ [S9]. Oxygenated blood is bright red, deoxygenated is darker [S10]. Veins look blue because of how light travels in skin, not because blood is blue [S11] |
| 3 | **The jump** · "How fast is a nerve signal?" | Myelin makes signals jump: up to ~150 m/s, against 0.5–10 m/s without it | A split-screen race: sparks leap gap to gap. "540 km/h" | B6 (B6) | Speeds; the signal jumps between the nodes; oligodendrocytes and Schwann cells make the myelin [S12]. The current regenerates at each node [S13] |
| 4 | **The gap** · "Do your neurons actually touch?" | Most don't: chemicals cross a gap under 50 nm in about a millisecond | The "touch" opens into a gap; vesicles fuse and transmitter floods across | B6 B3 B4 (B4) | Gap < 50 nm; electrical synapses also exist [S14]. Transmitters are stored in vesicles [S15]. Calcium triggers vesicle fusion [S16]. ~1 ms delay [S17] |
| 5 | **Where breath goes** · "Where does your breath actually go?" | Into ~480 million alveoli with walls thinner than a micrometer | One alveolus unfolds into a floor beside a person drawn to scale. "70–140 m²" | B1–B5 (B5) | ~480 million alveoli (274–790 million) [S18]. 70–100 m²; barrier 0.3–0.5 µm [S19]. 120–140 m² by morphometry [S20] |
| 6 | **The exit** · "How do cells leave your blood?" | White cells roll, stop, crawl, then squeeze through the vessel wall | A neutrophil pours itself between two wall cells and out | B1 B2 B4 B8 (B8) | Neutrophils are 50–70% of white cells, 12–15 µm [S21]. Rolling, arrest, crawling, then migration through the wall [S22] |
| 7 | **The spark** · "What starts nearly every heartbeat?" | A patch of self-firing cells, the SA node, starts each normal beat (not the embryo's first beats, nor ectopic ones: the 26 Oct audit of ep06's tease) | A chartreuse wave sweeps a cutaway heart; valves snap shut on the thumps | B5 B6 B7 + valve leaflets (valves) | The SA node is the main pacemaker, in the right atrium [S23][S24]. It fires 60–100 times a minute at rest [S23], which works out to ~86,400–144,000 a day |
| 8 | **Walking molecules** · "What happens inside a flexing muscle?" | Myosin heads grab, pull and release actin, powered by ATP | Arm → fibre → sarcomere: thousands of myosin heads rowing | B7 B3 B9 (B7) | Calcium shifts tropomyosin; ATP releases the head; the stroke pulls actin [S25]. Sarcomeres shorten; without ATP, the muscle locks (rigor) [S26] |
| 9 | **Younger than you** · "How old is your skeleton?" | Bone is constantly rebuilt: most of it is replaced about every 10 years | A time-lapse of one remodelling pit dug out and refilled | B7 B8 B3 (none) | Osteoclasts dissolve bone and leave pits; osteoblasts refill them [S27]. Most of the skeleton is replaced about every 10 years [S28] |
| 10 | **The hidden floor** · "How big is your gut, inside?" | About 32 m², not the old textbook 260–300 m² | Villi, then microvilli, unfold into a floor drawn to scale | B4 villi variant, B3, B9 (variant) | ~32 m² [S29][S30]. Textbooks said 260–300 m² [S29]. Villi multiply the area ×6.5, microvilli ×13 [S30]. The lining renews every 3–5 days [S31] |

**Sources**
- **S1** https://www.histology.leeds.ac.uk/blood/blood_rbc.php
- **S2** https://kparker.bg-research.cc.ic.ac.uk/homepage/Mechanics%20of%20the%20Circulation/Chap_13/_Chapter_13b.htm
- **S3** https://pmc.ncbi.nlm.nih.gov/articles/PMC8215585/
- **S4** https://pubmed.ncbi.nlm.nih.gov/27541692/
- **S5** https://www.pnas.org/doi/10.1073/pnas.0504243102
- **S6** https://www.ncbi.nlm.nih.gov/books/NBK499994/
- **S7** https://openstax.org/books/anatomy-and-physiology-2e/pages/18-3-erythrocytes
- **S8** https://bionumbers.hms.harvard.edu/bionumber.aspx?id=102740
- **S9** https://www.umass.edu/microbio/chime/hemoglob/heme.htm
- **S10** https://www.jove.com/science-education/v/15246/hemoglobin
- **S11** https://uwaterloo.ca/computer-science/news/computer-science-researchers-help-answer-age-old-medical
- **S12** https://www.ncbi.nlm.nih.gov/books/NBK10921/
- **S13** https://iu.pressbooks.pub/humanphys/chapter/action-potential-conduction/
- **S14** https://www.ncbi.nlm.nih.gov/books/NBK526047/
- **S15** https://www.ncbi.nlm.nih.gov/books/NBK11166/
- **S16** https://pmc.ncbi.nlm.nih.gov/articles/PMC3225952/
- **S17** https://www.jove.com/science-education/v/14896/chemical-synapses
- **S18** https://pubmed.ncbi.nlm.nih.gov/14512270/
- **S19** https://www.ncbi.nlm.nih.gov/books/NBK493219/
- **S20** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10070844/
- **S21** https://www.ncbi.nlm.nih.gov/sites/books/n/statpearls/article-31353/
- **S22** https://pubmed.ncbi.nlm.nih.gov/17717539/
- **S23** https://www.ncbi.nlm.nih.gov/books/NBK459238/
- **S24** https://hyperphysics.gsu.edu/hbase/Biology/sanode.html
- **S25** https://www.ncbi.nlm.nih.gov/books/NBK537140/
- **S26** https://www.ncbi.nlm.nih.gov/books/NBK544225/
- **S27** https://www.ncbi.nlm.nih.gov/books/NBK499863/
- **S28** https://www.ncbi.nlm.nih.gov/books/NBK45504/
- **S29** https://pubmed.ncbi.nlm.nih.gov/24694282/
- **S30** https://bionumbers.hms.harvard.edu/bionumber.aspx?id=111126
- **S31** https://pmc.ncbi.nlm.nih.gov/articles/PMC7667136/

## 8. Episode 1 script: "Single file" (158 words, about 71 s)

## hook {shot: macro, frame 0 is the hero cell folded into a parachute in a capillary · energy: 0.7} (0–5 s)
vo: Why is this cell *folded*? Because the road ahead is *narrower* than the cell.

## normal {shot: craneBack to the hero cell in an artery · labels: red blood cell, no nucleus} (5–18 s)
vo: Meet a *red blood cell*. A soft disc about seven micrometers across, dimpled on both sides, with *no nucleus* inside. You have about twenty-five trillion of them, most of the cells in your body.

## change {shot: rideAlong as the vessel branches and narrows · label: capillary} (18–30 s)
vo: Now ride along as the vessel branches, and branches again, into a *capillary*. The narrowest capillaries are slimmer than the cell itself, so cells pass through in *single file*.

## why {shot: slow push; fold, slide, spring back · picture-only 2.5 s} (30–45 s)
vo: Here's the trick. That *dimpled shape* gives the cell spare surface for its volume, so it can fold into a *parachute* without stretching. Squeeze, slide, spring back.

## whoa {shot: pullBack to a capillary net, all in single file · scale pill · picture-only 3.5 s} (45–58 s)
vo: Some capillaries are only about *half its width*. And it keeps squeezing through them for its whole life: about *a hundred and twenty days*.

## takeaway {shot: the cell pops out and springs back to a disc} (58–65 s)
vo: So that dimple isn't decoration. It lets your blood squeeze through your *smallest vessels*, where oxygen gets handed out.

## tease {shot: push into the cell · end card} (65–71 s)
vo: Next time: what this cell is *carrying*. About a billion passengers.

**Where each claim comes from**

| Beat | Sources |
|---|---|
| hook, change | S2 |
| normal | S1, S4 |
| why | S2: the cell changes shape without changing volume or surface area. S5: the parachute shape |
| whoa | S3, S6 |
| takeaway | S7: gas exchange happens in the capillary beds |
| tease | S8 and S9: 270 million × 4 ≈ 1.08 billion |

TODO: the account handle, a disclaimer if wanted, and a physiologist's sign-off.

## 9. Risks

**Accuracy**
- Figures vary by person and by source: alveoli count, lung and gut area, nerve speeds. Say "about", show ranges on screen, and cite the newest primary measurement.
- Flag the simplifications:
  - "Every 10 years" is an average.
  - Electrical synapses exist, so "most neurons don't touch" needs the word "most".
  - Whether veins look blue depends on how deep they are and on skin tone.
- Shots that compress scale are labelled "not to scale".

**Health (CARE)**
- Describe how the body works. No advice, no treatment or prevention claims, no "boost".
- **A clinician or physiologist reviews every script.** These episodes need particular care:
  - Ep 2: no talk of pulse oximeters.
  - Ep 6: no immunity claims.
  - Ep 7: heart-rate ranges are not a verdict on anyone's heart.
  - Ep 9: no osteoporosis or supplement talk.
- Medical questions in the comments get an "ask a clinician" reply (TODO: wording).

**Platform policy**
- **Medical misinformation:** TikTok and YouTube both have rules. Put the sources in each post description.
- **AI labelling:** turn on TikTok's AI label and write "voice: synthetic" in each post. Use YouTube's synthetic-content disclosure. Get a legal read on EU AI Act Article 50.
- **Imagery:** stylised cells only. No surgery, wounds or needles, which risk age restriction.
- **Flashes:** at most 3 a second.
- **Length:** over 60 s.

**Render**
- Motion inside an instanced mesh needs a `kFloor`, or the cells strobe.
- Metaballs (Ep 6 and Ep 9) are the heaviest block.
- Faked translucency may look plastic; approve it at the T2 stills.
- **The biggest risk is the daily cadence.** Three channels at about 3.5 h each is about 10.5 h of rendering a day. Keep a buffer of five finished episodes per channel.

**TODO placeholders:** channel name and handles; posting accounts; clinician reviewer; disclaimer; `pron.json`; Kokoro grades; checking each source link.