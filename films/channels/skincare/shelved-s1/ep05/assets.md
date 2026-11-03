# Assets: Outer Layer No. 005, "Same cells, every colour"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage, photos,
maps, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | `films/channels/skincare/set/section.js`, `rays.js`, `motif.js`, `rig.js`, `look.js`, `melanocyte04.js`; this episode's `grains05.js`, `globe05.js` (no continents: the shape of the relation, not a map) | Studio code |
| This episode's staging | `ep05/scene.mjs`, directed by `ep05/compile.py` → `film.json` | Studio code |
| Science overlays, runtime, renderer, finish | `kits/cinema/sci/hud.js`, `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Newsreader, Red Hat Text, Red Hat Mono (`films/channels/skincare/fonts/SOURCES.md`) | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice bf_isabella (en-gb, one speed per line; `ep05/voice.py`), kokoro-onnx 0.6.1, onnxruntime 1.31.0 | Apache-2.0 / MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `outerlayer-slide`, seeded | Studio code; no samples |
| Script and facts | `ep05/claims.json` (Jablonski & Chaplin 2000; Thong et al. 2003; JAAD 2017 meta-analysis; Leeds Histology Guide; StatPearls; Altmeyer's) | Studio; links only |

Generated: `vo/*.wav` (committed), `build/` (not committed), `out/` (from the render worker), `review/` (draft preview).
