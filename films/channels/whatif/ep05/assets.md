# Assets: Back of the Envelope No. 005, "Everybody jump"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The numbers | `ep05/calc.py`; `compile.py` reads its `RESULTS`; `claims.json` cites each input (UN WPP 2024, Walpole et al. 2012, NASA, NIST CODATA, Topend Sports norms, HyperPhysics) | Studio code; inputs cited |
| The 3D set | `films/channels/whatif/set/`: `desk.js`, `anchor.js`, `rig.js`, `look.js`, `aces.js`, and the new `ladder05.js` (ladder, planet, beads, arrows); `kits/cinema/sci/front.js` (the dashed path) | Studio code |
| Overlays | `set/spine.js`, `set/motif.js` on `kits/cinema/sci/hud.js` | Studio code |
| This episode's staging | `ep05/scene.mjs`, directed by `ep05/compile.py` → `film.json` | Studio code |
| Film runtime, renderer, finish; three.js r160 | `kits/cinema/film/`, `kits/cinema/cinema3d.js`, `kits/cinema/vendor/three.module.min.js` | Studio code; MIT |
| Type | Bricolage Grotesque, Figtree, JetBrains Mono, Caveat (`films/channels/whatif/fonts/SOURCES.md`) | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice am_puck, via kokoro-onnx 0.6.1 (`ep05/voice.py`, `vo/lines.json`) | Apache-2.0 / MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `envelope-working`, seeded | Studio code; no samples |
| Script and facts | `ep05/script.md`; `claims.json` | Studio; each source's own terms (links only) |
