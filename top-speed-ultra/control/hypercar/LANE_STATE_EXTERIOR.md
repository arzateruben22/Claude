# OC Hypercar exterior lane: state at the pause (2026-11-23 22:47 UTC)

Branch fix/hyper-refs (backed up as origin claude/wip-hyper-refs). It is v26 (188c5136) plus the exterior passes, and
does NOT yet contain v27 (8b3c9cf / bade6bb): merge that first, keeping the economy lane's edition gating (b4871fd:
the Founder plaque, Glacier Silver and Founder Ice only on the Founder edition).

## Rounds so far
1. Exterior build plus judge: revise.
2. Repair (the commits up to 37fae466) plus judge: revise. Clearly closer outside, but the hood from the seat went
   backwards.
3. Round 3 plus the owner's surface complaint ("theres still pixels and color mismatches", his crop of the polish
   preview at the front-left three-quarter): 14 commits, 37fae466..b82a112e. Its judge was stopped mid-run, so this
   round is UNJUDGED.

## Round 3 builder's summary
Scope 'all' on fix/hyper-refs (base 37fae466), 14 commits, nothing pushed.

The owner's five items:
1. The grey blotches came from metalness 0.62. I tested each suspect at his camera. Metalness 0 lowered the white's mid-frequency spread from 7.75 to 6.55; switching off the peel map (7.75) or the AO (7.54) barely moved it. Paint is now metal 0.25, rough 0.25, env 1.5.
2. The cabin shards came from keepInside: it never tested the top surface below shoulder height, and the sunken bonnet sits under the shoulder. The moved front wheels also put the footwell inside the wells. Fixed with a top test, a wells test and a clearance, plus walls closing the wells at the arch edges. Cabin pixels at his camera are now 0 on desktop Low, Retro, High and Ultra and on the iPhone at Low. 6 to 25 px are left on the iPhone at Retro, High and Ultra.
3. The black slashes across the bonnet were the bumper-seam shut lines landing on the humps' inner slopes. Also fixed: torn vent edges (polygon-offset wells), the stepped nose two-tone (now a paint mask), the white shards in the headlamp sockets (lens kept above the skin) and the lip's underside (front masks now cover faces turned down).
4. Tone steps: the arch's upright edges now get the well's shading, and the mirror is gloss black, no longer a second paint material.
5. Speckle: LED strips get a minimum on-screen width of 1.25 px, and the phone uses the opaque hex mesh.

The other review items:
- Ultra halo: the paint now writes a bloom share of 0.3, and the bloom threshold reads luminance x alpha. Every other material writes alpha 1, so other bloom is unchanged.
- Wheels: the hypercar's rim paint is dark gunmetal.

From the judge's list:
- Done: hump louvres moved inboard to the cowl (they now show at both edges of the seat view), centre vent set back, mirrors black, higher-contrast near-black carbon at one weave scale, flat-blade swan necks, raked fins, garage hero camera.
- Not done: the hood share, the seat-view shards (diagnosed only) and the nose.

The new render check fails on the base and passes on the final build. Draw calls and triangles stay within 1% of the base.

## Round 3 builder's not_done
- Hood share from the seat (judge sev 4): not back to v26's. Final paused Retro 1.77 / Low 1.45 %, against v26 2.18 / 1.82 and base 1.79 / 1.44. No raise I tried reached v26 (see measures), so none was adopted; the owner's option-B decision stands. The louvres now do show at both frame edges.
- Seat-view shards at the left A-pillar foot (judge sev 3): diagnosed only. A mesh-ID render shows ck:carbon crossing ext:paint, not the mirror. In the position pass those paint pixels read at body (0.13, 1.06, 0.6), the canopy behind the driver, which suggests a near-plane or back-geometry artefact. Needs the cockpit lane (fix/hyper-int) or a camera near-plane look.
- Cabin pixels not yet zero everywhere: side 359-674 px; rear34 44-114 px along the far side glass's lower edge; iPhone q-front-left 6 px on Retro and 25 on High and Ultra, at a pixel crack at the windscreen's lower-left corner; above 171 px on High, 36 of them new silhouette pixels at the windscreen's top corners. The side and rear ones are cockpit faces that span from vertices pushed out of the well to vertices behind it, crossing the open well; they need the footwell and door-card meshes clipped at the wells, or hidden in outside views.
- Vents head-on (judge sev 3): lowfront centre-vent median still 139 against a target under 60. Probably direct sun specular on the slats and wells at a glancing angle; next try a MeshPhysical slat and well with a low specularIntensity. Vents also now read as solid black without visible slats.
- Nose overhang and length (judge sev 3): not done. Needs a nose re-cut (ZF, the splitter, the blade heights and the suite's 0.5 m beam limit together).
- Lip and fang corners: a torn silver band still shows at the nose corners in the face view on High, even with the corner masks.
- Carbon twill: darker and one scale, but not proven at 2x crops beside the reference crops (judge's request).
- Swan necks and raked fins: built. Fins are visible raked in the dev tail view; the swan necks were not checked against the references at rear34 or side.
- No numeric seam tone-step measure; seams judged by eye.
- Paint vs the references: now lighter and cleaner, further from the references' darker, more varied flanks (the lane's note: door 171 against 147).
- Boot suite ran on the build of 99432675 (dropped later: it changed only which skin quads round the glass are cut); not re-run on b82a112e.

## Round 2 judge's ranked defects (for the record; round 3 addressed some)
- [sev 4] From the seat, the hood is now further from the reference interior than v26 was. The reference shows two pearl humps either side of the view, each with black louvres. v26 showed those hump louvres at both edges of the portrait frame. In HEAD the louvres moved to x 0.42-0.75, z -1.84..-1.36, which is outside the portrait frame, so none show on Retro, Low or High. All you see is a thin wavy strip with one black centre trapezoid. The hood share also dropped. My seat.mjs measure (200 mph, not paused): v26 Retro 2.0% / Low 1.9% / High 2.8%; HEAD 1.6% / 1.6% / 2.4%. The suite's hood check reads 1.6%, exactly at its floor. The spike and the red X are gone, which is good, but the feature the owner's interior image is about is gone too. -> fix: Put the hump louvres back where the seat sees them: inboard and back to the cowl, about x 0.36-0.60, z -1.60..-1.18, roughly 0.2 m wide, along the humps' inner slopes. Prove with seat.mjs that slats show at both frame edges on Retro, Low and High. Get the hood share back to at least v26 (about 1.9-2.0% Retro/Low): adopt option B (bonnet +2.5-3 cm at the cowl) or lift the FH crest 1-2 cm over z -1.3..-1.15. Then re-render sheet-hood-from-seat beside interior.png.
- [sev 3] New broken-geometry look. Stacked, saw-toothed grey and white horizontal shards sit over the dash below the left A-pillar foot. In-game it is a grey glossy sheet with stair-stepped pink edges. v26 had a clean panel there. Crops: judge2/crops/seatp-left-4x.png, cmp-seat-low-left.png. The most likely cause is the moved mirror (mirrorAt 1.0,0.93,-0.66, scale 1.15, stalk 1.6x) or its stalk seen through the side glass, possibly fighting the door or glass. The hump louvre frame is a second candidate. -> fix: Find the mesh with a mask render (seat.mjs already masks car meshes): hide the mirror group, then the ventsQ group. If it is the mirror, move it forward and outward (z about -0.8, x +0.03) or shorten the stalk so it clears the glass. Re-shoot the seat view on Low and High at 393x852 and check that the left edge is clean.
- [sev 3] From outside, the bonnet reads as three heavy black slabs in a trident (hoodtop, top, face). The reference front34 and side show a pearl nose cone with a centre V crease, one black vent set back toward the cowl, and slim louvre slots following the fender tops. HEAD's centre trapezoid starts about 0.3 m behind the nose, near the badge, and the hump panels are big squares on the near hump's inner slope. Head-on (lowfront, cy 0.4) the 'satin black' slats read grey: centre vent median 124,123,120 and hump louvre 152,151,148. That contradicts the claim that they read black in the straight front view. -> fix: Start the centre vent further back (z about -1.95..-1.35) and keep a pearl nose ahead of it with a centre crease. Make the hump louvres narrow slots along the hump crest (see defect 1). Lower the slat material's envMapIntensity (0.45 -> about 0.15) and raise its roughness (about 0.7) so the head-on median falls under about 60.
- [sev 3] The owner asked twice for carbon fibre, but no twill shows at any matched camera, even in 2x crops (face-splitter.png, r34-tail.png, r34n-wing-2x.png). The fins and diffuser fins read as flat matte grey or black cards. The splitter's top reads as a light grey slab on High. On the phone it is warm tan, median 112,106,94 in phone34. The reference splitter and fins are near-black with a visible grey weave. -> fix: Darken the base under the weave on the exterior carbon and raise the weave's contrast and scale (about 1.5-2 cm twill) on the splitter top, the fins and the wing as well, not only the diffuser fins. On the phone, tint the splitter near-black. Prove it with a 2x crop of the face and rear34 beside the reference crops.
- [sev 3] In the side view the nose is still blunt and tall. The front overhang is about 19% of the car's length against about 30% in the reference, which has a long, low, pointed nose with the splitter and fins far out ahead. noseCarbon reads as a flat black box under a vertical white slab at the arch's front edge (crops/side-nose.png). The arch's front edge runs to the ground as a separate light strip. -> fix: Lengthen and lower the nose ahead of the front wheel: move ZF and the splitter forward about 0.15-0.2 m, or lower the FH and CC stations at z < -2.0. Shape the noseCarbon zone as a raked wedge that follows the fins, not a box, and blend the arch's leading edge into the fender.
- [sev 2] The 'slim blade' swan necks render as thin round tubes, 4.5 mm with an 18 mm rb, so at every angle they read as wire hooks or coat hangers (rear34, rear34n, side, tail). The reference necks are broad flat carbon blades. -> fix: Make them flat blades about 6-8 cm in chord tapering to 4 cm, about 8 mm thick, in carbon. A tubeGeo with a large rb and a tiny radius reads as a tube; extrude a profile instead.
- [sev 2] Closer than v25, but the five fins are uniform flat rectangles hanging under the tail with square tops. The reference fins are taller and raked, with angled trailing tops. -> fix: Give each fin a raked top edge (higher at the front, dropping toward the trailing edge) and let them stand taller into the mouth. Keep the 12 mm thickness.
- [sev 2] White triangular skin shards stick into the black headlight sockets at their top inner corners (crops/hood-lamps.png). The lip's lower edge across the nose is stair-stepped, a sawtooth along the whole width (crops/face-splitter.png, f34-nose.png). -> fix: Clip or flatten the skin flap over the socket, or extend the socket's dark mask over it. Add stations along the lip polyline (faceStations) or smooth the lip's lower edge.
- [sev 1] From hoodtop the far mirror's stalk and housing read as polished silver. The reference mirrors and stalks are black. -> fix: Use gloss black or carbon for the hypercar's mirror housing and stalk.
- [sev 1] The garage stage frames the lineup with the hypercar cut off at the left edge, so it can't be used as a hypercar reveal render. -> fix: Use the game's Founder or garage reveal stage, or add a car-centred garage camera for the proof sheets.

## Owner decision pending
Raise the bonnet (option B: the centre +2.5-3 cm toward the cowl)? From the seat, the hood share is below v26's
(paused Retro 1.77 / Low 1.45 %, against v26's 2.18 / 1.82). No raise tried without B reached v26.

## Next (lean rules, CLAUDE.md)
One judge of round 3 on the cheaper model, then at most one repair. Its targets:
- the hood share;
- the seat-view shards at the left A-pillar foot (diagnosed: ck:carbon crossing ext:paint, near-plane/back geometry);
- the cabin pixels left at the side glass;
- the nose re-cut.
Targeted groups only: phone and render.
