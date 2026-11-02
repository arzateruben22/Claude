# Assets: Skin Sense No. 006 (look 2 rebuild)

| Asset | Source | Licence |
|---|---|---|
| Red Hat Text, Red Hat Mono, Newsreader | `../fonts/` (google/fonts; `../fonts/SOURCES.md`) | SIL OFL 1.1 |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Narration | Kokoro-82M, voice bf_isabella, generated here (`voice.py`) | Apache 2.0 (model) |
| Word timings | Parakeet TDT 0.6B v2 (sherpa-onnx), `kits/cinema/voice/align.py` | CC BY 4.0 (model) |
| Score and foley | synthesized by `kits/cinema/studio` from `sheet.json` (`outerlayer-slide`) | studio code |
| Stained skin section (the cut face, hero 4) | `../set/ref/textures.js` `SECTION`, a resized crop of `skin-he-10x.jpg`: "Normal Epidermis and Dermis with Intradermal Nevus 10x" (Kilbad), https://commons.wikimedia.org/wiki/File:Normal_Epidermis_and_Dermis_with_Intradermal_Nevus_10x.JPG, fetched from the scikit-image data mirror (`../set/ref/SOURCES.md`) | public domain, as stated by the source; **a person confirms each licence on the original page before posting** |
| Everything else in the picture (the plate, the tubes, the skin, the rays, the dust) | generated in code (`scene.mjs`, `../set/*.js`); no photographs, no footage, no brands | studio code |

The IARC Group 1 plate is typeset in the channel's fonts: an excerpt of the agent names (IARC Monographs list), not
a reproduction of an IARC document. The stained section is a micrograph of human skin graded only through lighting;
its stain colours are the stain's, not a skin tone. Nothing here comes from Lumevina (its look, voice, products or
wording) or any brand.
