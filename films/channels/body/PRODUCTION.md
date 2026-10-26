# Meanwhile, Inside: production log, episodes 2–6

Branch `claude/meanwhile-inside-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).
These five feed the first long-form compilation (with episode 1).

| # | Title | State |
|---|---|---|
| 02 | A billion passengers | reviewed · voiced (72.8 s, lint 0/0) · visual review fixes applied · stills OK at 390 px · soundtrack −14.1 LUFS / −1.9 dBTP, sync PASS, voice 15.9 LU over music · **rendering** final (restarted 26 Oct 05:34 UTC after the backdrop fix) |
| 03 | The jump | reviewed · voiced (74.8 s, lint 0/0) · visual review fixes applied in code (the race, the hook's spike train, the drum, readout colours, the figure) · first looks, cues, soundtrack, stills next (after ep02's final frees Chromium) |
| 04 | The gap | reviewed · voiced (74.0 s, lint 0/0) · visual review fixes applied in code (the joined-looking hook, the field's used junction, the gap readout, the bursts) · first looks next |
| 05 | Where breath goes | reviewed · voiced (74.4 s, lint 0 errors) · visual review fixes applied in code (the hook's cut, the wall at its true 0.5 µm, the sponge, the squeeze above the caption) · first looks next |
| 06 | The exit | scripted (three drafts, judge panel) · independently reviewed (6/10; fixes applied, 25 claims, lint 0/0) · voiced (74.4 s) · direction + scene written with a new set block (`set/wanderer.js`) · first looks next |

## Visual review (26 Oct)
A multi-agent review (motion, layout, graphics, honesty lenses per episode; raw findings in the session's
scratchpad) went over the ep02–ep05 builds at 390 px and HD. The real fixes went into each episode's
`compile.py` / `scene.mjs`; the channel-wide ones into `set/`:
- `set/look.js`: the ACES inverse that builds the backdrop started Newton at its target and landed where ACES
  clips red to 0, so the gradient's centre (bg-hi `#123A33`) came out `#002A22` in every episode, episode 1
  included. It now starts from a grey guess and each backdrop stop is checked to round-trip. A fog-start
  uniform (default 0, so nothing else changes) lets an episode keep the subject clean and sink the far planes.
- `set/motif.js`: the locator takes an opt-in plate (the 4.5:1 floor on bright grounds) and an opt-in round-trip
  loop (heart → lungs → body); episode 1's call is unchanged.
- `set/neuron.js`: smoother paranode tapers (half the lathe's samples in the tapers).
- `set/hemoglobin.js` (ep02 only): a dark-red protein instead of grey plastic, a material per iron so each can
  glint, a glow parameter.
- `set/wanderer.js` (new, ep06): the neutrophil.
No kit file changed (`KIT-CHANGES.md`). Pulse pink is now kept to blood in every episode: nerve readouts take the
nerve colour, ep05's take the text colour.

## Running order from here
One Chromium job at a time: ep02's final (≈3 h) → ep03 looks, cues, soundtrack, stills → ep03 final → ep04 → ep05 →
ep06. Each final: `kits/cinema/film/run.sh <ep> --tier final` (detached; a bare `run.sh <ep>` resumes it), then
assemble with `--audio build/audio/mix.wav`, the contact sheet to `out/`, `qa.py`, `scorecard.py`, the review
docs, commit and push.

## Picture rules (WRITING.md "The picture", merged 25 Oct from the coordinating session)
Applied from episode 2 on: a spine readout through each episode (its label names the beat); the body
locator as the human-scale anchor; every beat changes the picture; the last frame irises back to frame 0's
composition under the end card, which carries one sourced fact; the score builds to the whoa and drops for
the reframe. Rule 8 ("One line wins", merged 26 Oct): the named object is the brightest; speed notes top left,
standing cheats top right, at most two per corner. Body's no-circles rule and identity unchanged.

## Questions (for Ruben; the bible's recommendation is taken provisionally)
- **Beat order.** WRITING.md's table puts the segment before the takeaway; episode 1 (and so the channel) runs
  takeaway → meanwhile → tease. Two reviewers flagged it. Provisional: keep episode 1's order for the series.
- **Episode 1's backdrop.** Its delivered render carries the old backdrop bug (a darker, colder centre). Re-render it
  so the series matches? Provisional: leave it as delivered; the difference is subtle.
