# Series bible: space channel

## 1. Channel name

| Option | Web search, 2026-10-22 |
|---|---|
| **Light Minute** (pick) | Nothing by that name. Nearest: "Astronomy Minute" (podcast), "ESOcast Light" (ESO) |
| **Old Light** | None found; a common phrase, so a weaker brand |
| **Slow Orbit** | None found; nearest is the unrelated "Slow Ventures" |

TODO: check the handles (@lightminute) and trademarks; this search covered the open web only.

**Promise:** *One minute, one "whoa" about the universe, every number sourced.* The name is both the length of an episode and the motif.

## 2. Look

Space takes the cold end: indigo night, teal for light, lilac for gravity. No red, amber, gold or rose: Los Güeros, Lumevina and Claude coral own those, and the body channel needs the warm hues. Physics should avoid indigo and teal.

| Token | Hex | Role |
|---|---|---|
| `void` | `#080A1C` | Background |
| `void-top` | `#11163A` | Gradient top |
| `surface` | `#151A3D` | Caption plate (85%), pills |
| `text` | `#EEF0FF` | Captions, titles |
| `text-2` | `#A9B0D9` | Secondary, units, badges |
| `teal` (accent 1) | `#4FE3C6` | **Light:** fronts, rings, the spoken word |
| `lilac` (accent 2) | `#B9A6FF` | **Gravity:** orbits, grid, forces |
| `ice` (label) | `#8FD0FF` | Planets, moons, probes |
| `lemon` (label) | `#F2EDA6` | Star labels (the Sun renders white) |

Each label pill also carries a glyph (● body, ✦ star, ◯ light), so colour is never the only cue.

**Contrast (WCAG, computed):**

| Text | on void | on void-top | on surface |
|---|---|---|---|
| text | 17.3 | 15.5 | 14.9 |
| text-2 | 9.3 | 8.3 | 7.9 |
| teal / lilac / ice / lemon | 12.3 / 9.3 / 11.8 / 16.3 | — | 10.5 / 8.0 / 10.1 / 14.0 |

`void` text on accent chips gives the same ratios. Worst case is the plate over bloom (`#1B2045`): text 13.9, text-2 7.4.

**Type** (all SIL OFL 1.1, self-hosted WOFF2):
- **Display: Unbounded** (by NaN), weight 600, for titles; its wide, round letters echo orbits. https://github.com/googlefonts/unbounded
- **Text: Atkinson Hyperlegible Next** (2025), 700 at 64 px for captions. https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next
- **Counters: Atkinson Hyperlegible Mono**, with tabular figures so counters don't jitter. https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono
- Ship the Atkinson files unmodified, because they carry Reserved Font Names. If a sibling channel uses Atkinson, fall back to Lexend (OFL).

**Title card:** a band at y 250–470 over the payoff image. A teal ring closes on the sonic signature beside LIGHT MINUTE, with the question below. The end card is the same ring, large, around "Next: …".

**Motif: the light-time ring.** Each distance is a thin teal ring printed with its light-travel time ("1.3 s" Earth–Moon, "8 min 20 s" Sun–Earth). There is one per episode, and it is also the avatar. A second motif is the **honesty badges**: "not to scale", "time ×N", "analogy", "estimate".

## 3. Sound

"Vast and calm": E dorian at 75 BPM, so a 16th note is exactly 6 frames. Open pads sit in a long hall; the voice stays dry and close. Rule: **nothing booms in a vacuum**, so every effect is tonal. In a scratch test, `compose.score` and `compose.foley` rendered every entry that uses an existing voice.

```json
{
  "_doc": "Light Minute (space), 'vast and calm': E dorian at 75 BPM (a 16th = 0.2 s = exactly 6 frames at 30 fps). Slow open pads in a long hall, sparse felt piano, high glass bells for labels. Nothing booms in vacuum: every effect is tonal (bells, sweeps, sparkles), never an impact. Needs two new voices (glide, ping) and seven new event kinds in events.json (light.front, body.vanish, arrive, orbit.pass, scale.jump, probe.ping, merge).",
  "name": "lightminute-vacuum",
  "bpm": 75,
  "key": "E",
  "mode": "dorian",
  "scale": ["E", "F#", "G", "A", "B", "C#", "D"],
  "progression": [
    {"pad": ["E3", "B3", "D4", "F#4"], "root": "E2"},
    {"pad": ["A2", "E3", "B3", "C#4"], "root": "A1"},
    {"pad": ["D3", "F#3", "A3", "E4"], "root": "D2"},
    {"pad": ["B2", "F#3", "A3", "E4"], "root": "B1"}
  ],
  "layers": {
    "pad": {"gain": -14, "bright": 2000, "attack": 2.4, "release": 3.0},
    "felt": {"gain": -21, "bright": 3600, "octave": 1, "eighths_above": 0.7},
    "sub": {"gain": -24, "above": 0.55},
    "air": {"gain": -36}
  },
  "space": {"music": [3.6, 0.38], "foley": [2.2, 0.3], "dialog": [0.4, 0.05]},
  "drive": {"music": 0.8, "effects": 0.9, "dialog": 0.0},
  "foley": {
    "label": {"voice": "bell", "gain": -17, "notes": ["B5", "C#6", "D6", "E6", "F#6", "G6", "A6", "B6", "C#7", "D7"]},
    "counter.show": {"voice": "bell", "gain": -19, "notes": ["E6"]},
    "counter.tick": {"voice": "tick", "gain": -23},
    "counter.end": {"voice": "chime", "gain": -12, "notes": ["E5", "B5", "F#6"]},
    "section": {"voice": "whoosh", "gain": -31, "dur": 1.2, "lo": 90, "hi": 700},
    "swell": {"voice": "swell", "gain": -15, "note": "E3"},
    "light.front": {"voice": "sparkle", "gain": -24, "notes": ["E7", "B6", "F#7", "C#7"]},
    "body.vanish": {"voice": "dim", "gain": -14, "note": "E3"},
    "arrive": {"voice": "chime", "gain": -14, "notes": ["E4", "B4", "E5"]},
    "orbit.pass": {"voice": "bell", "gain": -22, "notes": ["B4"]},
    "scale.jump": {"voice": "glide", "gain": -18, "note": "E3", "interval": 19},
    "probe.ping": {"voice": "ping", "gain": -20, "f": 1100, "echo": [0.25, -9]},
    "merge": {"voice": "swell", "gain": -13, "note": "B2"}
  },
  "master": {"lufs": -14.0, "tilt": 0.0}
}
```

**New voices:**
- `glide`: two detuned sines slide by `interval` semitones, upward when zooming out, with a sin² swell. Its end lands on the frame, as `whistle` does.
- `ping`: a radio carrier. A 60 ms blip at 1.1 kHz with two echoes 0.25 s apart, each 9 dB down.

**New `events.json` rows:** light.front, body.vanish, arrive, orbit.pass, scale.jump, probe.ping, merge. `scale.jump` needs kFloor 12: zooming by scaling the world moves no object origins, so the motion probe sees nothing.

**Sonic signature:** E5 → B5 → F#6 on bells, 6 frames apart. It is root, fifth and ninth with no third, so it sounds like a question opening. It plays on the title ring and as `counter.end`. Set `duck_db` to −10.

## 4. Narrator

| Voice | Why |
|---|---|
| **bf_emma** (first choice) | British female, grade B−, the best grade after af_heart and af_bella. Unhurried planetarium register, crisp numbers |
| **am_michael** | American male, C+. Warm and steady, but flattens questions |
| **bm_george** | British male, C. Documentary timbre, more artifacts |

The grades are Kokoro's estimates of training-data quality (from VOICES.md, read via mirror sites), not listening scores. No two channels should share a voice.

**Audition line:** *"If the Sun vanished, when would you know? Not for eight minutes and twenty seconds. And Proxima Centauri? Four point two four years away."*

## 5. The set: "the Orrery"

One three.js r160 scene with a pure `window.seek(t)`, ready for `cinema3d.js`. Scale lives in **rungs**, one `THREE.Group` per scale (1 unit = 1,000 km, 1 million km, 0.1 ly or 1,000 ly). The subject sits at the origin and the camera stays within 0.1–1,000 units, so float32 precision never jitters.

| Block | What | Animation, f(t) | Anchors |
|---|---|---|---|
| **B1 Sky** | 6,000 points at infinity in one draw, coloured by temperature, plus a baked Milky Way band | Follows the camera; no twinkle | Named stars |
| **B2 Body** | A sphere with a baked surface, a terminator, a Fresnel rim and a teal **meridian pin** that shows spin | rot = 2π(t−t0)/P (P < 0: retrograde) | Centre, pin, limb |
| **B3 Star** | Emissive, limb-darkened, granulated, with a corona sprite. The Sun is white | Granulation ∝ t; vanishing is a one-frame pop | Centre, limb |
| **B4 Orbit** | A Kepler ellipse as a 2 px ribbon with a trail (fixed 6-step Newton solve). In "free" mode, after gravity is cut, the body moves on p₀+v₀(t−t₀) | M = 2π(t−t0)/P_screen | Body, perihelion |
| **B5 Light front** | An additive ring and shell, or a photon dash | r = c_screen·(t−t_emit) | Leading edge |
| **B6 Gravity grid** | A 160² plane sunk by −Σk·M/√(r²+ε²), with procedural lilac lines and an "analogy" badge | Each mass is felt late, M(t−r/c_screen), so a change ripples out at light speed | Well, ring |
| **B7 Vectors** | Up to 64 instanced arrows, length ∝ magnitude | Per shot | Tips |
| **B8 Scale ladder** | Log zoom with crossfading rungs, plus a DOM ruler with a light-time readout | d = d0·10^s(t) | Ticks |
| **B9 Galaxy** | 40k points: arms, bulge, dust, and "You are here" 26,000 ly from the centre | Rigid rotation, so the arms don't wind up | Sgr A*, Sun |
| **B10 HUD** | Word-lit captions, leader-line labels, counters, badges, the end card | From `film.json` | — |

**Lighting:** one key light, the star (a DirectionalLight aimed at the subject), plus a 4% `void` hemisphere fill so night sides keep their shape. No shadows. Only stars, light fronts and the kilonova bloom (threshold 0.9); text never does.

**Camera:** a telescope mount, never handheld. Five moves:
- **diagram view:** locked, 60–75° above the orbital plane;
- **drift:** at most 5% a second;
- **orbit arc:** at most 6° a second;
- **rack focus:** only when something is near the lens;
- **scale jump:** one per episode.

Field of view is 18–28° for planets and 40–50° for galaxies. Subjects sit at y 300–1100, captions at y 1170–1420.

**Budget:** 2,100 frames in 3–4 h allows 5–6.8 s a frame, and the Skin School scene would take about 6.8 s at 1080×1920. So frames stay mostly empty:
- points instead of meshes, and baked textures;
- no transmission, shadow maps or environment maps;
- depth of field off in wide shots;
- slow moves, so K stays at 2;
- kMax 12, with at most 3 s of scale jump per episode;
- caps of 6k sky, 40k galaxy and 5k ejecta points.

Measure every shot at T2 first.

**Shared by all three channels** (re-skinned): B5 (wave fronts), B7 (vectors), B8 (scale ladder: cell → organ, atom → planet) and B10 (HUD). Physics can also use B4 and B6.

## 6. Episode template (66–72 s, 150–180 words)

| Beat | Seconds | Words | Job |
|---|---|---|---|
| Hook | 0–4 | 8–12 | Payoff image at frame 0. The question (≤ 9 syllables) is spoken by about 2.0 s and shown on screen |
| Normal | 4–15 | 25–30 | The everyday picture, with labels and a ring |
| Change | 15–28 | 25–32 | One thing changes |
| Why | 28–43 | 30–38 | The mechanism and one dated fact, then 2 s of picture only |
| Whoa | 43–57 | 20–28 | The scale jump or impossible image, then 3 s of picture only |
| Takeaway | 57–64 | 12–18 | One sentence that comes back to the viewer |
| Tease | 64–70 | 8–12 | "Next: …", end card held at least 1.5 s |

## 7. Ten episodes

Episode 1 builds B1–B6 and B10. `[est.]` marks an estimate; the rest is established fact. The proxy blocks fetching pages, so every source was checked through search-result excerpts.

| # · title | Hook (first 2 s) | Takeaway | Whoa | Blocks (new) |
|---|---|---|---|---|
| 1 · Sun gone | "If the Sun vanished, when would you know?" | Light and gravity share one speed limit | Earth circles an empty point until the gravity ring reaches it, then leaves in a straight line | B1–B6, B10 (none) |
| 2 · Venus day | "Can a day last longer than a year?" | Venus turns once in 243 days, orbits in 225, and spins backwards | The year counter wins the race; the Sun rises in the west | B1–B4 (none) |
| 3 · Falling Moon | "Why doesn't the Moon fall down?" | It is always falling, and always missing | A straight ghost path beside the real one, the gap magnified 10⁶×: 1.36 mm a second | B2, B4 (**B7**) |
| 4 · Sun size | "How big is the Sun, really?" | 1.3 million Earths fit inside what is still an average-sized star | Earths pour in as beads; pull back until the Sun is one star of many | B2, B3 (**B8**) |
| 5 · Your speed | "How fast are you moving right now?" | Hundreds of km every second | One scale jump, street to galaxy, with the speeds stacking up | B4, B8 (**B9**) |
| 6 · Nearest star | "How long to reach the nearest star?" (post on **18 Nov 2026**) | After 49 years Voyager 1 is one light-day out; Proxima is about 1,549 light-days away | A light-day ring that shrinks to a speck at 4.24 ly | B3, B5, B8 (**probe**) |
| 7 · Trees or stars | "More trees on Earth, or stars in our galaxy?" | Trees, by 8 to 30 times | The galaxy's stars become trees; Earth's forests overflow it | B2, B9 (**tally sprites**) |
| 8 · Dark sky | "Why is the night sky dark?" | The stars haven't been shining forever | A sightline of stars ramps toward white; a 13.8-billion-year limit puts the far ones out | B1, B5 (**star forest**) |
| 9 · Your gold | "Where did the gold in your ring come from?" | Probably from dead stars colliding | Two neutron stars merge; a cooling cloud throws a bead into a ring | B3, B4 (**merger kit**) |
| 10 · Black-hole edge | "What happens at the edge of a black hole?" | Escape there needs more than light speed, and outsiders see your clock freeze | Split screen: the faller's clock runs on while the watcher sees it freeze | B4, B8 (**lensing, disk**) |

**Claims:**
1. Sunlight takes about 8 min 20 s to cross 150 million km: https://howthingsfly.si.edu/ask-an-explainer/how-long-does-it-take-light-sun-get-earth · Earth's orbital speed is 29.78 km/s: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html · GW170817 (2017): gravitational waves and gamma rays from about 130 million ly away arrived 1.7 s apart, so gravity travels at c to within about 10⁻¹⁵: https://ligo.org/science-summaries/GW170817GRB/ · With no force acting, an object moves in a straight line: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/
2. Venus takes 243.0 days to spin once, backwards; its year is 224.7 days, and sunrise to sunrise takes 116.75 days: https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html · The Sun rises in the west there: https://spaceplace.nasa.gov/all-about-venus/en/ · Radar gives 243.0226 days, varying by minutes (2022): https://ntrs.nasa.gov/citations/20220003058
3. The Moon is 384,400 km away, moving at 1.022 km/s: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html · From those figures it falls 1.36 mm a second (my own ½v²/r calculation) · An orbit is falling while moving sideways: https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-an-orbit-grades-5-8/
4. 1.3 million Earths would fit inside by volume, and it outweighs more than 330,000: https://science.nasa.gov/sun/facts/ · 109 Earths across, and an average-sized star: https://spaceplace.nasa.gov/sun-compare/en/ · 99.8% of the solar system's mass: https://www.nasa.gov/solar-system/its-surprisingly-hard-to-go-to-the-sun/
5. The equator turns at 1,675 km/h: https://spaceplace.nasa.gov/launch-windows/en/ · The Sun circles the galaxy at about 828,000 km/h, once in about 230 million years [est.]: https://science.nasa.gov/solar-system/ · We move at 369.82 km/s relative to the cosmic microwave background, assuming its dipole comes only from our motion [est.] (Planck 2018): https://arxiv.org/pdf/1807.06205
6. Proxima is about 4.24 ly away: https://science.nasa.gov/exoplanets/other-stars-other-worlds/our-nearest-celestial-neighbor-an-exotic-3-star-system/ · Voyager 1 reaches one light-day (25.9 billion km) on 18 Nov 2026: https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/ · At about 17 km/s it would need more than 73,000 years to reach Proxima: https://imagine.gsfc.nasa.gov/features/cosmic/nearest_star_info.html
7. About 3.04 trillion trees (*Nature* 2015): https://www.nature.com/articles/nature14967 · 100–400 billion stars [est.]: https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/ · The star count is modelled from the galaxy's mass, not counted: https://asd.gsfc.nasa.gov/blueshift/index.php/2015/07/22/how-many-stars-in-the-milky-way/
8. In an endless, eternal universe every line of sight would end on a star (Olbers' paradox): https://www.britannica.com/science/Olbers-paradox · The universe is 13.787 ± 0.020 billion years old (Planck 2018): https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_science_highlights · Stars' finite lifetimes are the main reason the sky is dark: https://arxiv.org/pdf/astro-ph/0007428
9. The r-process makes about half the elements heavier than iron, gold among them: https://assets.science.nasa.gov/content/dam/science/astro/programs/cosmic-origins/documents/uv-vis-study-2012/submissions/03.Lawler.pdf · The GW170817 kilonova glowed from decaying heavy elements: https://www.nasa.gov/image-article/unfolding-story-of-kilonova-told-x-rays/ · Whether mergers or supernovae and magnetars are the main source is still debated [est.] (2025): https://arxiv.org/pdf/2503.13426
10. At the event horizon, escape speed equals c: https://svs.gsfc.nasa.gov/vis/a010000/a013300/a013322/black_hole_safety_brochure_web_final.pdf · Seen from afar, a fall freezes at the horizon, and at a supermassive black hole you'd cross it before being torn apart (2024): https://science.nasa.gov/universe/black-holes/supermassive-black-holes/new-nasa-black-hole-visualization-takes-viewers-beyond-the-brink/ · Sgr A* has about 4 million solar masses and is 27,000 ly away (EHT 2022): https://www.eso.org/public/images/eso2208-eht-mwe/

## 8. Episode 1 script

```
# Light Minute No. 001: "If the Sun vanished" (draft; fact-check before posting)

## hook {shot: diagram view · frame 0: Sun gone, teal front mid-flight, Earth curving · badge: thought experiment} (0–4 s)
vo: If the Sun vanished, when would you *know*? Not right away.

## normal {shot: rewind, slow arc · labels: Sun, Earth · ring "8 min 20 s"} (4–16 s)
vo: Rewind to normal. Earth circles the *Sun* about a hundred and fifty million kilometers out, at nearly thirty kilometers every second. Sunlight crosses that gap in about *eight minutes and twenty seconds*.

## change {events: body.vanish, light.front, counter 0:00 → 8:20} (16–27 s)
vo: Now switch the Sun *off*. Its last light is still on the way to us. For eight minutes and twenty seconds, your sky looks *exactly the same*.

## why {shot: gravity grid; the well flattens outward · 2 s picture-only} (27–44 s)
vo: Gravity doesn't update instantly either. Changes in gravity travel at the *speed of light*. In twenty seventeen, gravitational waves and light from a neutron-star collision crossed a hundred and thirty million light-years and arrived less than *two seconds* apart.

## whoa {events: arrive; Earth leaves on its tangent · 3 s picture-only} (44–57 s)
vo: So for eight minutes, Earth keeps *circling* a Sun that isn't there. Then the news *arrives*, and Earth sails off in a *straight line*.

## takeaway {shot: pull back to the light-time ring} (57–65 s)
vo: Light and gravity share one speed limit. So everything you see in the sky is *old news*. Even the Sun.

## tease {end card held ≥ 1.5 s · signature} (65–70 s)
vo: Next: a planet where one day lasts longer than its *year*.
```

164 spoken words: about 70 s at 2.4–2.7 words a second.

**Sources:**
- **normal:** Smithsonian (claim 1). NASA gives 8.35 light-minutes: https://science.nasa.gov/earth/facts/. The 29.78 km/s is from NSSDC.
- **change, takeaway:** we see things as they were when their light left: https://spaceplace.nasa.gov/light-year/en/
- **why:** LIGO (claim 1).
- **whoa:** inferred from LIGO plus Newton's first law. It is a thought experiment: mass can't vanish, and the other planets are ignored.
- **speed limit:** https://www.nist.gov/si-redefinition/meter
- **tease:** Venus (claim 2).

## 9. Risks

**Accuracy**
- Scale and time are cheated in nearly every shot, so badge each cheat. Say estimates with "about" or "probably".
- Re-open every source before posting. Listen at T0 for Centauri, Sagittarius, kilonova and Olbers. TODO: decide whether to add miles for US viewers.

**Platform policy (CARE)**
- Turn on the AI labels on TikTok, YouTube and Meta, and write "voice: synthetic" in each post.
- YouTube's "inauthentic content" rule (July 2025) demonetises mass-produced, repetitive AI-voiced videos, and a daily template looks like that. Each episode needs its own whoa, a script a person wrote and checked, and pinned sources. TikTok Creator Rewards needs videos over 1 minute and original content.
- No NASA or ESA logos used in a way that implies endorsement, and no doom framing.
- Photosensitivity (the Sun switching off, the kilonova, the white-out): at most 3 flashes a second, ramps of at least 0.5 s, and an analyzer pass.

**Hard to render**
- Episode 10's lensing needs a screen-space pass that reads a precomputed deflection texture. Test it early.
- Scale jumps: watch float precision, the kFloor and rungs popping. Tiny stars shimmer, so keep them at least 1.5 px. Indigo gradients band, so add a ±1/255 dither.
- **Capacity:** three channels at 3–4 h each is 9–12 h of rendering a day on one 4-CPU box, one job at a time. Keep 5–7 episodes in hand per channel, or add machines.

Scratch files: preset `/tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/series/lightminute-vacuum.json`, contrast check `/tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/series/space_contrast.py`.