# Los Güeros — "La Noche" · shot list

20.00 s · 24 fps · 480 frames · two compositions (16:9 and 9:16) on one timeline.
The machine-readable version of this table is `film/src/timeline.json`. Picture and
sound are both built from that file, so if they disagree with this page, the JSON wins.

Camera notation: `cx, cy` is the focus point in normalized source coordinates and `z` is
zoom over the format's cover fit. Format-specific values are written as `16:9 | 9:16`.

| # | Time (frames) | Shot | Entry state | Action and copy | Exit state | Purpose | Sound |
|---|---------------|------|-------------|-----------------|-----------|---------|-------|
| S1 | 0.00–3.00 (0–71) | **Hook: fire** | Frame 0 is already lit: flames under the trompo, embers rising. No fade from black. Camera on flames `.45,.86` at `z 1.55 \| 1.25`. | Slow push-in (+0.15 z). 0.25 "The night" rises · 0.85 "tastes better." rises. 2.55 type lifts out. | Type gone, camera still on flames, pull begins at 2.70. | Stop the scroll in under 1 s: fire plus the brand promise. | Fire bed at full from frame 0 · marimba D4 at 0.33 · A4 at 0.93 |
| T1 | 2.70–3.70 | *Pull* | — | Camera pulls back from flames to the whole trompo (`z → 1.0`, `cy .86 → .46`), `power3.inOut`. | Lands wide. | Reveal the hero object. Continuous, so there is no cut. | Low whoosh 2.70 |
| S2 | 3.00–6.50 (72–155) | **Reveal: the trompo** | Mid-pull. Trompo filling frame. | Drift `z 1.0 → 1.06`. 3.75 "La noche sabe mejor." fades up · 4.35 eyebrow "Taqueria Los Güeros · Anaheim, California". 5.95 type exits. | Clean plate, curtain starts at 6.15. | Name the place, with Spanish as the identity echo. | Marimba F#4 at 3.83 · soft D5 at 4.43 |
| T2 | 6.15–6.85 | *Ember curtain* | — | Espresso ember panel sweeps up over the frame (6.15–6.50, `power4.in`). The camera cuts under cover at 6.50. Panel exits top (6.50–6.85, `power4.out`). | New framing revealed. | Site-intro signature. Hides the cut and the loop seam. | Whoosh 6.15 |
| S3 | 6.50–9.00 (156–215) | **Craft: tortillas** | Revealed under the curtain: taquero's hands and tortillas `.84,.72` at `z 1.45 \| 1.15`. | Drift left (`cx .84 → .80`). 6.95 "Handmade tortillas," rises word by word. 8.65 type exits. | Whip starts 8.80. | Human hands, made to order. | Marimba B4 at 7.03 |
| T3 | 8.80–9.15 | *Whip* | — | Fast camera move to trompo texture with horizontal motion blur (peak 9.00). Cut at 9.00. | Lands on char and glaze. | Energy spike at the midpoint, and a hidden cut. | Fast whoosh 8.80 |
| S4 | 9.00–11.50 (216–275) | **Dish: Al Pastor** | Trompo texture `.38,.34` at `z 1.5 \| 1.2`. | Push `+0.1 z`. 9.30 "Al Pastor" rises · 9.80 "marinated pork, pineapple" fades up. 11.05 type exits. | Bloom peaks at 11.50. | Name the signature dish the footage actually shows. | Marimba D5 at 9.38 |
| T4 | 11.30–11.70 | *Flame bloom* | — | Amber radial flash (screen, peak 0.8) with a cut under the peak at 11.50. | Wide, dimmed plate. | Change of register, from "dish" to "menu". | Soft swell into the bloom |
| S5 | 11.50–14.75 (276–353) | **La Carta** | Medium-wide `.45,.60` at `z 1.10`, with an espresso scrim over the plate. | Slow pull to `z 1.0`. 11.70 eyebrow "The Menu · La Carta" · 11.90 "From the fire" · 12.40 "to your table." · 13.05 ribbon "Tacos · Burritos · Mulitas · Horchata", staggered 0.18 s. | Curtain rising from 14.40. | Breadth beyond one dish. | Marimba A4 11.98 · D5 12.48 · pentatonic run of 4 notes from 13.09 |
| T5 | 14.40–15.10 | *Ember curtain (close)* | — | Curtain rises from the bottom and **stays**. | Full espresso field with embers. | Clear the stage for the lockup. | Whoosh 14.40 |
| S6 | 14.75–20.00 (354–479) | **Lockup** | Curtain covering, embers drifting. | 15.15 LG monogram blooms · 15.55 "Los Güeros" letters rise · 16.15 eyebrow "Taqueria · Anaheim" · 16.45 "The night tastes better." · 16.85 "628 W La Palma Ave" · 17.25 CTA "Order now — Ordena ahora". Hold to 20.00. | **Last frame is the full lockup.** No fade out, so it works as the poster and the loop end. | Name, place, and action. Ties back to the hook. | Thump 15.15 · marimba D-major triad 15.63 · D5 17.33 · pad resolves to the major third |

## Reading budget

| Card | Words | On screen (full opacity) | Words/s |
|------|-------|--------------------------|---------|
| Hook | 4 | 0.85–2.55 = 1.7 s (+ build) | 2.4 |
| Reveal | 4 + 5 | 3.9–5.95 = 2.05 s | 4.4 (the eyebrow is secondary) |
| Tortillas | 2 | 7.2–8.65 = 1.45 s | 1.4 |
| Al Pastor | 2 + 3 | 9.5–11.05 = 1.55 s | 3.2 |
| La Carta | 3 + 6 + 4 | 12.0–14.4 = 2.4 s | 5.4 (the ribbon is skimmable) |
| Lockup | 2 + 2 + 4 + 4 + 4 | 17.4–20.0 hold = 2.6 s plus build | 3.1 |

Target: ≤ 4 words/s for primary lines. QA re-checks this from rendered frames.

## Source-time map (loop seam handling)

The source loop has a visible jump at its wrap point, so the renderer plays from a
**seamless 84-frame loop** built from source frames 12–95, whose last 12 frames cross-fade
into frames 0–11. Each shot picks a source offset so that the hands close-up (S3) never sits
in the cross-fade zone, and so the pull (S1→S2) runs on continuous source time.
