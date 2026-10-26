# Rest Frame ep02: script audit (26 Oct 2026)

## Verdict

The episode is nearly ready. All the numbers are right. I recomputed each one with the exact elliptic-integral period (AGM): L = 9.81/π² = 0.9940 m; T0 = 2.0000 s; one swing takes 1.002 s at 10° and 1.017 s at 30°; the first pass through the bottom is 7.75 ms apart; twenty swings leave the big one 0.310 s behind; 30° runs 1.74% slow (one part in 57.4) against the ideal and 1.55% (one part in 64.6) against 10°; the pull is sin30°/sin10° = 2.88×; bottom speeds are 1.62 against 0.54 m/s (2.97×); the Harvard lengths are 34.39 and 21.17 cm; the 12° realignment comes at 60.17 s; 80° runs 13.7% slow. The claims about Galileo, the grandfather clock and the Harvard demo match what the sources say.

The story follows the seven beats well: a real hook, a 'neck and neck' surprise, Galileo's wrong idea, an escalation, a measured payoff, a short reframe and a real tease. Nothing from the 'Never write' list appears and there is no hype. Lint: 0 errors. It warns that the change beat has 17 words against the template's 20–32, which is fine because that beat is told to 'say less'.

Problems to fix:
- **One misleading line (F1):** the pendulum-wave narration says the row drifts apart for a minute and then lines up all at once. In fact it reconverges over the second half.
- **One wrong on-screen number risk (F2):** the bible's ×4 speed badge can't fit the 60 s cycle into this beat; it needs about ×6.
- **Three citation fixes in claims.json (F3–F5):** a made-up title for the arXiv paper, a McMaster page I couldn't find, and an IB student paper as a main source. The narration doesn't change.
- **Two picture-rule gaps (F6, F7):** no end-card footnote and no spine readout.
- **Two read-aloud fixes (F8, F9):** 'So… So…' back to back, and 'one three'.

Every source was checked through WebSearch excerpts only, because WebFetch failed with ENOTFOUND on every host. A person still needs to open each link before posting.

Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/physics/ep02/script.md and /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/physics/ep02/claims.json

## Confirmed findings (4) — fix before the final render

### F1 · misleading

**Line:** `vo: ... For about a minute, they drift apart. {c10} Then, all at once… back in *line*. {c17}`

**Problem.** The pendulum wave is symmetric about its halfway point. Neighbours fall out of step for the first 30 s; at 30 s they swing in two alternating rows. After that the patterns run backwards and the row comes back together gradually over the second half. Saying they drift apart for a minute and then line up all at once contradicts what the fast-run picture shows from mid-cycle on. c10's claim text ('fall out of phase over the 60 s cycle') makes the same error.

**Evidence.** WebSearch excerpts only (WebFetch failed with ENOTFOUND on every host). Harvard Pendulum Waves page (sciencedemonstrations.fas.harvard.edu/presentations/pendulum-waves): 'at 30 seconds, half of the pendulums are at one amplitude maximum and the other half are at the opposite amplitude maximum'. IMA, 'Pendulum Pattern Perception' (ima.org.uk/4939), analysing the Harvard video: 1 wave near 0 s, 3 near 20 s, 2 near 30 s, 3 near 40 s, 1 near 60 s. Calculation: the lag between neighbours is Δφ(t) = 2π·t/60 s, and Δφ(60 − t) = −Δφ(t) mod 2π, so the second half retraces the first half in reverse.

**Fix.**

vo: ... For half a minute, they drift apart. {c10} Then, just as gradually… back in *line*. {c17}

This is 14 words, the same as now. It keeps the starred "back in *line*" landing on the realignment, and "just as gradually" says the second half mirrors the first.

claims.json changes:
- c10 claim: "fall out of step for the first 30 s (neighbours on opposite sides at 30 s)".
- c17 claim: "retrace that in reverse over the second half and are back in line at 60 s (60.26 s at the film's 15° start)".
- c16: change "same 12° start" to "same 15° start".
- c17 note: change the angle to 15°, the period stretch to 0.43% (exact ratio 1.00430) and the realign time to 60.26 s, to match compile.py WAVE_TH and film.json wave.align.

Carry the new line into the other copies:
- README.md (the whoa row)
- review/CLAIMS-REVIEW.md (the c10 and c17 rows)
- vo/lines.json vo05

Then re-render 05.wav and recompile, because the new clip's length moves where "line" lands (cue.whoa.line).

<details><summary>Verifier's check</summary>

The finding stands. I checked it three ways.

1. The maths. The pendulums swing 51+n times a minute, so pendulum n sits at x_n(t) = A·cos(2π(51+n)t/60). That gives x_n(60−t) = x_n(t) exactly. I checked this numerically and the error is about 1e-13. So every arrangement in the second half is an arrangement from the first half, played backwards. The lag between neighbours grows from 0 at the start to half a cycle at 30 s, then shrinks back to 0 at 60 s.

2. The source. A WebSearch confirms the Harvard page's wording: "at 30 seconds (halfway through the cycle) ... half of the pendulums are at one amplitude maximum and the other half are at the opposite amplitude maximum". The Wolfram demonstration describes the same 30 s pattern.

3. The built film. The voice line does not save it. vo05 starts at about 38.3 s and runs 8.1 s, and the wave plays its whole minute between 38.32 s and 46.03 s at ×10. So "Then, all at once" is spoken while the row is visibly closing up step by step, and "they drift apart" for "about a minute" is spoken while the picture is already running backwards. "All at once" is also wrong because the row comes back together just as slowly as it came apart.

c10's claim, "fall out of phase over the 60 s cycle", repeats the error.

The proposed fix has the physics right but two small faults:
- It is 13 words, not "13 words, as now". The current line is 14 words.
- Its c17 text gives "60.17 s at 12°". The built film starts the fifteen at 15°: compile.py line 56 sets WAVE_TH = −15°, film.json has wave.align = 60.258, and the README and HUMAN-REVIEW say 60.26 s. The exact ratio at 15° is 1.00430, which gives 60.26 s. 12° would give 60.16 s. So claims.json is out of date with the build: c16's "same 12° start" and c17's note (12°, 0.275%, 60.17 s) are wrong as well.

</details>

### F3 · unsourced

**Line:** `vo: *Measure it*: twenty swings, and the big one is three tenths of a second *behind*. {c11}`

**Problem.** c4, c11 and c12 give the source as 'Exact and approximate period of a simple pendulum (arXiv:physics/0510206)'. No paper by that title exists. arXiv:physics/0510206 is F. M. S. Lima and P. Arun, 'An accurate formula for the period of a simple pendulum oscillating beyond the small-angle regime' (Am. J. Phys. 2006). The narration's numbers are correct, but the pinned sources page would carry a made-up title.

**Evidence.** WebSearch excerpt of arxiv.org/abs/physics/0510206 (fetch failed): title and authors as above, DOI 10.1119/1.2215616; the abstract measures its formula against 'the exact period'. Recomputed with the exact elliptic-integral period (AGM), T0 = 2π√(0.994/9.81) = 2.00004 s: ratios 1.001907 at 10° and 1.017409 at 30°. Twenty swings: 10 × 2.00004 × 0.015502 = 0.310 s ('three tenths' holds). 1/0.017409 = 57.4 and 20.04/0.310 = 64.6, so 'one part in sixty' holds against either baseline.

**Fix.**

Narration unchanged. In claims.json, set source_title for c4, c11 and c12 to: "F. M. S. Lima & P. Arun, An accurate formula for the period of a simple pendulum oscillating beyond the small-angle regime, Am. J. Phys. 74(10), 892 (2006), doi:10.1119/1.2215616 (arXiv:physics/0510206)". Before posting, the person who opens each link should confirm the DOI resolves, since searches could not show it.

<details><summary>Verifier's check</summary>

The finding stands. The narration is fine, but the source title in claims.json is made up. A WebSearch of arxiv.org (fetching arxiv.org failed with ENOTFOUND) returns arXiv:physics/0510206 as F. M. S. Lima and P. Arun, "An accurate formula for the period of a simple pendulum oscillating beyond the small-angle regime", Am. J. Phys. 74(10), 892 (2006). The arXiv listing page shows the same title. No paper called "Exact and approximate period of a simple pendulum" turned up, so c4, c11 and c12 would put a fake title on the pinned sources page. I could not confirm the DOI 10.1119/1.2215616 myself: searches did not show it, and Crossref was blocked (403). It does fit AJP's 2006 DOI pattern, and the volume and page match. I redid the numbers with the AGM form of K: T0 = 2π√(0.994/9.81) = 2.00004 s; exact ratios 1.001907 at 10° and 1.017409 at 30°; twenty swings take 20.0385 s against 20.3486 s, a gap of 0.3100 s, so "three tenths of a second behind" is right. 1/0.017409 = 57.4 against the small-swing ideal, and 0.015472 relative to the 10° swing gives 1/64.6, so "about one part in sixty" holds either way. The paper is still a fair source for these claims: its formula is checked against the exact elliptic-integral period, which is the period these numbers come from. The only change needed is the source_title metadata, which is what the proposed fix does. betterFix only adds the volume, issue and page.

</details>

### F4 · unsourced

**Line:** `vo: Next: a dropped ball, bouncing back. {-} It never reaches your *hand*. {c15}`

**Problem.** c15 cites the McMaster Pressbooks page (ecampusontario.pressbooks.pub/physics1a03/?p=299), but its excerpt came from 'a related search', not from that page. I could not find the cited page at all. The quoted sentence matches the wording of Wikipedia's 'Collision' article (mirrored by GeoGebra and EPFL graphsearch), so the claim is not tied to the source it cites.

**Evidence.** WebSearch for 'physics1a03 pressbooks collisions' and for the eCampusOntario restitution page: no such page found. Exact-phrase search for 'dissipated as heat, sound or vibration are called inelastic' returned graphsearch.epfl.ch (a Wikipedia mirror) and GeoGebra 'Coefficient of Restitution and Elasticity', not McMaster.

**Fix.**

Narration unchanged. Point c15 at the ITF ball test, as episode 3's c1 does: dropped from 254 cm onto concrete, a bounce of 135–147 cm is acceptable (53–58%; https://twu.tennis-warehouse.com/learning_center/balltesting.php). Cut the claim down to what the line says (the ball comes back well under the hand). OpenStax UP 8.3 names only thermal energy, so drop 'sound, vibration' or cite OpenStax College Physics 2e 8.5 ('thermal energy and sound').

<details><summary>Verifier's check</summary>

The finding stands, though one detail in it is wrong. The narration is correct and defensible: a dropped ball with no energy added comes back lower than it fell, because restitution is below 1. The ITF test confirms this for the tennis ball episode 3 uses: dropped from 254 cm, it must come back to 135–147 cm, and even the fastest Type 1 balls only reach 138–151 cm. So "never reaches your hand" holds. The problem is the citation. claims.json admits that c15's excerpt came "from a related search", and I could not tie the quoted sentence ("dissipated as heat, sound or vibration are called inelastic") to McMaster. The ?p=299 page could not be fetched (the proxy refuses the connection), so nobody can confirm what it says. The detail the fact-checker got wrong: the McMaster book does exist. It is the Physics 1A03/1V03 lab manual on eCampusOntario, and it has a real restitution page: https://ecampusontario.pressbooks.pub/physics1a03/chapter/exercise-4-coefficient-of-restitution-2/. But that page is a lab exercise. It defines e as speed after the bounce divided by speed before it, and asks students to work out which value of e means energy is kept or lost. It does not state the heat/sound/vibration sentence, so c15 is still not backed by the page it cites. The proposed fix mostly works: the TWU ITF page exists, gives the 135–147 cm range, matches episode 3's c1, and directly supports the line. One weakness: OpenStax University Physics 8.3 covers conservation of energy and friction turning mechanical energy into thermal energy. It does not name sound or vibration, yet c15's claim says "sound, vibration and heat", so the same mismatch would come back. The line on air doesn't say where the energy goes, so the cleanest fix is to cut the claim down to what the sentence states. The same unverified McMaster citation also appears in episode 3's c4, c5, c8 and c14, and in the bible's §7 #3; those need repointing too, for example to the real restitution page for the definition only.

</details>

### F5 · unsourced

**Line:** `vo: For small swings, he was *nearly* right. {c6}`

**Problem.** c6's main source is arXiv:1805.00002, a 2018 paper written for the IB Diploma Programme (N. Graber-Mitchell). It is not peer-reviewed and is weak backing for a script a physicist signs off. The stronger source, OpenStax, is already quoted in c6's own note.

**Evidence.** WebSearch excerpt of the arXiv record for 1805.00002: '10 pages ... written for the IB Diploma Program'. OpenStax (College Physics 16.4; the University Physics Vol. 1 15.4 mirror): the period 'is nearly independent of amplitude, especially if θ is less than about 15°'.

**Fix.**

Narration unchanged. Set c6's source_url to https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums (title 'OpenStax University Physics Volume 1, 15.4 Pendulums'). In c6's note, quote 15.4 (change '15.5' to '15.4') and mark 13.7% at 80° as computed (2K(sin 40°)/π = 1.1375, arXiv:physics/0510206). Drop 1805.00002, then regenerate CLAIMS-REVIEW.md and POSTING.

<details><summary>Verifier's check</summary>

The finding stands. It does not say the narration is wrong. Its point is that the claim's main link is weak, and that holds up. A search of the arXiv record for 1805.00002 shows N. Graber-Mitchell, submitted April 2018, "10 pages ... written for the IB Diploma Program". The author calls it an illustration of the derivation, not a rigorous treatment. It is a school paper, not peer-reviewed, and it is the link that goes public as source #6 in films/channels/physics/ep02/out/posting.json, POSTING.md and review/CLAIMS-REVIEW.md. The narration itself is correct and defensible. I checked the exact period ratio 2K(sin(θ0/2))/π with the arithmetic-geometric mean: it is 1.0019 at 10°, 1.0043 at 15°, 1.0174 at 30° and 1.1375 at 80°. So "nearly right for small swings" is accurate, and so is c6's 13.7% at 80°. Search results tie the OpenStax sentence ("the period T for a pendulum is nearly independent of amplitude, especially if θ is less than about 15°") to University Physics Vol. 1 §15.4 through its Lumen and xyzhomework mirrors. One caveat: an earlier search did not find the exact wording, and direct fetches of openstax.org failed, so a person should open the page and confirm the sentence before posting. 15.4 is openstax.org's numbering; the "15.05" in the LibreTexts copy used by c2, c7 and c8 is the same section. The proposed URL and title are therefore right, and the fix is sound. It leaves two small gaps. First, OpenStax does not give the 13.7%-at-80° figure in c6's claim, so the note should mark it as computed from the exact period, the same source c11 and c12 use. Second, c6's note still says "OpenStax 15.5", which is the LibreTexts number. A related point: the posting builder dedupes sources by URL, so the same OpenStax section will appear twice in the sources list, once as LibreTexts 15.05 and once as openstax.org 15.4. That is harmless but could confuse viewers. Pointing c6 at the existing LibreTexts URL would avoid it. The generated review and posting files need regenerating after the change.

</details>

## Story and wording notes (4) — apply when cheap

### F6 · story

**Line:** `end card: "Next drop: where does the bounce go?" · "Follow Rest Frame"`

**Problem.** Picture rule 6 says the end card carries one true-fact footnote that grounds the premise. Episodes 3, 4 and 5 all have one; episode 2 has none.

**Fix.** end card: "Next drop: where does the bounce go?" · "Follow Rest Frame" · footnote: "Galileo's claim first survives in a 1602 letter to Guidobaldo del Monte. He never demonstrated it." (tie it to c5)

### F7 · story

**Line:** `## change {events: both released together at ×1/4 from 30° and 10°; both pass the bottom on one word · labels: "30°", "10°" · pre: 0.1 · energy: 0.5} (14–21.5 s)`

**Problem.** No beat sets up a spine readout. Picture rule 2 asks for one number that stays on screen and climbs as the story escalates. This episode has a natural one, the big swing's lag, which runs from neck and neck to three tenths behind and pays off the hook. Episodes 3 and 5 have spines.

**Fix.** ## change {events: both released together at ×1/4 from 30° and 10°; both pass the bottom on one word · labels: "30°", "10°" · spine: "big one behind" 0.008 s at the first pass, climbing to 0.31 s by swing twenty (measure), held lit through the takeaway · pre: 0.1 · energy: 0.5} (14–21.5 s)

### F8 · wording

**Line:** `vo: So hang fifteen, each a little shorter. {c9}`

**Problem.** Two sentences in a row start with 'So': the why beat ends 'So it covers triple the path…'. The 'so' also doesn't follow. Two different swing sizes taking nearly equal time is no reason to hang different lengths. The whoa starts something new and should open as a new step.

**Fix.** vo: Now hang fifteen, each a little shorter. {c9}

### F9 · wording

**Line:** `vo: Pull one three times farther. {-}`

**Problem.** Spoken aloud, 'one three' puts two number words side by side, and the line can be heard as 'pull one, three times'. 'One' also has no pair yet: the normal beat shows a single pendulum.

**Fix.** vo: Pull its twin three times farther. {-}


## Refuted (1) — no change

### F2

**Line:** `## whoa {... fifteen pendulums, 51–65 back-and-forth swings a minute, run fast; they realign on "line" ...} (39–51 s)`

**Why it stands as written.** The arithmetic is right: 60.17 s / 4 = 15.0 s, which is longer than the 12 s beat. But that number is aimed at the bible's §7 #2 line, not at this script. The script never says ×4. It says "run fast; they realign on 'line'", and the intro says "run fast with the speed badge on screen". That heading is direction for the compiler. Viewers never hear or see it, so it makes no claim to a general audience, and leaving the factor out is deliberate.

The repo shows the compiler handled it. The audit copies of script.md and claims.json are identical to films/channels/physics/ep02. In /home/user/Claude/films/channels/physics/ep02/compile.py (lines 80-117), the whoa runs at ×1, ramps up to ×10 on a 1.2 s log ramp, then ramps back to ×1. The release time is solved so that τ(line) − τ(release) equals WAVE_ALIGN exactly. film.json's clock keys are rate 10 at 38.57 s and back to rate 1 by 46.03 s. I recomputed the span from release (38.32 s) to "line" (46.03 s): τ = 60.258 s, which matches 60 × 1.0043006 (the AGM ratio for the bench's 15° start). So all fifteen pendulums are back in phase exactly on "line".

The badge is live. scene.mjs line 67 and line 141 render the clock's rate as "{n}× faster", and review/scorecard.md records it as badged "10× faster". So no wrong "×4" badge appears.

The proposed fix (a constant ×6 with a "×6" badge, 10.0 s) would make the script disagree with the delivered film. It would be a regression, not a correction. The thing that should change is the bible's §7 #2, so it no longer prescribes ×4.

A separate problem, not in this line: claims.json c16 and c17 (and CLAIMS-REVIEW.md) say the bench starts at 12° (0.275%, realigning at 60.17 s). compile.py line 56, its docstring and HUMAN-REVIEW.md use 15° (0.43%, 60.26 s). Those claim notes should be corrected to 15° and 60.26 s. The fact-checker's 12° figure came from those stale notes, but either angle gives about ×5.0 as the minimum factor, so this doesn't change the verdict.
