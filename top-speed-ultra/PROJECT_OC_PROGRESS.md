# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-11-09: Stoppage Time S3b built: interactions, relationships and conversations (uncommitted)

S3b of `PROJECT_OC_SPORTS_BAR.md` is built on `claude/sports-bar` and not committed. Every number below was read from
runs on this machine (headless Chromium with SwiftShader, one Playwright page at a time; the machine's load was 5 to
23 with other workflows' browsers running). No phone was run.

- **What's new.** People advertise (the 11 interactions, the acceptance formula, the expected deltas, the candidate
  rule), the beats for guests and for you (your radial menu for a person with "More…" and the "i", Introduce and Buy a
  round among them; guests' own rounds), talking groups of 2 to 6 across parties, relationships and memory with the
  regulars' and your friendships kept on the device, people's cards and People here (pause menu), 141 lines, guests'
  games (invites; pool on the table's physics on screen and statistical off it), and the hooks `rel(id?)` and
  `interact(targetId, kind)`. Files: `src/onfoot/engine/sim/relations.ts`, `interactions.ts` (new), `groups.ts`,
  `lines.ts`, `autonomy.ts`, `tokens.ts` (changed); `src/onfoot/venues/sportsbar/social.ts`, `npcgames.ts` (new),
  `crowd.ts`, `life.ts`, `games.ts`, `hud.ts`, `main.ts` (one hook, `overheadAt`), `src/onfoot/sportsbar.html`; tests
  `tests/sportsbar-social.mjs` and `tests/sportsbar-s3b.mjs` (new). `lot57/`, `people/`, `src/onfoot/main.ts` and
  `src/onfoot/index.html` are unchanged. The as-built choices are under S3b in the plan.
- **`npx tsc --noEmit` passes;** the page builds with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`
  (`dist/sportsbar/sportsbar.html`, 1,750 kB, 585 kB gzipped).
- **Relationship maths, unit tests** (`node tests/sportsbar-social.mjs`, Node, against hand-worked numbers): 31 of 31.
  Rapport and friendship updates (+6 from 0: 6 and 2.1; then +9: 14.64 and 5.2059; then -6 with k 0.15), the bounds,
  rapport's fade (none in the first 5 quiet minutes, then 1.5 a minute to 0 and not past it), friendship's fade (0.5 a
  device day; one that reached 45 never under 20), the ring of 8, highlights (the first meeting and the biggest two),
  the level thresholds (0, 19, 20, 44, 45, 74, 75, -1, -29, -30) and Stranger, "Getting along" at 30, the 64-a-person
  cap, persistence through JSON (friendship, memory and highlights kept, rapport back to 0, walk-ins not kept); the
  acceptance formula (0.75 for strangers; 0.97 and 0.05 at the clamps), the memory term, the context terms, the plan's
  expected-delta examples (Talk at p 0.8: social 10; Joke at p 0.7: fun 4.2, social 5.6), a Challenge's game deltas,
  Introduce's start, a Talk advert scored by hand term by term (85.3464, the urgent +30 included), Joke's affinity by
  playful, Excited +15 and the goal's +30 on Cheer together, groups of at most 6, one speaker at a time, the 141 lines
  (S3a's 30 and 111 more; every interaction's kind; 10 remembering, 4 by your state; none offers a bet or says LIVE).
  S3a's `tests/sportsbar-crowd.mjs` and `tests/sportsbar-sim.mjs` still pass (the worked "Urgent needs" arithmetic and
  the blocklist).
- **Page checks** (`node tests/sportsbar-s3b.mjs`; Low 844 x 390 at Saturday 21:00, week 43, `seed(1)` unless named),
  all passed on the final runs (`tests/out/sportsbar/sportsbar-s3b-checks.json`; logs `tests/out/sportsbar/logs/s3b-*.log`):
  - **People advertise.** Over a 20 sim-minute fast-forward, 1,048 decisions: at most 8 people and 43 adverts in any
    (21 objects, 26 people's; the caps 8, 89, 41 and 48), 1,047 with people in them, 165 chose an interaction. The last
    300 decisions' 2,748 person adverts (challenge, talk, joke, team, goodbye, introduce, high-five): every expected
    delta and needs term equals the test's own working from the logged p and the plan's table. 26 accepted Talks and
    Joins (groups of 2, 3 and 4), every one leaving both in one group. Guests' own interactions in the run: 182, of 10
    kinds (challenge, round, joke, talk, goodbye, cheer, high-five, toast, introduce, team).
  - **Conversations** (rendered frames at `door`, `tv-east` and `overhead`, 36 frames): 144 group samples, never two
    speakers, nobody in two groups; listeners faced the speaker in 170 of 174 (98%), all bodies by the head (inside,
    everyone built is a mesh, so no card was a listener).
  - **Each interaction end to end through `interact()`** (forced accepted or not; rapport and friendship by the
    plan's updates, both people's needs by the table, the memory, the caption and the beat in the log): Talk accepted
    (0 to 6; you in their group; the reply chips: warm 6 to 7.92, a quip to a guest not playful 7.92 to 6.0256) and not
    (0 to -3); Joke (6.0256 to 14.6641), Cheer together within 8 s of a goal (to 19.1753), High-five after a goal for a
    team you share (to 26.1526), Toast holding drinks (0 to 7); Buy a round for a group of 3 (you and two): 80 to 68
    house tokens, a second within 10 minutes not offered, brought after 113 sim s, offered again after 10.7 sim
    minutes; Introduce (Peter and Alan start at 9.865 = 10 + 0.3 min(16.74, -0.45), +5 each with you); Ask about their
    team (+4; the card shows "Mesa Quail"); Console (0 to 8; "My team lost" -12 to -6); Challenge (pool on pool-1, your
    opponent Peter, not the house); Say goodbye (+2, you out of the group). Introduce ran with `force` (its second
    person farther than 8 m from you); Console's setup sets the guest's team as just lost (`npcTeamLost`), as a seen
    final whistle does.
  - **Cards and lists:** Peter's menu "Talk · Joke · Introduce… · Challenge · pool" and the "i"; People here sorted by
    friendship (Peter Friendly 21.9, Natalie 5.3, Ryan 2.8, Ray 2.4, Alan 1.3).
  - **Sparks and puffs** in the HUD layer: 3 shown over heads; the frame 108 calls and 168.0k triangles before and with
    them.
  - **Persistence across a reload:** Tina (r19), friendship 6.5573 before and 6.5569 after (saved to 3 decimals, 19 s
    of the per-day fade), 21 pairs loaded, rapport 18.25 to 0 (this visit's), 4 memories and 2 highlights kept, her team
    still known.
  - **Guests' games:** pool-1 with you 2.3 m away on the physics: 13 shots in 2 sim minutes, all on the physics, the
    largest energy rise in a shot 0. pool-2 off screen (you 18 m away, looking away): 6 statistical turns of 15.5 to 27.6
    s, 1 ball potted (groups stripes and solids, 7 and 6 left); walking up, the physics took over and the 14 object
    balls left were laid out (15 less 1), left 7 and 6 as before, the closest two 0.095 m apart (2r 0.056). Over 20 sim
    minutes: 8 invites (2 accepted, 6 dropped), 18 matches started (by Challenge and invites), 4 ended with their
    results.
  - **Budgets, S3a's run again** (21 poses: the five at 844 x 390 and `door` and `overhead` at 390 x 844, at Low, HD and
    Ultra in turn on one page, after a 30 sim-minute fast-forward; the caps 36, 70 and 100 reached; every item model at
    its cap; 1 to 9 groups talking and 5 or 6 guests' matches at every pose), all inside their rows:
    - Low (pass / frame, calls and triangles): `door` 108/171.8k and 107/167.5k; `tv-east` 115/172.3k; `stall`
      119/209.5k; `patio` 85/134.3k; `overhead` 111/165.9k; portrait `door` 105/169.4k, `overhead` 110/163.7k (rows
      118/203.9k inside, 139/244.3k outside, 118/197.9k overhead; frame 150/250k).
    - HD: `door` 147/363.9k, frame 200/481.4k, sun 41/134.7k; `tv-east` 154/361.0k, 206/483.4k; `stall` 135/338.6k,
      221/605.9k, sun 74/284.7k; `patio` 109/224.1k, 190/489.2k; `overhead` 194/497.8k, 278/759.9k, sun 72/279.5k;
      portrait `door` 140/353.4k, `overhead` 192/499.2k, 276/764.3k.
    - Ultra: `door` 192/701.1k, frame 586/1,907.9k, sun 91/438.2k, pool spots 58/49.2k and 57/47.9k; `tv-east`
      247/960.2k, 666/2,303.4k; `stall` 185/856.8k, 454/2,296.4k, sun 92/616.0k (pool spots frozen, 684); `patio`
      163/724.2k, 410/2,015.4k; `overhead` 247/989.9k, 690/2,629.2k, sun 94/620.9k, pool spots 53/12.3k and 54/47.9k;
      portrait `door` 185/690.3k, `overhead` 248/990.0k, 706/2,664.1k, sun 97/620.9k.
    - No NPC at LOD 0 and no casting mesh other than a `lod1` at any pose. A batch of up to 6 decisions took 0.52 to 0.53
      ms on average (S3a's repair: 0.41 ms; the people's adverts are the difference; the desktop target 0.4 ms); the
      crowd's step 0.2 to 1.4 ms.
- **Seen in the runs (recorded, not marks):** guests take to the games: on a Saturday 21:00 room every game spot was in
  use within 3 sim minutes of loading, and 5 or 6 matches were on at every budget pose (at Low 10 to 12 of 31 guests).
  The Challenge advert's expected deltas carry its game's (fun 40 x p for pool), so it outbids most adverts for the
  competitive.
- **Screenshots** (HD, 1280 x 720, looked at): `tests/out/sportsbar/s3b-conversation-radial-1280x720.png` (you in a
  group of three at the standing floor, the menu on Ramon: Talk, Joke, Buy a round · 16 tokens, Challenge · darts, Say
  goodbye and the "i"; Marisol's line and your two reply chips), `s3b-card-1280x720.png` (Marisol: Acquaintance,
  Regular, mood Fine and social, the friendship bar, "You got talking with Marisol"), `s3b-round-1280x720.png` (the
  toast "Round for 4 · 16 house tokens (no cash value) · on its way" and Marisol's thanks), `s3b-toast-1280x720.png`
  ("To a late winner and a long night."; you holding a tamarindo agua fresca), `s3b-npc-pool-overhead-1280x720.png`
  (the overhead view of the room with a guests' match on pool table 1).
- **Left open:** guests' darts and shuffleboard on the physics (O35, S4); the murmur (no audio on either page).

## 2026-11-09: Stoppage Time S3a committed (the crowd, staff, fillers and how people are drawn)

S3a, as repaired after review (the entry below), was kept by the follow-up review and is committed on
`claude/sports-bar`.

- **The reviewer's own run** (one Playwright page on the final build, dist of 09:18, headless Chromium with
  SwiftShader, 844 x 390, Low, Saturday 21:00, week 43, `seed(1)`, 10:43 to 10:45 UTC, no other browser running):
  - Loaded: live 36 of 36 (31 guests; 2 bartenders, 2 servers, the host), 77 fillers, 6 spares. At `door`: 7 bodies
    at LOD 1, 25 at LOD 2, 81 cards, no NPC at LOD 0; the pass 103 calls and 163.4k triangles (row 118 / 203.9k).
  - After a 30 sim-minute fast-forward: median mood 60.75, 0% Low; stuck at most 1.0 s, no watchdog rescue, no slot
    over capacity, nobody in the lane, live never over 36, at most 5 staff; a batch of decisions 0.38 ms on average
    (the slowest 4.9 ms). Drinks: 17 bar and 10 table orders, the bar's wait 9 s median and table service 146 s; at
    the end 4 of 31 holding a drink and 1 waiting. No table mixed fillers and live people; the nearest filler 6.73 m
    (Low's minimum 6 m).
  - Trying to break it: 5 guests drawn at LOD 1 within 7.2 m sent home and the 3 nearest fillers' units handed over,
    then Low to HD to Low with no frame between. No body shown under a card and no spare shown either time, no NPC at
    LOD 0, every drawn body at phone quality, live 34 then 36 of 36 (the round trip held 29 and left 41 fillers).
  - Tapping the nearest filler (a rail stool, 6.07 m) gave Sean, live, with his "Say hi" menu; live stayed at 36;
    `pose()` closed the menu.
  - A forced goal on channel 1: 62 reaction records, 34 of them people who could see a screen, 8 reacted; nobody who
    couldn't see a screen reacted.
  - Monday 05:00: 0 live, 0 fillers, 0 staff. No console or page error at any point.
  - `npx tsc --noEmit` passes. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are unchanged.
- **Images looked at:** the builder's 11 `-r2` shots and the reviewer's `qa-s3a-r2-goal-door-low-844x390.png` and
  `qa-s3a-r2-overhead-low-844x390.png` (the patio's tables and rail stools taken at Low from overhead).
- **Noted, not blocking:** a forced goal (`fireMoment`) carries a 0-0 score, so the "On now" chip still reads 0-0 in
  the goal "after" shots. The `stall` pose faces the north wall, so it shows no glazing. Some LOD 1 bodies at HD show
  grey patches on their tops (the people builder's, not this phase's code).
- **Still open:** the toon half of "Low stays Retro" (O15, O16); no phone run. S3b is next.

## 2026-11-09: Stoppage Time S3a repaired after review

The review kept most of S3a and asked for one draw bug fixed, the groups measured before the builder's last fixes run
again on the final code, a few tighter checks, and the crowd's believability looked at. All done on
`claude/sports-bar`, uncommitted. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched
(`git status` on each empty). `npx tsc --noEmit` passes; `tests/sportsbar-crowd.mjs` passes 16 of 16 (the scheduler's
check on the new ring of frame records among them). The page is 1,674.8 KB (560.4 KB gzipped) by Vite's count.

- **What changed:**
  - **The draw bug.** A body sent home (`removeNpc`) while drawn as a card went to the spares with its old draw
    signature (`card:0`); a hand-over took it, set it visible, and its new guest drawn as a card had the same
    signature, so `applyBody` returned early and the body stayed shown, at the old guest's place, under the card. Now
    a body going to the spares clears its signature and forgets its clip, and a spare taken by a hand-over is hidden
    with no signature, so its first `applyBody` sets visibility, LOD and casting afresh. `vis().people` now reports
    `shownAsCards` and `sparesShown`, and a new check (`--only=spares`) builds the case.
  - **`pose()`** moves the camera first, then runs `buildAll()` (whose LOD 1 queue takes the nearest people from the
    camera), then the rule; before, the queue used the previous camera. The `camera([...])` hook places the camera at
    once, and the goal shots call `buildAll()` after it.
  - **The radial menu** (the person's "Say hi" among them) closes on `pose()` and on every change of graphics.
  - **The per-frame allocations the review listed in the people's draw path are gone:** one pooled people list, filled and insertion-sorted once a
    frame (again only if a hand-over near you changed who's live), read by the LOD 1 queue (worked out once a frame,
    not in both `hasWork()` and `nextJob()`) and by `drawModes` (two passes over the sorted list for casters first;
    the casters a flag, not a set); inside or not from (x, z) without a tuple; one camera-point object; one plate
    scale; the hand items without an array a person; the hand-over cell check as numbers, not a string a frame; the
    scheduler's frame log a ring of 6,000 records reused in place.
  - **The switch log carries its evidence** (each held guest's unit distance, every live guest's after the hold, the
    room before anyone came back) and the switch checks assert the units' rule going down and held-before-fillers
    exactly going up (below).
  - **Drinks (ours).** A probe of the reviewer's case (Low, Saturday 21:00, seed 1, 30 sim minutes) found the
    deliveries weren't slow (table service 128 s median, the bar 9 s; 2 servers) but the room's drinks ran in step: a
    room settled at a set clock seated everyone with fresh thirst (50 to 75), they ordered around minutes 3 to 19 and
    were all satisfied by minute 30 (holding a drink: 0 at first, 8 to 10 around minutes 10 to 17, 1 at minute 30). A
    settled guest now has thirst 40 to 85 and a quarter are part-way through a drink (1 to 6 sips left), from a random
    stream of its own so the seating is the same as before. Arrivals still come in with the table's needs.
  - **Whole tables at HD and Ultra (ours).** With the target past the guest cap and the guest cap over 0.4 of the
    capacity (HD's 60, Ultra's 90; not Low's 31), parties of two and three take singles close together (standing spots
    or stools) with p 0.75 rather than 0.35, so fewer tables of four hold a party of two (no table mixes fillers and
    live people, so a part-filled table is lost to the fillers).
  - The decision timing is per batch: `decideMs` is one entry a step, the step's up to 6 decisions; the logs and the
    plan now say "a frame's decisions (a batch of up to 6)".
- **Checks, on the final code** (headless Chromium, SwiftShader, one browser at a time, the machine at a load of about
  14; `tests/out/sportsbar/logs/s3a-r2-checks.log` and `s3a-r2-all.log`, results in `sportsbar-s3a-checks.json`): 63 of
  63 (6 and 57). A first full run (`s3a-r2-first-stopped.log`) found one failure, no laugh in the 4-minute run: the
  drinks' state then drew from the seating's random stream and reshuffled the room; it was stopped, the stream split
  and every group run again.
  - **Needs and mood** (Low, Saturday 21:00): thirst under 30, 13 of 15 (86.7%) chose a drink-tagged action within two
    decisions; hunger 8 of 8; fun 16 of 16. After 30 sim minutes: median mood 66.0, 0% Low; stuck at most 1.0 s, no
    watchdog rescue; no slot over capacity; nobody in the lane; live never over 36; a frame's decisions 0.408 ms on
    average (a batch of up to 6; the slowest batch 5.3 ms of the last 400). Mood on bodies at tv-east over 6 goals:
    clap, cheer and groan on LOD 1 (4, 1, 3) and LOD 2 (27, 1, 1); 24 laughs on bodies in the 4-minute run.
  - **Drinks** (the same 30 sim minutes, `drinks()`): 16 ordered at the bar and 14 by table service, 29 handed over,
    the wait 10 s median at the bar and 125 s by table service (the slowest 164 s) with Low's 2 servers; holding a
    drink, once a sim minute: 8 7 6 4 4 3 3 1 1 0 0 0 2 3 5 6 6 5 6 6 6 6 6 7 9 9 9 10 8 6 of 27 to 31 live guests (at
    minute 30, 6 holding and 1 waiting; before the change the same run read 1 holding). The plan's drink is 6 sips
    40 to 70 s apart, about 5.5 minutes, and a guest re-orders at about thirst 45, so about 1 in 5 holding is the
    steady state; the dip to 0 around minute 10 is the first quarter's drinks running out before the rest are thirsty.
  - **Staff:** at Low 2 bartenders served all 14 counter positions, the westmost left by the flap, reached H, picked
    3, 3 and 2 empties on three trips and came back; HD and Ultra 4 bartenders, every position served, centres at least
    1.913 m and 2.313 m apart; nobody in the lane or the flap; staff on 5, 10 and 10.
  - **Reactions** (Ultra, Saturday 20:08, 10 seeded goals): 102 supporters who could see a screen, 62.7% reacted
    within 1 s against a mean p of 60.7%; 62% of the other side groaned, 24% of the neutral clapped; nobody who
    couldn't see a screen reacted. At the featured final whistle 2 of 10 eligible winners started dancing (2 drew it
    with no free spot), each a winner who could see a screen, active 0.51 and up, fun 50 or less.
  - **Fillers** (live + held + fillers against the target 130, or every free eligible place): Low Saturday 21:00
    31 + 12 + 65 = 108 (65 free eligible), the nearest filler 6.07 m; HD 60 + 3 + 51 = 114, nearest 9.22 m; Ultra
    90 + 0 + 20 = 110, nearest 9.10 m (before the repair 108, 93 and 91); Tuesday 15:00 19 of 19 at each preset; no
    table mixes fillers and live people. The room as loaded at each preset, from the builds group (no pose, you at the
    spawn): Low 31 + 67 = 98, HD 60 + 53 = 113, Ultra 90 + 17 = 107. Tapping a filler (patio table 4, 11.67 m) gave
    Olivia, a walk-in, live there with her menu. **Clock:** Tuesday 15:00 19 guests against Saturday's 108; closed
    (Monday 04:00) nobody inside, no filler, no staff; Low never drew more than 5 staff; the live count never passed
    the cap.
  - **Spares (new):** at Low on the patio pose (outside), 6 guests drawn as cards were sent home (their bodies to the
    spares), then the filler unit farthest away (33.17 m) was handed over: its guest took the first of those bodies
    and was drawn as a card; no body shown under a card, no spare shown.
  - **Low and the shaders:** one NPC forced to LOD 0 at Low after a 30 sim-minute fast-forward and every pose (18
    calls, 63.5k) compiled with no shader error, its hair `retroSkip`. The toon half still waits for the Retro module.
  - **The builds on the time budget** (from load): Low 31 builds (26 LOD 2, 5 LOD 1) until the room reached its cap,
    span 43.7 s within 55.6 s (ratio 1.335, F 937.8 ms, the builds 7.9 s of it); HD 30, 75.9 s within 109.0 s (1.183,
    F 2,135 ms); Ultra 30, 121.8 s within 198.4 s (1.044, F 3,891 ms). Never two a frame, the gap met at every build (at
    least 1.04, 2.18 and 4.94 times the need), no idle frame. Warm-up frames (logged, not timed): Low 1.9, 3.5 and 2.0
    s; HD 3.3, 6.5 and 2.1 s; Ultra 3.7, 10.9 and 5.4 s.
  - **A change of graphics** (10 of 10; every switch behind its sheet, the live count the new cap from the switch
    frame, your group of three live, no regular or held guest a filler):
    - Low to HD: 20 of 20 held guests back (room 29), then 9 fillers made live; 21 bodies rebuilt behind the sheet
      (2,403 ms); every body at high quality; timed, the next 30 builds passed the four marks (75.9 s within 121.3 s,
      ratio 1.063, the gap at least 1.73 times the need; warm-up 1.2, 3.4 and 2.6 s).
    - HD to Ultra: 11 of 11 back (room 30), 19 fillers made live; no body rebuilt, the atlas kept.
    - Ultra to Low: 59 held, 10.11 to 30.12 m away (12 regulars, 19 standing); the nearest held unit 9.22 m and the
      farthest live unit 9.22 m (one table split across the cut), so the units' rule holds; 21 rebuilt (10,576 ms
      behind the sheet on the loaded machine). A held guest tapped (Chloe) came back as herself under the cap.
    - Low to Ultra: 59 of 59 back (room 59), no filler made live; 21 rebuilt (5,519 ms).
    - Ultra to HD: 30 held, 19.39 to 30.12 m (7 regulars, 16 standing); held unit 19.24 m, live unit 19.24 m; no
      rebuild, the atlas kept. HD to Low: 29 held (10.11 to 20.69 m); held unit 9.22 m, live unit 9.22 m; 21 rebuilt
      (5,391 ms).
    - After each switch and `buildAll()` at `door`: LOD 1 bodies 6.5k to 9.5k at Low (mean 7.8k to 7.9k, 7 bodies) and
      8.6k to 14.2k at HD and Ultra (mean 11.7k to 11.8k, 17 and 41 bodies); no console error.
  - **Budgets** (every pose and preset inside its rows; the margin is the row less the measured `stats()`, calls and
    triangles):
    - Low (cap 36): door pass 105/166.5k of 118/203.9k (margin 13/37.4k); tv-east 112/171.9k (6/32.0k); stall
      119/206.0k of 139/244.3k (20/38.3k); patio 85/133.2k (54/111.1k); overhead 111/167.0k of 118/197.9k (7/30.9k); at
      390x844 door 105/167.6k (13/36.3k), overhead 110/167.0k (8/30.9k). The frame 84 to 118 calls, 129.0k to 201.8k
      of 150/250.0k. No shadow maps.
    - HD (cap 70): door pass 145/372.3k of 177/465.7k (32/93.4k), frame 198/488.8k of 294/718.9k (96/230.1k), sun
      41/133.2k; tv-east 154/365.6k (23/100.1k); stall 135/341.5k of 176/449.5k (41/108.0k), frame 221/613.2k of
      328/854.6k, sun 74/288.9k; patio 109/224.8k (67/224.7k); overhead 190/505.3k of 222/609.4k (32/104.1k), frame
      274/772.8k of 374/1014.5k (100/241.7k); at 390x844 door 140/356.6k (37/109.1k), overhead 192/508.9k (30/100.5k).
    - Ultra (cap 100): door pass 187/696.2k of 302/1202.6k (115/506.4k), frame 570/1871.1k of 1155/3259.2k, sun
      89/432.2k, the pool maps 56/49.8k and 55/26.0k; tv-east 250/976.9k (52/225.7k), frame 666/2320.7k; stall
      185/853.5k of 246/1086.4k (61/232.9k), frame 454/2287.0k of 683/3011.9k (the pool maps frozen, 0.7k); patio
      163/736.2k (83/350.2k); overhead 242/1006.0k of 302/1180.0k (60/174.0k), frame 683/2663.4k of 1185/3396.7k; at
      390x844 door 184/681.7k (118/520.9k), overhead 243/998.5k (59/181.5k).
    - The sums cost a LOD 1 body at 7.5k (Low) and 11.6k (HD and Ultra); the drawn bodies average 7.8k to 7.9k and
      11.7k to 11.8k, so the sums' per-body figure is exceeded by 0.3k to 0.4k and 0.1k to 0.2k a body: at most about
      2.8k at Low's 7 LOD 1s and 8.2k at Ultra's 41, against the smallest triangle margins above (30.9k at Low's
      overhead, 93.4k at HD's door, 174.0k at Ultra's overhead).
  - **The crowd's own CPU a frame** (less any build in it; `s3a-r2-crowdframe.log`, real frames after `buildAll()`,
    `peopleBrief().frameMs` read after each frame): Low door 0.9 ms median, 3.1 ms at the 90th percentile (60 frames);
    Low patio 0.5 and 2.0 ms (40); Ultra door 2.2 and 3.9 ms (30); Ultra overhead 2.5 and 5.1 ms (20). Single frames
    reached 19 to 120 ms (one in each run; garbage collection and SwiftShader aren't separated from it here). The
    crowd's step 0.2 to 0.3 ms median. The builder's 0.4 to 2.8 ms were one frame a pose, so there's no like-for-like
    "before" for the allocation change; the median is what it's for.
  - **Screenshots** (all looked at), in `tests/out/sportsbar/`, `-r2`:
    - `s3a-goal-before-1280x720-r2.png` and `s3a-goal-after-1280x720-r2.png` (HD): before the goal, after `buildAll()`
      at the shot's camera (5 built), the nearest guests are LOD 1 bodies (16 at LOD 1, 54 at LOD 2, 4 cards), with
      their hair and clothes; after it, arms up at the booths, a caption, the Cheer button; 8 of the 34 who could see
      reacted.
    - `s3a-goal-before-390x844-r2.png` and `s3a-goal-after-390x844-r2.png` (Low): 6 at LOD 1 nearest, 13 built at the
      shot's camera; 11 of 23 reacted, arms up across the room.
    - `s3a-overhead-friday-1280x720-r2.png`: a packed Friday, live 70 and 48 fillers of a target of 110; reads full,
      the patio's tables taken.
    - `s3a-door-low-844x390-r2.png` (32 meshes, 71 cards), `s3a-stall-low-844x390-r2.png` (it faces the north wall at
      its corner: the parked cars and you, no glazing in view, as before) and `s3a-patio-low-844x390-r2.png` (the rail
      stools and tables taken, the people inside reading through the glass).
    - `s3a-atlas-low-r2.png` (192 cells, clean) and `s3a-tuesday-1280x720-r2.png` (a quiet Tuesday 15:00: 19 guests
      and 4 staff, a few people at the pool tables and the bar).
  - **Regressions** (on the final build): `tests/sportsbar-crowd.mjs` 16 of 16, `tests/sportsbar-sim.mjs` all pass; S2a's
    page checks 22 of 22 (`s3a-r2-s2a-checks.log`); S2b's checks and controls 20 of 21 at first
    (`s3a-r2-s2b-checks.log`: the shuffleboard swipe's puck left at 2.15 m/s against the 2.4 to 3.6 wanted, the
    gesture's 40 ms timers late at a load of about 13; nothing in the swipe's path changed), then the controls group
    alone 7 of 7 (`s3a-r2-s2b-controls-2.log`: 2.87 m/s, as in S2b's own run); S1's memory group 2 of 2
    (`s3a-r2-s1-memory.log`: the rest 105, 132, 143, 132, 106 and back to 132, 143, 132, 106 geometries, the people 39
    to 41, 83 to 85 and 149 to 150). Lot 57's page still builds (1,172.5 KB, 372.75 KB gzipped).
- **Left open:** the Retro toon half of "Low stays Retro" (O15, O16); S3b's people adverts, interactions and NPC games;
  the murmur; the patio closing for rain; no phone run. A room reached by switching up keeps the seating it had, so Ultra's
  room can still come out under Low's on another seed or path (a probe during the repair read 90 + 10 = 100 at the
  door after switching up from Low). Nothing committed.

## 2026-11-09: Stoppage Time S3a built: the crowd, staff, fillers and how people are drawn

S3a (`PROJECT_OC_SPORTS_BAR.md`, "### S3a") is built on `claude/sports-bar`, uncommitted. The room fills: regulars and
walk-ins in parties, live up to the preset's cap with the staff, and fillers (cards) making up the rest of the
simulated crowd; guests choose what to do by the plan's utility AI; two to four bartenders serve the counter by
sections, servers run table service, and at Low the westmost bartender leaves by the flap to collect empties; the crowd
reacts to the screens; people are drawn as LOD 1, LOD 2 or cards by the visibility rule, with the casting people and
Ultra's pool-slot people; bodies are built on the time budget, and a change of graphics moves the live count to the
new cap behind its sheet. `people/`, `lot57/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched (`git
status` on each empty); the bar's own `venues/sportsbar/main.ts` changed in a few local lines only (below).
`npx tsc --noEmit` passes. The page is 1,670.9 KB (559.0 KB gzipped) by Vite's count.

- **The first step.** `git fetch origin claude/onfoot` found nothing newer than 47c71a6 (merged at a5ac3fd), so no
  merge was made. The re-measure: every L row, the contracts and the `people/` internals unchanged (the plan's "S3a's
  re-measure"); the Retro module still only on `origin/claude/wip-modes` (O15).
- **What's new:**
  - `engine/sim/crowd.ts` (the regulars' pool of 48 in friend groups of 2 to 5, first names from 200, traits, teams by
    arrival time, favourites; parties of 1 to 6; log-normal stays with an 80-minute median; the staff plan by the
    share, Low's five), `autonomy.ts` (the utility AI, term by term, the urgent rule, hysteresis, overlays and the
    top-three draw), `groups.ts` (Lot 57's talking-group rules), `builds.ts` (the time budget and its log), `names.ts`,
    `lines.ts` (30 starter lines). No three.js in any of them.
  - `venues/sportsbar/crowd.ts`: the crowd on the page (settling at a set clock, Poisson arrivals from the lot and the
    drop-off, leaving, the live cap with the staff, held guests, fillers and the hand-over with 6 spare bodies), the
    guests' actions on the objects (the bar and table service through the staff, water, the jukebox, the restrooms out
    of sight, watching, sitting, dancing, eating, chatting at their table), the watchdog and the decision log, the
    reactions to the screens (cheer, groan, clap; the direct dance chance at the featured final whistle), the draw
    modes (LOD 1, LOD 2, cards; the casting people with a hidden LOD 1 under a LOD 2; Ultra's pool-slot people), moods
    on bodies (walk speed, a slump when Low, the clips, laughter in standing groups, captions near you), the builds,
    a change of graphics, and the hooks.
  - `venues/sportsbar/cards.ts`: the filler atlas (the atlas eight, 3 poses, 8 directions, 192 cells; 1024 with 48 x 96
    cells at Low, 2048 with 96 x 192 at HD and Ultra) and the cards' one instanced mesh and the blobs'.
  - `crew.ts`: the bartenders' sections and lane limits and the westmost one's flap trip at Low; the host; the barback.
  - `life.ts`: the crowd wired in (its step in the sim, its frame at the top of the update, the reactions, the items in
    hands, the person menu, the S3a hooks); your table and seat choices respect the crowd's slots and fillers.
  - `main.ts` (local edits only): the crowd's context (the renderer, the overhead's target, the state, how your avatar
    is drawn), Sit and tap to sit skip a taken seat, the doors open for guests too, `stats()` and `vis()` report the
    people, `pose()` and `buildAll()` build every pending body first, and every change of graphics goes behind a
    "Switching to …" sheet (Ultra's "Preparing Ultra…" as before), with a `switchSheet(q)` hook.
  - `def.ts`: `fillerMinM` 6 at Low and 9 at HD and Ultra; HD's `staff` 10.
  - Tests: `tests/sportsbar-crowd.mjs` (the engine side in Node) and `tests/sportsbar-s3a.mjs` (the page: smoke,
    checks, staff, reactions, clock, fillers, retro, builds, switch, budgets, shots); S1's memory check changed as
    below.
  - The player beside the crowd (found by S2a's checks run as regressions, fixed here in `life.ts`, `crowd.ts` and
    `crew.ts`): your food and table orders go to the least busy server on shift, and that server's trips for them go
    ahead of the crowd's; a server's job now waits out its delay (the arrival time) in the queue, so a job not yet due
    never keeps a server standing while another is due (a probe found both servers standing through the crowd's
    30 to 90 s arrival delays while wings ordered at the counter sat "on the way"; alone, as in S2a, the timing is the
    same). At a one-person spot someone in the crowd is using (the jukebox, the water station) your action waits in
    the queue ("someone's there, you're next"), the crowd leaves the spot to you, and it starts when they're done (up
    to 2 sim minutes). The jukebox's spot is the page's own, not a venue slot, and the crowd didn't know it (so it
    read as taken to you, and no guest ever picked a song): the crowd now takes it into its places. With every place
    that sees a screen taken, Watch finds you a clear patch of floor in front of it with it in view (the patio's inside
    its rail), clear of people and of every place the crowd uses.
  - S1's memory check (`tests/sportsbar.mjs`, "memory") now takes the people's own geometries off the renderer's count
    (`peopleGeometries()`: the uploaded geometries of the bodies the crowd holds now, the guests', the spares' and the
    staff's) and logs them beside each row: with the crowd, who's in and who's at LOD 1 move between rounds (the run
    against the crowd read one geometry more at Ultra in the second round, 293 against 292). A body let go without
    being disposed is in none of the crowd's lists, so it stays in the rest and still fails the check. A probe of the
    same sequence read the people at 39 to 41 (Low), 85 (HD) and 150 (Ultra) geometries, the rest 105 to 106, 130 to
    132 and 143.
- **Checks** (headless Chromium, SwiftShader, one browser at a time; `tests/sportsbar-s3a.mjs`, logs in
  `tests/out/sportsbar/logs/`, results in `tests/out/sportsbar/sportsbar-s3a-checks.json`):
  - **Engine** (`tests/sportsbar-crowd.mjs`, Node): 16 of 16. The plan's worked arithmetic comes out as written:
    watching 70.46 without the urgent rule; the drink 12 m away with 10 of 13 taken 28.94 without it and 58.94 with it;
    water 47.35; watching re-scored plain 25.46; the bar screens from 12 m 6.72; a drink-tagged action picked with p
    0.988 (20,000 seeded decisions); table service at thirst 29 scores 73.57; seated, ordering at about thirst 45
    (28.33) and not at 50 (24.36); hysteresis keeps the current action; urgency 0.200, 0.650, 1.107, 2.000. Groups:
    268 turns in 20 minutes, median 3.50 s, 1.00 to 10.00 s, 1.40 laughs a minute. The staff plan by share, Low's five,
    48 regulars in 14 groups of 2 to 5, 200 names, stays median 79.6 minutes, 30 lines, the scheduler.
  - **Needs drive choices** (Low, Saturday 21:00; the last run after the fixes, `s3a-checks-7.log`): thirst under 30,
    16 of 18 (88.9%) chose a drink-tagged action within two decisions; hunger 6 of 6; fun 14 of 14 (70% wanted). After
    a 30 sim-minute fast-forward: median mood 65.0, 0% Low; stuck at most 1.0 s, no watchdog rescues; no slot over
    capacity; nobody in the lane; live never over 36; a frame's decisions 0.225 ms on average (a batch of up to 6; the slowest batch 2.1 ms, over the last 400 batches).
  - **Mood on bodies:** in real frames at the tv-east pose over 6 goals, clap (4), cheer (1) and groan (2) on LOD 1,
    clap (31), cheer (2) and groan (2) on LOD 2; 16 laughs on bodies in a 4-minute run; no NPC at LOD 0.
  - **Staff** (the same run): at Low two bartenders served all 14 counter positions, the westmost left by the flap,
    reached H, picked 2 empties and came back (and was out on a second trip, 3 picked, when the check read); HD and
    Ultra four bartenders, every position served, centres at least 0.72 m (HD) and 2.313 m (Ultra) apart, nobody in
    the lane or the flap; staff on 5, 10 and 10.
  - **Reactions** (Ultra, Saturday 20:08, 10 seeded goals): 109 supporters who could see a screen, 61.5% reacted
    within 1 s against a mean p of 59.6% (within 12 points wanted); 61% of the other side's groaned; 23% of the neutral
    clapped (p 0.25); nobody who couldn't see a screen reacted. At the featured final whistle 3 of 10 eligible winners
    started dancing (p = 0.5 x active; 2 drew it with no free spot), each one a winner who could see a screen, active
    0.50 and up, fun 50 or less.
  - **Fillers** (live + held + fillers = the target, or every free eligible place): Low Saturday 21:00 31 + 0 + 77 =
    108 of 130 (77 free eligible), the nearest filler 6.07 m (6 wanted); HD 60 + 0 + 33 = 93 (33 free), nearest 9.22 m
    (9 wanted); Ultra 90 + 0 + 1 = 91 (1 free), nearest 13.03 m; Tuesday 15:00 19 live of 19 at each preset; no table
    mixes fillers and live people. Tapping a filler (patio table 6, 17.84 m) gave Jack, a walk-in, live there with his
    menu. Closed (Monday 04:00) nobody inside; Low never draws more than 5 staff; the live count never passed the cap.
  - **Low and the shaders:** one NPC forced to LOD 0 at Low after a 30 sim-minute fast-forward (17 calls, 65.8k)
    compiled with no shader error, its hair marked `retroSkip`. The toon half waits for the Retro module (O15).
  - **The builds on the time budget** (from load, until the room reaches its cap or the first 30 counted builds): Low
    31 builds (26 LOD 2, 5 LOD 1), span 55.1 s within 71.2 s (ratio 1.316, F 879.5 ms); HD 30, 71.8 s within 112.7 s
    (1.083); Ultra 30, 131.5 s within 222.7 s (1.004). Never two a frame, the gap met at every build (at least 1.01,
    1.52 and 1.83 times the need), no idle frame. The three warm-up frames were logged and not timed (Low 5.0, 4.5 and
    1.4 s; HD 6.7, 7.4 and 2.7 s; Ultra 8.7, 19.9 and 4.5 s).
  - **A change of graphics** (10 of 10): Low to HD behind "Switching to HD…": live 70 at the cap from the switch
    frame, 20 held guests back before 9 fillers made live, 21 bodies rebuilt behind the sheet (2,494 ms), your group
    live, every body at high quality; timed, the next 30 builds passed the four marks (74.3 s within 111.6 s, ratio
    1.133). HD to Ultra and Ultra to HD: no body rebuilt, the atlas kept. Ultra to Low: live 36, 59 held (the nearest
    10.11 m away, the farthest 30.12 m; 12 regulars), 21 rebuilt (4,769 ms behind the sheet), every body at phone
    quality. A held guest tapped (Chloe) came back as herself, room made under the cap first (36 of 36). LOD 1 bodies
    after a switch: 6.5k to 9.5k at Low (mean 7.8k to 7.9k), 8.6k to 14.3k at HD and Ultra (mean 11.8k). No console
    errors.
  - **Budgets** (`stats()` at the poses against the sums, every row inside):
    - Low (cap 36): door 107/165.3k of 118/203.9k; tv-east 114/171.5k; stall 119/206.8k of 139/244.3k; patio
      85/135.9k; overhead 110/165.0k of 118/197.9k; at 390x844 door 104/165.2k and overhead 109/165.0k. No shadow maps.
    - HD (cap 70): door pass 142/357.7k of 177/465.7k, frame 192/442.6k of 294/718.9k, sun 38/102.6k; tv-east
      148/354.5k; stall 135/333.0k of 176/449.5k, frame 219/595.8k of 328/854.6k, sun 74/280.8k; patio 113/226.3k;
      overhead 190/501.9k of 222/609.4k, frame 274/771.7k of 374/1014.5k; at 390x844 door 140/346.0k and overhead
      192/507.1k.
    - Ultra (cap 100): door pass 186/683.6k of 302/1202.6k, frame 571/1850.8k of 1155/3259.2k, sun 90/430.1k, the
      pool maps 57/44.0k and 56/40.0k; tv-east 250/965.5k, frame 669/2286.7k; stall 185/839.3k of 246/1086.4k, frame
      454/2243.8k of 683/3011.9k (the pool maps frozen, 684 tris); patio 163/719.5k; overhead 243/998.7k of
      302/1180.0k, frame 679/2624.4k of 1185/3396.7k; at 390x844 door 181/663.8k and overhead 242/1001.3k, frame
      686/2664.5k.
    - The crowd's step 0.1 to 0.9 ms (one 4.3 ms), its frame 0.4 to 2.8 ms, a frame's decisions (a batch of up to 6) 0.155 ms on average at Ultra;
      a frame's CPU 5 to 18 ms here without a build and 255 to 1,238 ms with a LOD 1 build in it (SwiftShader; real
      hardware not measured).
  - **Screenshots** (all looked at), in `tests/out/sportsbar/`:
    - `s3a-goal-before-1280x720-r1.png` and `s3a-goal-after-1280x720-r1.png` (HD, Saturday 21:00): 14 of the 39 who
      could see a screen reacted, claps at the front, a cheer at the back, the Cheer button up.
    - `s3a-goal-before-390x844-r1.png` and `s3a-goal-after-390x844-r1.png` (Low): 11 of 23, two cheering.
    - `s3a-overhead-friday-1280x720-r1.png`: a packed Friday, live 70 and 46 fillers of a target of 110; reads full.
    - `s3a-door-low-844x390-r1.png`, `s3a-stall-low-844x390-r1.png`, `s3a-patio-low-844x390-r1.png`: Low on a
      Saturday night; the door packed, the patio's people inside read through the glazing (the stall pose faces the
      north wall, no glazing in view).
    - `s3a-atlas-low-r1.png`: the Low atlas (192 cells).
    - `s3a-tuesday-1280x720-r1.png`: a quiet Tuesday 15:00, 19 guests of 19 and 4 staff.
  - **Regressions:** S1's Node sim (`tests/sportsbar-sim.mjs`) and S2b's engine (`tests/sportsbar-games.mjs`) all
    pass. S2a's page checks first read 18 of 22 against the crowd (the jukebox, the
    two counter orders, a patio screen's watch: the fixes above), then 22 of 22 (`s3a-s2a-checks-3.log`: a song +4.62
    fun over 1.5 minutes with the walk, water +17.60 thirst; both counter orders in hand 2.50 sim minutes after the food
    was picked; the patio screen watched 20:11 to 20:27, +5 tokens). S2b's page checks and controls: 21 of 21. S1's
    data, honesty, shadows and memory groups: 36 of 37, the memory check one geometry over at Ultra in the second
    round (the change above), then the memory group 2 of 2 (`s3a-s1-memory.log`: the rest 105, 132, 143, 132, 106 and
    back to 132, 143, 132, 106 exactly; the people 39 to 41, 83 to 85 and 149 to 150 geometries).
- **Re-measured on the final code** (the repair, the entry above; `tests/out/sportsbar/logs/s3a-r2-checks.log` and
  `s3a-r2-all.log`): the builds, a change of graphics, the budgets, the reactions, the fillers, the clock and the
  shots, which had run here before the jukebox's spot joined the crowd's places and the servers' queue changed, all
  passed again on the repaired code: the builds' four marks at Low, HD and Ultra (ratios 1.335, 1.183 and 1.044) and
  after the timed Low-to-HD switch (1.063); all six switches with the units' rule and held-before-fillers asserted;
  every budget pose inside its rows (the tightest Low's tv-east pass by calls, 6 under, and Low's overhead by triangles, 30.9k under); reactions 62.7% against
  a mean p of 60.7%; fillers 108, 114 and 110 of 130 on a Saturday night; closed hours empty; the eleven screenshots
  shot again as `-r2`.
- **Left open:** the Retro toon half of "Low stays Retro" (O15, O16: the Retro module is still only on
  `origin/claude/wip-modes`); S3b's people adverts, the 11 interactions and NPC games; the murmur (no audio on either
  page); the patio closing for rain (the page has no weather); (the draw pass's small arrays a frame went in the repair,
  above); LOD 1 bodies average 7.8k at Low and 11.8k at HD and
  Ultra, a little over the sums' per-body figures, every pose inside its row all the same; no phone run. Nothing
  committed.

## 2026-11-09: Stoppage Time S2b committed (pool, darts, shuffleboard)

S2b, as repaired after review (the entry below), was kept by the follow-up review and is committed on
`claude/sports-bar`. Built: pool on both tables (the house player Rocío, ball in hand anywhere after a scratch), darts
on the three boards, and the shuffleboard, with their game cameras, HUD hints and the game clips (pool stance and shot,
dart throw, shuffleboard slide).

- **Checks, re-run by the reviewer:** `npx tsc --noEmit` passes (re-run again before this commit).
  `node tests/sportsbar-games.mjs` passes 15 of 15: energy never rose, no ball left the bed, the slowest break settled
  in 6.82 s, the house chose 189 pots and 11 safeties, a puck at 3.0 m/s stopped 6.5468 m away. The builder's final
  page run (`tests/sportsbar-s2b.mjs`) passed 21 of 21 page checks and controls and 8 of 8 screenshots. The reviewer's
  own probe at 1280 x 720 (14 random hard pool shots, both scratch paths) found no ball off the bed and no overlap, and
  no console or page error. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are unchanged.
- **Budgets:** the game pieces in play cost 4 calls and 1.4k triangles at Low, 4.7k at HD and Ultra, inside their rows;
  every budget pose stays within its sums (details in O4 of the plan and the S2b entries below).
- **Images:** `tests/out/sportsbar/s2b-pool-aim-*-r2.png`, `s2b-pool-shot-*-r2.png`, `s2b-darts-oche-*-r2.png`,
  `s2b-darts-throw-*-r2.png`, `s2b-shuffle-slide-*-r2.png`, `s2b-shuffle-rest-*-r2.png` (844 x 390 and 1280 x 720),
  and `s2b-clip-*-r2.png`.
- **Still open:** the pool stance and shot clips go to the design review queue (`PROJECT_OC_HANDOFF.md`). S3a is next.

## 2026-11-09: Stoppage Time S2b repaired after review

Two reviews of S2b: one kept it with fixes, one rejected it (your ball in hand wasn't "anywhere", and the games'
per-frame drawing allocated memory). Both lists are done on `claude/sports-bar`, uncommitted; what was good is kept.
`lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` still show an empty `git status` and `git diff`.
`npx tsc --noEmit` passes. The page is 1,573.5 KB (525.9 KB gzipped) by Vite's count.

- **Two claims in S2b's summary were wrong, and are corrected here and in the plan:**
  - The near-black people over the pool table were not Low's missing lights. They were your own avatar, drawn in the
    game view, standing just under the pool camera (its eye about 0.25 m below the camera's): its arms and shoulders
    showed as black shapes at the frame's left edge at Low and at HD (`s2b-pool-aim-1280x720-r2.png` of the first
    round was HD).
  - The darts "mid-throw" screenshot had no dart in the air: its own log said "0 in the air" and the check passed
    anyway.
- **What changed:**
  - **Ball in hand for you** (the plan's "a scratch gives ball in hand anywhere"): after the house scratches, your cue
    ball starts on the head spot and stays in hand; a drag that starts on it (within 8 cm on the cloth) moves it
    anywhere on the bed, to the nearest free spot (`PoolGame.place(x, y, keep)` through `freeSpot`); the shot ends it.
    The hint says "Ball in hand: drag the cue ball to place it anywhere · then drag back from it to aim · release to
    shoot". Hooks: `shoot(id, { place: [x, y], ... })` (refused without ball in hand), `placeCue`, and
    `houseShot(id, 'scratch' | { angle, speed })`, which scripts the house's next shot so a check can have it scratch.
  - **Your avatar is hidden in the pool view** (a hidden caster at HD and Ultra), from the move in to the move back;
    darts and shuffleboard still show it over your shoulder.
  - **The toasts no longer cover the "Simulated crowd" chip.** Outside a game they sit under the top centre column and
    the screens chip (their bottom measured by a `ResizeObserver`, not per frame); in a game, just above the game's
    bar.
  - **The darts throw screenshot** is taken with the third dart in the air. A frame here (0.5 to 3 s) is longer than
    the whole 0.44 s throw, so a hook, `holdDart(id, k)`, holds the dart at 12% of its flight, and the check fails if
    no dart is in the air.
  - **The shuffleboard's zones read.** The lines are 4 cm wide (they were 2 cm) and cream (they were near black), the
    foul line bright red, and the numbers 1, 2 and 3 are painted in the zones (12 strokes in the markings batch, about
    0.2k triangles, no call). From the throwing end the zones are 6 m off and nearly edge-on, so no paint makes them
    legible from there. While your puck slides and in the pause after, the camera now follows it, 1.7 m behind and
    over its line. The new `s2b-shuffle-rest-*` screenshots show it.
  - **A bug found on the way:** the shuffleboard's sideways sign took the screen's left for its right. A swipe drifting
    right sent the puck left, and the camera stood on your left. Fixed: a right drift goes right (checked on screen
    below).
  - **The scripted shots refuse non-numbers** instead of clamping them: a NaN, infinite, zero or negative speed, a NaN
    angle, a bad place, and the darts' and shuffleboard's values. `PoolGame.shoot` and `ShuffleGame.slide` refuse them
    too. Before, a NaN angle left the table rolling until the 60 s settle limit.
  - **No allocations in the per-frame paths** (the code review's list):
    - Pool: the drawing and `toW` write into a scratch pair or inline math with the cached axes, and `guide()` fills
      one result object.
    - Shuffleboard: pucks are drawn through a private method with the cached bed axes, and the substep keeps one event
      object.
    - Darts: the sway and the reticle write into scratch pairs (`swayInto`).
    - Places worked out once at construction: the oche, the aside spots, the thrower's place, the house's places, the
      darts and shuffleboard camera eyes, and the walk-away anchor.
    - The game bar's text is rebuilt only when the game's version changes, and the balls and pucks left are fields
      (`PoolGame.leftN`, `ShuffleGame.bySide`). The power meter and the reticle are written only when their values
      change.
    - The house's ball-in-hand search passes the skipped ids to `clearPath` as numbers and reads its targets once.
- **Checks** (headless Chromium with SwiftShader, one browser at a time; other lanes' suites were running, and the
  load was about 9 to 11):
  - `node tests/sportsbar-games.mjs`: **15 of 15** (`tests/out/sportsbar/logs/s2b-r-games-unit.log`). The 13 as
    before, with the same numbers: no energy rise over 500 breaks, the slowest settling in 6.82 s; 189 pots and 11
    safeties; the 3.0 m/s puck stopping 6.5468 m away. Two are new:
    - Ball in hand: placing at (0.2, -0.3) keeps the ball in hand there. Asking for (9, 0.3), off the bed, puts it at
      (0.467, 0.300), on the cushion's line. Asking for the 5 ball's spot moves it 60 mm off that centre. Five bad
      shots are refused. A good shot leaves from (0.20, -0.30) and ends the ball in hand.
    - The house's ball-in-hand search (`bestPlacement`), timed in Node over 200 seeded layouts: median 1.11 ms, 95th
      percentile 4.53 ms, worst 8.47 ms. The worst includes the first call's warm-up. The previous version wasn't
      timed, so there's no before figure.
  - `node tests/sportsbar-s2b.mjs --only=checks,controls` on the final build: **21 of 21**
    (`s2b-r-final-checks.log`). The S2b checks pass with the same numbers as before: the three games and the close
    loss, the clips at each LOD with `people/` clean, the breakdown, and the cameras (in over 5 frames and back over 6,
    0.000 m from your eye, 2 cuts with reduced motion). The breakdown's base is now 110 calls and 162.7k triangles: the
    painted numbers. The new checks:
    - Ball in hand after the house's scripted scratch: the house's log says "Rocío scratched: ball in hand". The cue
      ball sat at (0, -0.495), the head spot, still in hand, with the hint shown. `shoot` with
      `place: [0.3, -0.25]` struck from (0.3, -0.25), and the ball in hand ended.
    - Twelve bad scripted values refused, each with its reason, and nothing moved.
    - The toasts at 844 x 390: "You: nothing down" at y 264 to 294, just over the bar (from y 300). After you leave,
      the toast is at y 132 to 171, under the chip (y 92 to 126). No overlap either time.
    - The bar rebuilt 0 times over 4 frames of your turn, and once after a shot. In third person at Low your avatar
      isn't drawn in the pool view, and is drawn in the darts view.
    - By pointer at 1280 x 720: a 190 px drag from the cue ball moved it from the head spot to (0.1024, -0.125), still
      in hand. A drag back from it then shot from there.
    - A swipe drifting 20 px right gave a line of +0.954 degrees. On screen the bed's +y lies to the right (x 672 px
      against 649), and the puck stopped at y +0.107 m.
    - The toasts at 1280 x 720: "You: 20 · 20 · 281 to go" at y 557 to 587, over the bar (from 593); after leaving, at
      y 132 to 171; the chip at y 92 to 126.

    The earlier checks: the pool drag (74.05 degrees, power 0.327) and the darts flick (T20). The straight swipe gave
    2.98 m/s and stopped at 6.5497 m. In one earlier run the same gesture measured 2.56 m/s, because the page's timed
    events stretched under load; the check's band (2.4 to 3.6) held.
  - `--only=shots --tag=r2`: **8 of 8** (`s2b-r-shots-3.log`). I looked at every image:
    - `s2b-pool-aim-*-r2.png` and `s2b-pool-shot-*-r2.png` (844 x 390 Low, 1280 x 720 HD): the table, the cue, the
      guide, the ghost ball and the power. No black shapes at the edges, only the pockets. Your avatar was not drawn
      (Low) or a hidden caster only (HD).
    - `s2b-darts-oche-*-r2.png`: the aim held on the treble 20, its sway putting the reticle by the treble 1 at that
      instant. The toast "You: 20 · 20 · 221 to go" sits above the
      game bar, and the chip reads.
    - `s2b-darts-throw-*-r2.png`: the third dart in the air, just out of your hand, lower left of the board (1 in the
      air, at 12% of its flight).
    - `s2b-shuffle-slide-*-r2.png`: your puck on its way, the camera following.
    - `s2b-shuffle-rest-*-r2.png`, new: your puck at rest in zone 3, with the zone lines and the painted 1, 2 and 3
      legible ahead, and the toast "Your puck: zone 3" over the bar.
  - Not re-run: the budget poses, and S1's and S2a's groups. The repair adds no draw call. The venue gains about 0.2k
    triangles, and in S2b's budget run the closest any pose came to a row was 3 calls and 31.8k triangles under it.
    The toasts' new place isn't checked by any S1 or S2a check.
- **Left open:** the cue is drawn on its own, not in your or Rocío's hands. It's written up with the pool stance and
  shot clips for the design review queue (`PROJECT_OC_HANDOFF.md`, O33). Watch pool, other people's games, the
  unwatched games' statistics (S3a), keyboard and gamepad shots, and the games' sounds are still not built. Frame rates
  on real phones were not measured.

## 2026-11-09: Stoppage Time S2b built: pool, darts and shuffleboard

S2b (`PROJECT_OC_SPORTS_BAR.md`, "### S2b: the games") is built on `claude/sports-bar`, uncommitted: pool on both
tables, darts on the three boards and the shuffleboard, each played against the scripted house player, with the plan's
physics, rules and controls, the house's shot selection and aim error, the game cameras, the results and the four game
clips. `people/`, `lot57/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched (`git status` on each
empty); the bar's own `venues/sportsbar/main.ts` changed in five lines (the game view's camera hook and your avatar
drawn in it). `npx tsc --noEmit` passes. The page is about 1,565 KB (523 KB gzipped) by Vite's count, 56 KB more
than S2a's.

- **What's new:**
  - `engine/sim/pool.ts`, `darts.ts`, `shuffle.ts` and `games.ts` (no three.js): the plan's pool physics (r 0.028 m,
    1.98 x 0.99 m bed, restitution 0.95 and 0.75, 0.25 m/s², pockets r 0.055, 240 Hz, no spin), simplified 8-ball, the
    house's shot selection exactly as the plan's six steps and its aim error; the standard dartboard, 301 straight out
    with the bust, your sway; the shuffleboard (mu 0.07, 0.8, 0.6, 240 Hz, zones and frames to 15); the results'
    numbers. Also the unwatched games' statistical pool turn and seeded layout (not wired: S3a's).
  - `venues/sportsbar/games.ts` (the six game spots, your drag, flick and swipe, the pieces, the house's turns),
    `gamecams.ts` (above the table, behind the oche, behind the puck; 0.5 s, a cut with reduced motion) and `house.ts`
    (the house player, Rocío, one of our staff, built at LOD 1 with the crew at load). `life.ts` wires them: Play pool,
    Play darts and Play shuffleboard on the radial menus, the games' need rates while you play, the results (the
    "Won a game" moodlet at 12 x (0.6 + 0.8 x competitive) and 5 house tokens, or "Lost a close one"), three of
    tonight's goals, and the hooks `game(id)`, `shoot(id, params)`, `games()`, `playHere`, `playOut`, `leaveGame`,
    `gamecam`, `house`. The game bar, the cue's power meter and the dart's reticle are HTML (`sportsbar.html`).
  - The venue: the pool tables redrawn to the plan's playing bed (the same boxes moved: 684 triangles a table and lamp,
    as before), the shuffleboard's bed to 6.7 x 0.51 m with side rails and its four lines, and the dartboard's face
    redrawn at the standard radii with its numbers, so the face is the board the scoring reads.
  - The clips: pool stance, pool shot, dart throw and shuffleboard slide on S2a's clip layer.
- **Bugs found and fixed while building:** the dart reticle sat about 0.4 m off the board: after the game view moves
  the camera, its world matrix was still the one Lot 57's `lookAt` left at your eye, so projections that frame used
  your eye (the game view now updates the matrix; handoff item 10). A dart thrown during a fast-forward's one-second
  step spent its wind-up and stayed in the air (the step now carries the remainder into the flight). The budget
  poses' first run measured the pool camera, not the poses, because staging the games made a game yours (staged games
  now leave the camera and the walking-away rule alone, and a test's fixed camera wins over a game view).
- **Checks** (headless Chromium with SwiftShader, one browser at a time; other lanes' browsers were running throughout
  and the machine was at a load of about 16 to 20):
  - `node tests/sportsbar-games.mjs` (no browser): **13 of 13 passed** (`tests/out/sportsbar/logs/s2b-games-unit.log`):
    - pool physics over 500 random breaks (the cue ball behind the head string, within 3 degrees of the apex, 3.5 to
      5.5 m/s), every 240 Hz substep: the largest rise in kinetic energy over a substep 0 (energy never grew); no ball
      ever off the bed, and every ball off the table one that was potted; the slowest break settled in 6.82 s (median
      4.93 s), 0.74 balls potted a break;
    - the house's pool shots in 200 seeded layouts (2 to 15 object balls scattered, groups or an open table): 189 pots,
      each passing both clear-path tests with a cut under 70 degrees (side pockets within 50 degrees), and 11 safeties;
    - 40 whole pool games with the house's selection on both sides all ended with a winner (the longest 197 shots);
    - darts: the board (T20 60, D20 40, 1 right of 20, 6, 3 and 11 at 3, 6 and 9 o'clock, bull 50, 25, off 0); from
      40, a single 20 leaves 20, a treble 20 then busts back to 40 and passes the turn; a single 20 from 40 then 20
      wins (no double); 40 whole games all ended (the longest 12 turns); the sway 30, 19.5, 9.0, 19.1 and 31.7 mm at 0,
      0.6, 1.2, 2 and 3 s held, 12.8 mm at 1.2 s with energy 5;
    - shuffleboard: a puck released at 3.0 m/s stopped **6.5468 m** away (v² / 2 mu g = 6.5531 m), in zone 3; a puck slid
      into another knocked it on; 40 whole games to 15 all ended (4.0 frames a game on average).
  - `node tests/sportsbar-s2b.mjs --only=checks,controls` on the final build: **14 of 14 passed**
    (`tests/out/sportsbar/logs/s2b-final-checks.log`; the same checks passed before the last two fixes in
    `s2b-checks-2.log` and `s2b-controls-3.log`). The checks (844 x 390, Low, Saturday 21:00, week 43):
    - the house player built at load (LOD 1, 7.3k triangles at phone quality) with the bartender and the server;
    - a pool game completed: you won (your shots by the hook: the break, then the house's own selection for your balls
      with no aim error; the house at its 3.3 degree error), 18 shots in all, "Won a game" +11.99 (12 x
      (0.6 + 0.8 x 0.5) = 12.00), tokens +5 from the game (+5 more from "Pot two balls in one pool turn"), the emotion
      Confident; while playing, the needs ran at pool's rates;
    - a darts game at competitive 0.9: you won, "Won a game" +15.82 (15.84), +5 from the game and +5 for "Win a game
      of darts";
    - a shuffleboard game (your slides at zone 3's speed, straight): you won 15-0 in two frames, +11.99, +5 from the
      game and +5 for "Land a 3 at shuffleboard";
    - a close loss: you stalled at 1 to go and the house checked out: "Lost a close one" -3.97, no tokens from the game
      (the one token that came was the time in the bar);
    - with a game of each kind set up, `breakdown()` (a fixed camera over the games, the loop frozen) changed only in
      the item meshes: 110 calls and 162.5k without pieces, 114 and 163.9k with them (balls 31 x 32, bands 14 x 16,
      sticks 8 x 12, discs 5 x 16: 4 calls, 1.4k);
    - the game cameras: for each game, in over 6 frames and back to your view over 6 frames once the turn passed,
      the camera 0.000 m from your eye in first person; with reduced motion a cut each way (the blend 1 on the first
      frame of your turn and 0 on the first frame after);
    - the four game clips play on a person built at LOD 2, 1 and 0 (weight 1; the right arm turned 0.25 rad in the pool
      stance and shot, 1.36 in the dart throw, 1.01 in the slide), and `git status` and `git diff` on `people/` empty.
  - The controls (1280 x 720, Low; the loop frozen during each gesture so the events are quick; the darts' and the
    shuffleboard's gestures dispatched as timed touch events in the page, since mouse events over the test's connection
    arrived up to a frame apart on this loaded machine): a 91 px drag back from the cue ball set the aim (74.05 degrees) and the power (0.327, the
    meter showing it) and the release shot; at the darts a press and a slow release threw nothing, and a 1.2 s hold
    then a flick up (240 px in 64 ms) threw one dart, a treble 20; a swipe of 360 px in 0.2 s slid the puck at
    2.98 m/s to 6.558 m, zone 3.
  - `--only=shots,clipshots --tag=r2`: **9 of 9** (`s2b-shots-2.log`), every image looked at:
    `tests/out/sportsbar/s2b-pool-aim-*-r2.png` and `s2b-pool-shot-*-r2.png` (overhead: the cue drawn back, the guide
    to the ghost ball and the object ball's line, the power meter; then the break spreading), `s2b-darts-oche-*-r2.png`
    and `s2b-darts-throw-*-r2.png` (behind the oche: the numbered board, two darts in the 20, the reticle swaying round
    the treble 20), `s2b-shuffle-slide-*-r2.png` (down the board, a puck on its way and one in the scoring end), each at
    844 x 390 (Low) and 1280 x 720 (HD); and `s2b-clip-*-r2.png`. The first round of shots (`s2b-shots-1.log`) showed the
    reticle off the board and your own head and back filling the darts and shuffleboard views: fixed (the matrix above,
    and the two cameras moved over the shoulder and ahead of your body).
  - `--only=budgets` (844 x 390; at each preset the five budget poses with a game of each kind set up, the pieces in
    play, then every item model at its cap): **16 of 16** (`s2b-budgets-2.log`). The pieces in play: 31 balls, 14 bands,
    5 discs, 5 sticks, 4 calls, 1.4k at Low and 4.7k at HD and Ultra; at the caps 6 calls, 5.7k and 13.9k. The pass
    (calls/triangles; at the caps; the sums' column) and the pass less the people and items (its row):
    - Low: door 72/92.4k (74/96.8k of 118/203.9k; less 65/69.3k of 74/101.4k), tv-east 79/100.6k, stall (outside)
      107/169.9k (of 139/244.3k; less 99/138.9k of 119/177.8k), patio 73/99.6k, overhead 75/98.5k (of 118/197.9k);
    - HD: door 73/113.5k (of 177/465.7k), tv-east 79/125.6k, stall 111/267.1k (of 176/449.5k; less 103/217.3k of
      139/328.2k), patio 85/155.0k, overhead 119/274.3k (of 222/609.4k); the whole frame 121 to 198 calls;
    - Ultra: door 84/153.1k (of 302/1,202.6k), tv-east 127/422.4k, stall 145/621.0k (of 246/1,086.4k; less 117/424.6k of
      159/611.4k), patio 123/507.3k, overhead 128/477.0k (of 302/1,180.0k); the whole frame 290 to 381 calls and up to
      1,612k.
    The staff are three now (the house player is the third): 3 calls and 21.8k at Low, 33.3k at HD and Ultra. The page's
    own CPU per frame at the poses was 1.5 to 12.3 ms (the machine loaded).
  - `node tests/sportsbar-sim.mjs`: 32 of 32, as before (`s2b-s2a-sim.log`).
  - S2a's page checks on the S2b page (`node tests/sportsbar-s2a.mjs --only=checks`): **22 of 22 passed**
    (`s2b-s2a-checks.log`): ordering, sips, watching, the jukebox and water, dancing, the screens, the items, the
    honesty and menu checks and the clip layer (which now probes the game clips too) all as before.
  - S1's groups on the S2b page (`node tests/sportsbar.mjs --only=data,honesty,shadows,memory --tag=s2b`): **37 of 37
    passed** (`s2b-s1-regress.log`): the frame, the street sets, the I-5, the trees, the front, the zones and slots,
    walking on the real grid, the lane path, the stalls, the darts' faces (a ray from each oche meets the face at 2.31
    m), tap to go from the customer side; the real name in none of the 176 files under `src/` or the built page, and no
    "live", odds, bet or currency word on any canvas or in the UI with every sheet open; at Ultra both pool spots' maps
    frozen and drawn once, and your avatar's caster dropping the sun's map by 11.8k in first and third person
    (`s1-shadow-ultra-third-lot-noon-s2b.png` looked at); and Low, HD, Ultra, HD, Low twice coming back to the same
    counts round after round (low 25 textures and 105 geometries at the start, one of each more than S2a's page: the
    house player; the second round adds 0 and 0).
- **Left open:** the pool stance and shot read as a lean over the table rather than a cue drawn back (written up for
  the design review queue in `PROJECT_OC_HANDOFF.md`); Watch pool, other people's games and the unwatched games'
  statistics wired to them (S3a); teams of 2 and invites (S3a); the games' sounds; keyboard and gamepad shots. (This
  entry also said the people seen from above the pool table were near black because Low has no real lights. That was
  wrong: it was your own avatar under the pool camera, at Low and HD alike, fixed in the repair above.)
  Frame rates on real phones were not measured.

## 2026-11-09: Stoppage Time S2a committed

S2a (needs, objects, ordering and the screens), with its repair after review, is committed on `claude/sports-bar`.
The second review kept it: the reviewer drove ordering four ways in a fresh Playwright session at 844 x 390 (table
food then a counter drink; a drink menu open then a table order; drink, food, drink, food at the counter; cancelling
and a stray pick) and every run ended with no orders left and the menu closed, with no console errors.

- Checks as measured in the entry below: `npx tsc --noEmit` passes; `tests/sportsbar-sim.mjs` 32 of 32;
  `tests/sportsbar-s2a.mjs` checks 22 of 22 and save, shots and clip shots 12 of 12; S1's groups on this page 65 of 65.
- Budgets: the items per instance and at their caps are within their rows (6 calls, 5.7k triangles at Low; 13.9k at
  HD and Ultra against 6.0k and 14.1k). The page is 1,509 KB (504 KB gzipped). Frame rates on real phones were not
  measured.
- Images: `tests/out/sportsbar/s2a-*-r2.png` (needs panel and strip at 390 x 844 and 844 x 390, radial menu, ordering,
  holding a drink, TV goal, guide, dance, clips sheet) and `s1-door-front-in-low-2100-s2a-r2.png`,
  `s1-shadow-ultra-third-lot-noon-s2a-r2.png`. Logs in `tests/out/sportsbar/logs/` (not committed).

## 2026-11-09: Stoppage Time S2a repaired after review

The review of S2a (one reject, one keep) drove the page and found four defects in the core loop that S2a's own 16
checks didn't catch, plus stale messages, a radial menu over the needs strip at 844 x 390, per-frame allocations and
smaller items. All are fixed in place on `claude/sports-bar`, uncommitted; what S2a did well is kept. `people/`,
`lot57/`, `src/onfoot/main.ts` and `index.html` are still untouched (`git status` on each empty). `npx tsc --noEmit`
passes. The page is 1,509 KB (504 KB gzipped), 7 KB more than S2a's.

- **What was wrong and what changed:**
  - **Ordering could lock itself for the visit.** Ordering a drink and then food at the counter left two orders
    "choosing" behind one menu; a picked item went to the first, whatever its kind; "Not now" dropped one; the other
    stayed forever, and `notHolding` with it. Now (`venues/sportsbar/life.ts`): only one order is ever choosing. A
    second order at the counter waits in the queue (its icon stays, stage `waiting`) until the open menu is answered,
    then opens its own; a server who arrives while a menu is open waits beside you. A picked item answers the open
    menu only if it's that menu's kind. "Not now" drops the order its menu was opened for. A menu sheet closed without
    an answer drops its order, and any order still choosing with no menu open is dropped the same frame. An unfinished
    order of a kind, or one queued, keeps that kind off the menu; an empty in your hand no longer does (it's set down
    when the next item comes), and with no table within 3 m a toast says once where it can go.
  - **"A match watched to the final whistle" could never complete on the big screen** or the screens that follow it:
    at the whistle's minute the big screen has already turned to highlights. The screen's channel is now taken just
    before the whistle (`channelAt`).
  - **Sip drank the whole glass at once.** `sip()` now does nothing while a sip's 2.4 s clip plays; the empty goes down
    after the last sip's clip.
  - **The schedule** paired teams slot by slot on their own (CGS v ARK three times on a Saturday, SFT four slots in a
    row, the same featured pair Friday and Saturday). Each day's pairings now come from a seeded round-robin
    (`engine/sim/tv.ts`, `pairings()`): 28 pairings for the eight teams, no pairing twice a day, no team in two slots
    in a row, and a featured pairing never the same as the day before's in the same league (in weeks 30 to 55 that
    took a second draw once in 52 such days). Each slot's own seed still draws the match.
  - **Sim time and the clock.** Setting the clock to the same reading twice didn't restart sim time (found by the new
    final-whistle check: the second run started 17 minutes late), and a clock set back left every absolute timer in
    the future (found by the new nudge check: the next sip was an hour away, so a drink stayed in hand). A set clock
    now always restarts sim time, and a jump keeps every timer's time left (the next sip, orders, an action's start, a
    dance, reservations, the moodlets' fading, the nudges' spacing).
  - **Messages.** A set clock takes toasts and captions down; a fast-forward takes them down at its start, and at its
    end any it raised whose time has run out in sim seconds.
  - **The radial menu** stays below the needs strip and above the map credit, measured after it's drawn.
  - **Allocations in the frame:** the clip layer's helpers and quaternions are hoisted to module scratch (no closures
    or quaternions per call); `drawItems` uses a member Euler and no array literals; the screens' channels are worked
    out once a sim minute (every kick-off and whistle falls on one) and the screen mesh's UVs only when the big
    screen's channel or the opening hours change; the heaters are a constant; `Moodlets.prune` and `hold` work in
    place; `stepOrders` doesn't copy; `Reservations.lapse` returns a reused buffer; `eventsBetween` fills a reused
    buffer (the broadcast has its own) and skips fixtures outside the span; the fixtures cache has a numeric key; the
    life layer's `doing()` and the page's clock object are filled in place. These are code changes; the allocation
    rate itself wasn't measured.
  - **Smaller items:** the server's walk time is its grid path over its pace; your reservations hold for the walk
    (its path at walking pace) plus 10 s, renewed if you're still walking when one lapses; the Cheer button shows
    after any moment, as the plan says (goals, big chances, touchdowns, field goals, big plays, final whistles), and a
    cheer counts as a team moment only for a score or a win; `clipTest` frees its test person's bone texture.
- **Checks** (headless Chromium with SwiftShader, one browser at a time; the machine at a load of about 10):
  - `node tests/sportsbar-sim.mjs`: **32 of 32 passed** (`tests/out/sportsbar/logs/s2a-r2-sim.log`), three new: the
    schedule over weeks 30 to 55 (182 days, 1,924 fixtures: no pairing twice in a day, no team in two slots in a row,
    no featured pairing repeated from the day before), the draw the same from a fresh schedule, and `eventsBetween` in
    time order from one reused buffer (164 events on a Saturday). With the new pairings, week 43's 49 Marigold
    matches average 1.69 goals and 4.37 big chances (the plan: about 2 and 4) and 25 gridiron games 2.40 touchdowns
    (2.5).
  - `node tests/sportsbar-s2a.mjs --only=checks --tag=r2`: **22 of 22 passed** on the final build
    (`tests/out/sportsbar/logs/s2a-r2-checks-3.log`; the first two runs, `-1` and `-2`, found the two sim-time faults
    above). S2a's 16 checks pass as before (the same decay, mood, jukebox, water, dance, watching, ordering, items,
    featured, highlights, honesty, menu, clip and HD numbers; the clip probe values are identical to S2a's), and six
    are new:
    - Order a drink then Order food at the counter: the drink menu opened with the food order waiting in the queue;
      wings picked on the drink menu changed nothing; after 30 s still one order choosing; the lime soda picked, the
      food menu opened; both delivered 2.5 sim minutes after the food was picked; once finished (the empties on the
      counter), the bar offered Order a drink and Order food again.
    - Not now on the drink menu dropped only the drink order and the food menu opened; Not now there dropped it; a
      food menu closed unanswered was dropped by the next frame ("menu closed"); both offered again.
    - Twelve Sip taps in a row: one sip (6 to 5 left); a tap 2 sim seconds later: none; 3 s later: one; with the clock
      set back an hour the automatic sips went on.
    - "Watch a match to the final whistle" drawn for the visit: watching the big screen from 20:11 to 20:27 (its
      channel 1 until the 20:25 whistle, highlights after) completed it, +5 tokens; the same on patio screen 1, which
      follows the big screen.
    - The low-need nudge: thirst from 30.05 under 30 showed "Thirsty: the bar's 3 m away"; setting the clock then
      left no toast and no caption.
    - The heaters: "Warm by the heater" +2 at frame (12.9, -2.6) at 21:00 (night 1), none at (17.0, -2.6), none by the
      heater at 13:00 (night 0). (The tired prompt and your team's goal-for and team-won moodlets were confirmed by the
      reviewer by hand; no check of their own yet.)
  - `--only=save,shots,clipshots --tag=r2`: **12 of 12** (`tests/out/sportsbar/logs/s2a-r2-shots-1.log`): saving
    round-trips and the page works with storage blocked; every S2a screenshot again with `-r2`; and two new at 844 x
    390 on Low, driven as the review drove it: a dance at Saturday 21:00 after a closed hour (the "closed · opens
    09:00" toast at 05:00) and a drink's hand-over, with no toast and no caption left; and the big screen's radial,
    its pills from 77 to 279 px, the strip ending at 50 and the credit starting at 333.
  - S1's groups on the repaired page (`node tests/sportsbar.mjs --only=data,walks,seats,cross,shadows,memory
    --tag=s2a-r2`): **65 of 65 passed**
    (`tests/out/sportsbar/logs/s2a-r2-s1-regress.log`, screenshots `*-s2a-r2.png`). Data: the frame, the near and far
    sets, the I-5 and the bridge rule, the trees, the front, the zones and slots, walking on the real grid (137 stand
    points, the worst 0.413 m; 11,641 cells reached, none in the lane or the flap), the lane path, the stalls (fill
    bias 0.834), the darts, tap to go from the customer side, the light streams and every street row, all as S1's.
    Walks: 1,000 random walks (500 tap to go, 500 stick; 1,068,196 positions over 25,822 m against 173 colliders)
    never ended inside a collider or crossed a wall, the patio fence or the party wall (1 tap had no path, 499
    arrived). Seats: tap to go reached all 91 seats and sat you down; sit and stand on each kind. Cross: at Low, HD and
    Ultra, walking out of the front and patio doors in first and third person flips the state on the crossing frame
    with only the listed swaps (front door, first person: step 49 of 162), and the door screenshots at 12:00 and 21:00
    (`s1-door-front-in-low-2100-s2a-r2.png` looked at). Shadows: at HD and Ultra your avatar's caster drops the sun's
    map by 11.8k triangles when turned off, first and third person, and Ultra's two pool spots' maps are frozen and
    drawn once outside. Memory: Low, HD, Ultra, HD, Low twice comes back to the same counts round after round (low
    24 textures and 104 geometries, then 52 and 105 after the first round's caches; the second round adds 0 and 0).
    That's 2 textures and 8 geometries more than S1's page at every step (S2a's screens, staff and items), and none is
    left behind by a switch, though S2a rebuilds the item meshes, the broadcast texture and both staff on one. So `tapScreen`'s routing to the radial menu first didn't disturb tap to go,
    walking or seating.
- **Screenshots, each looked at** (`tests/out/sportsbar/*-r2.png`): the needs panel and strip at 390 x 844 and 844 x
  390; at 1280 x 720 HD the bar's radial menu, the drinks sheet, holding a drink in first person (just after the
  hand-over, so the bartender's caption is current); the TV wall at the featured match's first goal (week 44, 20:03,
  Ridgeview Sundials 4': week 43's Saturday featured match, MSQ v HBL, now ends 0-0 with no goal, so the suite takes
  the next week with one and says so) with GOAL banners on three screens and no stale caption; the guide card for
  that Saturday (12:00 BLU v RVS, 12:30 SFT v PAL, 13:00 ARK v CGS, ...: no pairing twice, no team twice running);
  a dance at 21:00; at 844 x 390 the dance with the strip, chips and screens clear of stale messages
  (`s2a-dance-844x390-r2.png`), and the big screen's radial (Watch the game, Stand and watch, Dance) below the strip
  (`s2a-radial-big-844x390-r2.png`); each clip again (`s2a-clip-*-r2.png`, `s2a-clips-sheet-r2.png`), the same poses
  as S2a's.
- **Left open:** as S2a's entry, less the nudges, the heater and the final-whistle goal, which now have checks. The
  room is still empty but for the two staff while the chip says "Packed" (S3a). No phone run.

## 2026-11-08: Stoppage Time S2a, needs, objects, ordering and the screens (built and verified; uncommitted)

Phase S2a of `PROJECT_OC_SPORTS_BAR.md`, built on `claude/sports-bar` after merging Lot 57's committed P1b and P1c
(`claude/onfoot` 47c71a6; merge commit a5ac3fd, the only commit of this pass: `PROJECT_OC_PROGRESS.md` conflicted,
both entries kept; `npx tsc --noEmit` and `npm run build` passed on the merge). The S2a build itself is uncommitted, as
the workflow asked. Lot 57's files (`src/onfoot/lot57/`, `main.ts`, `index.html`) and `src/onfoot/people/` are
unchanged (`git status` on `people/` empty, checked by the suite); Lot 57's page still builds
(`npx vite build --config src/onfoot/vite.config.ts`, 1,172 KB). Everything on the page stays simulated and labelled:
the matches are fictional and seeded, every screen frame carries a SIMULATED tag, nothing costs money (house tokens
only, no price or purchase path anywhere), and the player's menu is alcohol-free.

- **First, the merge and the re-measure (O1).** Every row of "Lot 57's numbers" was read again at 47c71a6. **L17
  moved, and it broke the bar's page:** Lot 57's `Hud` now binds P1b's caption, reply chips, order and holding chip
  and order sheet (`caption`, `chips`, `reply0`, `reply1`, `status2`, `status2Text`, `order`, `orderTitle`,
  `orderWho`, `menuItems`) in its constructor without null checks, so S1's committed `sportsbar.html` would throw at
  `new Hud()` after this merge. S2a's page carries them (and uses the order sheet, the captions and the chip). L3 and
  L12 gained additive members (`ParkedCars.nearDist`, a give-way rule in Lot 57's page; `computeFree`'s optional
  people); every other row is unchanged, so no sum moved. Contracts: additive (`Player`'s `Goal` and `onArrive`, which
  S2a's queue uses; `Collider.see`; `Venue.counters`). `people/` unchanged since ab9fbe1, so O2 holds. The Retro module
  is still uncommitted (`style.ts` 9bfd9da822 in `tsu-modes`, also in a WIP snapshot on `origin/claude/wip-modes`, not
  on `claude/modes`). The plan's tables carry the moves.
- **What was built** (new: `src/onfoot/engine/sim/` rng, needs, objects, tv, leagues, broadcast, held, clips and
  tokens; `venues/sportsbar/` life, crew, menu and objects; `tests/sportsbar-s2a.mjs`, `tests/sportsbar-sim.mjs` and
  `tests/onfoot/sportsbar-blocklist.json`; changed: `venues/sportsbar/hud.ts`, `sportsbar.html`, and 17 lines of
  `venues/sportsbar/main.ts`, kept small and local for the parallel lane that makes it mountable; 2,641 lines of
  TypeScript in the new and rewritten modules). The page is now 1,502 KB (503 KB gzipped), 107 KB more than S1's:
  - **Needs, mood, moodlets, emotion, personality** (`engine/sim/needs.ts`), the plan's formulas term by term: the five
    shown needs and the NPCs' hidden bladder, the rates while doing things, the trait multipliers, mood = 20 + 0.6 x
    the weighted average + the moodlets, the moodlet table (fading linearly), and the emotion order.
  - **Smart objects** (`engine/sim/objects.ts`, `venues/sportsbar/objects.ts`): the catalogue's 41 adverts in 15 types,
    every placed object with its layout slots, reservations, and the action queue (up to 3; tap an icon to cancel;
    moving the stick cancels the walk). The pool tables, dartboards and shuffleboard are in the catalogue but not
    offered until S2b.
  - **Ordering** (`venues/sportsbar/life.ts`, `crew.ts`): at the counter (a bartender on the lane path makes a drink in
    4 to 8 s and hands it over; food goes to the kitchen, 60 to 180 s, and the server brings it) and table service at
    booths, high-tops and patio tables (the server sets off to arrive 30 + 60 x the crowd share seconds after the call,
    takes the order in 8 s, fetches it from the pick-up or the pass, brings it). Lot 57's order sheet shows our menu
    ("You drove here, so your drinks are alcohol-free. On the house."). You hold a drink in the right hand and food in
    the left (the corners of the first-person view); sips every 40 to 70 s (+7 thirst, 6 a drink), eating at +10 a
    minute until the basket is eaten; empties go on the nearest table and the server buses them. Two staff, in our
    night-violet polo with a lime trim, built by the people builder at LOD 1.
  - **The screens** (`engine/sim/tv.ts`, `broadcast.ts`, `leagues.ts`): both fictional leagues with their teams and
    colours, the channel windows and kick-off slots, the featured match and `gameNight` exactly as the plan's tables,
    the match models (Marigold chances, gridiron possessions), highlights (the previous match day's before a day's
    first final whistle and on Tuesday), the broadcast pictures (pitch, field, score bug, GOAL and TOUCHDOWN banners,
    half-time and full-time cards, up-next cards, the SIMULATED tag in every frame), the TV chip, the guide card with
    code-drawn crests and "Pick a side". **One deviation, for the budget:** the three channels are cells of one canvas
    texture, so the twelve screens are one mesh and one draw call (the venue's test-card batch is hidden; the calls
    are unchanged); Low draws 512 x 288 a channel at 8 Hz, HD and Ultra 1024 x 576 at 15 and 30 Hz.
  - **Watching** (x1.6 only while the featured match is in play on the screen watched), **the jukebox** (fun +6, 20 s,
    a toast naming a KFWY track; no audio yet), **the water station** (thirst +20, 15 s), **the dance spot** on game
    nights (you only; three dances, changing every minute).
  - **Held items** (`engine/sim/held.ts`): the six instanced meshes (glass, basket, disc, ball, band, stick),
    `frustumCulled = false`, casting into the sun's map only, lit by the interior's baked channel.
  - **The clip layer** (`engine/sim/clips.ts`): drink, eat, sway, two-step, arm pump, cheer, groan and clap as an
    external pose layer by bone name (and the staff's own wipe), with an upper-body overlay for seated people.
  - **The player's UI** (`hud.ts`, `sportsbar.html`): the needs strip (five rings with icons, the low word under a ring
    under 30, the mood face and the emotion), the needs panel (bars with the word and the number, the moodlets, the
    tokens and their label, tonight's three, "Saved on this device only"; two columns on a short landscape phone), the
    queue icons, the radial menu (up to six pills, keys 1 to 6, LB on the gamepad), the Cheer button for 8 s after a
    goal or touchdown, the tired prompt under 10 energy, a text size setting, the TV chip and the guide.
  - **Tokens and saving** (`engine/sim/tokens.ts`): 50 on the first visit, 1 per 5 minutes in the bar (at most 12),
    5 per goal of tonight's three; saved under `oc.onfoot.sportsbar.v1`, every access wrapped.
  - **Hooks:** `needs`, `setNeeds`, `setTraits`, `mood`, `use(objectId, action, item?)`, `queue`, `tv(day?, week?)`,
    `setWeek`, `setTimeScale`, `fastForward`, `tokens`, and for the suite `offers`, `held`, `orders`, `staff`, `items`,
    `itemsAtCap`, `catalogue`, `tvAt`, `tvFrames`, `clipTest`, `saveNow`, `radial`, `openNeeds`, `openGuide` and more.
- **Checks** (headless Chromium with SwiftShader, one browser at a time, the machine shared at a load of 5 to 8):
  - `node tests/sportsbar-sim.mjs` (no browser): **29 of 29 passed.** The decay over 10 sim minutes standing equals the
    formula at outgoing 0, 0.5 and 1 (hunger 62, thirst 54, fun 58, social 64, 60 and 56, energy 66); every rate while
    doing things; mood 80 at full needs, 20 empty, 57.35 at the seeded average (= 20 + 0.6 x 62.25), 44.51 after 20
    minutes alone (the plan: 44.5); the featured match each day; the same seeds giving the same fixtures from two
    schedules built apart; in week 43, 49 Marigold matches averaged 2.35 goals and 4.20 big chances (the plan: about 2
    and 4), 25 gridiron games 2.84 touchdowns (the plan: 2.5); gameNight and the x1.25 window; the blocklist (21 names
    against 552 entries, no match).
  - `node tests/sportsbar-s2a.mjs --only=checks` (1280 x 720, Low): **16 of 16 passed**
    (`tests/out/sportsbar/logs/s2a-checks-1.log`, and again on the final build, after the look fixes below:
    `s2a-checks-final.log`, 16 of 16). The page boots with no console errors. The needs decay at the
    table's rates through the page (every need within 0.01 of the formula at all three outgoing values). Mood 80 Happy
    at full needs; 57.35 Fine at the seeded average. The jukebox gave fun +4.6 over 1.5 min with the walk (+6 less
    the walk's decay); the water station thirst +17.6 (+20 less it). Dance offered at Friday 20:26, Saturday 21:00 and
    Saturday 01:59, not at Friday 20:24 or Thursday 21:00, and you dance. Watching: fun +8.00 in 2 min while the
    featured match was in play (x1.6), +5.00 for the 21:00 match (not featured) and +5.00 on highlights. A drink at the
    bar: the walk, the wait ("making"), the hand-over within 12 sim seconds, then thirst 40 to 57 in 2.5 min (3 sips).
    Food at a high-top: seated, the server came from 7.8 m to 0.8 m, the wings arrived after 3.5 sim minutes, hunger
    +9.2 in a minute. Items: per instance glass 19, basket 20, disc 16, ball 32, band 16, stick 12 at Low and 40, 44,
    31, 128, 32, 24 at HD and Ultra, every one within its row; no new mesh in the scene after ordering, holding and
    leaving empties. The featured match each day as the plan's table, x1.25 only inside its window (checked a minute
    either side of both ends), every other fixture not featured. Highlights: "Monday's highlights" on Tuesday,
    "Friday's" on Saturday at 11:00, "Today's" at 13:00. The same clock gave the same fixtures twice; 204 channel frames
    drawn, none without the SIMULATED tag and none with the word "live"; 1,689 canvas strings, none with "live" or a
    betting or currency word. The menu: 15 items, all alcohol-free, no price field; 41 adverts. The clip layer:
    `people/` untouched; each of the nine clips turned its bones at LOD 2, 1 and 0 (a LOD 0 built in 5.4 s here).
  - `--only=save` : **2 of 2.** Saving round-trips (a second page: visits 1 to 2, the team and the regulars' seed kept);
    with `localStorage` throwing, the page boots clean and plays, and keeps nothing.
  - `--only=budgets` (844 x 390, Saturday 21:00, the six item models at their caps, the two staff in the room): **17 of
    17.** At every pose and preset the pass is inside the sums' column and the pass less the people and items inside
    the "without people or items" row; the items are 6 calls, 5.7k at Low and 13.9k at HD and Ultra (rows 6.0k and
    14.1k); the staff 2 calls, 14.4k at Low and 22.0k at HD and Ultra. The passes: Low 73 to 108 calls and 89.4k to
    166.9k (stall the most); HD 74 to 120 and 111.4k to 272.2k (overhead the most); Ultra 85 to 146 and 151.0k to
    618.9k (stall). The page's simulation took 0 to 0.1 ms a frame (`stats().simMs`; S3a's crowd isn't there yet).
    (`tests/out/sportsbar/logs/s2a-budgets-2.log`; every row is in `tests/out/sportsbar/sportsbar-s2a-checks.json`.)
  - S1's `honesty` and `closed` groups re-run on the S2a page (`node tests/sportsbar.mjs --only=honesty,closed`): **7 of
    7 passed** (`tests/out/sportsbar/logs/s2a-s1-regress.log`): no real name in the 169 files under `src/` or the page,
    no "live" outside the two allowed negations in 78 UI strings and 128 canvas strings, the closed-hours doors.
    S1's budgets check now subtracts the staff and the items with your avatar (they are people and items, which its
    row leaves out); S2a's own budget sweep above covers the same rows. S1's other groups weren't re-run in this pass.
- **Screenshots** (each looked at): the needs panel open at 390 x 844 and 844 x 390 (`s2a-needs-panel-*.png`; at 844 x
  390 the first try scrolled to its button and hid the bars, so the panel now has two columns there and opens at its
  top) and the strip (`s2a-needs-strip-*.png`); at 1280 x 720 HD the radial menu on the bar (Order a drink, Order food,
  Watch the bar screens) with the bartender behind the counter (`s2a-radial-bar-1280x720.png`), the order sheet
  (`s2a-ordering-1280x720.png`), holding a drink in first person (`s2a-holding-drink-first-1280x720.png`; the cup was
  made smaller and lower after the first look); the TV wall at the featured match's first goal, Saturday of week 43
  at 20:16 (Saltflat Terns, 12'), with GOAL banners on the big screen and the two channel-1 screens beside it
  (`s2a-tv-goal-1280x720.png`), and the guide card (`s2a-guide-1280x720.png`); a game-night dance at Saturday 21:00
  (`s2a-dance-1280x720.png`, the arm pump, the drink in the raised hand). Each clip on your avatar
  (`s2a-clip-*.png`, `s2a-clips-sheet.png`).
- **The clips, looked at (O33).** Cheer (arms up in a V) and arm pump read clearly; clap reads (the hands meet a little
  high, at the face); drink and eat bring the hand up to the chin (the first try only reached the chest: the sip now
  rises over 0.8 s in absolute time, and the elbow comes further forward); sway and two-step read only in motion (a
  still shows arms bent in front). Groan reads as hands behind the head more than hands on the head, with too little
  bow: shipped, and written up in `PROJECT_OC_HANDOFF.md` for the design review queue with the two dances.
- **Left open:** no audio yet (the jukebox's music, the room, the broadcast bed); the Watch camera drift; the
  first-visit "Tap people and things" hint; the autonomy setting (it needs S3a's utility AI); the player's team
  moodlets, the heater's +2, the low-need nudges and the tired prompt are built but no check exercises them; the
  people-dependent parts (chat, Lean and chat, cheering with others, rounds, three of tonight's goals) wait for S3a and
  S3b; Low still draws standard materials until the Retro module lands (S4); nothing has run on a phone.

## 2026-10-21: Stoppage Time S1, the venue and your avatar in it (a standalone page; built and re-verified through 2026-11-02, committed)

Phase S1 of `PROJECT_OC_SPORTS_BAR.md`, built on `claude/sports-bar` after merging Lot 57's committed P1a
(`claude/onfoot` ab9fbe1; merge commit ce67d8f, the only commit of this pass; the build itself is uncommitted, as the
workflow asked). Stoppage Time is our own fictional sports bar at the real site on South Claudina Way, Anaheim: our
name, look, interior and menu. The twelve screens show a still test card tagged "SIMULATED"; the crowd chip reads the
schedule's level ("Simulated crowd · Packed") and no people are built yet (S3a). Nothing on the page is live, nothing
costs money, and Ultra is an entitlement flag only (test hooks and `?ultra=1`; no price, no purchase path). Lot 57's
files (`src/onfoot/lot57/`, `main.ts`, `index.html`), `src/onfoot/people/`, the game's code and its configs are
unchanged.

- **First, the re-measure (open item O1).** Every row of "Lot 57's numbers, as measured" was read again at ab9fbe1.
  Moved, and updated in the plan with the commit and date: L2 (`ParkedCars` takes a fourth argument, `farDetail`), L3
  (12, 24 and 40 detailed parked cars), L5 (the far detailed cars don't cast), L7 (your car's lamps off), L9 (Lot 57's
  avatar LOD 0 now on High and Ultra, built at load), L11 (Lot 57 instances only palms now) and L20 (a slice-trimming
  plugin). L1 (`PRESET`), L4, L6, L8, L10, L12 to L19 and L21 are unchanged. No contract the bar relies on broke (the
  changes are additive). The `people/` internals (O2) are unchanged. The Retro module (O15) is still uncommitted on
  `claude/modes`; its API holds (`RetroWorld` gains an optional `sun`), so the bar's Low draws standard materials at
  full resolution until it merges. No sum moved. Both scripts re-run: they now compute the frame from building 61 as
  the page does, which moves one barrier-gate point 126 m out across the front sector's line (39 near points, 497 far;
  was 38 and 498).
- **What was built** (all new: `src/onfoot/sportsbar.html`, `src/onfoot/vite.sportsbar.config.ts`,
  `src/onfoot/engine/`, `src/onfoot/venues/sportsbar/`, `tests/sportsbar.mjs`, `tests/sportsbar-shoot.mjs`; 3,387
  lines of TypeScript, 141 of HTML):
  - **The page and its build.** `npx vite build --config src/onfoot/vite.sportsbar.config.ts` writes one file,
    `dist/sportsbar/sportsbar.html` (1,382 KB, 460 KB gzipped), which opens from disk. Its own config, so the game's
    and Lot 57's don't change; it trims the bar's slice to the fields the page reads at build time.
  - **The engine facade** (`src/onfoot/engine/`): re-exports of Lot 57's modules (never its data, coords or main), and
    the new `frame.ts` (the building frame, computed from building 61's ring: worst 0.065 m against the plan's
    table), `schedule.ts` (the business day, open and closed hours, the crowd share), `venue-def.ts`, `streets.ts` (the
    near and far street sets, the I-5's bridges and ramps under the bridge rule, the light streams) and `overhead.ts`
    (the overhead camera: pan, pinch, twist, 45-degree steps).
  - **The venue** (`venues/sportsbar/`): the bar and back bar, 12 screens, 2 pool tables, 3 dart boards, the
    shuffleboard, high-tops, booths, the patio with its pergola, heaters and planters, the front walk, ramp, bike rack
    and doors; 91 seats and 46 standing, watching, game and staff spots; 83 object colliders; the lot (55 stalls,
    your car and its 152-triangle stand-in, 7 pole lights, aisle 416 redrawn as ours); 6 palms and 4 shade trees at
    the script's spots.
  - **Views and controls**: first person, third person and overhead (the walls facing the camera cut away), tap to go
    and sit, stick and keyboard, the action button; the hours and closed doors from the schedule.
  - **Graphics**: Low (full resolution, no shadow map, the far set simple), HD (2048 sun map, bloom, 2 pool spot
    lights) and Ultra (4096 sun map, GTAO, bloom, rect-area and heater lights, the pool spots casting, the far set in
    full, the high-quality parked cars, your avatar's LOD 0 in third person). Inside, outside and overhead states set
    what's drawn (the parked cars near you, your car or its stand-in); your avatar casts through a hidden LOD 1 caster;
    the shadow maps are drawn once a frame.
  - **Hooks** on `window.__onfoot` (Lot 57's names and the bar's: `stats`, `breakdown`, `vis`, `pose`, `frame`,
    `layout`, `streetSets`, `bridges`, `crossings`, `peopleCosts`, `debug` and more).
- **Found by looking at the screenshots, and fixed in this pass:** white pendant shades, pergola light strips too
  bright by day, a white-looking oak, a violet facade that read black and a lot too dark at night; then, in the last
  round (before and after images in `tests/out/sportsbar/probe/`):
  1. **At Ultra the lot went near black at noon** under the lot lights' pools, and the mountains dark slate. GTAO's
     normal pass drew the pools and the game's mountain ring, which carry no normals, as surfaces facing nowhere. The
     AO pass now leaves out every mesh with no normals or no depth write. Before:
     `before-s1-shadow-ultra-first-lot-noon.png`, `before-s1-door-front-out-ultra-1200.png`; after:
     `probe-1280x720-ultra-down-a.png`, `probe-1280x720-ultra-a.png`. `stats().ao` now measures that pass as drawn,
     and the budgets check uses it.
  2. **At 844x390 on Low the lot drew as bare ground** from the spawn (not at 390x844 or 1280x720 from the same spot):
     the 3200 m ground quad beat the asphalt 4.2 cm above it on depth at that one view. The ground's material now has
     a polygon offset pushing it back. Before: `before-s1-844x390-low-spawn-noon.png`; after: `probe-844x390-low-a.png`.
  3. **The pool tables read black at night on Low.** They're their own meshes (for Ultra's pool spots), outside the
     kit, so they missed its night-light bake, and Low has no pool spots. The page now bakes them too. Before:
     `before-s1-844x390-low-door-night.png`; after: `probe-844x390-low-door-night.png`.
  4. **At 640x360 the hours pill ran under the view button.** Between 521 and 760 px wide it now drops the bar's name
     (`s1-closed-640x360-tue0930.png`).
  Lot 57's page shares 1 and 2; the handoff tells its owners (`PROJECT_OC_HANDOFF.md`, "For Lot 57's owners", items 3
  and 4). Open item O34 records both.
- **Checked** with `node tests/sportsbar.mjs` (headless Chromium, `--use-angle=swiftshader
  --enable-unsafe-swiftshader`, one browser at a time, on a shared machine at a load of about 15).
  Two runs make the record, both on this machine: run 2 (07:53 to 09:18 UTC, the whole suite, 138 of 139: the one
  failure was the cars check reading drawn triangles, since rewritten to count your car's whole body) and run 3 on the
  final build (closed, honesty, cars, budgets, shadows and shots again, after the four fixes above: 86 of 86 pass,
    09:40 to 10:09 UTC). The Ultra door crossings were run again on the final build too (run 4,
  `s1-run-4-cross-ultra.log`, 9 of 9 pass, 10:01 to
  10:10 UTC). The groups not run again (data, walks, seats, the Low and HD crossings, rates) test code the fixes don't
  touch; their numbers are run 2's. Results are merged into `tests/out/sportsbar/sportsbar-checks.json`; the logs are
  `tests/out/sportsbar/logs/s1-run-2.log` and `s1-run-3.log`. `npx tsc --noEmit` is clean.
  - **Boots with no console errors** at 1280x720, 844x390 and 390x844 (touch) and 640x360, at Low, HD and Ultra.
  - **The data** (all pass): the frame matches the building-frame table to 0.065 m over 5 points and the bar's point
    lands in our unit; the built near set is exactly the script's (streets 60, buildings 8, land use 0, water 0,
    infrastructure shapes 33, points 39; far 554, 417, 67, 18, 172, 497); 12 near batches plus 2 stream meshes (at most
    14 calls) and 4 far simple batches; the light streams only on the five near carriageway pieces (northbound 560 into
    362, 1,035 m; southbound 222, 358, 438, 974 m; lamps 0.6 to 8.2 m up); the I-5 drawn (five carriageway pieces 14 m
    wide, seven links 8 m); the bridge rule (98 piers built, 64 near; 33 left out, 19 near, as the script prints; 393
    connectors, worst height spread 0 m; 58 crossings without a junction all clear 5.5 m or lie in the 5 tunnels); the
    10 trees within 0.000 m of the script's spots in 4 instanced meshes; the front fits (walk 0.40 m, ramp 0.41 m, bikes
    0.81 m, planters 1.02 and 1.00 m, patio 1.88 m from aisle 416's ribbon; the ribbon 3.72 m from building 61); 12
    zones and 107 slots inside the walls, 14 patio zones and 30 slots inside the fence; nothing overlaps (26 zones, 137
    slots, 83 colliders; the shuffleboard's thrower 1.59 m from the first stool); walking on Lot 57's real grid at the
    page's offset, all 137 stand points within 0.413 m of a reachable cell, H 0.052 m, no reachable cell in the lane or
    the flap (11,641 cells reached); the lane path 16.32 m with least clearance 0.10 m; 6 walks at the counter's ends,
    the gate and the flap (1,440 positions) never in the lane; 55 stalls in 4 rows, fill bias 0.834.
  - **1,000 random walks** (500 tap-to-go, 500 stick; 1,068,196 positions over 25,822 m against 173 colliders): none
    ends inside a collider or crosses a wall, the patio fence or the party wall; the checker itself catches a path
    through the front glass, the party wall, the fence and a pool table.
  - **Seats:** tap to go reaches all 91 seats from just inside the front door and sits you down (paths up to 34.93 m);
    sit and stand work on a stool, a high-top, a bench and a picnic seat.
  - **Closed hours** (Tue 09:30): both doors locked, a tap inside from the front walk has no path, the walk to your car
    arrives; the pill reads "Tue 09:30 · Closed · opens 11:00" and the chip "Simulated crowd · Closed".
  - **Honesty:** the real name nowhere in `src/` or the built page (150 files); no "live" on any canvas (35 strings) and
    only inside the allowed negations in the UI (49 strings, every sheet opened); no places file and no part of Lot 57's
    slice in the page, the bar slice's own description in it; the chip and the credit on screen at 1280x720.
  - **The door crossings** at Low, HD and Ultra, both doors, first and third person (162 steps each): the state flips
    on the crossing frame (step 49 first person, 151 third); the 14 near and 4 far (15 at Ultra) street meshes and the
    4 tree meshes are the same on both sides; the sun's casters are the same (40 at HD, 44 at Ultra); the only swaps are
    the parked cars near you (0 to 4, 12 and 36) and your car (stand-in to detailed at Low and HD; detailed on both
    sides at Ultra).
  - **The budgets without people or items** at the five poses (844x390, and `door` and `overhead` at 390x844), Saturday
    21:00, all pass: `stats().pass` less your avatar's own body is inside the row at every pose, `breakdown()` agrees
    with the pass within 1%, and one frame's `renderer.info` is the pass, the AO pass at Ultra, each map once and the
    post. The worst of each preset (pass less your avatar, of the row): Low 99/136.3k of 119/177.8k outside (`stall`)
    and 71/67.0k of 74/101.4k inside (`tv-east`); HD 111/223.6k of 139/328.2k (`overhead`) and 71/73.1k of 94/174.4k;
    Ultra 120/426.2k of 159/611.4k (`overhead`), 117/421.9k (`stall`) and 99/223.4k of 139/415.4k inside. Whole frames:
    Low 62 to 100 calls and 62.8k to 144.1k; HD 107 to 187 and 128.5k to 446.4k; Ultra 258 to 355 and 405.9k to
    1,525.4k (the sun's map 33 to 67 calls and 83.3k to 372.4k; each pool spot's map 22 to 27 calls and 228 triangles,
    frozen outside; the AO pass 59 to 117 calls; post 14 at HD, 18 at Ultra). Your avatar's caster drops the sun's map
    by 11,762 triangles at every HD and Ultra pose. The street sets come to 18 calls and 38.1k at Low, 18 and 38.5k
    at HD, 29 and 78.2k at Ultra (allocated 20/35k, 30/60k and 40/120k): the streets run 3.1k over Low's allocation,
    the venue 33.5k under its own (16.5k of 50k), and no pose's pass leaves its row, so no fallback was taken. (The
    review held this against S1: the plan's check says all the streets within their row. The repair below moved 5k of
    Low's venue row to its streets', 45k and 40k, and the suite now checks it.)
  - **Rates** here (844x390, the `door` pose; SwiftShader on a shared machine at a load of about 15, not a phone):
    after a switch, 3 warm-up frames took 6.4 s at Low, 8.6 s at HD and 19.0 s at Ultra, then 1.06, 0.55 and 0.30 frames
    a second, the page's own CPU 1.5, 4.1 and 9.2 ms a frame. Load to walkable: 11.5 to 14.8 s at Low.
  - **The people builder** (open item O3, `peopleCosts()`): an NPC at phone quality 1,136, 6,651 and 58,541 triangles
    at LOD 2, 1 and 0 (LOD 0 18 calls, built in 8.2 s), at high quality 1,136, 10,105 and 139,943 (11.5 s); your driver
    at phone 1,508, 7,810 and 66,693 (19 calls, 6.4 s), at high 1,508, 11,762 and 158,252 (8.7 s).
  - **Your avatar's shadow** at HD and Ultra, first and third person, in the lot and on the front walk at noon (the
    sun behind the camera): all pass. The sun's map drops by 11.8k triangles when the caster's `castShadow` is turned
    off; in first person the avatar draws 1 call and 0 triangles in the pass (the hidden caster); at Ultra in third
    person the LOD 0 shows (21 calls, 158,372 triangles) and only its hidden LOD 1 casts. The shadow shows in the four
    first-person shots (`s1-shadow-{high,ultra}-first-{lot,walk}-noon.png`).
  - **The cars as measured:** your car (the default) 62.2k triangles in 25 meshes at Low and 118.3k at HD and Ultra;
    the parked cars near you at the `stall` pose 4 detailed and 39 stand-ins, 17.4k in 13 calls at Low (cap 17.4k), 12
    and 31, 33.5k in 17 calls at HD (cap 39.3k), 36 and 7, 201.1k in 20 calls at Ultra (cap 202.7k); switching between
    HD and Ultra rebuilds the same 43 cars in the same stalls (13 sedans, 16 SUVs, 2 coupes, 8 pickups, 4 vans, same
    colours). The other three of your four cars were not measured (the plan's "never over 65.6k and 121.1k").
  - **Screenshots** (all in `tests/out/sportsbar/`; every one cited here was looked at). The phase's set, from run 3's
    final build: 1280x720 at HD, noon and Saturday 21:00, `door`, `bar`, `tv`, `pool`, `spawn`, `patio` (third
    person), `overhead` (walls cut away), `exterior`, `freeway` (from the patio rail) and `katella` (a fixed camera on
    the I-5 bridge from East Katella) (`s1-1280x720-high-*-{noon,night}.png`, 20); 844x390 at Low, `door`, `spawn`,
    `patio`, `overhead`, `exterior`, noon and night (`s1-844x390-low-*.png`, 10); 390x844 at Low, `door`, `spawn`,
    `overhead`, noon and night (`s1-390x844-low-*.png`, 6); 1280x720 at Ultra, `door`, `patio`, `exterior` at night
    (`s1-1280x720-ultra-*-night.png`, 3); closed hours at 640x360 (`s1-closed-640x360-tue0930.png`); the honesty
    shot (`s1-1280x720-spawn-night.png`); the 8 shadow shots; and the door crossings, both doors, inside and out, noon
    and night, at each preset (`s1-door-{front,patio}-{in,out}-{low,high,ultra}-{1200,2100}.png`, 24; the Ultra eight
    shot again on the final build, below). Run 3's 39 phase shots were compared pixel by pixel with run 2's, which
    were all looked at: the 13 that changed in more than 0.2% of their pixels were looked at again (the fixes show
    where expected: the lot's asphalt at 844x390, the pool tables at night, the Ultra night shots); the other 26
    differ in under 0.2% of their pixels. The Low and HD door-crossing shots are run 2's.
  - **Does it read as a believable neighbourhood sports bar in a SoCal strip?** S1 said yes, to this eye: a violet
    unit with a lit wordmark over a glazed front, a long oak bar with a back bar of bottles under a row of screens, two
    pool tables under long shades, booths and high-tops, a pergola patio with heaters by the I-5, palms and a striped
    lot. **The review found what that look missed** (in S1's own overhead shots, and by trying to break the page):
    the brand neon over the restrooms was mirrored and read "ball, backwards 3, plus"; the three dartboards were
    invisible (each board's face sat inside its black backboard's box, so the darts zone showed three black
    rectangles); the chalk centre circle wasn't drawn at all (its quads faced down: the frame's (u, v) mirrors
    three.js's (x, z), so a quad's corner order alone didn't say which way it faced; the oche line was the same); the
    ceiling was a black void at noon and at night (one cap in near-black paint), reading as a room open to a black
    sky; and the pool tables were plain boxes with a felt inset (their pockets were tiny boxes buried inside the rails).
    **All five are fixed in the repair below** and were looked at in the repair's shots: the neon reads "+3" and the
    ball, the boards show their faces, the circle, its spot and the halfway line are drawn, the room has a pale
    suspended tile ceiling on a dark T-bar grid with diffusers, and the tables have rails, cushions, six pockets and
    diamond sights. Still weak, for S3a and S4: no people, the night outside very dark beyond the lamps, and the
    ceiling's tiles read a little warm under the interior light.
- **The repair after review (same day, 12:00 to 17:00 UTC; the first pass was cut off at about 14:17 when the machine
  restarted, mid-way through its last suite run, and a second pass finished it).** Two reviews rejected S1 on defects its checks
  didn't cover (the play review: the neon, the dartboards, tap to go, the chalk circle, the ceiling and the pool tables;
  the code review: the light streams, disposal, a never-drawn pool-spot map, per-frame allocations and Low's streets
  row). Every item was fixed, as asked, keeping the rest:
  - **The neon** over the restrooms (`venue.ts`): a viewer facing +v has +u on the left, so the glyphs are now laid
    out mirrored about the board's centre (u 29.06): "+3" then the ball. Before and after, cropped from the overhead
    shots: `tests/out/sportsbar/probe-r2/before-overhead-neon-crop.png` ("ball, backwards 3, plus") and
    `after-overhead-neon-crop-r2.png` ("+3", ball); the close-up `s1-1280x720-high-neon-{noon,night}-r2.png`.
  - **The dartboards:** each face moved 1 cm in front of its backboard (v 15.69; the backboard is v 15.70 to 15.75).
    New check (data group): a ray from each oche point at bullseye height meets `bar-signs` first, at 2.31 m, before
    `bar-paint` at 2.32 m, at all three boards. Shot: `s1-1280x720-high-darts-{noon,night}-r2.png`.
  - **Tap to go from the customer side** (`main.ts`, `tapGo`): a tap whose point or ray lies inside the unit but not on
    free floor now goes to the nearest free cell that is also inside, within 4 m of the tapped point (on your side of
    it when there's one there); with none, the "Can't get there from here" toast. The review asked for 3 m. Built
    exactly that way, the data group refused three of the review's own seven test taps (the bottle wall from u 18 and
    from u 22, and the screen over u 18.7: nothing free inside within 3 m, since the tapped points lie at v 15.49 to
    15.67 and the nearest free cells on the customer side at v 12.27 to 12.45, past the 2.5 m-deep bar and the stools'
    clearance; `tests/out/sportsbar/logs/s1-r2-tap-3m-probe.log`, about 15:45 UTC), so the radius is 4 m: the seven
    taps snap 1.31, 2.63, 2.99, 3.00, 3.09, 3.16 and 3.25 m. (The first pass of this repair also walked back along
    your line of sight, with no limit, when nothing lay within 4 m; that fallback is gone, so beyond 4 m a tap is
    refused, as the review asked.) New check (data group): the seven taps from the customer side (the bottle wall at u
    18 and 22 and at an angle from u 10, three bar screens, the counter top) each snap within 4 m and end inside, on
    the customer side, 0.54 to 1.03 m from the counter's edge (S1 walked the first out of the front door to the
    courtyard at u 17.7, v 16.9); `tapLook()` now reports each tap's snap.
  - **The chalk centre circle and the oche line:** every floor quad in `venue.ts` is now wound to face up whatever the
    frame's handedness (`fquad` uses `quadTo` with an up vector); the marks' material already had a polygon offset
    over the floor's (-4 against -2). Shot looking down from 2.75 m at (33.5, 4.75): `s1-1280x720-high-circle-noon-r2.png`
    (the circle, its spot and the halfway line).
  - **The ceiling:** a suspended acoustic-tile ceiling, pale violet-grey (`0x8c8698`) subdivided so the baked light
    reads on it, with a little interior glow of its own (dark when closed), on a dark T-bar grid (2 x 4 ft) with eight
    square diffusers, all in the existing `unit-ceiling` batch (no new call; hidden overhead as before). Shots:
    `s1-1280x720-high-ceiling-{noon,night}-r2.png` and every interior shot.
  - **The pool tables:** oak rails round a night-violet bed, cloth cushions broken at the pockets, six black pocket
    mouths through the rails' tops and 18 mother-of-pearl sights; 684 triangles a table and lamp (was 228), in the same
    two meshes. Shots: `s1-1280x720-high-pool-{noon,night}-r2.png`, `door`.
  - **The light streams** (`engine/streets.ts`): `update()` takes the preset's car count and shares it over both
    chains by length (Low 100: northbound 52, southbound 48; HD 200: 103 and 97; Ultra 400: 206 and 194); the page's
    clamp after it is gone. New check (data group) at all three presets; shots `s1-1280x720-high-freeway-night-r2.png`
    and `s1-844x390-low-freeway-{noon,night}-r2.png`.
  - **Disposal on a switch** (`main.ts`): the post chain's passes before the composer; the far set's old geometries
    (`rebuildFar`); the old trees' instanced meshes; your old car's geometries and its own materials; and three leaks
    the new check found beyond the review's list: Lot 57's `ParkedCars.dispose()` leaves each set's model geometries
    and stand-in material (25 geometries a rebuild), the people builder's `dispose()` leaves the skeleton's bone
    texture, and the game's `Environment.rebuildEnv()` frees its PMREM texture but not the render target (one 768 x
    1024 target every clock change). The page frees all three itself (the files are unchanged; `PROJECT_OC_HANDOFF.md`,
    "For Lot 57's owners", items 5 to 7). New memory group: Low, HD, Ultra, HD, Low twice with a pose each; before
    the fixes each round added 6 textures and 50 geometries; now the first round leaves 28 textures and 1 geometry more than the
    start, which a debugging pass traced to what the game keeps on purpose (the car builder's cached high-quality
    maps, about 19 data textures; 9 canvas and small data textures made at load and first drawn at HD; the sun's 2048
    map, which the game's environment keeps allocated at Low), and the second round comes back to exactly the first's
    50 textures and 97 geometries (the check).
  - **Ultra's pool-spot maps** (`visibility.ts`): a spot frozen before its map was ever drawn is drawn once on the next
    frame (`needsUpdate`), so an Ultra page that opens outside doesn't sample an empty map through the glass.
  - **Per-frame allocations:** `poseDoors` (venue.ts: its THREE objects made once, and each leaf's line along its wall
    worked out at build, so the leaves' wall points are no longer arrays made a frame), `setOverheadCut` and
    `nearPoint` (main.ts), `BarInput.takeOver()` (two tap lists that swap) and your avatar's key (four fields compared)
    allocate nothing a frame now; so do two more found on the way, the doors' approach test (the doors' centres in
    local metres, worked out once) and `visibility.ts`'s state test (the camera's frame coordinates inline).
  - **Low's rows** (the plan, "The allocations"; O4): the fallback (dropping the near set's markings, 2.4k) would have
    left the streets at about 35.7k, still over 35k, so 5k moved from Low's venue row to its streets' (45k and 40k; the
    near set's rows at Low and HD to 16k); the sums and the "without people or items" rows don't move.
    `venues/sportsbar/def.ts` carries the rows (`ALLOC`); the data group checks all the streets as built at every
    preset (Low 18/38.1k of 20/40k, HD 18/38.5k of 30/60k, Ultra 29/78.2k of 40/120k) and the budgets group the
    venue, the streets and the trees as drawn at every pose.
  - **Checked** on the final build with the whole suite in one run, one browser: `node tests/sportsbar.mjs --tag=r2`
    (`tests/out/sportsbar/logs/s1-r2-final.log`, 15:48 to 16:58 UTC, the machine at a load of 7 to 13). **156 of 156
    pass.** The merged results file (`tests/out/sportsbar/sportsbar-checks.json`) was started afresh for this run, so
    it holds this run alone (the earlier file, with S1's and the first pass's results, is kept as
    `logs/sportsbar-checks-before-r2-final.json`). The built page was then rebuilt from the final sources and is
    byte-identical to the one tested (sha256 91fc2216...e58f8); `npx tsc --noEmit` is clean. The first pass's runs
    (`s1-r2-run-1.log` to `s1-r2-run-3.log`, 12:54 to 14:16) are superseded: they tested a build before the tap rule's
    final form and the last allocation fixes, and run 3 died with the restart. What the run shows:
    - **The data** (19 checks): all of S1's, as before (the frame 0.065 m; the near and far sets exactly the script's;
      the bridge rule; the trees; the front; the zones and slots; nothing overlaps; the real grid; the lane path; the
      stalls), and the repair's four: the darts (each oche's ray meets the board's face at 2.31 m, before `bar-paint` at
      2.32 m), tap to go from the customer side (seven taps, snaps 1.31 to 3.25 m, each ending inside 0.54 to 1.03 m from
      the counter's edge), the light streams at Low, HD and Ultra (100, 200 and 400 cars; northbound 52, 103 and 206,
      southbound 48, 97 and 194, by the chains' 1,035 and 974 m), and all the streets as built within their rows (Low
      18/38.1k of 20/40k, near 14/14.7k of 14/16k; HD 18/38.5k of 30/60k, near 14/15.1k of 14/16k; Ultra 29/78.2k of
      40/120k, near 14/15.9k of 15/25k).
    - **1,000 random walks** (500 by tap to go, through the 4 m rule; 1,068,196 positions over 25,822 m): none ends in a
      collider or crosses a wall, the fence or the party wall (1 tap had no path, 499 arrived); **seats:** all 91
      reached and sat in; sit and stand on each kind; **closed hours** and **honesty** as before (150 files clean; 35
      canvas and 49 UI strings clean; no places file or Lot 57 slice in the 1,357 KB page; the chip and credit on
      screen).
    - **The door crossings** at Low, HD and Ultra, both doors, first and third person: the state flips on the crossing
      frame (step 49 and 151); the same 14 near and 4 far (15 at Ultra) street meshes and 4 tree meshes on both sides;
      the same 40 (HD) and 44 (Ultra) sun casters; the only swaps the parked cars near you (0 to 4, 12 and 36) and your
      car (stand-in to detailed at Low and HD).
    - **The budgets** at every pose and preset, the same figures as the first pass: the venue 35 to 39 calls and 17.1k
      to 19.1k; each pool spot's map 684 triangles; the worst pass less your avatar Low 99/138.9k of 119/177.8k
      (`stall`), HD 111/224.5k of 139/328.2k (`overhead`), Ultra 120/427.1k of 159/611.4k (`overhead`); whole frames
      Low 62 to 100 calls and 65.4k to 146.7k, HD 107 to 187 and 132.0k to 448.2k, Ultra 258 to 355 and 413.0k to
      1,531.6k; post 14 at HD and 18 at Ultra; your avatar's caster drops the sun's map by 11,762 at every HD and Ultra
      pose; `breakdown()` within 1% everywhere.
    - **Rates** (844x390, `door`): after a switch, 3 warm-up frames 2.0 s at Low, 2.8 s at HD and 4.5 s at Ultra, then
      1.04, 0.76 and 0.39 frames a second, the page's CPU 1.6, 7.6 and 7.1 ms a frame; load to walkable (`buildMs`)
      7.6 s at Low. SwiftShader on a shared machine, not a phone.
    - **Shadows** at HD and Ultra, first and third person, lot and front walk at noon: all pass as in S1 (the sun's map
      drops 11.8k with the caster off; 1 call and 0 triangles in the pass in first person and under Ultra's LOD 0, 21
      calls and 158,372 triangles for the LOD 0 itself); new: an Ultra page opened outside has both pool spots' maps
      frozen and drawn once (`vis().poolSpots[].drawn`).
    - **Cars** as in S1 (your car 62.2k and 118.3k; parked 17.4k, 33.5k and 201.1k under their caps; the same 43 cars
      after a switch); **memory:** Low, HD, Ultra, HD, Low twice: 22 textures and 96 geometries at the start, 50 and
      97 after the first round (the caches above), and 50 and 97 again after the second (no growth); **Lot 57's page**
      still builds with its own config (1,069.80 kB).
  - **Screenshots**, all with `-r2` names in `tests/out/sportsbar/`, all from this run, every one looked at (the door,
    shadow, Low and Ultra-outside sets through contact sheets of two to six; the rest one by one): 1280x720 at HD,
    noon and Saturday 21:00, the phase's ten views and the repair's four
    (`s1-1280x720-high-{door,bar,tv,pool,spawn,patio,overhead,exterior,freeway,katella,darts,neon,circle,ceiling}-{noon,night}-r2.png`,
    28); 844x390 at Low, with the freeway view (`s1-844x390-low-{door,spawn,patio,overhead,exterior,freeway}-{noon,night}-r2.png`,
    12); 390x844 at Low (`s1-390x844-low-{door,spawn,overhead}-{noon,night}-r2.png`, 6); Ultra at night
    (`s1-1280x720-ultra-{door,patio,exterior}-night-r2.png`, 3); the closed and honesty shots
    (`s1-closed-640x360-tue0930-r2.png`, `s1-1280x720-spawn-night-r2.png`); the 8 shadow shots
    (`s1-shadow-{high,ultra}-{first,third}-{lot,walk}-noon-r2.png`) and the 24 door shots
    (`s1-door-{front,patio}-{in,out}-{low,high,ultra}-{1200,2100}-r2.png`). Before and after, in
    `tests/out/sportsbar/probe-r2/`: the neon cropped from the overhead (`before-overhead-neon-crop.png`, S1's: "ball,
    backwards 3, plus"; `after-overhead-neon-crop-r2.png`, cropped from this run's `overhead-noon`: "+3", ball), and
    the I-5 from 90 m over the lot at 21:00 on HD (`before-1280x720-high-i5-night.png`, S1's build: one line of lights
    on the northbound carriageway; `after-1280x720-high-i5-night-r2.png`, the first pass's build, whose streams code
    is the final one: both carriageways). From the patio rail (`freeway-night`) the trees and the pergola hide most of
    both carriageways and the lights read as one dotted band; at Low (no bloom, 100 cars) they are a few faint specks
    on the horizon. **Looked at for the brief's question again:** the boards show their faces; the neon reads "+3"
    and the ball; the circle, its spot and the halfway line are on the floor; the room has a pale tile ceiling on a
    dark grid with diffusers, at noon and at night; the pool tables have rails, pockets and sights. With those, the
    inside reads as a finished SoCal strip-mall sports bar at noon and at night, and through the glazing from the lot
    at night (the lit ceiling and the screens show from outside). Left for S3a and S4: no people, the night outside
    very dark beyond the lamps, the doors' leaves caught mid-slide in some shots, the tiles a little warm under the
    interior light, and the water station by the restrooms still a plain white box.
- **Lot 57 is unaffected.** Its page still builds with its own config (`dist/onfoot/index.html`, 1,069.80 kB), its
  files are untouched (`git status` shows no change under `src/onfoot/lot57/`, `main.ts`, `index.html` or `people/`),
  and its own suite passes unchanged: `node tests/onfoot.mjs` on its build, 35 of 35 (10:17 to 10:34 UTC;
  `tests/out/sportsbar/logs/lot57-suite-s1.log`), and again after the repair, on its page as the bar suite's `lot57`
  group rebuilt it from the final sources, 35 of 35 (17:00 to 17:28 UTC, at a load of about 14;
  `tests/out/sportsbar/logs/lot57-suite-s1-r2.log`, details in `tests/out/onfoot/onfoot-checks.json`).
- **Left open** (each in the plan's Open items table or the handoff):
  - **Retro** (O15): `claude/modes` hasn't merged, so Low is the standard materials at full resolution; S4 turns the
    Retro look on.
  - **Phones** (O30): nothing has run on a phone; every rate here is SwiftShader on a loaded shared machine.
  - **Low's streets** (O4): closed by the repair below (the rows re-allocated, the venue 45k and the streets 40k at
    Low, and the suite checking them).
  - **The night outside** reads very dark beyond the lamps (the front lot, the street, the freeway view); the doors'
    leaves are caught mid-slide in the door shots (a leaf takes 0.45 s to open and the page steps at most 0.1 s a frame,
    so a shot taken a few frames after a pose catches it moving). Both are for S4's light and look pass.
  - **Your car's other three bodies** weren't measured (only the default).
  - **Lot 57's `PRESET`** (L1) is re-synced again at S4 (O1).
  - **Lot 57's copies** of the GTAO and ground-depth flaws (O34) and of the two shadow flaws (O28) are its owners'.

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

## 2026-10-21: the sports bar's site data and plan (Phase 0)

The owner asked for a playable Sims-like world at the Lopez & Lefty's site in Anaheim. We build our own sports bar
there, under our own name, with no real business's name, menu or look, and only fictional leagues and teams on the TVs.

- **Kept: the site data.** The Anaheim tools now take a `sportsbar` venue next to Lot 57 and produce the bar's street
  slice, places and freeway link from OpenStreetMap via Overture. A reviewer re-ran both pipelines in scratch copies:
  Lot 57's outputs are byte-identical to before (verify 12 of 12), and the bar's outputs reproduce byte for byte
  (verify 13 of 13).
- **Kept: the design plan** (`PROJECT_OC_SPORTS_BAR.md`), after a seventh pass. This round fixed all twelve items the
  round-6 review listed and added an "Open items for the builders" section near the top: every known gap or unchecked
  claim, with how and in which phase it gets resolved. Lot 57's parts are now described as contracts (names and what
  they promise), and every number read from Lot 57's code is marked with when it was measured; the first build step
  re-measures them. A reviewer checked the plan's three.js claims line by line against the installed library and re-ran
  both check scripts with matching results. Both reviewers accepted the plan; building phases S1 to S4 comes next.

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
