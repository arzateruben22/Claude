# ep07 clarity and pacing review (standards v2)

Lint (the `lint.py` from commit 3108849, run on this script): whole script grade about 2.2 (target 7 or below); no beat
over grade 8; no sentence over 22 words; pace 2.4–2.9 words/s; hook question ends about 1.9 s in; 0 errors.

Rewrites and why:
- Hook "Let go of a slinky, and the bottom just hangs there" became "Does a slinky's bottom fall? Not for a while."
  A question by 2 s, and the answer is the video's promise.
- Takeaway extended to "News at one end takes time to reach the other, even through a spring." (14 words) so the idea
  is stated in plain words once.
- Hook "Not at first…" variants cut: three short sentences in a row dragged.
- "Wave" is explained in the same breath ("it travels down the coils").

Not yet done: a read-aloud pass on the rendered voice, the draft render, and word-timed re-keying. Blocked on the voice
alignment model's hash (owner approval), so compile and render have not run.

Update after reading the source (8 Nov): the paper's typical collapse time is about 0.3 s, so the script now says "about
three tenths of a second" (not "a third") and the picture is tuned to 0.3 s; the earlier 0.35 s came from our own simple
model, not the paper, and is dropped.

Draft render (9 Nov): 66.7 s, 540x960 at 15 fps, 1000 frames, audio -14.1 LUFS / -1.9 dBTP, voice 21.1 LU over the music,
sync PASS, 0 text-audit warnings after the end-card footnote was shortened. Voice speed 0.9 (the lint's 2.2-3.0 words/s
rule). The lint reports 0 errors. Not done: the read-aloud pass by a person, final-tier render, the person check of
claims. scene-table.md is the planned direction; the draft follows it with these changes: the hook shows the slinky
mid-collapse, the spine plate sits right of the slinky, and the whoa shows a dot and a dropped ball level through the fall.

## Round 2 (9 Nov, after the Opus review: FAIL a3 b4 c3 d4 e4 f3 g4 h3) - S2E01 (folder ep07)
Changes, in the reviewer's order:
1. Fact: the middle coils do not fall until the front arrives; only the balance point (centre of mass) falls like a dropped ball.
   The line is now "Its balance point, the spot you could balance it on? It falls like a dropped ball." The label and spine say "balance point". c8 and c9 re-sourced (Eq. 12 and Eq. 19 of Cross and Wheatland).
2. "Doesn't move at all": the whole film now runs at one factor, 20× slower; the first run is released on "Let go" and the pile reaches the bottom 5.9 s later, after the sentence has ended (a 3.4 s picture-only hold shows it); the "bottom: still" tag ends 0.15 s before the bottom moves.
3. The ball is solid dark blue, 10 cm wide, with a fixed label, 42 cm beside the slinky; the dot is solid red; both sit above the caption plate (the camera pans down to follow them).
4. c13: the voice and end card say "almost never breaks in two", sourced to the 2018 paper's "appear almost always to fragment into at least three pieces" (read in full). The 2005 paper stays unopened.
5. Hook: the slinky sits at the right of frame, clear of the title, the badge (top right) and the caption. The frame-0 jump was the title card's drop animation starting after frame 0; it now rests from frame 0.
6. The frozen holds: the 3 s whoa hold is the balance-point fall with the camera swinging in; the takeaway hold orbits the fallen pile. No frozen frame with a still camera.
7. One speed factor (20×) in the badge for every slow run; the earlier seven factors are gone (the 94× hold is gone: it was a frozen frame).
8. Added the ruler and the "hung about 1.5 m" label (the illustrated slinky hangs 1.5 m so that its collapse takes the paper's typical 0.3 s; the paper's own 1 m model gives 0.24 s). Draft render only: the final waits for the gate, as instructed earlier.
9. scene-table.md rebuilt from this render; claims-table.md and script.md synced; the file id is reality-rulebook-s2e01 (out/reality-rulebook-s2e01-9x16-draft.mp4).
10. c7, c10, c11 now carry their own quotes from the paper; all claims stay OPEN until a person opens the sources (SOURCE-READ is the builder's reading only).
Lint: 0 errors, grade 2.3. Not done: a person's read-aloud pass, the final render, the person check of the claims.

## Round 3 (9 Nov) - S2E01
Front arrival and label/knock land on "move" (35.2 s); the dot and the dropped ball are on screen and level from 37.9 s and keep falling to the floor
(about 48 s) with the camera following; the ball's label is on the opposite side (right, below) of "balance point"; the slinky pile lands on the floor
and rests (59.7-64 s, camera orbiting low); the title's and end card's trailing copies are hidden; the end-card title wraps to 3 lines
("spaghetti rarely breaks in two") so the footnote is inside the safe box (0 audit warnings); script.md and scene-table.md synced
(20x badge, 71 s). Final render still waits for the gate.
