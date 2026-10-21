# Project OC: the style guide

The owner's style library ("Project OC Three-Mode Visual Library v2") is the canonical reference for how the game
looks. This file says what it holds, what the game takes from it, what it doesn't, and what is still the owner's
decision. Agents working on anything visual read this first, then `PROJECT_OC_VISUAL_TARGET.md` and
`PROJECT_OC_UI_TARGET.md`, which it now leads.

## Where the library is

- **The full library** (images and zips) is on the branch `style-references`, commit `b42326e`, at the repo root:
  `HD/` and `ULTRA/` (boards and crops), `LOW.zip` (all three modes' boards and crops, LOW's only copy),
  `07_PILOT_RENDER_QUEUE.zip` (the metadata, the design tokens, the 120 prompt batches and the pilot queue).
- **The text files** are copied into this folder at `style-references/`, so every session has them without the
  branch: `design_tokens.json` (canonical colours and UX rules), `CAMERA_POV_BIBLE.md`, the three
  `*_README_MODE.md`, the three `*_TWELVE_TEST_SHOTS.md` (the 36-shot pilot), `sector_allocations.csv`,
  `README_START_HERE.md`, and `LIBRARY_CLAUDE.md` (the library's own instructions, see below).
- **Not in the upload:** `00_MASTER_REFERENCE_BOARDS/`, `00_SHARED_DESIGN_FOUNDATION/` and `03_BROWSE_GALLERY/`,
  which the library's README names. If they matter, they need a second upload.

### What the library is, honestly (its own words)

- Boards are 1536 × 1024 composites; crops are smaller. **No image is native 4K** and none is a standalone render.
- The 3,000 scenes (1,000 per mode) are **planned prompts, not images**: `status: PLANNED_NOT_RENDERED` on every row
  of `scene_manifest_3000.jsonl`. Producing them needs an image-generation service with an API key and a budget
  (none in this project), and the library itself says to run a 36-shot pilot and have it reviewed first.
- Images are **reference, not game assets**. The game builds its 3D, UI and interactions in code; a flat concept
  image never stands in for a system.

## The three art directions

The library defines three **visual targets** that share one world, one map, one set of cars and one set of
systems. It says plainly that they are not hardware presets. The game's Graphics setting (Low / Medium / High /
Ultra) is a performance ladder; today's look is the ULTRA direction at every preset.

| | LOW: Retro Arcade | HD: Modern Realistic | ULTRA: Futuristic Luxury |
| --- | --- | --- | --- |
| Colour language | sunset peach, turquoise, electric purple, yellow, orange, saturated cobalt | graphite, matte slate, champagne silver, muted blue, California golden hour | liquid silver, ice blue, platinum, obsidian, sparse electric cyan |
| Background | #18235D | #0A111D | **#030915** |
| Primary | #FFBD3D | #E8ECEF | **#DDE9F3** |
| Secondary | #51DAE8 | #CB904E (champagne) | **#8BD6FF** |
| Accent | #F164A4 | #61B4E8 | **#408CFF** |
| Foreground | #FFF9EC | #F3F5F7 | **#F6FBFF** |
| Success | #6EE68B | #6AC7AE | **#6FF7DE** |
| Type | blocky 8/16-bit pixel headings, a readable fallback for dense UI | humanist or squared contemporary sans, restrained uppercase navigation | extended geometric sans, hairline tracking, strong hierarchy |
| Corner radius | 4 px | 8 px | 10 px |
| HUD opacity | 1.0 | 0.86 | 0.78 |
| Materials | flat-shaded low-poly or pixelised textures, hard step edges | real glass, metal, asphalt, palms, environmental light | silver titanium, optical glass, micro-detail, controlled blue emissives, photoreal reflections |

**Done (2026-10-21):** the game's default atmosphere (and the hypercar's) now uses the ULTRA tokens exactly
(`src/ui/styles.css` `:root`; the contrast of each is in its comment: accent 6.1:1, secondary 12.5:1, foreground 19:1
on #030915). The other cars' atmospheres (sunset GT, aqua Brio, yellow Corsa, violet Vela E) stay as the owner asked
the same day: the car sets the accent inside the art direction, the driver signs the human elements.

### Rules every direction keeps (`design_tokens.json`, interface_guidelines)

- The world and the car stay dominant; UI lives at the edges. Vital readouts keep a 5 % horizontal and 6 % vertical
  safe area.
- Headings and buttons are rendered by the game, never baked into an image.
- Every control has keyboard and controller mapping, focus, hover and selected states.
- **Bloom must not wash out road signs or mirrors.** (Ultra's bloom threshold went to 0.85 on 2026-10-21; the night
  frames show the signs and mirrors readable. Re-check whenever bloom changes.)
- Legible at 1080p; test at 1080p and 4K and scale the HUD.

## The shared navigation

The library's menu is: **Drive, World Map, Garage, Lifestyle, Career, Online, Settings**. What the game has:

| Library | The game today | Gap |
| --- | --- | --- |
| Drive | Drive | none |
| World Map | Start on (freeway and exit picker), Go to | the full-screen map (U4 in the UI target) |
| Garage | Garage (cars) | paint, wheels, customisation tabs (U5) |
| Lifestyle | none | the on-foot world (Lot 57 plan, `PROJECT_OC_ON_FOOT.md`), properties |
| Career | Profile, Bests | the same content; a rename is the owner's call (the suite finds the buttons by name) |
| Online | greyed, "Roadmap" | multiplayer does not exist and is never claimed |
| Settings | Settings | the section rail (U8) |

## Cameras (`style-references/CAMERA_POV_BIBLE.md`)

| Camera | In the game |
| --- | --- |
| DRV_COCKPIT_FP | Yes: the driver's seat |
| DRV_CHASE_TP | Yes: chase |
| DRV_HOOD_FP | Yes: hood |
| DRV_CINEMATIC (fly-by, roadside, long lens) | Yes (2026-10-21): "Cinematic" in the View cycle, four long-lens tracking shots cut hard (a low hero front three-quarter pushing in, the profile, a low rear three-quarter, a high drone); the menu's attract drive is filmed with it, the hero framed right of centre clear of the rail, as on the library's home screens |
| WORLD_DRONE | Partly: the sky camera in the corner window |
| LIFE_FOLLOW_TP, LIFE_EYE_FP, LIFE_ISO, LIFE_ORBIT | No: they belong to the on-foot and property game, roadmap |

## The twelve sectors and where they stand

01 Home screens and menus, 02 HUD, 03 Map, 04 Vehicles and 05 Driving are the game that exists, and the 2026-10-21
UI pass took the ULTRA board's menu (rail, hero car, mode cards), HUD (centred digital cluster with the speed big
and the gear under it, slanted rev bar, chips) and colour. 06 Neighbourhoods, 07 Interiors, 08 Characters (Sims
life), 09 Activities, 11 Cinematics and story are the life-sim half, roadmap. 10 Weather and time exists (live sun,
six weathers, four presets). 12 Props and details runs through everything (the OC mark, the watch, the plaque).

## What we don't take

- **Dollar amounts.** The boards show mission rewards in dollars ("Reward: $50,000"). The game has no money of any
  kind: credits are earned by driving and spent only in the game (`CLAUDE.md`). Rewards read "50,000 credits".
- **Sexualised character styling and the flirting chat.** Several boards (characters, events, social) show
  swimwear and lingerie poses and a romantic chat ("What are you wearing?"). The store plan sets a 13+ age gate.
  Characters stay in everyday or race clothing and the phone's Social app stays the run card and the local
  leaderboard. If the owner wants dating or mature content, that is a decision about the audience, the age gate
  and the store rating first.
- **Claims the images can't back:** "4K", "1,000 images", a helicopter or yacht as a feature, live services. A board
  label is a caption, not a fact about the game.
- **Real brands.** The boards' cars are our own design language; nothing real gets a logo or a name.

## Decisions for the owner

1. **Art direction as a setting.** The library treats LOW, HD and ULTRA as three looks for one game. The game could
   offer them as a setting ("Look: Retro / Realistic / Futuristic") separate from Graphics, starting with the UI
   (three token sets, as the per-car atmospheres already work) and later the world's materials. Today the game is
   ULTRA only. Building HD's UI is about a day; LOW's pixel art direction is larger (fonts, icons, a pixelated world).
2. **The image pilot.** The library's own next step is a 36-shot pilot through an image-generation service you
   authorise, reviewed before any bulk run. This project has no such service or key. It costs money per image, so it
   is your call and your account; the game does not need it to keep improving.
3. **The root `CLAUDE.md` on the `style-references` branch.** Uploading the library replaced the repo's root
   `CLAUDE.md` (the studio and Los Güeros website instructions) with the library's instructions. If that branch is
   merged into `main`, the website loses its instructions. The library's file is preserved here as
   `style-references/LIBRARY_CLAUDE.md`; restoring the root file on that branch before any merge keeps both.
4. **Career, Lifestyle, World Map as names.** Renaming Profile to Career and adding Lifestyle and World Map rows
   (greyed until built) would match the library's navigation exactly.
