# OC Hypercar cockpit lane: state at the pause (2026-11-23 22:47 UTC)

Branch fix/hyper-int (backed up as origin claude/wip-hyper-int), from v26 (188c5136), with fix/hyper-refs merged in
up to b82a112e. It does NOT yet contain v27 (8b3c9cf / bade6bb): merge that first, keeping the economy lane's edition
gating (b4871fd).

Target: the owner's interior.png (control/hypercar/owner-ref-2026-11-15/interior.png). The owner's words: "the
cockpit needs to match exactly to the reference image to the best you can do"; "make ir field of view slightly
bigger if necessary".
Dev page matched camera: test-car.ts view=ref-int (&car=oc-hyper&time=day, 1672x941).

## Owner's focus (2026-11-23, resume session)
"I'm primarily focused on the dashboard, sports wheel design, center console, and vibe of our interior." Rank the
cockpit's dashboard, wheel, centre console and the cabin's materials and ambient light first; the hood from the seat
and the exterior come after. Still "match our cockpit reference the closest it can get" (interior.png).

## Part 1 (built and committed)
Part 1 is built and committed on fix/hyper-int (HEAD 997fa15b). Nothing was pushed, and no suite group was run.

**Matched camera.** The dev page has a new preset, view=ref-int in test-car.ts. Shoot it at 1672x941 with &car=oc-hyper&time=day. It was solved from the wheel's hub and rim and the forward vanishing point in interior.png, at about 10 px rms: camera at (0.088, 0.865, 0.28), 10.65 deg yaw left, 14.96 deg pitch down, a 78 deg horizontal lens. One limit: our seats sit lower and further back from the wheel than the picture's. A camera that matches the wheel, the dash and the horizon cannot also show the seat cushions; a fit that includes the seats gives 110 px rms.

**What was built (OC Hypercar only).**
- **Cluster and hood:**
  - A wide curved driver screen (its ends 2.5 cm nearer the driver) in a gloss frame, sized 0.8 of the Vela's so it ends left of the knobs.
  - An Alcantara cluster hood over it, blue-stitched, with an ice line under its lip; its right end sweeps across the dash top onto the lip.
  - A new face laid out like the reference: a thin rev arc with numerals, the speed big in the middle, the gear under it, and a bar each side under an icon. Left is power with the simulated temperature; right is the Thrust tank, since the game simulates no fuel. Every dash.main.shown field the suite reads is still drawn.
  - Slim horizontal vents replace the round ones.
- **Wheel:** the rim is Alcantara all round and squared off. An earlier, harder flat top hid the speed in portrait, so the top was raised back to 1 mm under the old crown. A carbon lower spoke with a brushed V replaces the twin legs. The paddles are a lighter silver and slimmer, because the full blades covered the cluster's corners. The stripe, the six-sided hub with the OC mark, the button pads and the two ice-ringed dials are kept.
- **Centre spine:**
  - A carbon spine with ice edges and three knobs (knurled rims, ice rings, fan, thermometer and seat icons).
  - A portrait screen showing only the game's own data: the car from above between rev and kW bar graphs, Thrust and Ground Lock or the tune, a line graph of the last minute's speed, the clock, the assists and Go To.
  - Five toggles and a red start button in a brushed bezel.
  - An Alcantara armrest behind the Founder Edition plaque.
- **Ported from wip-hgfx (by hand, not merged):** the console-screen painter, knobs, toggles and start button were adapted from it. Its other parts were left alone.
- **Exterior lane:** fix/hyper-refs gained commits during the work and was merged in again; the merge was clean. fix/hyper-polish had nothing new.

**Checked (renders against HEAD's build, all looked at):**
- **Phone budgets:** within budget (see budgets_before).
- **Cluster legibility:** the speed and gear read clearly at 393x852 in the portrait seat view, above the hub, with no HUD or touch control on the cluster.
- **Framing:**
  - The horizon holds at 30.2-30.6 %.
  - The bonnet probe reads 1.7 % on Retro, 1.84 % on Low and 1.96 % on High (base: 1.36 %, 1.47 %, 2.15 %). Retro is the tightest against the 1.6 % hood check.
  - Desktop framing is unchanged; looking 0.6 rad left and right behaves as before.
- **Hands:** at wheel ±0.9 on Low, Retro and High, both hands stay on the new rim.
- **Other cars:** I did not measure them; I only confirmed by reading the diff that every change is gated to the hypercar.
- **Typecheck and build:** `npx tsc --noEmit -p .` is clean and `npm run build` succeeds.
- **Render retry:** both matched-camera renders on HEAD first timed out at the screenshot (load average 45). Re-run alone, both completed.

The gap list ranks every reference item and gives its code location. It also records the framing numbers before and after, the sheet paths, the budgets, and which checks the second builder should watch.

**Suggested log entry (I did not edit PROJECT_OC_PROGRESS.md):** "2026-11-23: the OC Hypercar's cockpit front after the owner's interior.png (fix/hyper-int, part 1 of 2): matched camera test-car view=ref-int; a curved cluster under an Alcantara hood with a new arc/speed/gear face; a squared Alcantara wheel with a carbon lower spoke; a carbon centre spine with three climate knobs, a portrait screen of live data, toggles, a start button and an armrest; slim vents. Phone budgets within 10 % (Low seat -2 calls, +3.2 % triangles against the refs tip). tsc clean, build OK; suites pending for part 2."

## Part 1 not_done (part 2 took these on; see the commits after 997fa15b)
- No suite groups were run, by instruction; the second builder runs boot, phone, render and launch. The tightest risk is the phone hood check on Low Retro (1.7 % measured against a 1.6 % floor).
- The white panels flowing from the dash ends into the doors, and the door cards (carbon, white upper panel, pull strap, window switches, LED sweep). This is item 1 of the gap list and the biggest visual difference left.
- The seats: white side bolsters, black Alcantara centres, blue stitching.
- The pedals: none exist in any car today.
- The rear-view mirror and the lit roof console. The hypercar has no mirror by design (under its low header it hung across the road in portrait).
- The rest of the ambient light: footwell, roof, the door card's lower sweep.
- The cluster hood rises only about 3.5 cm over the screen. More would hide the bonnet from the seat unless the dash top is lowered on the driver's side.
- The hex hub pad keeps its old size, because the phone checks keep the HUD keys clear of the hub's box.
- The hypercar-only wider seat FOV (owner, 2026-11-23) is not built. It is item 11 in the gap list, with the approach: a car-shape param read in Game.updateCamera.
- The fender humps' height beyond the dash belongs to the exterior lane (fix/hyper-refs).

## Part 2
Stopped mid-run. Its commits after 997fa15b are on the branch:
- the white panels and door cards;
- the seats;
- the wider seat FOV (car-shape seatFov);
- the roof console and mirror;
- the footwells.
It had not finished its proofs or suites, so the whole cockpit lane is UNJUDGED.

## Next (lean rules)
1. Re-shoot the matched camera and the iPhone seat view.
2. Run the phone and render groups.
3. One judge on the cheaper model, then at most one repair.
4. Send the owner reference | v25 | now sheets.

## Gap list (builder 1, ranked)
# OC Hypercar interior vs the owner's interior.png: the gap list

Lane: fix/hyper-int (worktree /home/user/Claude/.claude/worktrees/hyper-int), on fix/hyper-polish 188c5136 (v26)
with fix/hyper-refs (bf5b9575, the exterior) merged in. Reference:
top-speed-ultra/control/hypercar/owner-ref-2026-11-15/interior.png (1672 x 941).

Matched camera (reusable): src/preview/test-car.ts `view=ref-int` (commit 72ec02c9). Shoot it at 1672x941 with
`&car=oc-hyper&time=day&q=high` (or `q=phone`), e.g.
`node tools/preview-shoot.mjs src/preview/test-car.ts out.png --size=1672x941 --query="view=ref-int&car=oc-hyper&time=day&q=high"`.
Solved from the wheel's hub and rim and the car's forward vanishing point on the picture (about 10 px rms): camera at
(0.088, 0.865, 0.28) m in the car's frame, yaw 10.65 deg left, pitch 14.96 deg down, 78 deg horizontal lens.
Limit: our seats sit lower and further back from the wheel than the picture's, so a camera that matches the wheel,
the dash and the horizon cannot also show the seat cushions along the bottom edge as the picture does (a fit that
also takes the seats gives 110 px rms). The seats are judged in their own view (see item 6).

Tools (scratchpad hyper-int/tools): dev.sh (dev-page renders from a source snapshot), seat.mjs (the game's seat view
at any viewport/preset/wheel angle/look yaw, with the framing numbers), budget.mjs (draw calls and triangles),
sheet.py (side-by-side sheets).

Status key: CLOSED (part 1 built it), PARTLY, OPEN (for the second builder).

## Ranked, biggest change to the look first

1. **White panels from the dash ends into the doors, and the door cards** - OPEN.
   Picture: a big white leather sweep from each end of the dash flowing back along the door tops; carbon door cards
   below with a white upper panel, an integrated pull strap, window switches, the blue LED line.
   Ours: black Nappa door cards (`T.door` 'nappa' for hyper, chosen 2026-11-17 because a clear-coated carbon card at a
   grazing angle mirrored the sky), the Alcantara insert, the ice line (exists), the slimmed v25 armrest
   (z -0.34..-0.18, keep), the pull strap (tan Alcantara, 0.35 proud, keep its depth), no window switches, no white.
   Where: cockpit.ts "doors" block (the hyper warp, `wallX`, `arm`), the dash ends ("dash ends against the doors"
   caps), mats (a white leather: `M.leather(q, 0xd4d7dc, ...)` as wip-hgfx did). Keep the v25 arm checks: the white
   panel must not come inboard of the card's face by the rim (left forearm floors 90 %, hand 70 %).
2. **The dash top line and the cluster hood** - see the update at the end for what part 1 closed.
3. **The centre spine** (carbon spine, three knobs, portrait screen, toggles, start button, armrest) - see update.
4. **The wheel** (squared rim, stripe, hex hub, carbon lower spoke, dials, buttons, paddles) - see update.
5. **The cluster** (curved screen: arc tach, big speed, gear, side bars, temperature and tank icons) - see update.
6. **The seats**: black Alcantara centres, white side bolsters, blue stitching - OPEN.
   Ours: black Alcantara buckets ('tan' and 'tanPerf' both dark for buckets), carbon shells, blue harness on the
   passenger seat. Where: cockpit.ts "seats" block (`seatWarp`, the `bol` bolster profile: the bolster quads are the
   `cush('tan', U.slice(0, 5))` / `U.slice(8)` and `back('tan', ...)` strips: give the hypercar a white leather for
   those and keep 'tanPerf' black Alcantara for the centres), plus stitch rows along the bolster seams
   (`stitchRow`, 'stitch' is already the ice thread). The seats are out of the matched camera's frame (see above):
   prove them with a free camera from behind the seats (e.g. `&cam=0.05,1.05,0.5&at=-0.1,0.4,-0.3&fov=70`).
7. **Ambient light everywhere** - PARTLY. Exists: under the dash lip door to door, along the door cards' insert, the
   cluster hood's lip (part 1), the spine's edges and the portrait screen's frame (part 1), the knob rings (part 1).
   Missing: footwell glow, the roof console, the door cards' lower LED sweep as the picture's (it curves down the door
   card), the centre console edges behind the start button. Where: `ambLine` in cockpit.ts, the 'amb' material (one
   mesh: more lines cost triangles, not draw calls).
8. **The rear-view mirror and the roof console** - OPEN. The hypercar has none by design (cockpit.ts "the hypercar
   has no rear-view mirror": under its low header it hung across the road ahead in the portrait seat view). The
   picture: a frameless mirror on a short stem from a roof console with a blue light. If built, check the portrait
   seat view's sky and road (the v23 framing) and the mirror check in the render group; an 'env' mirror costs no
   extra render.
9. **Pedals**: drilled or slotted aluminium pedals on a dark floor - OPEN. None exist in any car today. Where: a new
   block in cockpit.ts on the toe board (`toe` plane, `floorY`), 'alu' material (no new draw call), slots as a
   canvas alpha or as geometry; the floor is 'carpet' (dark).
10. **Beyond the dash: the fender humps** - PARTLY (exterior lane fix/hyper-refs, merged here): white humps with
    black louvres (`ventsQ`, `bonnetVents` in car-shape HYPER) show over the dash from the seat and the matched
    camera. The picture's humps stand taller and closer to the A-pillars; that is an exterior change for the refs lane.
11. **A wider seat-view field of view for the hypercar** - OPEN (owner, 2026-11-23: "make ir field of view slightly
    bigger if necessary"). Proposed: a car-shape param (e.g. `seatFovP`/`seatFovL`, a few degrees) read by
    PlayerCar and added in Game.updateCamera's cockpit branch (portrait: on SEAT_HFOV_P before the vBase clamp;
    landscape/desktop: on the 58), only for the hypercar; the player's FOV slider still adds on top. Keep the horizon
    at 31 % (portrait aims its pitch with the fov drawn, so it holds), the hood check and the phone group's seat
    checks; prove with before/after renders (seat.mjs `dfov` already sweeps an extra fov).
12. **Headliner and A-pillars**: the picture's pillars and headliner are black Alcantara (ours: 'head' Alcantara,
    dark) - close; the picture's pillars are thicker. No change advised (the v23 A-pillar fix).
13. **Slim vents** - CLOSED in part 1 (see update).


## Update after part 1 (branch fix/hyper-int: ae3f499f cluster, efd62adb wheel, bd0cb82b spine; 997fa15b merges the
## exterior lane's newer commits 1d9de2f6/1138b866)

Closed or partly closed by part 1 (OC Hypercar only; other cars build as before):

- **2. Dash top line and cluster hood** - PARTLY. An Alcantara hood over the cluster (brow blue-stitched, an ice line
  under its lip) whose right end sweeps across the dash top onto the lip toward the passenger
  (cockpit.ts binnacle block, `hyper` branch: `sec(s)`). LEFT: the picture's hood rises well above the dash top; ours
  can only stand ~3.5 cm over the screen, because from the seat its crest sits on the line from the eye to the
  windscreen's foot (higher would hide the bonnet: the v23 hood check). A bigger rise needs the dash top itself
  lowered at the driver's side, or the eye higher. The picture's dash top is a broad visible Alcantara field; ours is
  foreshortened (the dash falls straight to the glass, v23). The dash's carbon fascia band and the passenger side's
  lower fascia are as before; the picture has a carbon lower dash that sweeps into the doors (with item 1).
- **5. Cluster** - CLOSED. Curved screen (ends 2.5 cm toward the driver), gloss frame, size 0.8 of the Vela's (so it
  ends left of the knobs). New face (car-dash.ts hyperBase/hyperLive): thin rev arc with numerals 0-9 across the top
  (redline from 7), speed 104 px in the middle, gear 38 px under it, a bar each side under an icon (left: power, with
  the simulated temperature by a thermometer; right: the Thrust tank with a tank icon, standing in for the picture's
  fuel gauge, which the game does not simulate), the rest small in the corners. Every `dash.main.shown` field is
  still drawn. Legible at 393x852 @3x in the portrait seat view (speed and gear above the hub: cluster 0.585-0.635 of
  the height, hub from 0.667; crop: after/cluster-crop.png).
- **4. Wheel** - CLOSED except the hub's size. Alcantara all round, squared (top eased flat from 0.84 R, widened 6 %
  into the corners; a harder flat top hid the speed), carbon lower spoke with a brushed V, the stripe, the thumb
  pads (button clusters), the two dials with ice rings, silver paddles (slimmer: the full blades covered the
  cluster through the rim). Hands checked at the wheel +-0.9 on Low, Retro and High (after/seat/fin-p-*-w+-0.9):
  both hands on the rim. LEFT: the picture's hexagonal pad is taller and more regular; ours keeps the six-sided hub
  (HUB in wheel-sport.ts) at its size because the phone group checks the HUD keys clear of the hub's box.
- **3. Centre spine** - CLOSED. Carbon spine (cockpit.ts "the hypercar's carbon centre spine"), ice edges, three
  knobs (knurled rims, ice rings, fan/temperature/seat icons drawn in the console canvas's bottom strip), portrait
  screen (car-dash hyperConsole: car from above between REV and kW bar graphs, Thrust/Ground Lock or tune, a line
  graph of the speed over the last minute, clock, profile, assists, Go To), five toggles, a red start button in a
  brushed bezel, an Alcantara armrest behind the Founder Edition plaque. LEFT: the picture's spine is wider at the top
  and blends into the dash's lower carbon; ours meets the fascia under the lip.
- **13. Slim vents** - CLOSED (left of the cluster, passenger end; no centre vent).
- **7. Ambient** - PARTLY (hood lip, spine edges, screen frame, knob rings added).

Still OPEN for part 2, in this order: 1 (white dash-end panels and the door cards), 6 (seats), 9 (pedals),
8 (mirror and roof console), 7 (footwell, roof, door sweep), 11 (the hypercar's seat FOV), 10 (humps: exterior lane).

## Budgets (iPhone portrait 393x852 @3x, Free Drive, 200 mph; draw calls / triangles; "car" = the player's car
## shown minus hidden, shadow passes included)

| preset, view | before (merged-dist: v26 + refs bf5b9575) | refs tip 1138b866 alone | after (HEAD 997fa15b) |
| --- | --- | --- | --- |
| Low Retro, seat | 96 / 220,074 | 96 / 218,504 | 96 / 221,634 |
| Low Retro, chase | 136 / 251,268 | 136 / 250,155 | 136 / 253,285 |
| Low, seat | 77 / 121,333 | 78 / 120,387 | 76 / 124,275 |
| Low, chase | 116 / 152,469 | 117 / 151,976 | 117 / 156,226 |
| High, seat | 99 / 413,128 | 99 / 411,542 | 98 / 412,940 |
| High, chase | 138 / 471,776 | 139 / 470,705 | 139 / 472,403 |

The cabin's own cost (after vs refs tip): Low seat -2 calls, +3.2 % triangles; Retro +0 calls, +1.4 %; High -1 call,
+0.3 %. Geometry +4,188 triangles on phone, +5,618 on High. Within the 10 % on Low. Files: budgets-before.json,
budgets-refstip.json, budgets-after.json (and budget-base.json: 188c5136 + references, before any exterior change).

## Seat-view framing, before (merged-dist) -> after (final-dist, HEAD 997fa15b), seat.mjs at 200 mph

- iPhone 393x852 @3x, straight: horizon 0.307/0.305/0.301 -> 0.306/0.303/0.302 (Retro/Low/High); cluster (mid..bottom)
  0.580..0.626 -> 0.585..0.635; hub cover top 0.668 -> 0.667; bonnet (hood probe) Retro 1.36 % from 40.7 % -> 1.7 % from
  41.4 %, Low 1.47 % from 42.0 % -> 1.84 % from 39.9 %, High 2.15 % from 38.9 % -> 1.96 % from 38.7 %. No HUD or touch
  control on the cluster (hits []), controls from 80.3 %. (The bonnet change comes mostly from the exterior lane's raised
  humps; this lane's hood stays under the eye-to-glass line.)
- Wheel +-0.9 (Low, Retro, High): both hands on the rim, cluster 0.588..0.639 clear.
- Desktop 1280x720 straight: hub cover 0.822-0.829 .. 0.943-0.955 (was 0.827-0.829 .. 0.952-0.955), horizon 0.325-0.327,
  cluster 0.711..0.801, bonnet 2.1-2.4 % (was 2.5-2.7 %). Looking 0.6 rad left/right: the cluster under the HUD's
  ability key / compass and clock, as before (base the same).
- The seat FOV is unchanged (item 11 open).

## Sheets (reference | ours)

- before: baseline/sheet-matched.png, baseline/sheet-seat-portrait.png, baseline/sheet-seat-portrait-look.png,
  baseline/sheet-seat-desktop.png (raw frames: baseline/dev, baseline/seat)
- after: after/sheet-matched.png (High), after/sheet-matched-phone.png, after/sheet-seat-portrait.png,
  after/sheet-seat-wheel.png (hands at +-0.9), after/sheet-seat-look.png, after/sheet-seat-desktop.png,
  after/cluster-crop.png (the cluster at device pixels, before | after) (raw frames: after/dev, after/seat)

## For the second builder

- Not run (by instruction): any suite group. Expect to watch: phone "the hypercar's hood from the seat" (bonnet at
  least 1.6 %: Retro measured 1.7 %, the tightest), "the forearms from the seat on an iPhone", "the hypercar's seat
  view on a phone sideways and on a desktop"; render "the OC Hypercar" (the cabin-under-skin vertex check: the new
  hood, spine, armrest and vents are all inside |x| < 0.8 and under the dash, and the keepInside pass runs over them);
  the cluster check reads dash.main.shown (all fields still set where drawn); the wheel-parts check (LUX names:
  'carbon' is now the lower spoke, the rim is 'alcW').
- The matched camera's seats limit (top of this file); judge the seats from a free camera.
- Base for part 2: HEAD 997fa15b (fix/hyper-int). fix/hyper-polish has nothing new; fix/hyper-refs merged to 1138b866.

## Update after part 2 (fix/hyper-int: 62dd3bfb cabin, 14d55c9c seat FOV, f7d5899d render check; fede1399 merges
## fix/hyper-refs 37fae466)

- **1. White panels and door cards** - CLOSED. White leather on the lip/fascia ends (|x| > 0.6 left, > 0.58 right) and
  the dash end caps; a white band along each door card (pre-warp y 0.676-0.74) under a dark Alcantara top; carbon door
  cards (tinted weave, env 0.3, cc 0.14); window switches (gloss pad, four rockers, 6 mm proud at most) ahead of the v25
  armrest; ice lines under the white band and sweeping down the card. Lower dash carbon. The pull strap and the v25
  armrest are unchanged. LEFT: the picture's white sweeps in a curve from the dash corner into the door; ours is
  straight-edged (loft split at fixed x).
- **6. Seats** - CLOSED. White leather bolsters, black Alcantara centres, ice stitching on the bolster seams and twin
  centre lines (cushion and back). The passenger seat keeps the blue harness (not in the picture).
- **7. Ambient** - CLOSED for the list: footwell mat fronts, under the dash's lower edge, the console's top edges, the
  door card sweep, the roof console V. Day/night by PlayerCar.setCabinLight's 'amb' (unchanged levels).
- **8. Mirror and roof console** - CLOSED. Alcantara roof panel with a gloss lens and an ice V; a frameless mirror on a
  short stem ('mirrorDim', the env map; no live CarMirror, rearView stays undefined, so the M2 check's "no rear-view
  mirror" (live) holds). The seat camera sits ahead of the header, so the mirror is out of every seat frame; it shows
  from the chase view through the glass and from a free camera. LEFT: in the matched camera our header is above the
  frame (our canopy stands higher over that camera than the picture's), so the mirror is out of that frame too.
- **9. Pedals** - CLOSED. Footrest, short wide hung brake, floor-hinged throttle: brushed plates with dark slots.
- **11. Seat FOV** - CLOSED. car-shape seatFov [3, 3] (portrait after its cap, landscape/desktop on 58), the hypercar
  only. +4 portrait was tried: bonnet probe 1.5 % at 200 mph.
- The cabin's carbon is the exterior's tinted weave (was the untinted metallic weave, pale grey in the sun).
- Still open: 2 (the hood's rise over the cluster), 4 (the hex hub's size), 10 (hump height: exterior lane), the
  picture's broad Alcantara dash-top field (ours foreshortened, v23), the gauge pod on the dash top (kept for M5).

## Repair round (branch claude/cockpit-repair, 2026-11-24): what changed, what is still open

One repair round against interior.png (and, for the wheel, the owner's owner-ref-2026-11-23/wheel.png), in the owner's
priority order. OC Hypercar only: every change is behind `hyper` in cockpit.ts or an option only it passes in
wheel-sport.ts. Shots (session scratchpad shots/): ref-int-fix.png (q=high), ref-int-fix-phone.png (q=phone),
seat-fix.png (iPhone seat), wheel-fix.png (view=wheelck); sheet sheets/interior-fix.png (reference | before | after).

Found with a picking script (test-car `&pick=1` puts three on the window; scratchpad pick.mjs and seatpick.mjs): the
"flat light grey panels" at the matched camera's lower left were the ROAD, seen through the left door card, whose
carbon was single-sided and faced away (culled); the "broken dark polygons" in the footwells were the front wheel
well's liner; the seat view's saw-tooth along the hood was the windscreen's defrost strip crossing the dash top after
the build's keepInside pass moved the dash top's front row; the torn shards at the left A-pillar's foot were the sill
cap's carbon within a centimetre of the shoulder's paint (and culled carbon letting the fender show through).

1. **Vibe / materials.** The door card's carbon is drawn on both faces and darker. The cabin carbon is a dark twill
   (tint 0x5a6068, weave 3, satin), also both faces. The dash top, hood, lip and door tops are deep black suede
   (0x1d1d20), and the console box is carbon. The ambient 'amb' is now additive (no opaque strip) and 1-2 cm wide, a
   glow round a bright core: under the lip, the hood's brow, the spine's edges, the door's white edge and sweep, under
   the dash, the console's edges, the roof. The footwell outlines are shortened (the front edge and 15 cm of the
   sides). The footwell sides are closed in carpet up to the dash, which hides the liner.
2. **Dashboard.** Between the white ends, the lip is suede and the fascia carbon. A suede cheek closes the cluster's
   right end. The cluster face's reflection is calmed (it showed the sky as a grey wedge). The Founder door plaque
   moved from z -0.3 to z 0.06, beside the seat and out of the view ahead. The console plaque and the edition gate
   (`o.edition !== 'standard'`) are unchanged.
3. **Centre console.** The spine is flared to 34 cm under the lip and narrows round the screen. The knobs are 1.2x and
   15 cm apart.
4. **Wheel (the owner's wheel.png).**
   - The chrome three-pointed blade emblem replaces the OC mark on the hub (wheel-sport `addSportCentre({ emblem:
     'blade' })`, `bladeShape`, `bladeMat`). The hypercar's hub has no medallion and no chevron.
   - An ice light strip runs under the hub (its 'hubAccent', lit).
   - The rim is carbon top and bottom with a lit tab, with black leather grips (the mesh keeps the name alcW).
   - The right pad shows phone, mic and menu (`padMat(q, true)`). Knurled roller wheels sit outboard of the pads.
   - The paddles are set out (x 7.5 cm) and swung up 0.36 rad.
   - The hub's size is unchanged. The lower spoke is gloss carbon ('hubCarbon', which keeps the suite's chevron and
     insert names).
5. **Render check and seat view.** The white door panel is a 7-point sculpted 10 cm panel (pre-warp y 0.676-0.775)
   that sweeps down toward the dash; the check's door box gets about 180 vertices (was 72). In the seat view the
   hypercar has no defrost strip, the sill cap's front half is 1.4 cm lower, and the cabin carbon is drawn on both faces.

Still open:
- The dash still reads as a fairly boxy slab. The cluster hood still rises only ~3.5 cm (the bonnet-visibility limit).
  The reference's broad sculpted suede dash-top field and its white sweep curving from the dash corner into the door
  are not there: ours is a straight-edged white band, and the door's white panel reads mid grey in shade.
- The gauge pod on the dash top stays (M5).
- The paddles now show inside the rim at 10 and 2 o'clock as both references do, but in the seat view they are broad
  light slabs over the cluster's outer corners. The speed and gear stay clear.
- Seat view: a pink-white sliver of the fender still shows through the smoked side glass at the left A-pillar's foot,
  with a ragged edge. The bonnet edge still shows the exterior's louvres (exterior lane).
- The emblem is a flat bevelled extrusion with a painted chrome gradient; the reference's has sharper facets.
- The matched camera still cannot show the seats (the camera limit, as before).

## Shards round (branch claude/hyper-shards from v28 7b6dfc7, 2026-11-24): the torn A-pillar foot and wheel frame

Root cause (both severity-4 defects): `body.canopyX` (car-body.ts) bisected the top surface as if it fell all the way
out from the middle. The hypercar's fender humps rise again outboard of the canopy's foot (the top is 0.75 m at |x|
0.5 and 0.82 m at 0.75 by the A-pillar), so for heights near the glass's foot (z -0.95..-0.75) the bisection landed
on the hump's OUTER slope, 0.3 m out: canopyX(-0.88, 0.765) gave 0.855 against the true flank's 0.47. Everything
placed by it went out onto the humps: the side glass's front-bottom corner and its frit, the door cards' fronts
(cockpit wallX), the sill cap and the door top. keepInside then pressed those parts 1.2-3 cm under the hump's
paint, where (seen through the side glass from the seat, and in the wheel frame) they fought it in the black and
white shards, the jagged comb and the wedges. Not a near-plane artefact: the game's cockpit near is 0.05 m and the
nearest torn pixel is 0.47 m away (picks by ray). The "canopy behind the driver" position-pass reading was the
paint's own inner faces behind the side glass (culled).

Fixed:
- car-body.ts: a new `body.flankX(z, y)`, the canopy's own flank: for the hypercar (`HUMPED`, P.interior 'hyper')
  the first crossing going outward, or the valley between canopy and hump where the top never falls to y (and
  canopyX ahead of the canopy, where the top at the middle is under y); for the other cars it is canopyX. canopyX
  itself is unchanged (the body's extent at that height: the suite's skin checks read it). flankX now places the
  side glass (sgPoint: its front-bottom corner 0.47 m out, was 0.86), the skin's side-glass opening is cut only on
  the flank (ax < flankX + 3 cm; it had cut the humps' outer faces too once the glass moved in), and keepInside's
  flank push goes to flankX (it had pushed cabin points outward onto the hump). In cockpit.ts the door wall
  (wallX), the sill cap and the headliner's edge use flankX.
- cockpit.ts keepInside pass: the door's layers under the sill cap (alc, white, tan, doorLow, amb, stitchDark,
  gloss, alu) are kept 2.2 cm in (4 cm when pushed) against the cap's 1.2 (3) cm, so two layers are never pressed
  onto one depth (the door top's suede and the cap's carbon fought in a comb along the glass's foot).
- The door card: a white leather panel (34 x 13 cm) behind the window switches, an ice line along its foot.

Second pass (the owner's iPhone feedback on 2ad64c4: the torn edge was still there along the cowl, with a grey slab
under it; and "fix the center wheel design to look sharper"):
- The white saw-tooth along the cowl: the skin's windscreen opening was cut by whole quads inside the straight quad
  between the glass's corners, but the glass's foot curves 3 cm forward at the middle (wsXZ zb + 0.03 s^2), so a
  band of paint up to ~5 cm deep lay under the glass with a stepped edge, seen through it from the seat. The
  hypercar's opening (car-body WS_CLIP) now follows the glass's own (s, t) and splits the quads across its foot, so
  the paint ends in a clean line 6 mm under the glass, behind the frit's 1 cm band.
- The grey slab: with the paint gone from under the glass, the seat's rays down through the glass's foot passed
  between the dash's front edge (1.6 cm under the skin) and the glass into the open body: the road, and by the
  A-pillar the front wheel well's liner. The dash top now carries a closing panel 13 cm on under the cowl, 2 cm under
  the skin; and the dash (built at cabinW 0.8 m) is squeezed outboard of 0.38 m into the canopy (a smooth warp, the
  flank's width tabled along z), so its white ends and caps stand in the cabin instead of pressed under the humps;
  dash-end cheeks (dark suede) close the corner up to the side glass's foot.
- The hub (wheel-sport facetEmblem, cockpit hyper mats): three slim faceted chrome blades (ridge-creased, flat facets,
  per wheel.png) in place of the bevelled extrusion; a polished chrome bezel with flat chamfers and a dark gap ring;
  a dark leather cover (0x1a1b1e). The hub's outline and size are unchanged. Crops: hub-high-before-after.png,
  hub-retro-before-after.png (hub-before-*/hub-after-*).
- Checked in motion at 222 mph too (seatm.mjs, not paused): after-seat-move-high.png, crop-seat-move-high-zoom.png.

Proof (session scratchpad shards/): before-*/after-* seat views (393x852 @2x, Retro Low and High), crops
crop-seat-retro.png, crop-seat-high.png (left third, before | after), crop-seat-*-zoom.png (the A-pillar foot),
crop-wheelck.png (before | after). Picks by ray (seatpick.mjs, pick.mjs) and the suite's q-front-left ID render
(shards/idprobe.mjs: 0 cabin px on the skin, Low and High).

Budgets (budget2.mjs, iPhone 393x852 seat, the cabin's own meshes/triangles; whole-scene totals move with traffic):
Low Retro and Low 55 meshes / 51,565 -> 55 / 53,055 triangles (+2.9 %: the door panels, the cheeks, the closing
panel, the faceted emblem); High 48 / 45,531 ->
48 / 45,531. Within the 10 %.

Still open:
- Through the side glass's lower front corner the driver sees the hump's top in the car's paint (the seat script's
  car carries the GT's Rosso a80d10, so it reads as a red/pink band). It is real geometry now, cleanly drawn; hiding
  it (a frit band, or a door top up to the glass) is a design call. In the wheel frame the same hump reads as a broad
  grey field left of the wheel.
- The corner at the left A-pillar's foot is clean of shards and of the road/well, but still reads as a cluster of
  dark stepped shapes: the door top's suede, the sill cap's carbon and the A-pillar rail's front ends meet the dash's
  end there (keepInside moves their front rows piecewise). Next: end the door's front rows on one shaped edge that
  meets the dash-end cheek, and give the cheek the door top's profile.
- The slim vents (the left at x -0.685) are not squeezed with the dash: they lie under the humps, unseen.
- The hump through the side glass in the car's paint (above).

Suite (render, phone; final build a7fb0d2): 55/56. The one failure is the known pre-existing "sleeves from the seat on a
phone". Notes: "OC Hypercar: no cabin on its skin at the front" passed in the suite (0 px, 112,545 vertices in) but is
state-sensitive when run alone (--check): the base v28 gives 1 px alone, this build 6 px alone, both under the sill
at the rear quarter (tan / seatSil), not at the A-pillar. The cabin check's white-dash count now reads |x| > 0.4 (the
squeezed dash). "recovers from a lost WebGL context" and its follow-ons timed out in two earlier runs on this machine
under other sessions' load; they passed in the final run.

## Polish round (branch claude/hyper-polish from v29 74412a3, 2026-11-24, ~7:20 AM-10:30 AM PT): flicker at the source

From the owner's v29 iPhone frame (owner-shots/2026-11-24-v29-retro-seat.png, Retro, 128 mph) and "there still seems to
be a flicker of shards etc, when playing". Proof in the session scratchpad polish/ (paths in the report).

Root cause of the flicker and shards. Three things, found with a ray probe from the seat camera (polish/gap.mjs: for
every sample, the first drawn opaque surface and any other drawn surface within a few mm behind it; idimg.py maps the
first-hit mesh) and by hiding meshes one at a time:
1. keepInside's step: a cabin vertex just outside the skin went to 3 cm under it, its neighbour just inside to 1.2 cm,
   so one face jumped 1.8 cm between two vertices. Along the cowl and the A-pillar's foot (the dash top's end, the door
   top, the white panel, the sill cap) that made stair-stepped silhouettes that crawl as the head moves, and Retro's
   ink outlines every step.
2. Coplanar pressing: every key pressed by that pass landed on the same offset surface under the skin, so neighbouring
   keys met coplanar there (dash top vs the lower dash's carbon, dash top vs the white end and the cheek, door top vs
   white panel) and interleaved.
3. The bonnet's centre vent and the hump louvres: the wells carry a polygon offset (-1/-4, slope-scaled), and from the
   seat (a few degrees of grazing) it carried them through the blades and frames, which had no offset or the same one.
   The vent read as a black/carbon speckle along the hood's edge, flipping as the angle changed.
   The dash-end cheeks (shards round) also stood 4-5 cm up between the dash top and the side glass's foot, a flat black
   "bracket" at the pillar's foot. The Retro ink pass itself is not the cause (its threshold, 4 % of 1/z, is far
   above a 1-3 mm fight). It only inks the real stair-steps, which are now gone, so the pass is unchanged (it is
   shared by every car).

Fixed (OC Hypercar only):
- car-body keepInside `ramp` (used only by the cockpit's pass): an outside point goes in by c + (m - c) * (how far
  out / ramp), continuous across the skin. cockpit.ts: each key has its own depth, 2.5 mm apart (STAG; the sill cap's
  carbon nearest under the glass, the door's layers behind it, amb just in front of what it lies on).
- The corner shroud (cockpit 'cornerShroud', the dash top's suede, built after keepInside): from the dash top (found by
  raycasting the built dash), up to the windscreen's foot, the pillar's foot and the side glass's foot (1.5 mm under
  its lower edge, behind the frit), back as a 2.5 cm tongue over the door top to z -0.62, with a 6 mm skirt into the
  dash. The dash-end cheeks are retired.
- car.ts `louvre` (graphite satin, polygon offset -2/-10) and `louvreFrame` (the carbon, -2/-10): the centre vent's and
  the hump louvres' blades and frames now draw a clear step nearer than their wells. The centre vent's blades rise
  toward the rear (2 to 8.5 mm over the well) so they read as horizontal louvres from the seat and the front.

Measured (paused, the cowl band CSS y 330-470, 2 px grid; fights.py, decal pairs excluded): samples with another
drawn surface within 3 mm behind, Retro Low 63 -> 6, High 63 -> 10; the rest are offset-separated (louvreFrame over
the well) or the shroud's edge against the transparent glass/dust. Camera-jitter test (paused, +-1 mm / +-0.05 deg, 16
renders; jitan.py): pixels flipping inside flat regions 110 -> 65 (Retro Low). Real motion (burst.mjs: auto-drive at
112 mph, unpaused, 24 consecutive captures of the left third; flick.py over the A-pillar foot / dash top): High,
back-and-forth flips 1.88 % -> 0.36 % of the rectangle, pixels flipping in 4+ pairs 4,459 -> 2,328; Retro Low 0.46 % ->
0.38 %, 2,791 -> 2,641. In Retro both runs are dominated by real motion at that cadence (a capture is ~9 game frames
apart), so the Retro proof is the probe and the images.

The rest of the list:
- Roof: a padded rail close under the canopy at z -0.195 (about 9 cm ahead of the eye; from the iPhone's portrait seat
  20-23 degrees up, so the roof fills the frame's top above the sky, clear of the road), the roof lined behind it to
  the headliner, a slim roof console (9 cm, two ice lines) down the middle, and a frameless mirror (22 x 5.8 cm, a
  gloss back, the dimmed environment, no live render) hung from the rail at the car's middle on a short stem: about
  70 degrees right of the eye, out of the windscreen's sight line and of the portrait frame. The canopy is only 5-7
  cm over the eye there: a rail hung 2.4 cm under the glass (as the headliner is) at z -0.27 crossed the view a few
  degrees over the horizon (tried and dropped).
- Ambient strips: 0.8-1 cm (were 1.2-2), emissive 0.9/1.25 (was 1.0/1.4). The dash lip's line is now built under the
  dash's squeeze (its ends had run out to x 0.79 under the humps and been bent into hooks by keepInside) and dips 1.5 cm
  at its ends. The footwell outlines are one rounded U each (7 cm corners), not three straight bars.
- Tail blades: 38 mm (were 26, car-shape bar.h), the ledTail red hotter (core ff7058, glow ff2414, edge b80c08); the
  wrap stands 4.5 mm proud of the skin (the taller strip's foot met its facets).
- tests/retrohud-frames.mjs: the drift moments and the "held" frame slide 40 px up from BRAKE (past PULL_PX 28) and
  hold; 'pulled' is read on BRAKE; the .hb-round and .hb-cap selectors are gone; its boot clicks 'Start run' (the
  menu's 'Drive' button is gone since the UI batch). Run (--skin=retro --only=phone): drift chase and seat pulled true,
  -23.2 degrees; the held frame pulled true; lifting releases it; no page errors.

Suite (--only=render,phone, 9:31-10:14 AM PT on 14dd652's build): 54/57. Failures: "OC Hypercar: no cabin on its skin at
the front" (12 of 114341 vertices out, the worst cornerShroud at [-0.443,0.749,-1.027]: the shroud's outer edge stood
4 mm over the valley between canopy and hump ahead of the side glass; fixed by keeping the shroud's points 6-8 mm under
the skin), "the Founder Edition's lights wake" (sweep frames 9, 9, 9: the known timing flake under load) and the known
pre-existing "sleeves from the seat on a phone". Re-run on the final build (every OC Hypercar / hypercar check, the
hood from the seat, Retro style, the Founder wake with the check before it): 12/12, the skin check 0 of 114341 out and
0 px on the skin at q-front-left, the hood 2.2 % of the frame (floor 1.4 %), sideways/desktop bonnet 1.9 %.

Budgets (polish/budget.mjs, iPhone 393x852 @2x seat; whole-scene totals move with traffic): Retro Low scene calls 407 ->
421 (+3.4 %), triangles 635,854 -> 638,182 (+0.4 %); the player car's own meshes 117 -> 120 (the shroud, louvre,
louvreFrame), triangles 159,024 -> 160,246 (+0.8 %); cabin 55 -> 56 meshes, 53,055 -> 54,277 triangles. High scene
calls 614 -> 625 (+1.8 %), triangles +0.2 %.

Still open:
- The cowl's line right of the pillar's foot still shows small white slivers of the hump's paint with stepped edges
  between the louvre vent and the glass's foot (skin quads, exterior lane; not a fight: the probe finds no near-coplanar
  pairs there).
- A small notch remains where the shroud's top meets the A-pillar's foot (the pillar's own front end).
- The shroud is plain suede: the reference's sculpted dash field and the white sweep into the door are still not there.
- The mirror is never in the portrait frame; check it on landscape/desktop with the owner.
- Retro's ink still draws the louvre slats as fine lines at distance (as designed for convex edges).
