# The owner's brief (2026-11-27, verbatim), to run after the weekly usage reset (Sunday)

Act as a senior AAA automotive video game technical artist, Blender Python engineer and graphics optimization specialist.
We are upgrading the flagship OC Hypercar for OC Ultra.
I have provided:

* The original OC Hypercar multi-angle reference sheet.
* The TRELLIS.2 generated GLB base model.
* The official first-person cockpit reference.

The original reference images are the authoritative design. The generated GLB is only a starting mesh.
Your objective is to achieve the closest possible visual resemblance to the reference images while maintaining excellent gameplay performance.
PHASE 1 — AUDIT
Inspect the existing GLB geometry, topology, materials, textures, dimensions, symmetry and polygon count. Inspect my existing game architecture and rendering engine before making modifications.
PHASE 2 — EXTERIOR REFINEMENT
* Correct inaccurate body proportions and asymmetrical geometry.
* Reconstruct the original aggressive front splitter and intakes.
* Restore metallic silver paint using physically based materials.
* Add realistic carbon fiber materials.
* Restore thin electric-blue emissive headlights and aerodynamic accent lighting.
* Correct the rear wing, diffuser and taillights.
* Separate all four wheels and establish correct rotation pivots.
* Reconstruct black forged rims and blue brake calipers.
* Correct distorted windows, roof geometry and body panels.
PHASE 3 — FUNCTIONAL VEHICLE
Prepare independent meshes for wheels, steering, doors, headlights, brake lights and other moving components where feasible.
Create accurate collision geometry and ensure compatibility with existing vehicle physics.
PHASE 4 — COCKPIT
Reconstruct the official cockpit reference using black Alcantara, blue stitching, carbon fiber, black and white bucket seats, metallic controls and electric-blue ambient lighting.
Implement independently animated steering, functional instrument displays, live speedometer, RPM, gear indicator and first-person camera positioning.
Do not bake dashboard speed or gear values permanently into textures.
PHASE 5 — OPTIMIZATION
Create multiple levels of detail for desktop, mobile and browser gameplay. Use efficient texture sizes, mesh compression and lightweight collision geometry.
Use Blender Python automation wherever practical.
My current computer has approximately 8 GB RAM and integrated AMD graphics. Avoid expensive local rendering operations and unnecessary memory consumption.
PHASE 6 — INTEGRATION
Preserve the existing game architecture. Work on a separate Git branch. Do not overwrite the original GLB or production vehicle.
Use only free tools and existing subscriptions. Do not purchase APIs, GPU services or credits without my approval.
Implement improvements incrementally, compare each revision against the original reference images, and provide before-and-after previews where feasible.
Do not claim a visual improvement unless it has actually been rendered and inspected. Flag any geometry that requires manual modeling.
The goal is a production-quality, premium, functional OC Hypercar, not simply a generic AI-generated vehicle.

## Notes added by the session that queued it (2026-11-27)
- Since then the owner's red-tail-light choice stands (2026-11-24: "I like the red"), the five-blade front intake
  (owner-ref-2026-11-23/front.png) and the hub's three-point blade emblem (wheel.png). The game's current hypercar is
  code-built (src/preview/car-body.ts, cockpit.ts, wheel-sport.ts; PlayerCar/cars.ts physics; LANE_STATE_*.md).
- The work runs in a cloud container (not the owner's 8 GB laptop): Blender isn't installed; try `pip install bpy` (the
  bpy wheel for the Python version here) or Blender's Linux tarball from download.blender.org (check the network policy;
  ask before changing it). Software rendering only: keep preview renders small (EEVEE/Workbench at 960x540, few samples).
- The .blend is zstd-compressed Blender 4.x. Only the .blend was uploaded: check if it packs the GLB and the reference
  sheet; otherwise ask the owner for them.
- Triage (CLAUDE.md): exterior/cockpit materials, emissives, wheel separation, pivots, integration, renders and
  screenshots are Opus-class; retopology/LOD design, the phone memory budget for a GLB car, collision and the
  vehicle-physics coupling are Fable-class (the overnight model) or a fable agent from the session.
- Lean rules: one feature in flight at a time inside this task (exterior, then cockpit), one reviewer and one repair
  per phase, targeted tests; the phone memory budget (tests/gpu-mem.mjs, 350 MB peak) must hold.
