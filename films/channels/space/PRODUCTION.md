# Light Minute: production log (episodes 2–6)

> **Paused 26 Oct, about 15:45 UTC (by the owner, once the running jobs had finished).** Nothing is rendering or
> reviewing. Method: draft-tier review rounds (`render.mjs --tier draft`, 540×960 at 15 fps) → an independent two-lens
> review per draft (text/layout and picture, each finding verified by a second agent) → the fixes (an implementer, an
> independent code check, then a stills check at 1080) → another draft and review where a round found a lot → the five
> finals one at a time (about an hour each on 4 CPUs) → QA, scorecards, docs, the reply to the coordinating session.
> None of the five has its fresh final yet (No. 004's 26 Oct delivery predates the caption fix and both review rounds).
>
> | No. | Where it stands | Next |
> |---|---|---|
> | 002 | round 1's 32 findings applied, code-checked and stills-checked (the 2012 tick pale, not royal blue; the end push eased to 5%/s); round-2 draft rendered | review the round-2 draft (re-render it first if the scratchpad is gone: about 12 min) |
> | 003 | round 1's 41 findings applied; the round-2 review confirmed 27 more, saved unapplied in `ep03/review/DRAFT-REVIEW-2.md` (3 high, two of them the same bug: the "you" label never shows, because `A("vo05:The")` takes the first "the"; and the "your sky" dial is empty on "west" and on the poster frame, the Sun rising at W only after the phrase) | apply them, stills, then the final |
> | 004 | its cut review's 38 and the round-2 draft review's 33 applied and code-checked; after the check, the takeaway fan spread to 3.5° and the pull-back's turn cut from 21.5° to 6.5° (arc rule). Stills at 1080 after the pause request show: the lilac fall and drop lines, the 30-Earths row and the speed arrows still bloom royal blue (keep these under the bloom knee: `line(tok, ≤0.85)`); the swing's middle (42–43 s) is nearly empty; the takeaway's fan reads as a thick arc on the orbit, not a fan | those three, then a round-3 draft and review |
> | 005 | round 1's 41 applied, code-checked and stills-checked (the why beat lower so the Anaxagoras card clears the Sun, the readout framed wider, the outline gone on "Sun to Earth", the push at "thousand" under 5%/s, the sunspot's Earth shrinks away); the round-2 review confirmed 37 more, saved unapplied in `ep05/review/DRAFT-REVIEW-2.md` (2 high: "southern Greece" points at its own anchor dot, not the Peloponnese dot; and the readout's light trip plays in a 65 px orbit, smaller than its own label, after my wider framing) | apply them, stills, then the final |
> | 006 | round 2's 26 applied and code-checked; stills at 1080 after the pause request: Earth now dark under Galileo's cabin, the cabin reads (butterflies, hull in the water, waves to the edge), the star cloud fills the jump at 40.5 s, the lap reads lilac, "230 million" fits, the end card arrives over a dimmed galaxy. Left: the jump still opens on a single dot (39.9 s), and at 41.3 s the star ball collapses into a grey "hairball" by the Sun | those two, a round-3 draft or straight to the final |

Branch `claude/light-minute-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | If the Sun vanished | §8 | delivered (earlier branch): 74.7 s, −14.1 LUFS / −1.9 dBTP, QA PASS |
| 002 | The nearest star | §7 #6 (posts 18 Nov 2026) | re-delivered 26 Oct after the recheck (74.67 s, −14.1 LUFS, QA PASS); **script audit applied** (4 lines re-voiced, end card); fresh final queued |
| 003 | Venus day | §7 #2 | re-delivered 26 Oct after the recheck (74.67 s, −14.1 LUFS, QA PASS); **script audit applied** (vo03 re-voiced, dial label, day counter, sources); fresh final queued |
| 004 | Falling Moon | §7 #3 | **delivered 26 Oct after the cut review (38) and a draft-review round (33):** 74.13 s, −14.1 LUFS / −1.8 dBTP, voice 12.5 LU over music, sync PASS, 0 flashes, qa.py PASS, 15.0 MB; render 42 min |
| 005 | Sun size | §7 #4 | rechecked (side view, row, sunspot, melt, ×7,000 ring); **script audit applied** ("Bigger, yes", "seven thousand", "no giant"; 19 claims); fresh final queued |
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
