# Assets: Outer Layer No. 004, "What a tan is"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The 3D set | "The section": `films/channels/skincare/set/section.js`, `rays.js`, `motif.js`, `rig.js`, `look.js`; this episode's `dna04.js`, `melanocyte04.js` | Studio code |
| This episode's staging | `ep04/scene.mjs`, directed by `ep04/compile.py` → `film.json` | Studio code |
| Science overlays | `kits/cinema/sci/hud.js`, `clock.js` | Studio code |
| Film runtime and renderer | `kits/cinema/film/` | Studio code |
| The finish (motion blur, bloom, ACES) | `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Newsreader, Red Hat Text, Red Hat Mono: files and sha256 in `films/channels/skincare/fonts/SOURCES.md` | SIL OFL 1.1 |
| Narration | Kokoro-82M, voice bf_isabella (en-gb, one speed per line; `ep04/voice.py`), kokoro-onnx 0.6.1, onnxruntime 1.31.0 (`ep04/vo/lines.json`) | Apache-2.0 / MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8; two words placed by hand (`fixwords.py`) | CC-BY-4.0 (NVIDIA); Apache-2.0 |
| Score, foley, mix, master | `kits/cinema/studio`, preset `outerlayer-slide`, seeded | Studio code; no samples |
| Script and facts | `ep04/script.md`; sources in `claims.json` (Cui et al. 2007, Schreier et al. 2007, Agar et al. 2004, Gareau 2011, Harvard Health, CDC via HHS, Mayo Clinic, NOVA Medical School) | Studio; links only, nothing copied |
| Channel identity | Outer Layer: `films/channels/skincare/bible.md`, `theme.json` | Studio |

Generated: `vo/*.wav` (committed), `build/` (not committed), `out/` (the delivery, from the render worker),
`review/` (draft preview and contact sheet).
