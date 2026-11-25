# Top Speed OC: Ultra: 30-second trailer plan (Step 1, for the owner's approval)

Status: **approved 2026-11-25 PT; captured and cut the same evening** (results at the end).

## Owner's answers (2026-11-25)

- S1 and S6: "use your best cinematic production decision". Decided: S1 moves from Sunrise to **Day** (a bright opening
  that shows the world; sunrise read dim and flat from the drone), S6 moves from Sunset to **Night** (the red tail
  lights glow against the dark, and no sun lens-flare ring). The light now runs day, day, day, sunset (drift), night,
  day (the Retro/Ultra comparison), night (the menu).
- End card's last line: **"COMING SOON TO GOOGLE PLAY AND THE APP STORE"** (text only; no store badges or logos).
- Music: **a silent cut with beat ticks**. Nothing has been captured at full length yet. The
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
| S1 | 0.000 | 3.871 | 2 | 116 | Drone over the 405 by day |
| C1 | 3.871 | 5.806 | 1 | 58 | Title card 1 |
| S2 | 5.806 | 9.677 | 2 | 116 | OC Hypercar reveal and LED wake |
| S3 | 9.677 | 12.581 | 1.5 | 87 | Cockpit at speed |
| S4 | 12.581 | 15.484 | 1.5 | 87 | Chase through traffic |
| C2 | 15.484 | 17.419 | 1 | 58 | Title card 2 |
| S5 | 17.419 | 20.323 | 1.5 | 87 | A drift at sunset |
| S6 | 20.323 | 24.194 | 2 | 116 | Red tail lights at night |
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
| S1 | Cinematic, shot 3 ("the drone, high behind") | Drone 8.5 m up, pulling in from 15 to 12 m behind while the car cruises; the freeway runs off ahead | Day, clear | Moderate | OC Hypercar, Glacier Silver (Founder) | 101, 20 s at 31 m/s | off |
| S2 | Garage Founder reveal stage (`openReveal`, `revealHold`) | The stage's own reveal timeline from 1.6 s to its end (6.2 s), stretched over 2 bars: LED wake, the light sweep across the car | The stage's own lighting | none | OC Hypercar, Glacier Silver, ice LEDs | 102 | off |
| S3 | Driver's seat (`cockpit`) | Locked seat view, hands on the wheel, cluster live, the freeway coming at you at ~100 mph | Day, clear | Moderate | Rossini GT, Rossini Red | 103, 25 s at 45 m/s | off (the car's cluster shows speed) |
| S4 | Chase | Behind the car as the autopilot weaves through heavy traffic | Day, clear | Heavy | Vela E, Electric Blue | 104, 25 s at 40 m/s | **on** |
| S5 | Cinematic, shot 2 (low rear three-quarter) | At 0.3 s a 0.3 s handbrake flick to the right, then half opposite lock for 1.2 s: the car slides sideways and gathers itself, then the autopilot drives on | Sunset, clear | Light | Rossini Corsa, Track Yellow | 105, 12 s at 30 m/s | off |
| S6 | Cinematic, shot 0 ("the hero" rear three-quarter) | Long-lens tracking alongside, the tail lights glowing red, traffic ahead | Night, clear | Heavy | Rossini GT, Rossini Red | 106, 30 s at 31 m/s | off |
| S7 | Chase | The same road, car and moment rendered twice, Retro Low (Low + Retro style) and Ultra (traffic differs between the presets: see results); the edit wipes left to right from Retro Low to Ultra across the bar | Day, clear | Moderate | Rossini Brio, Coast Blue | 107, 20 s at 31 m/s | off |
| S8 | Cinematic shot 0 under the menu (the attract drive) | The main menu as a player first sees it, the hypercar driving behind it | Night, clear | Moderate | OC Hypercar, Glacier Silver | 108, 6 s attract | **on** (it is the menu) |


## Title cards (OC Ultra style)

Black-to-graphite background, the OC Ultra silver/ice-blue type (the game's own Jost; the OC mark drawn from
`src/preview/oc-mark.ts`, so it is vector-sharp at 1080p). Each card fades in on its downbeat and cuts out on the
next bar.

- **C1:** "THE REAL 405" / small line: "Orange County's freeways, built from open map data"
- **C2:** "SUNRISE TO MIDNIGHT" / small line: "Five cars. One coast. Your pace."
- **C3 (end logo):** the OC mark, "TOP SPEED OC: ULTRA", and "COMING SOON TO GOOGLE PLAY AND THE APP STORE" (the
  owner's line; text only)

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
- Measured cost: one reference frame takes ~4 min end to end, most of it the page load in software rendering. A full
  shot's per-frame time is measured on the first one; the estimate for the whole capture goes to the owner then, in PT.

## What the reference frames showed (2026-11-25)

All nine frames (S7 twice) rendered with no page errors, on I-405 North, at the expected speeds (S3 101 mph, S4 90 mph,
the cinematic shots ~70 mph).
- **S5's first try failed.** Full lock held for the whole shot spun the Corsa into the sound wall. With the flick and
  opposite lock above, the car slides sideways (frames 30–60) and recovers.
- **A faint ring** shows near the car when the sun is in frame (S6, and late in S5). It is in the 3D render, not page
  UI, most likely the game's sun lens-flare ghost. It is left as the game draws it; S6 can be re-framed or moved to
  Night if you'd rather not have it.
- **S1 at sunrise** reads a little flat and dim from the drone height. Day would be brighter if you prefer.
- **S8:** the menu honours the Night setting (lamps lit, the hypercar's lights on).

## Results (Steps 2 and 3, 2026-11-25 PT)

- **Capture:** 8 shots, 841 frames (S7 twice), 1920x1080, 30 fps, every expected frame present, no page errors.
  Speeds at the end of each shot: S1 70, S3 101, S4 89, S5 44 (after the drift), S6 70, S7 69 and 69, S8 69 mph.
  First pass ~15 min for all eight in two lanes (~3.5 s a frame plus ~3 min of load per shot).
- **The one re-shoot round** went to S1, S4 and S7. The first pass showed the Ultra picture settling over its first
  ~0.8 s (a warm, dim look that then switched), S4 opening on empty road while the chase camera caught up, and S7's
  two halves with different traffic. The fix: a 51-frame settle before recording on those three (`settle` in
  shots.mjs). S1 and S4 came out clean; S7 too, except the traffic.
- **Accepted, not fixed (no rounds left):**
  - **S7 traffic:** Density "none" still spawns some traffic, and the two presets draw different traffic, so Retro
    Low has a truck where Ultra has none. The wipe covers it.
  - **Sky shift:** the sky darkens once for a moment, at S4 frame ~56 and in S7 Ultra's last 3 frames (after the
    wipe). This is the game's own lighting.
  - **Sun ring:** the faint lens-flare ring is in S5's first and last frames.
- **Cut** (`tools/trailer/cut.mjs`, /usr/bin/ffmpeg 6.1.1): `trailer-beats.mp4` (the deliverable: silent, a tick on every
  beat, a ring on every downbeat, a bar.beat counter and a timecode) and `trailer-clean.mp4` (no marks). Both H.264
  High, yuv420p, 1920x1080, 30 fps, 900 frames, 30.000 s, faststart, no audio track. The cards are rendered in the
  game's own page with its OC lockup and type.
- **Frames** stay in the session scratchpad (not committed). To rebuild: the main-link build (812ecfb + cherry-pick
  4897550, `npm run build`), then `capture.mjs --shot=<id>` per shot and `cut.mjs`.
