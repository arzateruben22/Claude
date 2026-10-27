# Series bible: Outer Layer (skin channel)

Prism Studio slug `skincare`. Name decided by the owner on 27 Oct 2026. The brief is the studio
catalogue's (`prism-studio/src/domain/catalog.ts`); this bible turns it into a look, a sound, a voice
and a season.

## 1. Promise and audience

**Promise:** *Skin biology, ingredients and routines, with the evidence on the screen.* Each episode
is one thing about the organ you live inside, shown as a cut-through section, told in about 70
seconds, every number sourced.

**Audience:** curious adults who want to understand their skin, not be sold to.

**Tone:** calm, precise, kind. A myth is corrected by showing the mechanism, never by mocking the
people who believed it (most of us did). The narrator says "we", "people", "a study", never "you're
doing it wrong".

**What the channel never does** (brief + owner's 27 Oct notes):
- No diagnosis, no "you have X", no advice to an individual, no promised result, no before/after.
- No product, brand or ingredient recommendation; nothing that reads as an endorsement. Ingredients
  are named as chemistry ("zinc oxide"), never as products.
- Never infers behaviour, health or character from how skin looks.
- Every treatment-adjacent statement goes to a board-certified dermatologist before posting
  (each episode's `review/HUMAN-REVIEW.md` and `CLAIMS-REVIEW.md`).
- Skin of every tone in every illustration: each section the film draws is rendered in at least
  three melanin levels across an episode, and the "default" skin rotates episode to episode.
- Nothing of Lumevina (the client's skincare studio, `lumevina/`, `films/skin-school-tiktok/`): not
  its look (black, rose and gold; glass bells), not its narrator (af_heart), products or wording.
  Lumevina's Skin School already covers "why does a pore clog", so this channel does not.

## 2. Look: "the slide"

A cool, neutral daylight ground, like a clean microscope slide under a lamp. The ground is the one
part of the frame with no warmth, so every skin tone the film draws reads true against it, and the
channel's two signal colours are the two things skin science is mostly about: **ultraviolet** and
**water**.

Set apart from the studio's other identities:
- **Light Minute** is dark indigo with neon teal and lilac; **Meanwhile, Inside** is dark surgical
  green with chartreuse and a blood pink; **Rest Frame** is warm paper with cobalt and marker yellow.
  Outer Layer is the only cool *light* ground, and its accent is a deep violet, not a blue.
- **Lumevina:** black, rose and gold. Outer Layer has no black ground, no rose, no gold, no pink.
  (The catalogue's placeholder swatch for this channel, `#D99A92`, is a dusty rose: too close to
  Lumevina. The channel colour proposed for Prism Studio is `uv` `#6A2FD0`; the coordinator decides.)
- **Los Güeros** (espresso `#100C09`, amber `#E8A356`, Cormorant Garamond + Jost) and **Claude coral**:
  no browns, ambers or corals anywhere in the UI.

| Token | Hex | Role |
|---|---|---|
| `slide` | `#EEF2F1` | Background (top of the gradient) |
| `slide-low` | `#DCE4E3` | Gradient foot, the "stage" under the section |
| `card` | `#FFFFFF` | Caption plate (92%), label pills, end card |
| `ink` | `#13252C` | Captions, titles, label text, the depth gauge |
| `ink-2` | `#4B5F66` | Words still to come, units, honesty notes |
| `uv` (accent 1) | `#6A2FD0` | **Ultraviolet and light:** UV rays, filters, the spoken word |
| `water` (accent 2) | `#00666D` | **Water and the barrier:** lipids, moisture, sweat, the gauge's live tick |
| `uv-glow` (scene only) | `#9C7BFF` | UV rays drawn in 3D (additive, never under text) |
| `water-glow` (scene only) | `#4FB8BE` | Water molecules and lipid sheets in 3D |

Skin itself is never a token. The section's cells take their colour from a melanin parameter
(sampled from measured skin reflectance in the sRGB range, light to deep), so no one tone is "the"
skin.

**Contrast (WCAG 2.x, computed):**

| Text | on `slide` | on `slide-low` | on `card` |
|---|---|---|---|
| `ink` | 14.0 | 12.2 | 15.8 |
| `ink-2` | 5.95 | 5.2 | 6.7 |
| `uv` | 6.35 | 5.55 | 7.2 |
| `water` | 5.96 | 5.2 | 6.7 |

Captions always sit on the `card` plate (ink 15.8:1, the lit word in `uv` 7.2:1), so they hold
≥ 4.5:1 over any picture. `contrast.py` re-checks against the theme.

**Type** (all SIL OFL 1.1, self-hosted, from `google/fonts` at a pinned commit; `fonts/SOURCES.md`):
- **Display: Newsreader** (Production Type), weight 500, optical size 72, for titles and the end card.
  A calm editorial serif: the channel reads like a good science section, not an ad. No other studio
  channel or client uses a serif with optical sizes.
- **Text: Red Hat Text**, 600 for captions, 500 for labels. Open apertures, clear numerals at small
  sizes, a humanist warmth that suits "kind".
- **Numbers: Red Hat Mono**, 500, for the depth gauge, counters and honesty notes (tabular figures,
  so a counting number never jitters). Same family as the text face, so the two sit together.

**Motif: the depth gauge.** A thin vertical ruler at the frame's left edge, marked in micrometres
(µm), with a `water` tick that slides as the camera moves through the layers and one fixed reference
mark: *"paper ≈ 100 µm"*. It is the spine readout of every episode (its number changes with the
story), and its short form, three stacked bars of decreasing thickness, is the avatar. Light Minute
owns the ring and Meanwhile, Inside the pulse line; Outer Layer owns the **stack of layers**.

**Honesty notes** (Red Hat Mono, `ink-2`, one tier below labels): `not to scale`, `scale ×N`,
`time ×N`, `simplified`, `model`, `estimate`, `debated`, `illustration`. Each top corner holds at
most two at once (WRITING.md rule 8).

**Labels:** white pill, `ink` text, a coloured glyph so colour is never the only cue:
`▬` layer (ink), `◆` light/UV (uv), `◇` water/lipid (water), `●` cell (ink-2), `╱` fibre (ink-2).
Leader lines in `ink` at 70%.

**Title card:** a band at y 250–470 over the hook's section: three bars of the avatar draw in on the
signature, OUTER LAYER in Newsreader small caps beside them, the question below.

**End card:** the hook's composition returns (a loop), the gauge holds its final value, a `card`
panel with "Next layer: …" and one true-fact footnote with its source.

## 3. Sound: "skin warmth, slide light"

| | |
|---|---|
| Key | **F major** (ionian). Taken: E♭ major (body), E dorian (space), G mixolydian (physics), D lydian (Lumevina) |
| Tempo | **64.2857 BPM**: a 16th note is exactly **7 frames** at 30 fps, a beat 28 frames (0.933 s). Taken: 75 (6 frames), 56.25 (8), 112.5 (4), 90 (Lumevina, 5) |
| Bed | A soft, low-passed pad (F–C–A–E voicings, slow attack) and a sub that enters only for the whoa |
| Lead | A **nylon pluck** (Karplus–Strong string; new `pluck` voice, see KIT-CHANGES), sparse, on the off-beats |
| Foley | Labels on soft plucks up the F major pentatonic; layer changes on a felt *thup* (`knock` filtered low); UV rays on a short airy `zap` filtered dark; water on `plop`; no bells of any kind, no fizz (Lumevina's dew), no ping (space), no mallet (body), no blip (physics) |
| Signature | **Plucks F5 → C6 → A5**, 7 frames apart (root, fifth, then the third settling under it: an answer, not a question). On the title, the gauge's final value and the end card |
| Mix | Voice dry and close; music in a small warm room; voice ≥ 12 LU over music; −14 LUFS, ≤ −1 dBTP on the delivered AAC |

Preset: `kits/cinema/studio/vibes/outerlayer-slide.json` (added with episode 1).

## 4. Narrator

A synthetic voice, labelled "Narration: synthetic voice (AI)". Taken: af_bella, bf_emma, am_michael,
af_heart. Auditioned for the owner in `auditions/` (episode 1's hook and one explanatory line, through
the same polish as the films):

| Voice | Kokoro grade | Why it is on the list |
|---|---|---|
| **af_nicole** | B− | The best unused grade. Soft, close, unhurried: "calm, precise, kind" without trying |
| **bf_isabella** | C | British, warm, a clinic-explainer register; clear on Latin words |
| **am_fenrir** | C+ | A low, steady male voice, for contrast with the three female narrators already in the studio |

Recommendation and the reasons are in `auditions/README.md` once rendered.

## 5. The set: "the section"

One three.js r160 scene with a pure `window.seek(t)`, finished with `cinema3d.js`, like the other
channels. Units: 1 unit = 10 µm at "cell" scale; a second rung at 1 unit = 1 mm for the whole-hand
and fingertip shots. The camera is a microscope stage: slow dollies, one rack per beat, one scale
jump per episode.

| Block | What | Animation f(t) |
|---|---|---|
| **S1 Stage** | The slide gradient, a soft floor shadow, depth haze | static |
| **S2 Section** | A procedural block of skin cut open: stratum corneum (15–20 rows of flat "bricks" with lipid "mortar"), granular, spinous and basal layers, the wavy dermal junction, dermis fibres, a capillary loop. `melanin` parameter 0–1 tints keratinocytes and melanocyte dendrites | cells rise from the basal row to the surface with a `time ×N` badge; seeded noise, no wall clock |
| **S3 Light** | UV rays as additive violet dashes (UVA long, UVB short) that enter and scatter or stop | r = c_screen·(t − t0) |
| **S4 Water** | Instanced water beads and lipid sheets in `water-glow`; can evaporate (beads leave the surface) | per shot |
| **S5 Film** | A layer on top of the skin (sunscreen, water) with an exact thickness on the gauge | thickness(t) |
| **S6 Hand** | A stylised hand / fingertip at the mm rung for human scale (rendered in the episode's tone) | wrinkle field w(t) |
| **S7 Gauge** | The depth gauge, labels, counters, notes, captions, end card (`sci/hud.js`) | from `film.json` |

Lighting: a soft key from top-left (a lamp over the slide), a cool fill, a thin rim so the cut face
reads. No shadows maps; baked AO in the section's vertex colours. Only the UV dashes and water beads
bloom; text never does.

## 6. Episode template (66–75 s, 150–180 words)

As WRITING.md: hook (≤ 2 s question) · normal · change · why (person, wrong idea or stakes; ≥ 2 s
picture only) · whoa (≥ 3 s picture only) · **to scale** (the recurring segment) · takeaway · tease
("Next layer: …", end card ≥ 1.5 s).

**Recurring segment, "to scale":** every episode stops once to put its subject on the depth gauge
next to the paper mark (≈ 100 µm) and say the one size that makes it real: "the whole dead layer
is about a fifth of this paper", "a test dose of sunscreen is about twenty micrometres thick".
Same shape every week: the gauge lifts to centre, the subject's thickness fills in, the paper mark
stays lit beside it.

## 7. Six episodes (ranked)

`lint.py` and claims.json carry the exact wording and every hedge; this table is the plan.

| # | Title | Hook (by 2 s) | Person / wrong idea / stakes | The whoa | To scale | Sources it needs |
|---|---|---|---|---|---|---|
| 1 | **The dead layer** | "The skin you can see right now: is it alive?" | Wrong idea: the outer layer is just dead waste waiting to fall off. Person: Peter Elias's "bricks and mortar" model (1983): flat dead cells in lipid sheets are the body's main water barrier | Every cell on your surface was born at the bottom and climbed up for about a month, then died on purpose; without that dead sheet you would lose water like an open cup | The stratum corneum is about 10–20 µm, a fifth of a sheet of paper | NIH/StatPearls (epidermis, stratum corneum), Elias 1983 (J Invest Dermatol), turnover studies (Hoath & Leahy 2003; Iizuka), TEWL in barrier loss |
| 2 | **Does SPF 100 beat SPF 50?** | "Does SPF one hundred block twice as much as fifty?" | Wrong idea: the number is a percentage. Person: Franz Greiter, who popularised the factor in 1974. Stakes: labs test at 2 mg/cm²; people apply a fraction of that | SPF 50 lets about 2% of UVB through, SPF 100 about 1%: not twice the blocking, but half the getting-through; and the thickness people actually apply moves the number more than the label does | The test layer is about 20 µm: a fifth of the paper | FDA (SPF test, 2 mg/cm²), AAD (SPF 30 ≈ 97%), Skin Cancer Foundation, Greiter history, application-amount studies (Petersen & Wulf 2014; Faurschou & Wulf 2007) |
| 3 | **Bath fingers** | "Why do fingers wrinkle in the bath, but not your arm?" | Wrong idea: the skin soaks up water and swells. Person: 1935, Lewis and Pickering saw that a finger whose nerve was cut doesn't wrinkle. It is the nervous system narrowing vessels | The wrinkles are a reflex; a 2013 study found wrinkled fingers moved wet objects faster, and later studies couldn't repeat it ("debated") | The ridges are on the order of ... (sourced at script time) | Lewis & Pickering 1935 (Clin Sci), Wilder-Smith (nerve test), Changizi 2011, Kareklas 2013 (Biol Lett), Haseleu 2014 (PLOS ONE) |
| 4 | **What a tan is** | "Is a tan your skin protecting itself?" | Stakes and a wrong idea: a "base tan" as protection. Mechanism: UV damages DNA, p53 switches on the pigment signal (Cui et al. 2007, Cell); melanin caps the nucleus | The tan is the after-image of the damage; the protection it adds is small (about SPF 3–4, hedged as the sources are) | A melanin cap is about the width of a nucleus (~5–10 µm) | Cui 2007 (Cell), NIH/NCI, Skin Cancer Foundation, AAD |
| 5 | **Same cells, every colour** | "Who has more pigment cells: the darkest skin or the lightest?" | Wrong idea: darker skin has more melanocytes. It has about the same number; they make more, larger, eumelanin-rich melanosomes. Person: Nina Jablonski and George Chaplin's UV map (2000): vitamin D against folate | Skin colour across the world follows the UV map, an adaptation balanced over tens of thousands of years, shown on many tones side by side | A melanosome is about 0.5–1 µm; hundreds fit across the paper's edge | NIH/StatPearls (melanocytes), Jablonski & Chaplin 2000 (J Hum Evol), Thong 2003 (melanosome distribution) |
| 6 | **Goosebumps** | "Why do we still get goosebumps with almost no fur?" | Wrong idea: a useless leftover. Person: Ya-Chieh Hsu's lab (2020, Cell): the same nerve and tiny muscle that raise a hair also wake its stem cells | A reflex that once fluffed fur still tends the follicle that grows it | The arrector pili muscle is thinner than a hair (sourced at script time) | Shwartz et al. 2020 (Cell), Harvard Gazette, NIH (piloerection) |

Episode 1 builds S1–S5 and S7; later episodes add S6 (3), the UV set-piece (2, 4) and the tone
spread (5). The long video "Outer Layer, Volume 1" is episodes 1–5.

## 8. Honesty

- Scale and time are cheated in nearly every shot: badge each cheat. Cells "climbing" in seconds get
  `time ×N`; the section is `simplified`; a tan or SPF curve is a `model`.
- Numbers said as the sources hedge them ("about", "up to", "on average"); a disputed finding says
  so on screen (`debated`).
- `verified_via` is recorded honestly; a person (a board-certified dermatologist for any claim about
  treatment, sunscreen, tanning or skin conditions) opens every source before posting.

## 9. Risks

- **Medical framing.** SPF and tanning episodes sit near advice. The scripts describe how the tests
  and the biology work and never tell the viewer what to do; the dermatologist decides if a line
  reads as advice. TikTok and YouTube health-information rules are checked in HUMAN-REVIEW.
- **Platform labelling:** the AI label on TikTok, YouTube and Meta, and "Narration: synthetic voice
  (AI)" on the end card and in each description.
- **Photosensitivity:** UV flashes are ramps, never strobes; ≤ 3 flashes a second, analyzer pass.
- **Render cost:** the section is instanced (≤ 4k cells, ≤ 3k beads), slow moves keep K low, depth of
  field only on the racks. Budget ~1–3 s a frame on this 4-core box; one Chromium job at a time.
- TODO: handle and trademark checks for "Outer Layer" (open-web search only so far).
