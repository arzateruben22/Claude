# Assets: Light Minute No. 002, "The nearest star"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | `films/channels/space/set/`: `sky.js`, `rig.js`, `look.js`, `motif.js`, and new in this episode `beacon.js` and `comets.js` | Studio code |
| This episode's staging | `ep02/scene.mjs`, directed by `ep02/compile.py` → `film.json` | Studio code |
| Science overlays and shared blocks | `kits/cinema/sci/hud.js`, `clock.js`, `front.js`, `ladder.js` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Unbounded, Lexend, Martian Mono (`films/channels/space/fonts/SOURCES.md`) | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice am_michael (one speed per line, en-us; `ep02/voice.py`), via kokoro-onnx 0.6.1 and onnxruntime 1.31.0 (`ep02/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `lightminute-vacuum`, seeded | Studio code; no samples |
| Script and facts | `ep02/script.md`; numbers in `claims.json` (NASA, EarthSky, CNN, Science News, NIST, Smithsonian, University of Bristol). Voyager, the comet cloud, Proxima and the stars are drawn, not imaged | Studio; each source's own terms (links only) |

Generated files: `vo/*.wav` (committed), `build/` (not committed), `out/lightminute-002-9x16.mp4` (delivery),
`out/lightminute-002-9x16.jpg` (poster), `out/lightminute-002-9x16-contact.jpg` (contact sheet).
