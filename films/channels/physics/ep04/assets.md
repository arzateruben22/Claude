# Assets: Rest Frame No. 004, "The hammer and the feather"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | "The Bench": `set/cyc.js`, `aces.js`, `props.js` (the lights), `title.js`, and new: `set/moon.js` (the Moon dressing: a regolith floor in a seeded canvas texture; a geological hammer and a falcon feather built from primitives) and `set/ink.js` (the hands, the Earth and the satellite's orbit) (the channel's reusable set, `films/channels/physics/set/`) | Studio code |
| This episode's staging | `ep04/scene.mjs`, directed by `ep04/compile.py` (with the shared ports in `set/bench_py.py`) → `film.json` | Studio code |
| Science overlays and shared blocks (captions, labels, badges, counters, cards; the episode's motion blocks) | `kits/cinema/sci/hud.js`, `clock.js`, `strobe.js`, `arrows.js` | Studio code |
| Film runtime and renderer | `kits/cinema/film/` (page, runtime, chunked resumable renderer) | Studio code |
| The finish (motion blur, bokeh, bloom, ACES) | `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Archivo, IBM Plex Sans, IBM Plex Mono: files, versions and sha256 in `films/channels/physics/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice af_bella (speed 1.0, en-us), via kokoro-onnx 0.6.1 and onnxruntime 1.31.0; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep04/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `restframe-bench` (`kits/cinema/studio/vibes/restframe-bench.json`), seeded | Studio code; no samples |
| Script and facts | `ep04/script.md`; closed-form free fall on Earth (981 cm/s²) and the Moon (162 cm/s²) in `scene.mjs`; numbers in `claims.json` | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Rest Frame: `films/channels/physics/bible.md`, `theme.json` | Studio (provisional, `films/channels/DECISIONS.md`) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/rest-frame-004-9x16.mp4` (delivery), `out/rest-frame-004-9x16.jpg` (poster), `out/rest-frame-004-9x16-contact.jpg`
(contact sheet, one frame every 2 s).


The hammer and the feather are generic shapes made in code, not models of the Apollo 15 objects; no NASA footage or photographs are used. The quote is Scott's words as transcribed by Physics World (credited on screen to him). The satellite is an ink drawing, not a model of MICROSCOPE.
