# Assets: Meanwhile, Inside No. 04, "The gap"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | "The vessel": `set/vessel.js`, `rbc.js`, `look.js`, `motif.js`, `probe.js`, `neuron.js` (the channel's reusable set, `films/channels/body/set/`) | Studio code |
| This episode's staging | `ep04/scene.mjs`, directed by `ep04/compile.py` → `film.json` | Studio code |
| Science overlays and shared blocks (captions, labels, badges, counters, cards; the episode's motion blocks) | `kits/cinema/sci/hud.js`, `clock.js`, `path.js`, `swarm.js`, `cutaway.js` | Studio code |
| Film runtime and renderer | `kits/cinema/film/` (page, runtime, chunked resumable renderer) | Studio code |
| The finish (motion blur, bokeh, bloom, ACES) | `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Fraunces, Atkinson Hyperlegible Next: files, versions and sha256 in `films/channels/body/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice bf_emma (one speed per sentence, en-gb; `ep04/voice.py`), via kokoro-onnx 0.6.1 and onnxruntime 1.31.0; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep04/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `meanwhile-pulse` (`kits/cinema/studio/vibes/meanwhile-pulse.json`), seeded | Studio code; no samples |
| Script and facts | `ep04/script.md`; synapse counts, Golgi and Cajal, the 1950s electron micrographs, release, delay, plasticity and breathing in `claims.json`; the junction, the network, the stained-tissue panels and the air sac are stylised models and illustrations | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Meanwhile, Inside: `films/channels/body/bible.md`, `theme.json` | Studio (provisional, `films/channels/DECISIONS.md`) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/meanwhile-inside-004-9x16.mp4` (delivery), `out/meanwhile-inside-004-9x16.jpg` (poster), `out/meanwhile-inside-004-9x16-contact.jpg`
(contact sheet, one frame every 2 s).
