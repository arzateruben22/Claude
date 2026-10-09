# Top Speed OC: Ultra (Project OC)

A first-person sports-car game on Orange County's real freeways: I-5, I-405, CA-91, 55, 57, 22, 73, 133, 241 and
261, with every interchange between them. You drive a 711 hp mid-engine coupe. Take any connector ramp you like, or
pick a freeway and follow the navigator through the interchanges. It's built for phones first.

- **The roads are real.** The geometry comes from OpenStreetMap via Overture Maps (ODbL): both directions of every
  freeway, 1,247 ramp pieces, real grade separations, real street overpasses, and green guide signs with OSM's
  destination text.
- **The ground is real.** Elevation comes from USGS via AWS Terrain Tiles.
- **Everything else is our own.** The car, its "R" badge, the cockpit, the scenery and the sound are made in code.
  No real brand, logo or body shape is used.

Plans and status: [`PROJECT_OC_ROADMAP.md`](PROJECT_OC_ROADMAP.md). What was verified and how:
[`PROJECT_OC_PROGRESS.md`](PROJECT_OC_PROGRESS.md). How it works: [`PROJECT_OC_TECHNICAL_NOTES.md`](PROJECT_OC_TECHNICAL_NOTES.md).

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type-checks, builds to dist/, then folds it into one file
```

`npm run build` also writes two single-file builds:
- `dist/top-speed-ultra.html` (about 3 MB) opens straight from disk.
- `dist/artifact.html` is the same page without the document wrapper.

The road data is rebuilt by `tools/oc-network/` (Python), which has its own README.

## Playing

- **Phone controls.** Drag the pad at the bottom left to steer. Hold GAS and BRAKE on the right.
- **Top bar.** **View** changes the camera: driver's seat, hood, chase, free look. **Go to** picks a freeway to
  navigate to. **Radio** changes station. **Pause**.
- **Corner window.** Tap it to switch between a road map with your route in yellow, a live sky camera, or off.
- **On the road.** A prompt at the top tells you the next move, such as "Keep right: CA-55 North · 0.4 mi". Green
  signs over the road name the exits.
- **Keyboard:**
  - W/S or the arrows: drive. A/D: steer. Space: handbrake.
  - Q/E: shift. M: automatic or manual.
  - C: view. N: map. F: ability. B: radio. V: look back. R: reset. P: pause.
- **Gamepad** (standard mapping): triggers for gas and brake, left stick to steer.
- **End of the road.** If a freeway ends (as the 261 does at Walnut Ave), you're turned around. If you take an exit
  to a street, you're moved to a nearby on-ramp.

## Modes

- **Free Drive.** No clock. Start on any of 12 freeway points and go anywhere.
- **Races.** Three rivals on real stretches of freeway:
  - Irvine Sprint on the 405 North
  - Santa Ana Checkpoints on the 5 North
  - Foothill Sprint on the 241 South
  - Riverside Endurance on the 91 East

  There's a countdown, live position, gates, credits and XP for a finish, and best times.
- **Speed Survival.**
  - Score builds with distance, faster above 100 mph, and more the longer your streak over 100 mph runs.
  - Clean passes and near misses build a combo.
  - A car only scores once. Stopped cars and wrong-way driving score nothing.
  - A real crash ends the run: hitting a car at more than 7 m/s closing speed, or a wall at more than 17 m/s.
- **Time Trial.** The same start and the same traffic every time. 60 s on the clock, plus 25 s every 2 km.

Traffic has five levels: None, Light, Moderate, Heavy and Expert. Expert adds aggressive drivers. Runs are kept per
mode on this device only, and the leaderboard says so.

## Drivers, cars and your profile

- **Drivers.** There are three, each in a male or female presentation, with five skin tones. Each has one ability,
  fired by the round button or F:
  - The Closer has Clear Path: traffic eases off 35% for 8 s. Cars move over and nothing vanishes in view.
  - The Ace has Focus Time: the world runs at 70% for 5 s.
  - The Wrench has Locked In: 30% more grip for 7 s.

  The hands are cosmetic: a gold watch flex, racing gloves, or one hand on the knee.
- **Garage.** Four fictional cars (Rossini GT, Brio, Corsa and the electric Vela E) bought with credits you earn by
  driving. **No real money anywhere.** Garage slots open up as you level.
- **Profile.** Level and XP, credits, lifetime stats, the freeways you've driven, and nine achievements. Saved on this
  device only.
- **Sky.**
  - Live puts the sun where it really is over Orange County, from your clock. Or pick sunrise, day, sunset or night.
  - Weather is clear, cloudy, rain, fog, mist or changing. It's simulated, with no live feed. Rain cuts grip.
- **Ultra Realism** (from level 5): tunnel vision, camera shake and muffled hearing at speed, each switched on its
  own.
- **Radio** (top bar, or B). Three fictional stations whose music is composed live in code. Nothing is recorded,
  licensed or streamed.

## The car

- 1480 kg, 530 kW (711 hp), 770 Nm. Redline 8000 rpm. A 7-speed dual-clutch.
- About 3.3 s to 60 mph, and about 211 mph flat out.
  - These were measured in arcade mode on the old procedural road.
  - They haven't been re-measured on real roads, where the curves cap the speed.
- **Handling slider.**
  - The arcade end adds grip, stability control and traction control.
  - The sim end has tyres that let go past their peak, more steering lock and wheelspin, and a light race-mode
    stability control that only steps in during a real slide.
  - Steering lock is speed-sensitive at both ends.

## Graphics presets

| Preset | Shadows | Post | Road and ground drawn to | Notes |
| --- | --- | --- | --- | --- |
| Low | off | none | 0.9 km | phones; lighter trees |
| Medium | 1024 | none | 1.3 km | lighter trees |
| High | 2048 | bloom, 4× MSAA | 1.8 km | |
| Ultra | 4096 | ambient occlusion, bloom, 4× MSAA | 2.4 km | denser scenery |

Adaptive resolution (on by default) scales between 50% and 100% to hold the frame rate.

## Limits, said plainly

- **Not photographic.** Real geometry and terrain, but procedural textures and models. Buildings and trees are
  placed procedurally, not from real footprints.
- **Lanes, exits and streets.**
  - Lane counts are per freeway, so lane drops and HOV or express lanes aren't modelled.
  - There are no exit numbers, because the source data doesn't have them.
  - Surface streets can't be driven.
- **Crossings.** A ramp clips through another road at about four places out of 506 crossings.
- **Frame rate on real phones hasn't been measured.** The test machine renders in software.
