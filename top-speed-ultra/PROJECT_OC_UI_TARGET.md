# Project OC: the HUD and menu target

On 2026-10-15 the owner sent a nine-panel concept board for the game's HUD and menus (a generated mock, not stored
in the repo), alongside the cockpit reference described in `PROJECT_OC_VISUAL_TARGET.md`. This file maps every
panel to what the game has, what gets built, what stays roadmap, and what we don't take. It is the brief for the UI
pass. The look stays "Chrome noir" (`src/ui/styles.css` tokens); the board's black-and-gold reads close to it, and
the yellow accent is already ours.

## What we don't take

- **The car.** Panel 5 shows a real production sports car with its maker's name. The garage keeps our four
  fictional cars (Rossini GT, Brio, Corsa, Vela E) and the "R" badge. No real brand, badge or model name anywhere.
- **Money.** The "Bank" app with a dollar sign becomes **Credits** (earned by driving only). No prices in currency,
  no purchases, no wallet.
- **Claims we can't keep.** "Traffic: Light" as live data (ours is simulated; say "Traffic: Moderate · simulated"),
  "Social" as multiplayer (there is none; the Social app is sharing your run card and the local leaderboard), "HDR"
  as a display mode (a browser can't promise it; the toggle is "Tone mapping: filmic / neutral"), "Contacts" and
  "Messages" as a story system (roadmap; until then the phone shows what exists).
- **The mock's icons, fonts and artwork.** Re-drawn in our style with our own icons.

## Panel by panel

| # | Panel | Have today | Build (this pass) | Roadmap |
| --- | --- | --- | --- | --- |
| 1 | **Clean minimal HUD** (hidden until needed, windscreen clear) | Minimal HUD: speed cluster, route chip, top bar, ability button | **U1 Adaptive HUD**: the top bar and corner slide away after 4 s with no input while driving; speed, gear, the nav prompt and the ability ring stay; any tap, mouse move or key brings it back; a `HUD style` setting (Modern / Minimal). The small compass strip and a clock + temperature chip top right (device clock; temperature from the chosen weather, labelled simulated). | |
| 2 | **Expanded navigation HUD** (lane guidance, upcoming exits) | Route planner with "Keep right: CA-55 North · 0.4 mi" prompt, mini map with the yellow route line, real exit signs | **U2 Navigation card + road chevrons**: a card top-left with the manoeuvre arrow, the road name in sign style ("I-405 NORTH"), distance and the next exit's real sign text; a destination card top right (destination, estimated time at your pace, traffic density labelled simulated); and on the road itself a blue chevron path along the planned route for the next 300 m, lane-accurate at diverges, fading with distance, visible from every camera, off when there's no route. | Turn-by-turn on surface streets (no streets yet) |
| 3 | **Radial quick menu** (hold a button while driving) | Top bar buttons: View, Map, Go To, Radio, Pause | **U3 Radial menu**: hold the pause/menu button (touch: long-press the top bar's menu chip; keyboard: hold Tab; gamepad: hold Back) for 300 ms to fan out six wedges around the centre: Map, Go To, Garage (opens the garage, driving pauses), Radio, Camera (cycles the view), Settings; release on a wedge to pick. Reduced-motion users get a plain list. | Phone wedge once the phone has content |
| 4 | **Full-screen map menu** (locations, missions, filters) | Mini map (road map or sky camera), Go To panel (freeway + direction), Start at your exit | **U4 Full map**: a full-screen map of the network drawn from `oc-network.json` (the roads, your dot, the route), pan and pinch-zoom, a left rail (Map, Drive, Garage, Races, Profile, Radio, Settings) and a filter list on the right: Races (the four courses, tap to start), Garages (the showroom), Exits (every real exit; tap = Set waypoint), Landmarks (a handful of our own fictional POIs: Lot 57 on Orangewood, the Loop Lab), Houses and Characters greyed out with "roadmap". "Set waypoint" plans the route; "Fast travel" restarts you at that exit (it says so: no teleporting mid-drive). City labels from the data (Huntington Beach, Newport Beach, Irvine, Anaheim …). | Missions, shops, houses, characters |
| 5 | **Garage menu** (vehicles, upgrades, customise, paint, wheels) | Garage with four cars, stat bars, buy and sell, showroom | **U5 Garage tabs**: Vehicles (as now), Paint (a palette of six paints per car, applied live to the preview render in the panel; stored in the profile), Wheels (two rim styles per car), Upgrades and Customize shown as tabs with "coming later" (no fake content). Keep the credits display, no currency symbol. | Upgrades (engine, tyres, aero) with credits |
| 6 | **Phone menu** (in-game phone) | Feedback report, Share run, Profile, local leaderboard | **U6 Phone**: a phone-shaped overlay (portrait, slides in from the right) with apps that only open what exists: Races (the courses), Map (U4), Garage, Credits (balance and the last ten earnings, no $), Radio (U7), Share (the run card and the local leaderboard, labelled this device only), Feedback, Settings, Profile. Messages and Contacts appear greyed with "roadmap". The phone's clock is the device clock. | Messages, contacts, missions from characters |
| 7 | **Radio / media menu** | Three code-composed stations (KCST 101.5 Coast, KFWY 96.9 Freeway FM, KNYN 88.3 Canyon Radio), station idents | **U7 Radio panel**: Now playing (station art drawn in code, the station name and a generated "track" name), play/pause, previous/next station, a station list with Favorites (starred, stored locally). Add three stations in new generative styles if the audio budget allows (e.g. a Latin rhythm station, a lo-fi station, a classic-rock-shaped one), all composed in code, all fictional names and call signs; otherwise the three we have. "Playlists" tab reads "Your own music: coming later" (no file access claims). | Licensed audio, user playlists |
| 8 | **Settings menu** (graphics, controls, HUD, audio, gameplay, language, account) | One Settings panel: quality, adaptive, density, time, weather, start, corner, presentation, skin, handling, transmission, fov, realism | **U8 Settings sections**: a left rail with Graphics (quality, adaptive, FOV, motion blur on High/Ultra only, tone mapping), Controls (pad side, steering sensitivity, transmission), HUD (style Modern/Minimal, minimap, speedometer units mph/km/h, navigation arrows, chevrons), Audio (master, radio, engine, effects), Gameplay (traffic density, handling, realism), Language (English; Spanish "coming later"), Account (your local profile: name, avatar colour, export/erase the on-device data). Every existing setting keeps its accessible name so the suite still finds it. | Cloud account, language packs |
| 9 | **Adaptive HUD (auto-hide)** | | Covered by U1; the corner mini map stays as a small round nav bubble with the next manoeuvre and distance when the full HUD is hidden. | |

## Rules for the pass

- Phone first: every screen works at 390 × 844 portrait (one column, big touch targets) and at 1440 × 900.
- Keep every accessible name, role and class the regression suite relies on (`tests/regression.mjs`: `phone`,
  `launch`, `boot`, `render` groups) or update the suite in the same change with a reason.
- Reduced motion: no fan-out or slide animations when `prefers-reduced-motion` is set.
- Contrast 4.5:1, focus states, keyboard reachable.
- No new dependencies. Icons drawn as inline SVG.
- Verify with `tools/ui-shots.mjs` (all screens, both sizes) and `npm test -- --only=phone,launch,boot`.

## Order

U1 adaptive HUD → U2 navigation card and chevrons → U3 radial menu → U8 settings sections → U4 full map → U6 phone →
U7 radio panel → U5 garage tabs. Each is one change with its own screenshots and suite run.
