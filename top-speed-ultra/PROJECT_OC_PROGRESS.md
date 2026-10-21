# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-10-21 (afternoon): light traffic while live, the welcome card's real bug, and the online board

The owner resumed the loop ("keep going til everything is finished") with a 75% usage checkpoint (pause, assess, ask).

- **Computer traffic stays light while driving live** (decision 18). Presets are capped at Light with no aggressive
  drivers; Live traffic keeps its rush hour scaled into 1.2 to 3.5 cars per km per lane; the HUD says "light while
  live". Browser (`live` group, realistic-mode check): I-405 North at a flow ratio of 0.89 gave 1.5 cars/km/lane,
  bold 0, HUD "Live traffic · simulated · typical day · light while live"; Heavy while live 2.2, live off 9, back on
  2.2.
- **The welcome card was under the menu.** The invite-link greeting rendered before the menu, so the menu's buttons
  took the taps: a new player saw the card but couldn't use it. Found by the `livephone` check (Playwright: "Settings
  from the menu intercepts pointer events"); the card now renders after the menu, and the check asserts the Sign up
  button is the topmost element where a tap lands. The check's earlier timeouts were the test's own in-page waits
  stalling on a second loaded phone; it now polls from the test side. `livephone` 7 of 7.
- **The online board** (built by the hypercar lane's Fable agent on `claude/live-board`, reviewed, merged and wired
  here): `live/board.mjs` ranks distance, the speed held for 3 s and the longest unbroken drive per Pacific day from
  relay-accepted poses only; `GET /api/board`; the menu's Online board panel. Server test: a 4.5 s drive at 30 m/s
  read ~135 m and ~30 m/s held; a ban hid it; a delete removed it. `cd live && npm test`: 58 of 58 (board module 9,
  the wiring 1). The hardening file failed 3 of its timing tests once while a browser group loaded the machine, and
  passed 9 of 9 alone and in the full run after.
- `live` group: 12 of 12 before the board (this afternoon's run).
- **Evening, after a worker restart:**
  - The board panel flashed "Nobody on the board yet" on its first frame, before it had asked the server; it now shows
    its loading bar until the first answer. Found by the new `live` check, which then passed: "distance today:
    live_b 209 m".
  - The pause screen of a live drive says where you stand on today's board ("#n for distance (x mi) · y mph held"),
    from the server, with your token.
  - `/health` and `server/live-status.sh` show the board's counters (drivers tracked, rows written, poses ignored).
  - The hardening tests 5, 11 and 12 failed now and then while a browser suite loaded the machine: fixed sleeps of
    300 and 400 ms, and a failed test 5 left sockets that broke 11 and 12. They now wait for conditions and always
    close their sockets: `npm test` 58 of 58 twice with the browser suite running, the hardening file 9 of 9 three
    times.
  - A Fable prompt is queued in the handoff for an adversarial review of the board's rules before it goes public.
  - **Measured on the final build:** `live` 13 of 13 (the pause screen read "Today on the online board: #2 for
    distance (0.1 mi)."; the board panel listed "live_b 194 m" as the server did, without the deleted account),
    `livephone` 7 of 7, `cd live && npm test` 58 of 58.

## 2026-10-21 (morning, the scheduled continuation): crews, cruise nights, password reset, and two realistic-mode fixes

The owner's standing order is to keep improving until they say stop. A scheduled task wakes the session every 2 hours.

- **Crews.** A code of 4 to 8 letters or numbers puts friends in a room of their own. The server keeps snapshots, the
  roster, honks, join and leave, and the welcome list inside the crew; the cap and the line stay shared. The Live
  section has a crew field and New code. Invite carries `?crew=CODE`, and opening that link sets it. Server test (B
  sees A, not an outsider 50 m away; the honk stays in the crew; everyone counts toward one cap). Browser, in the
  `livephone` group: with crew OC405 and the scripted peer outside it, 0 peers were seen, and the list read "Crew OC405 ·
  1 here · 2 of 25 live".
- **Cruise nights.** `CRUISE="Fri 20:00, Sun 18:00"` in Pacific time; the menu shows the next one, or that one is on
  now (2 hours). The desks' machine starts with Friday 8 pm. Tests cover parsing, Pacific time across daylight saving,
  "on now", and the sooner of two. `live-env.sh` now quotes values with spaces so a shell reading the file sees one word.
- **Password reset by email** (Resend; off until `RESEND_KEY` and `MAIL_FROM` are set). A 6-digit code, 15 minutes, 5
  tries. The answer is the same whether or not a name exists or has an email. The account email can be set or cleared
  with the password. Five server tests. In the browser, the panel's forgot-password flow took the code from the test
  server's mail log, set a new password and signed in.
- **The radio** sometimes gives the real live count and the busiest freeway when other drivers are out. **The menu**
  shows "N of 25 driving now" from the public health check, which screen readers can hear. **Ghosts** grow in over
  0.6 s. **The watchdog** sends a phone alert if `oc-live` stops, once it's installed (paper-book's watchdog tests:
  9 of 9).
- **Two realistic-mode bugs found by the live group, fixed:**
  - The simulated typical day read the device's own clock, so on a UTC device 06:44 counted as OC's morning rush. It
    now runs on Pacific time wherever the player is.
  - A fresh feed waited up to 2 s to be applied. It now applies at once, and the check requires the density to match
    the road's ratio exactly.
- **Server tests:** 48 of 48. **Browser** (live + livephone, run 13): 16 of 17. Crews, the reset, the third driver
  (with the longer load allowance), the who's-on list, Drive with and the honk passed. The realistic-mode check timed out
  waiting for the feed under the load of three browsers; in isolation the feed arrives within a second. The wait is now
  90 s and reports the feed's state; the rerun is below.
- **Rerun** (the `live` group): **12 of 12**. Realistic mode on I-405 North: ratio 1 gave 2.2 cars per km per lane,
  bold 0, matching the mapping exactly. C waited at #1 and got in (831 poses, 0 dropped). The reset and account checks
  passed, with no page errors.
- **The rest of the suite on the same build** (boot, interchanges, survival, race, abilities, progression, render,
  phone, launch): **62 of 62**. With `live` (12 of 12) and `livephone` (5 of 5), every group passes.
- **Rendering and honesty, from a night render.** A render of the 57 at night (started at the Orangewood exit;
  `tests/out/billboard-night.png`) showed two things:
  - The billboards were as dim as by day. They now light with the darkness, from 0.35 to 2.2 emissive (2.2 measured at
    night). In the render, the LOT 57 panel glows beside the green guide signs, 160 m ahead.
  - The HUD clock read 11:28 AM (this machine's UTC clock) under a night sky. The chip and the simulated temperature
    now run on OC's clock: Pacific time in Live, wherever the player is, and the preset's own hour otherwise. `phone`
    and `boot`: 14 of 14, with the Day preset's chip reading "12:30 PM".
  - With Live weather and the real feed, the chip now shows the observed temperature and "NWS KSNA" rather than the
    simulated one. In the `phone` group the injected reading showed "61° · NWS KSNA": 8 of 8.
- **Ghost cars' lamps.** Ghosts now carry head and tail lamps like the traffic's, and the tail lamps brighten when
  that driver brakes. The new night check found a real bug: a ghost standing still ignored repeated poses, which also
  dropped a change in its brake light. It now updates the brake and speed on a repeated pose. `livephone`: 6 of 6,
  with 1 ghost, both lamps, brake lamp 3.2 after the sky darkened (`tests/out/livephone-night-ghost.png`; the ghost is
  60 m ahead, so small at phone size). The night road still reads bright; that is the night-lighting item in the Opus
  queue, not this change.
- **Load, measured again** (`node live/test/load.mjs N 20`, with the roster, crews, honks and the security limits in):
  25 drivers: 2.9% CPU, 142 MB, 5.4 MB a minute out. 100: 6.5%, 155 MB, 71. 250: 22.8%, 179 MB, 207 (550 before the
  nearest-32 rule). 0 poses dropped at any size. Memory is the next limit: the README's ladder now raises `MemoryMax`
  to 512M before rung 4. The load script now opens many sockets from one address (`SOCKETS_PER_IP`).
- **The Feedback report** gains a Live line: off, or the state, lobby, crew, ghosts known and drawn, and the feed's
  source, with no names. `launch`: 6 of 6.

## 2026-10-21 (later): the live server on the desks' machine, social features, and a security review fixed

The owner: "share it with the desks server and do anything you can at maximum capacity", then "keep rendering and
improving ... until I say stop". Branch `claude/live-server` (pushed). The push onto `claude/always-on` was refused by
the session's permission check (a production deploy), so the desks' machine doesn't have it until the owner allows
or merges it.

- **On the desks' machine.** `server/setup.sh` now runs `server/live-install.sh` (never fatal to the desks).
  `server/live.sh` makes it public through Tailscale Funnel (free) or a domain with Caddy, and checks the API, the
  page and the socket through the public address. Run here end to end with a systemd stand-in. The installer built the
  game, created `oclive`, copied the server and the page to /opt/oc-live (root-owned, data/ 0700 oclive), and wrote
  /etc/oc-live.env (0600). The service ran as oclive with its database 0600. `live-cap.sh` (30, then 25; refuses
  `5/e` and 9999), `live-ban.sh` (refuses a name with quotes), `live-env.sh` (stores `a#b&c\d` exactly) and
  `live-status.sh` (with the ladder's verdict) all behaved. The build peaks near 530 MB (vite 528 MB, tsc 491 MB, the
  single-file step 21 MB), so the installer adds a 1 GB swap file under 2 GB of memory. The page is served at 3.7 MB, or
  1.9 MB gzipped.
- **New for players.** Name plates over ghost cars, the 2 s roster (map dots, the who's-on list with each driver's
  freeway), Drive with, the horn, change password and delete account, the pause screen's live line, Invite a friend,
  the DJ every three minutes, and toasts long enough to read.
- **New for the owner.** The nearest-32 rule cut outbound at 250 drivers from 550 to 190 MB a minute. Restarts now
  reconnect (code 4001). The name filter (slurs, profanity with number-for-letter spellings, staff names; "Scunthorpe"
  is the known miss) and bans. The measured ladder: hourly records, `/api/ladder`, and the verdict in `live-status.sh`.
- **The security review** (an independent agent, read-only, probes in the scratchpad) found 15 issues, 8 of them
  reproduced. All are fixed, with 9 tests in `live/test/hardening.test.mjs` that run behind a simulated proxy:
  - 4 malformed request targets each crashed the process; now each gets a 400 and the server stays up.
  - `/health` took 868 ms during 20 parallel log-ins; now under 150 ms, with scrypt on the thread pool, at most 4 at once.
  - Ten wrong passwords from elsewhere locked a driver out; now failures count per name and address.
  - The first X-Forwarded-For entry was used, and a missing header exempted the client; now the last entry is used,
    a missing header is refused, and IPv6 counts by /64.
  - Idle sockets could hold the lobby; now a driver idle 60 s gives the spot to someone waiting (4002), with at most
    3 sockets per address and 200 sockets still saying hello.
  - Admin access came through the proxy; now it is local-only, with a constant-time token check.
  - The line had no limit; now it holds 500.
  - Log-out left the socket open; now log-out and a password change end the account's sockets.
  - A symlink could reach outside the page folder; now it isn't served.
  - On the machine: a dedicated user, a hardened unit, the database 0600, the token off the command line, and
    script arguments checked.
  Found on the way: the standalone `deploy/setup.sh` didn't parse (an apostrophe inside `${VAR:?…}`) and would have
  copied the server without the modules it imports. Both are fixed.
- **Tests.** `cd live && npm test`: 40 of 40, four runs in a row. The game typecheck is clean.
- **Browser** (the `live` group, before the security fixes): 8 of 9. Plates, the who's-on list ("Driving now · 2 of 2
  live_ui you live_b I-405 North Drive with"), Drive with (A 79.96 m behind B on I-405 North), realistic mode and the
  billboards passed. The waiting-line check timed out loading C's page while a review agent and the server tests were
  using the CPU; the rerun is below.
- **Browser, after the security fixes** (the `live` group, every check in it at the time): **10 of 10**. Two drivers
  online, one ghost drawn, one name plate, chip LIVE 2/2. The who's-on list read "Driving now · 2 of 2 live_ui you
  live_b I-405 North Drive with". Drive with put A 79.96 m behind B on I-405 North, and A heard B honk. C waited at #1
  and got in when B left (peak 2, admitted 3, 824 poses in, 0 dropped). Two bad poses were dropped through a real
  socket. Realistic mode and the 12 billboards passed. The account panel changed the password and deleted the
  account, and the server agreed. The pause screen showed its live line. No page errors. The menu count, the reset
  check and the grow-in came after this run.
- **Phone size** (the new `livephone` group: 390 × 844, one phone browser plus a scripted peer on a plain socket, so
  no second browser): the Live section fits and shows "0 of 25 driving now". The account panel fits, signed in, with
  the email setting open. The who's-on list reads "Driving now · 2 of 25 phone_me you Westbound_GT I-405 North Drive
  with". The first screenshot showed "GO TO" and "LIVE 2/25" wrapping onto two lines, which made the top bar taller
  so it covered the top of the corner map. Fixed: labels never wrap, and on a phone the chip shows a green dot and
  "2/25". The check now asserts one row and that the bar ends above the map (374 px of 390, 6 items). It passes, and
  the `phone` group passes alongside it. Also found: Chromium's phone emulation drops a `file://` page's localStorage
  on reload. A real phone loading the game over https keeps it, so the check logs in through the account panel. The
  account avatar now gets its sunset disc.

## 2026-10-21: the live server (alpha), the realistic mode, the talk bank and billboards

Decisions 16 and 17. Branch `claude/live-server`. Everything below was run in this sandbox; nothing is deployed, so no
real phone, real network or real player has touched it.

- **Server tests** (`cd live && npm test`, Node 22.22): 11 of 11 pass. Accounts: the name, password and age rules,
  case-insensitive uniqueness, a wrong password and an unknown name both 401, log-out kills the token, the per-name
  log-in limit returns 429. The lobby: 30 drivers against a cap of 25 gives 25 online and 5 in line at #1 to #5; one
  leaving lets #1 in and moves the rest up; raising the cap to 35 at run time lets the line in (a wrong admin token
  gets a 404). The relay: a driver 100 m away is seen with the exact pose and brake light, one 30 km away isn't; a
  teleport, 500 m/s and a non-number are each dropped and the last good pose stands; a second log-in on the same
  account replaces the first. The feeds (`now.mjs`): the NWS text to the five skies, the mock day's shape (weekday
  rush slower than night, Saturday easier), a political trend dropped by the blocklist, the real providers called
  only when switched on (one NWS call, 20 TomTom calls), a dead network logged not fatal, a good answer kept, and
  `/api/now` served with 20 roads.
- **Load** (`node live/test/load.mjs N 20`: N pretend drivers in five clusters sending poses at 10 Hz for 20 s,
  on this sandbox's CPU; percentages are of one core):

| Drivers | Online | Server CPU | Memory | Peers seen (avg) | Out, MB a minute | Poses dropped |
| --- | --- | --- | --- | --- | --- | --- |
| 25 | 25 | 2.3% | 91 MB | 8.6 | 5.4 | 0 of 4,975 |
| 100 | 100 | 6.3% | 105 MB | 35.6 | 87.5 | 0 of 19,900 |
| 250 | 250 | 20.9% | 126 MB | 80.7 | 550 | 0 of 49,750 |

  CPU and memory are far from limits even at 250; outbound bandwidth is what grows (with the square of a cluster's
  size). At 25 a full lobby around the clock is about 230 GB a month, inside a $6 Droplet's 1 TB; 100 bunched
  together would need binary poses and the nearest-32 rule first, as the ladder in `live/README.md` says.
- **The talk bank** (`node tests/talk.mjs`): 173,601 distinct openers and 3,960 replies; 68,745,996 distinct two-line
  conversations for one day's feed; 0 lines trip the no-politics blocklist; 0 lines with an unfilled slot. The
  Coastal League: four games a day with every club playing once, the same result on every run, mid-July standings
  that balance (ANA 59-46 … NB 44-61), January off-season and early October playoffs.
- **Suite** (`npm run build && npm test -- --only=…`, headless Chromium with SwiftShader):
  - `boot` and `phone`: 14 of 14 pass with the live code in (the menu fits 390 × 844 with the new Live section).
  - `live` (three signed-in browsers against a cap of two): the Live section and the account form; a sign-up from the
    panel; two drivers online and each sees the other (A drew B's car; the chip read LIVE 2/2; screenshot
    `tests/out/live-ghost.png`, B's red coupe ahead on I-405 North); a third driver waits at #1 and is let in when one
    goes back to the menu (server peak 2, admitted 3, 800 poses in, 0 dropped); a 500 m/s pose and a non-number
    dropped through a real socket; no page errors. The first two runs failed only on the chip's case (CSS upper-cases
    it) and are fixed.
  - Final runs on the last build: `live` **14 of 14** with `launch` in the same run, then `launch` alone **6 of 6**
    after the billboard check's braking fix. Realistic mode: on I-405 North the mock feed's ratio 1 gave 2.2 cars per km
    per lane, the sky followed the feed (clear, 64°F) and the HUD read "Live traffic · simulated · typical day" (the
    test server runs the mocks, so "simulated" is the honest label). Billboards: all 12 placed (I-5 both ways at 27 to
    28 km south and 64 to 65 km north, CA-57 at 0 to 0.5 km and 19 to 20 km, CA-91 East 26.5 km, CA-91 West 47.4 km,
    CA-22 East 18.0 km, CA-22 West 3.7 km). The Lot 57 panel on the 57 is drawn ahead of the Orangewood exit
    (screenshot `tests/out/launch-billboard.png`, taken 87 m short with the car stopped).
  - Found and fixed on the way: the four 91 and 22 billboard slots had their points mirrored north to south (5 to 7
    km off those roads), so 8 of 12 placed; moved to where each road passes closest to the venues. The realistic-mode
    check read the HUD's traffic line without a route set; that line lives on the destination card, which shows only
    with a route, so the check now sets one. The billboard check braked a car that was already stopped, and the
    automatic gearbox took that as reverse; it now brakes only while moving.
- **Not verified:** the real NWS and TomTom feeds (this sandbox can't reach either host; the providers are tested
  with recorded answers), any real phone, a real deployment behind Caddy, and more than three browsers at once.

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
