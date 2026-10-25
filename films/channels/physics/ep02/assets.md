# Assets: Rest Frame No. 002, "The swing's secret"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | "The Bench": `set/cyc.js`, `aces.js`, `props.js` (lights only), `title.js`, and the new B6 oscillator block `set/swing.js` (the exact pendulum) and `set/pendulum.js` (the gantry, strings and brass bobs) (the channel's reusable set, `films/channels/physics/set/`) | Studio code |
| This episode's staging | `ep02/scene.mjs`, directed by `ep02/compile.py` (with the shared ports in `set/bench_py.py`) → `film.json` | Studio code |
| Science overlays and shared blocks (captions, labels, badges, counters, cards; the episode's motion blocks) | `kits/cinema/sci/hud.js`, `clock.js`, `strobe.js`, `arrows.js` | Studio code |
| Film runtime and renderer | `kits/cinema/film/` (page, runtime, chunked resumable renderer) | Studio code |
| The finish (motion blur, bokeh, bloom, ACES) | `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Archivo, IBM Plex Sans, IBM Plex Mono: files, versions and sha256 in `films/channels/physics/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice af_bella (speed 1.0, en-us), via kokoro-onnx 0.6.1 and onnxruntime 1.31.0; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep02/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `restframe-bench` (`kits/cinema/studio/vibes/restframe-bench.json`), seeded | Studio code; no samples |
| Script and facts | `ep02/script.md`; the exact simple pendulum (Jacobi elliptic functions, g = 981 cm/s², no simulation) in `set/swing.js`; numbers in `claims.json` | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Rest Frame: `films/channels/physics/bible.md`, `theme.json` | Studio (provisional, `films/channels/DECISIONS.md`) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/rest-frame-002-9x16.mp4` (delivery), `out/rest-frame-002-9x16.jpg` (poster), `out/rest-frame-002-9x16-contact.jpg`
(contact sheet, one frame every 2 s).

The grandfather clock in the normal beat is an ink-line drawing made in code (`scene.mjs`), not a picture of any real clock. The pendulum wave reproduces the published design of Harvard's Natural Sciences Lecture Demonstrations (15 pendulums, 51–65 swings a minute), rebuilt from its numbers; no footage or images of it are used.
