# Project status: four science-video formulas to 100%

> Resumed 24 Oct, 00:13 UTC ("Keep finishing and going"): finals driver restarted (physics resumed at frame 1770),
> the 2-hourly check-in re-enabled.

The user's instruction (2026-10-22): keep going until all four formulas are complete, through
usage limits (continue after each reset). Check-ins are scheduled into this session; each one
reads this file, checks what is running, and continues with the first unchecked step. Choices the
user hasn't made are taken from the bibles' recommendations and marked **provisional**.
Outward messages (e.g. to Evelyn's Lumevina session) still wait for the user's OK.

## Definition of done

For each formula: a finished 60–75 s 9:16 episode (1080×1920, the full finish, mastered
soundtrack), measured QA, posters and a contact sheet in `out/`, an assets list, a human-review
note, a review sheet for whoever signs off claims, and the pipeline documented so the next
episode is one script away. Plus the daily routine: one episode per channel per day.

## 1. Skin School (Lumevina): "Why does a pore clog?" (`films/skin-school-tiktok/`)
- [x] Script, style guide, shot list approved; narrator af_heart; calm-and-clean score
- [x] Voice + word timings, compiler, scene, soundtrack (−14.1 LUFS / −1.9 dBTP, sync PASS)
- [x] Previews 1 and 2 reviewed (labels, captions fixed; sound confirmed playing)
- [x] Final render (done 10:17 UTC; resumed once after a worker restart)
- [x] Assembled: `out/skin-school-pore-9x16.mp4` (−14.1 LUFS / −1.9 dBTP on the file, audit 0 warnings, flashing pass)
- [x] assets.md, review/HUMAN-REVIEW.md, review/scorecard.md; committed; sent to the user
- [ ] (needs the user's OK) tell Evelyn's session about the plug fix and the liquid drops

## 2–4. Three channels: human body, space, physics (separate channels)
User choices: separate channels, curious adults / wonder, 60–75 s, a different narrator each.
- [x] Series bibles + cross-check → `films/channels/<name>/bible.md`, `films/channels/crosscheck.json`
- [x] Decisions (provisional): `films/channels/DECISIONS.md`; narrator auditions sent to the user
- [x] Generic pipeline (commit 3e15da9): kits/cinema/film, sci/hud.js + clock.js, studio voices + presets, fonts + themes,
  script linter + claims + episode-1 scripts. Still to do after the Skin School render: cinema3d probe2 (opt-in).
- [x] Per channel: set + episode 1 built, reviewed (go), fixes applied (29d4e70); previews sent to the user
- [ ] Per channel: final render + assemble: `films/channels/render-finals.sh` (detached, sequential physics → space → body,
  idempotent; log `films/channels/finals.log`). If no `kits/cinema/film/render.mjs` process is alive and the log
  doesn't end in 'all three finals delivered', restart it: `setsid nohup films/channels/render-finals.sh >/dev/null 2>&1 &`.
  Then per episode: QA on the delivered file (loudness, audit, flashing), scorecard, assets.md, HUMAN-REVIEW.md, commit, send.
- [ ] Daily routine: one episode per channel per day (scheduled sessions; confirm usage cost with the user)

## Usage pacing (12:07 UTC, 22 Oct)
The **weekly (7-day) limit is at "warning"**; it resets **Sat 25 Oct, about 22:00 UTC**. Hitting it
blocks all of the user's Claude use until then, not just this project. Until the user says
otherwise: finish the in-flight episode builds and their review, run the three final renders
(machine time, little usage), assemble, QA and deliver. Do **not** start new multi-agent
workflows or episode 2+ batches; keep check-ins short.

## Running state (update when it changes)
- Final render (Skin School): detached `run.sh`, log `films/skin-school-tiktok/build/final/9x16/render.log`.
  A worker restart kills it (seen 07:22 UTC): check with `ps -eo args | grep [r]ender.mjs` (never
  `pgrep -f`, which matches its own command line) and restart with a bare `run.sh` (it resumes).
- Voice toolchain: scratch venv `…/scratchpad/longform/venv`, models `…/scratchpad/models`
  (rebuild with `kits/cinema/voice/setup.sh` if the container was replaced)
- Check-ins: one-off at 07:56 UTC (`trig_01XVdp7UPzjkvHAYaYe3GoGa`), and every 2 h at :04
  (`trig_01RobrDAZpWDmvW9a3s2U5Xb`, disable it when everything is done)
