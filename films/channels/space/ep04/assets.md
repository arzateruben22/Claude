# Assets: Light Minute No. 004, "The falling Moon"

Everything is made in code. No stock footage, photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | `films/channels/space/set/`: `sky.js`, `star.js`, `planet.js` (with `earthSurface`), `rig.js` (`poseAt`), `look.js`, `motif.js`, `beacon.js`, and new in this episode `moon.js` | Studio code |
| This episode's staging | `ep04/scene.mjs`, directed by `ep04/compile.py` → `film.json` | Studio code |
| Overlays and shared blocks | `kits/cinema/sci/hud.js`, `clock.js`, `front.js` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Unbounded, Lexend, Martian Mono (`films/channels/space/fonts/SOURCES.md`) | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice am_michael (one speed per line; `ep04/voice.py`, `vo/lines.json`) | Apache-2.0 (model, voices); kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `lightminute-vacuum`, seeded | Studio code |
| Facts | `claims.json` (NASA, NASA NSSDC, Ohio State, Michigan State and Cincinnati lecture notes, Geodatos, WKU). Earth and the Moon are drawn, not imaged (Earth's coastline from memory; the Moon's maria placed roughly) | Links only |

Generated: `vo/*.wav` (committed), `build/` (not committed), `out/lightminute-004-9x16.mp4`, `.jpg` (poster), `-contact.jpg`.
