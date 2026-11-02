# Assets: Back of the Envelope No. 004, "Count to a billion"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The numbers | `ep04/calc.py`: exact syllable counts of every number name from 1 to 10⁹, Harper's measured pace, the sensitivity rows; `compile.py` reads its `RESULTS`, and `claims.json` cites each input | Studio code; inputs cited in `claims.json` |
| The 3D set | The channel's set, `films/channels/whatif/set/`: `desk.js`, `anchor.js` (the figures), `rig.js`, `look.js`, `aces.js`, and the new `tape04.js` (canvas-faced paper sheets: slips, calendar, ruler; number-name speller) | Studio code |
| Overlays | `set/spine.js`, `set/motif.js` on `kits/cinema/sci/hud.js` | Studio code |
| This episode's staging | `ep04/scene.mjs`, directed by `ep04/compile.py` → `film.json` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Bricolage Grotesque, Figtree, JetBrains Mono, Caveat (`films/channels/whatif/fonts/SOURCES.md`); Figtree and JetBrains Mono also set the slips' faces | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice am_puck, via kokoro-onnx 0.6.1 (`ep04/voice.py`, `vo/lines.json`) | Apache-2.0 (model and voices), MIT (kokoro-onnx). **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `envelope-working`, seeded | Studio code; no samples |
| Script and facts | `ep04/script.md`; every fact in `claims.json` (Wikipedia and NPR on Jeremy Harper, Guinness, UN WPP 2024, Wikipedia on English numerals, Math is Fun) | Studio; each source's own terms (links only) |

Generated files: `vo/*.wav` (committed), `sound/` (the delivery soundtrack, committed for the render worker), `build/`
(not committed), `out/` (the delivery from the render worker).

**Person depicted:** Jeremy Harper is named on screen (label, spine, end-card footnote) and referred to in the voice
("a man"), only for his public, documented 2007 count. He is drawn as a generic blue figure, not a likeness.
