# Meanwhile, Inside ep03: script audit (26 Oct 2026)

## Verdict

Nearly clean: every sourced number checks out. Five lines need fixing: the 'longest nerve cell' label and line (ep03-1, ep03-2), the thick-against-thin race (ep03-4), and two wording stumbles ('Many of yours', 'faster wires'). Each fix is the same length as the line it replaces. Every source page fetch failed (DNS ENOTFOUND for uga.edu, ncbi, bionumbers, guinness, thesciencebookstore), so all checks rest on WebSearch excerpts. What checks out: Müller's 'We shall probably never attain the power of measuring the velocity of nervous action' supports 'doubted it could ever be timed'. The '57,600 million feet a second' estimate he cited works out to 5.76e10 × 0.3048 = 1.76e10 m/s ≈ 58.6 c, which matches the 60× note. Calling Helmholtz his 'former student' is right: Müller supervised his doctorate, and Helmholtz was a professor at Königsberg by 1850. The frog figure: 90 ft/s × 0.3048 = 27.4 m/s (UGA manuscript, Boring), and the raw 1850 data of 50–60 mm over 0.0014–0.0020 s gives 25–43 m/s, so 'about thirty' and the 27 m/s readout and end card hold. Cheetah: 25.9 m/s wild and 29 m/s captive (Wilson 2013, citing Sharp 1997), so 27 is cheetah speed. C fibres run at about 1 m/s (MSU). Purves gives 0.5–10 m/s bare and up to 150 m/s myelinated. 150 × 3.6 = 540 km/h, against the Guinness record of 372.6 km/h (Williams and the FIA quote 372 km/h for Bottas's 372.5, so the 372 readout is acceptable). Heartbeats: 75/60 × 64 s = 80. The double-pain timing works over a toe-to-brain path of about 1.6 m: 1.6/15 ≈ 0.1 s against 1.6/1 ≈ 1.6 s, a gap of about 1.5 s, which matches the spoken jolt-to-ache gap. Story: all seven beats are there, in the same order as ep02, ep04 and ep05. The hook is a real question with a person and a wrong idea. The change picture breaks the expectation (cheetah, not light). The why has a mechanism and stakes (MS, hedged), the whoa escalates to the Formula One car, the takeaway is a repeatable reframe, and the tease is specific and loops back to frame 0. No 'Never write' phrases and no hype.

## Confirmed findings (3) — fix before the final render

### ep03-1 · misleading

**Line:** `normal heading readout: "longest nerve cell, about 1 m"`

**Problem.** The label calls a roughly 1 m spine-to-toe motor neuron the longest nerve cell. It isn't. The sensory neuron from the big toe runs up the dorsal column to the brainstem as one cell, and that cell is longer, about the person's height. The episode's own c3 note admits this ("Guinness gives about 1.3 m for these motor neurons; the sensory paths from toe to brain are longer still"). The takeaway then sends a signal from the toe up to the brain, so the film contradicts its own label.

**Evidence.** WebSearch excerpts; WebFetch of guinnessworldrecords.com and bionumbers failed (ENOTFOUND). Guinness 'Longest cell' (guinnessworldrecords.com/world-records/67725-longest-cell): motor neurons about 1.3 m; the sensory pathways from the big toe to the brain are longer, about the person's height. Lancaster University glossary and BioNumbers 104901 give 'a metre or more' and '≤1 m' for the spine-to-toe motor axon. So 'about 1 m' is right for the spine-to-toe route, but 'longest nerve cell' is wrong.

**Fix.**

readout "spine to toe: about 1 m"; vo "Some run from spine to *toe*: about a metre." {c3}; c3 claim: "motor axons run from the lower spinal cord to the toes, about a metre" (no 'longest')

<details><summary>Verifier's check</summary>

The finding stands. I couldn't check the sources myself: the shared web-search budget was used up, and fetching Guinness and Wikipedia failed with ENOTFOUND. So this rests on standard neuroanatomy and on the episode's own c3 note.

The heading readout "longest nerve cell, about 1 m" is a flat superlative, and it's wrong. Touch and position sensing from the toe travels up the dorsal column. The first nerve cell on that path has its cell body beside the spine in the lower back. Its fibre runs from the toe past that cell body and up the dorsal column of the spinal cord to the gracile nucleus in the medulla, all as one cell. In an adult that is roughly 1.5 m or more. Standard references say the same: a motor axon can be over a metre long, from spine to toe, and sensory axons running from the toe up the cord can be over 1.5 m. The episode's own c3 note concedes this ("the sensory paths from toe to brain are longer still"), so the readout contradicts the film's own sourcing. A popular factoid doesn't excuse it. Even BioNumbers' title calling the spine-to-toe neuron "the longest cell" is loose wording, and its "≤1 m" figure is only for the spine-to-toe route.

One part of the finding overreaches. The takeaway's pain signals don't show the label is wrong. Fast and slow pain fibres (A-delta and C) hand off to new cells in the dorsal horn of the spinal cord, so the toe-to-brain pain route in the takeaway isn't one cell. That doesn't change the verdict: the label is still factually wrong.

"About 1 m" for the spine-to-toe route is fine for a general audience. The proposed readout fix is correct. It is incomplete, though: the VO sentence tied to c3 ("Your longest run from spine to toe: about a metre.") still says "longest". Once c3 drops "longest", the claim no longer supports that word, so the VO should drop it too.

</details>

### ep03-2 · misleading

**Line:** `Your longest run from spine to toe: about a metre.`

**Problem.** Two problems. (1) Spoken aloud, 'Your longest run' reads first as a noun, like a jog. The verb 'run' with a dropped 'ones' only comes clear later, so the listener stumbles on it. (2) It repeats the 'longest' claim from ep03-1, which the sources contradict.

**Evidence.** Same sources as ep03-1. The spine-to-toe distance of about 1 m is supported (BioNumbers ≤1 m; Lancaster 'a metre or more'). In an adult the S1 motor pool sits at about vertebra L1, roughly 1.0–1.05 m above the floor, and the route down through the leg comes to about 1 m. Syllables: original 13, fix 13.

**Fix.**

Some reach from your spine to your toe: about a metre.

<details><summary>Verifier's check</summary>

The finding stands. I could not check sources live: the shared WebSearch budget for this turn was used up, and WebFetch failed (DNS) for BioNumbers and Wikipedia. So this rests on the episode's own claims file and standard anatomy.

(1) "Longest" is not defensible as written. c3 claims "the longest human axons run from the base of the spinal cord to the big toe, about a metre", but c3's own note says "the sensory paths from toe to brain are longer still". The big toe's primary sensory neurons have their cell body in a dorsal root ganglion beside the lower spine. Their axon runs out to the toe and also up the dorsal column to the gracile nucleus in the medulla. That is roughly 1.5 m or more in an adult, so the longest nerve cells are neither spine-to-toe nor about a metre. Wikipedia and BioNumbers repeat the "sciatic is longest" simplification, but the script's own sourcing contradicts it, and a physiologist reviewer would likely flag it.

(2) The spine-to-toe length checks out. In an adult, the motor pools for the foot (cord segments L5–S2) sit at about vertebra T12–L1. Down through the cauda equina, sciatic and tibial nerves, then forward along the sole to the big toe, that comes to about 1.0–1.2 m for a typical adult. BioNumbers gives ≤1 m and Guinness about 1.3 m, so "about a metre" is fine.

(3) The listening problem is real. The line before is "racing down one cell's thin fibre". After a racing image, "Your longest run" is easily heard as a jog or race (a personal-best run) before the cable-run sense comes through. That is a stumble in a line a voice reads once.

The proposed fix is accurate. Some motor and sensory axons do reach from the spine to the toe at about a metre. It drops the contradicted superlative and the ambiguous "run", and it is 13 syllables, the same as the original. The only weakness is that "Some" has no plural antecedent (the line before says "one cell's thin fibre"), but the spine-to-toe body-locator shot makes the meaning clear. If you want the subject named, "Some fibres reach from spine to toe: about a metre." also scans at 13. The fix is not wrong or worse.

Knock-on edits to make with it:
- The normal-beat readout says "longest nerve cell, about 1 m". Change it to something like "spine to toe, about 1 m".
- Reword c3's claim from "the longest human axons" to "some human axons, from the lower spinal cord to the toes, are about a metre long", with the same source.

Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/body/ep03/script.md, /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/body/ep03/claims.json

</details>

### ep03-4 · misleading

**Line:** `Wrapped ones, up to a hundred and fifty.`

**Problem.** The whoa sets the thinnest bare fibres (C, about 0.5–1.5 µm) against the fastest wrapped ones (Aα, about 13–20 µm), and the race shot puts 'a thin bare fibre against a wrapped one' on one start line. Coming straight after the why, it tells the viewer that myelin alone gives a ×150 speed-up. Much of that gap is fibre thickness. At the same diameter myelin gives roughly ten to twenty times, not 150. A physiologist would object, and rule 9 says an idealisation like this has to be said aloud or badged. (Separately, human Aα fibres are usually given as 80–120 m/s. The Purves figure of 150 m/s is for myelinated axons in general. The Formula One comparison holds either way, since 120 m/s × 3.6 = 432 km/h > 372.6 km/h.)

**Evidence.** WebSearch excerpt of Purves NBK10921: 'unmyelinated axon conduction velocities range from about 0.5 to 10 m/s, myelinated axons can conduct at velocities up to 150 m/s', so the numbers are correct. wikimsk Nerve Conduction Studies (excerpt): Aα fibres 13–20 µm, 80–120 m/s. Unmyelinated speed scales with √diameter: from 1 µm at about 1 m/s, a 15 µm bare fibre would run about 1 × √15 ≈ 4 m/s, against about 90 m/s myelinated at the same size, roughly ×20.

**Fix.**

Thick wrapped ones, up to a hundred and fifty. (Also badge the race shot "thin, bare · thick, wrapped" and draw the wrapped fibre thicker.)

<details><summary>Verifier's check</summary>

The finding stands, though it overstates one part. I couldn't search anything new because the web search budget was used up, so I worked from the claims file, the crosscheck note and standard physiology.

Both numbers in the line are true. Purves NBK10921 gives bare fibres 0.5–10 m/s and wrapped ones up to 150 m/s, and C fibres run at about 1 m/s.

The problem is the way they are paired. The why line says myelin makes the signal leap. The whoa then pits the slowest bare fibres ("the thinnest") against the fastest wrapped ones ("up to"), and the race shot puts both on one start line. The script only mentions thickness on the bare side. Nothing in the words or the picture says the wrapped fibre is also about 15–20 times thicker, so a viewer will take the whole gap as myelin's doing. Rule 9 says an idealisation like that has to be said aloud or badged, and right now it is neither.

I redid the sums with two standard rules of thumb:
- **Bare fibres:** speed grows with the square root of thickness. At about 1 m/s for 1 µm, a 15–20 µm bare fibre would run about 4–4.5 m/s.
- **Wrapped fibres:** about 6 m/s for every µm of thickness. That gives about 90–120 m/s at 15–20 µm.

So at the same thickness myelin gives about ×20–30, not ×150, and thickness alone gives about ×4–5.

Two corrections to the finding itself. Its "roughly ten to twenty times" is a little low; at the thickness of the fastest fibres it is more like twenty to thirty. And on those numbers myelin, not thickness, is still the larger share of the gap, so "much of that gap is fibre thickness" overstates it. The main point still holds: myelin alone does not give ×150.

The best defence of the line is that the body has no thick bare fibres, so it compares real fibre types. It also never says "150 times". But the race on one start line, coming straight after the why, still pins the gap on myelin.

The proposed fix is right and costs one word. "Thick wrapped ones, up to a hundred and fifty" now matches "the thinnest bare fibres". Both lines now say they are the two extremes, and "up to" still holds, since the thickest fibres are the fastest. The F1 line still works either way: 120 m/s is 432 km/h, which beats 372.6 km/h.

Keep the race badge "thin, bare · thick, wrapped" and draw the wrapped fibre visibly thicker. Update the c11 note in claims.json to say the 150 m/s figure is for the thickest wrapped fibres.

</details>

## Story and wording notes (2) — apply when cheap

### ep03-3 · wording

**Line:** `Many of yours wear fatty myelin, re-firing only at gaps, so the signal leaps.`

**Problem.** 'Yours' has no antecedent a listener can find. The sentence before it is "It isn't current in a wire: the cell re-fires it, step by step," so the nearest nouns are 'wire' and 'cell'. 'Fibre' was last said about 20 s earlier. 'Many of your cells wear myelin' would also be wrong: myelin wraps axons and is made by other cells.

**Fix.** Many of your fibres wear myelin, re-firing only at gaps, so the signal leaps.

### ep03-5 · wording

**Line:** `The jolt rides faster wires; the ache, bare ones.`

**Problem.** The why beat spends a line telling the viewer the signal isn't like current in a wire ("It isn't current in a wire"). Twenty seconds later the takeaway calls the nerves 'wires'. The button line brings back the very model the episode just corrected. The whoa already set up 'fibres' ('The thinnest bare fibres…').

**Fix.** The jolt rides faster fibres; the ache, bare ones.
