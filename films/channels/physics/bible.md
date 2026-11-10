# Series bible: the everyday physics channel

> **Channel name: Reality Rulebook** (the owner's rename, 2 Nov 2026; was Rest Frame). On screen from then on: the title series line "Reality Rulebook · No. …" and the end card. Older notes below keep the old name.

The proxy blocked direct page fetches, so I checked every source from its search-result excerpt. Each link needs opening once before anything posts (TODO). Scratch files are in `/tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/series/physics/`: the preset `restframe-bench.json` and the scripts `contrast.py`, `drag.py` and `test_preset.py`. Nothing in the repo was changed.

## 1. Channel name

| Option | Promise | Conflicts (web search, 2026-10-22) |
|---|---|---|
| **Rest Frame** (pick) | "Everyday things, slowed down until the physics shows." | None found. It is also a physics term: the frame in which an object is at rest |
| **Slow Enough** | "Slow anything down enough and it explains itself." | None found |
| **Equal & Opposite** | "The hidden pushes behind ordinary things." | No channel found, but the phrase is Newton's third law in common use, so it is a weak trademark |

TODO: check the handles, and search USPTO and EUIPO.

## 2. Look: "daylight lab"

This is the only light-background channel of the three. The set is a warm-paper backdrop curve (a cyc) ruled like a measuring board, lit like a high-speed photo studio. Body is green-black in Fraunces and space is navy in Unbounded. Nothing is taken from Lumevina, Los Güeros or Claude coral.

| Token | Hex | Role |
|---|---|---|
| `cyc` / `cyc-hi` | `#E6E2D8` / `#F1EEE7` | Background / the light pool behind the subject |
| `shade` | `#8A857B` | The cyc darkens to this under the apps' own UI (bottom 480 px, right 140 px) |
| `surface` | `#FFFDF7` | Label pills; caption plate at 92% |
| `ink` / `ink-2` | `#15171C` / `#4B505B` | Text / secondary text |
| `cobalt` (accent 1) | `#1F3BD1` | Forces, the accent word in the title |
| `marker` (accent 2) | `#FFD43B` | Highlighter band behind the word being spoken |
| Labels | force `#1F3BD1`, motion `#08805A`, energy `#B8321A`, wave `#6D3FC8`, pressure `#0B6F86`, ghost `#6E6A62` | Pill bar, leader line, arrows. The pill always names the quantity, so colour is never the only cue |

**Contrast (WCAG, computed):**

| Pair | Ratio |
|---|---|
| ink on cyc / cyc-hi / surface / marker | 13.9 / 15.5 / 17.6 / 12.6 |
| ink-2 on cyc / surface | 6.3 / 8.0 |
| cobalt on surface / cyc | 7.9 / 6.2 |
| Label colours as text on surface | 4.9–7.9 |
| Label colours as lines on cyc (3:1 needed) | 3.8–6.2 |
| ink on the caption plate over the darkest prop | 15.0 |
| The apps' white UI on `shade` | 3.7 |

**Type** (both SIL OFL 1.1, self-hosted WOFF2, shipped with `OFL.txt`):
- **Display: Archivo**, the variable version (width axis 62–125), set ExtraBold Expanded. Download: github.com/Omnibus-Type/Archivo.
- **Text: IBM Plex Sans**, 700 for captions at 60–64 px and 600 for labels, plus **Plex Mono** for counters and other numbers. Download: github.com/IBM/plex/releases. "Plex" is a Reserved Font Name, so the font files ship unmodified.

**Title card, "the drop":** the title falls onto a ruler line over the payoff image (y 250–470) and bounces twice on the sonic signature. Archivo's width axis squashes the letters on each contact, and three faint copies of the title trail above it.

**Motif, the strobe ladder:** each key motion is stamped as "ghost" copies at equal time steps on the ruled backdrop. Speeding up then shows as widening gaps you can measure. Small badges state the simplifications: `slowed ×20`, `air ignored`, `illustration`.

## 3. Sound

**"Precise and playful":** G mixolydian at 112.5 BPM, so a 16th note is exactly 4 frames. A dry studio room, felt piano ticking in eighths, low pads. The foley is hard and close: knocks, ticks and shutters, and no bells, because Lumevina and space both use bells. In scratch, `compose.score` renders this preset, and `compose.foley` renders every entry that uses a voice that already exists.

```json
{
  "_doc": "Rest Frame (everyday physics), 'precise and playful': G mixolydian at 112.5 BPM (a beat = 16 frames, a 16th = exactly 4 frames at 30 fps). Bright, dry, a little driven: a short studio room, felt piano in eighths as a ticking pulse, low pads, a sub only when energy rises. Foley is hard and close: knocks, ticks, shutters. The sonic signature is a ball bouncing to rest (signature: D6, B5, G5 at 0, +12, +20 frames). New voices: blip, knock, boing, shutter, ramp, hum. New event kinds for events.json: bounce, contact, strobe, time.slow, time.normal, spring, wave.on, heat, energy.loss, reveal, signature.",
  "name": "restframe-bench",
  "bpm": 112.5,
  "key": "G",
  "mode": "mixolydian",
  "scale": ["G", "A", "B", "C", "D", "E", "F"],
  "progression": [
    {"pad": ["G3", "D4", "A4", "B4"], "root": "G2"},
    {"pad": ["F3", "C4", "G4", "A4"], "root": "F2"},
    {"pad": ["C3", "G3", "D4", "E4"], "root": "C2"},
    {"pad": ["E3", "B3", "D4", "G4"], "root": "E2"}
  ],
  "layers": {
    "pad": {"gain": -19, "bright": 3400, "attack": 0.6, "release": 1.0},
    "felt": {"gain": -16, "bright": 6000, "octave": 1, "eighths_above": 0.35},
    "sub": {"gain": -22, "above": 0.5},
    "air": {"gain": -38}
  },
  "space": {"music": [0.9, 0.2], "foley": [0.45, 0.12], "dialog": [0.3, 0.04]},
  "drive": {"music": 1.25, "effects": 1.2, "dialog": 0.0},
  "foley": {
    "label": {"voice": "blip", "gain": -17, "notes": ["G5", "A5", "B5", "C6", "D6", "E6", "F6", "G6", "A6", "B6"]},
    "counter.show": {"voice": "blip", "gain": -19, "notes": ["G6"]},
    "counter.tick": {"voice": "tick", "gain": -22},
    "counter.end": {"voice": "chime", "gain": -13, "notes": ["G5", "D6", "B6"]},
    "section": {"voice": "whoosh", "gain": -29, "dur": 0.6, "lo": 400, "hi": 3200},
    "strobe": {"voice": "shutter", "gain": -24},
    "time.slow": {"voice": "ramp", "gain": -20, "dir": "down", "note": "G3"},
    "time.normal": {"voice": "ramp", "gain": -22, "dir": "up", "note": "G3"},
    "impact": {"voice": "knock", "gain": -10, "f0": 170},
    "bounce": {"voice": "knock", "gain": -14, "f0": 260},
    "contact": {"voice": "tap", "gain": -17, "bounce": [0.12, -26]},
    "drop.fall": {"voice": "whistle", "gain": -18},
    "drop.land": {"voice": "plop", "gain": -9, "f0": {"rain": 420, "big": 300}, "splash": -16},
    "spring": {"voice": "boing", "gain": -18, "note": "G3"},
    "wave.on": {"voice": "hum", "gain": -21, "note": "D4"},
    "heat": {"voice": "fizz", "gain": -22, "dur": 0.6},
    "zap": {"voice": "fizz", "gain": -16, "dur": 0.12},
    "energy.loss": {"voice": "dim", "gain": -17, "note": "G2"},
    "swell": {"voice": "swell", "gain": -15, "note": "G2"},
    "reveal": {"voice": "sparkle", "gain": -21, "notes": ["G6", "D7", "A6", "B6"]},
    "signature": {"voice": "knock", "gain": -11, "notes": ["D6", "B5", "G5"]}
  },
  "master": {"lufs": -14.0, "tilt": 0.0}
}
```

**New voices** (not yet in `instruments.py`):
- `blip`: a pitched sine with a third harmonic, like an instrument confirming a reading.
- `knock`: a ball hitting a bench: a thump that falls in pitch, a click and a woody body.
- `boing`: a released spring settling onto its note.
- `shutter`: two soft clicks 35 ms apart, one for each ghost stamp.
- `ramp`: a tape-stop or tape-start over 0.5 s, so you hear slow motion begin and end.
- `hum`: two slightly detuned sines beating at 0.5 Hz, for waves.

**New rows for `events.json`:** bounce (kFloor 8), contact, strobe, time.slow, time.normal, spring, wave.on, heat, energy.loss, reveal and signature.

**Sonic signature, "coming to rest":** `knock` on D6, B5 and G5 at 0, +12 and +20 frames. Each gap is 2/3 of the one before, like a ball with a restitution of 0.67 settling. The notes go fifth, third, root, so the motif lands home on G.

## 4. Narrator

| Voice | Why |
|---|---|
| **af_bella** (pick) | Graded A− in Kokoro's VOICES.md, the best grade left after af_heart. Bright and quick without sounding like an ad; run it at speed 0.95 |
| **am_puck** | C+. The most playful voice, but it makes more errors on long lines |
| **am_fenrir** | C+. Deeper and steadier, with less sparkle |

These grades come from memory and need re-checking (TODO). The draft body and space bibles both claim bf_emma, and their shortlists include am_michael, bm_george and af_nicole. This channel avoids all four.

**Audition line:** *"Which ball lands first? Slow it down twenty times and watch the gaps: one, three, five, seven… and both land on the same frame. Every time."*

## 5. The set: "the Bench"

One three.js r160 scene with a pure `window.seek(t)`, ready for the `cinema3d.js` finish. It is built in centimetres, so g = 981 cm/s². A 400 cm cyc curves from floor to wall, and a release rail sits 100 cm up. Throws travel at most 60 cm sideways, so they fit a 9:16 frame.

| Block | What it is | Motion, as a function of t | Label anchors |
|---|---|---|---|
| **B1 Stage** | The cyc (~2k triangles) with an unlit shader: light pool, `shade` falloff, ruled lines every 5 cm with numbers. Has a "Moon" dressing | Static; `grid(t)` fades the ruling | `gridPt(x, y)` |
| **B2 Clock** | Time warp: playback-rate keys (×1, ×1/20, ×4, freeze) integrated in closed form into physics time τ(t), plus a speed badge and a stopwatch | Every other block runs on τ | HUD slot |
| **B3 Props** | Props built from primitives, each ≤ 1.5k triangles, with blob shadows | Closed-form fall, throw, bounce series and spin; squash only as much as the real object squashes | Centre, contact point |
| **B4 Strobe** | Ghost copies stamped at fixed times τₖ = τ₀ + kΔ. One opaque InstancedMesh (≤ 48 copies) tinted toward the `cyc` colour, so no transparency sorting is needed. Optional rungs join ghosts with the same k | Each ghost pops in, then stays put | Ghost k |
| **B5 Vectors** | ≤ 32 instanced arrows with an ink outline | Length proportional to magnitude | Tail, tip |
| **B6 Oscillators** | Pendulum (exact period), spring of instanced coils, string; a pendulum-wave rig | θ(τ) and x(τ) in closed form | Pivot, bob |
| **B7 Wave field** | A 160 × 160 plane displaced by up to 8 wave sources that start at set times | Σ A·sin(kr − ωτ)·e^−αr | Source, node |
| **B8 Particles** | ≤ 2,000 instanced spheres: crystal lattice, liquid, or gas bouncing off the walls via a triangle-wave fold (exact, no simulation) | Seeded per particle | One hero particle |
| **B9 Zoom rungs** | Nested scales from centimetres to nanometres, a logarithmic dolly and a scale pill | s(t), keyed | Rung centre |
| **B10 HUD** | Skin School's captions, `pin()` labels with leader lines, counters, title and end cards | Read from `film.json` | — |

**Lighting:** a soft key light from above, front and left, a hemisphere fill, and a cool rim light from behind to separate the props from the pale ground. No shadow maps. Raise the bloom threshold to 1.6, and set the exposure so the rendered cyc comes out as `#E6E2D8`.

**Camera:** by default a locked **measure view**, square to the grid, with a long lens (portrait field of view 30–36°) and deep focus. Slider drifts of 2–5 cm/s. One 60–90° **turn** per episode, landing on a starred word. Macro pushes into contact moments at ×1/40 speed.

**Render budget:** 2,100 frames in 3–4 h allows 5.1–6.9 s per frame. Skin School would need about 6.8 s per frame at this size, so this set has to be cheaper:
- no shadow maps, no transmission, no transparent ghosts;
- slow motion keeps on-screen movement small, so the motion-blur sample count (K) stays at 2;
- real-time bursts stay under 1.5 s, with K capped at 12;
- the metaball liquid appears only in episode 8.

Check at the T2 stills: the median must be 6 s per frame or less.

**Blocks to share across all three channels:** B2 (a heartbeat at ×1/10, an orbit at ×10⁶), B5, B7, B8, B9 (body's iris zoom and space's scale ladder) and B10.

## 6. Episode template (66–72 s, 150–180 words)

| Beat | Seconds | Words | Job |
|---|---|---|---|
| hook | 0–4 | 8–11 | Question spoken and captioned by 2.0 s, over the payoff image |
| normal | 4–15 | 24–30 | The everyday event, slowed down and measured |
| change | 15–26 | 24–30 | Change one thing |
| why | 26–43 | 38–44 | The mechanism; 2 s with picture only |
| whoa | 43–56 | 20–28 | The surprise; 3 s with picture only |
| takeaway | 56–63 | 15–20 | One sentence |
| tease | 63–70 | 10–14 | Next episode's question; end card held ≥ 1.5 s |

## 7. Ten episodes

None of the first five needs a new block.

**1. Thrown or dropped?** "Which ball lands first?"
- *Takeaway:* sideways speed changes where a ball lands, never when.
- *Whoa:* four balls thrown at different speeds; every row of ghosts is level, and four knocks land on one frame.
- *Blocks:* B1–B5, B10. Nothing new.
- *Claims:*
  - When air drag is negligible, horizontal and vertical motion are independent. [OpenStax](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion)
  - Without air, heavy and light objects fall together at g ≈ 9.81 m/s². [OpenStax](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall)
  - Galileo (1638) described a throw as steady motion across plus an accelerating fall. [UVA](https://galileoandeinstein.phys.virginia.edu/tns244.htm)

**2. The swing's secret.** "Why does a swing take about the same time, high or low?"
- *Takeaway:* the length sets the timing, not the mass.
- *Whoa:* a pendulum wave, shown at ×4 speed with a badge saying so.
- *Blocks:* B1, B2, B4, B6, B10. Nothing new.
- *Claims:*
  - For small swings, T = 2π√(L/g); neither mass nor swing size appears. [HyperPhysics](https://hyperphysics.gsu.edu/hbase/pend.html)
  - Big swings take longer: 1.7% longer at 30° (I computed this from the exact period). [arXiv](https://arxiv.org/abs/physics/0510206)
  - Fifteen pendulums making 51–65 swings each line up again every 60 s. [Harvard](https://sciencedemonstrations.fas.harvard.edu/presentations/pendulum-waves)

**3. Where does the bounce go?** "Why can't a dropped ball bounce back to your hand?"
- *Takeaway:* each bounce turns some motion into sound, vibration and heat. The energy moves somewhere else; it isn't destroyed.
- *Whoa:* a tennis ball dropped on top of a basketball flies far above its drop height. In the ideal case it reaches about 7× (computed).
- *Blocks:* B1–B5, B8–B10. Nothing new.
- *Claims:*
  - Restitution is rebound speed divided by impact speed. The lost energy goes into sound, vibration and heat. [McMaster](https://ecampusontario.pressbooks.pub/physics1a03/?p=299)
  - Energy is conserved. [OpenStax](https://openstax.org/books/university-physics-volume-1/pages/8-3-conservation-of-energy)
  - The heavy ball hands its momentum to the light one. [SMU](https://demos.smu.ca/demos/mechanics/143-double-ball-drop), [Iowa](https://instructional-resources.physics.uiowa.edu/1n3060-tennis-ball-and-basketball)

**4. The hammer and the feather.** "Does a hammer fall faster than a feather?"
- *Takeaway:* without air, everything falls together.
- *Whoa:* the set's Moon dressing restages Apollo 15's drop.
- *Blocks:* B1–B5, B10. Nothing new.
- *Claims:*
  - In 1971 David Scott dropped a 1.32 kg hammer and a falcon feather on the Moon, and they landed together. [NASA](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_15_feather_drop.html)
  - The Moon's surface gravity is 1.62 m/s², 0.165 of Earth's. [NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
  - Drag grows with air density, the square of speed, size and shape. [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
  - Only Viviani's account places Galileo's drop at the Leaning Tower, so we don't present it as fact. [Physics World](https://physicsworld.com/a/the-legend-of-the-leaning-tower/)

**5. The spinning chair.** "Why do you spin faster with your arms in?"
- *Takeaway:* angular momentum stays fixed, so mass pulled closer to the axis has to turn faster.
- *Whoa:* seen from above, the gaps between ghosts widen: 2.8× faster (computed for 2 kg weights pulled from 80 cm to 20 cm).
- *Blocks:* B1–B5, B10, plus a chair prop (a prop, not a new block).
- *Claims:*
  - With negligible torque, Iω stays constant, and the extra spin energy comes from the work of pulling in. [OpenStax](https://openstax.org/books/university-physics-volume-1/pages/11-3-conservation-of-angular-momentum)
  - A point mass adds mr² to the moment of inertia I. [OpenStax](https://openstax.org/books/university-physics-volume-1/pages/10-4-moment-of-inertia-and-rotational-kinetic-energy)
  - Friction at the pivot is the small torque that finally stops you (OpenStax 11.3, the first link above).

**6. The ten-metre straw.** "What actually lifts your drink up a straw?"
- *Takeaway:* you lower the pressure inside the straw, and the air outside pushes the drink up.
- *Whoa:* in a straw three storeys tall, the water stops at about 10 m.
- *Blocks:* B1, B3, B5, B8, B10. New: a liquid column and a glass shader.
- *Claims:*
  - Standard sea-level air pressure is 1013.25 hPa. [NOAA](https://www.noaa.gov/jetstream/atmosphere/air-pressure)
  - Air can only push; a straw works because you lower the pressure inside it. [IPM](https://www.ipm.org/show/amomentofscience/2023-11-21/air-pressure-and-drinking-straws)
  - Suction pumps stalled near 10 m, and Torricelli's mercury column stood about 76 cm high. [APS](https://www.aps.org/apsnews/2012/10/torricelli-demonstrates-existence-vacuum) The 10.3 m limit is computed from 101,325 Pa.

**7. Why ice floats.** "Why does ice float on the water it's made of?"
- *Takeaway:* freezing locks water molecules into an open lattice that is about 9% less dense than liquid water.
- *Whoa:* a zoom into the hexagonal lattice, then out to an iceberg with nine-tenths of it hidden underwater.
- *Blocks:* B1, B3, B7–B10. New: water molecules and a glass shader.
- *Claims:*
  - Freezing lowers water's density by about 9%, and about 10% of an iceberg shows above water. [USGS](https://www.usgs.gov/water-science-school/science/water-density)
  - Water is densest near 4 °C, so lakes freeze from the top down. [Britannica](https://www.britannica.com/question/When-is-water-the-most-dense)
  - Ice at 0.917 g/cm³ floats about 89% submerged in seawater (computed).

**8. What shape is a raindrop?** "What shape is a falling raindrop?"
- *Takeaway:* not a teardrop. Air flattens the bigger drops, and the biggest ones burst.
- *Whoa:* a drop balloons into a parachute shape and shatters.
- *Blocks:* B2, B3, B5, B8, B10. New: a drop morph, and B11 Liquid using `metaballs.js`.
- *Claims:*
  - Small drops are spheres; bigger ones look like the top of a hamburger bun. [NASA GPM](https://gpm.nasa.gov/science/anatomy-of-a-raindrop)
  - Beyond about 4.5 mm, drops turn parachute-shaped and break up. NASA and USGS disagree on whether that figure is a diameter or a radius, so no number goes on air. [USGS](https://www.usgs.gov/water-science-school/science/are-raindrops-shaped-teardrops)
  - The largest drops fall at about 10 m/s, the speed where drag balances weight. [NASA GPM](https://gpm.nasa.gov/resources/faq/how-fast-do-raindrops-fall), [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/termvel/)

**9. Chocolate measures light.** "Can a chocolate bar measure the speed of light?"
- *Takeaway:* microwaves form standing waves in the oven, so the melted spots sit half a wavelength apart. Wavelength × frequency is the speed of light.
- *Whoa:* 6.1 cm × 2 × 2.45 GHz ≈ 2.99 × 10⁸ m/s (computed).
- *Blocks:* B5, B7, B8, B10. New: an oven prop and a melt map.
- *Claims:*
  - The melted spots are half a wavelength apart, and wavelength × frequency = c. [Jefferson Lab](https://education.jlab.org/frost/speed_of_light.html)
  - 2.45 GHz is not a resonant frequency of water. [WTAMU](https://www.wtamu.edu/~cbaird/sq/2014/10/15/why-are-the-microwaves-in-a-microwave-oven-tuned-to-water/), [HyperPhysics](https://hyperphysics.gsu.edu/hbase/Waves/mwoven.html)
  - Metal reflects microwaves and food absorbs them [FDA](https://www.fda.gov/Radiation-EmittingProducts/ResourcesforYouRadiationEmittingProducts/ucm252762.htm). Microwaving does not make food radioactive [EPA](https://www.epa.gov/radtown/non-ionizing-radiation-used-microwave-ovens).

**10. The snapped straw.** "Why does a straw look snapped in water?"
- *Takeaway:* light bends as it leaves the water, and your eye traces it back along a straight line, to the wrong place.
- *Whoa:* a hidden coin rises into view as water is poured in.
- *Blocks:* B1, B3, B10. New: B12 Rays (light rays obeying Snell's law, with each object drawn where it appears rather than where it is) and a glass shader.
- *Claims:*
  - Light in water travels at c/1.333, about 225,000 km/s (computed). [OpenStax](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction)
  - The eye traces rays back in straight lines, so the straw's tip looks shallower than it is. [U Sydney](https://www.physics.usyd.edu.au/super/physics_tut/activities/Waves_and_Optics/Bent_Pencil.pdf)
  - Water bends the light from the coin up toward the eye. [IOP Spark](https://spark.iop.org/reappearing-coin)

## 8. Episode 1 script

# Rest Frame No. 001: "Thrown or dropped?" (draft; fact-check before posting)

About 68 s, synthetic voice (labelled as AI), 162 words. `*Starred*` words get a camera landing or a sound hit. `{…}` is direction for the compiler, not spoken.

## hook {shot: measure view · frame 0: two balls mid-fall, ghosts level · title drop · badge: slowed ×20} (0–4 s)
vo: Which ball lands *first*? One thrown sideways, one just dropped.

## normal {shot: reset, slider · events: time.slow, strobe every 1/20 s · labels: "1/20 s apart", "gravity"} (4–15 s)
vo: Here's a drop, slowed twenty times. The ghosts are a twentieth of a second apart, and the gaps keep *growing*. A falling ball speeds up the whole way down.

## change {events: second ball thrown from the rail, two bounces on one frame} (15–26 s)
vo: Now throw a second ball sideways, at the same instant, from the same height. It sails across the bench… and lands on the *same frame*.

## why {shot: the turn · vectors: equal gravity arrows, constant sideways arrow · 2 s picture-only} (26–43 s)
vo: Gravity pulls both balls *down* the same way. The throw adds only sideways speed. Galileo showed in 1638 that a throw is two motions: a steady glide across, plus a fall. So at every tick, both sit at the *same height*.

## whoa {shot: pull back · events: throws at 1×, 2×, 3×, rungs across four trails, four knocks · 3 s picture-only} (43–56 s)
vo: Throw it twice as hard. Three times. It lands farther every time, and always on the *same frame*. Every row of ghosts is *level*.

## takeaway {shot: hold · badge: air ignored (under 1 ms here)} (56–63 s)
vo: Sideways speed changes *where* a ball lands, never *when*. For a level throw, only the height sets the clock.

## tease {end card 2 s · signature} (63–70 s)
vo: Next: why a big swing and a small swing take almost the *same time*.
end card: "Next: the swing's secret" · "Follow Rest Frame"

**Sources by beat:**
- normal: [1].
- change, whoa and takeaway: [2]. Flight time does not depend on sideways speed, and range is speed × time.
- why: [1], [2], [3].
- tease: [4], [5].
- "Same frame" in real air: drag delays a tennis ball thrown at 1.3 m/s by 0.3 ms, which is under one frame even at ×1/20 (computed in `drag.py`).

[1] [OpenStax 3.5](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall) · [2] [OpenStax 4.3](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion) · [3] [UVA](https://galileoandeinstein.phys.virginia.edu/tns244.htm) · [4] [HyperPhysics](https://hyperphysics.gsu.edu/hbase/pend.html) · [5] [arXiv](https://arxiv.org/abs/physics/0510206)

## 9. Risks

**Accuracy.** These misconceptions are avoided:
- heavier things fall faster;
- a thrown ball stays up longer than a dropped one;
- a pendulum's period ignores swing size exactly;
- energy is "lost" in a bounce;
- Galileo's Pisa tower drop as fact;
- straws "suck" the drink up;
- teardrop-shaped raindrops;
- microwaves "tuned to water", cooking "from the inside out", or making food radioactive.

Every simplification gets an on-screen badge. Still open: the raindrop breakup size, the 7× stacked-ball figure and the Kokoro voice grades. A physicist signs off each script before it posts.

**Platform policy (CARE):**
- AI labelling: TikTok's AI-generated toggle, "voice: synthetic" in the post, YouTube's synthetic-content disclosure, and EU AI Act Article 50.
- Episodes 3 and 9 show safety notes on screen: no metal in the microwave, short bursts, faces kept clear of the bounce.
- No firearms: the classic bullet-drop comparison is left out on purpose.
- The strobe motif never flashes: fewer than 3 bright events per second.
- Original score, OFL fonts, no brand marks on props. On YouTube, mark the channel "not made for kids".

**Hard to render:**
- A pale background under ACES tone mapping and bloom.
- The apps' white UI over light frames: check the `shade` falloff with a private test upload.
- Sideways throws in a narrow 9:16 frame.
- The feather's thin vane under motion blur.
- Glass without the costly transmission material.

TODO placeholders: the channel handle, the trademark search, a pinned sources page, the reviewing physicist, the posting accounts.

## Packaging: titles and thumbnails (owner's standing rule, 10 Nov 2026; copied from films/channels/PACKAGING.md on claude/made-with-claude-film)

Applies to every NEW episode, short and long video on the four active channels: **Skin Sense, Reality Rulebook,
Possibility Lab, One More Orbit**. Body Backstage is paused and excluded.

The goal: a title and thumbnail that make a scroller think "wait... what? I need to know why", that are
completely true, and that the video fully pays off. Borderline clickbait in feeling, never in fact.

### The deliverable (per episode or long video)

Write `out/packaging.json` in the episode folder (for a long video: `compilations/<name>/packaging.json`) and render
the winning thumbnail in code. Prism reads `packaging.json` and shows the winner title and the ChatGPT prompt with
copy buttons, and uses the winner title as the YouTube title.

```json
{
  "version": 1,
  "format": "long | short",
  "hook": "the single most surprising, true fact in the script (one sentence)",
  "titles": [
    { "text": "...", "mechanism": "knowledge gap | contradiction | hidden mechanism | unexpected consequence | scale shock | unanswered question | visual paradox | personal relevance" }
  ],
  "thumbnails": [
    { "id": "A", "subject": "...", "composition": "...", "lighting": "...", "trigger": "...", "text": "0-4 words, or empty", "complements": "how it pairs with the title without repeating it" }
  ],
  "pairings": [
    { "title": 0, "thumbnail": "A",
      "scores": { "scroll": 0, "curiosity": 0, "clarity": 0, "synergy": 0, "originality": 0, "accuracy": 0, "mobile": 0, "satisfaction": 0 },
      "note": "..." }
  ],
  "winner": { "title": "exact final title", "thumbnail": "A", "thumbnailText": "", "why": "one or two sentences" },
  "testAndCompare": ["A", "B", "C"],
  "checks": { "halfSecond": true, "curiosity": true, "duplication": true, "competition": true, "truth": true, "satisfaction": true, "originality": true },
  "thumbnailFile": "<file name of the rendered winner in out/>",
  "chatgptPrompt": "a complete, self-contained image prompt for ChatGPT (see below)",
  "shortsCover": { "frameSeconds": 0.0, "text": "0-4 words" }
}
```

Five titles, three thumbnail concepts, three pairings. Scores are 1-100 creative judgments, **not CTR predictions**;
say so wherever they are shown. A check that fails means revise before rendering, never ship with a false.

### The workflow

1. **Hook.** Read the whole script and pick the single most surprising, counterintuitive fact the video proves.
2. **Five titles,** each on a different curiosity mechanism (list above).
3. **Three thumbnail concepts:** subject, exact composition, lighting and treatment, the emotional trigger,
   optional text (1-4 words), how it complements the title.
4. **Pair** titles with thumbnails and keep the three strongest pairs, judged as pairs.
5. **Score** each pair on the eight axes.
6. **Pick the winner** and say why in one or two sentences.
7. **Produce:** render the winner thumbnail in code at full quality, and write the ChatGPT prompt for it.

### Titles

- Short and front-loaded: aim for 35-55 characters, strongest words first, readable by a sixth grader.
- One dominant curiosity trigger. Natural, conversational. Questions or flat statements ("The Moon Starts
  Coming Closer. It Won't Stop.") both work.
- **The YouTube title is the winner title alone.** No "| Channel · Season · Episode" suffix: the series line lives
  in the description.
- Never generic ("5 Amazing Facts About Skin", "The Science Behind Gravity").
- Every word must be true of THIS video. Thought experiments keep their "What if" or are clearly hypothetical.

### Thumbnails

- One unmistakable focal point, strong hierarchy, intentional light and depth, generous negative space.
- Pass the **0.5-second test** at phone size (check it at 168x94 px).
- **Never repeat the title.** The thumbnail is the visual mystery and the title is the question or consequence.
  Thumbnail text is optional, 1-4 words, and adds a new layer.
- No clutter: no arrows, red circles, shocked faces or generic YouTube clichés. Every element earns its place.
- No series line, badges or episode chip on the thumbnail. An honesty label goes on only when the image would
  otherwise read as a real photo or measurement.
- Don't recycle a composition from the previous three episodes on the channel.
- **Long video:** 16:9, render 2560x1440 and export a 1920x1080 JPG under 2 MB (YouTube's custom-thumbnail limit).
- **Shorts, TikTok and Reels:** 9:16 cover, 1080x1920, focal point and text inside the centre safe area (clear of
  the bottom 25% and the right-hand buttons). The platform cover is a frame of the video on most surfaces, so
  `shortsCover.frameSeconds` names a frame that works as a thumbnail. The 9:16 cover JPG goes in out/ as now.

### Truth rules (non-negotiable)

- The picture shows what the video shows or explains: no event, object or scale the video does not deliver.
- No invented findings, no manufactured danger, no exaggeration past the evidence.
- A code-rendered or AI-generated image is never presented as a photograph of a real event or object. Mark it
  "Illustration" when it could pass for a real photo or measurement.
- The video's own claims standards apply to the title and thumbnail text: if the script hedges, the title can't
  be absolute.

### Channel visual DNA (stay distinct, never one template for all)

- **Skin Sense:** premium medical-editorial. Ivory page, the painted or 3-D skin in the series' one skin tone,
  peach and rose, deep green accent `#00685F`, navy serif type. Surprising anatomical close-ups and hidden processes.
  No faces for acne topics (inside a pore only). No disease, risk or damage words over skin art. No products,
  brands, before/after or advice. AI illustrations disclosed.
- **Reality Rulebook:** physics that looks impossible. A daylight lab or an everyday room, one frozen moment
  (a splash crown, a bullet's shock cone, a light front), strobe ghost stamps, blue `#2F5BFF`. Clean and exact.
- **Possibility Lab:** an extraordinary but reasoned situation with you in it. A human-scale anchor against a
  dramatic consequence, one big readout number, magenta `#EB63FF` accents. The scenario must read as a thought experiment.
- **One More Orbit:** vast, beautiful, occasionally unsettling through real scale. Indigo night, teal light fronts,
  the light-time ring, violet `#5B3FD0`. No fabricated cosmic threats, and no render that could pass for a NASA photo.

### The ChatGPT prompt (`chatgptPrompt`)

A complete prompt the owner can paste into ChatGPT's image tool, for when an AI-painted thumbnail would beat the
code render. Write it in this shape:

```
Create a YouTube thumbnail, 16:9 (1920x1080) [or 9:16, 1080x1920 for a Short cover].
Subject: <one focal subject, described physically and accurately>.
Composition: <where the subject sits, scale, camera angle, negative space, rule-of-thirds placement>.
Lighting and treatment: <light direction, colour palette with the channel's hex colours, depth of field, texture>.
Mood: <the one emotion: wonder, disbelief, suspense>.
Text: <"exact 1-4 words" in <typeface style>, placed <where>> OR No text.
Scientific accuracy: <the facts the image must respect>.
Avoid: no arrows, circles, faces with exaggerated expressions, logos, watermarks, brand names, extra text,
or anything that looks like a real news or NASA photo.
Style: premium editorial science documentary, distinctive and art-directed, not generic AI art.
```

Image models garble long text, so keep the thumbnail text to 1-4 words, or add it afterwards in code.

### Learning loop

When real YouTube analytics exist, read impressions, CTR, traffic source, average view duration, 30-second retention
and satisfaction signals. Keep **measured** results apart from **hypotheses**. A higher CTR is not automatically
better: optimise for qualified clicks that turn into watch time. Use YouTube's Test & Compare with the three
thumbnails in `testAndCompare` when it is available on the account.

For this channel: applies to lf01 (long video + its two shorts) and compilations/s2. Episodes ep07-ep12 keep their existing covers. packaging.json goes in out/ (lf01/out/packaging.json; compilations/s2/packaging.json).

## Season format: one long film, eight parts (owner's decision, 10 Nov 2026; copied from films/channels/SEASON-FORMAT.md on claude/made-with-claude-film)

Applies to Reality Rulebook, One More Orbit and Possibility Lab from their next season on. Skin Sense stays
short-form (1:01-1:15 story shorts), but its seasons are 8 stories that share one thread, so a long film can be made
from them later. Body Backstage is paused and excluded.

Why: YouTube mid-roll ads need a video of at least 8:00. Every stitched Season 2 long video is 7:07-7:31, so none
qualified. Long-form watch hours are also what unlock the Partner Program (shorts views don't count toward the
4,000 hours).

### A season is one long film and its 8 parts

1. **Write the long film first, as ONE story.** One question that escalates and never resets (the day keeps
   shrinking, the Moon keeps coming, the second keeps slowing). Never glue finished shorts together, because every
   short ending is a place where viewers leave.
2. **8 chapters of about 65 s**, plus a short cold open and close, so the film runs **8:30-9:30** (never under 8:00).
3. **No chapter cards and no "1, 2, 3".** Each chapter ends on an open loop that the next chapter answers
   ("...and at twelve hours, it gets much stranger").
4. **Retention devices:**
   - a live number the viewer waits to see hit its end
   - a "wait, what?" twist at about 60%
   - the payoff in the last minute
   - a last shot that loops back to the first
5. **One scene, two renders:** 16:9 for the long film (2560x1440, plus the 1080p upload) and 9:16 for the parts
   (1080x1920, readouts relaid for portrait). Never stretch or crop one into the other.
6. **The 8 parts are the 8 chapters, cut from the 9:16 render.** Each part:
   - runs **1:01-1:15**, over a minute for TikTok Creator Rewards
   - opens with its own 2 s hook line in place of the long film's bridge line
   - ends with its cliffhanger line, then "Part N of 8. Full video on YouTube."
   - says "Part N of 8" once, at the end, not on screen the whole time (the declutter rule still applies)
7. **The ending belongs to the long film.** Part 8 stops just before the payoff. The climax or twist appears only
   in the long film.
8. **Packaging** (films/channels/PACKAGING.md): one packaging.json for the long film (16:9 thumbnail) and one per
   part (9:16 cover).
9. **Posting order** (the owner still posts by hand): the long film goes up first, so every part can link to it
   (YouTube Shorts' related-video link; "link in bio" elsewhere). Then one part a day.

### Files (so Prism imports and links everything)

- Long film: `films/channels/<channel>/compilations/<film-slug>/` with `<film-slug>-16x9.mp4`, the 1440p version,
  `description.md` (title line and chapter list), `packaging.json` and the thumbnail. Prism registers it as a long
  video ("lesson").
- Parts: the next free `films/channels/<channel>/epNN/` folders, one per part, each with script.md, claims.json,
  film.json, `out/` (the 9:16 final, cover and packaging.json) as for any episode.
- Prism links parts to the film only if each `description.md` chapter title matches a part's title exactly, so
  keep them identical.
- Push each with push-one.sh (`compilations/<film-slug>` or `epNN`), then POST the import.

### Voice

Reality Rulebook and One More Orbit keep the AI voice. Possibility Lab uses the owner's own voice: each film adds
8 hook lines and 8 cliffhanger/outro lines to the owner's recording script (films/channels/voice-scripts/), and
the AI voice stands in until the recordings land.

### Season 2

The Season 2 shorts finish their declutter re-renders and post as normal. The stitched Season 2 long videos that
are still being rebuilt (Reality Rulebook, One More Orbit) are **stopped**: they would stay under 8:00. Long videos
already in Prism stay as they are.

For this channel: Season 3 starts with lf01 (long film `compilations/lf01` + eight parts in the next free epNN folders). The compilations/s2 rebuild is dropped.
