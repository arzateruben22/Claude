# Project OC: roadmap

This is the plan for turning Top Speed OC: Ultra into Project OC. Items are in the brief's priority order. Each status
is what the code does today, checked in a browser. Nothing is marked done on trust.

**Status key**
- **Done**: built and verified. See `PROJECT_OC_PROGRESS.md` for how.
- **Partial**: some of it works. The gap is named.
- **Planned**: designed, not built.
- **Roadmap**: needs things this project doesn't have yet, such as a server, licences or artists.

## P0: a stable, playable base

| Item | Status | Notes |
| --- | --- | --- |
| Audit of the existing projects | Done | Three exist. `top-speed-oc/` is v1/v2, a single-file canvas game, kept as it was. `top-speed-oc/loop.html` is the Loop Lab preview. `top-speed-ultra/` is the 3D engine, and the base for Project OC. Trade Crawler is untouched. |
| Stable game loop | Done | Fixed 120 Hz physics with interpolation. Floating origin. Recovers from a lost WebGL context. |
| Controls | Done | Phone first: steering pad, GAS and BRAKE. Keyboard and gamepad still work. The Controls screen was removed, as asked. |
| Continuous road | Done | Real freeways stream in 160 m chunks, including every ramp. |
| Collisions | Done | Barriers are real segments, including the gore noses where ramps split off. Traffic collides as world-space boxes. |

## P1: connected OC freeway prototype

| Item | Status | Notes |
| --- | --- | --- |
| Real network: I-5, I-405, CA-91, 55, 57, 22, 73, 133, 241, 261 | Done | From OpenStreetMap via Overture Maps. 20 carriageways, 1,247 ramp pieces, 1,256 junctions. Every freeway can reach every other. |
| Traversable interchanges | Done | Verified by driving: I-405 N to 55 N to 91 E to 241 S. More chains are in the progress log. |
| Chunk streaming | Done | Road chunks plus 480 m terrain tiles with two LODs, nearest and ahead first. |
| Navigation | Done | Pick a freeway and direction. A route is planned through the interchanges. A prompt says "Keep right: CA-55 North · 0.4 mi", and the map shows a yellow line. It reroutes if you miss a turn. |
| Labels and destinations | Partial | Green guide signs show real OSM destination text. There are no exit numbers, because OSM `junction:ref` isn't in the source data. |
| Ferrari-inspired cockpit | Done | Original model of our own "R" make: carbon and leather wheel, shift lights, round tachometer, screens. |
| Dashboard | Done | The real tachometer and gear display in the cluster. The HUD is minimal. |
| Traffic AI | Done | Intelligent Driver Model. Signalled lane changes with gap checks. Trucks keep right. Cars follow freeways into the next one at Y junctions. |

## P2: modes, scoring and saves

| Item | Status | Notes |
| --- | --- | --- |
| Five traffic levels | Done | None, Light, Moderate, Heavy and Expert. Expert has 45% aggressive drivers: shorter gaps, quicker lane changes. |
| Deterministic traffic | Done | Seeded. Time Trial always uses the same seed and start. |
| Mini camera | Done | The corner window is either a road map or a live sky camera 150 m up. Tap it to switch. Three sizes. |
| Speed Survival scoring | Done | The streak counts time over 100 mph. Clean passes and near misses build a combo. A real crash ends the run. |
| Exploit resistance | Done | Each car scores once. Stopped cars don't count. No score while wrong-way. Walls and contact reset the streak. The clock pauses with the game. |
| Local leaderboard | Done | Top ten per mode, labelled "Local leaderboard · this device only". |
| Versioned profile | Planned | Username, avatar, level and XP, time, distance, best streak, wins, vehicles, currency, achievements. Saved locally with a version number. |
| Physics: arcade to sim | Partial | A slider controls assists and tyre falloff. Sim mode had an oscillation at about 175 mph. The tyre falloff is now smooth and needs a re-test. |
| Auto and manual gearbox | Done | |

## P3: world and progression

| Item | Status | Notes |
| --- | --- | --- |
| Weather and day/night | Planned | Clear, cloudy, rain, fog, mist, sunrise, sunset and night, set by hand. Live weather only with an authorised API, with a simulated fallback. The sky and lights already exist. |
| Driver archetypes | Planned | Three of them, each with male and female versions. Cosmetic hand animations. |
| Abilities | Partial | `Traffic.thin()` is the hook for Clear Path: it removes 35% of the cars you can't see. Focus Time would slow the world 30% on a defined timescale. The framework (cooldown, duration, UI) isn't built. |
| AI races | Planned | Checkpoint, sprint, time trial and endurance. Countdown, standings, rewards. |
| Economy, garage, showroom | Planned | Fictional currency only, never real money. One car to start, more garage slots by level. |

## P4: depth

| Item | Status | Notes |
| --- | --- | --- |
| Ultra Realism Mode | Planned | Unlocks by level. Tunnel vision, camera shake and muffling, each toggled on its own. |
| Radio | Roadmap | Fictional stations with original or licensed audio only. No scraped streams. |
| City expansion | Roadmap | The pipeline already pulls arterial streets. Driving them needs intersections and signals. |
| Golden Road vertical slice on foot | Roadmap | Simulated crowds. It must never claim live occupancy. |

## P5: later

| Item | Status | Notes |
| --- | --- | --- |
| Multiplayer | Roadmap only | It doesn't exist and isn't claimed. It needs a server, accounts and anti-cheat. |
| Housing, arcade track, commercial features | Roadmap | The arcade loop track stays as "Coming soon" (Loop Lab). |
| LA County and beyond | Roadmap | Same pipeline with a bigger bounding box. The data budget is the constraint: about 1.2 MB per county. |

## How realistic can it get?

There are three honest tiers.

1. **Now.** Real road geometry and real terrain, with procedural textures and models, in a browser and on a phone.
   It reads as a clean, stylised real world, not as a photograph.
2. **Next.** Licensed or photogrammetry car and cockpit models, HDRI skies, photo textures, and real building
   footprints from Overture's buildings theme. All of it is feasible in Three.js. It costs asset licences, download
   size and phone performance.
3. **Photoreal.** That means Unreal Engine 5 or similar, a team of artists, months of work, and native apps. A
   browser game on a phone can't get there.
