# Assets: "Why does a pore clog?"

| What | Source | License / owner |
|---|---|---|
| The 3D scene (pore cross-section, plug, bacteria, drops, labels) | Evelyn Romero's lesson 8-2 scene for Lumevina Skin School, directed in `films/skin-school-pilot/` and adapted here (`motion/scene.mjs`, changes marked `tiktok:`) | Lumevina (client) |
| Page runtime (`motion.js`), studio set (`studio3d.js`), Inter font | Lumevina's Skin School code, read from `films/skin-school-pilot/` | Lumevina (client); Inter is SIL OFL 1.1 |
| three.js r160 | `films/skin-school-pilot/motion/vendor/three.module.min.js` | MIT |
| The finish (motion blur, bokeh, bloom, ACES), liquid drops | `kits/cinema/cinema3d.js`, `kits/cinema/metaballs.js` (three's MarchingCubes, MIT) | Studio code |
| Narration | Generated with Kokoro-82M (voice `af_heart`) via kokoro-onnx 0.6.1, onnxruntime 1.31.0; model sha256 `7d5df8ec…`, voices `bca610b8…` (see `vo/lines.json`) | Kokoro-82M and voices Apache-2.0; kokoro-onnx MIT. Synthetic voice: label as AI |
| Word timings | Parakeet TDT 0.6B v2 (int8) via sherpa-onnx 1.13.8 | CC-BY-4.0 (NVIDIA); sherpa-onnx Apache-2.0 |
| Score, foley, mix, master | Synthesized by `kits/cinema/studio` (preset `lumevina-dew`), seeded | Studio code; no samples, no licensed music |
| Script | From lesson 8-2's four captions (`script.md`) | Lumevina (client) |

Generated files: `vo/*.wav` (narration), `build/audio/` (stems and mix, not committed),
`out/skin-school-pore-9x16.mp4` (delivery), `.jpg` (poster), `-contact.jpg` (contact sheet).
