# Reality Rulebook, Season 2 slate (ep07-ep12)

Every source below is a CANDIDATE: nothing is OK until a person opens the page. All claims start OPEN in `claims.json`.
No overlap with Season 1 (projectile, pendulum, bounce energy, free fall in vacuum, spin, suction). Same look, same Bench set.

| # | Title | "Wait, what?" hook | Payoff |
|---|---|---|---|
| 07 | The slinky that waits | Drop a hanging slinky: the bottom hangs in mid-air while the top falls. | Until the news arrives (a wave travelling down the coils), the bottom has no reason to move; it only starts when the top reaches it. |
| 08 | Spaghetti never breaks in two | Bend a dry spaghetti stick until it snaps: it never gives two pieces. | Each break sends a bending wave that snaps it again; twisting it by more than about 250 degrees first usually makes it break in two. |
| 09 | The nut that rises | Shake a jar of mixed nuts: the biggest one climbs to the top. | Shaking opens gaps small pieces fall into; the big one can't, so it is pushed up (the Brazil nut effect). |
| 10 | The ring a coffee drop leaves | A drying drop leaves a dark ring, not a blob. | The edge dries first, so flow carries the stuff outward and parks it there (the coffee-ring effect). |
| 11 | Listen to the cup fill | Close your eyes and you can hear a mug fill. | Less air above the water means a higher pitch: a shorter air column resonates higher. |
| 12 | The slow raindrop | Rain from a cloud a mile up lands at about the speed of a cyclist. | Air drag grows with speed until it balances the weight: a terminal speed (about 9 m/s for the biggest drops). |

## Key claims and candidate sources

**07 slinky.** (1) The bottom stays at rest while the top falls until the collapse reaches it; (2) the centre of mass falls as a free body; (3) the news travels as a wave in the coils; (4) the top falls at a roughly steady speed while it collapses.
Sources: Calkin, Am. J. Phys. 61, 261 (1993) "Motion of a falling spring"; Cross and Wheatland, Am. J. Phys. 80, 1051 (2012) "Modeling a falling slinky"; Physics Today / Veritasium slinky coverage as a lay cross-check.

**08 spaghetti.** (1) A bent dry spaghetti rod breaks into three or more pieces, rarely two (Feynman anecdote); (2) the first break launches a flexural wave that causes further breaks; (3) twisting a rod past about 250° before bending gives two pieces; (4) the pieces' count depends on how fast the bend is released.
Sources: Audoly and Neukirch, Phys. Rev. Lett. 95, 095505 (2005); Heisser et al., PNAS 115, 8665 (2018) (MIT); MIT News write-up of the 2018 paper.

**09 nuts.** (1) Shaken mixed grains separate with the largest on top; (2) the effect is called the Brazil nut effect; (3) a big grain is lifted when small ones fall under it; (4) it can reverse (large grains sink) under other conditions.
Sources: Rosato et al., Phys. Rev. Lett. 58, 1038 (1987); Breu et al., Phys. Rev. Lett. 90, 014302 (2003); Physics World or Phys. Today lay explainer.

**10 coffee ring.** (1) A drop pinned at its edge dries faster at the rim; (2) fluid flows outward to replace it, carrying particles; (3) the ring forms when the contact line is pinned; (4) round particles can be made to dry flat, so shape matters.
Sources: Deegan et al., Nature 389, 827 (1997); Yunker et al., Nature 476, 308 (2011) "Suppression of the coffee-ring effect by shape-dependent capillary interactions".

**11 cup filling.** (1) The air column above the water acts like a tube closed at one end; (2) its lowest resonance is about f = v/4L, with v ≈ 343 m/s in air at 20 °C; (3) as L shrinks, f rises; (4) a tube 10 cm long rings near 860 Hz (computed from the formula, shown as an estimate).
Sources: OpenStax University Physics Vol. 1, ch. 17 "Sources of Musical Sound"; Physics Education paper on hearing pouring water if one is found (candidate: Velasco et al., 2012; to locate).

**12 raindrop.** (1) Drops fall at a steady terminal speed because drag balances weight; (2) larger drops fall faster, up to about 9 m/s; (3) very big drops break up; (4) a cyclist at about 5 to 9 m/s is the human comparison.
Sources: Gunn and Kinzer, J. Meteorology 6, 243 (1949); NOAA / National Weather Service or a university atmospheric science text on raindrop terminal velocity (to locate); OpenStax University Physics 6.4 "Drag Force and Terminal Speed".

## Why each fits the channel
Each is a thing a viewer has handled today (a slinky, pasta, a snack jar, a coffee mug, rain), starts with an image that looks wrong, and is paid off by one visible rule on the strobe ladder. All fit the 9:16 Bench set with its existing props (the strobe ladder, vectors, oscillators, wave field, particles); new props needed: slinky coil (extends `swing.js` spring), a bending rod, a jar of grains (extends B8), a drop with a stain, a mug with a water column (extends `straw.js` glass), a raindrop with a drag arrow.

## Order
07 slinky (reuses oscillator and wave blocks), 08 spaghetti, 09 nuts, 10 coffee ring, 11 cup, 12 raindrop. Ep12 touches air drag, which ep04 only mentions; its hook is the speed, not the vacuum.
