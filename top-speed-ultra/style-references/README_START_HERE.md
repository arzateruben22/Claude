# Project OC — Three-Mode Visual Library v2

## Exact completion status — IMPORTANT

**v2 adds:** three original multi-mode composites; 9 new mode-specific crops; 36 NEW labeled individual sector thumbnails (from composite boards, not native independent renders); a 30-shot QA pilot, provenance manifest, exact color tokens, camera bible, and an additional visual gallery at `03_BROWSE_GALLERY/pilot.html`. The 3,000 image generation queue remains unrendered.

- **3,000 scene specifications planned**, exactly **1,000 per art style** (LOW / HD / ULTRA).
- **8 newly generated, original three-theme reference contact sheets** included under `00_MASTER_REFERENCE_BOARDS`.
- **24 mode-specific moodboard crops** included (5 per mode, separated by columns).
- **36 original sector reference strip crops + 36 newly cropped labeled board-08 panels** included (12 per mode; derived from one contact sheet).
- **5 shared prior Project OC vehicle / interface design references** included.
- **0 of the 3,000 planned scenes have been individually rendered at 4K.** Existing references are smaller composite images; splitting them into crops does not create resolution or produce a new camera angle. A 1,000-image label inside concept art is an aesthetic caption, not a count of separate files.

### How to browse

Open `03_BROWSE_GALLERY/index.html` locally in a browser. It loads relative `gallery_data.js` so it does not need a web server. Choose a mode, a sector and a camera view, inspect existing moodboards and copy any of the 3,000 planned prompts.

### Folder architecture

- `00_MASTER_REFERENCE_BOARDS/` — original multi-mode concept boards
- `00_SHARED_DESIGN_FOUNDATION/` — signature OC silver/ice-blue car and prior UX concept references
- `LOW/`, `HD/`, `ULTRA/` — separated mode boards, 12 reference sectors, placeholders for 1,000 future standalone output images in each mode
- `03_BROWSE_GALLERY/` — local interactive HTML reference and prompt explorer
- `04_METADATA/` — 3,000-shot JSONL and CSV, allocation table
- `05_CLAUDE_BATCHES/` — 120 batches, 25 separate image prompts each; organized by mode
- `CLAUDE.md` — instructions to Claude Code for generation/implementation

### Runtime constraints

Claude Code can work with the references and write game logic but **a 3,000-frame image library requires an external image generation backend** and a possibly substantial generation budget. Actual 4K production will require a provider that supports the requested output or a deliberate render/upscale pipeline. No provider API keys or payments are included. Do not promise 4K from images that are not natively 4K.

### Fidelity definitions

- LOW = a deliberate retro game art direction; not a flawed/bad game.
- HD = polished contemporary realism.
- ULTRA = futuristic premium hyperreal aesthetic; "ULTRA" does not certify 4K resolution in the included boards.

### Identity continuity

Treat the provided OC silver hypercar reference as a design target, not a manufactured car CAD or multi-view exact-dimensional specification. Use stable asset names, reference matching, and review approval for each new vehicle angle, character, and neighborhood set. For Sims-style cameras, include first-person interaction, third-person character-follow, isometric dollhouse, and free-orbit interior perspectives.
