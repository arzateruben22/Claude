# Light Minute: production log (episodes 2–6)

Branch `claude/light-minute-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | If the Sun vanished | §8 | delivered (earlier branch): 74.7 s, −14.1 LUFS / −1.9 dBTP, QA PASS |
| 002 | The nearest star | §7 #6 (posts 18 Nov 2026) | **delivered** 25 Oct: 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.2 LU over music, sync PASS, 0 flashes, qa.py PASS; render 31 min |
| 003 | Venus day | §7 #2 | reviewed, voiced (74.67 s, 17 claims), built (−14.1 LUFS, voice 12.3 LU over music, sync PASS), stills OK, **rendering final** (from 22:52 UTC) |
| 004 | Falling Moon | §7 #3 | reviewed (fixes applied), voiced (73.07 s, lint 0 errors, 18 claims) |
| 005 | Sun size | §7 #4 | reviewed (fixes applied), voiced (74.13 s, lint 0 errors, 17 claims) |
| 006 | Your speed | §7 #5 | — |

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
