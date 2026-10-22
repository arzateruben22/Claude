# Project status: four science-video formulas to 100%

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
- [ ] Final render: `films/skin-school-tiktok/motion/run.sh status` (started 06:47 UTC, ~3 h)
- [ ] Assemble with `build/audio/mix.wav`, QA (safe box, contrast, flashing, sync), out/ delivery
- [ ] assets.md, HUMAN-REVIEW.md, scorecard; commit; send to the user
- [ ] (needs the user's OK) tell Evelyn's session about the plug fix and the liquid drops

## 2–4. Three channels: human body, space, physics (separate channels)
User choices: separate channels, curious adults / wonder, 60–75 s, a different narrator each.
- [ ] Series bibles (workflow `wf_73fbfacf-23e`; resume it if it stalled) → `films/channels/<name>/bible.md`
- [ ] Decisions (provisional unless the user picks): name, palette/type, sound preset, narrator (auditions)
- [ ] Generic pipeline: renderer + page template not tied to Lumevina; shared caption/label overlay; `kits/cinema/sci/` blocks
- [ ] Per channel: set (3D stage + blocks), episode 1 script → voice → compile → scene → soundtrack → preview
- [ ] Per channel: final render (sequential, one render at a time, ~3 h each), assemble, QA, deliver
- [ ] Daily routine: one episode per channel per day (scheduled sessions; confirm usage cost with the user)

## Running state (update when it changes)
- Final render (Skin School): detached `run.sh`, log `films/skin-school-tiktok/build/final/9x16/render.log`
- Voice toolchain: scratch venv `…/scratchpad/longform/venv`, models `…/scratchpad/models`
  (rebuild with `kits/cinema/voice/setup.sh` if the container was replaced)
- Check-ins: one-off at 07:56 UTC (`trig_01XVdp7UPzjkvHAYaYe3GoGa`), and every 2 h at :04
  (`trig_01RobrDAZpWDmvW9a3s2U5Xb`, disable it when everything is done)
