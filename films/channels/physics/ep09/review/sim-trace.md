# S2E03 simulation trace (for claim c9 and c12)

`node films/channels/physics/ep09/sim.mjs` rewrites sim.json (seeded, deterministic). Height of the big disc's centre above the floor (cm), every 2 s of simulated shaking:

| sim s | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 24 | 28 | 30 | 36 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| centre height (cm) | 3.9 | 5.3 | 8.4 | 13.5 | 12.0 | 15.0 | 19.2 | 16.4 | 17.3 | 17.0 | 19.2 | 16.1 | 22.2 | 18.6 | 20.9 |

The bed is 70 small discs of radius 1.0 cm in a jar 14 cm wide; the big disc has radius 3.8 cm. The big disc fluctuates between about 16 and 22 cm after 12 s and does not sit still on the surface: our claim is only that it rises to the top region.
