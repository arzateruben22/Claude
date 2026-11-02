# Assets: Back of the Envelope No. 002, "Everyone, one place"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The numbers | `ep02/calc.py`: the area at 2 and 4 people per m², the square's side, Greater Londons, the share of Earth's land, the bodies' volume and cube side, the cube at 0.97 and 1.06 g/cm³; `compile.py` reads its `V` and `RESULTS`, and `claims.json` cites each input | Studio code; inputs cited in `claims.json` |
| The 3D set | The channel's reusable set, `films/channels/whatif/set/`: `desk.js` (graph-paper desk and backdrop; its optional `span` for shots far above the paper), `crowd.js` (everyone as one dot a person at a given density, the chalk square and warning hatching; built for this episode), `globe.js` (the planet model for the scale jump), `anchor.js` (the blue figure, "you"), `tower.js` (the generic stepped spire, 828 m, drawn 2.2× wider, needle tip 16 m; and the cube of bodies; built for this episode), `rig.js` (camera mount; Light Minute's, unchanged), `look.js` (token colours through the finish; Light Minute's), `aces.js` (the finish's inverse; Rest Frame's) | Studio code |
| Overlays | `set/spine.js` (the running sum and the box), `set/motif.js` (title flap, boxed end card, show-your-work card), on `kits/cinema/sci/hud.js` and `front.js` | Studio code |
| This episode's staging | `ep02/scene.mjs` (including the chalk 828 m rule from the tower's tip over the cube), directed by `ep02/compile.py` → `film.json` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Bricolage Grotesque, Figtree, JetBrains Mono, Caveat: files, versions and sha256 in `films/channels/whatif/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice am_puck (one call and speed per sentence, en-us; `ep02/voice.py`), via kokoro-onnx 0.6.1; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep02/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `envelope-working` (`kits/cinema/studio/vibes/envelope-working.json`: A lydian, 50 BPM, plucks and pencil scratches), seeded | Studio code; no samples |
| Script and facts | `ep02/script.md`; every fact in `claims.json` (UN World Population Prospects 2024; ScienceAlert, Waseda University WIAS and NPR on crowd density, after Fruin and G. K. Still; Britannica on Greater London; Nations Online on Earth's land; Walpole et al. 2012 on adult body mass; Biology Insights on body density; KHL Group on the CTBUH's ratified 828 m for the Burj Khalifa (claim c10)) | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Back of the Envelope: `films/channels/whatif/bible.md`, `theme.json` | Studio (name chosen by the owner, 27 Oct) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/` (the delivery, its YouTube 1440 version, poster and contact sheet).
