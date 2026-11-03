# Body Backstage season 1 reboot: look test ("live scan")

The owner's notes (3 Nov) were: cooler, high-tech science visuals; facts that are less textbook; and a
multi-million-dollar production finish. These are three final-tier stills (1080×1920, the cinema finish:
motion blur, depth of field, bloom, ACES), each with its caption and HUD, plus a before/after against the
current frames. No episode is rebuilt until the owner approves the look.

| Still | From | What it shows |
|---|---|---|
| `review/still-lungs.jpg` | No. 005 | a cluster of air pockets wrapped in capillaries, caught mid-scan: above the phosphor line, wet living tissue under a film light; below it, the scan view (glass-dark pockets with depth slices, blood running hot) |
| `review/still-capillary.jpg` | No. 001 | the vessel sliced open by the scan (its cut edges glow); red cells folded into cups, single file, the hero cell locked in a tracking reticle |
| `review/still-synapse.jpg` | No. 004 | one nerve ending sliced open over the next cell: the signal arriving down the fibre, packets crowding the floor, the message crossing the 20 nm gap |
| `review/before-after.jpg` | | each current poster frame beside its live-scan still |

## The look
- **Ground**: abyss teal-black (`#040E10` → `#0B2A2B`), the old surgical green taken darker and filmic.
- **Tissue**: photoreal and wet (clearcoat, sheen, a fresnel "subsurface" glow at thin edges, cellular micro-normals),
  under a key, rim and fill with an HDR studio for reflections, plus volumetric shafts, drifting motes (bokeh) and haze.
- **The instrument**: the channel's chartreuse `#D6F25F` kept as the scan line, the slice edges, the reticles and the
  readouts. **Scan view** (`set/scan.js` `scanPatch`) switches any material on the beat: glass-dark cores, glowing
  edges, iso-depth contour slices, and blood running hot.
- **Type and HUD**: Atkinson Hyperlegible Next (titles 800, captions 700) and Atkinson Hyperlegible Mono (readouts,
  tags, units; added to `fonts/`). Fraunces retires with the old look. One type scale; tracked callouts that follow
  3D points; a scale bar; plated readouts so text never sits on raw tissue.
- **Words**: plain first ("air pocket", "a quarter of a tennis court", "never touch"), with comparisons instead of counts.

## Production value (h), scored honestly
| Still | (h) | Weakest point |
|---|---|---|
| lungs | 4 | the capillaries still read a little like wires; in the episode they get a tapered, branching mesh |
| capillary | 4 | the blurred tissue behind reads a little like balloons; in the episode it becomes a textured bed |
| synapse | 3 | the packets are plain spheres and the lower membrane is plain. In the episode: lumpy packets of mixed size, a receptor field, and a lower, grazing camera across the gap |

## Render cost
Final tier, about 12 s a frame on one box (K about 2.3), so a 75 s episode (2,250 frames) takes about 7.5–9 hours.
That is about 50 render-hours for six episodes, or about 17 hours spread over three render workers.

Files: `scene.mjs` (one scene, three shots), `film.json`, `theme.json` (look-test theme; the channel's
`../theme.json` is unchanged until approval), `../set/scan.js` (the new look's set module).
Render: `node kits/cinema/film/render.mjs --film films/channels/body/looktest --tier final --times 1,3,5`.
