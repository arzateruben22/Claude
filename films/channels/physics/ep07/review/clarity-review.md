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
