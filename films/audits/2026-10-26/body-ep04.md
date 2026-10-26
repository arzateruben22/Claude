# Meanwhile, Inside ep04: script audit (26 Oct 2026)

## Verdict

No factual errors in the narration or the on-screen numbers. I found 7 problems: one picture-honesty fix (an unbadged model presented as an electron micrograph), three sourcing fixes, and three small wording fixes. None of them changes a fact or noticeably changes timing (each replacement is within ±1–2 syllables). Evidence came from WebSearch excerpts only; WebFetch failed (ENOTFOUND) for jove.com, scientifica.uk.com, nobelprize.org and neuroscience.umn.edu.

Checked and confirmed:
- Golgi held the reticular (one-web) view and Cajal the separate-cell view, both working from Golgi's black reaction. They shared the 1906 Nobel and their lectures disagreed.
- The gap was first shown in 1954–55 electron micrographs (De Robertis & Bennett: 100–150 Å).
- The readout's cleft of 20–50 nm matches JoVE ('usually 20-50 nm wide').
- 'About a thousandth of a second' matches JoVE (~1 ms). Textbooks give 0.3–1 ms with 0.5 ms as the usual figure, so 'about' is fair.
- Diffusion across a 20–50 nm cleft is t ≈ x²/2D with D ≈ 0.5 µm²/ms, which gives about 0.4–2.5 µs. That supports the 'handoff, not crossing' wording.
- Light microscopes resolve about 200 nm (Abbe limit 550/2.8 ≈ 196 nm), so 'no microscope could show it' holds.
- 86 billion neurons × thousands of connections fits '100+ trillion'.
- Breaths at 15 a minute: the 'fifteen' lands near 61 s, and 15/60 × 61 ≈ 15.3 (the resting range of 12–20 a minute gives 12–20).
- The rhythm is generated in the brainstem (pre-Bötzinger complex, Smith et al. 1991) and reaches the diaphragm through chemical synapses, which supports 'gaps like these'.
- 'Most' covers electrical synapses, and the plasticity line is properly hedged.

Story: the seven beats are all there. The hook is a real question, 'they look joined' sets an expectation that the electron-microscope gap breaks, Golgi and Cajal give the person and the wrong idea, the whoa widens to learning, and the takeaway can be repeated. The meanwhile segment leads into the tease and the loop returns to frame 0. There are no 'Never write' phrases, no exclamation marks and only one question per beat. Takeaway-then-meanwhile is the channel's normal order (ep02, ep03 and ep05 do the same), so I didn't flag it.

Housekeeping, not findings:
- The c13 note still mentions 'wired together', which the script no longer says.
- The c14 note says the line lands 'near 60 s'; the script note says 'near 61 s'.

## Confirmed findings (4) — fix before the final render

### F1 · misleading

**Line:** `## why {shot: the blur sharpens into an electron-microscope view: a gap; the signal arrives, calcium floods the tip, vesicles spill, messengers drift across; readout "the gap: about 20–50 nm" · picture-only 2.5 s · energy: 0.55}`

**Problem.** The direction calls for a rendered model styled as a real electron micrograph, with moving vesicles and molecules, and gives it no badge. An electron microscope only images fixed, dead tissue, so nobody has filmed vesicle fusion or transmitter drifting across this way. Transmitter molecules are under 1 nm across, so any visible 'messengers' are hugely enlarged. A viewer could take the shot for footage. The episode badges its change-beat illustrations, and ep02's why carries 'badge: illustration', but this beat, the one most likely to pass as real, has no badge.

**Evidence.** Bible §9: 'Shots that compress scale are labelled "not to scale"'. WRITING.md rule 9: 'Idealisations are said aloud or badged.' Ep02 script, why heading: 'badge: illustration'. Ep04 change heading: '(illustrations, badged)'. De Robertis & Bennett 1955 (search excerpt, PMC) describe static fixed-tissue micrographs. JoVE gives the cleft as 20–50 nm (search excerpt); a transmitter molecule such as glutamate is under 1 nm, so drawing it visible is at least 20× enlarged.

**Fix.**

## why {shot: the blur sharpens into an electron-microscope-style view (badge: illustration, not to scale): a gap; the signal arrives, calcium floods the tip, vesicles spill, messengers drift across; readout "the gap: about 20–50 nm" · picture-only 2.5 s · energy: 0.55}

<details><summary>Verifier's check</summary>

The finding stands. I could not search: the session's shared web-search limit was already used up, so I checked the claim against the repo files and what I already know.

1. The script matches the finding. The why heading in ep04/script.md calls for "an electron-microscope view" in which the signal arrives, calcium floods the tip, vesicles spill and messengers drift across. It has no badge. The narration over it says "electron microscopes finally showed it: a gap". A viewer will reasonably think they are watching what the microscopes showed.

2. The episode's own rules require a badge here.
   - Bible §9: "Shots that compress scale are labelled 'not to scale'."
   - WRITING.md rule 9: "Idealisations are said aloud or badged."
   - Ep02's why carries "badge: illustration", and ep04's own change beat is "(illustrations, badged)".
   So the beat most likely to pass as real footage is the one beat left unbadged.

3. The science supports the finding.
   - Transmission electron microscopy images samples that have been fixed or frozen and cut into sections, and it runs in a vacuum. It cannot film living tissue.
   - The 1954–55 micrographs (claims c7) were still images of membranes with a gap of about 10–15 nm between them.
   - Even modern flash-and-freeze EM only gives separate frozen snapshots. No one has an EM movie of vesicles fusing or of transmitter crossing the gap.

4. The scale is compressed. A glutamate molecule is about 147 Da, roughly 0.5–1 nm across, and a calcium ion is about 0.2 nm. Against a gap of 20–50 nm, any messenger drawn large enough to see is enlarged 20 times or more.

5. The line can't be defended on the grounds that the whole series is stylised. The direction deliberately asks for the look of a real micrograph, which is exactly what makes it mistakable for footage.

The proposed fix works. It changes "view" to "-style view", which matches the show's idiom, and adds "badge: illustration, not to scale". That covers both rules. The readout of the real gap width can stay, because a "not to scale" label sits fine next to a real measurement. No better fix is needed.

</details>

### F2 · unsourced

**Line:** `vo: Use a junction, and it can grow *stronger*: likely part of how you *learn*. {c12}`

**Problem.** The line is true and suitably hedged, but its cited source doesn't say what c12 quotes. claims.json credits 'synaptic plasticity is the best cellular and molecular model of learning and memory' to the University of Minnesota page. That wording comes from a 2013 University of Washington symposium announcement. The UMN research-area page says the mechanisms 'remain poorly understood' and ranks nothing. The physiologist signing off would find the quote missing from the linked page.

**Evidence.** WebSearch excerpts only (WebFetch of neuroscience.umn.edu failed with ENOTFOUND). UMN page: 'the mechanisms that control synaptic plasticity and learning and memory are poorly understood'. nbio.uw.edu, 'International Symposium: Current Trends and Future Directions of Synaptic Plasticity Research' (July 2013), is where the 'best cellular and molecular model' wording appears. A citable replacement: Martin, Grimwood & Morris 2000, Annu Rev Neurosci 23:649–711 (PubMed 10845078), abstract: 'a wealth of data supports the notion that synaptic plasticity is necessary for learning and memory'.

**Fix.**

Line unchanged: "Use a junction, and it can grow *stronger*: likely part of how you *learn*. {c12}". In claims.json c12, replace the UMN URL with https://pubmed.ncbi.nlm.nih.gov/10845078/ (Martin, Grimwood & Morris 2000) and quote its 'necessary for learning and memory' sentence instead of the misattributed 'best model' line.

<details><summary>Verifier's check</summary>

I could not check the sources live. WebSearch had used up its per-turn budget, and the proxy blocks neuroscience.umn.edu and pubmed.ncbi.nlm.nih.gov (WebFetch returns ENOTFOUND, curl gets a 403 on CONNECT). No cached copy of either page exists in the audit folder or the repo. So I can't confirm from the live page which site the 'best cellular and molecular model' wording comes from.

The finding still stands, for three reasons:
(1) claims.json shows c12 was never checked against the page itself. It is marked verified_via 'search excerpt', so the quote rests on a search snippet, which is exactly the kind of source that mixes up attributions. The checker has a specific counter-excerpt and a named alternative origin (the 2013 UW nbio symposium page).
(2) The note's second quote, "An NIMH-funded researcher: 'Synaptic plasticity is thought to be a basis…'", has no source at all.
(3) A department 'research areas' page is a weak citation for a physiologist's sign-off, whatever it says.

The proposed replacement checks out from my own knowledge. PMID 10845078 is Martin SJ, Grimwood PD, Morris RGM, 'Synaptic plasticity and memory: an evaluation of the hypothesis', Annu Rev Neurosci 2000;23:649–711, doi:10.1146/annurev.neuro.23.1.649. Its abstract opens by calling synaptic strength change 'widely assumed to be the mechanism by which memory traces are encoded and stored'. It concludes 'a wealth of data supports the notion that synaptic plasticity is necessary for learning and memory, but that little data currently supports the notion of sufficiency.' That supports both the claim and the 'likely part of' hedge.

The spoken line is accurate and properly hedged for a general audience, so it needs no change. The fix is correct and better than what is there, so no betterFix.

Two small changes when applying it:
- Quote the whole concluding sentence, including the 'sufficiency' clause, because that is what justifies 'part of'.
- Drop the unattributed NIMH quote and set verified_via honestly: the abstract was not fetched in this pass, so it should be re-confirmed when the network allows.

</details>

### F3 · unsourced

**Line:** `vo: Your brain holds over a hundred trillion of these meeting points. {c3} · readout "junctions in your brain: 100+ trillion"`

**Problem.** The line and readout are defensible, but the only cited source (UCLA BRI) says 'an estimated 100 trillion synapses', not 'over'. The figure that supports 'over' is mentioned in the note but not cited. The note is also stale: it says 'the readout says "about"', but the readout shows '100+ trillion'.

**Evidence.** WebSearch excerpt of bri.ucla.edu: 'approximately 86 billion neurons, each forming thousands of connections, and an estimated 100 trillion synapses'. Tang et al. 2001, Synapse 41:258–273: about 164 × 10^12 synapses in the neocortex alone (CV 0.17), cited as '164 trillion ±17%' in the 2025 State of Brain Emulation report (arXiv 2510.15745). Check: 164 × (1 − 0.17) ≈ 136 trillion, which is above 100 trillion even one SD low and before counting the cerebellum. Pakkenberg et al. 2003 (PubMed 12543266) gives ≈0.15 × 10^15 for the neocortex.

**Fix.**

Line unchanged: "Your brain holds over a hundred trillion of these meeting points. {c3}". In claims.json c3, cite Tang et al. 2001 (Synapse 41:258–273: about 164 trillion synapses in the neocortex alone; verified via a secondary citation in arXiv 2510.15745) as the source for 'over', and keep UCLA for the ~100 trillion figure. Rewrite the end of the note to: "UCLA's ~100 trillion is the low end; Tang's 164 trillion for the neocortex alone supports 'over'; the readout says '100+ trillion'."

<details><summary>Verifier's check</summary>

The finding stands. It reads the files correctly, and it is a defect in the claims record, not in the line. In claims.json, c3's only source_url is the UCLA BRI page. The quoted excerpt there is 'an estimated 100 trillion synapses', which supports 'about', not 'over'. The figure that does support 'over' appears only in passing in the note ('Pakkenberg; Synapse 2001') and is never cited. The note is also stale on two counts. It says "the readout says 'about'", but the script's normal beat shows the readout "junctions in your brain: 100+ trillion". It also says "'About a hundred trillion' is the commonly cited estimate", which is wording from before the 25 Oct review changed "a hundred trillion" to "over a hundred trillion". The line itself is defensible for a general audience. I re-ran the calculation: 164 × (1 − 0.17) = 136.1 trillion, still above 100 trillion one SD low, for the neocortex alone. The CV describes spread between people, so the mean of 164 trillion is the stronger point. The cerebellum and other regions only add to it. So 'over a hundred trillion' and '100+' are safe. Tang et al. 2001 (Synapse 41(3):258–273, ~164 × 10^12 neocortical synapses) and Pakkenberg et al. 2003 (~0.15 × 10^15) match what I know of these papers. I could not re-check them live: this turn's WebSearch budget was used up, and pubmed.ncbi.nlm.nih.gov did not resolve for WebFetch. The proposed fix is right, keeps the line, and goes in the right direction, but it is slightly incomplete. It leaves the pre-review 'About a hundred trillion' sentence in place, and it does not say that the Tang figure was confirmed only through a secondary citation.

</details>

### F4 · unsourced

**Line:** `Up close, they look *joined*. {-}`

**Problem.** The {-} tag says this states nothing outside the film, but it does: a factual claim that synapses look continuous under magnification. At this point the picture is the pull-back to a whole neuron, not the frame-0 blur, so the line isn't just describing what's on screen. 'Up close' is also loose. The closest view in the film, the electron microscope two beats later, shows the opposite. The claim is only true at light-microscope resolution, which is what c1 covers.

**Evidence.** c1 (Nagwa, search excerpt): light microscopes resolve about 200 nm. Abbe limit: d = λ/(2·NA) = 550 nm / (2 × 1.4) ≈ 196 nm. The cleft is 20–50 nm (JoVE, search excerpt), 4–10× below that, so under a lens the contact looks continuous. WRITING.md rule 9: 'Every factual sentence goes in claims.json.'

**Fix.**

Through a lens, they look *joined*. {c17}  (add claims.json entry c17: sentence "Through a lens, they look joined."; claim: a conventional light microscope resolves about 200 nm (Abbe 550/(2×1.4) ≈ 196 nm) and the cleft is about 20–50 nm, so the contact looks continuous; source Nagwa explainer + JoVE Chemical synapses; accessed 2026-10-25; verified_via "search excerpt"; status ok. Do not reuse c1, which belongs to the hook sentence.)

<details><summary>Verifier's check</summary>

The finding stands, but the proposed fix fails lint, so a betterFix follows.

1) The {-} tag is wrong. The README allows {-} only for framing, an instruction, or a description of the film's own picture. During the normal beat (5–15 s) the picture is the pull-back to one neuron's branches. The joined-looking blur was frame 0. So "Up close, they look joined" is not describing what is on screen. It says how real synapses look, and it sets up Golgi's wrong idea. That makes it a factual sentence under WRITING.md rule 9. (lint.py doesn't flag it because the line has no number, name, absolute or comparison. It passes only because the author self-tagged {-}.) If it really were a description of the picture, it would break rule 6 instead.

2) "Up close" is loose. In the present tense, the closest view in the film is the electron microscope (c7), which shows the gap. The line is only true at light-microscope resolution.

3) The numbers check out. Abbe: 550 / (2 × 1.4) = 196 nm, about 200 nm. 196/50 ≈ 3.9 and 196/20 ≈ 9.8, so the cleft is 4–10× below the limit. Through a conventional light microscope the contact looks continuous.

I couldn't re-check the sources myself: the shared WebSearch budget for this turn was used up. I relied on the excerpts already in claims.json (Nagwa, JoVE, c7's De Robertis 10–15 nm), the textbook Abbe limit, and widely cited cleft widths. None of them contradicts the finding.

4) The proposed fix is broken. It tags the new line {c1}, but c1's ledger sentence is the hook ("For decades, no microscope could show it."), and a claim ties to one sentence. I applied the fix to a copy at /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/verify_ep04/ep04 and ran kits/cinema/script/lint.py. It gives "ERROR claim c1: its sentence differs from the script" plus "WARN claim c1: cited by 2 sentences". The original lints with 0 errors, so the fix as written breaks the build.

The wording "Through a lens" is fine for a general audience, because the hook has already said "microscope". The fix needs a new claim, c17, instead of reusing c1. Its ledger entry:
- sentence: "Through a lens, they look joined."
- claim: light microscope about 200 nm (Abbe: 550 / (2 × 1.4) ≈ 196 nm), cleft 20–50 nm, so the contact looks continuous
- sources: the Nagwa URL, plus JoVE for the cleft width
- accessed 2026-10-25, verified_via "search excerpt", status ok

With that entry added to the copy's claims.json, lint gives 0 errors. The only warning is the missing pron.json, which the original also has. The beat goes from 25 to 26 words (2.8 words a second), inside its 22–34 range.

</details>

## Story and wording notes (3) — apply when cheap

### F5 · wording

**Line:** `vo: Using the same stain, Camillo Golgi saw one continuous *web*. {c4} Santiago Ramón y Cajal saw separate *cells*. {c5}`

**Problem.** Heard aloud, 'the same stain' has nothing to refer back to. The listener hasn't heard of any stain yet, and the comparison only makes sense a sentence later. The wording also hides the irony the review meant to add (per the script's own notes): Golgi invented the stain, and Cajal used it against him. As written, it sounds like both men just used some ordinary stain.

**Fix.** vo: Camillo Golgi, who made the stain, saw one continuous *web*. {c4} With it, Santiago Ramón y Cajal saw separate *cells*. {c5}

### F6 · wording

**Line:** `vo: A typical one reaches out to thousands of others. {c2}`

**Problem.** Spoken straight after the hook's last sentence ('…no microscope could show it.'), 'a typical one' attaches to the nearest noun, 'microscope', and a listener briefly hears 'a typical microscope'. The intended referent, 'nerve cells', is two sentences back.

**Fix.** vo: A typical nerve cell reaches thousands of others. {c2}

### F7 · wording

**Line:** `readout "touching? ?" (hook heading, frame 0)`

**Problem.** The frame-0 readout prints two question marks in a row ('touching? ?'), which looks like a typo on the poster frame. Every other readout in this episode and in ep05 uses the 'label: value' form ('junctions in your brain: 100+ trillion', 'the gap: about 20–50 nm', 'air sacs in your lungs: ?').

**Fix.** readout "touching: ?"
