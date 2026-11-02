# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-10-21: Lot 57 on foot, P1c committed (people, build r2)

P1c, the people milestone, is committed as build r2 (`dist/onfoot/index.html` md5 e50e3fa0f8840195e793470d0b8776db,
not committed itself). It has forty people: guests in standing and seated talking groups, staff and walkers. The crowd
curve follows day and hour, and the "Simulated crowd" chip is on screen. The play reviewer kept it. They checked
`npx tsc --noEmit` (clean), saw no console or page errors in their own Playwright run (390x844 Low, High portrait,
Low), found nothing changed in the game, the people builder or the configs, and found the real venue's name nowhere.
Their counts by clock match the r2 entry below. Screenshots: `tests/out/onfoot/onfoot-*-p1c-r2.png`, among them
the 1280x720, 844x390 and 390x844 Tuesday 15:00 and Saturday 21:00 crowd shots and
`onfoot-1280x720-crowd-reopen-third-p1c-r2.png`. Known small defect: one reachable only through a test hook, which doesn't block.

## 2026-11-02: Lot 57 on foot, P1c repaired after review (build r2, not committed)

The P1c review kept build F for play and returned it for code. Everything both reviewers asked for is below, with
what it measured. Nothing is committed: this repair pass was told not to commit. These are unchanged: the game's
code, its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts`, and the people builder
(`src/onfoot/people/`, another session's files).

- **The reviewers' QA of build F** (`dist/onfoot/index.html`, md5 0572831d…), logged here as the code review asked:
  - **The play reviewer's runs.** Two runs of their own, one at a time: 390x844 touch at Low, then 1280x720 at High.
    - No console or page errors. `npx tsc --noEmit` clean.
    - The real venue's name is in none of `src/onfoot`, `dist/onfoot` or `src/data/anaheim`.
    - No changes to `src/game`, `src/ui`, the root `vite.config.ts` or `package.json`.
  - **Counts by clock**, matching the builder's:
    - Tuesday 15:00 Quiet, 0.155 of capacity: 5 guests, 4 staff, 9 inside.
    - Saturday 21:00 Packed, 0.915: 29 guests, 15 seated, 11 groups, 7 staff, 35 inside.
    - Friday 18:00 Lively: 22 guests, 28 inside. Monday 11:00 Quiet: 9 inside.
    - Thursday 03:00, Sunday 22:00 and Tuesday 23:30: 0 inside and 0 staff. Sunday 22:00 still has 2 walkers outside.
    - 30 quick clock flips, and a turnover followed at once by closing: the right counts, and 0 shown or drawn
      inside when closed.
  - **Talk.** In 440 Low and 40 High samples, never two speakers at once.
    - In rendered High frames, listeners drawn as bodies faced the speaker in 95 of 101 looks.
    - The cut-outs, read from their stale head bones, faced the speaker in 28 of 197 looks at High and 156 of 515
      at Low.
  - **Budgets.**
    - Low 390x844: 100 to 110 calls, at most 225k triangles, the people 2 calls.
    - High at Saturday 21:00: 191 calls, 563k triangles, the people 24 calls (their limit exactly).
  - **The rest.**
    - The chip was on screen at every clock they checked, and read "Closed" when closed.
    - Reduced motion took head bob from 0.0299 m to 0 and turned transitions off.
    - These were all refused cleanly: an off-map go or tap, edge taps, a tap on a taken seat, and 20 rapid act()
      presses.
  - **The people's CPU** (`crowdMs`):
    - Low: median 0.3 ms, worst 2.4 ms.
    - High: median 0.9 ms, 90th percentile 2.1 ms, worst 5.5 ms.
    - 5.5 ms on Low in the frame after a clock change.
  - **Defects found:**
    - A stale "Lot 57 is closed · opens 11:00" toast under "Open till 01:00" and "Packed".
    - The 96% facing figure came from unrendered steps, which animate everyone.
    - The CPU spikes.
    - White specks on a cut-out's legs at night.
  - **The code reviewer** returned it for two things: a per-frame allocation in hot loops, and a repaint that froze
    a walker. Everything else they could check held.
- **Fixed**, all in `src/onfoot/`:
  - **The stale toast.** When setting the clock changes whether Lot 57 is open, a toast that says it's closed is
    taken off at once (`hud.ts` `clearToast`, `main.ts` `applyClock`).
  - **Facing, measured as drawn.**
    - `groups()` now reports `bodyFaces` (the body's heading within 25 degrees of the line to the speaker) beside
      `facesSpeaker` (the head, from the bones).
    - New checks count a body by its head and a cut-out by its body, in two ways:
      - in rendered frames;
      - over 30 s stepped the way a rendered frame steps (`sim(s, false, 'view')`, new: only the people drawn as
        bodies animate).
    - The old check, which animates everyone, is kept and now says so.
    - Standing listeners now turn their body part of the way toward the speaker: 80% of the angle, at most 40
      degrees, with the builder's little turning steps. They stay turned through the pause after, and the head
      does the rest. A cut-out shows only the body's heading, so it now faces the speaker too.
    - A person who turns from a cut-out into a body (or is posed when the clock is set) is posed with a
      quarter-second step, so their head is already looking at the speaker. With a 1/30 s step it still pointed at
      a stale target for the first frames.
  - **The people's per-frame work** (`lot57/npcs.ts`, `crowdview.ts`):
    - **Looks.** A listener stores who they look at. The eyes are read in the animation step, not every frame. The
      builder is told only when the target changes, or every 0.3 s to follow a moving head.
    - **Bones.** Each person's head, chest, arms, forearms, right hand and fingers are looked up once. They are the
      builder's skeleton, the same objects at every level of detail.
    - **Held items.** Only the chain from the scene down to the hand and fingers is updated, not the whole body's
      tree, and at most once a frame.
    - **Animation phases.** Each person's animation steps start at their own phase.
    - **No per-frame closures or arrays** in `allot()`, the host's greeting test or the worker pool's count.
    - **Setting the clock** now poses everyone out, and plans the busser's first leg, in the clock change itself
      rather than in the first frame after it.
    - **A split of `crowdMs`.** `stats().crowdParts` breaks it into talk, move, anim, allot, pump, post and path
      planning.
  - **Repaints.** `paint()` now:
    - puts back exactly what was shown;
    - restarts what the person was playing, so a walker walks on;
    - clears the look, which is set again at their next step;
    - marks the pose stale, so a body is posed again before it's drawn.
  - **The light specks on cut-outs' legs.** Each cut-out cell is now painted at twice its size and box-filtered
    down into the atlas. A leg is only two or three texels wide, and its lit edge broke into specks when magnified.
  - **The people's 24 calls on High** are now measured, not only counted:
    - New hook `peopleCalls()` draws the frame with the people and again without them.
    - That found a real undercount. A cup's glass is transparent and double-sided, so three.js draws it in two
      passes: one call counted, two drawn (worst view: 24 counted, 28 drawn).
    - Held items are now counted as they're drawn (`drawCost`).
    - The High and Low budget sweeps measure every view, and a new check runs after an Ultra-to-High switch.
  - **Hooks for the checks:** `repaint(id)`, `legs(id)` (the stride), `atlas(id)` (a person's cells read back as a
    PNG), and `setClock()` now returns `ms`. `walkgrid.ts` gained two diagnostic fields: the last search's expanded
    cells and its string-pulling time.
- **Checked on build r2** (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1c-r2.md5`):
  - **How it was run.** `node tests/onfoot.mjs --only=crowd,crowd-phone,names --suffix=-p1c-r2`: **29 of 29**
    (`tests/out/onfoot/logs/onfoot-p1c-r2-crowd.log`). Headless Chromium with SwiftShader, one browser at a time on
    a machine shared with other jobs. `npx tsc --noEmit` clean. Every screenshot named here was looked at.
  - **Counts by clock: unchanged from build F.**
    - Tuesday 15:00: 5 guests, 4 staff, 9 inside.
    - Saturday 21:00: 29 guests, 15 seated, 11 groups, 7 staff, 35 inside.
    - The four closed hours: 0 inside.
  - **Talk.** 0 samples with two speakers in any run.
    - **Unrendered**, everyone animated (the old method, labelled): heads 903 of 936 (96%).
    - **As drawn at High**, two views. Rendered frames: bodies by the head 92 of 94, cut-outs by the body 69 of 71,
      together 98%. Stepped as drawn over 30 s: 337 of 355 and 262 of 270, together 96%.
    - **As drawn on Low.**
      - 844x390, rendered: bodies 31 of 31, cut-outs 181 of 211 (86%), together 88%.
      - 844x390, stepped: 84 of 85 and 458 of 530, together 88%.
      - 390x844, rendered: 23 of 25 and 111 of 143 (78%), together 80%.
      - 390x844, stepped: 84 of 89 and 306 of 352, together 88%.
    - Seated cut-outs stay lowest: they turn at most 25 degrees on the seat.
  - **The toast.** At Tuesday 23:30 in the yard: "Lot 57 is closed · opens 11:00". Set to Saturday 21:00: no toast,
    under "Open till 01:00" and "Packed" (`onfoot-1280x720-crowd-reopen-third-p1c-r2.png`).
  - **The repaint.** A walker drawn as a body was repainted mid-walk. Over the next six frames, its stride (one thigh
    ahead of the other) went 6.7, 25.2, 31.6, 14, 9.8 and 30 degrees, and it was still playing 'walk'. A guest
    standing idle measured 1.3 degrees.
  - **The specks are gone.** See `onfoot-1280x720-crowd-cal-night-imp-p1c-r2.png` and the crop
    `onfoot-1280x720-crowd-cal-night-legs-p1cE-vs-p1c-r2.png` (build E's cut-out, r2's cut-out, r2's body). The
    atlas read back (`atlas(id)`) shows smooth limbs too.
  - **Budgets, counted and measured.**
    - **High:** 22 views, first and third person. The people at most 24 calls counted and 24 measured. The whole
      frame at most 201 calls and 691,699 triangles.
    - **After Ultra to High:** 12 views, counted equal to measured in every one, worst 24.
    - **Low 844x390:** at most 121 calls and 236,465 triangles. The people 13 counted, 13 measured.
    - **Low 390x844:** at most 102 calls and 236,817 triangles. The people 16 counted, 16 measured.
    - **Open: one view.** In the High sweep, third person at the lot gate counted 8 and measured 10 (9 in the run
      before), still far under 24. Probed from a fresh boot, the same view matched (9 and 9), so the cause wasn't
      found.
  - **The required screenshots,** all looked at, with the chip and the credit on screen:
    - `onfoot-1280x720-crowd-{tue15,sat21}-p1c-r2.png`
    - `onfoot-844x390-crowd-{tue15,sat21}-p1c-r2.png`
    - `onfoot-390x844-crowd-{tue15,sat21}-p1c-r2.png`
  - **Unchanged from build F:**
    - Reduced motion: head bob 3.0 cm, then 0; the toast's transition 0 s.
    - The staff, the walkers and an arriving party (which sat down within 62 s).
    - Ultra: 15 bodies, 461 calls.
    - The real venue's name is in none of the 52 files.
- **The people's CPU** (`crowdMs`, this machine's desktop CPU under SwiftShader, not a phone):

  | Measure | Build F | Build r2 |
  | --- | --- | --- |
  | High, 150 frames standing at Saturday 21:00 (median / 90th percentile / worst) | 1.0 / 1.3 / 8.0 ms | 0.7 / 0.8 / 1.6 ms |
  | Low 844x390 (median / 90th percentile / worst) | not measured this session | 0.4 / 0.6 / 2.2 ms |
  | Low 390x844 (median / 90th percentile / worst) | 0.6 / 0.9 / 3.6 ms | 0.3 / 0.5 / 6.9 ms |
  | First three frames after a clock change, worst | 4.2 ms High, 4.5 ms Low | 0.9 ms High, 0.4 and 0.7 ms Low |

  - **Where the numbers come from.** Build F's column is an A/B run back to back with an intermediate repair build
    (`tests/out/onfoot/logs/p1c-r2-cpu-ab-buildF-vs-r2pre.jsonl`). r2's column is the suite run.
  - **What's solid and what isn't.**
    - The steady-state medians and 90th percentiles are about the same, and they move with the machine's load:
      another job's browser ran at 250% CPU at times, and the load average was 4 to 9 on 4 cores.
    - Under that load the intermediate build and F traded places: High worst 7.2 against 8.0 ms, Low worst 4.7
      against 3.6 ms.
    - The clear change is the first frame after a clock change.
  - **The first frame after a clock change.**
    - The split showed most of it in one path search: the busser starting his first round, 6 to 14 ms right after
      a clock change. The same search, about 340 expanded cells, took 0.4 ms at other times.
    - That search now runs inside the clock change, which already takes 0.5 to 6 s. In r2 no first frame after a
      clock change has any planning in it.
  - **The remaining spikes** move between parts from frame to frame. One 390x844 frame spent 6.8 ms animating 4
    people who usually take 0.1 ms. That fits pauses (scheduling, or collecting the builder's per-update garbage),
    not steady work.
- **Runs on the way, for honesty:**
  - **Build r2a** (`onfoot-p1c-r2a-crowd.log`): 28 of 29. The new measured-calls check failed, which found the glass
    undercount.
  - **Build r2b** (`onfoot-p1c-r2b-crowd.log`): 28 of 29.
    - At 390x844 the rendered-frames sample read bodies 21 of 36. It was 12 consecutive frames, about 2 s, often of
      the same few people, right after the camera moved.
    - That led to the quarter-second pose for new bodies, and to spacing the samples 0.5 s apart.
  - **A probe of the phone groups** (`onfoot-p1c-r2c-phone-probe.log`, the final build with the consecutive
    samples): 10 of 10.
  - **Speck and spike probes:** one-off scripts, not in the suite.
- **Regression on build r2:** `node tests/onfoot.mjs --only=desktop,actions,actions-phone --suffix=-p1c-r2`, **40 of
  40** (`tests/out/onfoot/logs/onfoot-p1c-r2-regress.log`).
  - That covers P1a's desktop group (tap to go reaching all 157 free seats from both starts, closing time, the
    hooks) and P1b's actions at High and on a phone (ordering at the bar and both trucks, Join and Leave, nothing
    through a wall, the cooks drawn on Low).
  - Group talk in that run: listeners faced the speaker in 916 of 946.
  - `onfoot-1280x720-act-joined-p1c-r2.png` was looked at.
  - Not re-run: the landscape and portrait groups and the 1,000 walks. The walk grid's change is two diagnostic
    fields, and its paths are unchanged.
- **For the people builder's session** (its files weren't touched; these would trim the crowd's per-frame garbage):
  - `person.ts` `lookAt()`: copy into a vector it keeps, instead of `target.clone()` on every call.
  - `anim.ts` `update()`, while a look target is set: replace the per-update `new THREE.Vector3()`,
    `this.lookTarget.clone()` and `new THREE.Quaternion()` with module-level scratch objects.
    - Its returned `{ yaw, pitch }` object, `person.ts`'s per-update `(out) => …getWorldPosition(out)` closure, and
      `pose()`'s `R`, `knee` and `ank` closures are allocated on every update too.
  - `person.ts` `eyes()`: the `hf.toBody([0, 0, 0.01])` offset could be worked out once, not per call.

## 2026-11-02: Lot 57 on foot, P1c: forty people, the crowd curve and the chip (build F, not committed)

P1c of `PROJECT_OC_ON_FOOT.md` Phase 1 ("NPCs", "Groups that look like they're talking", "Walkers, arrivals and
staff", "Simulated crowds", the phone budgets), on the standalone page (`src/onfoot/`). The game's code, its
`vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts` and the people builder (`src/onfoot/people/`, used
through its exports only) are unchanged. An earlier builder of P1c left most of this on disk uncommitted (its own
19-check run passed on its build); this entry is the run on the builds made since (B to F; F is on disk).

- **What's there** (all in `src/onfoot/`):
  - `lot57/npcs.ts`: forty people, every one built by the people builder and every one fictional.
    - 31 guests in twelve parties: five standing circles (two barrel tables in the yard, one in the Shed, the
      bag-toss lawn, the third truck slot) and seven seated groups (tables 3, 6, 9 and 11 in the yard, a picnic
      table by the trucks, two at the bar, the lawn chairs). P1b's two groups are the same people.
    - Seven staff in our patina green: the bartender and a cook in each truck (they serve you, P1b), a second
      bartender working the back bar (from 40% of capacity), a host at the gate, a busser making rounds of the
      tables (from 30%), and a lot attendant waving cars in on busy nights.
    - Two walkers on the Orangewood sidewalks (one jogs), whether Lot 57 is open or not; one late, none from 01:00
      to 06:00.
    - The crowd curve: `clock.ts`'s simulated share of the fictional 220 times 31 guests decides how many are in, as
      whole parties in a fixed arrival order. Setting the clock settles it at once. On the live clock parties arrive
      at random (about one every two minutes while it's under its level), walk in by a path from a car in the lot or
      along the Orangewood sidewalk and in by the entry walk, stay (log-normal, median 75 minutes) and walk out
      again. Closed: nobody inside, the staff gone. Nothing is live.
    - Talk in every group: one speaker at a time, turns of 1 to 10 s (median about 3.5), 0.2 to 0.8 s pauses, the
      next speaker usually whoever was looked at; listeners look at the speaker with glances away and nod in the
      pauses; group laughter; a sip every 40 to 90 s. Seated listeners turn up to 25 degrees on the seat toward the
      speaker; a seated speaker beats the words with a hand.
  - `lot57/crowdview.ts`: drawing forty people inside the budgets, nearest first, from what the rest of the scene
    left last frame: the patio body (LOD 1, built in two workers), the far body (LOD 2, built at load), or an
    impostor (a card painted at load from that person's own body from eight sides, standing and sitting; all of
    them one instanced draw call). Walls, buildings and truck bodies hide people. One instanced soft-shadow call;
    on High the nearest four cast the sun's shadow. Ultra has no budget in the plan: everyone near is a body.
  - `lot57/crowd-worker.ts`: the worker that builds the patio bodies (the page's own script started from a blob).
  - `main.ts`: the crowd wired in. When a frame is over the triangle budget, or people near you were drawn as
    impostors for want of triangles, fewer parked cars get their detailed model. New hooks: `crowd()`,
    `turnover()`, `crowdView()`, `takenSeats()`, `peopleReady()`; `stats()` now reports guests, inside, groups,
    talking, seated, walkers, street, staff, bodies, impostors, the LOD counts, the people's calls and triangles and
    the rest of the scene's.
  - `lot57/doings.ts`: a seat a guest is in or walking to can't be taken ("Someone's sitting there."); Join is for
    standing circles that are all there.
- **This session's changes on top of the earlier draft** (builds B to F):
  - The yard read empty under "Packed": two of its twelve tables had people. The roster is now twelve parties
    (was ten): at Saturday 21:00 four yard tables and two barrel tables have people. A pair sits across from each
    other (the bench or lawn chair opposite), not side by side.
  - After dark the people stood in the lit yard as dark cut-outs: the venue's night light is baked into its own
    materials, and the builder's body material saw only the sky and a few real lights. The coarse bodies now take
    the same warm lamp fill as the held items, by where each person stands (`crowdview.ts` `withFill`, the
    builder's material wrapped, not changed). Bodies and impostors drawn side by side match (the new calibration
    check).
  - Parties from the street cut across the verge and through the frontage planting beds. They now walk the
    sidewalk to the entry walk and in through the gate, and out the same way; the five beds are colliders, for you
    too (`venue.ts`).
  - Parties walked in and out holding their drinks. Now they walk empty-handed and have their drinks once they're
    settled.
  - Tests: the arriving shot is aimed at the party and checks it's drawn (the old one missed them); a new check
    draws one view all bodies, then all impostors, by night and by day.
  - `stats()` reports `crowdMs`, the people's CPU in the last frame (`simMs` counts only your own steps), and the
    budget checks print its worst.
- **Checked** with `node tests/onfoot.mjs`: headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time on a machine shared with five other workflows. `npx tsc --noEmit` is clean. Every screenshot
  named here was looked at. Two builds:
  - **Build F**, the one on disk (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1c-buildF.md5`): P1a's
    desktop group, the crowd groups and names, **39 of 39** (`tests/out/onfoot/logs/onfoot-p1c-buildF.log`,
    `--suffix=-p1cF`).
  - **Build E**: the crowd groups and names, **20 of 20** (`onfoot-p1c-buildE-crowd.log`), and every other group,
    **54 of 54** (`onfoot-p1c-buildE-regress.log`), `--suffix=-p1cE`. Build F differs from E only in measuring: two
    timers in `main.ts` and the `crowdMs` field in `stats()` (and the tests printing it).
  - The numbers below are build F's unless marked E.
    - Boot on Tuesday 15:00 at 1280x720 (High) with no console errors: 40 people, the far bodies built at load in
      7.2 s, the 40 patio bodies from the two workers within 17 s more (0.8 to 1.0 s each), no worker errors; the
      impostor atlas is 2048x1680. On a phone (Low) the far bodies took 7.4 s (844x390) and 7.5 s (390x844).
    - The counts by the clock (guests, staff, people on the sidewalks, everyone inside the fence): Tuesday 15:00
      Quiet (0.155 of capacity): 5 guests (2 seated, 2 groups), 4 staff, 2 on the sidewalks, 9 inside. Saturday
      21:00 Packed (0.915): 29 guests (15 seated, 11 groups), 7 staff, 2 on the sidewalks, 35 inside. Ten more open
      hours from Monday 12:00 to Sunday 20:30 all within the curve's target (at most one over, never more than three
      under) and rising with the share. Closed (Tuesday 09:00 and 23:30, Sunday 22:00, Thursday 03:00): 0 inside, 0
      guests, 0 staff; 2, 1, 2 and 0 walkers on the sidewalks.
    - Talk: 660 group samples over 30 s at Saturday 21:00 in all 11 groups there (five standing, six seated): 0
      with two speakers; listeners faced the speaker (the head within 25 degrees of the speaker's eyes, from the
      bones) in 928 of 968 looks (96%); the lowest group 91% (table 6). Build E: 916 of 947 (97%), lowest 92%.
    - Staff: Tuesday 15:00 the bartender, both cooks and the host; Saturday 21:00 also the second bartender, the
      busser (12.8 m of rounds in 20 s) and the lot attendant in the lot. Walkers: both on the Orangewood
      sidewalks, 9.5 and 26.3 m in 10 s; none at Thursday 03:00.
    - Turnover at Saturday 14:00: the barrel table by the lawn left for the lot and table 3 walked in off the
      street, along the sidewalk and in by the entry walk, empty-handed, and sat down within 49.5 s
      (`onfoot-1280x720-crowd-arriving-p1cF.png`, both of them drawn); no walk without a path.
    - Budgets, from `stats()` at Saturday 21:00 (calls and triangles from `renderer.info`, every pass included):
      - **Low** (the phone default), 12 views in first and third person each: 844x390 worst 121 calls and 236,465
        triangles, the people at most 15 calls; 390x844 worst 102 calls and 236,817 triangles, the people at most
        14 calls. Limits 150, 250k and 16. In P1a's seven views (build E) worst 121 calls and 242,222 triangles.
      - **High** (1280x720), 11 views in first and third person: worst 199 calls and 691,699 triangles, the people
        at most 24 calls. Limits 350, 700k and 24. The scene alone didn't pass 700k in any view.
      - The screenshot views: High Tuesday 15:00 174 calls, 496,958 triangles (3 bodies, 1 impostor); High Saturday
        21:00 191 calls, 574,838 triangles (10 bodies, 6 impostors; the people 24 calls, 64,588 triangles); Low
        844x390 83 and 89 calls, 126,612 and 146,698 triangles; Low 390x844 77 and 83 calls, 123,242 and 143,308.
      - Ultra (no budget in the plan): 461 calls, 2,787,428 triangles, 15 bodies.
      - The people's CPU (`crowdMs`: their talk, walks, animation and drawing choices), on this machine's desktop
        CPU under SwiftShader, not a phone: in the budget views at most 1.2 ms a frame on High and 1.3 and 4.7 ms
        on Low (one frame each, three frames after a jump of the camera). Over 150 frames standing still at
        Saturday 21:00 (a one-off script, not in the suite): Low median 0.5 to 0.7 ms, 90th percentile 0.7 to
        2.8 ms, worst 7.2 ms; High median 1.0 ms, 90th percentile 1.4 to 5.0 ms, worst 12.1 ms. The plan's target
        is under 2 ms on a mid phone; the spikes are over it already on a desktop (see below).
    - Bodies against impostors in one view, night and day
      (`onfoot-1280x720-crowd-cal-{night,day}-{body,imp}-p1cE.png`): they read alike.
    - Reduced motion: head bob 3.0 cm, then 0; the toast's transition 0 s.
    - Screenshots with the chip on screen (`hudVisible` checks it and the map credit in each), looked at:
      `onfoot-1280x720-crowd-{tue15,sat21,sat21-wide,sat21-ultra,arriving}-p1cF.png`,
      `onfoot-1280x720-crowd-{sat21-shed,sat21-lawn}-p1cE.png`, `onfoot-844x390-crowd-{tue15,sat21}-p1cF.png`,
      `onfoot-390x844-crowd-{tue15,sat21}-p1cF.png`.
    - The real venue's name is in none of the 52 files (`src/onfoot`, `src/data/anaheim`, the built page).
  - Build E, every earlier group (P1a's desktop, landscape and portrait, P1b's actions at High and on a phone, the 1,000
    walks) with the forty people in: **54 of 54** on build E (`tests/out/onfoot/logs/onfoot-p1c-buildE-regress.log`).
    - Tap to go still reaches every free seat from the front gate and the lot walk and sits you (314 walks, 157
      free seats); the 15 seats the guests sit in at Saturday 21:00 are refused ("Someone's sitting there.") from
      both starts. 1,000 random walks (500 tap, 500 stick) never end inside a collider, leave the area or cross a
      wall: 1,532,032 positions over 36,851 m against 502 colliders (the five planting beds added); all 450 tap
      walks with a path arrived.
    - P1b's actions with the crowd in: ordering at the bar and both trucks, from a stool, from either end of the
      bar; Join and Leave in the yard and on the lawn, a tap from one circle to another; nothing through a wall;
      the cooks drawn on Low. Group talk in that run: 0 of 660 samples with two speakers, listeners facing the
      speaker in 923 of 963 (96%).
    - Budgets in P1a's and P1b's views: High at most 200 calls (the day view) and 677,612 triangles (third
      person in the yard) over P1a's nine views; the High action views 129 to 197 calls, up to 684k triangles;
      Low (844x390) worst 121 calls and 242,222 triangles; the phone action views 66 and 74 calls, 129k and 170k
      triangles.
    - The Ultra night and dusk views ran through (the earlier builder's run had lost its browser there): yard
      288 calls and 2.22M triangles, third person at dusk 551 calls and 3.41M.
    - Screenshots looked at: `onfoot-1280x720-{night,ultra-night,ultra-third-evening,act-joined}-p1cE.png`,
      `onfoot-844x390-night-p1cE.png`, `onfoot-390x844-act-joined-p1cE.png`.
  - Earlier runs this session, for honesty: build B (the roster change alone) passed the same 19 crowd checks
    (`onfoot-p1c-buildB-crowd.log`); build D (with the lamp fill, the gate walk and the planting beds) passed 20 of
    20 (`onfoot-p1c-buildD-crowd.log`). Build C's run and build D's regression run were stopped by hand when a
    newer build replaced them (their logs say so). A build G that spread the people's animation updates over
    frames measured no better (Low 90th percentile 0.8 to 4.1 ms, High 1.3 to 6.6 ms) and was reverted; the page
    rebuilt after the revert is byte-identical to build F. The earlier builder's last regression run
    (`onfoot-p1c-final-regress.log`) lost its browser at the Ultra night check and stopped; it isn't counted.
- **Not built, or not measured.**
  - Mingling (someone drifting to another group or the bar and back), dogs, joggers' routes beyond the two
    sidewalks, arrivals from drop-offs at the Dupont kerb, and joining a seated group.
  - The weather's effect on the crowd (the page has no weather) and the first-Friday third truck. The Tuesday
    trivia night is in the curve (+15% from 19:00 to 21:00).
  - Ordering on arrival: a party has its drinks once it's settled, without a visit to the bar.
  - Walking people don't step round each other, only round you and the tables.
  - The lawn chairs' party comes only when the crowd is near full (it's last in the arrival order), so the talk
    check doesn't sample it at Saturday 21:00.
  - At patio distance an impostor holds its painted pose: a walker drawn as one glides.
  - Frame rates on a phone, and the people's CPU per frame on a phone. On this desktop the median is 0.5 to 1 ms
    but one frame in ten reaches 2.8 ms (Low) to 5 ms (High) and the worst 7 to 12 ms: over the plan's 2 ms phone
    target. Where the spikes come from isn't profiled yet (spreading the animation over frames didn't help).
- **For the people builder's session** (its files weren't touched; `src/onfoot/people/` is used through its exports):
  - `lodMaterial()` could take a fill uniform (a local ambient level) so the crowd needn't wrap its
    `onBeforeCompile` (`crowdview.ts` `withFill`).
  - LOD 0 can't be built in a worker: its hair cards draw on a canvas. An `OffscreenCanvas` path would let the
    close-ups build off the main thread too.
  - A seated laugh and a seated talk gesture (the crowd hand-poses the shoulders and a beat hand on top of the
    builder's 'sit'), and an apron garment for the staff.
  - One draw call per person is the crowd's limit on phones (13 bodies at most on Low); a shared skinned batch or
    instanced skinning for the coarse LODs would let more people near you be bodies.
  - Carried from P1b: the LOD 1 shells' ragged open necklines and armholes, and skin flecks at the shoulders on
    heavy builds.

## 2026-11-02: Lot 57 on foot, P1b repaired after review (build D)

The P1b review (one reviewer rejected for play, one kept the code) found four faults the 53 checks never exercised,
and per-frame allocations to remove before commit. All are fixed in `src/onfoot/` and `tests/onfoot.mjs`. The
game's code, its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts` and the people builder
(`src/onfoot/people/`) are unchanged.

- **Fixed**
  - **The cooks were never drawn on Low, the phone default** (a regression from build C's budget fix). The Low
    view test drew its line to the person's centre, and both cooks stand inside their truck's collider, so the
    line always hit the truck. Staff are now tested to a point 0.3 m out on the customer's side of their counter
    (`npcs.ts`, `StaffPost.seeX`). The view test also has its own filter now (`main.ts`, `blocksView`). Only
    full-height things hide a person: walls, buildings, truck bodies, tanks and doors. Glass doesn't, and neither
    does a stretch of wall with an eye-level window in it (the Shed's two storefront windows and the tank-room
    window: `venue.ts` marks those stretches `see`, and they stay solid to walk into and to act through). The low
    planter walls, fences and gates you see over don't hide anyone either; build C hid the yard's people from the
    Orangewood sidewalk behind the 0.95 m planter wall.
  - **A tap on a person while you stood in another group's circle stopped you 2.38 m from the old group.**
    Leaving a circle always walked you a step back, and that walk replaced the tap's. Now the step back happens
    only when you press Leave standing still, or on the way in to join (`doings.ts` `leave()`). If you're already
    walking somewhere else, you keep going.
  - **At the ends of the bar the drink was ready before the bartender got there.** The 4 to 8 s now start once the
    bartender or cook reaches the taps or the flat-top (`doings.ts` `tick()`, with a 20 s fallback). Staff also
    walk at 1.2 m/s, not 0.75 (`npcs.ts` `update()`); the builder's walk cycle is tuned for 1.25.
  - **The regulars' clothes showed skin.** At LOD 1 (what everyone is drawn with on Low and High), the builder's
    shells cut v, scoop, square and strap necklines and sleeveless armholes with ragged edges. That made a dress
    read as torn. Separately, Lena's tan shirt (`0xc9a77a`) read as bare skin under the string lights. I rendered
    the regulars side by side at LOD 1 (crew, v and scoop necks; 0.3 and 0.5 sleeves; on a slim and a heavy
    build): a crew neck with half sleeves was the cleanest. `npcs.ts` `patioOutfit()` now gives the regulars'
    tops and dresses a crew neck (shirts and polos keep their collars) and sleeves to at least half the upper arm
    (0.5 where they were under 0.3). A top in a skin-like colour (sRGB hue 12 to 50 degrees) takes one of our dark
    colours instead (Lena's shirt is now red). Heels still become flats on the lawn.
  - **Per-frame allocations.**
    - `doings.ts` `available()` now writes the shared pair in place: no list, no closure.
    - `npcs.ts` `soft()` reuses its objects.
    - Module-level Sets replace the array literals in `items.ts` `formOf` and `isDrink` and in `npcs.ts`
      `placeHeld`.
    - `itemName` reads a table built once.
    - The order chip is rewritten only when its stage, item, order or 2% progress step changes.
    - The staff-mouth loop is a plain loop.
    - `hud.ts` `status()` caches its text span and writes `--p` only on change.
- **Checked** on build D (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1b-buildD.md5`) with
  `node tests/onfoot.mjs --suffix=-r2`. Headless Chromium with SwiftShader, one browser at a time. `npx tsc
  --noEmit` is clean. Every screenshot named here was looked at.
  - Landscape, portrait, phone actions, walks and names: **22 of 22**
    (`tests/out/onfoot/logs/onfoot-p1b-r2-lowgroups-buildD-2026-11-02.log`).
    - New phone check (390x844, Low): each truck cook is drawn 1.94 m from you at the window, at the flat-top
      while making, and back at the window when the elote is ready (`onfoot-390x844-act-truck-r2.png`). Both cooks
      are hidden from behind their trucks. The bartender is drawn through the west storefront window from the
      forecourt, and hidden from a spot where the line runs through the wall between that window and the
      entrance.
    - Low budgets hold: worst 118 calls and 242,295 triangles over P1a's seven views; the phone action views drew
      64 calls and 122k triangles holding, 71 calls and 162k joined (build C: 73 and 161k joined).
    - 1,000 random walks pass against 497 colliders: the window stretches add six segments to the 491, with the
      same union.
  - High actions (1280x720), the 13 earlier checks and two new ones, with the phone actions run again in the same
    process: **21 of 21** (`tests/out/onfoot/logs/onfoot-p1b-r2-actions-buildD-run3-2026-11-02.log`).
    - Bar ends: from stools 0 and 19, the bartender walked 6.96 m and 14.4 m before starting. The orders were ready
      at 12.5 s and 17.1 s (makes of 6.68 s and 5.15 s), with the bartender 1 m from the cup across the counter and
      0 m along it. The check allows 1.05 m across and 0.3 m along: the bartender stands behind the 0.72 m counter
      and its mats.
    - Tap from inside a circle: joined to the yard group, a tap on Kenji in the lawn group walked you 31.8 m. You
      left the yard circle on the way, stopped 1.72 m from the lawn group's centre (radius 0.8 m), and were offered
      Join for that group.
    - Glass: the wall check now also taps seat 22 through the storefront glass. It's picked, the walk goes in by
      the entrance (crossing the Shed's north wall at x -5135.86, inside the 2.8 m doorway), and you sit.
    - Budgets: the High action views drew 114 calls and 306k triangles holding, 177 and 640k holding in third
      person, and 193 and 691k joined in third person (limits 350 and 700k). Ultra joined drew 393 calls and
      2,478,124 triangles.
    - Group talk: 0 of 120 samples had two speakers; listeners faced the speaker in 197 of 208 (95%).
  - P1a's desktop group at High (1280x720): **19 of 19** on build D
    (`tests/out/onfoot/logs/onfoot-p1b-r2-desktop-buildD-2026-11-02.log`). Tap to go still reaches all 172 seats
    from both starts (344 walks, all seated). The High budget holds over the nine views: worst 228 calls and
    680,215 triangles (the third person from the front), limits 350 and 700k.
  - So every High check now comes from build D: the review's gap (the 32 High checks from build A) is closed.
  - Run history, for honesty. The first High actions run on build D
    (`onfoot-p1b-r2-actions-buildD-run1-2026-11-02.log`) passed 13 of 15. The two failures were in the tests: the
    stool check waited exactly the make's length, and the new bar-ends check compared local with game coordinates.
    A second run (`...-run2-fixedwaits-...log`) showed that the older bar check's fixed wait (`dur - 2.5 + 0.2` s
    after a 2.5 s step) also came up 0.02 s short now that the make starts on arrival. That left an order pending,
    and four more checks failed in a cascade. Every order wait in the suite now steps the world until the order is
    ready (at most 30 s).
- **Screenshots** (`tests/out/onfoot/`, `-r2` names, all looked at):
  - `onfoot-390x844-act-truck-r2.png` (new) and `onfoot-390x844-act-{making,joined,reply,left}-r2.png`.
  - `onfoot-844x390-night-r2.png` and `onfoot-1280x720-{night,trucks-night}-r2.png`.
  - `onfoot-1280x720-act-{ready,ready-truck,seated-holding,holding-third,joined,joined-third,left,wall-tap,
    joined-ultra}-r2.png`.
  - The other `-r2` shots were re-made by the same runs and aren't cited here.
- **Known costs and carried forward.**
  - Switching quality between Low and High here rebuilds the nine people, and the page freezes for 23 to 32 s
    (the reviewer's measurement; not re-measured here).
  - On heavy builds (fat about 0.9), the LOD 1 shell still lets the skin through in small flecks at the top of the
    shoulders, whatever the garment. A crew dress, a top and skirt, and a closed cardigan all showed it in the
    side-by-side renders. Jules at the yard table shows it in `onfoot-1280x720-act-joined-r2.png`. That fix
    belongs to the people builder's session (notes below).
  - At night the cooks read as dark silhouettes against their lit kitchens on Low, which has no point lights. On
    High the taco cook is still in silhouette while the noodle cook is lit (`onfoot-1280x720-trucks-night-r2.png`,
    looked at).
  - `onfoot-1280x720-act-wall-tap-r2.png` is nearly black: the forecourt is unlit at night (P1a), and the solid
    wall fills the middle of the view.
  - Toast and caption timers count frames, so they linger under SwiftShader. That's a test artefact.
- **For the people builder's session** (its files weren't touched):
  - LOD 1 garment shells cut open necklines (v, scoop, square, strap) and sleeveless armholes with a ragged,
    stair-stepped edge that shows skin in patches.
  - On bodies with fat at about 0.85 or more, skin flecks show at the shoulder tops through any upper garment at
    LOD 1. Seen on `randomPerson(301)` (fat 0.88) and `randomPerson(302)` (0.93) at 1 to 2 m.
  - There's no apron garment for staff.

## 2026-11-02: Lot 57 on foot, P1b: things to do (tap to go, Sit, Order, Join and Leave)

P1b of `PROJECT_OC_ON_FOOT.md` Phase 1 ("What you can do"), on the standalone page (`src/onfoot/`). The game's code,
its `vite.config.ts` and `package.json`, and the people builder (`src/onfoot/people/`, used through its exports only)
are unchanged.

- **New** (all in `src/onfoot/`):
  - `lot57/doings.ts`: the context actions and their order: Pick up, Leave, Stand, Drive, Order, Join, Sit. One big
    button (76 px) shows the best one; a second, smaller one appears when two make sense (Order and Sit at the bar;
    Stand and Order on a bar stool). Every action needs a clear line from you to what it acts on (no wall, fence,
    gate, glass, door, truck, tank or building in between, tested in 2D against the colliders) as well as range.
  - Ordering: the bar and both truck windows. A sheet of five big buttons (64 px tall) per counter, our own items,
    free (no prices, no credits), alcohol-free for you. The bartender or cook comes along the counter to you, turns
    to the taps or the flat-top to make it (4 to 8 s, a progress ring on the order chip), sets it on the counter and
    says so; Pick up puts it in your hand. You hold it in the lower right of the first-person view and in your
    avatar's right hand in third person (the forearm brought up, steady while you walk). Ordering from a bar stool
    works without standing.
  - `lot57/items.ts`: the menu (15 items over three counters) and each item modelled in code: lathed cups with our
    printed sleeves (LOT 57, TWO LANE, NIGHT SHIFT), ice, straws and citrus wheels; a shaker pint with a foam head;
    paper boats with a checked liner (tacos with chunky filling, a three-hole pretzel with salt and mustard,
    dumplings); a noodle box with flaps, a wire handle and chopsticks; an elote cup; a bowl of cucumbers. One
    painted 256 px atlas, three materials, lit after dark like the venue's baked light.
  - `lot57/npcs.ts`: two groups of three regulars (by the barrel table in the yard, on the lawn by the bag toss),
    the bartender and a cook in each truck, built by the people builder at load. Groups talk on their own: one
    speaker at a time, turns of 1 to 10 s (median about 3.5 s), pauses, listeners looking at the speaker with
    glances away, nods, group laughter. Join opens a gap in the circle where you stand (they re-space keeping their
    order, the host across from you) and they turn to you; a short conversation runs (`lot57/talk.ts`: a line, two
    reply chips, their answer, a second exchange from someone else, then "Drive safe" and back to their own talk).
    Leave mid-conversation and someone says goodbye; the circle closes up with your spot between two of them. On
    Ultra the host is the builder's close-up body (LOD 0). People are soft: tap to go plans round them, and they
    nudge rather than block you.
  - Tap to go: a seat (sits you down), one of the regulars (walks you up to the group), staff or the counter or a
    truck window (walks you there and opens the order sheet on arrival), or the ground. Only what you can see
    counts: a seat or a person farther along the ray than the first solid wall it hits isn't picked. Glass isn't a
    wall for a tap: a stool seen through a storefront window from the forecourt is picked, and the walk goes in by
    the entrance (seat 22, checked in the repair below). Acting still needs a clear line, so Sit isn't offered
    through the glass.
  - HUD: captions with the speaker's name (a question stays up until you answer), reply chips, the order sheet,
    and an order and holding chip. Phone portrait stacks the chips in a column above the order chip and puts the
    captions under the crowd chip; keyboard 1 to 5 picks on the sheet, 1 and 2 reply, Escape closes; gamepad B
    stands, leaves or closes.
  - Test hooks added on `window.__onfoot`: `target`, `press`, `sheet`, `pick`, `closeSheet`, `reply`, `state`,
    `talk`, `groups`, `npcs`, `counters`, `reach`, `offerAt`, `sight`, `project`, `lastTap`, `inHand`, `hold`;
    `sim(seconds, untilStop, world)` runs the people and the order too; `stats()` now reports npcs, groups, staff,
    npcsDrawn, npcTris, npcCalls, crowdBuildMs, holding.
  - Low stays inside its budget with the people in it: on phones, regulars past 40 m and drinks in hand past 15 m
    aren't drawn (the plan's far-crowd impostors aren't built), people a wall or a truck body hides aren't drawn, and
    the parked cars get their detailed models only within 45 m (the 12 nearest had them however far off, 70 m away
    behind the Shed from the sidewalk). High and Ultra draw as before.
  - Fixes found by the checks: the opener's caption timed out while the reply chips waited (it now stays until you
    answer); the member who said goodbye kept talking over the group's own next turn; the paper boats and noodle box
    were wound inside out (liner outside, print inside); the tacos read as sausages (now chunky filling between
    tortilla edges); in portrait the caption overlapped the chips and the order chip sat on the map credit.
- **Checked** with `node tests/onfoot.mjs` (headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time on a machine shared with five other workflows). **53 of 53 pass** across two builds:
  - Build A (`tests/out/onfoot/logs/onfoot-p1b-full-buildA-2026-11-02.log`, every group): 52 of 53; the Low budget
    view failed at 252,499 of 250k triangles with both groups in it.
  - Build C, the final one (`dist/onfoot/index.html` md5 in `tests/out/onfoot/logs/p1b-buildC.md5`): landscape,
    portrait, phone actions, walks and names re-run, **21 of 21**
    (`tests/out/onfoot/logs/onfoot-p1b-lowgroups-buildC-2026-11-02.log`). Build C differs from A only in lines that
    apply on Low (the phone people and drink distances, the 45 m car detail), so the 32 High checks (P1a's desktop
    group and P1b's desktop actions) stood from build A (the review found that gap; all of them were re-run on
    build D in the repair entry above). `npx tsc --noEmit` is clean. Every screenshot named below
    was looked at.
  - Tap to go: a tap on the ground walks a 4-waypoint path round a table with the dots shown, and arrives; a tap on
    a seat on screen walks there and sits; P1a's check still reaches all 172 seats from the front gate and the lot
    walk and sits (344 walks, now with the people in place); 1,000 random walks (500 tap, 500 stick) never end inside
    a collider, leave the area or cross a wall (1,456,209 positions over 35,012 m, 491 colliders), and all 445
    tap walks with a path arrive.
  - Sit and Stand at every kind of seat (bench, picnic, lawn chair, bar stool, high-top) with the button; on a bar
    stool the buttons read Stand and Order.
  - Order and hold: at the bar, the sheet's five items, made in 6.19 s (4 to 8), the bartender at the taps, ready on
    the counter, Pick up, held in first person and in third person 0.088 m from your avatar's right hand; both
    trucks (birria tacos, garlic noodles), each Pick up replacing what you held; from a bar stool, ordered and
    picked up without standing; on a phone, a finger tap on the bar walks you there and opens the sheet (buttons
    64 px tall), a tap on an item, Pick up with the button.
  - Join and Leave: the yard group re-spaces to leave a 90 degree gap either side of you, the host across; a full
    conversation (hello, a line, your reply chip, the answer, a second exchange from another member, "Good talking.
    Drive safe."), then Leave puts you 1.97 m from the centre; the lawn group joined by tapping one of them on screen
    and left mid-conversation (a goodbye); on a phone the caption, chips (56 px or taller) and button are on screen
    and clear of each other. Group talk over 30 s: 0 of 120 samples with two speakers, listeners facing the speaker
    in 196 of 204 (96%).
  - Nothing through a wall: over every free point in a 0.5 m grid round the venue (30,486 points), each offer (2,009
    at normal reach; 14,803 with the ranges stretched four times) has a clear line to what it acts on, checked in
    Node against the exported colliders; at four times the reach the line test turned down 185 nearest seats behind
    walls. A tap on a high-top stool behind the Shed's north wall from the forecourt, and on the cook from behind the
    taco truck, went to the ground; the same stool tapped from inside was picked; nothing is offered at a truck's back.
  - Ultra: the host who talks to you is the builder's close-up body (LOD 0): 393 calls, 2,447,828 triangles in that
    view (no Ultra budget in the plan).
  - Budgets (`renderer.info`, shadow passes included): High worst 228 calls and 680,195 triangles over P1a's nine
    views, and 193 calls, 690,134 triangles in the action views (joined, third person; limits 350 and 700k); Low
    worst 118 calls and 242,295 triangles over P1a's seven views (limits 150 and 250k), and in the phone action views
    73 calls and 161k triangles joined, 64 and 122k holding (as the check prints them).
  - `stats()` on High at the start, Sat 21:00: npcs 9, groups 2, staff 3, seated 0, walkers 0, npcsDrawn 7, npcTris
    10,852, npcCalls 7, draw calls 231, triangles 655,584, sim 0 ms, frame 6.2 ms (CPU time in SwiftShader, not a
    frame rate), crowd built in 15,063 ms. On Low (390x844): 100 calls, 219,370 triangles, crowd built in 10,964 ms.
- **Screenshots** (`tests/out/onfoot/`): `onfoot-1280x720-act-{tap-to-go,sit,order-sheet,making,ready,holding,
  holding-third,ready-truck,holding-noodles,seated-holding,joined,joined-third,left,wall-tap,joined-ultra}.png`,
  `onfoot-390x844-act-{tap-to-go,sit,order-sheet,making,ready,holding,joined,reply,left}.png`, and P1a's views re-shot
  with the people in them.
- **Not done or not measured**: frame rates on a phone or a GPU; the crowd at full scale (40 NPCs, arrivals,
  walkers, seated groups, the crowd curve driving numbers) is the next milestone. Building the nine people takes
  10 to 15 s of the load here. The people builder's own limits show up close (LOD 1 faces at conversation distance
  are soft; some outfits showed skin-coloured patches at the neckline, fixed for the regulars in the repair below,
  and some flats read as bare feet); staff wear our
  patina-green tops because the builder has no apron garment; the hold pose and nods are applied over the
  builder's animation from `npcs.ts` (the builder's files are unchanged). The forecourt north of the Shed is unlit
  at night (P1a).

## 2026-11-02: Lot 57 on foot, P1a finished and re-verified on the final build (35 of 35 checks)

The P1a builder of 2026-10-21 (entry below) was cut off mid-run: its last suite runs (17:45 and earlier) lost their
browser part-way, so nothing after its morning 26-check run had been verified end to end. This pass picked up the
drafts as they were on disk, finished the venue's dressing and re-ran the whole suite. The game's code, its
`vite.config.ts` and `package.json`, and the people builder (`src/onfoot/people/`) are unchanged.

- **What changed in this pass** (all in `src/onfoot/`):
  - The yard reads as a beer garden by day: a market umbrella through every communal table (cream canopy with a
    crown, a teal or patina valance, ribs and a runner underneath), four barrel standing tables between the tables (no
    seats; the Shed's barrels share the same code), a steel napkin and salt-and-pepper caddy at both ends of every
    table, and a chalkboard A-frame on the walk in at the front gate (our tap list).
  - The palms along Orangewood are now colliders (they had none, so you could walk through a trunk), and none stands
    in the middle of the walk to our front gate.
  - A soft pool of light on the ground under every street and lot head after dark (one additive draw call): the
    asphalt's dark colour swallowed the baked lamp light, so Orangewood read black between the lamps.
  - Your car is parked with its lamps off (it showed its headlamps lit in the lot at night).
  - Rounder bar stools and barrel tops on High and Ultra (16 and 24 sides); Low keeps cheaper ones, and on Low the
    table caddies, the umbrella ribs and four in nine of the bougainvillea leaves aren't drawn, which keeps Low inside
    its triangle budget (it was 253,577 of 250k after the dressing; now 245,487).
  - The male driver's build and face are a little broader (shoulders, jaw, brow): at third-person distance the
    builder's default male frame read narrow and soft in the fitted white shirt.
  - Toasts name the new obstacles ("A palm", "The chalkboard", the host stand, shelf, generator and propane cage).
- **Checked** with `node tests/onfoot.mjs` (headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time; 27 minutes on this shared machine). **35 of 35 pass** on the final build
  (`tests/out/onfoot/onfoot-checks.json` and `tests/out/onfoot/logs/onfoot-final-2026-11-02.log`, 2026-11-02 05:09
  UTC). `npx tsc --noEmit` is clean. Every screenshot below was looked at.
  - Boots with no console errors at 1280x720 (High), 844x390 and 390x844 (touch, Low by default) and 640x360 (walks).
  - Day (Sat 14:00) and night (Sat 21:00) screenshots at all three sizes, the "Simulated crowd" chip and the
    OpenStreetMap/Overture credit on screen and inside the viewport, clear of the action button.
  - 1,000 random walks (500 tap to go, 500 stick): 1,455,899 positions over 35,006 m, checked in Node against the 491
    exported colliders and the walkable region by an independent checker (which is shown to catch a made-up path
    through the Shed's wall, into a bench and onto the road): none ends inside a collider, leaves the area or crosses
    a wall or fence. All 445 tap-to-go walks with a path arrived; 55 taps had no path (shut or staff-only places).
  - Tap to go reaches all 172 seats from the front gate and from the lot walk and sits you down (344 walks, 14.0 to
    67.3 m); tap a bench seat, walk 6.78 m, Sit, Stand.
  - Touch (thumb pad 1.05 m, look drag 20 degrees, a quick tap starts a walk), keyboard (W 1.03 m) and a stubbed
    gamepad (left stick 1.11 m, Y to third person).
  - Reduced motion: head bob 3.0 cm to 0, the toast's transition 0 s. Closing (Tue 09:00) shows you out to the lot
    walk with "Closed · opens 11:00" and "Simulated crowd · Closed", and a tap into the yard finds no way in.
  - Budgets (`renderer.info`, shadow passes included): High worst 195 calls and 669,951 triangles over nine views
    (limit 350 and 700k); Low worst 118 calls and 245,487 triangles over seven views (limit 150 and 250k). Ultra (no
    budget in the plan): 264 calls and 2.08M triangles in the yard at night; 432 calls and 2.84M in third person with
    the close-up driver (158,252 triangles, 19 calls).
  - `stats()` on High in the day: npcs 0, groups 0, seated 0, walkers 0, 195 draw calls, 629,928 triangles, sim
    0 ms, frame 9.1 ms (the page's CPU time per frame in SwiftShader, not a frame rate). The crowd is P1b, so the
    people counts are 0 by design.
  - The real venue's name is in none of the 46 files in `src/onfoot`, `src/data/anaheim` and the built page; our
    names are on the page, and it never says "real-time" or "people here now".
- **Screenshots** (`tests/out/onfoot/`): `onfoot-1280x720-{day,third-day,third-front-day,trucks-day,night,
  third-night,shed-night,trucks-night,park-night,sign-night,sign-crosswalk-night,seated-night}.png`,
  `onfoot-1280x720-ultra-{night,trucks-night,shed-night,bar-night,sign-night,third-evening,lot-evening}.png`,
  `onfoot-1280x720-aerial-evening.png`, `onfoot-844x390-{day,night,sign-night}.png`,
  `onfoot-390x844-{day,night}.png`. (The "evening" shots are at 17:30, which in this week's season is after dark.)
- **Not done or not measured**: frame rates on a phone or a GPU; the crowd, Order, Join and Leave (P1b). The parked
  cars are the game's traffic models and read toy-like up close; the driver's look in third person (a dark notch at
  the fitted shirt's collar, a lumpy back) belongs to the people builder, which another session owns.

## 2026-10-21: Lot 57 on foot, P1a: the venue, your driver, controls, collisions and test hooks (standalone page)

*(Superseded by the 2026-11-02 entry above: the numbers below come from a 26-check run on the morning of
2026-10-21; later changes that day, such as the close-up driver on High, were never verified end to end.)*

Phase 1a of `PROJECT_OC_ON_FOOT.md`: a standalone page, not yet in the game. `src/onfoot/index.html` with its own
Vite config (`npx vite build --config src/onfoot/vite.config.ts` writes `dist/onfoot/index.html`, one file that opens
from disk; `npx vite --config src/onfoot/vite.config.ts` serves it). The game's code, `vite.config.ts` and
`package.json` are unchanged.

- **The venue, ours, built in code** (`src/onfoot/lot57/`): the Shed (brick-red tilt-up, five-tooth north-light
  sawtooth roof, four glass roll-up doors, our mural; inside a 16 m bar with 20 stools, a tap wall of plain coloured
  handles, eight tanks behind glass, six high-tops, barrel tables, a chalkboard of our own items and the game's local
  leaderboard labelled "this device only"), the yard (12 communal tables, 8 poles plus 4 over the lawn and trucks, 411
  bulbs on catenaries, 4 heaters), the lawn (three bag-toss lanes, a stacking-block table, lawn chairs), Two Lane
  Tacos and Night Shift Noodles with picnic tables, the planter wall and gate, our 6.5 m pylon sign with its reader
  board, the lot (stalls, wheel stops, a planted median, lot lights) with your car in your stall. Night light is baked
  per vertex; the gates and doors shut after our fictional hours and you are shown out.
- **Around it, from OpenStreetMap via Overture (ODbL, credited on screen)**: Orangewood and the Dupont loop, mapped
  sidewalks and crosswalks, the business park's footprints and heights, parking areas, land use, the stadium's light
  towers as plain massing. Road widths, markings, lamps, palms and the block's turf setbacks are our defaults. The real
  footprints in our site are dropped.
- **Your driver** (the people builder) in first and third person; LOD 1 on Low and High, the close-up LOD 0 in third
  person on Ultra.
- **Controls**: touch (a floating thumb pad in the left 45%, a look drag on the right, tap to go), keyboard (WASD,
  Shift, E/Q/V/C, Esc) and gamepad (sticks, A/X/Y/B, Back, Start).
- **Collisions**: a 0.3 m body pushed out of every wall, fence, table, bench, truck, planter, pole and parked car
  (polygons, boxes, circles, segments in a 4 m hash), three passes a step; kerbs are walls except at crosswalks; tap to
  go on a 0.5 m grid with A*.
- **Test hooks** on `window.__onfoot`: `setClock(day, hour)`, `setQuality('low'|'high'|'ultra')`, `stats()` (npcs,
  groups, seated, walkers, drawCalls, triangles, simMs, frameMs and more), `go(x, z)`, `tap(x, z)`, `act()`,
  `view()`, `frames`, plus `look`, `walk`, `sim`, `pos`, `colliders`, `region`, `seats`, `probe`, `breakdown`.
- **Not in P1a**: the crowd (NPCs, groups, staff) is P1b; `stats()` reports 0 people. The chip already shows the
  simulated level from the clock ("Simulated crowd · Packed" on a Saturday night).

Checked by `node tests/onfoot.mjs` (headless Chromium, SwiftShader; screenshots in `tests/out/onfoot/`):
- **26 of 26 checks pass** (`tests/out/onfoot/onfoot-checks.json`, 2026-10-21):
  - Boots with no console errors at 1280x720 (High), 844x390 and 390x844 (touch, Low: the default for a coarse
    pointer), and 640x360 (the walk run).
  - Day and night screenshots at all three sizes with the "Simulated crowd" chip and the OpenStreetMap/Overture credit
    on screen and readable (their boxes are checked to be inside the viewport and clear of the action button).
  - 1,000 random walks (500 tap to go, 500 stick, from seeded random free points) never end inside a collider, leave
    the walkable area or cross a wall or fence: 1,236,553 positions over 17,077 m, each checked in Node against the
    438 exported colliders and the walkable region by an independent checker. The checker is shown to fail on a made-up
    path through the Shed's west wall, into a bench and onto the road. 53 taps had no path (targets in staff-only or
    shut areas such as the tank room); they toast "Can't get there from here".
  - Touch: the thumb pad walks you 1.45 m in a few frames, a look drag turns you 20°, a quick tap starts a walk.
    Keyboard: W walks 1.33 m. Gamepad (a stubbed `navigator.getGamepads`): the left stick walks 0.89 m, Y switches to
    third person.
  - Tap a bench seat, walk there (6.78 m path), Sit, Stand with the action button.
  - Reduced motion: the head bob goes from 3.0 cm to 0, the toast's transition to 0 s.
  - At closing (Tue 09:00) you're shown out to the lot walk, the hours read "Closed · opens 11:00", the chip
    "Simulated crowd · Closed", and a tap into the yard finds no way in.
  - Budgets (`renderer.info`, shadow passes included): Low worst 106 calls and 234,067 triangles over seven views
    (limit 150 and 250k); High worst 178 calls and 677,790 triangles over the day, third-person, night and Shed views
    (limit 350 and 700k). Ultra (no budget in the plan) draws 213 calls and 1.31M triangles at night; in third person
    at dusk with the LOD 0 driver (159,850 triangles, 19 calls) it's 368 calls and 2.09M triangles (that view shot with
    `node tests/onfoot-shots.mjs`, `onfoot-1280x720-ultra-third-evening.png`).
  - The real venue's name appears in none of the 44 files in `src/onfoot`, `src/data/anaheim` and the built page; our
    names (LOT 57, Two Lane Tacos, Night Shift) are on the page, and it never says "real-time" or "people here now".
- **Fixes in this round**: Low was at 243k of its 250k triangles, so Low now draws 8-triangle bulbs and 12 detailed
  parked cars (16 before); High drew the close-up driver (LOD 0) in third person, 845k triangles with its shadow, so
  LOD 0 is now Ultra only; on High the bulbs are 36 triangles and the plants don't cast shadows. The idle body turns to
  face where you look (in third person it used to face the camera). The block's setbacks are turf, not bare dirt.
  Ultra builds the parked cars from the traffic models' high-quality set.
- **Not measured**: frame rates on a phone or a GPU. `frameMs` in `stats()` is the page's own CPU time per frame in
  SwiftShader, not a frame rate.

## 2026-10-17: the navigation card, the destination card and blue chevrons on the road (UI pass, U2)

Panel 2 of the owner's concept board, built from `PROJECT_OC_UI_TARGET.md` (U2). It shows only with a route set
(Go to, or `navigateTo`), reuses the route planner and `Game.nextManoeuvre()`, and is hidden in races.

- **Navigation card** (top left on a wide screen): the manoeuvre's arrow in the route's blue (a fork for keep
  left/right, mirrored for left; straight on otherwise), the distance, "Keep right" and the road it leads to as a green
  guide sign ("CA-55 NORTH": the first freeway along the route, so a ramp signed for both directions reads the one you
  want), and under a hairline the next exit along this road with its real sign text from the map data ("Your exit" when
  it's the one the route takes, "Next exit" otherwise; on a ramp, "Now on" and the sign the ramp was taken from). A ramp
  that forks at its end now reads "Keep left/right" too, not "Continue". The stats plate moves under the card.
- **Destination card** (top right, under the corner window): the destination road and its distance along the route,
  the time at your pace (your speed damped over about 12 s; "–" when you're barely moving) labelled "at your pace", and
  the traffic setting labelled "simulated". The Minimal HUD tucks it away with the corner window.
- **Phone**: each folds into one line. The manoeuvre (arrow, distance, sign) sits under the road chip where the green
  prompt was; the destination line (time at your pace · traffic · simulated, plus the road when the sign doesn't
  already name it) sits above the chip, under the speed box and the corner window, so neither covers more road than
  the prompt did.
- **Chevrons** (`src/game/road/chevrons.ts`): one InstancedMesh of up to 81 flat quads every 4 m for 300 m, 7 cm over
  the road, fading in over the first 14 m and out over the last 150 m; on the lane the route needs (the exit lane within
  1600 m of a diverge, moving over from your lane with a smoothstep; the side a forking ramp goes; the outside lane where
  a ramp joins). Legs are worked out only when the route or your road changes (`chevrons.rebuilds`). A crisp core over
  an additive glow, blended premultiplied so the blue holds on sunlit concrete (pure additive washed out to near white
  there: the first capture). Seen from every camera; hidden with no route, in the attract drive, in races and in the
  corner's sky camera.
- **Open**: on a phone in the default driver's-seat view the HUD covers most of the chevrons; a layout fix to
  follow. Screenshots: `tests/out/ui-after/nav-phone.png`, `nav-desktop.png`, `nav-chevrons-chase.png`,
  `nav-chevrons-ramp.png`, `nav-sky-corner.png`, `tests/out/phone-nav.png` (local, not committed).
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "19/19 passed", including the new
  phone check "Go to: navigation line, destination line and road chevrons; Clear route hides them" (picks CA-55 North in
  Go to on a 390 × 844 phone: both lines one line tall, clear of each other and the road chip, nothing cut short, 72
  chevrons; Clear route hides both lines and all chevrons). `tests/out/u2-nav-shots.mjs` (Free Drive on I-405 North,
  route to CA-55 North, the car in lane 2 of 5 about 230 m before the 55's ramp): the chevrons read d = 0 m at 6 m ahead,
  2.2 m at 46 m, 6.7 m at 86 m and 7.3 m (the centre of lane 4, the exit lane) from 106 m on, then follow the ramp; on
  the two-lane ramp before it forks they keep to its right lane (d = 1.8 m), the side for the 55 North; the card says
  "730 ft · Keep right · CA-55 NORTH · Your exit: CA 55 North / CA 55 South / Freeway"; no clipped text, no sideways
  scroll; Clear route: no cards, 0 chevrons; no page errors at either size.
- **Screenshots** (tests/out/ui-after/): nav-phone.png, nav-desktop.png, nav-chevrons-chase.png, nav-chevrons-ramp.png,
  nav-sky-corner.png; tests/out/phone-nav.png from the suite.
- **Found, not fixed** (outside U2): the corner's sky camera draws in the wrong place when the render scale isn't 1
  (the Low preset's 0.75 on a desktop): `renderCorner` multiplies the scissor and viewport by the pixel ratio, and three.js
  multiplies them again, so the picture lands at 0.75 of its place and size on screen and the window stays blank
  (nav-sky-corner.png). Wherever the renderer's pixel ratio isn't 1 (a phone on Medium or up: 1.5 to 2) it lands
  scaled by that ratio instead. Passing CSS pixels (no `* pr`) should fix it.

## 2026-10-16: the adaptive HUD: a HUD style setting, a compass, a clock chip, auto-hide (UI pass, U1)

Panels 1 and 9 of the owner's concept board, built from `PROJECT_OC_UI_TARGET.md` (U1).

- **Status row, both styles**: a thin compass strip at the top centre (a tape of ticks with N E S W and the four
  between, under a sunset index; the bearing is the car's own, from its yaw) and a chip at the top right with this
  device's clock and the temperature the game simulates, labelled "simulated" (`Environment.tempF`: OC's coast by the
  hour, less a few degrees for the weather in force; a clear day reads 72°). The top bar and the corner window now sit
  one row lower, under it.
- **HUD style** (Settings, Display): Modern (the default: every control stays) or Minimal. In Minimal, after 4 s of
  just driving the top bar slides up and away and the corner window off the right edge (the game stops drawing it
  there); speed, gear, the stats, the route prompt and the ability ring stay. Pause stays too, as a round chip in the
  corner, so pausing is always one tap. With a route set, a round nav bubble takes the corner's place: the next
  manoeuvre's arrow (keep left, keep right, ahead) and the distance. A tap, a mouse move, a key or a pad button brings
  everything back; driving input (the pedals, the steering rail, W A S D and the arrows, Space, Q, E, V, the pad's
  triggers and handbrake and shift buttons) doesn't, or the road would never clear. Keyboard focus on a control of the
  bar keeps it up. Reduced motion: it just shows and hides, no slide.
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "18/18 passed", including the new
  phone check "HUD: compass and clock chip; Minimal tucks the bar away after 4 s, Pause stays, a tap brings it back"
  (it switches to Minimal through Pause, Settings, HUD style; reads 304° on I-405 North through Irvine, which runs
  northwest; then pauses from the round chip). `tests/out/u1-hud-shots.mjs` at 390x844 and 1440x900: Modern still up
  after 5.5 s; Minimal tucked away 3.5-4.2 s after the last input; a real tap (phone) or mouse move (desktop) brought it
  back; holding W did not; Tab did, and focus on "View" held the bar up past 6 s; with reduced motion the transitions
  are 0 s; no page errors.
- **Screenshots** (tests/out/ui-after/): hud-modern-phone.png, hud-modern-desktop.png, hud-minimal-shown-phone.png,
  hud-minimal-shown-desktop.png, hud-minimal-hidden-phone.png, hud-minimal-hidden-desktop.png, hud-settings-phone.png,
  hud-settings-desktop.png.

## 2026-10-16: the main menu is one glass sheet with a Drive dock (UI pass, U0)

The owner asked for a main menu that feels "more seamless" with "a finer luxury Apple-like aesthetic feel". Built from
`PROJECT_OC_UI_TARGET.md`, section "Owner's direction, 2026-10-16" (U0).

- **One sheet**: the menu is a single frosted-glass sheet over the live attract drive. Opening Settings, Bests,
  Profile, Driver, Garage, Start or Course changes what the sheet shows with a cross-fade; the sheet itself stays put
  instead of a new panel mounting.
- **The dock**: a Drive dock stays at the bottom while screens change, marks the screen you are on, and there is only
  one Drive button. Tapping the current screen's dock button returns to the menu.
- **The finish**: hairline borders, large soft radii, spacing on an 8 pt rhythm, the system font stack for text,
  CSS-drawn switches and segmented controls, visible focus rings, reduced motion respected. Chrome noir's base and
  yellow accent stay; the angled chips and magenta corners are gone.
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "17/17 passed, exit 0", including
  the new phone check "menu: one sheet; the Drive dock stays while its screens change" (result "same sheet, dock marks
  Settings, one Drive button"). A separate review script at 390x844 passed 14/14.
- **Screenshots** (tests/out/ui-after/): menu-before-phone.png, menu-before-desktop.png, menu-after-phone.png,
  menu-after-desktop.png, u0-crossfade-mid-phone.png, u0-crossfade-mid-desktop.png, u0-focus-phone.png,
  u0-focus-desktop.png, and the full set phone-*.png / desktop-*.png (menu, settings, bests, profile, driver, garage,
  start, course, loading, driving, goto, paused, results).

## 2026-10-16: the game is "OC Ultra", and the OC sunset wordmark replaces the R badge (UI pass, identity)

The owner, looking at the loading screen on their phone: "get rid of that R as the logo and replace it with the new
logo; make the game called 'OC Ultra' and below just make it say 'Top Speed'." Built from `PROJECT_OC_UI_TARGET.md`,
section "Identity: the OC sunset wordmark".

- **The lockup** (`src/ui/Mark.tsx`, `OcLockup`): the owner's OC wordmark, the chromed ULTRA beside it on the letters'
  baseline, a quiet TOP SPEED line under both. It is the page heading on the menu and the loading screen ("OC Ultra
  Top Speed" to a screen reader) and one labelled image ("OC Ultra: Top Speed") in the pause and results headers. No
  R badge anywhere in the UI; the R stays the car's brand on the wheel hub and bodies, untouched.
- **The mark elsewhere**: the run card's header (the 480 px cut-out, ULTRA and TOP SPEED drawn beside and under it),
  the HUD's route chip and your row's "OC" tag in the race standings (the 240 px cut-out). There is no phone overlay
  or radial menu yet (U3, U6), so neither has the mark.
- **The name**: page title and noscript "OC Ultra: Top Speed" (`index.html`, `scripts/single-file.mjs`); run card
  hashtag `#OCUltra`, share title "OC Ultra: Top Speed", file `oc-ultra-<mode>-<score>.png`; feedback report's first
  line "OC Ultra <version> · feedback report"; the feedback share title. Docs and the folder name keep their names.
- **Theme** (`src/ui/styles.css`): tokens `--sunset` `--sunset-text` `--ember` `--amber` `--night` (black ink) and
  `--sunset-edge` replace the yellow and magenta; sunset for the thing to press and focus, amber for selection, ember
  for danger; a sunset hairline on every panel top; Drive lit with the sunset edge; a palm-and-skyline watermark at
  7 % on the loading and pause screens, drawn as SVG and cut to the letterform with `oc-mask.png` as a CSS mask.
  Contrast measured (WCAG 2.x, on the base `#0b0812`): sunset 8.75:1, sunset-text 9.79:1 (4.96:1 on a HUD plate over a
  white sky), amber 11.77:1, ember 4.56:1 (fills and lines only), black on Drive's edge gradient 6.93:1 where the label
  sits.
- **Size**: the single-file page grew from 3,427,120 to 3,620,249 bytes (+193,129, 188.6 KiB; the four images inline
  as 184 KiB of base64), under the 200 KB budget.
- **Checked**: `npx tsc --noEmit` clean; `npm test -- --only=phone,launch,boot` 16/16, with two new checks in `launch`
  (the report's first line names OC Ultra; the run card downloads as `oc-ultra-free-<score>.png`). Screenshots at
  390 × 844 and 1440 × 900 by `tests/out/identity-shots.mjs`: `tests/out/ui-after/identity-{menu,loading,hud,hud-free,
  pause,results,runcard}-{phone,desktop}.png`. The loading screen is raised with the game's own loading hook for the
  capture, because boot is too quick here to catch reliably.

## 2026-10-16: the reference pass, R2 to R4, checked together and integrated

Three more deltas from `PROJECT_OC_VISUAL_TARGET.md` were reviewed and kept, and are committed together on
`claude/ref-pass`: R2 (overcast light, below), R3 (the race HUD) and R4 (palms with real fronds), whose own entries
follow this one. The rows of the visual target are now marked: R1 to R4 Done (R3 has no lap counter, because no course
has laps, and the map corner shows no rival dots), R5 to R7 Not yet.

**R2, overcast light** (`src/game/env/Environment.ts`, and the output pass in `src/game/Game.ts`). Under cloud the sky
now does the lighting, by day only (night keeps its moonlight). How overcast it is follows how much of the sun the
weather hides: none in clear weather, which renders exactly as before, about three quarters under cloudy, all of it in
rain.

- The direct sun falls away much faster than before and turns a neutral, slightly cool white. Under cloudy it keeps
  about 7% of its clear strength, enough for a faint shadow under the cars instead of hard shadows.
- The sky light (the hemisphere light) rises and turns nearly neutral and a little cool, with a grey ground bounce.
- The environment map that lights the paint and the cabin brightens under cloud, so the dark plastics don't go black.
  The visible sky goes a little greyer.
- The cloud deck's undersides darken (cloudy's `cloudDark` 0.35 to 0.5) and the dome flattens, so the deck comes down
  toward the horizon.
- Exposure opens up by as much as 20% (1.016 under cloudy by day, up from 0.92), so the sky reads bright and the road
  mid-grey while the cockpit stays the darker part of the frame.
- On High and Ultra, the output pass desaturates the frame by up to 15% under cloud (0.89 saturation under cloudy).
  This is folded into the existing output shader, so it adds no extra pass. Low and Medium have no output pass, so
  they get the light without this grade.

**Verified** (960 × 540, High, Free Drive, 30 s at 30 m/s, overlay hidden; `tests/out/fix-r2-shot.mjs`). I-405 North,
day, cloudy: `tests/out/fix-R2-cloudy-{cockpit,chase,hood}.png` against
`tests/out/fix-R2-before-cloudy-{cockpit,chase,hood}.png`. The light state read back
(`tests/out/fix-R2-before-day-cloudy.log` against `fix-R2-after-day-cloudy-v2.log`): sun intensity 1.302 to 0.23,
hemisphere 0.598 to 0.917 (sky colour #dfeaf7 to #ecedf7), exposure 0.92 to 1.016. In the chase frame the car's shadow
on the road is much fainter and the grade is greyer. Sunset, cloudy, at the old 3 degree sunset preset:
`tests/out/fix-R2-sunset-cloudy-{cockpit,chase,hood}.png` against `fix-R2-before-sunset-cloudy-*.png`. The road and
the walls read clearly lighter than the near-black of before (sun 0.291, hemisphere 0.685, exposure 1.094;
`fix-R2-after-sunset-cloudy.log`). Clear weather renders as before, since with no cloud every new term drops out:
`tests/out/fix-R2-clear-cockpit.png` (sun 3.1, hemisphere 0.55, exposure 0.92; `fix-R2-after-day-clear.log`). The cost
is the same draw calls (cockpit 761, chase 615, hood 539 before and after). No suite check was added for R2. The
render group still renders rain, fog and mist by day (the weathers R2 changes most) with no page errors.

**R3, the race HUD.** The position box with the race timer, the standings with estimated gaps that fall in position
order, the rev lights, and Free Drive's road-name plate back where it was on the phone. See the R3 entry below:
`tests/out/fix-R3-r2-phone.png`, `fix-R3-r2-desktop.png`, `fix-R3-r2-phone-free.png`, `fix-R3-r2-suite.log`.

**R4, the palms.** Frond-card crowns cut out by alpha: 382 triangles on High and Ultra and 222 on Low and Medium,
against 448 before. Frond-shaped shadows and ringed, leaning trunks. See the R4 entry below:
`tests/out/fix-R4-compare-2x.png`, `tests/out/preview/fix-R4-palm-crown-high.png`, `fix-R4-suite-render.log`.

**The whole suite on the three together** (`npx tsc --noEmit` clean, `npm run build`, then `npm test` in the `tsu-ref`
worktree; `tests/out/integrate-ref-suite.log`): **58/58 passed**, exit 0, in about 13 minutes of group time. The lines
that touch this pass: "race standings: gaps fall in position order, the timer sits in the race box: 78 rows ahead and
72 behind over 50 s, all in order"; "palms: alpha-tested frond crowns within the old triangle budget: 109 palms in 11
crown meshes, 222 triangles a crown at Low"; "high: … palm crowns 382 triangles; ultra: … 382; low: … 222"; renders
day rain, fog and mist; no page errors in any group.

Not checked: a real phone or GPU, the Medium tier's frames, and R2's look at night or in rain, fog or mist (the suite
renders those weathers, but no one has compared their frames before and after).

**Merged into `claude/always-on`**, on top of the lens flare (g2) and the headlight beam pool. Both sides were kept
where they met. In `Environment.ts`, the new star shader goes with R2's overcast exposure. In `cockpit.ts`, the
interface returns both the live `mirrors` (R1) and the rear-view face, `rearView`, that the flare's occlusion test
uses. That face now follows the live mirror over the driver's side. `Game.ts` and `textures.ts` merged on their own:
the saturation uniform is set before the composer renders and the flare draws after it, so the flare is not
desaturated, and the frond and bark textures sit beside `beamPool()`. On the merge: `npx tsc --noEmit` clean, `npm run
build`, `npm test -- --only=boot,render,race,phone` **30/30 passed** (`tests/out/merge-ref-suite.log`; it includes
"renders sunset, clear … daylight 0.92" on the new 5.5 degree sunset, the race standings check and both palm checks).
One frame pair of R2's light on the new sunset (CA-91 West, cloudy, High;
`tests/out/merge-R2-sunset-cloudy-{cockpit,chase}.png`, `merge-R2-sunset-cloudy.log`) shows daylight 0.91, sun 0.299,
hemisphere 0.846 and exposure 1.04. The road reads mid-grey, the live mirrors show the road behind, and there are no
page errors. The sun is out of frame there, so the flare under cloud was not seen; by the code it is about a fifth of
its clear strength under cloudy.

## 2026-10-16: palms with real fronds (reference pass, R4)

The palms were a dense green ball of 18 plain arcs and a skirt of 10 more (448 triangles at every tier). Now:

- **Crown** (`palmCrown(detail)` in `road/props.ts`). Each frond is one 1.5 m card folded along its midrib into a
  V, bent along a rachis that lifts at the base and droops toward the tip: young fronds higher and upright, old ones
  lower and hanging, the vertex colour darker toward the crown's heart. A few straw-brown dead fronds hang under the
  crown, and a 7-sided collar of leaf bases joins it to the trunk. High and Ultra: 12 live + 5 dead fronds, 6
  segments a frond, **382 triangles**. Low and Medium (`props < 1`): 10 + 4, 4 segments, **222 triangles**. Still one
  InstancedMesh per part per tile.
- **Frond texture** (`frond()` in `textures.ts`). One 512 × 512 texture with a live pinnate frond (bare petiole, pale
  midrib, lance-shaped leaflets leaving it at about 45 degrees and drooping at their ends, gaps between them) and a
  dead one, alpha-tested at 0.4, double-sided. It is now uploaded as ImageData instead of a canvas: a canvas keeps
  premultiplied colour, so every transparent texel had turned black (read back rgba 0,0,0,0 outside the frond; now
  91,122,57,0) and the mip-maps darkened the fronds' edges. A low alpha floor across the blade keeps far fronds solid:
  box-filtered like the GPU's mip-maps, the share of texels passing the alpha test is 1.09 of mip 0's at mip 1, 1.24
  at mip 2 and 1.6 at mips 3 to 5, so far fronds fill in rather than dissolve.
- **Trunk.** The bark has a ring groove every 32 pixels (80 rings a trunk) over a lattice of leaf-base scars. Trunks
  lean up to 3.4 degrees in a random direction; the crown sits on the leaning top with a random yaw and a 1 to 1.25
  scale. These come from a second random stream, so every house, tree and palm is where it was.
- **Shadows.** three.js's shadow pass copies `map` and `alphaTest` into its depth material when a material has both,
  so the crowns cast frond-shaped shadows with no custom depth material (Medium, High and Ultra; Low has no shadows).

**Verified** (960 × 540, I-405 North, day, clear, Free Drive, 30 s at 30 m/s, overlay hidden;
`tests/out/fix-R4-shot.mjs`): `tests/out/fix-R4-high-chase.png`, `fix-R4-high-hood.png`, `fix-R4-low-chase.png`,
`fix-R4-low-hood.png`. The before frames, `tests/out/fix-R4-before-{high,low}-{chase,hood}.png`, were rendered by
the first R4 attempt from this worktree's own build before any palm edit (its log lists the old crown: alphaTest
0.45, 448 triangles); the main checkout's build was not used because it is a different branch. The same palm before
and after, 2×: `tests/out/fix-R4-compare-2x.png` (a dense blob before; separate arching fronds, the dead ones and the
lean after). Close-ups from the realism preview (`src/preview/test-palm.ts`, the game's own palms at 13 m):
`tests/out/preview/fix-R4-palm-crown-high.png` (and `-2x`), `fix-R4-palm-crown-low.png`, `fix-R4-palm-whole-high.png`,
and `fix-R4-palm-shadow-high.png` (the crown's shadow on the ground, leaflets visible in it).

| Frame (calls / triangles a frame) | Before | After |
| --- | --- | --- |
| High, chase | 615 / 1,508,910 | 615 / 1,503,364 |
| High, hood | 539 / 1,404,037 | 539 / 1,398,491 |
| Low, chase | 408 / 457,335 | 408 / 449,653 |
| Low, hood | 332 / 392,832 | 332 / 385,150 |

The crowns' own share, the same frame with them shown and hidden (`tests/out/fix-R4-calls.mjs`, hood): Low 4 calls and
8,658 triangles (4 crown meshes in view), High 7 calls and 58,446 triangles (main and shadow passes). Two consecutive
measurements of the paused frame, crowns unchanged, read 374 then 332 calls on Low and 584 then 539 on High (an extra pass on
some frames), so single-run call counts can differ by about that much.

New checks in the render group: "palms: alpha-tested frond crowns within the old triangle budget" (the crown meshes
alpha-tested, double-sided and casting shadows, at most 448 triangles, the frond blade between 15% and 85% gaps, a
transparent texel keeping its colour), and the High/Ultra rebuild check now reads the crown's triangles at each tier
(at most 448, Low fewer than High). `npm test -- --only=render` **13 of 13** (`tests/out/fix-R4-suite-render.log`):
"109 palms in 11 crown meshes, 222 triangles a crown at Low, castShadow set; blade 41.62% gaps; transparent texel rgba
91,122,57,0" (castShadow is set on every tier; Low's renderer draws no shadows) and "high: … palm crowns 382
triangles; ultra: … 382; low: … 222", no page errors.

Not checked: a real phone or GPU, the Medium tier's frames, palms at sunset or night.

## 2026-10-16: the race HUD (reference pass, R3), second round after the judge

The race HUD replaces the three race numbers in the stats box with a position box (the big position, "of 4", the
distance to go, and now the race timer beside the position, labelled Time), the live standings (position, the
rival's OC city tag, name, the gap to you in seconds, your row in volt; a phone shows the three rows around you)
with the note "Gaps in s · estimated", and eight rev lights over the gear. The judge sent the first cut back for
three things, all fixed:

- **Free Drive had moved on the phone.** The road-name plate had been pushed to +292 px for every mode. In the
  `(pointer: coarse)` block it is back at +244 px; only while the race box is shown
  (`.hud:has(.hud-race:not([hidden]))`) does it go under the box, to +292 px. The opt-in frame-rate chip moves under
  the race box in a race too (+282 px; at +218 px it sat on the standings).
- **The timer sat stacked under the road name, over the horizon.** It now lives in the race box, top right
  (`.hud-pos > .hud-timer`); nothing of the race HUD is on the road plate.
- **The gap column could disagree with the order.** `standings()` estimated a car behind you with its own speed,
  so a slow car further back could show a smaller gap than a fast one just behind (the first cut's desktop frame
  read P2 −9.0, P3 −13.7, P4 −11.3). Every gap is now the distance along the course at your speed (`vMe`), so the
  gaps fall with the positions; finishers are still ranked first, ahead of every unfinished car.

**Verified:** `tests/out/fix-R3-r2-phone.png` (390 × 844, Irvine Sprint, 40 s in: race box 156–287 px, timer
0:40.6 in it, gaps −6.1 / −8.4, plate at 302 px) and `tests/out/fix-R3-r2-desktop.png` (1440 × 900: timer 0:40.9 in
the box, gaps −6.5 / −6.9 / −12.6, plate alone at the top); `tests/out/fix-R3-r2-phone-free.png` (Free Drive on the
phone: plate at 254 px = 10 + 244, under the Distance/Top box at 156–210 px); `tests/out/fix-R3-r2-phone-race-fps.png`
(frame-rate chip at 292 px, under the box, left of the plate). New check in the race group: 50 s of the Irvine
Sprint (20 s slow, 30 s fast) sampled every second, 78 rows ahead and 72 behind, gaps never out of order; the HUD
timer in `.hud-race`, none on the plate, the HUD gap column in order. `npm test -- --only=race,phone` **11 of 11**,
no page errors. Not checked on a real phone.

## 2026-10-16: the sun's lens flare draws at High, and the sunset preset is a sunset again (finding g2)

**The flare.** three's `Lensflare` reads the framebuffer back for its occlusion test, which fails on the multisampled
target High and Ultra render into: it never drew there and left a solid 16-px black square at the sun's screen
position (`tests/out/audit-sunset-ahead-{hood,cockpit,chase}.png`, `audit-crops/ahead-hood-sun.png`). It is gone.
`Environment` now draws the flare itself: `updateFlare()` projects `sunDir` through the camera's own orientation
each frame and places five additive planes (the glow at 26 % of the screen's height, four ghost rings at
sun·(1−2d)) in a small screen-space scene with an orthographic camera, sized in shares of the screen's height so
they stay round in portrait, and `renderFlare()` draws that scene over the finished frame after the composer, so
bloom and AO never see it and Low (no composer) gets the same picture. Occlusion is a raycast toward the sun every
third frame (400 m, through the roads, the traffic and the terrain's instanced props; see-through, hidden and
skinned meshes ignored; 0.2–2 ms per cast here), the mountain ring's crest height at the sun's azimuth
(`ridgeAltitude`, soft over the sun's half-degree disc), and for the player's car `PlayerCar.sunBlocked`: the
cabin as a box with the kit's windscreen, side windows, rear screen and the Vela's glass roof as openings and the
rear-view mirror (now `Cockpit.rearView`) as a blocker, since raycasting the real body cost 15–19 ms. The result
blends over 0.3 s. The ring writes depth now, so stars and clouds no longer show through its ridges. Glow texture
given a hot core and long halo, ghost rims softened (`textures.ts`).

**The sunset preset.** The first version of this fix lifted the sunset sun from 3° to 8° because the ring's crest
is 6.9° at its azimuth (258°), so a 3° sun had never shown; the judge rejected that: at 8° `daylight`
(`smoothstep(−0.1, 0.14, alt)`) is exactly 1, the suite's `renders sunset, clear` check (`e.day < 1`) fails by
construction, and the preset read as full afternoon (sunlight 3.1, hemisphere light and sky gain the same as day).
Retuned without touching the ring or the formula: the crest profile, computed from the ring's own `fbm2` (3.0° at
az 164° to 12.3° at az 110°), is lowest in the western half at az 292–293° (5.0–5.1°, a late-June sunset
direction over OC), so the preset is now **5.5° at az 292°**: the whole disc clears the crest by 0.14° (the
flare's ridge factor is exactly 1), daylight 0.91 (0.92 after the suite's 15 s ease from day), sunlight 2.86,
golden 0.79, so the preset is dimmer and warmer than day again. I-405 North, the suite's own start, faces it 11°
left of the nose at the start and 12° right after 30 s. Not touched, worth its own finding: the sunrise preset
(4° at az 100°) sits behind a 9.6° crest, so it never shows its sun either.

**Verified** (headless Chromium, SwiftShader, 960 × 540, I-405 North after 30 s of autopilot; all with zero page
errors):
- `npm test -- --only=render` **12 of 12** (`tests/out/fix-g2-r2-render.log`): sunset daylight 0.92, day 1,
  night 0; the suite's own `tests/out/sky-sunset-clear.png` (Low, 640 × 360, cockpit) shows the sun just over the
  ridge through the windscreen with the glow and ghost train.
- High, cockpit/chase/hood (`tests/out/fix-g2-r2-sunset-high-{cockpit,chase,hood}.png`,
  `fix-g2-r2-sunset-high.log`): flare visible in all three (strength 0.77, ridge 1, nothing hit, raycast
  0.3–1.9 ms), the sun in a dip of the ridge line, long lamp-post and palm shadows down the road, no square;
  563–638 draw calls and 1.45–1.56 M triangles a frame.
- Low, hood/chase (`fix-g2-r2-sunset-low-{hood,chase}.png`, `fix-g2-r2-sunset-low.log`): the same placement
  (sun at pixel 580,206 in the hood view on both presets), 342–418 calls, 0.40–0.46 M triangles.
- High, portrait 390 × 844, hood/cockpit (`fix-g2-r2-sunset-portrait-high-{hood,cockpit}.png`,
  `fix-g2-r2-portrait-high.log`): the glow and ghosts stay round, the sun over the ridge right of the nose. With
  the sun turned to the car's heading (az 279°, crest 8.3°) the ridge hides it, honestly: no flare and no square
  (`fix-g2-r2-sunset-ahead-portrait-high-hood.png`, ridge factor 0). Pre-existing and not part of this finding:
  the cloud layer stretches into vertical streaks in portrait.
- Ultra, hood, 640 × 360 (`fix-g2-r2-sunset-ultra-hood.png`, `fix-g2-r2-sunset-ultra.log`): the flare draws over
  the bloomed frame, no square; 1,278 calls, 3.74 M triangles a frame.
- `npx tsc --noEmit` clean for both `tsconfig.json` and `tsconfig.game.json`.
- Before/after: `tests/out/audit-sunset-ahead-hood.png` (black square, stars by day) vs
  `tests/out/fix-g2-r2-sunset-high-hood.png`; the first fix's bright-afternoon frames are `fix-g2-sunset-high-*.png`.

## 2026-10-15: live rear-view and door mirrors on High and Ultra (reference pass, R1)

The first delta against the owner's reference image (`PROJECT_OC_VISUAL_TARGET.md`): the rear-view mirror used to
show the sky's environment map (a dark band from the seat). `Game.configureCar` now passes `mirrors: 'live'` to
`PlayerCar` on High and Ultra when the device has a fine pointer (phones and Low/Medium keep `'env'`), and
`buildCockpit` returns its `CarMirror`s so the car can switch them off outside the seat and dispose them on a
rebuild. Three things were needed to make the glass show the road and the traffic behind:

- **Our cars are mid-engined.** From the mirror's eye the bulkhead window frames the car's own wing, tail lamps and
  engine-cover louvres, with the car behind squeezed into a slot (`tests/out/dbg-mirror2-eye-aim.png`). The
  rear-view therefore renders the world without the player's car (`CarMirror.hide`: body, cabin, hands, wheels,
  hidden for that nested render only), as a rear camera would, and is aimed straight back 2.5 degrees below level.
  The door mirror keeps the flank.
- **The glass was off screen.** Hung just left of centre it sat 45 degrees right of the eye and only its left 38 %
  was in a 16:9 frame at the cockpit's 58-degree view. It now hangs over the driver's side (x about -0.22), fully in
  frame at 16:9 and 16:10.
- **Cost.** Each mirror renders every other frame (the two alternate) into a 512x128 / 256x112 target with a 400 m
  far plane: the far road chunks were most of the draw calls (471 -> 172 for the rear-view), the sky dome still
  draws (it sits at the far plane whatever it is), the backdrop hills and clouds beyond 400 m do not. Measured in
  SwiftShader at 960x540, High, I-405 North, day, moderate traffic, over 4 frames with `info.autoReset` off: 645
  calls / 2.13 M triangles a frame with `'env'`, 823 / 3.05 M with the live mirrors (the rear-view's own render 172
  calls / 0.92 M, the door mirror's 181 / 0.93 M; the player's car is 240 k triangles).

The judge rejected the first cut for one reason: the mount had moved for every tier, so on a phone (portrait, 96°
view) the environment-map mirror became a dark slab over 43 % of the screen width in front of the road
(`tests/out/review-R1-phone-cockpit.png`). Fixed by hand: with `'env'` the glass keeps its old place just left of
centre and its old aim through the bulkhead window; only the live mirror moves over the driver's side.
`tests/out/fix-R1-phone-cockpit.png` (390 × 844, Low) shows the road clear again, with no mirror targets built
(`car.interior.mirrors.length === 0`). Suite: `npm test -- --only=render` **12 of 12** on the agent's cut (the
High/Ultra/Low preset check now also asserts live/live/env mirrors); the hand fix typechecks and only changes the
`'env'` branch.

**Verified:** `tests/out/fix-R1-cockpit.png` (the driver's seat with a sedan placed 20.9 m behind in the same lane:
it fills the middle of the rear-view, with the median, the lane line, a second car in the right lane and the sound
wall; 2x crops `fix-R1-cockpit-{rearview,door}.png`; `fix-R1-before-cockpit*.png` is the `'env'` state). `npm test
-- --only=render` **12 of 12** (the High/Ultra/Low preset switch now also checks the mirror mode: live, live, env),
`npx tsc --noEmit` clean. Not measured on a real GPU.

## 2026-10-15: first realism pass by agents: headlight beams, the NPC nose, the jaw and neck

The first orchestrated render pass (two art-director audits, then one fix agent per shortfall and a sceptical judge
per fix) kept three fixes before the account's session limit stopped it. Each was judged on before/after renders.

**Headlight beams (game, finding g1).** The two spotlights painted blown-out, heart-shaped blobs on the road right
under the bumper, and came on at sunset. Now the spots are a narrow soft cone aimed just above level, so they reach
traffic and walls but not the road under the nose, and the low beam on the road is a painted pool: a 12 × 38 m
additive strip of fourteen rows re-laid on the road's height each frame (it follows crests and sags), with two
pools merging into one widening wedge and a soft cut-off at 30–36 m lifted on the right like a US low beam
(`textures.ts` `beamPool()`, `PlayerCar.ts`, `Game.ts` `weatherTick`: the lamps now fade in with gloom instead of
switching at a threshold). Before/after: `tests/out/audit-night-hood.png` vs `tests/out/fix-g1-night-hood.png`,
and the cockpit, chase and sunset frames beside them. The judge kept it and listed what remains: a faint two-lobe
seam at 4–6 m in the hood view, the narrower cone no longer lights adjacent-lane cars inside 15 m or a nearby wall
(not yet looked at in a night shot with a wall), the pool ignores camber on banked ramps, it is not fogged, and a lit
traffic car at 28 m reads as a blown-white rear: pre-existing, worth its own finding.

**The NPC nose (people, p1).** The bridge was a pinched blade with hard sidewall creases and a separate bulbous tip.
`src/onfoot/people/head.ts`: a wider radix starting at the eye line, softer dorsum and sidewall blends, the tip a
lobule that continues the dorsum, fuller maxilla beside the nose. Judged at 0.62 m and 0.33 m on the reference,
casual and elder presets at three yaws (`tests/out/preview/fix-p1-*.png`): the crease and the ridge highlight are
gone, the bridge reads about twice as wide, nothing else moved. Cost flat (build-time SDF).

**Jaw to neck (people, p2).** One convex curve from chin to throat, masseter lumps, a ball under the chin, the
trapezius rising to the ears. `head.ts` and `body.ts`: a concave cervicomental angle, the mandible's lower border as
an edge over the neck, a visible sternocleidomastoid band, the neck a column, the elder's wattle a distinct pouch.
Judged on profile, front, talk, lineup and collar renders (`tests/out/preview/fix-p2-*.png`). Noted, not blocking:
a soft dark patch under the lean female's ear in profile, and her collarbones now at the gaunt limit.

**Not reached:** the lens flare's black square at High (g2), stars by day (g3), waxy skin (p3) and the rest of both
audits' lists (night lighting, Monopoly houses, blank mirrors, paper mountains, flat daylight; teeth, hair, mouth
corners, brows, expressions). They run in the next pass. The audit also judged my lens flare (added earlier today):
it never draws at High and leaves a solid black square at the sun; the sunset preset's 3° sun also sits below the
procedural ridge line, so the flare would rarely show even when fixed.

**Verified:** the judges' renders above, `npx tsc --noEmit` clean, and the full suite on this build: `npm test`
**53 of 56** (`tests/out/full-1015c.log`) with the three misses all 30 s Playwright timeouts on a screenshot or a
click in the launch group while another pass was rendering on the same four cores; the launch group alone then
**5 of 5** (`tests/out/launch-1015e.log`), so every check passed on this build. The suite's actions now get two
minutes instead of Playwright's 30 s (`tests/regression.mjs` `open()`), since software rendering shares the CPU
with other renders here; what a check asserts is unchanged.

## 2026-10-15: the ability hand poses are on the anatomical hands

The one thing the realism hands had lost against the old cockpit: the abilities' gestures. `DriverArms.setPose`
now takes a hand off the rim and back. A pose names where the wrist goes and which way the hand points and its back
faces; the hand bone's rotation is solved from the bind hand's measured axes (wrist to middle knuckle, the palm
normal), the arm's two-bone IK follows the wrist, and it blends over 0.3 s each way. Clear Path: the left hand comes
up at the window and waves (a slow roll about the forearm) for 1.6 s. Focus Time: the left wrist comes up in front
of the eyes, back of the hand to the driver, for 0.9 s. Locked In: the right hand rests on the console, palm down,
for the five seconds, the left hand steering alone. The fingers keep their grip curl in every pose; there's no
finger rig, so a wave reads as a raised loose fist.

**Verified:** the preview's hands page with `?pose=knee|watch|wave` (`tests/out/preview/pose-*.png`), then the game
itself: each ability fired through `useAbility()` with the matching driver and captured from the driver's seat
(`tests/out/pose-{wave,watch,knee}.png`: the Closer's wave with the gold watch, the Ace's gloved watch check, the
Wrench's hand down on the console while the left hand holds the wheel). `npm test -- --only=abilities` **4 of 4**
with the poses in; no page errors. Then the full suite on this build (semi, autopilot fix, poses): `npm test`
**56 of 56**, 20 minutes in this container (`tests/out/full-1015b.log`).

## 2026-10-15: the tractor-trailer semi, a cleaner windscreen, and a safer autopilot

**The semi.** The last block-built traffic vehicle is now built like the others, from `src/preview/traffic.ts`: a
conventional tractor (boxy loft, a 2.2 m hood narrower than the cab, glass only over the doors, chrome grille
surround and bumper, sun visor, roof fairing in the paint colour, twin stacks, fuel tanks between the axles, frame
rails and a fifth wheel over the tandem, west-coast mirrors) and a 45 ft box trailer with floor frame, side skirts,
red conspicuity tape, landing gear, door seam and lock rods, mud flaps and an underride guard, 20 m in all on five
axles. The game instances ten turning wheels from the spec's axle list, and keeps the semi in the two right lanes.
`tests/out/preview/traffic-semi.png` is the preview render; `tests/out/semi-chase.png` is the game, placed 22 m behind
one on the 405.

**Windscreen dust** at the driver's seat was reading as snow at the desktop tier: its opacity is halved (0.26 →
0.13). It is still there against the light.

**The autopilot** (attract mode and the suite's driver) used to judge a lane by where cars were, not where they were
going, and the longer semi changed the seeded Survival run enough that at 39 s it moved into lane 3 as a pickup 5 m
ahead was also moving into lane 3. It now counts a car that is signalling and moving into a lane as already in it,
for both the gap ahead and the clear check. Seeded Survival runs through again.

**Verified:** `npm test -- --only=survival` **7 of 7** (a new check: seven traffic classes from the preview, the semi
20 m × 2.5 m with ten wheels, 5 of 154 seeded cars are semis and every one spawned in the two right lanes; the seeded
run now scores 8,591 with a 16.82 s best streak, 21 clean passes, top 116 mph). `--only=survival,abilities` **10 of
10** on the first semi build before the tractor was reshaped. No page errors in any run.

## 2026-10-15: the Chrome noir menus are in the game

The owner asked for "something more modern with a futuristic HD cyberpunk feel" and chose direction B, "Chrome
noir", from the two the designers built in worktrees. The agent that was to apply it is stopped by the weekly limit, so
its patch (`scratchpad/ui-design-2.patch`: `index.html`, `scripts/single-file.mjs`, `src/ui/App.tsx`,
`src/ui/styles.css`) was applied three-way and the three conflicts resolved by hand: the day's "start at your exit"
picker and Feedback panel now live inside the new layout (the Start panel is a `panel wide`; the roads and exits grids
scroll with their panel). The look: a chromed ULTRA wordmark with a slow sheen, Big Shoulders Display for headings,
Chakra Petch for text, JetBrains Mono for numbers and labels, violet-black glass with a hairline edge, magenta
selection corners, a yellow Drive dock pinned to the bottom of the menu, hexagonal ability button, angled chips
for the touch pedals and the top bar. Every accessible name, role and class the suite relies on is kept.

Three layout faults from the unfinished direction were fixed: controls scrolled into view landed under the sticky
Drive dock and panel footers (now `scroll-padding-bottom` on the overlays, so Playwright's and the browser's
scroll-into-view keep them clear); the exit picker's inner scroll fought the panel's sticky footer (its
`max-height`s removed, the panel grows and the overlay scrolls); and the desktop side card (Loop Lab, the data credit)
was pinned to the animating menu column instead of the viewport (the slide-in now animates the column's parts).

**Verified:** `npm test -- --only=launch,phone,boot` **16 of 16** on this build (the phone layout checks, the exit
picker click-through, the Feedback and Share run buttons). All 13 screens captured at phone and desktop size in
`tests/out/ui-after/` (the capture tool now waits for entrance animations to finish: in software rendering the first
frames after load take seconds, so the animations started late and the first desktop captures were mid-fade).
Not reviewed yet: an art-director pass over every screen for polish; the agents' review and polish steps run when the
limit lifts.

## 2026-10-15: the realism preview's cars, cockpits and hands are in the game

The owner, after trying the test build: "This game looks like garbage, keep rendering for MAXIMUM RESULTS." The
background agents that were going to integrate the realism preview are stopped by the account's weekly limit until
Oct 18, so the integration was done by hand, ahead of the preview's remaining parts.

**What changed.** `src/game/vehicle/PlayerCar.ts` now builds the player's car from the preview modules
(`src/preview/car.ts`, `cockpit.ts`, `hands.ts`): the four garage cars as four distinct bodies (clearcoat metallic
paint with flake, shut lines, LED lamps, tail-lamp clusters, diffuser, exhausts, forged wheels with tyres and
drilled discs, a contact shadow), each with its own cockpit (GT black Alcantara and cognac Nappa, Brio navy leather
with aluminium, Corsa carbon buckets with harnesses and a roll hoop, Vela E ivory leather with a screen dash), a real
tachometer with a live needle, a windscreen with the dashboard's ghost reflection and dust, door and rear-view
mirrors, and the driver's anatomical hands gripping the rim at ten and two with the chosen look (skin tone, sleeves or
rolled, gloves, gold/steel/smart watch, ring, bangle, painted nails on the female presentation). The wheels spin and
the fronts steer (the preview built them rigid; the game puts each in its own groups, calipers on the hub). Graphics
Low and Medium use the preview's 'phone' quality tier, High and Ultra the 'high' tier. The paint, the car and the
driver's look rebuild only what changed. The previous cockpit (`Cockpit.ts`, `Instruments.ts`) is no longer used.

**Verified** (headless Chromium, SwiftShader, 960 × 540, Low, sunset, `tests/out/car-low-{cockpit,chase,hood}.png`
and `tests/out/dbg2-*.png`): build in software 428 ms car + 597 ms cockpit + 966 ms hands; no page errors; the
driver's seat shows the dash, tach, mirror, A-pillar and both hands with the Closer's gold watch; chase shows the GT
from behind with tail lamps, diffuser and wheels; hood shows the bonnet lip and the road once the half-second view
blend has finished (a shot taken mid-blend sits inside the windscreen). Frame cost at the seat: 355 draw calls,
490k triangles (the old car: 444 calls, 491k), 10–12 fps in this software renderer, the same as before the change.
**Suite:** `npm test -- --only=boot,survival,render,phone,launch` with the new car and traffic: **34 of 34** (the
render group's six skies, the lost-context recovery and the High/Ultra rebuild all pass with the preview car built
at both tiers; Survival's seeded numbers are unchanged: 16,244, 28.75 s, 25 passes). The test link
https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 carries this build.

**Traffic bodies** (same session). The preview's unbranded traffic vehicles (`src/preview/traffic.ts`, moved out of
`car.ts` and given a coupe) now feed the game's instanced traffic: sedan, coupe (the "sports" class), SUV, pickup, a
new van class, and the box truck are lofted bodies with a glass band and vertex-coloured trim (grille, bumpers,
mirrors, box, bed), on the game's own turning wheels and braking lamps, in the preview's clearcoat paint with the
per-car instance colour. Collision boxes and wheel positions come from the same specs, so what you see is what you
hit. The semi is still the block-built one. Verified (`tests/out/traffic-{cockpit,chase}.png`, Heavy, seeded, 154
cars): bodies, colours and lamps render through the instancing; 373 draw calls and 838k triangles from the seat in
Heavy traffic (the bodies are denser than the old profiles); no page errors.

**The road** (same session). The interstates and state routes (the 5, 405, 22, 55, 57, 91) are now Portland cement
concrete, as they are: light grey-beige slabs 4.57 m long with sealed, slightly skewed transverse joints, the
longitudinal joint at each lane edge, diamond-ground tining in the normal map, darker polished wheel paths, an oil
line and hairline cracks (`textures.ts` `pcc()`, one lane by one slab per tile, with its own roughness map; rain
darkens and glosses it like the asphalt). The toll roads (73, 133, 241, 261) and every ramp stay asphalt. Lane lines
are four raised Botts' dots per 3.66 m where there was a painted dash, with the reflective marker in the gap kept.
Sound walls are split-face masonry block in running bond, tan, 0.2 m courses (`blockWall()`), instead of tinted
concrete. Verified in daylight from the seat, chase and hood cameras (`tests/out/car-low-{cockpit,chase,hood}.png`,
Low, 960 × 540): the slabs, joints, dots and block courses read at every distance; no page errors; 371 draw calls
and 606k triangles from the seat in Moderate traffic. Suite: `--only=boot,render,survival` **24 of 24** on this
build (the rain and fog renders cover the wet concrete).

**Not done, candidly.** The ability hand animations (the Closer's watch check, the Ace's wave, the Wrench's hand on
the knee) do not yet exist on the new hands: `setPose` is a no-op until the hands get a rig. The cockpit's two side
screens are static pictures (the HUD carries speed and gear); the shift paddles do not flick. Phone performance is
still unmeasured; the Feedback report will say.

## 2026-10-15: launch features: start at your exit, and the run card

Built for the local launch plan (`PROJECT_OC_BUSINESS.md`): every OC resident has an exit, and a run should be
shareable without a server.

- **Start at your exit.** The Start panel now lists all 20 carriageways under the 12 quick starts; tapping one lists
  every real exit on it (from the guide signs in the map data: 416 across the network, 4 to 58 per carriageway) with
  its distance along the road and which side it leaves. Picking one starts you 450 m before its sign, in the second
  lane, and the toast names the exit. `Settings.exit` holds the key (`'<carriageway> @ <metres>'`); the quick starts
  clear it. Time Trial keeps its fixed start.
- **Run cards.** The results screen has "Share run": a 1080 × 1350 PNG drawn on the device (the road's shield, the big
  number, the reason, the stats, "#TopSpeedOC", "A game. Drive the real ones at the limit.", and the device-only and
  map-credit lines). It goes through the phone's share sheet where there is one, otherwise it downloads. Nothing is
  uploaded by the game.

**Verified** (headless Chromium, SwiftShader, `npm test -- --only=launch,boot,phone,survival`, then `--only=launch`
again after a test fix): 22 of 22 checks pass.
- Launch: CA-57 North lists 14 exits, the same number the data has; picking "Orangewood Avenue" (the Lot 57 exit) and
  tapping Drive started on CA-57 North 450 m before the sign. The run card downloaded as `top-speed-oc-free-703.png`,
  1080 × 1350, 955 KB (screenshots `tests/out/launch-exits.png`, `tests/out/launch-run-card.png`).
- Boot, Survival and Phone groups unchanged: 781,426 lane points clear, 11,333,756 barrier segments the same twice,
  Survival score 16,244 with a 28.75 s streak, the phone menu and HUD fit, Go to lists 20.
- One test fix: the first run of the card check timed out at 15 s because the results screen keeps rendering the
  scene behind it at 1–2 fps here, so the click and the drawing took about 19 s; the check now allows 90 s.

Not measured: a real phone's share sheet (headless Chromium has no `navigator.share`, so the download path is what
the suite exercises).

**Feedback report** (same day). Pause → Feedback, or Settings → Feedback, shows a report about the device and the
drive: the browser, screen and pointer, cores and memory, the GPU (`WEBGL_debug_renderer_info`), the graphics preset,
pixel ratio and drawing-buffer size, frame rate, draw calls, triangles and textures, the mode, road, speed, traffic
density and car count, the sky settings. Copy (clipboard, or select-and-copy where that is refused) and Share (where
`navigator.share` exists). The game sends nothing; the player pastes it to us. This is how the launch's ambassadors
report real-phone performance, which has never been measured.
- Verified (`npm test -- --only=launch`, 4 of 4): the report named the browser (HeadlessChrome), "GPU: ANGLE (Google,
  Vulkan 1.3.0 (SwiftShader Device (Subzero)...))", the Low preset, "11 fps · 444 draw calls · 491k triangles · 45
  textures" and the drive on CA-57 North; Copy and Back worked with no page errors (`tests/out/launch-feedback.png`).
  Those numbers describe this sandbox's software renderer, not any phone.

**Abilities tuned toward the owner's "about 5 seconds"** (same day): Clear Path 8 → 6 s (traffic needs a moment to
move over), Locked In 7 → 5 s, Focus Time stays 5 s; cooldowns unchanged. **Clear Path with No Traffic**: with the
density at None and no cars about, the ability says "No traffic to clear" and keeps its charge instead of burning a
45 s cooldown on nothing.
- Verified (`npm test -- --only=abilities,launch`, 9 of 9): Clear Path 153 → 106 cars with all 46 in view kept, scale
  0.65 then 1 after its 6 s, cooldown blocks a refire; Focus Time 0.7× then 1×; Locked In grip ×1.3 then ×1 after
  5 s; with density None and 0 cars, Clear Path did not fire and stayed ready. Phone group re-run after the Feedback
  button was added to the pause and settings screens: 5 of 5.

**Full suite after the day's changes: 55 of 55** (`npm test`, all nine groups, about 11 minutes here). The
interchange chains, races, progression and render checks match the 2026-10-12 numbers (405 N → 55 N in 215 s, the
Irvine Sprint won in 2:21.7, 178 XP for 60 s, the six skies rendered, context loss recovered).

**Test link.** This build is published separately at https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 so it can be
tried on a real phone (the main link https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV still holds the 2026-10-13
build: updating it needs the 3 MB live page read first, which this session could not do safely). Inside the
artifact viewer a plain download does nothing, so the run card there goes through the viewer's own save hook (see
the technical notes); on a phone the share sheet comes first either way.

## 2026-10-12: a committed regression suite, and the bugs it found

The test scripts behind the entries below (`final.js`, `modes.js`, `sim.js`, `dbg3.js`) were never committed. They're
replaced by `tests/regression.mjs`, run with `npm test`. It has 50 checks in eight groups, uses the same method
(headless Chromium, SwiftShader, `window.__game`), and takes about 10 minutes here. The technical notes explain it.

### Results

- **The build as committed (c0d7b34): 42 of 49 passed.** All 7 failures came from the bugs below. The same suite ran
  against both builds, with `GAME_HTML` pointing at the old one.
- **With all six fixes: 50 of 50 passed.** The numbers in this section are from that final run.
- **The 50th check came later.** It compares the barriers on a first and a second look (bug 5). It was checked against
  the fixed build with only that fix undone, where it failed: 18,040 segments over 3 m on the first look, 298 on the
  second.

| Group | Verified |
| --- | --- |
| Boot | Menu after 2.7–5.5 s across runs. 20 carriageways on 10 routes. 781,426 lane points with no barrier within 1 m of a lane's centre. 11.3 million barrier segments the same on a first and a second look. OSM/Overture credit shown. No Controls screen. |
| Interchanges | Moderate traffic, seeded. 405 N → 55 N in 215 s, 55 N → 91 E in 403 s, 91 E → 241 S in 269 s (sim time). Largest move in one simulated second: 50.4 m, so no teleports. No wrong-way time. The profile counted 4 freeways and 3 interchanges. Turned around at the end of the 5 South, the navigator planned again (4 hand-offs). After a road with no way through, it picked the destination up again (11 hand-offs). |
| Speed Survival | Heavy traffic, seeded. 45 s at 116 mph: score 16,244, best streak 28.8 s, 25 clean passes, 1 near miss. At 63 mph the streak is 0 and the best is kept. 8 passes counted for exactly 8 newly scored cars; a re-pass of a car that had already scored didn't count. Ramming a stopped car at 30 m/s ends the run: "Crashed into a sports car", with the board labelled "Local leaderboard · this device only". Two Time Trials: 154 cars identical at the start and after 8 s. |
| Races | The countdown holds you off the gas (0 m/s, moved 0 m, in gear 1) and flat on it (at most 0.1 m/s, 0.11 m). Rivals stay at 0 m/s. Flat out, the autopilot won the Irvine Sprint: P1 in 2:12.0–2:21.7 over three runs, +1,540 credits. (The build as committed won in 2:48.6 in both its runs; why it was slower wasn't traced.) Driving slowly ends "Too far behind" at P4. |
| Abilities | Clear Path: 154 → 125 cars, all 59 in view kept, traffic scale 0.65 then 1, no refire in the cooldown. Focus Time: world at 0.7× then 1×. Locked In: grip ×1.3 then ×1. |
| Progression | 60 s of driving: 178 XP, 64 credits, "Ton Up", saved as profile v1. Showroom: "29,900 more credits needed", "Opens at level 5", then the Brio bought with 11,000 credits left; computed top speed 211 → 201 mph. Ultra Realism: tunnel vision 0 at level 1; 0.42 at level 6 and 155 mph; 0 once switched off. Radio: Coast → Freeway FM → Canyon Radio → off, audio running. |
| Render | 640 × 360. Day, sunset, night, rain, fog and mist rendered. Rain: grip 0.8, wet 1. Fog: visibility 0.14. Night: daylight 0. Live time with a fixed clock: daylight 0 at 02:13 Pacific, 1 at 13:00. Pause holds the car; resume moves it. Reset: 40.0 → 0.7 m/s. Recovers from a lost WebGL context. High and Ultra rebuild mid-drive. |
| Phone | 390 × 844, touch. The menu and Profile fit with no sideways scroll. The top bar is clear of the gear readout. Touch controls are shown. Go to lists all 20 carriageways. |

No page errors in any group.

### Bugs found and fixed

1. **The countdown backed you off the grid.**
   - The countdown holds the car with `brake: 1`. In automatic, holding the brake at a standstill selects reverse
     (the arcade way to back up). So off the gas, the car backed 2.05 m off its grid slot at up to 1.7 m/s, in
     reverse, in Races and Time Trial.
   - The old check only tried it flat on the gas.
   - Fix: `CarPhysics.hold` keeps reverse out while the countdown holds the brakes. Now: 0 m/s, in gear 1.
2. **Barrier stubs in travel lanes at ramp starts.**
   - Barriers are worked out lazily, ±32 samples at a time. For ramps that start at another road, a line meant to
     clear the first three samples ran `w[k] = w[k] && 1`, which turned "not worked out yet" (−1) into a barrier.
   - So if a ramp was first looked at from further along it, it got a 4–6 m barrier stub inside the freeway's
     lanes. Whether a stub appeared depended on what you'd driven past before.
   - Fix: those samples are set to 0, as the comment intended.
3. **Barriers on ramps 2.5 to 3.5 m overhead.**
   - A ramp climbing past a freeway gets barriers once it's 2.5 m clear of it. The physics took barriers within
     3.5 m of the car's height, so it hit barriers over its roof.
   - One stood in the fast lane of the 55 North at 13.13 km, at the I-5 interchange. With seeded Moderate traffic,
     3 of 8 runs of 405 N → 55 N → 91 E ended up off the route. In one, the autopilot hit that barrier at 50 m/s
     and spun onto a ramp backwards.
   - Fix: the physics only takes barrier segments within 2 m of the car's height.
   - After all the fixes, 8 of 8 seeds reached the 91, in 377–396 s with 0–4 contacts.
4. **Crash cushions inside the 91.**
   - Two ramps (ids 443 and 282) stop inside the 91 East and West, near 65.3 km and 10.4 km. They have no road
     after them, so each got a wall and a crash cushion in lane 3.
   - Fix: a road that stops on another road gets no end wall (`Network.hasEndWall`). Rendering uses the same rule.
5. **Barrier segments tens of metres long on a first look.**
   - `wallsNear` read a segment's end from a shared buffer after checking its neighbours. If that check had to work
     out more of the road, it overwrote the buffer, and the segment's end jumped about 64 m along the barrier.
   - On a curve, that chord cuts across the road for one physics step. On a first pass over every road, 24,221 of
     4.6 million segments were longer than 3 m (up to 74.9 m), and 4 crossed within 1.5 m of a road's centre line.
   - Fix: the end is copied before the neighbours are checked. Now 937 are longer than 3 m (up to 24.4 m), the same
     on a first and a second pass, so those are the shape of the roads, not the cache.
6. **Navigation went quiet.**
   - If a reroute found no way (from a ramp you'd spun onto backwards, say), the route was left empty and never
     planned again. The prompt disappeared for the rest of the drive while Go to still showed a destination.
   - Being turned around at the end of a freeway never re-planned either.
   - Fix: `Game.followRoute()` keeps the destination and plans again at the next road and after a turnaround.

**The lane scan.** It finds any barrier within 1 m of a lane's centre line, on every lane of all 20 carriageways
every 4 m.
- Before the fixes: 121 spots. 17 were barriers 2.5–3.5 m overhead and 104 were at road level. The at-grade count
  depends on the order roads are first looked at.
- After: 0.

### Found, not fixed

- **The autopilot isn't a perfect driver in Heavy traffic.** It crashed in 2 of 12 seeded two-minute Survival runs,
  before and after the fixes:
  - It rear-ended a car during its own lane change.
  - A traffic car (not an aggressive one) changed lanes into it about 5 m ahead, closing at 20 m/s.

  The suite seeds Survival and Free Drive traffic so its runs repeat. The game itself still seeds them at random.
- **No planned way north from the far south.** Past about 42.6 km on the 405 South and 53 km on the 5 South, the
  planner has no way back north, because turnarounds and street exits aren't in its graph. The prompt is blank until
  you're turned around at the end, and then it comes back.
- **Switching graphics presets leaks a little.** Each round trip to Ultra leaves about 17–20 more textures alive
  (36 → 56 → 73). The frame rate on Low afterwards is unchanged (1.63 fps before, 1.50 and 1.63 after, at 320×180).
- **Frame rates here are low.** SwiftShader in this sandbox draws Low at about 1.6–2.3 fps, Medium at 0.3–0.7 fps,
  and High and Ultra at about 0.3 fps once warm. At 640 × 360, the first three frames after a switch took 108 s on
  High and 271 s on Ultra. Low runs no faster at 320×180 than at 640×360, so it's limited by geometry (about 400 draw calls and 440k
  triangles), not pixels. This is not a phone measurement.

## 2026-10-09 (later): P2–P4 systems

All of these were built, then checked in Playwright. Results are as printed by the test scripts.

### Profile (`profile.ts`)

Versioned v1 on the device: XP and levels, fictional credits, lifetime stats, freeways driven, nine achievements, and
a Profile screen.

Verified:
- XP and levels accrue from driving.
- "Ton Up" unlocks.
- The Profile screen renders at phone size.

### Weather and time (`env/Environment.ts`)

Verified:
- Six combinations rendered (day, sunset, night, rain, fog, mist) with no errors.
- Rain: grip 0.8, wet 1.
- Fog: visibility 0.14.
- Live mode at 02:13 Pacific gave daylight 0 (correct).

### Drivers and abilities (`drivers.ts`)

| Ability | Verified result |
| --- | --- |
| Clear Path | Removed 0 of 67 cars in view and 26 out of sight; scale 0.65 during, 1 after; the 45 s cooldown blocks a refire |
| Focus Time | Traffic moved at 0.70× |
| Locked In | Grip 1.00 → 1.30 → 1.00 |

Hand poses were checked in screenshots (the watch flex shows the gold watch).

### Races, cars, garage (`race.ts`, `cars.ts`)

Verified:
- The countdown holds you and all rivals at 0 m/s.
- Racing slowly ends "Too far behind" at P4.
- Flat out, the autopilot won the Irvine Sprint, and 1,500 credits and racesWon were added.
- Buying the Brio for 9,000 of 20,000 credits leaves 11,000, and the physics mass becomes 1,250 kg.
- The showroom refuses without enough credits ("29,900 more credits needed") and below the car's level ("Opens at
  level 8").

**Bug found and fixed.** Rivals crept forward at 1 m/s during the countdown.

### Ultra Realism and radio

Verified:
- Locked below level 5.
- At level 6 and 155 mph, tunnel vision reached 0.37, and it switches off on its own.
- The radio cycles Coast → Freeway FM → Canyon Radio → off, with the audio context running.

**Bugs found and fixed:**
- On phones the top bar covered the gear readout. Buttons now have their own row.
- Route shields on the profile were greyed out by a CSS selector.
- Coarse terrain tiles could cover a road in a cut at speed. They now stay below nearby roads.

### Full regression (`final.js`)

Verified:
- Loads in 16.9 s in software rendering.
- 405 N → 55 N in 274 s on the autopilot.
- Night and rain render.
- The High and Ultra presets rebuild mid-drive.
- Recovers from a lost WebGL context.
- Pause and resume work. Reset was checked separately with real frames: 39.9 → 0.5 m/s.
- Speed Survival scored 2,723 points, with a best streak of 27.6 s.
- The race finished P1.
- No page errors.

## 2026-10-09: the real freeway network

### Data

- **OpenStreetMap is blocked here.** The sandbox blocks openstreetmap.org, overpass-api.de and geofabrik.de (proxy
  403).
- **Overture Maps is reachable.** Its public S3 bucket is open, and Overture's transportation theme is derived from
  OSM under the ODbL. We range-read only the parquet row groups that cover OC: 27 row groups in one file.
- **What came out.**
  - 4,166 motorway and trunk segments, with route refs, connectors, levels and destinations.
  - 46,902 street segments, used for overpasses.
- **Elevation.** 324 AWS Terrain Tiles at zoom 13 (USGS 3DEP/NED in the US).
- **The builder** is `tools/oc-network/build.py`, whose README explains it. It produces:
  - 20 carriageways and 1,247 ramp pieces
  - 1,256 junctions and 506 grade-separated crossings
  - 247 street overpasses and 428 exit signs with OSM destination text
- **Builder checks.**
  - 502 of 506 crossings clear 6.5 m. The other 4 are listed in its output.
  - The largest height step at a junction is 0.29 m.
- **Reachability** (offline graph check): every freeway direction can reach every other, except SR-261 South. That
  one really ends at Walnut Ave; in the game it turns you around.

### Engine

- **Rewrite onto the data.** The procedural single road was replaced:
  - `world/Path.ts`: spline paths, one-way, finite.
  - `world/Network.ts`: grid, surfaces, barriers, routing.
  - `world/Roads.ts`: chunk streaming for every path, overlap culling, decks and columns, guide signs, overpasses.
  - `world/Terrain.ts`: real elevation tiles, road embankments and cuts, OC scenery, the sea.
- **Physics** now collides with real barrier segments, gore noses included.
- **Traffic** runs on every nearby carriageway, follows Y junctions, and collides in world space.
- **Phone-first UI.** The Controls screen is gone. The top bar has View, Go to and Pause. The corner window shows a
  map or a sky camera. There are five traffic levels, a start-freeway picker, and a local leaderboard.

### Verified: driving through real interchanges (the autopilot steers, the physics drives)

Each chain is one continuous drive with no teleporting. Route and path switches came from the game's own
`trackPath`. One of the chains had started on I-405 North by mistake: the test script never passed its starting
point through to the browser. That bug was fixed for later runs, and the chain is still a valid drive.

| Chain | Freeways | Result |
| --- | --- | --- |
| I-405 N → 55 N → 91 E → 241 S | 4 | All reached (I-5 S leg ran out of the 900 s test budget on the 241) |
| I-405 N → 55 N → I-5 N → 57 N | 4 | All reached: 405/55 connectors, 55→5 connector, the Orange Crush to the 57 |
| I-405 N → 55 S → 73 S → I-5 S | 4 | All reached: the 73 ends in the 5 at San Juan Capistrano |

Freeways driven so far: I-405, CA-55, CA-91, CA-241, I-5, CA-57 and CA-73.

Later the same day, after the steering change and the ramp-side fix:

| Chain | Result |
| --- | --- |
| I-405 N → 55 N → 91 E → 241 S | All reached again with the new steering |
| 91 W → 55 S → I-5 S | Reached. The 55 South starts from the 91 at a Y |
| I-5 S → 55 S → 405 N, then 55 N → 91 W → 57 S → **22 E** | All reached |
| 241 N → **133 S** → I-5 N → 55 N → 91 E → 241 S, then **133 N** | Both 133 directions reached. The 261 leg ran out of its 1,600 s budget; reaching 241 South from 241 North means a long loop |
| 241 S → **261 S** at the Y (`dbg3.js`) | Hand-off at s = 9,197 m, then 500 m on the 261 |

**All ten freeways have now been driven through real junctions:** I-5, I-405, 22, 55, 57, 73, 91, 133, 241, 261.

**Bug found and fixed.** The autopilot drove past the I-5 South → 133 connector. `sideOf()` judged the ramp's
side against the straight tangent at the split, and the 5 curves there. It now projects onto the curved road.

- **No page errors.** None of the game runs logged a page error. The only error in the logs came from that same test
  script.

### Verified: Speed Survival (`modes.js`)

- 45 s at the autopilot's 116 mph cruise in Heavy traffic: score 1,601, best streak 10.6 s, 8 clean passes,
  1 near miss.
- A car that has already scored can't score again.
- The streak drops to 0 under 100 mph, and the best streak is kept.
- Ramming a car at a closing speed of about 22 m/s ends the run, and the results screen shows.
- The results screen shows the "Local leaderboard · this device only" label. The automated check for this missed it
  first time: the CSS uppercases the label, and the check was case-sensitive. The label itself is there.

### Verified: physics fixes

- **Bug: traffic collisions pumped energy in.** The car you hit was slowed instead of pushed, so contact repeated
  every step. Seen: 275 mph backwards. Fixed the sign of the impulse.
- **Sim mode spinning at about 160 mph.** Three causes:
  - The tyre falloff had a step at 0.12 rad. It's now smooth.
  - The 2.6° steering floor at speed asked for about 13 g. Lock is now speed-sensitive, at about 0.6° at 200 mph.
  - Sim had no stability control at all. It now has a light race-mode one that only acts past about 5° of slide.

  Result, autopilot at handling 1 (`sim.js`):

  | Cruise | Worst slide | Spins |
  | --- | --- | --- |
  | 134 mph | 0.8° | none |
  | 168 mph | 3.6° | none |
  | Flat out (166 mph on the curves) | 14.5°, once | none |

  There was one 14.5° slide flat out. Race-mode stability control caught it.

### Verified: UI at phone size (390 × 844, touch)

- The menu, start picker, Go-to picker, driving HUD and sky camera all render. There's no horizontal scroll.
- Found and fixed: the top bar covered the gear readout, and the grey HUD labels were unreadable against a bright sky.

### Verified: hands

- The thumb used to cross the rim face like a stick. It now lies along the rim's inner side, and the back of the
  hand sits over the rim.

### Not done yet, honestly

- **Performance on a real phone is unmeasured.** In SwiftShader the Low preset drew about 400 to 800 calls and
  500k triangles. Tree canopies were the biggest share and now have a 4× lighter phone version, not yet re-measured.
- **Exits.** There are no exit numbers, and street ramps rejoin by moving you to an on-ramp, not by driving streets.

## Before this log

- **Top Speed OC v1/v2.** A single-file canvas game, committed and published earlier (commit 24ac829).
- **Ultra.** A 3D engine on a procedural freeway. It became the base for this work.
