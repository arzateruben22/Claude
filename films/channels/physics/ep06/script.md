# Rest Frame No. 006: "The ten-meter straw" (draft; a physicist signs off before it posts)

About 70 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labelled as AI), with an
original score. Built from the bible's episode 6 (`../bible.md`, §7 #6) and episode 5's tease ("Next: a
drinking straw, three stories tall. Could you still drink through it?"), which this episode pays off.

- One world: a small table with a glass of water and a straw, the wooden mannequin sipping, and behind it an ink
  house front three stories tall with a tall straw running up it from a basin on the floor to a pump on the roof.
- The physics (`../set/straw.js`): the drink rises until the pressure difference holds the column,
  h = Δp / (ρ g). A sip of about 2 kPa holds 20 cm; normal lungs manage about 7–12 kPa (70–125 cm of water);
  a perfect pump at the top leaves only water's own vapor, 2.3 kPa at 20 °C, so the column stops at
  10.1 m (10.3 m with no vapor at all). How fast it climbs is illustrated, not computed (badged). Heights on
  the house's scale are measured from the basin's surface.
- The spine reads the pressure inside the straw in hPa: 1013 at rest, 994 for the sip, about 915 in the lidded
  glass (a hard sip, and nothing rises); then the tall column in meters, 1.0 on the lungs alone, 7 for a mouth
  pumping with cheeks and tongue (a stunt), 10.1 with the perfect pump, held lit through the takeaway. The measure reads the frozen column against the house's meter marks.
- The whoa: the tall straw. Lungs alone lift it about a meter, a pumping mouth (a stunt) about seven; a perfect pump
  takes it up, slowing, to stop near 10 m;
  at the top it boils at room temperature.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep06 --segment measure`.

## hook {shot: low, up the house front: the tall straw with its column stopped near the top, empty above, the glass and the mannequin at its foot; frame 0 is the loop's · title drop: "The ten-meter straw" · pre: 0.1 · energy: 0.6} (0–4 s)
vo: What lifts a drink up a *straw*? {-} Something invisible, pushing. {c13}

## normal {shot: down to the bench: the mannequin sips; the water climbs the short straw · pre: 0.15 · energy: 0.45} (4–12 s)
vo: A glass of water. {-} A straw. {-} One sip. {-} The water climbs twenty centimeters, to your lips. {-} It feels
like you're *pulling* it. {-}

## change {shot: the glass is topped up to the brim and an airtight lid, sealed around the straw, comes down onto it; the mannequin sips, nothing moves · badge: "Rigid lid, no air inside" · pre: 0.1 · energy: 0.5} (12–20 s)
vo: Now fill it completely. {-} Seal it, airtight, with a lid. {-} Then sip, however hard you like. {-}
*Nothing* rises. {c2}

## why {shot: the lid comes off; Torricelli's tube in ink beside the table; the air drawn as arrows pressing on the drink · picture-only 2 s · pre: 0.25 · energy: 0.55} (20–37 s)
vo: In sixteen forty-four, Torricelli saw why. {c3} We live at the bottom of an ocean of air, and it
presses on everything. {c4} A sip lowers the pressure inside the straw, and the air outside pushes the
drink *up*. {c5} How hard can it push? {-}

## whoa {shot: the tall straw up the house front: lungs alone lift it a meter, a pumping mouth (a stunt) seven, then the pump on the roof takes it up, slowing, to stop near 10 m; up close, boiling at the top · picture-only 3 s · energy: 0.8} (37–54 s)
vo: Make the straw three stories tall. {-} Your lungs alone? {-} About one meter. {c8} Pumping with cheeks and
tongue, one stunt reached seven. {c15} With a perfect pump, the water stops near ten *meters*. {c6} At the top,
room-temperature water boils. {c7}

## measure {segment: measure · frozen: the column's ghosts every fifth of a second bunching under the top, against the meter marks; a 1 cm² square of air on the basin, and the 10.3 m line · pre: 0.2 · energy: 0.3} (54–62 s)
vo: *Measure it*: the air above one square centimeter weighs just over a kilogram. {c1} So does ten
point three meters of water. {c9}

## takeaway {shot: back down to the glass, the mannequin sipping · energy: 0.45} (62–67.5 s)
vo: Straws don't pull. {c10} The atmosphere *pushes*, and its push runs out near ten meters. {c11}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (67.5–74 s)
vo: Next: frozen water, floating on liquid water. {c14} Why doesn't it *sink*? {-}
end card: "Next drop: why ice *floats*" · "Follow Rest Frame" · footnote: "Torricelli, 1644: the same air held a column of mercury about 76 cm high."

## Notes
- The heights are computed from the pressures (h = Δp / ρg); the rise's speed is an illustration (badged).
- "Perfect pump" is an idealisation, said aloud. The column stops at 10.1 m for water at 20 °C (vapor
  pressure 2.3 kPa); the measure's 10.3 m is the column that weighs as much as the whole air above it (a card
  on screen says both).
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: "Torricelli", "centimeters", "room-temperature", "stories", "cheeks and tongue".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
