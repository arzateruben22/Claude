# Light Minute: production log (episodes 2–6)

> **Final summary (27 Oct): episodes 2–6 are delivered.** Each is a fresh final on this branch, `qa.py` PASS, with its
> poster, contact sheet and `review/` (scorecard, HUMAN-REVIEW, CLAIMS-REVIEW). Nothing has been posted.
>
> | No. | Title | Length | Loudness | Voice over music | File | Delivered in |
> |---|---|---|---|---|---|---|
> | 002 | The nearest star | 74.67 s | −14.1 LUFS / −1.9 dBTP | 12.1 LU | 17.0 MB | this commit |
> | 003 | Venus day | 74.67 s | −14.1 LUFS / −1.8 dBTP | 12.3 LU | 26.1 MB | 477a341 |
> | 004 | The falling Moon | 74.13 s | −14.1 LUFS / −1.8 dBTP | 12.5 LU | 15.0 MB | 7e4e3f8 |
> | 005 | How big is the Sun | 74.67 s | −14.1 LUFS / −1.8 dBTP | 12.4 LU | 26.6 MB | 469c0f2 |
> | 006 | Your speed | 74.67 s | −14.1 LUFS / −1.9 dBTP | 12.3 LU | 64.7 MB | 3ed56a4 |
>
> Every one: sound sync PASS, 0 flashes, 0 text warnings in the render's audit, and every label, counter, note and
> caption page checked at its middle and ends (156–175 moments each): none outside the safe box, none on other text.
> How they got here: the coordinating session's script audit applied; then draft-tier review rounds (an independent
> two-lens review of each draft cut, text/layout and picture, every finding verified by a second agent; 32 + 28, 41 + 27,
> 38 + 33, 41 + 37 and 30 + 26 confirmed findings), the fixes code-checked and stills-checked at 1080; finals rendered
> in 10 s chunks, one Chromium job at a time (003 and 005 resumed from kept frames after the owner's pause on 26 Oct).
> No. 006 runs at 6.7 Mbps (star fields, the galaxy, Earth's texture): over GitHub's recommended 50 MB, under its limit.
>
> **Before posting, a person (TODO):** works through each episode's `review/HUMAN-REVIEW.md` and `CLAIMS-REVIEW.md`
> (every claim rests on search excerpts: open each source link and tick it); decides kilometers vs miles for US
> viewers; sets the channel handle (TODO, provisionally @lightminute), the posting accounts and a pinned sources page
> (TODO); applies the platforms' AI label ("Voice: synthetic"). Covers, thumbnails and `out/POSTING.md` are regenerated
> by the coordinating session from these finals (No. 002's still show its 25 Oct cut).

Branch `claude/light-minute-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | If the Sun vanished | §8 | delivered (earlier branch): 74.7 s, −14.1 LUFS / −1.9 dBTP, QA PASS |
| 002 | The nearest star | §7 #6 (posts 18 Nov 2026) | **delivered 27 Oct after the recheck, the script audit and two draft-review rounds (32 + 28):** 74.67 s, −14.1 LUFS / −1.9 dBTP, voice 12.1 LU over music, sync PASS, 0 flashes, qa.py PASS, 17.0 MB; render 30 min |
| 003 | Venus day | §7 #2 | **delivered 27 Oct after two draft-review rounds (41 + 27):** 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.3 LU over music, sync PASS, 0 flashes, qa.py PASS, 26.1 MB; rendered in 10 s chunks either side of the 26 Oct pause |
| 004 | Falling Moon | §7 #3 | **delivered 26 Oct after the cut review (38) and a draft-review round (33):** 74.13 s, −14.1 LUFS / −1.8 dBTP, voice 12.5 LU over music, sync PASS, 0 flashes, qa.py PASS, 15.0 MB; render 42 min |
| 005 | Sun size | §7 #4 | **delivered 27 Oct after two draft-review rounds (41 + 37):** 74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.4 LU over music, sync PASS, 0 flashes, qa.py PASS, 26.6 MB; rendered in 10 s chunks either side of the 26 Oct pause |
| 006 | Your speed | §7 #5 | **delivered 26 Oct after two draft-review rounds:** 74.67 s, −14.1 LUFS / −1.9 dBTP, voice 12.3 LU over music, sync PASS, 0 flashes, qa.py PASS, 6.7 Mbps; render 47 min |

## Recheck and re-render (26 Oct): how it runs
The owner asked for every episode to be rechecked and re-rendered for subtitle and label placement, motion and
picture quality; the coordinating session's readability pass (767b57b: notes one tier down, the spine holding through
the payoff, labels that never cover text, sharper masters at crf 15) is merged. For each episode: rule 8 applied,
stills at the key moments looked at 390 px wide, fixes, then `compile.py` → `render.mjs --cues` → `compile.py` → studio
→ a fresh final → `--assemble --audio build/audio/mix.wav` → `qa.py` → scorecard. Captions now keep number phrases on
one line (`set/capglue.py`). One Chromium job at a time; to resume after a restart, re-run the episode's final with
`render.mjs --film <dir> --tier final --resume` (it keeps every verified frame), then assemble and QA.

## Script audit (26 Oct): what was applied
The coordinating session's audit (`films/audits/2026-10-26/space-ep0N.md` on `claude/made-with-claude-film`) was checked
finding by finding. Fixes that change narration, on-screen text or picture went in before each episode's final (the
episode re-voiced where needed, recompiled and rendered fresh); citation-only fixes went into `claims.json`, and every
`CLAIMS-REVIEW.md` was regenerated. Every claim still rests on search excerpts: a person opens each link before posting.

## Picture rules (WRITING.md "The picture", merged 25 Oct from a0adc1a) and how each episode applies them
- **002:** one world (the hook's local view, then one continuous shot: flight → signal → heliopause → ×12 pull to the
  comet cloud → the jump to Proxima → readout; the end card sits on the hook's composition, so a replay loops);
  spine readout at the left (4.24 → year 1977–2026 → signal hours 24/48 → 2012 → 300 → 30,000 → 1,550 → 75,000 → 1,550),
  then the readout segment; human scale: "Earth to the Moon in 6 hours", the team's two-day wait, "our species wasn't
  in Europe"; end-card footnote: "Voyager 1 reaches one light-day from Earth on 18 November 2026 (NASA)";
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
  ? → 400× · 400× → 1 → 109 → southern Greece → 7,000 → 1,300,000 → 1,000×+ → G2V · dwarf. Human scale: your whole world
  inside one sunspot; a Greek peninsula against the Sun. Footnote: the Sun holds about 99.8% of the solar system's mass.

- **006:** one world on three rungs of the ladder: Earth at the equator ("you"), a pull-back to Earth's orbit, the one
  jump to the galaxy. Spine: ? → 1,670 → 1,225 → 30 → km since this began (live, true speed) → 230 → 230 → first
  dinosaurs → ?. Human scale: the speed of sound, New York to Boston. Footnote: one lap of the galaxy takes the Sun about
  230 million years.

## Questions (for Ruben; the bible's recommendation is taken provisionally)
- None yet.

## Kit changes
See `KIT-CHANGES.md`.
