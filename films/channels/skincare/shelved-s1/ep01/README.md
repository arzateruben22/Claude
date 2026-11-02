# Outer Layer No. 001: "The dead layer"

About 74 s, 9:16 (1080×1920, 30 fps), narrated by a synthetic voice (bf_isabella, labelled "Narration: synthetic voice
(AI)"), with an original score (the `outerlayer-slide` preset: F major, 64.29 BPM, a breathy reed). Bible §7 #1.

**The story (Flow standard):** is your skin alive? The part you can see isn't. A stack of flattened, empty cells sits
on the living ones; each began at the base, rose for about two weeks and took itself apart on purpose. It looks like
waste, but sealed with fats it builds a brick wall that keeps water in; babies born before it's finished lose water
about five times as fast. The whole wall, on a cheek, is thinner than a fifth of a sheet of paper. So is your skin
alive? Underneath, yes; on top, it wears a layer that died for it.

**On screen:** ≈15 rows, day 0 → 14, "Rutter & Hull, 1979", 32 vs 6 g/m²·h, ≈5×, 17 µm against paper's 100 µm.

| File | What |
|---|---|
| `script.md` | narration and direction; lint clean (`lint.py … --segment toscale --bpm 64.2857`) |
| `claims.json` | 16 claims, every one from a search excerpt (a person opens each link) |
| `voice.py`, `vo/`, `pron.json` | the voice (per-line Kokoro speeds 0.70–0.86), word timings |
| `compile.py` → `film.json`, `sheet.json` | the clock: shots, camera, cues, labels, notes, spine, captions; the cue sheet |
| `scene.mjs` | the picture (`../set/`: section, rays, motif, rig, look) |
| `review/` | `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`, `scorecard.md` (review rounds and compelling scores) |
| `out/` | the delivered final, its 1440×2560 YouTube version, poster and contact sheet (from the render worker) |

Build: `python3 -I compile.py` → `node kits/cinema/film/render.mjs --film films/channels/skincare/ep01 --cues` →
`compile.py` again → `kits/cinema/studio/render.py sheet.json build/audio` (from this folder) → render tiers.
