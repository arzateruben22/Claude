# Meanwhile, Inside: production log, episodes 2–6

Branch `claude/meanwhile-inside-ep02-06`. One line per episode, updated as it moves:
scripted → reviewed → voiced → built → stills OK → rendering → delivered (+ QA numbers).
These five feed the first long-form compilation (with episode 1).

| # | Title | State |
|---|---|---|
| 01 | Single file | **delivered** (v3 final, 71.6 s, −14.1 LUFS, QA PASS): the 26 Oct audit's fixes, a sickle cell on screen, balanced captions |
| 02 | A billion passengers | **delivered** (72.8 s, −14.1 LUFS, QA PASS) |
| 03 | The jump | **delivered** (74.8 s, −14.1 LUFS, QA PASS, 0 flashes) after a three-lens frame review (drum mirrored so time reads left to right, labels, readouts) |
| 04 | The gap | **delivered** (74.4 s, −14.1 LUFS, QA PASS, 0 text warnings) after a verified frame review (the messenger mist, readouts, labels) |
| 05 | Where breath goes | **delivered** (74.4 s, −14.1 LUFS, QA PASS, 0 text warnings) after a verified frame review (the thickened wall slows the oxygen's crossing, labels, readouts) |
| 06 | The exit | verified frame-review fixes applied and re-checked · soundtrack −14.1 LUFS, sync PASS · **final rendering** (27 Oct from 04:58 UTC) |

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
One kit change, opt-in (`KIT-CHANGES.md`): `timeline.py`'s balanced caption pager (`balance=True` and a `keep`
list per episode), which ends the one-word caption tails; the default path is byte-identical for episode 1. Pulse pink is now kept to blood in every episode: nerve readouts take the
nerve colour, ep05's take the text colour.

## Fact-check audit (26 Oct, from the coordinating session)
An independent audit of the scripts (findings adversarially verified; reports on `claude/made-with-claude-film`,
`films/audits/2026-10-26/body-ep0N.md`) was applied before any final render; each finding was checked against the
files first, and each episode then had an independent check of the changes. Every source still rests on search
excerpts: a person opens each link before posting (each HUMAN-REVIEW).
- **ep02:** "Your veins look blue" → "Veins often look blue" (re-voiced); the hook's "not to scale" and the change's
  "illustration · slowed" badges were already on screen; the end-card fact was already there; c11's source named.
- **ep03:** "Some fibres reach from spine to toe: about a metre" (no "longest"; the readout "spine to toe: about
  1 m"); "Thick wrapped ones, up to a hundred and fifty" with the race's wrapped fibre drawn thicker; "Many of your
  fibres…"; "faster fibres".
- **ep04:** the electron-microscope-style view badged "illustration · not to scale" (through its slowed replay);
  "Through a lens, they look joined" (new c17); "Camillo Golgi, who made the stain…" / "With it, … Cajal…"; "A
  typical nerve cell reaches thousands of others"; "touching: ?"; c3 and c12 re-sourced (Tang 2001; Martin,
  Grimwood & Morris 2000).
- **ep05:** "an animal's lung"; "about seventy square metres" + "About a quarter of a tennis court" (the court is
  now a full doubles court, 260.8 m²; the badge carries "estimates 50–140 m²"); "Over much of it … under half a
  micrometre"; "clotted blood" (Galenic teaching, sourced); the tally was already 5.5 L a minute.
- **ep06:** the tease asks "What sets off nearly every heartbeat you have?" (the embryo's first beats and ectopic
  beats are not the SA node's; the bible's row 7 now says so for episode 7); "past" pinned in `pron.json`.

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
