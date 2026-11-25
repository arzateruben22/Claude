# Top Speed OC: Ultra: 30-second trailer plan (Step 1, for the owner's approval)

Status: **plan only, waiting for approval** (2026-11-25 PT). Nothing has been captured at full length yet. The
reference frames on the contact sheet are single 1920x1080 frames from the real game, rendered by the same capture
script that Step 2 will use (`tools/trailer/capture.mjs --ref`).

## Source build

The main link (https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV) is v34: 812ecfb plus the Paint tab fix (edf91e0, a
cherry-pick of 4897550; PROJECT_OC_PROGRESS.md, 2026-11-24 ~4:10 PM PT). edf91e0 was never pushed, so the capture
build is rebuilt the same way: 812ecfb + `git cherry-pick 4897550`, then `npm run build`. Nothing from
claude/tender-fermat-sk9rby's newer work (the warm-up, the iOS memory caps) is in the footage.

## Rules for the footage (honest claims)

- Every frame is the game rendering itself in headless Chromium (SwiftShader). No concept art, no AI video, no
  paint-overs. Cuts, title cards, the logo end card and the Retro Low / Ultra wipe are added in the edit and are
  plainly edit graphics.
- Only the game's own cameras: Driver's seat (`cockpit`), `chase`, and the cinematic camera's four shots (the menu's
  attract-drive camera, `SHOTS` in Game.ts), plus the garage's Founder reveal stage (`openReveal` / `revealHold`).
  The realism preview page's `?view=` presets are **not** used: that page is a separate test scene, not the game.
- The HUD and the on-screen buttons are hidden by CSS in six shots (a clean film look) and shown in the chase and
  menu shots, so the trailer also shows the game as it is played.
- Sky and weather are the game's simulated presets (no live weather); traffic is the game's AI. No multiplayer.

## Pacing: 124 BPM

One beat = 0.484 s, one bar (4 beats) = 1.935 s; 30.0 s = 15.5 bars = 62 beats. Every cut lands on a beat; the
bigger moves land on a bar line. Frame counts at 30 fps.

| # | In (s) | Out (s) | Bars | Frames | What |
|---|---|---|---|---|---|
| S1 | 0.000 | 3.871 | 2 | 116 | Drone over the 405 at sunrise |
| C1 | 3.871 | 5.806 | 1 | 58 | Title card 1 |
| S2 | 5.806 | 9.677 | 2 | 116 | OC Hypercar reveal and LED wake |
| S3 | 9.677 | 12.581 | 1.5 | 87 | Cockpit at speed |
| S4 | 12.581 | 15.484 | 1.5 | 87 | Chase through traffic |
| C2 | 15.484 | 17.419 | 1 | 58 | Title card 2 |
| S5 | 17.419 | 20.323 | 1.5 | 87 | A drift at sunset |
| S6 | 20.323 | 24.194 | 2 | 116 | Red tail lights at dusk |
| S7 | 24.194 | 26.129 | 1 | 58 | Retro Low vs Ultra |
| S8 | 26.129 | 28.065 | 1 | 58 | The menu |
| C3 | 28.065 | 30.000 | 1 | 58 | End logo |

Beat marks for the edit (the silent cut burns a small tick in the corner on every downbeat if there is no music).

## The eight shots

All shots: 1920x1080, 30 fps, graphics preset **Ultra**, adaptive quality off, OC Ultra look, dark theme, Free
Drive starting on **I-405 North**, owner mode (any car). Seed = Math.random reseeded before the warm-up drive.
"Warm-up" is the game's `fastForward` at its fixed 1/120 s step with the game paused, before recording begins.

| # | Camera (in-game) | The move | Time / weather | Traffic | Car and paint | Seed, warm-up | HUD |
|---|---|---|---|---|---|---|---|
| S1 | Cinematic, shot 3 ("the drone, high behind") | Drone 8.5 m up, pulling in from 15 to 12 m behind while the car cruises; the freeway runs off ahead | Sunrise, clear | Moderate | OC Hypercar, Glacier Silver (Founder) | 101, 20 s at 31 m/s | off |
| S2 | Garage Founder reveal stage (`openReveal`, `revealHold`) | The stage's own reveal timeline from 1.6 s to its end (6.2 s), stretched over 2 bars: LED wake, the light sweep across the car | The stage's own lighting | none | OC Hypercar, Glacier Silver, ice LEDs | 102 | off |
| S3 | Driver's seat (`cockpit`) | Locked seat view, hands on the wheel, cluster live, the freeway coming at you at ~100 mph | Day, clear | Moderate | Rossini GT, Rossini Red | 103, 25 s at 45 m/s | off (the car's cluster shows speed) |
| S4 | Chase | Behind the car as the autopilot weaves through heavy traffic | Day, clear | Heavy | Vela E, Electric Blue | 104, 25 s at 40 m/s | **on** |
| S5 | Cinematic, shot 2 (low rear three-quarter) | At 0.3 s a handbrake flick (0.5 s) with full steer and throttle: the tail steps out | Sunset, clear | Light | Rossini Corsa, Track Yellow | 105, 12 s at 30 m/s | off |
| S6 | Cinematic, shot 0 ("the hero" rear three-quarter) | Long-lens tracking alongside, the tail lights glowing red, traffic ahead | Sunset, clear | Heavy | Rossini GT, Rossini Red | 106, 30 s at 31 m/s | off |
| S7 | Chase | The same seeded drive rendered twice, Retro Low (Low + Retro style) and Ultra; the edit wipes left to right from Retro Low to Ultra across the bar | Day, clear | Moderate | Rossini Brio, Coast Blue | 107, 20 s at 31 m/s | off |
| S8 | Cinematic shot 0 under the menu (the attract drive) | The main menu as a player first sees it, the hypercar driving behind it | Night, clear | Moderate | OC Hypercar, Glacier Silver | 108, 6 s attract | **on** (it is the menu) |

Night appears only in S8; if you want more night, S6 can move from Sunset to Night with no other change.

## Title cards (OC Ultra style)

Black-to-graphite background, the OC Ultra silver/ice-blue type (the game's own Jost; the OC mark drawn from
`src/preview/oc-mark.ts`, so it is vector-sharp at 1080p). Each card fades in on its downbeat and cuts out on the
next bar.

- **C1:** "THE REAL 405" / small line: "Orange County's freeways, built from open map data"
- **C2:** "SUNRISE TO MIDNIGHT" / small line: "Five cars. One coast. Your pace."
- **C3 (end logo):** the OC mark, "TOP SPEED OC: ULTRA", and "PLAY FREE IN YOUR BROWSER" (owner to confirm the
  last line, or swap in a date or link)

The S7 wipe carries two small labels, "RETRO LOW" (left) and "ULTRA" (right).

## Music

None is included. If you send a track you own or have licensed (and its licence terms), it is cut to these beat
marks; otherwise the deliverable is a silent cut with the beat ticks and an on-screen bar counter in a corner (a
second, clean silent version without ticks is cheap to add if you want one).

## Step 2 and 3 (after approval)

- `tools/trailer/capture.mjs --shot=<id>` renders one shot at a time to the scratchpad (JPEG frames, 1920x1080, a
  virtual clock so each frame is exactly 1/30 s of game time); a contact sheet per shot goes to the owner; at most
  one re-shoot round.
- `tools/trailer/cut.mjs` (to write) renders the cards with the game's fonts and the OC mark, and cuts with
  /usr/bin/ffmpeg to H.264 (yuv420p, CRF 18, 30 fps, faststart).
- Measured cost: one reference frame took ~4 min end to end (most of it the page load in software rendering); full
  shots are estimated in the next update once the first one has run.
