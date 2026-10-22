# Project OC: master prompt

Paste this into a new chat to carry on. It holds the owner's full vision, every feature they've asked for, the
rules, and where things stand. It sits in the repo too, at `top-speed-ultra/PROJECT_OC_MASTER_PROMPT.md`.

---

You're continuing **Project OC**, an existing game. Don't start over and don't overwrite working systems.

**Where it is**
- Repo `arzateruben22/Claude`, branch `claude/always-on`, folder `top-speed-ultra/`.
- Playable link: https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV. Republish `dist/artifact.html` to that same URL.

**Read these first:**
- `top-speed-ultra/CLAUDE.md`
- `PROJECT_OC_PROGRESS.md`: what's done and verified
- `PROJECT_OC_ROADMAP.md`: status of every item
- `PROJECT_OC_TECHNICAL_NOTES.md`: architecture

Then tell me what's left before you change anything.

## The vision

- **The core idea.** A driving game set in Orange County, the whole county done deeply: every freeway, every street, roundabouts, malls. (The owner stopped LA County and beyond on 2026-10-20.)
  - You see how fast different cars can really go.
  - Survive in traffic at top speed.
  - Climb a scoreboard for how long you stay at max speed without crashing.
- **Who it's for.** Phone players first. Keep the UI simple and big-thumbed. No controls screen.
- **The look.**
  - First person from the driver's seat of a Ferrari-inspired supercar: carbon and leather wheel, round tach,
    hands on the wheel.
  - Real Orange County freeways and interchanges.
  - As realistic as a browser game can get.

## Everything the owner has asked for

Built items are marked ✅. Everything else is still to do.

- ✅ Real, connected OC freeways: I-5, I-405, CA-22, 55, 57, 73, 91, 133, 241, 261. You can take any interchange.
  Chunk streaming, navigation with route picking, signs and destinations.
  - Next: every OC street, roundabout and mall; the freeway gaps (I-605 at Seal Beach, the SR-90 expressway). LA County is stopped (2026-10-20).
- ✅ Traffic levels: None, Light, Moderate, Heavy, Expert. Deterministic traffic.
- ✅ Speed Survival: max speed, longest clean streak over 100 mph, distance, near misses, clean passes, collisions,
  score, personal best. Exploit-resistant. Local leaderboard, clearly labelled local.
- ✅ The driver's-seat view with a small square sky view (a picture-in-picture sky camera you can toggle and resize),
  plus a road map.
- ✅ Car brands are fictional: Rossini, Vela, our own "R" badge.
  - The owner asked about Hondas and Ferraris. Real brands, logos and body shapes are trademarked, so: inspired by,
    never copied.
- ✅ Weather and time: day, night, sunrise, sunset, rain, fog, mist, cloudy.
  - Live puts the sun where it really is over OC.
  - The owner wanted live California weather. Use it only from an authorised API, with a simulated fallback; it's
    simulated now.
  - The owner wanted to pay a fee to remove or set the weather. That stays a future paid pass, design only: **no
    payments**.
- ✅ Pick a driver, a boy or girl version, from three, each with a unique timed ability:
  - Clear Path: traffic clears about 35%, with a Rolex-style watch flex (a gold watch, no real brand). The female
    version shows a ring and bracelet. The owner also wants **painted nails** visible on the female hands; not done
    yet.
  - Focus Time: time slows about 30–35%.
  - Locked In: grip, with one-handed driving as the cosmetic.
  - The owner wanted abilities of about 5 seconds. Tuned to 5–6 s on 2026-10-15 (Clear Path 6 s, the others 5 s). Clear Path needs a sensible
    rule in No Traffic mode.
- ✅ A profile and stats screen, like the Trade Crawler's: name, avatar, level, XP, time, distance, best streak,
  races won, cars, credits, achievements. Saved locally and versioned.
- ✅ The radio: fictional stations whose music is made in code.
  - The owner asked for live stations or Apple Music. Only licensed or original audio, never scraped streams. Apple
    Music would need Apple's MusicKit, a developer account and the player's own subscription. That's roadmap.
- ✅ Ultra Realism mode, unlocked by level: tunnel vision, camera shake, muffled sound, each switched on its own.
  - Still to do: the "4K hyper-realistic" visual tier, meaning licensed or scanned models, photo textures, HDRI skies
    and real building footprints.
- ✅ Races against AI bots: sprint, checkpoint, endurance, time trial, with a countdown, standings and rewards.
  - Racing real people is roadmap only. It needs anti-cheat; never claim it exists. Since 2026-10-21 there is a
    live server (`live/`, alpha): accounts, a lobby capped at 25 drivers at a time that grows rung by rung, and
    other drivers' cars shown as ghosts. That is all it does, and the game says so.
- ✅ Fake money only (credits earned by driving) to buy cars. More cars and garage slots open with level. One car
  to start.
- ⬜ Buy houses and park your car there. Fake money, roadmap.
- ✅ A Hot Wheels-style arcade track: loops, banking, boost pads. Shown as "Coming soon" from the menu (Loop Lab
  preview), separate from OC.
  - Still to do: make it playable.
- ⬜ Get out of the car into a Sims-like walkable world, starting at the Golden Road (Golden Road Brewing). It
  needs:
  - NPCs that look like they're talking
  - simulated crowds
  - never claiming real "live" occupancy or traffic from any website
- ⬜ City streets beyond the freeways (surface roads, intersections).
- ✅ (2026-10-21, alpha) The live server: log-ins, 25 drivers at a time to start, the cap raised rung by rung, other
  drivers on the freeway with you as ghosts. See decision 16.
- ✅ (2026-10-21) Being there virtually: a Realistic mode (live time, live weather from the NWS, live freeway traffic
  from TomTom's flow) and a custom mode; venue busyness stays simulated because Google's live data is not available
  to anyone (decision 17).
- ✅ (2026-10-21) The talk bank: over 100,000 conversations (173,601 openers, 68.7 million two-line exchanges for a
  day) from moods and energies, matched to the weather, the freeways, the made-up Coastal League and a hand-written
  trends list; nothing political. The radio DJs use it now; the on-foot NPCs next.
- ✅ (2026-10-21) Billboards on the 5, 57, 91 and 22 near the two venues, our own places only until a deal is signed.

## Rules that always apply

- **No real money anywhere.** No real payments.
- **Credentials.** Never ask for or handle passwords, seed phrases, private keys or API keys in chat.
- **Our own brands only.** No Ferrari, Honda, Rolex or Hot Wheels branding, logos or copied designs.
- **Map data.** Use only OpenStreetMap or Overture data (credit them). Never copy Google Maps.
- **Honest claims.**
  - Never claim live data, live weather, multiplayer or live occupancy that doesn't exist. The live server is an
    alpha with a cap: say "alpha", say the cap, and say what it doesn't do (no races against people, no chat; the
    online board ranks only what the server saw while you drove live).
  - Be honest about limits, including what a browser on a phone can do.
- **Other projects.** Don't modify Trade Crawler, the Los Güeros website at the repo root, or other projects.
- **Verify everything.**
  - Use Playwright (headless Chromium, SwiftShader) and the `window.__game` test hooks.
  - Never invent test results.
  - Log what was checked in `PROJECT_OC_PROGRESS.md`. Update the roadmap's statuses.
- **Commits** go on `claude/always-on`. Don't open pull requests unless asked. No model names in commits or code.

## Priority order (the owner's)

- **P0:** stable game, controls, continuous road, collisions.
- **P1:** connected OC freeways, cockpit, dashboard, traffic AI.
- **P2:** difficulty, mini camera, survival scoring, profiles, saves.
- **P3:** weather, characters, abilities, races, progression, garage.
- **P4:** Ultra mode, radio, city slice, on foot.
- **P5:** multiplayer (the live server's first rung is built: accounts, the capped lobby, ghosts), housing,
  arcade track, commercial features.

P0–P4 core systems are built (see the progress log). Good next steps:
- performance on real phones
- painted nails and finer hands
- tuning ability lengths toward about 5 s
- every street in Orange County (LA County is stopped)
- the playable arcade track
- houses and parking
- the Golden Road walkable slice
- higher-fidelity assets

## Added 2026-10-16

- **Drifting.** Semi-real drift physics on the car: power-over, lift-off and handbrake entries, weight transfer,
  counter-steer that can catch a slide, a stability control that backs off while the driver counter-steers, at every
  handling setting; black skid marks laid on the road by slipping tyres; tyre smoke; a drift angle readout.
- **The main menu** should be more seamless, with a finer luxury, Apple-like aesthetic feel (see
  `PROJECT_OC_UI_TARGET.md`).
- **Model policy.** Daytime (Pacific) work on Opus 5.5; Fable 5.1 overnight for the hardest problems and for
  reviewing the day's work (details in `CLAUDE.md`).
- **The name.** The game is **OC Ultra**, with "Top Speed" beneath; the OC sunset wordmark is its logo, replacing
  the R badge everywhere the R stood for the game (the R stays as the Rossini car brand).

## Added 2026-10-16 (evening): the OC Hypercar

The owner's directive (its title quoted, its brief summarised) and the owner's own words, quoted:

- **"OC Hypercar — Prototype 01."** Recreate the hypercar on the owner's reference sheet (a 3/4 hero shot at night,
  then front, rear, side and top views, and headlight, rear, wheel and wing details) as faithfully as the game's
  technology allows:
  - the silhouette and proportions; an extremely low, wide, aggressive front with a deep carbon splitter;
  - metallic light-silver paint; ice-blue LED headlight blades and accent strips;
  - carbon skirts and diffuser; deep side intakes; a large rear wing on swan-neck mounts;
  - black multi-spoke wheels with blue calipers; a full-width red rear light bar;
  - the OC wordmark on the nose badge, the rear plate and the wheel centres.

  Not a generic supercar.
- "make the speed go insanely fast and handling and traction best of the best and also have its own unique ability
  to do what the new [a real carmaker's new roadster; the name is left out here under the own-brands rule] does"
- "whatever makes this car exclusive"
- "I kind of want to price this at $4.99"
- "Okay let’s make the the hypercar when ur in free roam mode like not racing anybody it has max out goated stats"

What that becomes (the plan, the dimension sheet, the numbers and the milestones are in `PROJECT_OC_HYPERCAR.md`):

- ⬜ **The OC Hypercar**, the fourth car in the garage.
  - The garage shows Rossini GT, Brio, Corsa and the OC Hypercar. The Vela E stays in the code, shown only in owner
    mode or to a profile that owns it.
  - It's a procedural model built in code like the other cars, never claimed as a finished 3D asset.
- ⬜ **Two tunes, chosen by the mode at the start of a run**, never mid-run.
  - **Unleashed in Free Drive:** the fastest, best-handling, best-traction car in the game, with its ability.
  - **The race tune in Speed Survival, Races and Time Trial:** at or under the best earnable car (the Rossini Corsa)
    on every measured number, with the ability off, so a paid car never wins a scored run by paying.
  - The garage card and the HUD say which tune is on (an "Unleashed" chip in Free Drive).
- ⬜ **Its own ability, with our own names.** The inspiration was reported on 2026-10-15; its figures are
  manufacturer claims, not verified, and no real company or product is named in the game, code, UI or commits.
  - **Cold Thrust** (hold): rear cold-gas thrust from a compressed-air tank.
  - **Ground Lock:** fans that pull the car down for about 2 g of cornering.
  - **Thrust Hop:** a short hop over a car or a semi in the same lane, landing on the road it left; never under an
    overpass or sign gantry.
  - Free Drive only.
- ⬜ **The OC Hypercar Founder Edition**, $4.99 one time, sold in a founder window to December 31, 2026 (one constant).
  - Its exclusives: a numbered plaque ("No. 0000 · TEST" in owner mode until the store assigns real numbers), a paint
    and LED colour of its own, an LED wake-up sweep, a garage reveal, a run-card badge.
  - "Never sold again" is a promise only the owner can keep.
  - Real money stays in test mode. The store (SKU, entitlement, server-assigned serial) belongs to the
    `claude/store` branch; the hypercar branch builds no purchase flow.

## Added 2026-10-20

- **The map is Orange County only.** "put a full stop into the la count and solely focus on the OC map including all
  freewats, neighborhood streets, roundabouts, etc." Every freeway and expressway in the county, every public street
  with intersections and signals, roundabouts, malls and their parking structures. LA County and beyond are stopped.
  Decision 11 in PROJECT_OC_DECISIONS.md.
