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

## 2026-10-21: maximum overdrive

### 12. Maximum graphics for the hypercar and Lot 57, then a Sims-like world at Lopez and Lefty's, and every OC freeway at full throttle

- **Decision** (the owner in chat, 2026-10-21 about 00:00 UTC): "FULL FUCKEN MAXIMUM OVERDRIVE FOR MAMXIMUM GRAPHICS AND
  RENDERING OF THE HYPERCAR AND GOLDEN ROAD AND IMMEDIATELY AFTER MAKE A PLAYABLE SIMS INTERACTION WORLD FOR LOPEZ AND
  LEFTYS IN ANAHEIM!!!! FULL MAXIMUM OVERDRIVE AND DONT STOP!!!! RENDER ALL OC FREEWAY GRAPHICS FULL THROTTLE".
- **What runs, all at once.** The hypercar's lights, cockpit, seat, body fidelity and abilities (claude/hypercar,
  claude/hypercar-drive); the sky camera and debris fixes (claude/fix-sky, claude/fix-road); Lot 57 on foot at maximum
  graphics, the standalone page, Phase 1 plus a graphics milestone (claude/onfoot); an Ultra render tier, a hypercar
  showroom and photo mode, and the hypercar's materials at Ultra (claude/gfx, off the live preview); every OC freeway's
  graphics: surfaces, furniture and signs, interchanges and landscaping, night and horizon, I-605 and SR-90, and a sweep
  of every carriageway (claude/realism-2). Lot 57 moves back ahead of the OC streets (decision 11 allowed that with one
  message); OC streets follow.
- **Lopez and Lefty's.** Next after Lot 57: a playable Sims-like world there, built on the on-foot machinery. A web search
  found no business of that name; asked the owner whether it is a real Anaheim place (and where) or their own concept. A
  real business's name and look can't be used unless it is the owner's or they have permission; otherwise it is built as
  our own venue at the real site, like Lot 57.
- **The owner's answer** (2026-10-21 about 00:00 UTC, with a map of it): "Yes it's real". It is a sports bar; Overture
  places has it at 1759 S Claudina Way, Anaheim 92805 (33.80449 N, 117.90152 W, just east of I-5 between Cerritos and
  Katella, about 2.6 km from Lot 57). The owner did not say it is theirs or that they have its permission, so it is built
  as our own sports bar at that site, with our own name in one constant that can be swapped if they get permission.
  Phase 0 (the site data and PROJECT_OC_SPORTS_BAR.md) runs now on claude/sports-bar; the build (S1 to S4) starts once
  Lot 57's first milestone gives it the shared on-foot engine.
- **Facts it was made on.** The weekly limit read 0 at 23:43 UTC on Oct 20 after hitting 1.0 at about 15:30; the machine
  has 4 cores shared by all the workflows' Playwright renders; the five-hour and weekly limits, not the number of lanes,
  set the total amount of work per day, so more lanes trade depth for breadth.

### 13. The UI target: the owner's reference image (home screen, HUD, sky camera, cockpit)

- **Decision** (the owner in chat, 2026-10-21 just after 00:00 UTC, with a concept image): "Okay this is a PERFECT example
  of how I want the sky camera, HUD main screen, cockpit, etc". The image (kept outside the repo, in the session scratchpad
  as `ref/ui-reference-2026-10-21.png`) becomes the UI target and replaces the yellow "Chrome noir" accent: navy-black
  glass, an electric blue accent with glow, a left rail home screen with the car in a night garage, a profile chip, four
  mode tiles; a driving HUD with the objective top left, a circular minimap bottom left (the owner's "sky camera"),
  overhead guide-sign callouts, the mirror top right, a quick menu on the right edge and a big italic speed block; a
  hexagonal digital cluster and blue ambient strips in the cockpit.
- **What we don't take.** "Online" (no multiplayer), a dollar balance (Credits only), "PROJECT OC" (our OC Ultra
  wordmark), a real person's photo as the portrait, race types the game doesn't have, invented skylines or sign text.
- **How.** A UI workflow on claude/ui-ref (off the live preview): UI1 home screen, UI2 HUD, UI3 the circular minimap in
  two styles (vector map and the live sky camera clipped into the circle, after merging the sky camera's alignment fix),
  UI4 the cockpit cluster (after the hypercar's cockpit work), UI5 a match pass. The running sky camera fix finishes its
  alignment work first.
- **The colourway** (the owner, minutes later): "Let's go with the exact aesthetic and then implement the OC orange color
  way we've done". The reference's look is matched exactly (layout, glass, glow, type, chrome, night mood), and everything
  it lights in blue is lit in the OC sunset orange family already in `src/ui/styles.css` (`--sunset`, `--amber`, `--ember`,
  `--sunset-edge`, sampled from the owner's OC sunset wordmark), with the wordmark as the logo. Real road-sign colours stay.

### 14. Backups to GitHub

- **Decision** (the owner, 2026-10-21 about 00:05 UTC, asked whether to back up the local work: "Yes if you recommend
  that then yes"). The hold on pushes is lifted for backups: every lane branch is pushed to GitHub as it stands and again
  whenever a reviewed milestone commits, and the builders' uncommitted edits are snapshotted to `claude/wip-<worktree>`
  branches (a commit made from a temporary index, so the builders' working trees are never touched). Still no pull
  requests, nothing into `main`, the Los Güeros site untouched.
- **First backup.** Pushed: claude/always-on (merged with the remote's Trade Crawler commit first), claude/drift,
  claude/hypercar, claude/hypercar-drive, claude/fix-sky, claude/fix-road, claude/onfoot, claude/people-2, claude/stream,
  claude/gfx, claude/sports-bar, claude/ui-ref, local/live-preview; snapshots claude/wip-hyper, -hx, -fix-road, -foot,
  -ref, -bar, -main. The sky-camera and Ultra-tier snapshots (wip-fix-sky, wip-gfx) were refused by the session's
  permission check three times; their branches are pushed, and their edits land in the next milestone push.
