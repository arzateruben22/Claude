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

## Rules that always apply

- **No real money anywhere.** No real payments.
- **Credentials.** Never ask for or handle passwords, seed phrases, private keys or API keys in chat.
- **Our own brands only.** No Ferrari, Honda, Rolex or Hot Wheels branding, logos or copied designs.
- **Map data.** Use only OpenStreetMap or Overture data (credit them). Never copy Google Maps.
- **Honest claims.**
  - Never claim live data, live weather, multiplayer or live occupancy that doesn't exist. The live server is an
    alpha with a cap: say "alpha", say the cap, and say what it doesn't do (no races against people, no online
    leaderboard, no chat).
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

## Added 2026-10-20

- **The map is Orange County only.** "put a full stop into the la count and solely focus on the OC map including all
  freewats, neighborhood streets, roundabouts, etc." Every freeway and expressway in the county, every public street
  with intersections and signals, roundabouts, malls and their parking structures. LA County and beyond are stopped.
  Decision 11 in PROJECT_OC_DECISIONS.md.
