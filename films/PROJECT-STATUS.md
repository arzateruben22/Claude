# Project status: four science-video formulas to 100%

> **27 Oct, 02:35 UTC:** collected Meanwhile, Inside 004 "The gap" (QA PASS, 74.4 s); 005 rendering (~05:15), 006 next.
>
> **27 Oct, 02:30 UTC:** download library for the owner (every finished video, full quality, straight from this public
> repo): `films/library.py` → https://claude.ai/artifact/DaztNXWu1gmbH8BkXyj4rC, refreshed by the check-in. Own-voice
> narration: `kits/cinema/voice/polish.py` (normal, extra, whisper) and the recording script at
> https://claude.ai/artifact/CJ1jBzjJoXDb5snabSQCzK; recordings go to films/voice-inbox.
>
> **27 Oct, 01:57 UTC: RESUMED by the owner.** Check-in re-enabled (every 2 h from 02:04); both channel sessions told to
> resume their finals from the kept frames (Meanwhile, Inside 004 then 005–006; Light Minute 003, 005, 002).
>
> **26 Oct, 21:20 UTC: PAUSED by the owner** ("pause on everything now"). Final and collected: Rest Frame 001–006 + vol01,
> Meanwhile, Inside 001–003, Light Minute 001, 004, 006. Still to do on resume: Meanwhile, Inside 004 (final was
> rendering, frames kept), 005–006; Light Minute 002, 003, 005 (review fixes, then finals); vol01 for both. The 2-hourly
> check-in (trig_01RobrDAZpWDmvW9a3s2U5Xb) is disabled; both channel sessions were told to stop, keep frames, push resume
> notes and go idle. To resume: re-enable the check-in and send each channel session "resume".
>
> **26 Oct, 20:35 UTC:** collected Light Minute 006 "Your speed" (QA PASS, 74.7 s), then at 20:55 004 "The falling
> Moon" (QA PASS, 74.1 s); the branch's 002–003 renders predate the audit and stay there. Meanwhile, Inside 004 final due ~22:00, 005 ~01:00, 006 ~04:00 UTC; Light Minute 002–005
> in review fixes. Prism Studio: each channel screen now shows its long video; the wall counts ones waiting on approval.
>
> **26 Oct, 19:30 UTC:** collected here (QA PASS): Rest Frame 001–006 + vol01 "Forces you can see" (lesson,
> ready for review), Meanwhile, Inside 001–003, Light Minute 001. Rendering in the channel sessions: Light Minute
> 002–006, Meanwhile, Inside 004–006. The 2-hourly check-in collects them as they land, builds the other two vol01s,
> and refreshes the clickable preview.
>
> **26 Oct, 18:10 UTC:** Rest Frame 001 v3.1 delivered here (QA PASS; fact-audit fixes + label polish, independently
> checked). At the new standard now: Rest Frame 001–006 (002–006 on claude/rest-frame-ep02-06, not yet merged here),
> Meanwhile, Inside 001–003 (on its branch), Light Minute 001. Prism Studio complete except what needs the owner.
>
> **26 Oct, 09:50 UTC: PAUSED by the owner.** Final at the new standard (readability kit + 26 Oct fact audit): Light
> Minute 001 and Rest Frame 003 (2 of 18 shorts; 0 of 3 compilations). Light Minute 004's 08:54 render predates a
> caption-timing fix and 38 review fixes, so it is not final. All 18 scripts are written, audited and fixed. The
> channel sessions stopped their in-flight finals with frames kept: Rest Frame 002 at 2070/2184 (~2 min to finish),
> Meanwhile, Inside 002 at 1290/2184 (~35 min); Light Minute has resume notes atop its PRODUCTION.md. At 09:55 the owner
> asked for everything but Prism Studio to stay paused: Meanwhile, Inside 001's final was stopped too (frames kept; resume
> with films/channels/rerender-finals.sh films/channels/body/ep01). Only the Prism Studio completion workflow runs; after
> it, nothing continues until the owner says so. Stopped: the Rest Frame 001
> polish workflow (resume run wf_4be75c8c-873; edits so far committed) and the 2-hourly check-in
> (trig_01RobrDAZpWDmvW9a3s2U5Xb, disabled). Rest Frame 001's final stays held (scratchpad RERENDER-HOLD).
>
> **26 Oct, 08:15 UTC:** independent script audit of every episode done (`films/audits/2026-10-26/`: ep02–06 ×3,
> ep01 ×3, ep06 physics/body; each finding adversarially verified). Space and physics sessions applied theirs; body
> working. Here: Light Minute 001 fixed (label fits the safe box, c15, small footnote; sound QA no longer misreads a
> masked tick) and its last chunks re-render; Rest Frame 001 (no-firearms line, badge, count) and Meanwhile, Inside
> 001 (stretch/sickle lines) are being fixed and re-voiced before their finals. Hosting for Prism Studio built and
> tested (`prism-studio/deploy/`). A session limit paused work 06:00–08:00.
>
> **26 Oct, 04:05 UTC check-in:** space ep01 re-render 19%; body session merged the kit; physics + space sessions rechecking (space delivered No. 004 on the old kit before the merge: it will be re-rendered).
>
> **26 Oct, 03:50 UTC: full speed until completion (owner).** Readability pass landed (767b57b: notes one tier down,
> spine readout holds through the payoff, labels never cover text, sharper masters; space ep01 fixes incl. the 23 s
> early-arrival bug). This container re-renders ep01 ×3 with it (`films/channels/rerender-finals.sh`, log
> films/channels/rerender.log); the three channel sessions merge it and deliver ep02–06 re-rendered at this quality.
> Prism Studio redesign in progress: code-rendered NYC night skyline, six-monitor home (Instagram centre), a screen
> per channel, designed covers/thumbnails.
>
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
