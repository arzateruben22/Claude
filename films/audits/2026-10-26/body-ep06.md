# Meanwhile, Inside ep06: script audit (26 Oct 2026)

## Verdict

Mostly clean: no factual errors and no math errors. Two fixes, a lifetime overclaim in the tease and one pronunciation, both of which keep the beat lengths.

Every voiced claim and on-screen number was checked through WebSearch excerpts; no page was fetched. They hold up as follows:
- **Neutrophil size:** BioNumbers 100510 (Downey 1990) gives 8.4 µm by Coulter counter and 8.3 µm by flow cytometry, so "about eight micrometres" and the "about 8 µm · round, in blood" pill hold.
- **"Commonest white cell":** StatPearls gives 60–70% neutrophils, so it is true for adults.
- **Virchow and Cohnheim:** Virchow's connective-tissue origin of pus is correct. Cohnheim's 1867 paper (Virchows Arch 40:1–79) on curarised frog mesentery is correct. "His assistant" holds, since he was in post from 1864/65 to 1868. Britannica says he "confirmed earlier suspicions" and that pus is mainly leukocyte debris.
- **Rolling LAD-I cells:** von Andrian 1993's abstract matches "Cells roll on past" word for word.
- **Gap width:** the Alon lab page gives "4-5 micron wide gaps". Barzilai 2017 says gaps form without endothelial contractility. 4/8.3 = 0.48 and 5/8.3 = 0.60, so "narrower than itself" holds.
- **End card:** Waller's paper is Phil Mag, November 1846, 29: 397–405, confirmed, and 1867 − 1846 = 21 years.
- **Half-life:** Lahoz-Beneytez 2016 gives 0.79 d (19 h).

Recomputed numbers:
- **Tally rate:** 1.5e10 ÷ 86,400 = 173,611.1 a second.
- **Ten million:** 1e7 ÷ 173,611 = 57.6 s, inside the takeaway.
- **The 19 h floor:** 5e10 × 6/19 = 1.58e10. 10e10 × 8/19 = 4.21e10.
- **Pool cross-check:** 4.9e10 × ln2 × 24/19 = 4.29e10 a day. Circulating pool alone: 2.17e10 × 0.875 = 1.90e10.
- **Dancey:** 0.85e9 × 70 = 5.95e10 a day.
- **Break-even:** 1e7 ÷ 61.8 × 86,400 = 1.40e10 a day.

Against the real voiced placement in film.json, the meanwhile line runs from 61.1 s to 66.85 s and "ten" is spoken at 65.87 s. The tally reads 10.61M at the start of the line, 11.44M at "ten" and 11.61M at the end. "More than ten million" is true throughout. The heading's "about 10.7–11.6 million" is close enough with "about".

The hook question ends at 1.70 s in the voiced take, under the 2.0 s limit.

Story: the seven beats are all there in the channel's order (takeaway, then meanwhile, as in episodes 1–5).
- The hook plants "no open door".
- The normal turns it into a paradox.
- The change brings in Virchow's wrong idea and Cohnheim's picture.
- The why gives one mechanism and the LAD-I stakes, and ends on an open loop.
- The whoa pays off "door".
- The takeaway is a real reframe.
- The tease is specific.
No line from "Never write" appears, there are no exclamation marks, and there is no hype.

One voice check that is not a script change: the tease take's recogniser heard "Next the spark eh." "spark" runs about 0.68 s before the pause, so listen for a trailing vowel and re-voice vo08 if it is there.

## Confirmed findings (1) — fix before the final render

### F1 · misleading

**Line:** `vo: Next: the spark. {-} What sets off every *heartbeat* you've ever had? {-}`

**Problem.** The question assumes that one structure set off every heartbeat of the viewer's whole life. The picture then answers it: the SA-node patch flickers "on each lub". Episode 7 will answer it the same way (bible row 7: "the SA node, starts each beat"). Taken over a lifetime that is not true, for two reasons. First, the embryonic heart starts beating around day 22, but the SA node only becomes visible as a structure at Carnegie stage 14 (about day 32). Until then the primitive inflow (sinus venosus) myocardium sets the pace. Second, ectopic beats start outside the SA node, and most healthy adults have some. "You've ever had" turns the bible's milder hook ("What starts every heartbeat?") into an absolute claim about the viewer's whole life, which a cardiologist reviewer would correct. The sentence is also tagged {-} even though what it assumes is an outside fact.

**Evidence.** WebSearch excerpts only (no fetch). Embryology.ch / U. Minnesota Visible Heart atlas: the primitive heart tube begins to contract on day 22 (stage 8–10); "During early development, the entire sinus venosus has a pacemaker activity"; "The first morphologically visible differentiation of the conduction system in human embryos is the sinu-atrial node (stage 14)." PVC reviews (e.g. heart.bmj.com 103/9/702, PMC6711062): PVCs show up in "approximately 1% on standard 12-lead electrocardiograms and 40% to 75% on routine 24-hour to 48-hour Holter monitoring" of apparently healthy people; a population study of 2,048 healthy adults aged 25–41 found at least one PVC in 69% over 24 h. By definition a PVC starts in the ventricle, not the sinus node.

**Fix.**

vo: Next: the spark. {-} What sets off nearly every *heartbeat* you have? {-}   (about 11 syllables, the original is 11–12; 'heartbeat' keeps its star; episode 7's answer should say 'nearly every' / 'each normal beat' to match)

<details><summary>Verifier's check</summary>

The finding stands. It is a small issue, but it is real under this series' own honesty rule.

1. **The finding reads the script correctly.** The tease shows "a small patch high in its upper right chamber flickers chartreuse on each lub". The script's Notes call that patch "the SA node". Bible row 7 gives the answer as "A patch of self-firing cells, the SA node, starts each beat." So the question works as a setup for "the SA node started every beat of your life."

2. **That setup is false when stretched over a whole life.**
   - **Ectopic beats.** Most healthy adults have some. A population study of 2,048 adults aged 25–41 found at least one PVC in 69% over 24 hours. Reviews give 40–75% on 24–48 h Holter monitoring (heart.bmj.com 103/9/702; PMC6711062). Over a lifetime, almost no one has had only sinus beats, and a PVC starts in the ventricle by definition.
   - **The embryo.** The heart beats from about day 22. The SA node appears as a structure only at about stages 14–16. Before that, the sinus venosus myocardium as a whole carries pacemaker activity (chick electrophysiology; human morphology, jpxb 2009).
   - The embryo point is the weaker of the two. That tissue is the SA node's own precursor, and those beats are a tiny share of a lifetime. The ectopic-beat point is enough on its own.

3. **"You've ever had" is what makes it absolute.** The bible's milder hook ("What starts every heartbeat?") has no lifetime scope. Rule 9 of WRITING.md says to use "about" and "nearly", and a physiologist signs off this episode.

4. **The best defence still fails.** One could say the question names nothing, so the answer could be "the heart's own self-firing cells", which also covers ectopic foci. Two things rule that out:
   - the picture points at the SA node on every beat;
   - episode 7's answer is the SA node specifically.

5. **The {-} tag point is minor but fair.** By the lint's definition, {-} means the sentence states nothing outside the film. This question assumes an outside fact, even though the script defers its sources to episode 7.

**The proposed fix is sound.** "What sets off nearly every *heartbeat* you have?" is true even taken over a lifetime: embryonic and ectopic beats are a tiny share of about 3 billion. It keeps the star on "heartbeat" and has about 11–12 syllables, like the original. The tease stays at 11 words, inside the 8–11 rule. "Nearly" is the hedge rule 9 asks for, and it may even make viewers curious about the exceptions.

**What else this needs:**
- The tease has already been voiced (vo/lines.json, vo/words.json, film.json), so it must be re-voiced and re-timed.
- Episode 7's hook and answer should say "nearly every" / "each normal beat" to match.

**An equally valid option:** "What sets off nearly every *heartbeat* you've had?" is the same length and keeps the lifetime sweep. I am not proposing it as a betterFix, because the submitted fix is not wrong.

</details>

## Story and wording notes (1) — apply when cheap

### F2 · wording

**Line:** `Cells roll on *past*. {c25}`

**Problem.** This is the starred last word of the why's open loop, and in the voiced take it comes out ambiguous. The pipeline's own speech recogniser transcribes it as "Cells roll on paste." The cause is the phonemes: vo/lines.json gives "sˈɛlz ɹˈəʊl ˌɒn pˈast", a short TRAP vowel, where this British voice (bf_emma, en-gb, the same voice that says 'spˈɑːk') would say RP "pˈɑːst". At speed 0.86 and stretched at the end of the line, it drifts toward "paste". A viewer who isn't reading the captions can miss the turn that sets up "This one".

**Fix.** Cells roll on *past*. {c25}   (words unchanged: add "past": "pˈɑːst" to pron.json and re-voice vo04; if the recogniser still hears 'paste', say "Cells roll on *by*. {c25}")
