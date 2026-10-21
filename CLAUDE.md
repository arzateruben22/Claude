# CLAUDE CODE — PROJECT OC VISUAL DATASET GUIDELINES

You are assisting with an Orange County-inspired open-world driving + Sims-style lifestyle game. Preserve the existing user's project; INSPECT its source and framework before implementing systems, selecting render pipelines, or adding dependencies. Never falsely claim the reference library contains full 3D models, 4K images, or 3,000 existing render files.

## Inputs
- `README_START_HERE.md` describes actual vs planned assets.
- `00_MASTER_REFERENCE_BOARDS/` supplies moodboard-level comparison across three modes.
- `00_SHARED_DESIGN_FOUNDATION/` supplies OC Prototype 01 identity and existing luxury UI references.
- `LOW/README_MODE.md`, `HD/README_MODE.md`, `ULTRA/README_MODE.md` define mode-specific visual rules.
- `04_METADATA/scene_manifest_3000.jsonl` is the canonical list of 3,000 distinct SHOT REQUESTS.
- `05_CLAUDE_BATCHES/{MODE}/batch_XX.md` contains 25 image prompts per file.

## Mode selection
- **LOW:** nostalgic retro visual language, pixel-style/low-poly visuals, large playful UI.
- **HD:** modern believable realism, premium restrained usability.
- **ULTRA:** speculative hyper-real premium silver/ice-blue identity, cinematic effects, advanced high-end UI.
- Retain compatible world structure and gameplay logic across modes. The three concepts are distinct VISUAL TARGETS rather than hardware graphics presets proven to run in one engine.

## Sector mapping
01 HOME_SCREENS_MENUS; 02 HUD_UI; 03 MAP_NAVIGATION; 04 VEHICLES; 05 DRIVING_STREETS_HIGHWAYS; 06 NEIGHBORHOODS_LOCATIONS; 07 INTERIORS_PROPERTIES; 08 CHARACTERS_SIMSLIFE; 09 ACTIVITIES_MINIGAMES; 10 WEATHER_TIME_EVENTS; 11 CINEMATICS_STORY; 12 PROPS_ASSETS_DETAILS.

## Camera coverage
Include first-person cockpit driving, third-person chase driving, hood/bumper cameras, drone/cinematic cameras, first-person Sims-style on-foot interaction, third-person over-shoulder Sims-style character control, and free-orbit/isometric dollhouse household views. Actual gameplay must have camera controls, occlusion handling, hit testing, collision, and camera transitions; screenshots alone do not implement these.

## Batch render process
1. Audit existing assets and generator/engine availability. Ask for any missing access needed to run image-generation jobs.
2. Use a single source of truth: JSONL `id`, `sector`, `camera`, `prompt`, `relative_output_path`.
3. Generate images individually; preserve uniqueness; no cropping a board into 1,000 files and claiming they are distinct images.
4. Write valid outputs to the exact per-shot paths. Log provider, dimensions, generation settings, prompt, seed or job ID where available, cost, image hash, and QC status separately.
5. Verify before marking complete: valid file, >= required dimensions if reporting 4K, camera correctness, consistent signature vehicle, consistent world topology, UI typography, no severe hallucinations.
6. Start by producing a balanced pilot batch of 5–10 actual shots per mode, including Sims third person, Sims first person, isometric house, cockpit highway, neighborhood aerial, garage, and UI. Request review before queueing thousands more to avoid mass-scale style drift or waste.
7. If generation backend cannot deliver native 4K, report its supported size and consider 4K upscaling as a separate, clearly labeled process.
8. Game integration: images are reference material; build 3D assets, UI and interactions separately. Do not place flat concept art as substitutes for systems.

## First recommended task for Claude
Inspect the user's real game repo and map the architecture. Open the HTML gallery. Read 3 mode README files; then generate 1 hero image for each mode, 1 matched Newport Beach neighborhood scene for each mode and 1 first-person/third-person/isometric life-sim camera image for each mode using whatever image-generation service the user authorizes. Make a cross-theme comparison report with true dimensions and quality findings before bulk generation.

## v2 additions
Read `06_DESIGN_TOKENS/design_tokens.json` as the canonical color/UX tokens and `06_DESIGN_TOKENS/CAMERA_POV_BIBLE.md` for camera intent. Open `03_BROWSE_GALLERY/pilot.html` to browse sector crops and read `07_PILOT_RENDER_QUEUE` for the exact 36-image test batch. Consult `04_METADATA/asset_provenance_v2.csv` before counting finished images. Do not mark a board crop as an individually rendered shot.
