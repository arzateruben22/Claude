# Meanwhile, Inside ep01: script audit (26 Oct 2026)

## Verdict

The episode is close to clean. Every figure recomputes and matches its source excerpt: 0.84 × 30 trillion = 25.2 trillion. 3/7.5 = 0.40, so 'less than half' holds. The tally reads 2 million/s × 58.3 s = 116.6 million when the meanwhile line starts (film.json t0 58.3) and 127.5 million at 63.7 s, so 'over a hundred million' holds; as a cross-check, 25 trillion / (120 days × 86,400 s) = 2.41 million/s. 270 million × 4 = 1.08 billion, so 'about a billion' holds. 120 days matches MeSH. In the ×10 ride-along, the scene's capillary speeds of 0.4–1.2 mm/s show on screen at 40–120 µm/s, about 5–16 cell widths a second, which is plausible, and blood visibly slows from the arteriole (2 mm/s) into the capillary, which is correct. The story follows the beats: a hook question, a number made human, the narrowing, a wrong idea in the why, a lifetime escalation, the Meanwhile segment and a specific tease. Nothing from the 'Never write' list and no hype.

There are five fixes:
- **Misleading:** 'It can't' stretch is true only of the membrane's area (F1).
- **Misleading:** the sickle-cell button rests on stiffness, which the episode's own c8 source says doesn't decide passage (F2).
- **Story:** no sickle cell is ever on screen (F3).
- **Wording:** two small fixes, the noun missing after 'the tightest' (F4) and voice 'seven' against a '7.5 µm' pill shown at the same moment (F5).

Notes for the claims file, not script errors:
- c8 cites a bioRxiv preprint; cite the peer-reviewed version (Cell Microbiol 23:e13270).
- I could not confirm the NHLBI fact-sheet quote in c16 ('rigid strands... clogging the capillaries') myself; the PDF fetch failed and search didn't surface the phrase. MIT News and the NHLBI homepage support the same point.
- c3's claim text calls the contractile actin ring general to mammals, but a 2024 review reports it in mouse, not human, erythroblasts. The voiced line, 'pushed out its own nucleus', is fine.

Method: every check used search excerpts. Page fetches failed with DNS errors (bme.rochester.edu, internet-prod.nhlbi.nih.gov). On-screen numbers the headings don't list (the 7.5 µm and 50 µm pills, the 'its width' label, the '100× slower' badge) were checked against the built film.json and scene.mjs in films/channels/body/ep01.

## Confirmed findings (2) — fix before the final render

### F1 · misleading

**Line:** `You'd guess it stretches to fit. {-} It can't. {c7}`

**Problem.** "It can't" is true of the cell's surface area, not of the cell. A red cell stretches lengthwise easily: optical-tweezer studies literally stretch red cells, and a cell has to lengthen to pass a vessel about 3 µm wide. What it can't do is grow its membrane area. The film's own 3 µm squeeze (whoa, 39–42 s) shows the cell lengthening right after the voice says it can't stretch, so a specialist would object and viewers will see the contradiction. The c7 claim itself is about surface area ("nearly constant surface area: its membrane strongly resists stretching"), so the line overstates its own claim.

**Evidence.** Search excerpts (page fetches failed with DNS errors): the generally accepted yield areal strain for the red cell membrane is 2–4%, and 2–4% area expansion causes lysis (nanomedicine.com 9.4.3.2.1; PMC1280832). Optical-trap work shows the membrane 'elongates in the direction of applied force' at constant area. Halpern & Secomb 1989 (c7) model a squeeze at constant volume and area, which forces the cell to lengthen in near-minimal capillaries. The next line already uses the word 'surface', so the fix makes the wrong idea and its correction the same idea.

**Fix.**

You'd guess its surface stretches to fit. {-} It can't. {c7}

<details><summary>Verifier's check</summary>

The finding stands. A red cell resists two kinds of deformation very differently. Its membrane strongly resists any gain in area: Evans's micropipette work, which the search excerpts cite, puts lysis at 2–4% area expansion, and another study puts it at 2.6 ± 0.8%. Changing shape at constant area is easy. One review excerpt says a normal cell can "deform with linear extensions of up to 250%, but a 3% to 4% increase in surface area results in cell lysis." Optical-tweezer studies (Dao, Lim and Suresh 2003, and the work that followed) literally stretch cells: the long axis grows and the short axis shrinks. Ektacytometry scores deformability as an elongation index.

For a general audience, "stretches to fit" means getting long and thin, and that is exactly what a real cell does in a 3 µm vessel. I redid the geometry: 90 fL of volume as a 3 µm capsule comes out about 13–14 µm long, nearly twice the cell's 7.5 µm width, with about 129 µm² of area, close to the real 135 µm². So "It can't" is false of the cell. It is true only of its membrane area, which is all c7 claims ("nearly constant surface area"). The episode's own review file (films/channels/body/ep01/review/HUMAN-REVIEW.md, item 4) even says "a real cell stretches at constant volume". A physiologist reviewing it would object.

One correction to the finding: it says the film's 3 µm shot shows the cell lengthening, and that is somewhat overstated. The fold model in films/channels/body/set/rbc.js wraps the disc onto a capsule while keeping its arc length. The result is a thimble about 4 µm long and 2.4 µm wide, so the picture reads as "smaller and cupped" more than "stretched". The physics alone is still enough to sustain the flag.

The proposed fix ("You'd guess its surface stretches to fit. It can't.") is accurate. It matches c7, and it sets up the next line's "spare surface for its volume", so the wrong guess and its correction become the same idea. It adds one short word, which fits easily in the 11.5 s "why" beat. A better fix isn't needed. "Its skin stretches" is a friendlier option of the same length, but "surface" ties more tightly to the next line.

</details>

### F2 · misleading

**Line:** `Stiff sickle cells can jam the *smallest vessels*, where oxygen is handed out. {c12,c16} That dimple isn't decoration. {-}`

**Problem.** The button draws its conclusion about the dimple from a disease the line defines only by stiffness. The episode's own mechanism source (c8) says stiffness is not what decides passage: surface-to-volume ratio is. Placed side by side, the two lines say stiff cells jam, so the dimple matters, which doesn't follow from the line as written. c16's note admits the cause is hemoglobin S, not the dimple. 'That dimple isn't decoration' also asserts that the shape has a function, but it is tagged {-}. Sickle cells do lose the disc shape (they become crescents), which is the link the button needs, and an authoritative source states it.

**Evidence.** Namvar et al., published in Cellular Microbiology 23:e13270 (2020/21; search excerpt from the unimelb/ANU records): 'dramatic stiffening of RBCs had no measurable effect on their ability to traverse small channels'. The bioRxiv preprint cited in c8 is titled '...not cellular rigidity, determines...'. NHLBI homepage (search excerpt): sickle cell disease gives red cells 'a sickle or crescent shape instead of a disc shape', and these cells 'can block blood vessels'. MIT News 2012 (search excerpt): 'crescent-shaped cells clog capillaries instead of flowing smoothly, like ordinary, disc-shaped red blood cells do'. Add both to c16. The fix is 14+4 words against 13+4 now, inside the takeaway's 12–20 range. It keeps 'can' and the oxygen cue for the O₂ label, and it moves the dimple sentence onto its source.

**Fix.**

Sickle cells lose the *disc shape*, stiffen, and can jam where oxygen is handed out. {c12,c16} That dimple isn't decoration. {c8}

<details><summary>Verifier's check</summary>

The finding stands. Each fact in the line is correct, but the closing sentence does not follow from the sentence before it, and the fix closes that gap with sources.

Sources, checked by search excerpt:
- Namvar et al. exists under two titles. The bioRxiv preprint says "...not cellular rigidity, determines...". The published version is Cell Microbiol 23:e13270, DOI 10.1111/cmi.13270, titled "...not cellular viscoelasticity, is the major determinant...". The unimelb and ANU abstracts say dramatic stiffening had no measurable effect on passage through small channels.
- The NHLBI page says sickle cell disease turns red cells from a disc into a crescent shape and that these cells can block blood vessels.
- MIT News (1 March 2012) says crescent-shaped cells clog capillaries, unlike disc-shaped cells that flow smoothly.

Why the original falls short:
- **"Stiff" is accurate.** NHLBI says "rigid strands", and MIT says "stiffer, stickier".
- **The closing sentence doesn't follow.** The first sentence blames the jam on stiffness. The second then draws a conclusion about the dimple, which the first never mentions. c8, the episode's own mechanism source, says rigidity is not what decides passage. c16's note admits the cause is hemoglobin S, not the dimple. The word "sickle" hints at a shape for viewers who know it, but neither the line nor the takeaway shot (the hero cell springing back to a disc) says that sickle cells lose the disc.
- **The tag is wrong.** "That dimple isn't decoration" says the shape has a function, which is a claim about real cells. lint.py requires a claim id on every factual-looking sentence, so it should carry {c8}, not {-}.

Why I can't refute it: the original is factually true and roughly right for a general audience, but the button rests on a link the script never states.

The fix is sound:
- It states the missing link, that sickle cells lose the disc shape, and NHLBI and MIT both support it.
- It keeps "can", the oxygen cue for the O₂ label, and "stiffen", which c16 supports.
- It moves the dimple sentence onto c8.
- The starred "disc shape" lands on the shot of the cell springing back to a disc.

Two small corrections to the finding itself:
1. **Word count.** The new first sentence is 15 words, not 14, so the takeaway is 15+4 = 19. That is still inside lint's 12–20 range and the bible's 14–19 range, and is about 2.7 words a second over the 7-second beat.
2. **Where the jam happens.** The fix drops "the smallest vessels". c16's note leaned on that phrase to cover the 2012 Drexel study, which places most blockage just downstream of the capillaries. "Jam where oxygen is handed out" now points at the capillaries alone. The NHLBI fact sheet and MIT both say "clog capillaries", so this is still supported, but the physiologist should know the hedge is gone. Keeping "the smallest vessels" would push the takeaway to 20 words, which is outside the bible's range, so I don't think it is worth a different fix.

Add the NHLBI page and the MIT excerpt to c16 as the finding suggests, and note the published Namvar title in c8.

</details>

## Story and wording notes (3) — apply when cheap

### F3 · story

**Line:** `## takeaway {shot: the cell pops out and springs back to a disc · label: O₂, white with its glyph and ring · energy: 0.5} (52–59 s)`

**Problem.** The narration brings in sickle cells, but the picture never shows one: the healthy hero springs back with an O₂ label. That breaks 'concrete before abstract' and 'one line wins' (the object the caption names should be the brightest thing on screen). A muted viewer reads 'sickle cells' over a normal cell and may take the hero for a sickle cell. It also leaves the episode's stakes (rule 7) unseen.

**Fix.** ## takeaway {shot: a stylised crescent sickle cell (label "sickle cell") lodged in a capillary on "sickle", then the hero pops out and springs back to a disc · label: O₂, white with its glyph and ring · energy: 0.5} (52–59 s)

### F4 · wording

**Line:** `The tightest are about three micrometers: less than *half its width*. {c10}`

**Problem.** The noun is left out. The line comes after a 2.5 s silent hold, and the last noun spoken was 'parachute', so a listener hears 'the tightest [parachutes]?' and has to work out from the picture that it means vessels. The numbers are right.

**Fix.** The tightest vessels are about three micrometers: less than *half its width*. {c10}

### F5 · wording

**Line:** `Meet a *red blood cell*: a dimpled disc, about seven micrometers across. {c2}`

**Problem.** The voice and the screen disagree at the same moment. The built film's scale pill on the hero reads '7.5 µm' from 8.63 to 11.57 s, while the voice says 'about seven micrometers' from 8.37 to 9.78 s. The whoa label reads 'its width: 7.5 µm', and the c10 math uses 7.5. 'About seven' is within the source's 7–8 µm range, but hearing seven while reading 7.5 invites 'which is it?' comments. The script headings don't list this pill, so a script-only check would miss it.

**Fix.** Meet a *red blood cell*: a dimpled disc, about seven and a half micrometers. {c2}
