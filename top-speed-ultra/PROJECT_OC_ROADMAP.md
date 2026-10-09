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
| Versioned profile | Done | Name, avatar colour, level and XP, fictional credits, time, distance, top speed, best streak, near misses, passes, interchanges, races won, cars, nine achievements. Saved on the device as v1, with a migration path. |
| Physics: arcade to sim | Done | A slider controls assists and tyre falloff. Steering lock is speed-sensitive. Sim has a light race-mode stability control. No spins at 134, 168 or about 200 mph on the autopilot. |
| Auto and manual gearbox | Done | |

## P3: world and progression

| Item | Status | Notes |
| --- | --- | --- |
| Weather and day/night | Done | Live puts the sun at its real position over OC from the device clock. Presets: sunrise, day, sunset, night. Weather: clear, cloudy, rain, fog, mist, or changing. Rain gets streaks, a wet road, about 20% less grip and slower traffic. Night gets stars, moonlight, headlight beams and lit lamps. **No live weather feed**: none is authorised here, so weather is simulated. A future paid weather pass would be designed only; no payments exist. |
| Driver archetypes | Done | The Closer, The Ace and The Wrench, each male or female, with five skin tones. Cosmetic: sleeves, gloves, gold, steel or smart watch, ring, bracelet. Hand animations: a watch check, a wave, one hand on the knee. |
| Abilities | Done | Clear Path (8 s, 45 s cooldown): 35% fewer cars by flow and spawning. Cars ahead move over; nothing in view vanishes (verified). Focus Time (5 s, 40 s): the world at 0.70× (verified). Locked In (7 s, 35 s): grip ×1.3 (verified). There's a round HUD button with a cooldown ring, and the F key. |
| AI races | Done | Irvine Sprint (405 N), Santa Ana Checkpoints (I-5 N), Foothill Sprint (241 S) and Riverside Endurance (91 E), plus Time Trial. Three rivals, a countdown that holds everyone, live position, gates, the finish, credits and XP, best times. |
| Economy, garage, showroom | Done | Credits are earned only. Four fictional cars with their own power, weight, gearing, drag, downforce and grip. One body for now; the paint changes. Garage slots: 1 + level/4. Buy, choose and sell for 60%. |

## P4: depth

| Item | Status | Notes |
| --- | --- | --- |
| Ultra Realism Mode | Done | Opens at level 5. Tunnel vision, camera shake and muffling, each switched on its own. Shake follows reduced-motion. |
| Radio | Done (framework) | Three fictional stations (KCST 101.5 Coast, KFWY 96.9 Freeway FM, KNYN 88.3 Canyon Radio) play music composed live in code. Nothing is recorded, licensed or streamed. More stations or licensed audio can plug into the same `Radio` class. |
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
