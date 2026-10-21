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

## Owner's direction, 2026-10-16: seamless, with a finer luxury feel

"Make the main menu more seamless and have a finer luxury Apple-like aesthetic feel to it." This is the first item
of the UI pass (U0) and the lens for the rest: Chrome noir's base and yellow accent stay, the angled chips and
magenta corners go. Frosted-glass panels over the live attract drive, hairline borders, large soft radii, generous
spacing on an 8 pt rhythm, a refined system font stack for text (San Francisco on Apple devices, zero bytes), light
and regular weights, one persistent glass sheet whose content cross-fades between screens instead of panels
re-mounting, a Drive dock that persists, a loading screen that fades into the menu, iOS-style switches and segmented
controls drawn in CSS, reduced motion respected. Phone first.

## Identity: the OC sunset wordmark (owner, 2026-10-16): Done

**The name (owner, later the same day):** the game is now **OC Ultra**, with **Top Speed** beneath. The R badge is
no longer the game's logo: the lockup is the OC wordmark with ULTRA and a small "TOP SPEED" line. The R stays
where it is the car brand (the Rossini badge on the wheel and the bodies). The page title is "OC Ultra: Top Speed";
the run card, share text (#OCUltra), download name and feedback report use "OC Ultra".

The owner supplied the game's wordmark: the letters "OC" cut like a racing decal, filled with an Orange County
sunset (orange to red sky, the sun on the horizon, a downtown skyline, palms, the freeway with tail lights and an
overpass), on black, with a thin orange-to-red edge and speed streaks. It replaces every "OC" in the HUD and the
menus, and its theme runs through the rest where it fits without shouting:

- **Assets** (`src/ui/assets/`): the source stays out of the repo (1.2 MB); the repo carries a transparent cut-out
  (the exterior black keyed to alpha by a border flood fill, so the dark silhouettes inside the letters stay) as
  WebP at 1200 px and 480 px wide, a 240 px version for small chips, and `oc-mask.png` (the letterform alpha) for
  CSS masks and the run card. Budget: all variants together under 200 KB in the single-file build.
- **Where it goes**: the menu's brand block (the wordmark above a quiet "Top Speed · Ultra" line; the chromed
  "ULTRA" wordmark steps down to a subtitle), the loading screen, the pause screen's header, the results screen,
  the run card (replacing the "TOP SPEED OC" text line), the HUD's route chip and position box as the 240 px mark
  where "OC" would read, the radial menu's centre, the phone's status bar, the feedback report header line (text
  stays "Top Speed OC" there and in the page title: text, not an image).
- **Theme tokens** (sampled from the wordmark, tuned for 4.5:1 contrast on the violet-black base): `--sunset`
  (the sky orange), `--ember` (the red edge), `--amber` (the sun's highlight), `--night` (the black), plus a
  horizontal `--sunset-edge` gradient for hairlines and the Drive dock. The yellow accent becomes this sunset
  family; the violet-black glass base and the luxury rules stay (one accent, hairlines, generous spacing).
- **Where it fits**: a sunset-gradient hairline on panel tops, palm and skyline silhouettes at 6–8 % opacity as a
  watermark on the loading and pause screens (drawn in code from the mask, not a second image), tail-light red
  for danger states, amber for selection; never a full-bleed orange screen, never the wordmark stretched.
- **Honesty**: the skyline in the mark is stylised, not a claim of any real building; nothing in it is a brand.

## Owner's direction, 2026-10-21: the ice reference (menu, drive HUD, the hypercar, the colour world)

The owner sent a second concept board (a generated mock, not stored in the repo; a copy sits in the session
scratchpad only): the main menu with the OC Hypercar as its hero, and the cockpit view with its HUD. The direction was
"keep rendering graphics for this car and HUD interface, as well as overall themes of colour". What was taken, and
what the game now does:

- **The colour world: "Ice noir".** The violet-black base becomes navy-black; the sunset family (orange, amber) as the
  accent becomes the hypercar's LED: `--ice` for the thing to press and for focus, `--cyan` for what's selected,
  `--ember` (tail-light red) stays for danger only. Chrome stays, a touch cooler. The tokens kept their roles; every
  rule reads from them, so the whole UI (panels, settings, garage, results, the run card's hairline) changed in one
  place. Contrast is in the token comments (ice 7.9:1 on the base, ice-text 5.5:1 over a HUD plate on a white sky).
- **The OC mark in chrome.** The owner's sunset wordmark gave the letterform; its alpha (`oc-mask.png`) is now filled
  with brushed chrome and lit from below in ice (`.oc-mark` in `styles.css`), like the chromed OC on the reference's
  showroom wall. The 480 px sunset cut-out stays for the run card (a canvas). The 1200 and 240 px cut-outs were removed
  from the bundle. The game's name stays **OC Ultra: Top Speed** (owner, 2026-10-16); the mock's "Project OC /
  Orange County Freeway Simulator" is the project's working title, not a rename. If the owner wants the mock's
  wording in the UI, that is a one-line change in `Mark.tsx` (`lockup-sub`).
- **The main menu** (`App.tsx`, `.menu-grid`): a glass rail down the left with the brand, **Drive** (the one filled
  row, deep ice), the loadout rows (Car, Driver, Start on or Race, with line icons), the traffic chips, then Profile,
  Bests, Settings and an **Online** row greyed "Roadmap" (multiplayer does not exist and is not claimed); the player
  card top right (avatar, name, level with an XP bar, credits with no currency sign); the live scene as the hero in
  the middle; the four modes as picture cards along the bottom (`ModeArt.tsx`, four night scenes drawn in SVG, no
  photos), the chosen one lit cyan; the Loop Lab card and the data credits under them. Phones: one column, Drive
  pinned under the thumb. The mock's "World map", "Customization", "Career" and "Events" map to Start on, Driver +
  Garage, Profile + Bests, and Speed Survival + Time Trial; nothing was added that does not exist.
- **The drive HUD** (`HUD.tsx`): the mode and its numbers top left on an ice-edged plate with the small chrome OC;
  the road as a real guide sign top centre (the route shield, then the direction) with the manoeuvre under it; the
  controls as a rail of icons down the right (View, Go to, Radio, Pause; a strip along the top on phones); the speed
  block bottom right with the revs as a slanted ice bar, big light numerals, the gear in an outlined box, and chips
  for the handling profile (Arcade / Sport / Sim from the slider), ABS and TCS (the physics runs both at every
  setting) and **Unleashed** when the hypercar runs its Free Drive tune; with a mouse, the road map is a round dial
  bottom left. The mock's "Photo mode" and "Phone" are not built (roadmap: U6).
- **The hypercar** (`src/preview/car-*.ts`, `cockpit.ts`, `car-gauges.ts`; judged on night renders in
  `tests/out/preview/ice/`): the LED family re-tuned so it tone-maps to the reference's ice blue instead of blowing
  out to white (deeper material blues under ACES), the headlamp blades as the night's main feature, the splitter and
  sill strips, blue calipers; a driver display of its own (OC, 132, MPH, the gear in a box, hexagonal ice frame,
  SPORT / ABS TCS on the centre screen) in place of the Vela's; ice-tinted beams and road pool at night. The body's
  remaining gaps are M1b's queue (`PROJECT_OC_HYPERCAR.md`).

- **The atmosphere follows the car** (owner, later the same day: "every specific car we choose, each one
  representing a different atmosphere"). `App.tsx` puts the chosen car's id on `<html data-car>` and `styles.css`
  re-points the tokens per car, so the menu's haze, the rail, the cards, the HUD plates and the panels all change
  with the car: the **OC Hypercar** is the ice reference; the **Rossini GT** (the starter) keeps the owner's OC
  sunset (orange and amber over violet-black, the wordmark's colours); the **Rossini Brio** is the coast at dusk
  (aqua over deep sea green); the **Rossini Corsa** is a track day (racing yellow on graphite, black ink on its Drive
  plate); the **Vela E** is an electric charge (violet over plum with a magenta flash). Contrast is in each block's
  comment. The 3D clusters were already per car (the GT's amber tach, the Vela's blue display, the hypercar's ice).
  Drivers do not change the atmosphere yet; that is the next step if wanted (a second attribute, `data-driver`).

- **The driver's layer and a more futuristic language** (owner, later the same day: "do the same for each driver,
  keep upscaling the ultra graphics, adapt to a more futuristic theme, including freeways, trees, other NPC cars,
  fashion clothes"). The car sets the world; the driver signs the human elements with their own colour, `--drv`
  (`<html data-driver>`): **The Closer** gold (the watch), **The Ace** a cool lavender (focus), **The Wrench**
  a vivid green (the smart watch's grip readout). It lights the ability hexagon, the Driver row, the avatar's ring and
  level line, and the Driver panel's choice. The futuristic details are decoration only: a hex lattice behind the
  rail, the panels and the player card, chamfered HUD plates with faint scanlines, brackets that lock onto the speed,
  and a slow sweep of the accent along the rail's top edge (off with reduced motion). The world itself (freeways,
  trees, traffic, night lighting), the menu's attract drive taking each car's time and weather, an Ultra-only grade
  (vignette, edge chromatic aberration, grain) and each driver's clothes are separate lanes, logged in
  `PROJECT_OC_PROGRESS.md` when judged.

What was not taken: the mock's car photo, fonts and icons (ours are drawn), the "$" (credits are earned), "Online"
as a feature, and the mock's showroom floor as the menu hero (the attract drive stays the hero; a showroom stage for
the hypercar is M6's reveal stage).

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
