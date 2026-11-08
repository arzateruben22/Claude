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
