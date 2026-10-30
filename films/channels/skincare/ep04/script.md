# Outer Layer No. 004: "What a tan is" (WIP draft, unlinted, claims.json not yet written; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Bible §7 #4.

The story: a tan looks like the skin getting ready for the sun, but it starts after the sun has already done
harm. Ultraviolet fuses two letters of a living cell's DNA faster than a trillionth of a second; the cell's
guardian protein (p53) switches on and sends a chemical message (α-MSH) down to the pigment cells; days later
their melanin sits over each nucleus like a parasol. The wrong idea is the "base tan" as a shield; the person is
the 2007 Boston study (Cui et al., Cell) whose mice without p53 in their skin cells never tanned. The whoa: all
those parasols together are worth about SPF 3–4. "To scale" puts one parasol beside the paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's "shield" to the takeaway's "remembers"; the voice carries
the meaning and the screen the specifics (UVB, < 1 ps, p53, α-MSH, 2007 · Cui et al., 48–72 h, SPF ≈ 3–4,
the nucleus in µm, 100 µm paper). The picture changes scale with the ideas: the section → one nucleus → the DNA
ladder → back out to the basal row and a melanocyte → the parasols across a whole field of cells.

Honesty, on screen: the section is "simplified"; the DNA ladder is a "model" at "scale ×N"; the chemical
message is an "illustration"; the days of tanning run under "time ×N"; SPF 3–4 is an "estimate". The skin is
drawn in three melanin levels (medium in the hook, deep at the pigment cell, light in the whoa) and every tone
tans in the picture; nothing about any one tone is said or implied. No advice: the film says what a tan is,
never what to do.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep04 --segment toscale`.

## hook {shot: frame 0, the payoff: the section in a medium tone under violet UV dashes, melanin parasols over the top living cells, gauge at 0 µm · badge: simplified · title: "What a tan is" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Is a tan a *shield*? Only a thin one, built after the harm. {c1,c2}

## normal {shot: the parasols fade (the film rewinds to untanned skin), UV dashes rain in; push through the dead layer to one living cell on "living", then dive into its nucleus to the DNA ladder; two rungs fuse in uv on "DNA" · spine UVB → < 1 ps · picture-only 0.5 s · energy: 0.45} (5–16 s)
vo: Sunlight carries ultraviolet, and its shorter rays reach the living cells just under the dead layer. In less than a trillionth of a second, one can fuse two letters of their *DNA*. {c3,c4}

## change {shot: pull back out of the nucleus on "notices"; a guardian badge lights in the cell (p53); a chain of small signal beads drifts down to the basal row on "message", where a melanocyte's branches light; its melanosomes darken on "melanin" · spine p53 → α-MSH · picture-only 0.6 s · energy: 0.55} (16–28 s)
vo: The cell notices. A guardian protein switches on, and the cell sends a chemical message down to the pigment cells: make *melanin*. {c5,c6}

## why {shot: hold the basal row; the signal beads stop on "lacked" (a second section beside it, its guardian dark: no beads, no melanin); the main section's melanocyte keeps filling on "answering" · badges: illustration · Cui et al., 2007 · picture-only 2.2 s · energy: 0.5} (28–41.5 s)
vo: Researchers in Boston found that mice whose skin cells lacked that guardian never tanned at all. {c7} So a tan isn't skin getting ready for the sun. It's skin *answering* damage already done. {c8}

## whoa {shot: time runs on (time ×N, day 0 → 3): melanin climbs the branches into the cells above and settles over each nucleus as a cap; pull back on "Together" across a wide field of capped cells in a light tone under UV dashes, about a third of the dashes still getting through · spine 48–72 h → SPF ≈ 3–4 · badge: estimate · picture-only 3.2 s · energy: 0.8} (41.5–53.5 s)
vo: Over the next few days, the melanin settles over each nucleus like a tiny *parasol*. {c9,c10} Together, a whole tan adds up to about SPF *three or four*. {c11}

## toscale {segment: toscale · the gauge lifts to centre beside the section: one parasol's width fills in, then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (53.5–61 s)
vo: Each parasol is about as wide as the nucleus it shades: a dozen side by side would span a sheet of *paper*. {c12,c13}

## takeaway {shot: back to the hook's composition, UV dashes again, the parasols lit · picture-only 0.5 s · energy: 0.3} (61–68.5 s)
vo: So, is a tan a shield? A thin one. It's how your skin *remembers* the light. {c14}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–75 s)
vo: Next: who has more pigment cells, the darkest skin or the *lightest*? {-}
end card: "Next layer: who has more pigment cells, the darkest skin or the lightest?" · "Outer Layer · No. 005"

## Notes
- WIP (paused 30 Oct). Web search hit the account's spend limit during research. Search excerpts were seen for:
  Cui et al. 2007 (p53 → POMC → α-MSH; mice without p53 in keratinocytes did not tan), Harvard Health (base tan
  ≈ SPF 3–4), CDC/Mayo (a tan signals UV injury), delayed tanning at about 48–72 h (PMC2593890), supranuclear
  melanin caps (PMC9984416), CPDs forming within about 1 ps (PMC2792699). Not yet sourced: UVB reaching the
  living epidermis, the nucleus/cap width (c12). Those go in claims.json as "TODO open link" until checked.
- A person opens each link, and a board-certified dermatologist signs off, before posting.
- Listen at T0: ultraviolet, melanin, nucleus, parasol.
