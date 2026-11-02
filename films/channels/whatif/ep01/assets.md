# Assets: Back of the Envelope No. 001, "Through the Earth"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The numbers | `ep01/calc.py`: PREM density integrated for gravity and the fall time, the uniform and constant-g models, the sensitivity rows; `compile.py` reads its `RESULTS`, and `claims.json` cites each input | Studio code; inputs cited in `claims.json` |
| The 3D set | The channel's reusable set, `films/channels/whatif/set/`: `desk.js` (graph-paper desk and backdrop), `globe.js` (the half-cut planet model, profile strips), `anchor.js` (the figure and the car), `rig.js` (camera mount; Light Minute's, unchanged), `look.js` (token colours through the finish; Light Minute's), `aces.js` (the finish's inverse; Rest Frame's) | Studio code |
| Overlays | `set/spine.js` (the running sum and the box), `set/motif.js` (title flap, boxed end card, show-your-work card), on `kits/cinema/sci/hud.js` and `clock.js` | Studio code |
| This episode's staging | `ep01/scene.mjs`, directed by `ep01/compile.py` → `film.json` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Bricolage Grotesque, Figtree, JetBrains Mono, Caveat: files, versions and sha256 in `films/channels/whatif/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice am_puck (one call and speed per sentence, en-us; `ep01/voice.py`), via kokoro-onnx 0.6.1; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep01/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `envelope-working` (`kits/cinema/studio/vibes/envelope-working.json`), seeded | Studio code; no samples |
| Script and facts | `ep01/script.md`; every fact in `claims.json` (Klotz 2015, PREM 1981, NASA's Earth fact sheet, Live Science's report of the paper) | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Back of the Envelope: `films/channels/whatif/bible.md`, `theme.json` | Studio (name chosen by the owner, 27 Oct) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/` (the delivery, its YouTube 1440 version, poster and contact sheet).
