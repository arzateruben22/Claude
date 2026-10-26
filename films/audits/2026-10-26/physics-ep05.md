# Rest Frame ep05: script audit (26 Oct 2026)

## Verdict

Nearly clean. Fix the three lines above and it is ready for the physicist's sign-off. Every number recomputes. In the model, I_out = 2.0 + 2.56 + 1.932 = 6.492 and I_in = 2.0 + 0.16 + 0.266 = 2.426, a ratio of 2.676. Over the badged range of I0 = 1.5–3.0 kg·m² the ratio is 3.11–2.19, so \"more than twice as fast\" holds. It still holds at I0 ≈ 3.3 (2.09), and a textbook body-plus-stool value of 2.68 kg·m² gives about 2.3. The spine values check out: 30 rpm × 2.676 = 80.3, shown as 80. The strobe reads 360°/2 s × 0.1 s = 18° and 18° × 2.676 = 48.2° (\"nearly fifty\"). The energy rise is I_out/I_in = 2.68×, and 342/60 = 5.7 (\"nearly six\"). The Guinness record (342 rpm, Olivia Oliver, Canada, Warsaw, 19 January 2015) is confirmed from a search excerpt; the page fetch failed with ENOTFOUND. No newer record turned up. The OpenStax 11.3 excerpts support c2, c3, c5 and c13: friction is small and close to the pivot, the arms spiral inward, and the extra kinetic energy comes from the work of pulling in. The story follows the seven beats. The wrong idea is \"it feels like something pushed\", the escalation goes from the chair to the skater, the takeaway reframes, the last frame loops back to frame 0, and the tease has one question. Nothing from the \"Never write\" list appears and there are no exclamation marks. One small note outside the voiced or on-screen text: the script's preamble says \"The spin goes up 2.67×\", but 2.6758 rounds to 2.68×, as c1 and c9 say. Correct it before any badge or counter copies it.

## Confirmed findings (1) — fix before the final render

### F1 · misleading

**Line:** `Why does it speed *up*? {-} Nobody pushes. {-} Nothing pushes. {-}`

**Problem.** "Nothing pushes" is false, and it is the same overstatement the earlier review already fixed in the why beat ("Nothing *outside* did"). As the dumbbells come in, the arms push the torso round. The torso's spin rises because of that internal torque. Leaving the hook absolute supports the misconception that the body speeds up with no force on it at all. A physicist signing it off would object. The line is also tagged {-}, but it makes a physics claim.

**Evidence.** claims.json c2 note: "Inside the system the arms do push the body round (the dumbbells' angular momentum goes to the body)". Recomputed from the model in set/spin.js. Arms plus dumbbells: L = (2.56 + 1.932)ω = 4.49ω with arms out, and (0.16 + 0.266) × 2.676ω = 1.14ω with arms in. Body plus chair top: 2.0ω before and 2.0 × 2.676ω = 5.35ω after. Total: 6.49ω = 6.49ω, so it is conserved. A torque from the arms moves 3.35ω of angular momentum into the torso, so something does push.

**Fix.**

Why does it speed *up*? {-} Nobody pushes. {-} No motor. {-}

<details><summary>Verifier's check</summary>

The finding is correct and I couldn't refute it. I redid the numbers from films/channels/physics/set/spin.js (I0=2.0, m=2, mArm=3.5, rS=0.19, r from 0.8 to 0.2 m). Arms plus dumbbells: 2.56 + 1.932 = 4.492 kg·m² with arms out and 0.16 + 0.266 = 0.426 with arms in. I_out = 6.492, I_in = 2.426, so the spin goes up 2.676 times. In units of ω_out, the arms and dumbbells go from 4.49 to 1.14 (a loss of 3.35), and the torso plus chair top goes from 2.0 to 5.35 (a gain of 3.35). The total is conserved. The torso gains 3.35 because the shoulders push it forward: an internal torque, the reaction to the torso slowing the incoming arms. So "Nothing pushes" is false as an absolute statement.

The line can't be saved as a hook that the film later fixes. The why beat was already changed in review to "It feels like something pushed. Nothing *outside* did." That wording leaves room for the inside push. The hook's absolute "Nothing pushes" goes against it and brings back the misconception that the torso speeds up with no force on it. claims.json c2 says outright that the arms push the body round. The {-} tag is also wrong, because the sentence makes a physics claim.

The proposed fix works. "Nobody pushes. No motor." rules out only outside drivers, which is true of the scene during the pull (the one self-push happens earlier). It doesn't deny the internal torque, so it fits "Nothing *outside* did." "No motor" describes the setup, so {-} is a fair tag for it. It has the same length and rhythm as before (two words, three syllables). No better fix is needed.

</details>

## Story and wording notes (2) — apply when cheap

### F2 · story

**Line:** `In twenty fifteen, a young Canadian skater spun at three hundred forty-two turns a *minute*.`

**Problem.** The narration never says that 342 rpm is the world record. The viewer hears about "a young skater" without being told this is the fastest spin ever measured, so the whoa loses its reason to be bigger. Only the end-card footnote says it. The sentence also carries two numbers, the year and the rpm, against WRITING.md rule 3 ("One number per sentence"). The year already appears in the footnote.

**Fix.** The record, set by a young Canadian skater: three hundred forty-two turns a *minute*.

### F3 · wording

**Line:** `Weight near the middle is easier to turn, so that same amount turns you *faster*.`

**Problem.** Spoken aloud, "so that" is heard as the conjunction ("in order that"). The listener parses it wrong, then has to re-parse it as "so | that same amount". Kokoro will not put a pause after "so", so the stumble stays in the voiced line.

**Fix.** Weight near the middle is easier to turn, so the same amount turns you *faster*.
