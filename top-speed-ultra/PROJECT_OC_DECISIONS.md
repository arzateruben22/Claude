# Project OC: decisions

The owner's answers to the open decisions, each with the facts it was made on, so a later session never re-opens
a settled question without a reason. Newest decisions at the end of each section. Dates are Pacific.

## 2026-10-18: the hypercar, the store, the names, the engine, the pushes

Walked through one at a time in the Fable 5.1 session of 2026-10-18 (the F6 prompt in PROJECT_OC_HANDOFF.md).

### 1. The hypercar's roof

- Pending.

### 2. What "never sold again" covers after December 31, 2026

- Pending.

### 3. Ground Lock on launch until all-wheel drive exists

- Pending.

### 4. Free Drive's credit earnings for the hypercar

- Pending.

### 5. Owner mode in public builds

- Pending.

### 6. The founder windows if the launch calendar moves

- Pending.

### 7. The names: Rossini, Vela and the in-game watches

- Pending.

### 8. The Unreal Engine 5 go/no-go

- Pending.

### 9. Pushes: when to resume, and the merge order

- Pending.

## 2026-10-19: the build order from here

Given by the owner in chat on 2026-10-19 (about 22:10 UTC), while the lanes were paused on the usage rule.

### 10. Priority: the hypercar fully drivable first, then on foot at the Golden Road's spot

- **Decision.** First, the OC Hypercar Prototype 01 fully drivable: its physics (the F1 dynamics model and the
  hypercar's interfaces on it), its two tunes, its driving profiles and its ability, verified in the game. Then the
  Sims-like on-foot slice at the Golden Road's spot (built as Lot 57, our own taproom on the real Orangewood Ave
  site, per `PROJECT_OC_ON_FOOT.md`, because a real business's name and look can't be used).
- **What moves behind them.** The UI pass (U4 onward), the realism-2 world pass (W3 onward), and the F3 review.
  The store SKU and the F2 review follow the hypercar's drivable milestone, since the Founder Edition sells a car
  that must drive first.
- **Facts it was made on.** Progress estimate at the time: about 60% of the whole vision, about 85% of a launchable
  freeway game. F1 had finished its repair round (uncommitted in tsu-drift, second verification pending); the
  hypercar had owner mode committed and M1 (the body) in repair; the store SKU was in repair; on foot had the plan
  and the people builder, no playable page.
- **Order of work.** 1) F1 dynamics: verify, repair, commit on claude/drift. 2) Hypercar M1 to M6 on
  claude/hypercar. 3) F4 streaming budgets at Unleashed speed (the car must stay on a loaded road at its top
  speed). 4) Merge drift, hypercar and stream into the live preview, run the suite groups (race, abilities,
  progression, phone, boot) and the dynamics harness, republish: the "fully drivable" milestone. 5) The store SKU,
  then F2-A and F2-B. 6) On foot: F5 people specs, then Lot 57 Phase 1 (the standalone page), Phase 2 (the
  streets), Phase 3 (into the game). 7) UI pass, realism-2, F3.

### 11. The map: Orange County only, all of it (LA County stopped)

- **Decision** (the owner in chat, 2026-10-20 about 07:00 UTC): "lets put a full stop into the la count and solely focus
  on the OC map including all freewats, neighborhood streets, roundabouts, etc." LA County and anything beyond Orange
  County are stopped, not deferred. The map's scope is Orange County, done deeply:
  - **Every freeway and expressway in the county**, the ten built plus the gaps: I-605's short stretch at Seal Beach and
    Los Alamitos, and the SR-90 Imperial Highway expressway in Yorba Linda and Brea. Exit numbers if a source has them.
  - **Every public street**: arterials, collectors and neighbourhood streets in all of OC's cities, drivable, with
    intersections, signals and stop signs, turn lanes, and traffic that uses them.
  - **Roundabouts** (OpenStreetMap junction=roundabout), **malls and their parking structures and lots**, and the other
    built places along the streets (from Overture buildings and land use).
- **Facts it was made on.** The OC freeway network is built (20 carriageways, 1,247 ramp pieces, 1,256 junctions); all of
  Anaheim's streets are already pulled (about 10,000 named segments with their intersections, no lane counts in the
  source); the game has no surface-street driving yet; the weekly usage limit (86% on 2026-10-20) means little new work
  starts before it resets on 2026-10-25 22:00 UTC.
- **Order.** The hypercar (in progress) and the owner's sky-camera and debris fixes (in progress) finish first. OC streets
  come next, ahead of the walkable Lot 57 page: their first slice is the drive from the 57 into the Golden Road spot (the
  on-foot plan's Phase 3b, 804 m of real streets with signals), so the Golden Road work continues inside it. The owner can
  move the walkable page back ahead of the streets with one message.
- **What it costs.** It is the largest remaining system: a street pipeline for every OC city (Overture/OSM, credited), a
  tiled street-and-intersection model that stays inside the single-file build's size limit, intersection and signal logic,
  surface traffic and pedestrians, and phone budgets. A design pass comes first (the Fable prompt "OC streets" in
  PROJECT_OC_HANDOFF.md).
