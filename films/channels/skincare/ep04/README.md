# Skin Sense No. 004: "The Message Behind a Frown" (full episode, new art direction)

Draft: `review/skin-sense-004-preview.mp4` (66.5 s, 540×960, voice only), `review/contact-sheet.jpg`. Built to `../ART-DIRECTION.md` (branch `claude/skin-sense-art-direction`) and Standards v2 (`../../briefs/STANDARDS-v2.md`).
Deliverables: `script.md`, `review/scene-table.md`, `review/claims-table.md`, `review/clarity-review.md`, `art-prompts.md`. The earlier 3D draft is archived in `old-3d/` (not deleted; its relative paths no longer work). A 26 s sample is in `../ep04s/`.

Build: `python3 -I build.py` (film.json, mix.m4a from `vo/`), then `node kits/cinema/film/render.mjs --film films/channels/skincare/ep04 --tier draft --plain [--assemble --audio films/channels/skincare/ep04/mix.m4a]`. Voice: `voice.py` (bf_isabella, one speed per line), then `kits/cinema/voice/align.py`.
Art slot: `episode.json` images (`art/ep04-0N.png|webp`, fallbacks `art/placeholder.png`, `art/section.png`; list files with `../set/art_index.py`); engine `../set/ss3.mjs`. Old: `art.json` + `art/placeholder.png` (a marked reference crop, baked text painted out). The owner's eight pictures are in (`art/ep04-01` ... `08`, plus `01b-alt`, commit a3ae511 of `claude/skin-sense-art`); the placeholders remain only as fallbacks.

## TODO / open (list in every handoff)
- No score or effects, draft tier only (no final render, no YouTube 1440 version, no `qa.py`).
- All claims SOURCE-READ, none person-checked; dermatologist sign-off required (treatment topic).
- Footers sit in the bottom platform UI zone, as the art direction specifies; confirm.
- Handle and trademark checks for the channel name; end-card tease depends on No. 005.
