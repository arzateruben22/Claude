# Assets: Back of the Envelope No. 003, "All the ants"

Everything in this film is made in code, by the studio or by the open-source projects below. No stock footage,
photos, samples or licensed music.

| What | Source | License / owner |
|---|---|---|
| The numbers | `ep03/calc.py`: ants' carbon over ours (12 ÷ 60 Mt C), the same at the lightest and heaviest published estimates (3.6 and 50 Mt C), ants per person, carbon per ant, the count against the 1994 figure; `compile.py` reads its `V` and `RESULTS` (and sizes the ant carpet from `ants_per_person`), and `claims.json` cites each input | Studio code; inputs cited in `claims.json` |
| The 3D set | The channel's reusable set, `films/channels/whatif/set/`: `desk.js` (graph-paper desk and backdrop; the ruling re-scales by tens with the camera, so the macro reads in millimetres), `balance.js` (the pan balance, its seeded heaps and the walking ant; built for this episode), `crowd.js` (No. 002's crowd, used here as the carpet of your ants, 4 per cm², with the optional `far` and `aniso` added for this episode), `anchor.js` (the blue figure, "you", at 170 cm), `rig.js` (camera mount; Light Minute's, unchanged), `look.js` (token colours through the finish; Light Minute's), `aces.js` (the finish's inverse; Rest Frame's) | Studio code |
| Overlays | `set/spine.js` (the running sum and the box), `set/motif.js` (title flap, boxed end card, show-your-work card), on `kits/cinema/sci/hud.js` and `front.js` | Studio code |
| This episode's staging | `ep03/scene.mjs` (the second balance, the 489 count-site dots, the true-size fingertip, the ant carpet round the figure), directed by `ep03/compile.py` → `film.json` | Studio code |
| Film runtime, renderer, finish | `kits/cinema/film/`, `kits/cinema/cinema3d.js` (this episode opts into `CINEMA.holdCuts`, added for it: no frame's motion blur reaches across a cut; `kMax` 24) | Studio code |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Type | Bricolage Grotesque, Figtree, JetBrains Mono, Caveat: files, versions and sha256 in `films/channels/whatif/fonts/SOURCES.md` | SIL OFL 1.1 (licence files alongside) |
| Narration | Kokoro-82M, voice am_puck (one call and speed per sentence, en-us; `ep03/voice.py`), via kokoro-onnx 0.6.1; model sha256 `7d5df8ec…`, voices `bca610b8…` (`ep03/vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. **Synthetic voice: label as AI** |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio`, preset `envelope-working` (`kits/cinema/studio/vibes/envelope-working.json`: A lydian, 50 BPM, plucks and pencil scratches), seeded | Studio code; no samples |
| Script and facts | `ep03/script.md`; every fact in `claims.json` (Hölldobler & Wilson, Journey to the Ants (1994), as quoted on a Serendip Studio slide; Schultheiss et al., PNAS 2022, on the count and the 12 Mt of carbon; Bar-On, Phillips & Milo, PNAS 2018, on humanity's 60 Mt; Phys.org on the 20 quadrillion; Fayle & Klimeš, PNAS commentary 2022, on the 3.6–50 Mt range) | Studio; each source's own terms (links only, nothing copied) |
| Channel identity | Back of the Envelope: `films/channels/whatif/bible.md`, `theme.json` | Studio (name chosen by the owner, 27 Oct) |

Generated files: `vo/*.wav` (narration, committed), `build/` (soundtrack stems and mix, frames and chunks; not
committed), `out/` (the delivery, its YouTube 1440 version, poster and contact sheet).
