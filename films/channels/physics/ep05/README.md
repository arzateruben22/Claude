# Rest Frame No. 005, "The spinning chair"

Episode 5 of Rest Frame, the physics channel (films/channels/physics). It is 66.9 s long, 9:16, narrated by af_bella
at speed 1.0 (a synthetic voice, labeled as AI). It pays off episode 4's tease ("Next: a spinning office chair. Pull in
your arms, and it spins faster. Why?") and sets up episode 6. **Nothing has been posted.** A physicist signs off the
script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish; not rendered yet: it renders on the current direction) | `out/rest-frame-005-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep05.jpg` (made from the final) |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Why does it speed *up*? Nobody pushes. Nothing motorized." | From above at ×1/2 ("2× slower" bottom-right, while the title drop owns the top): the mannequin on the swivel chair mid-pull, the dumbbells' ghost spiral curling in; "2 kg each" from "Nobody" |
| normal | "Sit on a swivel chair with two dumbbells, arms out wide. Give yourself one gentle push. You turn about once every two *seconds*." | "80 cm from the axis" from "wide." until the push lands on "push."; 30 rpm with the arms out, a ghost every 1/10 s 18° apart; the spine counts rpm ("spin rate") |
| change | "Now pull both dumbbells in, to your chest. Suddenly, you're whipping round more than twice as *fast*." | The arms come in from "pull" to "chest." ("20 cm"); 80 rpm; the arms-in ghosts' gaps open up as the arms-out ladder steps back to a third; the model's assumption on a card from "Suddenly," |
| why | "It feels like something pushed. Nothing *outside* did. With no twist from outside, your total amount of spin can't change. Weight near the middle is easier to turn, so the same amount turns you *faster*. Your arms paid for every extra turn." | The arms-in ghosts step back to a third, and both ladders leave on "With" as the camera turns from above down to the side; the arms out again on "Weight near the middle" (slower), in again on "turns you faster"; "your arms do the work" from "arms" |
| whoa | "Skaters use this. The record, set by a young Canadian skater: three hundred forty-two turns a *minute*. Nearly six turns a second." | An ink skater (a scratch spin) beside the chair, motion arcs, "Illustration" from "use" to "skater"; the chair and its sitter step back to a third from "Skaters"; the spine keeps the chair's 80 rpm until "three", then "fastest spin on ice skates" climbs to 342 rpm, lit from "minute." |
| measure | "*Measure it*: ghosts a tenth of a second apart. Arms out, eighteen degrees. Arms in, nearly *fifty*." | Frozen from above: the arms-out ladder ("18°" from "eighteen" to "Arms in") and the arms-in ladder ("48°" from "nearly"), both full on "ghosts a tenth of a second apart", then each full while its number is said and a third while the other's is; the spine: the turn per 1/10 s, 18° then 48° (lit from "fifty.") |
| takeaway | "One push set your total spin. Your arms just decide how *fast*." | Spinning on, arms in, the chair full again; the record's ghosts at a third, gone on "Your arms"; the spine held lit at 80 rpm, "one push, arms in"; "Friction ignored" |
| tease | "Next: a drinking straw, three stories tall. Could you still *drink* through it?" | Back to the hook's moment at ×1/2 ("2× slower" top-left) for the loop; footnote: Olivia Oliver's 342 rpm record |

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (155 spoken), 12 claims, the footnote's claim, pronunciations (none needed) |
| `vo/`, `compile.py`, `scene.mjs` | The voice, the direction, the picture |
| `../set/spin.js`, `../set/chair.js`, `../set/bench_py.py` (`Spinner`) | **New reusable blocks**: a spin whose moment of inertia changes (angular momentum conserved, several arm moves), and the swivel chair with its seated wooden mannequin (two-bone IK arms) |
| `../set/spine.js`, `../set/captions_py.py`, `../set/aces.js` (`unlit`, `screenAlpha`) | Shared blocks: the readout's place, the phrase-broken captions, the paper's scene-light value and the opacity at which a mark keeps a given share of its contrast against the paper on screen |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep05`.

## Notes

- Rule 8 ("One line wins") is built in: `FILM.dim` steps what delivered the last line back to a third over 0.5 s from a
  cut or a word: the arms-out ghosts at the change's cut (12.78 s), as the arms-in ghosts open up; the arms-in ghosts at
  the why's cut (19.18 s); both live ladders leave on "With" (gone by 23.38 s) as the camera turns; the chair and its
  sitter from "Skaters" (36.87 s) through the measure, while the skater and then the record's ghosts win, full again
  from the takeaway's cut (55.72 s). In the measure the arms-in ladder is a third under "Arms out, eighteen degrees"
  (from 51.90 s) and full again on "Arms in" (53.80 s), when the arms-out ladder steps back and the "18°" pill leaves
  (48° is the one bright pill); the arms-in ladder is a third again from the takeaway's cut, and both leave on "Your
  arms" (gone by 58.42 s). Labels are gone by their beat's cut; speed notes sit top-left (the hook's bottom-right,
  while the title drop owns the top), standing cheats top-right, at most two per corner; the "Illustration" tag stays
  4 s at most; the spine holds lit at 342 rpm from "minute." to the measure's cut, and from "fifty." (48°) through the
  takeaway (80 rpm, "one push, arms in"). A third is a third of the contrast on screen: the ghosts' opacity and the chair's lerp
  toward the paper both act in scene light, before the finish's ACES curve, so opacity 1/3 (or a two-thirds lerp) would
  keep only about 1/11; each strength goes through `screenAlpha` (`../set/aces.js`) first, so a third is an opacity of
  about 0.7 (a lerp of about 0.3).
- The rule-8 fix stage split the whoa's spine (the chair's 80 rpm stays under "spin rate" from the whoa's cut until
  "three", so the record's label arrives with its number), removed the "easier to turn" label (its end, "your total
  amount", came before its start, so it never showed and its cue sounded over nothing) and made "18°" leave on "Arms in".
- The coordinating session's fact audit (26 Oct, fa0e26b) changed the hook ("Nothing motorized.", not "Nothing
  pushes.": the arms do push the body round from inside), the whoa ("The record, set by a young Canadian skater:", the
  year left to the end-card footnote) and the why ("so the same amount", not "so that same amount"); the changed lines
  were re-voiced.
