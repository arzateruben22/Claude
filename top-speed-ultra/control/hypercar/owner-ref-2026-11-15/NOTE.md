# The owner's OC Hypercar references (2026-11-15)

Four images the owner supplied for the OC Hypercar's look: `front34.png` (front three-quarter), `rear34.png` (rear
three-quarter), `side.png`, `interior.png` (the cockpit).

The owner's words:
- 2026-11-15 ~3:25 PM PT: "let's also start fixing the graphics for the OC hyper car both outside and inside the car".
- 2026-11-15 ~3:30 PM PT: "Like to make it super ultra 4k hd. Use the images I already provided to render as close as
  possible. Interior cockpit needs to look more HD and futuristic and not plan and simple".
- 2026-11-15 ~11:15 PM PT (resending the same 4 images): "just to make sure we're implementing and graphics to look like
  this but with carbon fiber and alcantara features".
- 2026-11-22 ~4:30 PM PT: "make sure to keep rendering the oc hypercar to match images we provided as close as possible
  to them including first person pov in the cockpit, how the hood looks from there too, the outisde etc. and provide me
  the images to confirm its those".

Our own brand only: no real maker's badge, name or copied design; the OC mark.

## The earlier HYPER GFX lane (state)

Branch history: worktree tsu-hgfx, branch claude/hyper-gfx (local only, never pushed) from origin/claude/sport-wheel
572111a; its uncommitted work is snapshotted on origin/claude/wip-hgfx (newest 8d476fd, 2026-11-16 07:39 UTC). Brief and
judge text: ../HGFX_LANE_BRIEF.md. It ENDED done=false at the BUILD stage on 2026-11-16 ~07:50 UTC: NOT judged, nothing
committed. The builder's own report at the end:
- Done (builder's claim, unjudged): outside close to the refs from front/rear 3/4 (rear fins, exhausts, tail blades,
  pearl flake, canopy, carbon weave); inside: white bolsters with blue stitching, Alcantara, carbon door cards, ice-blue
  ambient lines, a lit cluster, 3 dials, a portrait centre screen, a windscreen HUD, toggles; native 4K on desktop Ultra;
  budgets OK; other cars identical.
- NOT done: the wheel rework to the owner's wheel pictures (now superseded: the luxury sport wheel is on the Hypercar via
  claude/wheel-tiers, live in v24+), the side silhouette / intake size, the mirror, the seats, the pedals, the garage
  studio light, 4K seat and rear renders.
- Base caveat: wip-hgfx sits on 572111a, well behind v25 (37a4a73): it predates the seat-view reframe (v23), the left-arm
  armrest (v25), the wheel tiers and Retro Low; expect conflicts in cockpit.ts / car-body.ts / car-shape.ts.
