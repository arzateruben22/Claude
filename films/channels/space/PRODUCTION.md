# Light Minute: production log (episodes 2–6)

Branch `claude/light-minute-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | If the Sun vanished | §8 | delivered (earlier branch): 74.7 s, −14.1 LUFS / −1.9 dBTP, QA PASS |
| 002 | The nearest star | §7 #6 (posts 18 Nov 2026) | **re-delivered 26 Oct** after the recheck: 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.2 LU over music, sync PASS, 0 flashes, qa.py PASS, 1.7 Mbps; render 30 min |
| 003 | Venus day | §7 #2 | **re-delivered 26 Oct** after the recheck: 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.3 LU over music, sync PASS, 0 flashes, qa.py PASS, 2.0 Mbps; render 34 min |
| 004 | Falling Moon | §7 #3 | delivered 26 Oct; **rechecked**: a real bug fixed (the gravity-off beat never played: its cue matched the first "gravity"), side-view and takeaway labels, captions; re-render queued |
| 005 | Sun size | §7 #4 | reviewed, voiced (74.13 s, 17 claims), built; picture fixed 26 Oct (side view, the row, the sunspot close-up, the melt); final queued |
| 006 | Your speed | §7 #5 | reviewed, voiced (74.67 s, 15 claims), built; picture being reworked (the orbit and the galaxy were framed off screen); final queued |

## Recheck and re-render (26 Oct): how it runs
The owner asked for every episode to be rechecked and re-rendered for subtitle and label placement, motion and
picture quality; the coordinating session's readability pass (767b57b: notes one tier down, the spine holding through
the payoff, labels that never cover text, sharper masters at crf 15) is merged. For each episode: rule 8 applied,
stills at the key moments looked at 390 px wide, fixes, then `compile.py` → `render.mjs --cues` → `compile.py` → studio
→ a fresh final → `--assemble --audio build/audio/mix.wav` → `qa.py` → scorecard. Captions now keep number phrases on
one line (`set/capglue.py`). One Chromium job at a time; to resume after a restart, re-run the episode's final with
`render.mjs --film <dir> --tier final --resume` (it keeps every verified frame), then assemble and QA.

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

- **004:** one shot, three views: a close view on the Moon (hook and whoa: its straight line across the frame, the fall
  drawn ×1,000,000 below it), the diagram from above (true scale; the clock at 20,000× so the Moon stays at the frame's
  right), and a side view for Newton's test. Spine: 1.4 mm → 30 → 1 → 5 min → 60 → 1/3,600 → 4.9 m → 4.9 m → gravity.
  Human scale: "look up tonight", New York to Boston. Footnote: the Moon falls about 1.4 mm a second below a straight
  line. The end card pushes back into frame 0.

- **005:** two places, two cuts: the sky (the Moon and the Sun at true angular sizes through a long lens: twins), a cut
  on "But" to the same line seen square-on from far out (Earth and the Moon at one end, the Sun 400 times farther at the
  other), then the Sun at true scale (the row of 109 Earths, a sunspot with an Earth in it, the Peloponnese as a dot, the
  melt into 6,500 beads, the one scale jump to the giants' outline); the end card cuts back to the sky (a loop). Spine:
  ? → 400× · 400× → 1 → 109 → southern Greece → 8,000 → 1,300,000 → 1,000×+ → G2V · dwarf. Human scale: your whole world
  inside one sunspot; a Greek peninsula against the Sun. Footnote: the Sun holds about 99.8% of the solar system's mass.

- **006:** one world on three rungs of the ladder: Earth at the equator ("you"), a pull-back to Earth's orbit, the one
  jump to the galaxy. Spine: ? → 1,670 → 1,225 → 30 → km since this began (live, true speed) → 230 → 230 → first
  dinosaurs → ?. Human scale: the speed of sound, New York to Boston. Footnote: one lap of the galaxy takes the Sun about
  230 million years.

## Questions (for Ruben; the bible's recommendation is taken provisionally)
- None yet.

## Kit changes
See `KIT-CHANGES.md`.
