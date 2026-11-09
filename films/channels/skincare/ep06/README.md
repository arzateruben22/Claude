# Skin Sense No. 06: "Same List as Cigarettes" (new art direction, tone: deep)

Draft: `review/skin-sense-006-preview.mp4` (voice only, 540×960), `review/contact-sheet.jpg`. Built to `../ART-DIRECTION.md` (branch `claude/skin-sense-art-direction`) and Standards v2.
Deliverables: `script.md`, `review/scene-table.md`, `review/claims-table.md`, `review/clarity-review.md`, `art-prompts.md`. The previous 3D draft is archived in `old-3d/` (relative paths no longer work).
Build: voice `voice.py` → `kits/cinema/voice/align.py` → `python3 -I ../set/build_ep.py ep06` → `node kits/cinema/film/render.mjs --film films/channels/skincare/ep06 --tier draft --plain [--assemble --audio films/channels/skincare/ep06/mix.m4a]`. Composition: `../set/ss3.mjs` driven by `episode.json` (word-cued); tables: `../set/tables.py ep06`; placeholder art: `../set/gen_art.py ep06 <tone>`.

## TODO / open
- Procedural placeholder art (marked on screen); real text-free art per `art-prompts.md`.
- Every claim OPEN (carried over, not page-read); dermatologist sign-off; no score or effects; draft tier only (no final render, YouTube 1440 version or `qa.py`).
- Footers sit in the bottom platform UI zone, as the art direction specifies; confirm.

- Pictures: the owner makes five per `ART-PROMPTS-CHATGPT.md` (`ep06-01` ... `ep06-05`, .png or .webp, 941 × 1672); until they arrive `episode.json` falls back to procedural placeholders (`art/*.png`). After adding files run `python3 -I ../set/art_index.py ep06`, then tune the anchors in `episode.json` (only the fallbacks' anchors are known).
