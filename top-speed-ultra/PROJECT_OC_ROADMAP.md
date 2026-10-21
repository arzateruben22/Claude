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
| Menus and HUD | Done (first pass) | The "Chrome noir" redesign (the owner's "futuristic HD cyberpunk feel") is in the game since 2026-10-15: all 13 screens at phone and desktop size, the suite's names and roles kept. An art-director polish pass is still to come. |
| Continuous road | Done | Real freeways stream in 160 m chunks, including every ramp. Since 2026-10-15 the interstates and state routes are concrete slabs with joints, wheel paths and Botts' dots; toll roads and ramps asphalt; sound walls split-face block. |
| Collisions | Done | Barriers are real segments, including the gore noses where ramps split off. Traffic collides as world-space boxes. Fixed on 2026-10-12: barrier stubs left in travel lanes at ramp starts, barriers on ramps 2.5–3.5 m overhead (one in the fast lane of the 55 North at the I-5 spun cars round at full speed), and two crash cushions inside the 91. Also fixed: barrier segments that came out tens of metres long on a first look and could cut across the road for a step. A scan of every lane now finds none. |
| Regression suite | Done | `npm test` drives the built game through 50 checks across the systems below, in about 10 minutes. It found the six bugs fixed on 2026-10-12. |

## P1: connected OC freeway prototype

| Item | Status | Notes |
| --- | --- | --- |
| Real network: I-5, I-405, CA-91, 55, 57, 22, 73, 133, 241, 261 | Done | From OpenStreetMap via Overture Maps. 20 carriageways, 1,247 ramp pieces, 1,256 junctions. Every freeway can reach every other. |
| Traversable interchanges | Done | Verified by driving: I-405 N to 55 N to 91 E to 241 S. More chains are in the progress log. |
| Chunk streaming | Done | Road chunks plus 480 m terrain tiles with two LODs, nearest and ahead first. |
| Navigation | Done | Pick a freeway and direction. A route is planned through the interchanges. A prompt says "Keep right: CA-55 North · 0.4 mi", and the map shows a yellow line. It reroutes if you miss a turn. Fixed on 2026-10-12: one failed reroute (a ramp you've spun onto backwards) used to switch navigation off for the rest of the drive, and a turnaround never re-planned. The far south of the 405 and the 5 still has no planned way back north until you're turned around. |
| Labels and destinations | Partial | Green guide signs show real OSM destination text. There are no exit numbers, because OSM `junction:ref` isn't in the source data. |
| Ferrari-inspired cockpit | Done | Since 2026-10-15 the realism preview's cockpits are in the game: one per car (Alcantara, Nappa with stitching, carbon, aluminium, a live tachometer, the dashboard's ghost in the windscreen, mirrors) with the driver's anatomical hands on the rim in the chosen look. The ability poses (wave, watch check, hand on the console) are on the new hands too, blended off and back onto the rim. |
| Dashboard | Done | The real tachometer and gear display in the cluster. The HUD is minimal. |
| Traffic AI | Done | Intelligent Driver Model. Signalled lane changes with gap checks. Trucks keep right. Cars follow freeways into the next one at Y junctions. Since 2026-10-15 the vehicles are the realism preview's lofted bodies (sedan, coupe, SUV, pickup, van, box truck, and a 20 m tractor-trailer semi with ten wheels) in clearcoat paint. |

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
| Start at your exit | Done | Every real exit on all 20 carriageways, from the sign data, in the Start panel. You start 450 m before its sign. Built 2026-10-15 for the local launch. |
| Run cards | Done | "Share run" on the results screen: a 1080 × 1350 PNG drawn on the device, through the share sheet or as a download. Nothing is uploaded. |
| Feedback report | Done | Pause or Settings → Feedback: device, GPU, preset, frame rate and the drive as text to copy or share. Nothing is sent by the game. The way real-phone performance gets measured. |
| Real-phone performance | Not measured | Still no number from a real phone. The Feedback report is built for the launch ambassadors to supply them. |

## P3: world and progression

| Item | Status | Notes |
| --- | --- | --- |
| Weather and day/night | Done | Live puts the sun at its real position over OC from the device clock. Presets: sunrise, day, sunset, night. Weather: clear, cloudy, rain, fog, mist, or changing. Rain gets streaks, a wet road, about 20% less grip and slower traffic. Night gets stars, moonlight, headlight beams and lit lamps. **No live weather feed**: none is authorised here, so weather is simulated. A future paid weather pass would be designed only; no payments exist. |
| Driver archetypes | Done | The Closer, The Ace and The Wrench, each male or female, with five skin tones. Cosmetic: sleeves, gloves, gold, steel or smart watch, ring, bracelet. Hand animations: a watch check, a wave, one hand on the knee. |
| Abilities | Done | Clear Path (6 s, 45 s cooldown; with no traffic it says "No traffic to clear" and keeps its charge): 35% fewer cars by flow and spawning. Cars ahead move over; nothing in view vanishes (verified). Focus Time (5 s, 40 s): the world at 0.70× (verified). Locked In (5 s, 35 s): grip ×1.3 (verified). There's a round HUD button with a cooldown ring, and the F key. |
| AI races | Done | Irvine Sprint (405 N), Santa Ana Checkpoints (I-5 N), Foothill Sprint (241 S) and Riverside Endurance (91 E), plus Time Trial. Three rivals, a countdown that holds everyone, live position, gates, the finish, credits and XP, best times. Fixed on 2026-10-12: off the gas, the countdown's brakes selected reverse and backed you 2 m off the grid. |
| Economy, garage, showroom | Done | Credits are earned only. Four fictional cars with their own power, weight, gearing, drag, downforce and grip, and since 2026-10-15 four distinct bodies and interiors from the realism preview (GT, Brio, Corsa, Vela E). Garage slots: 1 + level/4. Buy, choose and sell for 60%. |

## P4: depth

| Item | Status | Notes |
| --- | --- | --- |
| Ultra Realism Mode | Done | Opens at level 5. Tunnel vision, camera shake and muffling, each switched on its own. Shake follows reduced-motion. |
| Radio | Done (framework) | Three fictional stations (KCST 101.5 Coast, KFWY 96.9 Freeway FM, KNYN 88.3 Canyon Radio) play music composed live in code. Nothing is recorded, licensed or streamed. More stations or licensed audio can plug into the same `Radio` class. |
| OC streets (every street in Orange County) | Next after the hypercar (owner, 2026-10-20) | All of Anaheim's streets are pulled (about 10,000 named segments and their intersections). Driving them needs a tiled street model, intersections, signals and stop signs, roundabouts, surface traffic and pedestrians; malls and parking structures from Overture buildings. First slice: the drive from the 57 into the Lot 57 spot. Design first (PROJECT_OC_HANDOFF.md, Fable prompt "OC streets"). |
| Golden Road vertical slice on foot | Roadmap | Simulated crowds. It must never claim live occupancy. |
| On foot: Lot 57, our own hangout on Orangewood Ave, Anaheim | Planned (prototype in progress) | Plan in `PROJECT_OC_ON_FOOT.md`. A fictional taproom and yard (no real business's name or look) at the real spot, on the real streets from OpenStreetMap via Overture. Get out of the car, walk, sit, order, talk to NPCs. Crowds are simulated by time and day and labelled so. No live occupancy, events or multiplayer. |

## P5: later

| Item | Status | Notes |
| --- | --- | --- |
| Realistic mode: live weather and live traffic | Built; needs the server's feeds on (an NWS feed needs nothing; TomTom needs a free key) | Weather "Live" follows the National Weather Service's latest KSNA observation; Traffic "Live" follows TomTom's flow on the freeway you're on (one point per carriageway, every 15 minutes), through the live server's `/api/now`. With no server in reach both follow a simulated typical day, and the HUD note says which. A "Realistic" button in Settings sets live time, weather and traffic; everything else is the custom mode. Venue busyness stays simulated (decision 17). |
| The talk bank and the Coastal League | Built (text only; the radio's DJs use it now, the on-foot NPCs next) | `src/talk/`: 12 moods × 3 energies × 10 topics with the day's weather, freeway flow, the made-up league's results and a hand-edited trends list: 173,601 distinct openers, 68.7 million two-line conversations for one day (`node tests/talk.mjs`). No news feed; a blocklist; nothing political. |
| Billboards near the venues | Built (our own creatives) | Twelve panels on the 5, 57, 91 and 22 near Lot 57 and our sports bar, from `src/data/ads.json`. Real businesses only with a signed deal. |
| Live server (the first rung of multiplayer) | Alpha, built; not yet deployed | `live/`: accounts (scrypt passwords, 30-day sessions, rate limits), a lobby capped at 25 drivers at a time with a waiting line that moves up in order, and a relay that shows each driver the others within 3 km as ghost cars (no collisions, nothing scored, no chat). The cap is raised one rung at a time (25, 50, 100, 200, 500) on measured numbers; `live/README.md` has the ladder, the costs (about $7 a month on its own $6 server plus a domain, about $1 sharing the desks' box) and the deploy steps. Needs a domain and a server to go public. Not built: races against people, an online leaderboard, chat, names over cars, email verification and password reset. |
| Arcade track | Coming soon (shown) | A "Coming soon" card in the menu links to the Loop Lab preview: loop-the-loop, banking, boost pads. |
| Housing, commercial features | Roadmap | Not started. Payments stay out entirely. |
| LA County and beyond | Stopped (owner, 2026-10-20) | The map is Orange County only, done deeply (decision 11 in PROJECT_OC_DECISIONS.md). The OC freeway gaps to add: I-605 at Seal Beach and Los Alamitos, and the SR-90 Imperial Highway expressway. |

## How realistic can it get?

There are three honest tiers.

1. **Now.** Real road geometry and real terrain, with procedural textures and models, in a browser and on a phone.
   It reads as a clean, stylised real world, not as a photograph.
2. **Next.** Licensed or photogrammetry car and cockpit models, HDRI skies, photo textures, and real building
   footprints from Overture's buildings theme. All of it is feasible in Three.js. It costs asset licences, download
   size and phone performance.
3. **Photoreal.** That means Unreal Engine 5 or similar, a team of artists, months of work, and native apps. A
   browser game on a phone can't get there.
