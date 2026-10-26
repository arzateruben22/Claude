# Light Minute: production log (episodes 2–6)

Branch `claude/light-minute-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | If the Sun vanished | §8 | delivered (earlier branch): 74.7 s, −14.1 LUFS / −1.9 dBTP, QA PASS |
| 002 | The nearest star | §7 #6 (posts 18 Nov 2026) | **delivered** 25 Oct: 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.2 LU over music, sync PASS, 0 flashes, qa.py PASS; render 31 min |
| 003 | Venus day | §7 #2 | **delivered** 26 Oct: 74.67 s, −14.1 LUFS / −1.7 dBTP, voice 12.3 LU over music, sync PASS, 0 flashes, qa.py PASS (chunk 001 re-rendered for a camera fix) |
| 004 | Falling Moon | §7 #3 | reviewed, voiced (73.07 s, 18 claims), compile + scene written, soundtrack built (−14.1 LUFS, 12.5 LU, sync PASS; pre-cues), docs drafted; **next: animatic/final-tier stills (picture not checked yet)** |
| 005 | Sun size | §7 #4 | reviewed, voiced (74.13 s, 17 claims), compile + scene written, soundtrack built (−14.1 LUFS, 12.4 LU, sync PASS; pre-cues), docs drafted; **next: stills (picture not checked yet)** |
| 006 | Your speed | §7 #5 | scripted, reviewed (fixes applied), lint 0 errors, 15 claims; not voiced (waits for 005 per the coordinating session) |

## Paused (the user, 25 Oct ~23:27 UTC): how to resume
1. `git status`; `ps -eo args | grep "[r]ender.mjs"` (nothing should run). Voice venv: `kits/cinema/voice/setup.sh <dir>` if the container was replaced.
2. 003: if `out/lightminute-003-9x16.mp4` is missing, `kits/cinema/film/run.sh films/channels/space/ep03` (resumes), then
   `--assemble --audio build/audio/mix.wav`, contact sheet to `out/`, `qa.py`, `scorecard.py` → `review/scorecard.md`.
3. 004, then 005: `render.mjs --tier animatic/final --times …` stills → fix → `--cues` → compile → studio → `run.sh --tier final` → deliver.
4. 006: voice (`voice.py`), compile.py and scene.mjs (not written yet), then as above.
5. Then the summary at the top of this file and the one-line-per-episode reply to the coordinating session.

## Picture rules (WRITING.md "The picture", merged 25 Oct from a0adc1a) and how each episode applies them
- **002:** one world (the hook's local view, then one continuous shot: flight → signal → heliopause → ×12 pull to the
  comet cloud → the jump to Proxima → readout; the end card sits on the hook's composition, so a replay loops);
  spine readout at the left (4.24 → year 1977–2026 → signal hours 24/48 → 2012 → 300 → 30,000 → 1,550 → 75,000 → 1,550),
  then the readout segment; human scale: "Earth to the Moon in 6 hours", the team's two-day wait, "our species hadn't
  reached Europe"; end-card footnote: "Voyager 1 reaches one light-day from Earth on 18 November 2026 (NASA)";
  energies build to the whoa (0.8) and drop for the takeaway (0.3).

- **003:** one shot that alternates a close view following Venus (hook, the guesses, the radar, the true turn) with the
  diagram (sunrises, the whoa, the readout); the end card pushes back into the hook's close view (a loop). Spine: ? → 365 →
  23 hours → 225 days → 243 → 243 > 225 → 117 → west → 117. Human scale: "you see the Sun rise", the pin ("you").
  Footnote: radar first timed Venus's turn in 1962. Two clocks (orbit, spin) so the why shows one 243-day turn alone.

## Questions (for Ruben; the bible's recommendation is taken provisionally)
- None yet.

## Kit changes
See `KIT-CHANGES.md`.
