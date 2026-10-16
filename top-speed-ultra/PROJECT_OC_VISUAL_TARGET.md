# Project OC: the visual target

On 2026-10-15 the owner sent a reference image: a cockpit screenshot from a commercial console racing sim (a
licensed production sports car on a real speedway's road course, overcast afternoon, a race HUD in Portuguese). It is
not stored in this repository and nothing in it is copied: not the car, its cluster, the track, the HUD artwork,
fonts or logos. What we take from it is **what makes it read as real**, written down here so every rendering pass
aims at the same thing. Agents working on visuals should read this first.

## What the reference does right

1. **Light.** Overcast. The sun is a soft glow behind cloud, so there are no hard shadows; everything is lit by the
   sky. The exposure is set for the outside: the sky and the white wall top are bright, the cockpit sits about two
   stops darker, and the blacks still hold detail (the dash plastics are dark grey, not black).
2. **Colour.** Muted and close to neutral, a touch cool. Grey asphalt, white lines, a blue wall with a white cap,
   green trees, grey cloud with blue holes. Nothing is saturated and nothing glows.
3. **Camera.** The eye is low in the seat. The dashboard and wheel fill the lower 40% of the frame; the top of the
   wheel sits just under the horizon; the A-pillars are thick and the headliner's edge shows at the top. The road
   is seen over the bonnet, not from above it.
4. **Cockpit materials.** Matte dark plastics with soft, wide speculars; brushed-metal rings on the vents; the cluster
   under glass with a faint reflection; stitching on the wheel rim; the dash top reflected faintly in the windscreen.
5. **A real rear-view mirror.** It shows the road behind and the cars following. The door mirror shows the car's
   flank and the wall sliding past.
6. **Trackside density.** Catch fencing on steel poles in front of a grandstand, light poles, a scoreboard screen,
   palms with real frond silhouettes, buildings with signage, a wall that runs the whole way.
7. **Road.** Asphalt darkened by rubber in two bands, white lane paint with a little wear, a slight sheen, and
   haze that softens the far end.
8. **HUD.** A position box ("9 / 10"), a lap counter, a standings column with the gap to the car ahead and behind
   and your row highlighted, a lap timer top centre, a track map top right with car dots, speed + gear + rev lights
   bottom centre, lap time bottom left. All small, all flat, all out of the way of the road.

## What we don't take

- The car and its brand (we drive Rossini and Vela, our own), the cluster's design, the manufacturer typography.
- The track. Ours are the real OC freeways (OpenStreetMap via Overture) and, later, our own arcade track.
- The HUD's artwork, icons and fonts. We re-draw the *conventions* in our Chrome noir style.
- The screenshot itself. It stays out of the repo and out of the test images.

## The deltas, ranked (what to build next)

| # | Delta | Where | Effort | Notes | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | **Live rear-view mirror** on High and Ultra: the road and the traffic behind, not the sky's reflection. | `src/preview/cockpit.ts` already has `mirrors: 'live'` (render-target reflections, one extra low-res render a frame, alternating mirrors); `src/game/vehicle/PlayerCar.ts` passes `'env'`. | S | Opt in by quality tier. Measure the draw-call and ms cost in `tests/out`; keep `'env'` on phones. | **Done** (2026-10-15) |
| R2 | **Overcast light** that looks like the reference: in cloudy and mist weather, soft or no sun shadows, the sky doing the lighting, a cooler and less saturated grade, exposure set for the outside. | `src/game/env/Environment.ts` (sun vs hemisphere balance by the weather's `sun` factor, shadow softness/intensity), `src/game/Game.ts` (tonemapping exposure), maybe a small grade pass on High/Ultra. | M | Verify at (I-405 North, day, cloudy) and (CA-91 West, sunset, cloudy) against the clear renders. | **Done** (2026-10-16) |
| R3 | **Race HUD**: position box with "of N", lap counter, a standings column with time gaps and your row highlighted, lap timer, track map corner (the mini map exists), speed + gear + rev lights. | `src/ui/App.tsx`, `src/ui/styles.css`, `src/game/race.ts` (gaps). | M | Chrome noir tokens. Must work in phone portrait (collapse the column to three rows). Names are our fictional rivals; instead of national flags use OC city tags (ANA, IRV, HB, SA, CM, FUL). | **Done** (2026-10-16). No lap counter, since no course has laps (each is one run along a freeway; the distance to go stands in for it), and the map corner shows no rival dots. |
| R4 | **Palms with real fronds**: card fronds with leaflet gaps (alpha), 8–12 per crown, drooping, ringed trunks. | `src/game/world/Terrain.ts` (`palmCrown`, `palmTrunk`), `src/game/textures.ts` (`frond`). | M | Instanced; keep the phone tier's triangle count close to today's. | **Done** (2026-10-16) |
| R5 | **Trackside density**: fictional billboards for our own brands (Rossini, Vela, KFWY 96.9, KCST 101.5, KNYN 88.3, Lot 57), chain-link on top of some sound walls, more light poles and sign gantries where the data has none. | `src/game/world/Terrain.ts`, `src/game/world/Roads.ts`, `src/game/textures.ts`. | M | No real company, product or event on any billboard. | Not yet |
| R6 | **Road wear**: rubber-darkened wheel paths on the asphalt ramps too, skid marks near gore points, lane paint with wear. | `src/game/textures.ts`, `src/game/world/Roads.ts`. | S | The concrete slabs already have wheel paths. | Not yet |
| R7 | **Cockpit materials** closer to the reference: wider, softer speculars on the dash plastics, the cluster under glass, a faint dash reflection in the windscreen (exists), stitching (exists). | `src/preview/cockpit.ts`, `src/preview/car-mats.ts`. | S | Per car; the GT's dash is the first to check. | Not yet |

## Honest limits

The reference is a native console title with licensed, scanned assets and a team of artists. A browser build that
also runs on a phone will not match it pixel for pixel, and nobody should claim it does. The deltas above move
this build toward its *look*: the light, the materials, the density of the world and the HUD. The photoreal tier
is Unreal Engine 5 (see `PROJECT_OC_UE5_MIGRATION.md`), and that is a separate decision.
