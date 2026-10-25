# Project status: four science-video formulas to 100%

> **25 Oct, 23:15 UTC: paused at the user's request; see `films/ASSESSMENT-2026-10-25.md`.** The 2-hourly check-in
> is in low-usage mode (restart stalled renders, merge and QA delivered episodes, build a compilation when a channel
> has ep01–05; nothing new). Physics 001–002 and space 001–002 are delivered; body 001 is rendering here (slow scene,
> ~4 h); the three channel sessions are pipelining ep03–05.
>
> **25 Oct, 22:10 UTC: resumed after the weekly limit reset.** The weekly limit stopped everything on 24 Oct
> 03:24 UTC. Physics ep01 v2 is delivered (QA PASS, 62ccebd). render-finals.sh was restarted for space, then body
> (worker restarts kill it: re-run `setsid nohup films/channels/render-finals.sh >/dev/null 2>&1 &`).
> The three channel sessions are resumed and working, now committing at every milestone:
>   Rest Frame `session_01XeV9KyDKhsTHczMRmqhVPa` → `claude/rest-frame-ep02-06`;
>   Light Minute `session_01BAAPP9f3tomRz7SrhFYqeA` → `claude/light-minute-ep02-06`;
>   Meanwhile, Inside `session_01CKYj7J7Avi512i6ioovugE` → `claude/meanwhile-inside-ep02-06`.
> The user's target: 5 shorts per channel (ep01–05) plus one 16:9 compilation per channel (vol01, the 5 shorts
> back to back). ETA ~26 Oct 10:00–15:00 UTC unless a usage limit hits again.
> Prism Studio (the content studio app, `prism-studio/`) Stage A is done (e1c6513); see prism-studio/PROJECT_STATE.md.
> Check-ins: git fetch each branch, help a stalled session, merge delivered episodes into this branch, run
> `npm run import:episodes` in prism-studio, and build each channel's vol01 once it has ep01–05.

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
  - [ ] Physics v2 (v1 delivered 00:28 and superseded by the notes redesign and the new script)
  - [ ] Space v2 (v1 delivered 01:26, superseded)
  - [ ] Body v2
- [ ] Daily routine: one episode per channel per day (scheduled sessions; confirm usage cost with the user)

## Usage pacing (12:07 UTC, 22 Oct; lifted 24 Oct: the user has credits and asked to keep going)
The **weekly (7-day) limit is at "warning"**; it resets **Sat 25 Oct, about 22:00 UTC**. Hitting it
blocks all of the user's Claude use until then, not just this project. Until the user says
otherwise: finish the in-flight episode builds and their review, run the three final renders
(machine time, little usage), assemble, QA and deliver. Do **not** start new multi-agent
workflows or episode 2+ batches; keep check-ins short.

## Effort (24 Oct)
The user turned ultracode off and kept extra effort. Finals need no workflows. For the daily routine: one
session per episode, plus one independent review agent per episode as the quality gate; no multi-agent fan-outs.

## Running state (update when it changes)
- Final render (Skin School): detached `run.sh`, log `films/skin-school-tiktok/build/final/9x16/render.log`.
  A worker restart kills it (seen 07:22 UTC): check with `ps -eo args | grep [r]ender.mjs` (never
  `pgrep -f`, which matches its own command line) and restart with a bare `run.sh` (it resumes).
- Voice toolchain: scratch venv `…/scratchpad/longform/venv`, models `…/scratchpad/models`
  (rebuild with `kits/cinema/voice/setup.sh` if the container was replaced)
- Check-ins: one-off at 07:56 UTC (`trig_01XVdp7UPzjkvHAYaYe3GoGa`), and every 2 h at :04
  (`trig_01RobrDAZpWDmvW9a3s2U5Xb`, disable it when everything is done)
