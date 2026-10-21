# Project OC — Camera & POV bible (implementation + image-reference guide)

Use a SHARED camera grammar across all three art directions. Do not conflate a screenshot, a pre-rendered camera angle, and a working camera controller.

| Camera | Placement / player intent | UI | Validation |
|---|---|---|---|
| DRV_COCKPIT_FP | Eyes near driver seat, proper wheel/dash horizon and reflections | speed/gear, navigation, optional mirrors | sightline, occlusion, wheel geometry, road position |
| DRV_CHASE_TP | Tracking behind car at selectable follow distance | speed, route, minimap | stable suspension tracking, no camera clipping, proper car size |
| DRV_HOOD_FP | Just above bonnet, forward road focus | minimal speed/nav | no floating dashboard and no impossible bonnet |
| DRV_CINEMATIC | Fly-by, road-side tracking, long lens | optional minimal | realistic road direction and continuity |
| LIFE_FOLLOW_TP | Over-the-shoulder character at walking height | interact indicator, needs, context menu | consistent identity, useful interaction range |
| LIFE_EYE_FP | Walking player head height looking toward object or NPC | interaction reticle, prompts, phone option | realistic human perspective and hand scale |
| LIFE_ISO | Angled elevated dollhouse/house view | room and character tools, needs | complete walls/floors, clear occupancy and circulation |
| LIFE_ORBIT | Free camera rotating around apartment/property | property editor, selection outlines | furniture collision and logical orbit center |
| WORLD_DRONE | High aerial over neighborhoods/freeways | map landmarks or none | credible layout and scale |

## Matched scene comparison set

For each mode, depict the **same** Orange County-style 4-block neighborhood with at least four angles: DRV_CHASE_TP on the main road, LIFE_FOLLOW_TP on sidewalk, LIFE_EYE_FP from front doorway, and LIFE_ISO showing the same house. Preserve roof shapes, driveway, street direction, palm placement, and location between images.

## Three-way visual parity

LOW changes art direction to retro pixel/arcade; HD changes realism and materials; ULTRA changes to futuristic premium. The geography, camera position, roads, playable interactions and key vehicle shapes should remain recognizably consistent.

## Sims-style POV recommendations

Default walking to LIFE_FOLLOW_TP, interior interaction to LIFE_EYE_FP, property editing to LIFE_ISO, and cinematic presentation to LIFE_ORBIT. Allow users to switch between first/third person; isometric editing should not be a forced POV during driving.

## Asset accuracy warning

The reference crops supplied here have been extracted from composite boards at source resolution, which does not invent angles, 3D meshes, world topology, or real 4K detail.
