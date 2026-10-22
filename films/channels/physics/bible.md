# Series bible: the everyday physics channel

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