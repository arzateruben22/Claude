# Assets: Skin Sense No. 001 (reboot)

| Asset | Source | Licence |
|---|---|---|
| Red Hat Text, Red Hat Mono, Newsreader | `../fonts/` (google/fonts; `../fonts/SOURCES.md`) | SIL OFL 1.1 |
| three.js r160 | `kits/cinema/vendor/three.module.min.js` | MIT |
| Narration | Kokoro-82M, voice bf_isabella, generated here (`voice.py`) | Apache 2.0 (model) |
| Word timings | Parakeet TDT 0.6B v2 (sherpa-onnx), `kits/cinema/voice/align.py` | CC BY 4.0 (model) |
| Score and foley | synthesized by `kits/cinema/studio` from `sheet.json` (`outerlayer-slide`) | studio code |
| Picture | generated in code (`scene.mjs`, `../set/*.js`), except one photograph: the stained tissue section listed below, shown behind the model and badged as a tissue photo (normal skin) on screen; no footage, no brands | studio code |

Nothing here comes from Lumevina (its look, voice, products or wording) or any brand.

## Reference images (studio look, 2 Nov)

| Image | Use | Source | Licence |
|---|---|---|---|
| Stained section of normal human epidermis and dermis (H&E, 10x) | the follicle block's cut face (collagen, cells, vessels) | Kilbad, Wikimedia Commons `Normal_Epidermis_and_Dermis_with_Intradermal_Nevus_10x.JPG`, via the scikit-image data mirror (`../set/ref/`) | public domain; licence confirmed on the original page by the owner, 3 Nov 2026 (public domain: "I grant anyone the right to use this work for any purpose, without any conditions"; file version of 30 Dec 2015) |

The original host is blocked in this build environment; the licence was confirmed on the original page by the owner. Details and checksums: `../set/ref/SOURCES.md`.
