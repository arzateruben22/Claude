# Assets: Light Minute No. 001, "If the Sun vanished"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | "The Vacuum": `set/sky.js`, `star.js`, `planet.js`, `orbit.js`, `grid.js`, `galaxy.js`, `rig.js`, `look.js`, `motif.js` (the channel's reusable set, `films/channels/space/set/`) | Studio code |
| This episode's staging | `ep01/scene.mjs`, directed by `ep01/compile.py` → `film.json` | Studio code |
| Science overlays and shared blocks (captions, labels, badges, counters, cards; the episode's motion blocks) | `kits/cinema/sci/hud.js`, `clock.js`, `front.js`, `ladder.js` | Studio code |
| Film runtime and renderer | `kits/cinema/film/` (page, runtime, chunked resumable renderer) | Studio code |
| The finish (motion blur, bokeh, bloom, ACES) | `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Unbounded, Lexend, Martian Mono: files, versions and sha256 in `films/channels/space/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice am_michael (one speed per line, en-us; `ep01/voice.py`), via kokoro-onnx 0.6.1 and onnxruntime 1.31.0; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep01/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `lightminute-vacuum` (`kits/cinema/studio/vibes/lightminute-vacuum.json`), seeded | Studio code; no samples |
| Script and facts | `ep01/script.md`; Orbit and light-travel numbers in `claims.json` (NASA, Smithsonian, LIGO and Max Planck sources); the star field and galaxy are procedural (no catalogue imagery) and badged "illustration" | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Light Minute: `films/channels/space/bible.md`, `theme.json` | Studio (provisional, `films/channels/DECISIONS.md`) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/lightminute-001-9x16.mp4` (delivery), `out/lightminute-001-9x16.jpg` (poster), `out/lightminute-001-9x16-contact.jpg`
(contact sheet, one frame every 2 s).
