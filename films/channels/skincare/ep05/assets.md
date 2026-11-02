# Assets: Skin Sense No. 005, "The sunscreen experiment" (look 2 rebuild)

| Asset | Source | Licence |
|---|---|---|
| Red Hat Text, Red Hat Mono, Newsreader | `../fonts/` (google/fonts; `../fonts/SOURCES.md`) | SIL OFL 1.1 |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Narration | Kokoro-82M, voice bf_isabella, generated here (`voice.py`) | Apache 2.0 (model) |
| Word timings | Parakeet TDT 0.6B v2 (sherpa-onnx), `kits/cinema/voice/align.py` | CC BY 4.0 (model) |
| Score and foley | synthesized by `kits/cinema/studio` from `sheet.json` (`outerlayer-slide`) | studio code |
| Picture | generated in code (`scene.mjs`, `../set/terrain.js`, `../set/studio.js`, `../set/motif.js`); no footage, no brands | studio code |
| Reference map: stained skin section (the micrograph cut face) | `../set/ref/skin-he-10x.jpg`, embedded as SECTION in `../set/ref/textures.js`. Original: https://commons.wikimedia.org/wiki/File:Normal_Epidermis_and_Dermis_with_Intradermal_Nevus_10x.JPG (author Kilbad), via the scikit-image data mirror | public domain, as stated by the source; **a person confirms each licence on the original page** before posting |

The reference maps are listed with sha256 in `../set/ref/SOURCES.md` (fetched from the scikit-image sample-data
mirrors, because Wikimedia, CDC PHIL and NIH hosts are blocked here): **a person confirms each licence on the original
page.** The section shows normal skin with a benign intradermal naevus; it is badged "micrograph · healthy stained
skin" and never presented as a melanoma.

Retired from this episode (files kept): `../set/hands05.js` (the model hands), `../set/town05.js` (the town).

Nothing here comes from Lumevina (its look, voice, products or wording) or any brand.
