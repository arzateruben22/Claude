# Meanwhile, Inside ep05: script audit (26 Oct 2026)

## Verdict

Ep05 is structurally sound and needs six small fixes, none of them structural. Story: the seven beats are all there and the shape works. The hook ('Not into a bag. Into these.') sets up the takeaway, a wrong idea and a person drive the change, the why has stakes (a thickened wall), the whoa escalates to human scale, the tease is specific, and the end card loops to frame 0. No line comes from the 'Never write' list, there are no exclamation marks and no forced hype. Checked and fine: c1, 480 million alveoli (range 274–790 million) for both lungs, Ochs 2004, which also matches the end card. c3, a fifth of a millimetre: (6 × 4.2×10⁶ µm³ / π)^(1/3) = 200 µm. c2, 'up to about twenty-three' forks is defensible: Weibel's model has 23 generations, and a review citing Horsfield & Cumming gives as many as 24 branch points. Also fine: 1661 and De pulmonibus, 'no pump' (passive diffusion), the fibrosis stakes, and the tennis-court dimensions. The six fixes: (1) the frog lung is tied to the wrong discovery; (2) 'at least seventy m²' states a minimum that a standard textbook (50–100 m²) contradicts, and the readout needs a hedge; (3) 'a third of a tennis court' only works for a singles court, while a full court with doubles alleys makes it a quarter; (4) 'at its thinnest… about half a micrometre' is wrong, since the thinnest parts are 0.2–0.3 µm; (5) the meanwhile tally reads about 6.6 L at the moment the voice says 'about six'; (6) 'airy flesh' followed by 'bubbles' doesn't land as a contrast, and 'airy' isn't in the cited sources. Fixes 2 and 3 work together: 'about seventy' and 'about a quarter'. All source checks used search-result excerpts only, because WebFetch failed (DNS ENOTFOUND for ncbi.nlm.nih.gov, encyclopedia.com, scienzagiovane.unibo.it and institut-langevin.espci.fr). A person should still open the links before the script is locked. Files audited: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/body/ep05/script.md and /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/body/ep05/claims.json.

## Confirmed findings (5) — fix before the final render

### F1 · misleading

**Line:** `In sixteen sixty-one, Marcello Malpighi put a frog's lung under a microscope: *bubbles*. {c5}`

**Problem.** This joins two findings from different letters. The 'bubbles' (the lung is vesicular, not fleshy) come from Malpighi's first letter of 1661. The frog lungs come from the second letter, where he found the capillaries. c5's own excerpt keeps them apart ('in the second letter, frog lungs, he described the capillaries'), so the frog detail is an inference, not something the source says. A physiologist would also point out that a frog lung is a thin sac with a honeycombed wall. That makes it the closest thing to the 'bag' this episode is correcting, so it is a poor exhibit for 'bubbles'.

**Evidence.** Search excerpts only; WebFetch failed with DNS errors. From Tonetti 2015, 'Frogs' lungs and Malpighi's discovery of pulmonary capillaries', Acta Phlebologica 16:41–51 (research.unipd.it), and the Univ. of Iowa HEIRS record (heirs.lib.uiowa.edu/record.php?id=569): 'In the first letter, thanks to the help of the microscope, Malpighi proved that the lungs were not fleshy, but that they had a vesicular structure.' Then: 'In the second letter, Malpighi decided to perform dissections of frogs', where he saw the capillaries. Another excerpt describes the first letter's plate as 'a microscopic cut of the alveolus of a mammal's lung'.

**Fix.**

In sixteen sixty-one, Marcello Malpighi put an animal's lung under a microscope: *bubbles*. {c5}   (Optional: put the frog on the capillary line instead, since that is where the source puts it. Also update c5's claim and note to match.)

<details><summary>Verifier's check</summary>

The finding stands. I could not check outside sources myself: the web-search budget for this turn was already used up, and both WebFetch and curl were blocked (DNS errors and a 403 from the proxy). So this verdict rests on the files plus what I already knew.

1. c5's own excerpt keeps the two findings apart. The vesicular, non-fleshy structure is the main result, and frog lungs come in only with "in the second letter, frog lungs, he described the capillaries."
2. The only reason the claim gives for "a frog's lung" is the reviewer's note "he worked mainly on frog lungs (the excerpt's second letter)". That is an inference, not something the source says.
3. This matches the standard history I know. The first letter to Borelli shows the lung is made of membranous vesicles where the tracheal branches end, and its figure is of a mammal's lung. Malpighi turned to frogs in the second letter, for the capillaries; that is the letter with his remark that he had nearly wiped out the frogs.

So the line joins two results from two letters. The date, 1661, does cover both letters. And the second letter does describe the frog lung's honeycombed inner wall, so "frog" plus "cells" is not invented. But the overturning of "flesh" in favour of "bubbles", which is the beat this line pays off, comes from the first letter and mammal lungs.

The physiology point also holds. A frog lung is a thin-walled sac with shallow honeycomb pockets on the inside, so it is the worst exhibit for an episode whose takeaway is "your lungs aren't a bag". The change shot only says "Malpighi's view: bubbles" and draws no frog, so nothing in the picture depends on the frog.

The proposed fix is accurate and roughly the same length. "An animal's lung" is a little vague, but it avoids implying a human lung, which "a lung" alone would. I do not recommend the optional move of the frog onto the capillary line: c6 is a present-tense mechanism sentence, and adding history there would crowd the "why" beat.

c5 still needs updating. Its claim should read roughly "...showed the lungs are vesicular, not fleshy; in a second letter, studying frog lungs, he described the capillaries." The note's sentence "Review fix: he worked mainly on frog lungs, hence 'a frog's lung'" should be removed. The script's review summary, which mentions "Malpighi's frog lung", should drop the frog as well.

</details>

### F2 · misleading

**Line:** `Unfold every sac flat, and they'd cover at least seventy square *metres*. {c9}  /  heading: "the readout climbs to 70 m²"`

**Problem.** 'At least' makes 70 m² a minimum for every viewer, and the sources don't support that. A standard physiology text gives 50–100 m². Ochs 2004 shows alveolar number tracks lung volume, so a smaller adult or a teenager can come in under 70. 70 m² is the commonly cited value, not a lower limit. 'At least' also appears in two sentences in a row, which sounds clumsy aloud. The on-screen readout shows a bare '70 m²' with no hedge, although the claims note says 'about 70 m²' and bible §9 asks for ranges on screen.

**Evidence.** Search excerpts only. West, Respiratory Physiology 9th ed., ch. 1 (Cornell-hosted PDF): the blood-gas barrier 'has an area of between 50 and 100 square meters', and 'these numbers are only approximate'. Ochs et al. 2004 (PMID 14512270): 480 million alveoli (range 274–790 million); 'alveolar number was closely related to total lung volume'. c9's own sources give 70–100 m² (StatPearls) and 120–140 m² (morphometry, S20). Together the estimates run from about 50 to 140 m².

**Fix.**

vo: Unfold every sac flat, and they'd cover about seventy square *metres*. {c9} Roughly a third of a tennis court, folded inside your *chest*. {c10}  /  heading: "the readout climbs to 'about 70 m²', with an honesty note 'estimates: 50–140 m²'". Add West ch. 1 to c9's sources. Change c10's note to "about a third at 70 m²".

<details><summary>Verifier's check</summary>

The finding stands. In ep05/script.md the whoa line reads "they'd cover at least seventy square *metres*. {c9}". That presents 70 m² as a floor for every viewer, and nothing in the record supports a floor. c9's own claim says "about 70–100 m²", and its note says "'About seventy' is the low, commonly cited figure" and "The readout says about 70 m²". The earlier review changed it to "at least" only because morphometry runs higher (about 130 m²). That reasoning covers the top of the range but ignores the bottom.

My web search budget for this turn was used up before I could re-fetch anything, so the source checks below come from memory and from the files, not from new fetches:
- West, Respiratory Physiology, ch. 1, gives the blood-gas barrier area as "between 50 and 100 square meters".
- Hasleton's 1972 light-microscopy series reported adult internal surface areas of about 40–80 m², scaling with body size.
- Ochs 2004 (S18 in the bible) gives a range of 274–790 million alveoli and ties alveolar number to lung volume.

So smaller adults and teenagers can plausibly come in under 70 m². The bible conflicts with the line too. §9 says: "Say 'about', show ranges on screen". The ep-5 row in §7 specifies an on-screen range ("70–140 m²"), and the current heading shows a bare "70 m²". The finding read the script correctly. Its point about "at least" appearing in two sentences in a row is also accurate (c9, then c10).

Arithmetic: a singles court is 23.77 × 8.23 = 195.6 m². 70/195.6 = 0.36, which is fair to call "about a third". 50/195.6 = 0.26.

The proposed fix (about seventy, an "about 70 m²" readout, an "estimates: 50–140 m²" note, and adding West to c9's sources) is correct as far as it goes, but it leaves c10's "At least a third". That sentence keeps a floor of about 65 m² (a third of 195.6), which is the same kind of unsupported minimum, and West's 50 m² would be only about a quarter of a court. The better fix below hedges both sentences and also removes the repetition.

</details>

### F3 · misleading

**Line:** `At least a third of a tennis court, folded inside your *chest*. {c10}`

**Problem.** 'A third' only works for a singles court (the inner lines). A full tennis court, with the doubles alleys, is 260.8 m², and 70 m² is about 27% of that. The whoa shot draws 'a tennis court's lines', and a normal court drawing includes the doubles alleys. So the 70 m² floor drawn to scale would fill about a quarter of the rectangle while the voice says 'at least a third'. That is also what most viewers picture when they hear 'a tennis court'.

**Evidence.** Search excerpts: Wikipedia 'Tennis court' and the WA government sports-dimensions guide (citing the ITF rules) give 23.77 m long, 8.23 m wide for singles and 10.97 m for doubles. Calculation: singles 23.77 × 8.23 = 195.6 m², so 70/195.6 = 0.36. Full court 23.77 × 10.97 = 260.8 m², so 70/260.8 = 0.27, about a quarter.

**Fix.**

At least a quarter of a tennis court, folded inside your *chest*. {c10}   (Update c10 to the full doubles court, which is what the shot draws: 23.77 m x 10.97 m = 260.8 m² (ITF); 70/260.8 = 0.27, so 'at least a quarter', and at morphometry's ~130 m² it is about half.)

<details><summary>Verifier's check</summary>

The finding stands. I recomputed the figures from the ITF Rules of Tennis dimensions (23.77 m long, 8.23 m wide for singles, 10.97 m for doubles), which match the excerpt in c10. A live search was not possible because this turn's web-search budget was used up. Singles: 23.77 x 8.23 = 195.6 m², and 70/195.6 = 0.36. Full doubles court: 23.77 x 10.97 = 260.8 m², and 70/260.8 = 0.27. A third of a doubles court is 86.9 m², which is more than the 70 m² floor the film gives. c10's own claim works only for the singles court, while the line just says 'a tennis court'. The whoa shot draws 'a tennis court's lines' around a 70 m² floor drawn to scale, and a standard court drawing includes the doubles alleys, so the picture shows about 27% while the voice says 'at least a third'. Both the line and the readout pair 'at least' with 70, so the film's own floor does not back the claim. One point in the line's favour: the true area from morphometry (about 130 m², c9's note) is about half a doubles court, so the statement is true of real lungs. But the film's logic and picture are tied to 70 m², so as written the line is misleading. The proposed fix is not right either. Swapping 'at least' for 'about a quarter' undoes the reviewer's deliberate 'at least' hedge. It would tell viewers their lungs are about a quarter of a court when the better estimate is about half, and it clashes with 'at least seventy' in the line before. 'At least a quarter' is true at 70 m² (65.2 m² is a quarter, ratio 0.27), still true at 130 m² (0.50), matches a doubles-court drawing in which the floor fills just over a quarter, and keeps the line the same length. c10 should be updated to the doubles court: 23.77 x 10.97 = 260.8 m², and 70/260.8 = 0.27, 'at least a quarter'.

</details>

### F4 · misleading

**Line:** `At its thinnest, the wall between air and blood is about half a micrometre: far thinner than a red cell. {c7}`

**Problem.** 'At its thinnest' and 'about half a micrometre' don't go together. The thinnest parts of the barrier are about 0.2–0.3 µm. Half a micrometre is the upper edge of the thin side, not its minimum. c7's own note says 'as thin as 0.2 µm'. A physiologist reading 'at its thinnest' will expect 0.2–0.3. The 'far thinner than a red cell' comparison holds either way: 7.5/0.5 = 15 times.

**Evidence.** Search excerpts only. West ch. 1 figure caption: the barrier is 'extremely thin, about 0.3 µm in some places'. Frontiers in Network Physiology 2023: 'the thin portion of the air-blood barrier, accounting for almost 50% of the whole surface, is <0.5 μm thick'. Electron-microscopy timeline (secondary): 0.2–0.5 µm. Weibel's harmonic-mean thickness for humans is about 0.6–0.8 µm, so 'about half' describes neither the minimum nor the mean.

**Fix.**

Over much of it, the wall between air and blood is under half a micrometre: far thinner than a red cell. {c7}   (The 'wall thickness' readout should read '< 0.5 µm'.)

<details><summary>Verifier's check</summary>

The finding stands. I could not verify anything live: the web-search budget for this turn was already used up, and NCBI would not resolve (ENOTFOUND). So I checked the script and c7, and compared them with standard textbook values I know.

1) The script really does pair the minimum with the wrong number. The vo line in the 'why' beat reads "At its thinnest, the wall between air and blood is about half a micrometre". That qualifier was added in the 25 Oct review so the line would not be read as the mean (Weibel's harmonic mean is about 0.6 µm). But it turns the line into a claim about the minimum, and the minimum is not about 0.5 µm. c7's own note says "as thin as 0.2 µm". Guyton's figure is the same: the respiratory membrane is "as little as 0.2 µm" in places and averages about 0.6 µm. West's EM caption gives "about 0.3 µm in some places". The thin side is about 0.2–0.3 µm, and 0.5 µm is the commonly quoted upper bound of the thin portion. So 'about half' at 'its thinnest' overstates the minimum by roughly 2–2.5 times. That is the kind of slip the physiologist who signs off would catch, and the line is not defensible as written. If the qualifier were dropped instead, 'about half a micrometre' would sit below the harmonic mean (about 0.6) and far below the arithmetic mean (about 2 µm), so that is not a fix either.

2) The 'far thinner than a red cell' comparison holds whatever value is used: 7.5/0.5 = 15 times and 7.5/0.2 ≈ 37 times.

3) The proposed fix is sound and well supported. "Over much of it, the wall between air and blood is under half a micrometre" matches West's 'much of its area' wording and Frontiers 2023 (the thin portion, about 50% of the surface, is <0.5 µm). Spoken right after "Each sac is wrapped in capillaries", 'it' reads naturally as the sac, so I give no betterFix.

Edits to keep consistent with the fix:
- set the 'wall thickness' readout to '< 0.5 µm';
- change the mechanism bullet ("a wall about half a micrometre thick") to "under half a micrometre over much of it";
- update c7's sentence and claim to the new wording (thin portion <0.5 µm, as thin as about 0.2 µm, against a red cell about 7.5 µm);
- in the review summary, replace "'at its thinnest' for the barrier" with the new qualifier.

</details>

### F5 · math

**Line:** `heading: tally "while you watched": litres of air, 6 a minute from frame 0  /  Notes: "the line lands near 62 s, about 6.2 L: 'about six'"  /  vo: About six litres of it. {c13}`

**Problem.** The Notes take the segment's start time, not the moment 'six' is spoken. The meanwhile beat (61.0–67.5 s) has 16 words: 11 in 'Meanwhile, as you watched, air went in and out of you.' and 5 in 'About six litres of it.' 'Six' is word 13, so it lands about 4.8 s into the beat. At 6 L/min the tally on screen reads about 6.6 when the voice says 'about six', and a viewer sees the mismatch.

**Evidence.** Calculation: 16 words in 6.5 s is about 2.5 words/s. 'Six' lands at about 61.0 + 12/2.5 = 65.8 s, and no earlier than 65.1 s even at 2.9 words/s. At 6 L/min (0.1 L/s) the tally then reads 6.5–6.6 L. At 5.5 L/min it reads 65.8 × 5.5/60 = 6.03 L. 5.5 L/min is inside c13's cited resting range of 5–8 L/min (JoVE; 400–500 mL × 12 breaths/min = 4.8–6 L/min).

**Fix.**

Heading: tally "while you watched": litres of air, 5.5 a minute from frame 0.  Notes: "The tally counts litres at 5.5 a minute (resting 5–8 L/min) from frame 0; 'six' lands near 66 s, about 6.0 L: 'about six'."  The vo stays. Update c13's claim and note to 5.5 L/min.

<details><summary>Verifier's check</summary>

The finding is right. The meanwhile line has 16 words, and 'six' is word 13. The Notes and c13's note time the tally to the start of the beat (about 62 s), not to when 'six' is spoken. The kit's own README (kits/cinema/script/README.md) says a real-time tally starts at frame 0 so that the spoken figure and the counter agree wherever the line lands. At 6 L/min it does not. Episode 1's measured bf_emma line ran 15 words in 5.09 s (2.95 words/s) and started 0.3 s into the beat (films/channels/body/ep01/film.json). At that pace 'six' lands about 65.3–65.8 s, and the tally reads 6.5–6.6 L. It reaches 6.7 L by the tease cut. Episode 1 shows the counter with Math.round. If ep05 does the same, the screen shows '7' from 65 s on, while the voice says 'about six', so a viewer would see the mismatch. As an absolute claim, 'about six' for about 65 s of resting breathing is fine: 5–8 L/min gives 5.4–8.7 L. The problem is only that the voice and the on-screen counter disagree. The proposed 5.5 L/min sits inside c13's cited resting range of 5–8 L/min (JoVE, via the claims file; my own web search was blocked by the session's search limit, so I could not re-check the source). It also holds up if the beat timing moves. Anywhere from 64 to 67.5 s the tally reads 5.9–6.2 L, and a rounded display shows '6' for the whole segment. The voice-over stays as written, so no re-voicing is needed. The fix is sound. Its only gap is that c13's 'claim' field also says 'the tally uses 6 L a minute', so that field needs changing too, along with the note.

</details>

## Story and wording notes (1) — apply when cheap

### F6 · story

**Line:** `For centuries, physicians taught the lung was airy flesh, there to cool the *heart*. {c4}`

**Problem.** Heard aloud, 'airy flesh' followed by 'bubbles' sounds like the same idea: flesh full of air. The change beat loses its break. Neither cited source says 'airy' either. The encyclopedia.com entry says the lungs were 'fleshy viscera', and the excerpts behind c4's 'coagulated blood' and 'did not cool the heart' wording come from the Bologna Scienza Giovane page and Tonetti 2015, not from encyclopedia.com. I found no source for the 'foam-like' reading the earlier review relied on.

**Fix.** For centuries, physicians taught the lung was clotted blood, there to cool the *heart*. {c4}   Change heading's '(airy flesh, an illustration)' to '(dense flesh of clotted blood, an illustration)', and add Tonetti 2015 (Acta Phlebologica 16:41–51) as c4's source.
