# Rest Frame No. 005, "The spinning chair"

Episode 5 of Rest Frame, the physics channel (films/channels/physics). It is 66.9 s long, 9:16, narrated by af_bella
at speed 1.0 (a synthetic voice, labelled as AI). It pays off episode 4's tease ("Next: a spinning office chair. Pull in
your arms, and you accelerate. Why?") and sets up episode 6. **Nothing has been posted.** A physicist signs off the
script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish) | `out/rest-frame-005-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep05.jpg` |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Why does it speed *up*? Nobody pushes. Nothing pushes." | From above at ×1/2: the mannequin on the swivel chair mid-pull, the dumbbells' ghost spiral curling in |
| normal | "Sit on a swivel chair with two dumbbells, arms out wide. Give yourself one gentle push. You turn about once every two *seconds*." | The push lands on "push."; 30 rpm with the arms out, a ghost every 1/10 s 18° apart; the spine counts rpm |
| change | "Now pull both dumbbells in, to your chest. Suddenly, you're whipping round more than twice as *fast*." | The arms come in from "pull" to "chest."; 80 rpm; the ghost gaps open up; the model's assumption on a card |
| why | Nothing *outside* pushed; with no twist from outside the total amount of spin can't change; weight near the middle is easier to turn; your arms paid for every extra turn | From above down to the side; the arms out again on "Weight near the middle" (slower), in again on "turns you faster" |
| whoa | "Skaters use this. In twenty fifteen, a young Canadian skater spun at three hundred forty-two turns a *minute*. Nearly six turns a second." | An ink skater (a scratch spin) beside the chair, motion arcs; the spine climbs to 342 rpm |
| measure | "*Measure it*: ghosts a tenth of a second apart. Arms out, eighteen degrees. Arms in, nearly *fifty*." | Frozen from above: the arms-out ladder (18°) and the arms-in ladder (48°) |
| takeaway | "One push set your total spin. Your arms just decide how *fast*." | Spinning on, arms in; "Friction ignored" |
| tease | "Next: a drinking straw, three storeys tall. Could you still *drink* through it?" | Back to the hook's moment for the loop; footnote: Olivia Oliver's 342 rpm record |

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (156 spoken), 12 claims, the footnote's claim, pronunciations (none needed) |
| `vo/`, `compile.py`, `scene.mjs` | The voice, the direction, the picture |
| `../set/spin.js`, `../set/chair.js`, `../set/bench_py.py` (`Spinner`) | **New reusable blocks**: a spin whose moment of inertia changes (angular momentum conserved, several arm moves), and the swivel chair with its seated wooden mannequin (two-bone IK arms) |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep05`.
