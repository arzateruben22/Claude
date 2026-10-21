# Project OC: the sports bar

This is the plan for the second on-foot venue: a playable, Sims-like sports bar in Anaheim. It answers the owner's ask
of 2026-10-21, "IMMEDIATELY AFTER MAKE A PLAYABLE SIMS INTERACTION WORLD FOR LOPEZ AND LEFTYS IN ANAHEIM". Asked
whether that place is real, the owner sent a map of it: "Yes it's real".

It is real: a sports bar at 1759 S Claudina Way, Anaheim, just east of the I-5 between Katella and Cerritos Avenues,
1.8 km in a straight line west-north-west of Lot 57. The owner hasn't said the bar is theirs or that they have its
permission. So, under the same rule as Lot 57 and the owner's own "our own brands only", **we build our own sports bar
at that real site**. It has our name, our look, our interior and our menu. In this document the real business is "the
real bar". Its name appears only in the data tooling, as the lookup key that finds the point, never in `src/` or in
shipped data.

**Status (2026-10-21): planned.** The site data was built by S0-data. It added `src/data/anaheim/sportsbar-slice.json`
and `sportsbar-freeway-link.json`, extending `tools/anaheim/`. This plan uses their numbers. Two scripts there re-run
this plan's own counts against that data: `sportsbar_sets.py` (the near and far street sets) and `sportsbar_zones.py`
(the interior layout). The engine it builds on is
Lot 57's Phase 1, which is being built right now in `src/onfoot/lot57/` on `claude/onfoot`. Its code is uncommitted in
the `tsu-foot` worktree; this plan was checked against it as read on 2026-10-21 at about 01:00 UTC and re-checked at
about 01:45 UTC; its `hud.ts`, `lot.ts` and `main.ts` were read again at about 02:20 UTC, and this revision re-read
`lot.ts`, `main.ts`, `data.ts` and `geom.ts` at about 05:30 UTC. It is still changing. This doc doesn't report on either; check `PROJECT_OC_PROGRESS.md` for what's built and verified. Facts about
the site come from that data. Each number is either measured (the method is at the end) or marked as **ours** (a design
choice), **an estimate** or **an assumption**.

## Ground rules

Lot 57's rules apply unchanged (`PROJECT_OC_ON_FOOT.md`, "Ground rules"). The bar adds these:

- **Our own sports bar.**
  - Our name, sign, facade, interior, menu, uniforms and trade dress.
  - The real bar's name, logo, sign, menu and look are never used. This plan was written from open map data alone; no
    photos of the real bar were used, so its interior can't be copied.
  - The name is one constant, so it can be swapped if the owner ever gets permission.
- **No real sports.**
  - The screens show our own fictional leagues and teams. There are no real leagues, teams, players, broadcasters,
    channel brands, tournaments or trophies.
  - No player names appear at all, only shirt numbers.
  - No betting: no odds, no lines and no wagering of any kind, on the screens or on the bar's own games.
- **Nothing is live.**
  - The crowd, the matches, the scores, the hours, the events and the people are simulated from the time of day and
    the day of the week.
  - Every screen and every chip says so. No broadcast graphic ever says "LIVE".
- **No real money.**
  - Ordering for yourself is free, as at Lot 57.
  - Buying a round costs house tokens. They are earned in the bar, can't be bought and have no cash value.
- **The player doesn't drink and drive.**
  - The player's menu is alcohol-free, because you drove here and you'll drive away.
  - NPCs may hold plain, unlabelled glasses as part of the scene.
  - Nothing rewards drinking, and nobody is ever shown drunk.
- **No borrowed game dress.**
  - "Sims-like" describes the genre in our own docs only. It never appears in the UI, the store copy or marketing.
  - None of that series' marks or signature looks are used: no diamond over heads, no invented gibberish language, no
    copied menu art.
- **Map data from OpenStreetMap through Overture only**, credited (ODbL). Never Google or Apple maps. The owner's
  screenshot only identified the place.
- **Made in code.** Every model, texture, animation and sound is generated in code. The page loads no downloaded
  models, textures, voices, fonts or motion capture.
- **Adults only, no romance.** Everyone is 21 to 75, as the people builder makes them. The relationships are
  friendships; there's no flirting, dating or romance system.

## The venue: Stoppage Time

### The name

Three original names, none of which can be confused with the real one:
- None uses a surname, an ampersand, the letter-pair alliteration of the real name, or any reference to left-handedness.
- None contains "Lopez", "Lefty" or "Southpaw".

| Candidate | Why it fits | Search (one web search each, 2026-10-21) |
| --- | --- | --- |
| **Stoppage Time** (default) | The soccer term for the minutes added at the end of a half. It's also where drivers stop for a while. The glyph writes itself: a lit added-time board reading "+3". Fútbol is big in Anaheim. | No sports bar of that name found in California. |
| The Overpass Sports Club | The I-5's Katella Avenue overpass is in view from the patio, and the game is about freeways. | None found in Anaheim, Orange County or California. Drawback: our docs already use "Overpass" for OpenStreetMap's Overpass API. |
| Fifth Down | A gridiron in-joke (there's no fifth down) and a nod to the 5 next door. | No bar of that name found. A "4th Down" bar existed in Brooklyn. Drawback: it's football-only. |

**Default: Stoppage Time.**
- **The constant.** It lives in one place, `src/onfoot/venues/sportsbar/brand.ts`:
  `export const BAR_NAME = 'Stoppage Time'` and `export const BAR_TAGLINE = 'Sports Bar · Patio · Games'`.
- **Where it's read from.** Every sign, menu, card, toast and line reads it from there.
- **The identifier.** The venue's id in code and data is the neutral `sportsbar`, as S0-data named the files.
- **Searching.** These were quick web searches, not a trademark search. Search all three again before anything ships,
  as for Lot 57.

### Character

It's a neighbourhood sports bar in the end unit of a one-storey commercial strip, a block off Katella. It's the place
people go to watch the match with friends, shoot pool and stay longer than they meant to.
- **Weekday afternoons** are a few regulars and the darts crowd.
- **Friday and Saturday nights** are loud: the featured match on the big screen at 20:00, goals that lift the whole
  room, and the floor in front of the screens turning into a dance spot after its final whistle (simulated; see "The
  featured match").
- **The patio** looks south-west over Anaheim Way to the I-5, so at night you watch the freeway's lights stream past
  while the game plays on the outdoor screens.

### Identity (ours; distinct from Lot 57 and from any real venue)

- **Palette:**

  | Name | Hex | Used for |
  | --- | --- | --- |
  | Night violet | `#1E1B3A` | Base, facade, uniforms |
  | Added-time lime | `#C3F23A` | LED and accents |
  | Kick-off coral | `#FF6B4A` | Booths, highlights |
  | Chalk | `#F1EFE7` | Line paint, lettering |
  | Oak | `#9A6B43` | Wood |

  Lot 57's teal, cream, signal red and patina green aren't used, and there's no gold-and-black.
- **The wordmark.** "STOPPAGE TIME" in wide, extended capitals: chalk letters with a lime halo at night. It's drawn in
  canvas at load and stretched horizontally, where Lot 57 squeezes its letters. The tagline sits below in small lime
  capitals.
- **The glyph.** A rounded rectangle "added-time board" showing **+3** in dot-matrix LED digits. It appears on the
  blade sign, the uniforms, the coasters and the loading screen.
- **The facade.**
  - Our unit (the east end of the strip, see "The site") is painted night violet, with a raised parapet sign band on
    our unit only.
  - The channel-letter wordmark is on the east parapet.
  - A double-sided LED blade sign at the south-east corner shows the "+3" board, cycling +1 to +5 slowly.
  - Black-steel storefront glazing with a double door faces the front drive aisle.
- **Inside:**
  - Polished concrete with a chalk centre-circle inlay in front of the big screen.
  - An oak bar top with a lime LED strip under its lip, and coral vinyl booths.
  - Pool tables in night-violet cloth. Dartboards with the standard generic segment layout, with no maker's marks.
  - A wall of fictional team scarves, our own neon (the "+3" board and a ball), and a chalkboard "On the screens
    tonight" listing fictional fixtures.
  - A house-rules board: "Be kind · Drink water · Get home safe".
- **Staff uniform:** a chalk tee with the lime "+3" on the back and a night-violet apron.

## The site

### What the data says

Measured from S0-data's outputs and the Overture cache; how is at the end.

| Feature | Where (game x, z) | From the data |
| --- | --- | --- |
| The bar's point | (-6621.5, -9342.6) | Overture place `67ef4633-…`: category `sports_bar` (basic `bar`), confidence 0.98, open. It's the only record at the address. Kept as point and id only. |
| Host building (slice `bld` 61) | x -6684.6 to -6607.4, z -9421.9 to -9333.8 | One commercial building of 2,949 m², 4.3 m tall (height from USGS lidar), class retail, subtype commercial, 8 vertices. The point stands inside it, and so do 11 other open place records: it's a multi-tenant strip. The next building is 37 m away. |
| Its shape | see "Site plan" | A hook opening to the east. A north wing (77 m × 18 m) and a west spine (19 m wide) wrap a courtyard. A diagonal arm runs 75 m from the spine's south end, 24.5° south of east, to a tip at x ≈ -6616. The arm is 15.2 to 16.5 m deep. The point is near the tip. |
| Ground height | 44.5 m at the point | The game's own terrain. 44.4 to 45.1 m over the whole building and the derived lot: flat. Outside it, the grid rises about 3 m toward the freeway to the south-west; the 60 m terrain cells smear the embankments. |
| The lot | courtyard plus the drive round the tip | **No parking area is mapped here.** The nearest mapped parking area is 216 m from the building. S0-data derived the lot, about 3,000 m² (3,018 to 3,031 m² across its runs), from the building's courtyard faces, the kerb of S Claudina Way and the mapped aisles. No stalls are mapped. |
| Lot aisles (slice `seg` 415, 416) | 415 loops through the courtyard; 416 wraps the tip | Both are class `service` with no subclass and no one-way tag. 415 enters from S Claudina Way at z ≈ -9395 and z ≈ -9375. 416 runs north-north-east in front of the tip's east face (x ≈ -6613). Its centreline is 4.4 m out from the wall's outer face at the south-east corner, 3.7 m at the door's centre and 3.0 m at the north-east corner. It curves round the tip about 11 m south of it and ends at a driveway (`seg` 418, one-way, entry only) that joins Anaheim Way at (-6656, -9316), so cars leave by Claudina Way. Lot 57's street builder draws an unsubclassed service way 6 m wide. That would put 416's edge 1.4 m from the wall at the south-east corner and on the wall line at the north-east corner, so we redraw it (see "The front"). |
| South Claudina Way | centreline x ≈ -6596 east of the building | Residential. Runs north to z ≈ -9745. At (-6595.5, -9351.7) a leg bends south-west to Anaheim Way at (-6654, -9314); the main leg continues south to Anaheim Way near Katella at (-6596.5, -9259). A footway runs along its east side. No sidewalk is mapped on its west (our) side. |
| Anaheim Way | 43 m south-west of the point | Primary, 40 mph in the data. A frontage road running north-west to south-east beside the I-5. |
| I-5, Santa Ana Freeway | about 100 m south-west | Motorway, 65 mph (55 for heavy goods vehicles). Where it crosses Katella there's a bridge polygon of about 6,350 m², about 105 m south. |
| East Katella Avenue | centreline z ≈ -9225, 117 m south | Primary, 35 mph. Mapped signals at Anaheim Way, (-6565.7, -9226.4) and (-6550.0, -9208.0). |
| The rest of the frame | | E Cerritos Ave 676 m north; S Lewis St 333 m east; a railway 150 m east. |
| Across the street | x -6587 to -6509, z -9379 to -9283 | An electrical substation polygon of 7,272 m², named in the data; the name isn't shown. Transformers, two small buildings and power lines are inside it. Power poles line Claudina Way at x ≈ -6605. |

The 1.2 km slice (`sportsbar-slice.json`) covers game box (-7222, -9943, -6022, -8743). It holds:
- 615 segment pieces, 904 connectors and 426 buildings (342 with heights);
- 67 land-use areas, 205 infrastructure shapes and 536 infrastructure points;
- 25 street names.

It is 133 KB, or 47 KB gzipped. The places file (`sportsbar-slice-places.json`, category and point only) is for analysis
and never loads in a page.

### The building frame

The arm doesn't line up with the world axes, so the bar is laid out in its own frame. It is derived from building 61:
- **The origin O** is the arm's south-east corner, (-6616.5, -9333.8).
- **u** runs west-north-west along the arm, from the tip toward the spine: `A = (-0.9098, -0.4151)`. That's the mean
  direction of the arm's two long walls; they differ by 1.2°.
- **v** runs north-north-east, from the arm's south wall toward its courtyard wall: `B = (0.4151, -0.9098)`.
- `game(u, v) = O + u·A + v·B`, so `u = (g - O)·A` and `v = (g - O)·B`.

These give:

| Point | Game (x, z) | Frame (u, v) |
| --- | --- | --- |
| South-east corner of the arm | (-6616.5, -9333.8) | (0, 0) |
| North-east corner (the front wall is slanted) | (-6615.5, -9351.5) | (6.4, 16.5) |
| The bar's point | (-6621.5, -9342.6) | (8.2, 5.9) |
| Inner corner where the arm meets the courtyard | (-6665.2, -9373.5) | (60.8, 15.9) |
| South-west end of the arm | (-6684.6, -9365.8) | (75.2, 0.9) |

The S1 builder computes O, A and B from building 61's ring at load, rather than copying these numbers, and checks them
against this table.

### Our unit

**Assumption:** the data doesn't divide the building into units, and the real bar's extent is unknown. We take the
**east 36 m of the arm** (u 0 to 36, measured along the south wall) as Stoppage Time:
- **Size.** 529 m² gross (measured from the frame, and wholly inside building 61), or 505 m² inside the walls.
- **Walls (ours).** The footprint ring is the outer face of the walls. Exterior walls are 0.25 m thick, measured inward
  from it. A 0.2 m party wall at u 35.8 to 36.0 separates our unit from the next one.
- **The front.** It faces east, onto aisle 416 and Claudina Way, and is slanted: it runs from (0, 0) to (6.4, 16.5).
- **The rest of building 61** stays as the data has it: generic unnamed units with blank sign bands, roll-up doors on
  the north wing and a few lit windows at night. The real bar's point falls inside our unit; that's the point of the
  exercise.

## Site plan (exterior)

North is up. Schematic, not to scale. The coordinates in the table are exact.

```
                                                          N ^
   x -6691                                                  x -6596 (S Claudina Way)
     +--------------------------------------------------------+ z -9422   north wing: generic units
     |  unit    unit    unit    unit    unit    unit    unit  |
     +------+-------------------------------------------------+ z -9404
     | west |   COURTYARD LOT (aisle 415)                <======== driveway, z -9395
     | spine|     our stalls along the aisles                 |
     | units|                                     your stall <======== driveway, z -9375 (routes end here)
     |      +.                                                |
     +-.      '.    the arm: generic units    .-- STOPPAGE TIME --.  entrance faces east;
        '.      '----------------------------'       36 m         |> front walk, then aisle 416 (ours: 4.5 m, one-way)
          '.                                      [ PATIO ]       |
            '._____ aisle 416 round the south side ______________/    S Claudina Way bends SW
                     \ driveway from Anaheim Way (-6656, -9316)           to Anaheim Way
   ========= Anaheim Way (primary, 40 mph), 43 m south-west of the bar =================
   =========== I-5 Santa Ana Freeway, about 100 m south-west ===========
                                                   ===== East Katella Ave, 117 m south =====
```

| Part | Where | Contents (ours unless noted) |
| --- | --- | --- |
| Stoppage Time | building frame u 0–36 | See "Inside". Floor slab 0.15 m up, level with the raised front walk; the kerb ramp is on the walk (see "The front"). Ceiling 3.6 m inside the 4.3 m building (the lidar height). The parapet sign band on our unit rises to 5.4 m (ours). |
| Front walk | along the east face | A raised walk 3.3 m deep with a 1.5 m clear path along the glazing, then the door ramp, a bike rack and two planters. See "The front" below. |
| Aisle 416 | round the tip and along the front | Mapped centreline, but drawn by us: 4.5 m wide, one-way, and moved out to 6.0 m from the front wall in front of the unit. See "The front". |
| Patio | u 2–20, v -5.5–0 (outside the south wall) | 99 m², on the strip between the arm and aisle 416. **Assumption:** the strip is open paving; nothing is mapped on it, and S0-data's derived lot covers its east quarter (25 m²). Its outer edge is 4.17 m from aisle 416's centreline at the closest point (u 20), so 1.9 m from our 4.5 m aisle's edge. Details are under "Inside". It's entered only from inside. |
| Courtyard lot | the derived lot polygon | Stalls are ours, 2.75 m × 5.5 m, in four rows on aisle 415's two east-west legs, all facing north or south (the module map's `lot.ts` row says why). **Estimate:** 55 to 62 stalls. "Your" stall is the courtyard stall nearest the routes' end at (-6613.2, -9374.9), about 30 m from the door. 6 m pole lights (ours; no lamps are mapped here). |
| Perimeter | aisle 416 round the arm and spine | A drive aisle (mapped) with landscape strips (ours) between it and Anaheim Way. |
| The rest of the frame | the slice | Streets, the I-5 and its Katella bridge, the substation behind a chain-link fence with its transformers and power poles, the railway and buildings, from the data. Building colours by class, as at Lot 57. |

### The front (ours)

All of this is our layout. Positions are measured out from the front wall's outer face (d) and along it from the
south-east corner (s, 0 to 17.7 m). In the building frame, `(u, v) = d·(-0.932, 0.362) + s·(0.362, 0.932)`. The door's
centre is at s 8.95, and the door spans s 8.05 to 9.85.

| d (m) | What | Details |
| --- | --- | --- |
| 0 to 3.3 | The front walk, s -0.5 to 18.2 | Concrete, raised 0.15 m to the slab's level, so the door has a flush threshold. |
| 0 to 1.5 | Its clear path | Nothing stands in it. |
| 1.5 to 3.3 | Its furniture strip | The door ramp, two planters and the bike rack (below). |
| 3.3 | The kerb face | |
| 3.3 to 3.75 | A gutter | Nothing stands in it. |
| 3.75 to 8.25 | Aisle 416, as we draw it | 4.5 m wide and one-way, in the direction of its mapped points: from the Anaheim Way entry, round the tip, to the courtyard junction. That matches the entry-only driveway. The ride-share pick-up box is painted on it opposite the door (s 6 to 12). |

**What stands in the furniture strip:**
- **The door ramp:** a kerb ramp 1.8 m wide (s 8.05 to 9.85). It rises 0.15 m over the strip's 1.8 m (1:12), with 0.5 m
  flares (s 7.55 to 10.35), and lands on the clear path at the door. Lot 57's walk grid has two heights, 0 and 0.15 m
  (its `raised` layer), so the ramp is a sloped mesh that the body walks as one step at its midline, as at Lot 57's
  kerbs.
- **Two planters with agave,** 1.2 m × 0.6 m, at d 2.1 to 2.7: one at s 2.5 to 3.7, one at s 16.4 to 17.6.
- **A four-hoop bike rack** along the kerb. Parked bikes take d 1.9 to 2.9, s 12.5 to 15.5.
- **The blade sign** hangs from the wall at the south-east corner, 2.8 to 4.0 m up, so it's over the walk, not in it.

**Aisle 416's line (ours).**
- **Kept as mapped:** the south side of the arm and the curve round the tip, as far as the mapped point
  (-6616.2, -9323.6).
- **Then eased out** through (-6613.4, -9324.8) and (-6611.6, -9327.3).
- **In front of the unit:** parallel to the front wall, 6.0 m out, from 3 m south of the south-east corner to 6 m past
  the north-east corner, that is from game (-6610.7, -9330.5) to (-6609.2, -9357.2).
- **Then straight** to the courtyard junction at (-6613.2, -9374.9), where the routes end.

The street build drops the mapped 416 (`site.dropSegs`) and the bar's lot builder draws this line instead. Measured
against the slice:
- The aisle's edge is 3.75 m from building 61 and 1.9 m from the patio's outer edge.
- It's 2.7 m from the mapped power pole at (-6605.0, -9361.3).
- It's 5.9 m from South Claudina Way's kerb and 3.7 m from the kerb of its south-west leg. Both use Claudina's 11 m
  class width.
- In front of the tip it runs up to 2.8 m east of S0-data's derived lot, onto ground with nothing mapped on it. The
  derived lot is our starting point, not mapped fact.
- The walk is 0.45 m from it, the ramp 0.45 m, the bike rack 0.85 m and the planters 1.05 m.

Fictional hours: Monday to Thursday 11:00 to 24:00, Friday 11:00 to 02:00, Saturday 09:00 to 02:00, Sunday 09:00 to
24:00. Saturday and Sunday open at 09:00 for weekend brunch; the first fixtures are Sunday's 10:00 gridiron and
Saturday's 12:00 Marigold (see "The games on the screens").

When it's closed:
- the bar is dark except the exit signs;
- the door is locked, and the blade sign reads "Closed · opens 11:00";
- you can still walk the lot and the front walk.

## Inside

Building frame, metres. The tip (front, east) is on the right and the courtyard wall (north) is on top. The real arm
runs 24.5° off east-west. Schematic; the table is exact.

```
  u = 36 party wall          u = 27                       u = 14             u = 6.6   front wall, glazed, slanted
  +-----------+--------+-------------------------------------+---------------+
  |  KITCHEN  | REST-  |  back bar · taps · 4 screens above  |  DARTS        \
  | (doors    | ROOMS  |================ BAR, 13 m ===========|  3 boards      \
  |  only)    | 2 doors| P  g g g  o  o  o  o  o  o  o  o  o |  oche  ::::::   \
  |      PASS +--d--d--+   (9 stools o, 4 gaps g, pick-up P) |                  \
  |      PASS    w                                                     host h     > ENTRY (east face,
  +--d--------+         HT       HT       HT            POOL 2   POOL 1          /   double door, ramp)
  T standing  |                                          [##]     [##]          /
  T and dance |         HT       HT       HT                           rail r  /
  T spot      |                                                              /
  T BIG SCREEN|  [B]  [B]  [B]  [B]  [B]                   %%% SHUFFLEBOARD %%/
  +--J--------+---------------------------------------[door]------------------+  south wall, windows
                                                 PATIO u 2-20, 5.5 m deep: 6 tables, 2 heaters,
                                                 a rail on the fence facing Anaheim Way and the I-5,
                                                 2 screens on the wall
```

| Zone | u | v | Contents |
| --- | --- | --- | --- |
| Walls | | | Exterior walls 0.25 m, measured inward from the footprint ring. The south wall's inner face runs from v 0.27 at u 2 to v 0.65 at u 35.8, because the arm's south wall isn't exactly on v = 0. The north (courtyard) wall's inner face runs from v 16.2 at u 14 to v 15.9 at u 35.8. Party wall u 35.8 to 36.0. Every zone and slot below lies inside the inner faces, and none overlaps another (measured: see "How these numbers were measured"). |
| Entry | front wall, centre (3.6, 8.2) | | A 1.8 m double door with a flush threshold: the front walk outside is raised to the slab's 0.15 m, and its kerb ramp is outside (see "The front"). A host stand, 0.6 m × 0.5 m, at (6.8, 8.2), the host's spot beside it at (6.8, 7.6). |
| Window rails | along the front wall | 2.5–6.3 and 10.0–15.0 | Drink rails with 8 stools, 4 each side of the door, every 1.05 m (south of the door at v 2.9, 3.95, 5.0 and 6.05; north of it at v 10.6, 11.65, 12.7 and 13.75), each stool's centre 0.6 m in from the front wall's inner face (the first is at (2.04, 2.9)), looking out at the drive and Claudina Way. The south rail starts at v 2.5, clear of the shuffleboard's standing slot. |
| Darts | 7.6–12.6 | 11.5–15.8 | Three boards at u 8.4, 10.1 and 11.8, bullseye 1.73 m up, on an oak dart surround (backboards and cabinets) fixed to the north wall, its face at v 15.75 (the wall's inner face is at about v 16.2 here). Oche line at v 13.38 (2.37 m). A code-drawn chalk scoreboard beside each board. |
| Pool | 8.9–17.4 | 4.3–9.5 | Two 7 ft tables, long axis along v, centres (11.0, 6.9) and (15.3, 6.9). 1.45 m cue clearance all round. A pendant lamp over each. |
| Shuffleboard | 3.2–9.9 | 1.15–1.75 | One 22 ft (6.7 m) table along the south wall, scored at the west end. Players stand at the east end (u 2.2–3.2; the thrower's spot at (2.7, 1.45) is 1.59 m from the south rail's first stool) and along its north side (v 1.75–2.5, spots at (5.0, 2.1) and (7.0, 2.1), 1.8 m clear of the pool cue zone at v 4.3). |
| Bar | 14.0–27.0 | 13.3–15.8 | 13 m oak counter. Customer edge at v 13.3, counter to 14.05, bartenders' lane to 15.2, back bar to 15.8. 9 stools at v 12.85, every 1.05 m from u 14.6 to 23.0. 4 standing gaps at v 12.95, where standing guests order: one at the counter's east end (u 13.75) and three west of the stools (u 23.8, 24.45 and 25.1). Brass foot rail. Server pick-up at the west end (u 25.5–26.8), its spot at (26.15, 12.95). Staff flap at u 27.0–27.6. Four 65-inch screens above the back bar at u 15.5, 18.7, 21.9 and 25.1. A tap wall with plain coloured handles and no marks. |
| Restrooms | 27.6–31.0 | 11.6–15.8 | A block with two doors on its south face at u 28.4 and 30.2, each with our own "Restroom" pictogram. **Doors only:** not enterable. A water station between them, against the block's south face (u 29.0–29.6, v 11.2–11.6), its standing spot at (29.3, 10.85). |
| Kitchen | 31.0–35.8 | 9.0–15.8 | **Doors only.** A 2 m pass window on its east face (v 9.3–11.3): stainless shelf, heat lamps, ticket rail and bell, with the lit kitchen visible behind. Two server spots in front of it, at (30.6, 10.35) and (30.6, 11.0), north of the high-tops. A staff swing door on its south face at u 33–34. |
| TV wall | on the party wall's inner face, u 35.6–35.8 | 0.8–9.0 | The big screen, 3.2 m × 1.8 m, centred at v 4.75, 1.3 to 3.1 m up. Four 50-inch screens, two stacked each side, so the screens span about v 1.9 to 7.6. A lime LED score ticker below the big screen. |
| Standing floor and dance spot | 31.5–35.5 | 0.8–8.6 | Clear floor, 31 m², with the centre-circle inlay. 20 standing spots at about 0.9 m spacing for the big match. During `gameNight` 12 of them are the dance spot. The jukebox stands against the south wall at (32.0, 0.95). |
| Booths | 20.5–31.3 | 0.75–2.35 | 5 coral booths of 4 seats along the south windows, 2.15 m apart. Their backs stand 0.15 m (at u 31.3) to 0.27 m (at u 20.5) off the south wall's inner face. Table across the booth, a bench each side: half the seats face the TV wall. Two seats to a bench, at v 1.15 and 1.95, each 0.35 m in from its booth's end; neighbouring booths' benches stand back to back on one backrest. |
| High-tops | 19.5–31.0 | 3.0–10.0 | 6 round oak high-tops with 4 stools each, centred at (21.0, 4.6), (24.6, 4.6), (28.2, 4.6), (21.0, 8.6), (24.6, 8.6) and (28.2, 8.6). The stools stand 0.7 m from each table's centre along u and v, so they reach v 9.75; the zone stops at v 10.0, south of the water station's and the pass's spots. |
| Patio door | south wall, u 18.0–19.8 | | Glass double door. |
| Patio | 2–20 | -5.5–0 | A steel pergola with louvres and warm linear lights. 6 four-top tables, 2 patio heaters, a drink rail on the south fence with 6 stools facing the freeway, planters with agave and grasses, and a 1.1 m glass and steel fence. Two outdoor screens on the building wall at u 6 and u 14. |

**Seats:**
- Bar 9, booths 20, high-tops 24 and window rails 8: 61 inside.
- The patio: 24 at tables and 6 at the rail: 30.

**Standing spots:** 20 on the standing floor, 4 gaps at the bar, 8 pool watchers, 6 darts watchers and 3 at the
shuffleboard: 41.

**Fictional capacity: 130.** The 91 seats and 41 standing spots make 132 places, so a full room never runs out of
places. Capacity is never shown as a number.

**Screens:** 12 in all: the big screen, 4 beside it, 4 over the bar, 2 on the patio and 1 above the darts. They show
three channels (see "The games on the screens").

## One engine with Lot 57

The bar is built on the on-foot machinery that Lot 57's Phase 1 is building, not on a fork of it. There is one engine,
with two venues described as data, and the bar's new life-sim layer is written into the engine so that Lot 57 can
adopt it later. Until the move (E0, below):
- the bar imports Lot 57's modules unchanged;
- it adds its own pieces beside them;
- it copies three small things, each marked for E0: the quality presets, the page loop and the single-file plugin.

### What exists now (read-only, `claude/onfoot`, uncommitted)

As read in the `tsu-foot` worktree on 2026-10-21 at about 01:00 UTC, and re-read at about 01:45 UTC after `lot.ts`,
`main.ts`, `player.ts`, `mats.ts`, `data.ts` and `venue.ts` had changed again. `hud.ts`, `lot.ts` and `main.ts` were read
once more at about 02:20 UTC, and `lot.ts`, `main.ts`, `data.ts` and `geom.ts` at about 05:30 UTC for this revision.
It's still changing.

| File | What it holds | Tied to Lot 57? |
| --- | --- | --- |
| `lot57/geom.ts` | `Batch`, `Kit`, `Emitter`, baked vertex light (`Batch.bake`, run by `Kit.finish`); `offsetLine`, `polyLen`, `along`, `pointInPoly`, `rand`, `canvasTex` | No |
| `lot57/collide.ts` | Colliders (`seg`, `box`, `boxMM`, `circ`, `poly`); `ColliderSet` with its 4 m hash and `ray` | No |
| `lot57/walkgrid.ts` | 0.5 m cells (`CELL`, `RADIUS`), the free and raised layers, A* and string pulling | No |
| `lot57/driver.ts` | `readDriver`, `driverPerson`, `eyeHeight`: your driver, from the game's own settings | No |
| `lot57/player.ts` | `Player`: the 0.3 m body, walking and jogging, push-out, tap-to-go paths (`goTo`), `sit(seat)` and `stand()`, the look, and the first- and third-person camera as `Player.camera(cam)`, which returns `{ dist, hide }` (hide the avatar under 0.7 m). Constructor `(set: ColliderSet, grid: WalkGrid, roadAt)`. `View = 'first' \| 'third'`. Also `WALK`, `JOG`, `ACCEL`, `DECEL`, `STEP` and `Stick`. | Yes: `get indoors()` calls Lot 57's `inShed(x, z)` |
| `lot57/input.ts` | `Input`: the floating stick, the look drag, taps, keys and the gamepad. `Action = 'act' \| 'act2' \| 'view' \| 'car' \| 'carSkip' \| 'pause' \| 'stand'`. | The key map and the action union are fixed |
| `lot57/hud.ts` | `Hud`: the action buttons, toasts, the hint, the pause sheet (quality, clock and motion controls) and the crowd chip; `loading`. `onView: (v?: View) => void`: the `viewBtn` click calls `onView()` with no argument (cycle), and the `segView` listener calls `onView(v)` with the clicked button's `data-v` (the buttons hold plain text, so the target is the button). | It binds fixed element ids in Lot 57's `index.html`; `setView(View)` |
| `lot57/lot.ts` | `Stall` (`x, z, face, row, mine, ada`); `ParkedCars`: constructor `(stalls, quality: 'phone' \| 'high', nearCount)`, `fill(share, seed)`, `update(x, z, force?)`, and public `near`, `count` and `colliders`; `yourCar(stall, car, paint, quality)`, which returns `{ group, collider }`; `buildLot`, `LotInfo`, `MEDIAN`, `WALK_GAP` | It reads Lot 57's `PLAN` at load (from `coords.ts`, which holds no data). `buildLot` builds Lot 57's rows. `fill()` favours stalls within 90 m of Lot 57's gate, at local (-5, 20), and pulls each car toward its wheel stop along world z by `(PLAN.lot.stallD - car length) / 2 - 0.2`, which assumes stalls 5.5 m deep facing 0 or π. `yourCar()` puts the car 0.15 m off the stall's centre along world z. The parked cars are instanced: per traffic kind (5), one `InstancedMesh` for each of 4 parts (paint, glass, trim, lamps) for the nearest `near` cars, and one for 152-triangle stand-ins (a private `proxyGeometry`: two boxes and four 8-sided wheels) for the rest. three.js culls each instanced mesh as a whole, by one bounding sphere round all its instances. |
| `lot57/mats.ts` | `Quality`, the `GLOW` channels, `glowify`, `makeMats(board)`, `setNight` | `makeMats` also builds Lot 57's sign atlas, reader board and surfaces |
| `lot57/tex.ts` | Code-painted surfaces (asphalt, concrete, pavers, turf, dirt, wood, brick, glow, blob, picket, chain); Lot 57's `PAL`, `tiltupTex`, `rollDoorTex`, `ATLAS`, `labelsAtlas`, `readerTex` | In part |
| `lot57/clock.ts` | `DAYS`, `ClockState`, `CrowdLevel`, `anaheimDate`, `pacificOffset`, `liveClock`, `fmtClock`, `parseDay`; `CAPACITY` (220), `isOpen`, `closesAt`, `opensAt`, `crowdShare`, `crowdLevel`; a private ±10% `noise()` that hashes the calendar weekday and whole hour | The hours, curve and capacity are Lot 57's, hard-coded |
| `lot57/coords.ts` | `ORIGIN`, `ANCHOR`, `GROUND_M`, `toLocal`, `toGame`, `SITE`, `PLAN`, `inShed`, `inVenue`, `EDGE` | All of it |
| `lot57/data.ts` | `buildStreets`, `decode`, `DATA_ATTRIBUTION`, the class road widths (`ROAD_W`) | It statically imports Lot 57's 672 KB `slice.json` |
| `lot57/venue.ts` | The `Seat`, `Spot`, `Venue` and `Tree` types; `buildVenue`. `Seat` is `{ id, x, z, y, face, kind, at, ax, az }`, with `kind` one of `'bench'`, `'stool'`, `'hightop'`, `'picnic'` and `'lawn'`; `Spot.kind` is `'bar'`, `'truck'` or `'game'`. | `buildVenue` is Lot 57's |
| `main.ts` | The page: the `PRESET` table (Low, High, Ultra), `applyQuality` (the composer, bloom, GTAO, the real lights, `parked.near` 16 on Low and 36 otherwise), the loop, tap handling, `window.__onfoot`. It imports the game's own `Environment` (sun, sky, shadows, flare), `configureTextures`, road `Props` and the records board from `src/game/`. It builds the parked cars at `'phone'` quality on every preset (`new ParkedCars(lot.stalls, 'phone', quality === 'low' ? 16 : 36)`) and your car at the preset's people quality (`yourCar(lot.mine, carId, undefined, PRESET[quality].people)`). It spawns you by your car's driver door (`lot.door`, 0.2 m out), looking toward the gate, unless the URL's `at`, `yaw`, `pitch` or `view` say otherwise. Its hooks include `look(yawDeg, pitchDeg)`, `camera(p)` (a fixed camera from a position to a target, in game coordinates), `tapScreen`, `actions`, `clock`, `liveClock`, `hint` and `breakdown()` (triangles by mesh, instances counted). | Module-local; importing it would run Lot 57's page |
| `index.html`, `vite.config.ts` | The HUD's elements; the single-file build to `dist/onfoot/` | Lot 57's |

Not written yet:
- P1b: Order, Join, Leave and held items;
- P1c: NPCs, groups, the crowd and staff.

Sit works, and the crowd chip shows the level from `clock.ts`. `src/onfoot/people/` (the people builder) is committed
and shared.

### The module map

Before E0 the bar never edits `lot57/`, `main.ts`, Lot 57's page or `people/`. Instead:
- it imports through `src/onfoot/engine/`, a facade of one-line re-exports;
- it adds new `engine/` files;
- it puts its own files in `src/onfoot/venues/sportsbar/`.

| Lot 57 today | Before E0 (S1 to S4): what the bar does | At E0 |
| --- | --- | --- |
| `geom.ts`, `collide.ts`, `walkgrid.ts`, `driver.ts` | `engine/geom.ts` and so on: `export * from '../lot57/geom'`. Used as they are. The bar uses `raised` for its slab, front walk and patio. | Moved into `engine/`; `lot57/*.ts` become re-export shims. |
| `player.ts` | `engine/player.ts` re-exports `Player`, `STEP`, `WALK`, `JOG`, `Stick` and `View`. `venues/sportsbar/player.ts` declares `class BarPlayer extends Player`, which overrides two members. (1) `get indoors()`: `def.indoor(u, v)` at the player's frame position, so walking-only applies inside the bar. (2) `camera(cam)`: it calls `super.camera(cam)`; indoors in third person it then pulls the camera toward the head, along the same line, until it's at most 3.3 m above the floor (0.3 m under the ceiling), keeping Lot 57's look target, and returns Lot 57's `{ dist, hide }` with `dist` measured after the pull. Its constructor takes Lot 57's three arguments (`set`, `grid`, `roadAt`), passes them to `super`, and then takes the venue def and frame. `View` stays `'first' \| 'third'`; the overhead view isn't a `Player` view (next row). | `Player` takes an `indoor(x, z)` predicate and a ceiling height; `BarPlayer` goes. |
| (the camera, on `Player`) | New `engine/overhead.ts`, written by the bar: an `OverheadCamera` with a target, yaw, pitch (35° to 75°), distance (8 to 35 m), the clamp box and the wall cutaway. The bar's `BarView = View \| 'overhead'` lives in `venues/sportsbar/views.ts`. In overhead the page calls `overhead.update(cam)` instead of `player.camera(cam)`. `player.view` keeps the last person view, so V goes back to it. | `engine/camera.ts` holds all three views, and Lot 57 can use the overhead too. |
| `input.ts` | `engine/input.ts` re-exports `Input` and `Action`. `venues/sportsbar/input.ts` defines `BarAction = Action \| 'overhead' \| 'needs' \| 'guide' \| 'radial' \| 'menu1'` … `'menu6' \| 'rotL' \| 'rotR'`. It also defines a `BarInput`, which holds one Lot 57 `Input` and adds its own listeners: O, Tab, G, 1 to 6, the wheel and the gamepad's LB (button 4). In overhead view it sets `input.enabled = false`, so Lot 57's stick and look stop, and handles pointers itself: one-finger pan, pinch zoom, two-finger twist, tap. E and Q still arrive as Lot 57's `'act'` and `'act2'`; in overhead the bar treats them as rotate ±45°. While the radial menu is open, `Input` is disabled and the right stick picks. | `Input` takes a key map and extra actions; `BarInput` goes. |
| `hud.ts` | Used as it is. `sportsbar.html` carries every element id that Lot 57's `Hud` binds, with the bar's own text: `hud`, `act`, `act2`, `car`, `stick`, `knob`, `toast`, `hint`, `viewBtn`, `menu`, `crowd`, `about`, `pause`, `segView`, `segQ`, `segClock`, `day`, `hour`, `hourOut`, `segMotion`, `clock`, `hours`, `crowdText` and `viewLabel`. It also needs the canvas `view`, which `sheet()` focuses on close; a `[data-close]` button inside `about` and one inside `pause`, which the constructor binds without a null check; the `data-v`, `data-q`, `data-c` and `data-m` buttons inside the four segments; and `loading`, `bar` (with an `i` inside) and `status`, for `loading()` and `doneLoading()`. So the toasts, hint, pause sheet, quality and clock controls, action buttons and crowd chip work unchanged. The bar's `venues/sportsbar/hud.ts` (`BarHud`) adds the needs strip and panel, the mood face, the queue icons, the radial menu, the person card, the TV chip and guide, the Cheer button and the three-way view control. `Hud.setView()` is only ever called with `'first'` or `'third'`; for overhead, `BarHud` sets `viewLabel` and the three buttons' `aria-pressed` itself. No extra listener is needed: Lot 57's `segView` listener already passes the clicked button's `data-v` to `onView(v)`, so the bar's third button, `data-v="overhead"`, arrives as `onView('overhead')` (typed `View` by Lot 57, a string at run time). The bar's `hud.onView` widens its argument to `BarView` and goes to that view; called with no argument, from `viewBtn`, it cycles first, third, overhead. The quality segment's labels read Low, HD and Ultra over Lot 57's `data-q` values `low`, `high` and `ultra` (see "Graphics: Low, HD, Ultra"). | `Hud` takes its ids and views as options. |
| `lot.ts` | `engine/lot.ts` re-exports `Stall`, `ParkedCars` and `yourCar`; the bar never calls `buildLot`. `venues/sportsbar/lot.ts` builds the bar's asphalt, aisle 416 (see "The front"), the stall striping and wheel stops along aisle 415, the pole lights and the front walk. Its stalls are data, `def.parking.stalls`, in Lot 57's `Stall` shape (local metres). They're passed to `new ParkedCars(stalls, 'phone', near)` on every preset, as Lot 57's page builds them (`main.ts`: `new ParkedCars(lot.stalls, 'phone', …)`), so a detailed parked car costs its phone-quality 2.87k triangles at HD and Ultra too (measured; see the budgets). `fill(share, seed)` runs when the clock changes and `update(x, z)` each frame. `near` isn't fixed per preset as on Lot 57's page: the bar's visibility rule sets it by preset and by inside, outside or overhead (0 to 36; see "Inside, outside and overhead"), then calls `update(x, z, true)`. Your car is `yourCar(stall, car, paint, quality)` at the preset's people quality, as Lot 57's page does (`'phone'` on Low, `'high'` on HD and Ultra), plus the bar's own 152-triangle stand-in of it, built the way Lot 57's private `proxyGeometry` builds a parked car's, in your paint. Lot 57's code sets three rules until E0. (1) **Every stall faces 0 or π and is 5.5 m deep,** because `fill()` pulls cars in along world z by Lot 57's stall depth. The courtyard allows it: all the bar's stalls stand perpendicular to aisle 415's two east-west legs (58.8 m at z ≈ -9395 and 42.7 m at z ≈ -9375), none on its 13 m north-south leg or its 18 m diagonal. (2) **The courtyard would fill at about 0.84 of the share** (0.75 to 0.94 by stall), because `fill()` favours stalls within 90 m of Lot 57's gate point, local (-5, 20). For the bar that's game (-6621.5, -9313.8), south of the tip and 55 to 92 m from the stalls. So the bar passes `min(1, share / 0.84)`. (3) **Your car sits 0.15 m off its stall's centre** along the stall's axis, as at Lot 57. **Your door and the spawn.** Lot 57's `buildLot` puts the driver-door point at fixed world offsets from your stall, (x - 1.25, z + 0.6), which suits only its own row facing 0, and the bar never calls `buildLot`. So the bar's `lot.ts` turns the offset with the stall: the door point is your car's centre, (x, z - 0.15) where `yourCar` puts it, plus the offset (-1.25, +0.75) turned by the stall's `face` f as three.js turns the car (an offset (a, b) turns to (a cos f + b sin f, -a sin f + b cos f)). Facing 0 that's Lot 57's (x - 1.25, z + 0.6); facing π it's (x + 1.25, z - 0.9). The spawn is 0.2 m from the door point along the same turned axis, as Lot 57's page places you at (door.x, door.z - 0.2): (x - 1.25, z + 0.4) facing 0, and (x + 1.25, z - 0.7) facing π. The `yourCar()` hook returns your stall and the door point, as on Lot 57's page. | `fill()` takes a "near" point and offsets along each stall's own axis. |
| `mats.ts`, `tex.ts` | The bar doesn't call `makeMats`: it would build Lot 57's sign atlas, reader board and a dozen textures the bar doesn't use. `venues/sportsbar/mats.ts` builds the bar's own materials from `tex.ts`'s generic texture functions and from `mats.ts`'s `glowify` and `GLOW` channels: a is the venue's own lights, b the street and lot lights, c the interior. It has its own `setNight`. | A shared base in `engine/mats.ts`, plus each venue's own set. |
| `clock.ts` | `engine/clock.ts` re-exports the generic part: `DAYS`, `ClockState`, `CrowdLevel`, `anaheimDate`, `pacificOffset`, `liveClock`, `fmtClock` and `parseDay`. New `engine/schedule.ts` has `isOpen`, `closesAt`, `opensAt`, `crowdShare` and `crowdLevel`. Each takes a `Schedule` and an optional `extra(day, hour)` factor (below). The bar never calls Lot 57's own `isOpen` or `crowdShare`. | `lot57/clock.ts`'s functions become wrappers over Lot 57's `Schedule`. A unit test compares the old and new functions at every half hour of a week. |
| `coords.ts` | Not imported: it's Lot 57's `ORIGIN` and `PLAN`. New `engine/frame.ts`: `makeFrame(originGame, axisU, axisV)` returns `toLocal` and `toGame`, `toFrame` and `fromFrame`, `dirToLocal` and `yawFromFrame`. `toLocal` and `toGame` convert between game and local coordinates; local is world-aligned with its origin at the frame's origin, so the game's sun and sky stay right. `toFrame` and `fromFrame` convert between local and (u, v). The bar's origin is O. | Lot 57's coords use a world-aligned frame from `engine/frame.ts`. |
| `data.ts` | Never imported, directly or through a re-export, because it statically imports Lot 57's `slice.json`. New `engine/streets.ts`: `buildStreets(kit, mats, slice, frame, opts)`, written for the bar on `data.ts`'s approach. It handles sidewalks, crosswalks, buildings and land use, and copies the class road widths (`ROAD_W`, marked as a copy). `opts` are the view box, the glazed sectors and radius that pick the near set, `dropSegs`, `dropBld`, `keepHost`, the kerb rules, the far set's detail (`'simple'` at Low and HD, `'full'` at Ultra; switching to or from Ultra rebuilds the far batches) and an `extras(slice, frame)` hook. It batches the near set and the far set separately, so the visibility rule can hide the far set from inside. The near set is every feature, on every layer, with any part in the glazed sectors within 150 m (see "The allocations"); `tools/anaheim/sportsbar_sets.py` counts it from the slice, and S1 checks the built sets against that count. | `data.ts` becomes Lot 57's call to `engine/streets.ts`, with its extras: the Dupont block ring, the construction fence and the light towers. |
| `venue.ts` | `import type { Seat, Spot, Tree }` only. Types are erased, so no code comes with them. `Seat` and `Spot` are the base of the smart objects' slots. The bar's seats use Lot 57's seat kinds (booth benches and patio chairs `'bench'`; bar, window-rail and patio-rail stools `'stool'`; high-top stools `'hightop'`), so `Player.sit()` and `goTo()` take them unchanged. Its standing spots widen `Spot.kind` in the bar's own `Slot` type. | The types move to `engine/venue-types.ts`. |
| `main.ts` | Can't be imported. `venues/sportsbar/quality.ts` holds a copy of `PRESET`, marked `// COPY of lot57 main.ts PRESET: E0 replaces it with engine/quality.ts`, and is re-synced at S4. Its Low row differs from Lot 57's as read, per decision 15 (below the table). The bar's `venues/sportsbar/main.ts` follows `main.ts`'s structure for `applyQuality` and the loop, under the same marker. The game modules Lot 57's page imports from `src/game/` (`Environment`, `configureTextures`, `Props`, the records board) are the game's, so the bar imports them directly. The values as read are below the table. | `engine/quality.ts` (`PRESET` and `applyQuality`) and `engine/page.ts` (the loop and hooks), shared by both pages. |
| `index.html`, `vite.config.ts` | The bar has its own `src/onfoot/sportsbar.html` and `src/onfoot/vite.sportsbar.config.ts`, with a copy of the single-file plugin. It writes `dist/sportsbar/sportsbar.html`, a different folder from Lot 57's `dist/onfoot/`, so neither build empties the other's. Its root is `src/onfoot/`, like Lot 57's, so it sets `build.rollupOptions.input` to `sportsbar.html` (the default input would be Lot 57's `index.html`), and its dev server uses port 5758 (Lot 57's is 5757). It keeps `json: { stringify: true }`, so the slice is embedded as one JSON string. | The plugin moves to `engine/`. |
| `people/` | Not edited before E0: see "Who changes `src/onfoot/people/`". | The bar's clips join `people/anim.ts`. |
| (not written yet) P1b: Order, Join, Leave, held items. P1c: NPCs, groups, the crowd, staff. | If they exist when S2a and S3a start, the bar imports them through the facade like the rest. If not, it writes them in `engine/` (`actions.ts`, `held.ts`, `groups.ts`, `crowd.ts`, `staff.ts`) from `PROJECT_OC_ON_FOOT.md`'s spec, and says so in `PROJECT_OC_HANDOFF.md`. | One copy survives: Lot 57's if it landed first, otherwise the bar's. |
| (new) | `engine/sim/`: needs, moods, personality, smart objects, the action queue, utility AI, interactions, relationships and memory, the TV leagues, tokens, saving, fillers and the clip layer. Written engine-first; the bar turns it on. | Unchanged. |
| (new: what's drawn inside and outside) | `venues/sportsbar/visibility.ts`, the bar's own, written in S1 (cars and streets) and extended in S3a (people). It owns the rule in "Inside, outside and overhead": once a frame, after the camera moves, it works out the state from the camera and the view, and sets `parked.near`, swaps your car and its stand-in, shows or hides the far street set (`engine/streets.ts` builds near and far batches), picks each live person's draw mode (LOD 0, 1 or 2, a card, or hidden) and their `castShadow`, and freezes or frees the Ultra pool spots' shadow maps. Two more duties: (1) **Cars and items don't cast indoors.** Lot 57's `ParkedCars` sets its stand-ins' `castShadow = true`, and `applyQuality` puts every mesh's `castShadow` back from `userData.cast`. So after `applyQuality`, and on every change of state, inside at HD and Ultra it sets `castShadow = false` on the parked stand-ins (`parked-*-far`), your car's stand-in, your car itself at Ultra (where it stays detailed indoors) and the item meshes (see "Held items, table items and game pieces"); outside and overhead it puts them back from `userData.cast`. Without it the inside sun-map rows gain about 6 calls and 9.4k from the stand-ins, and 26 calls and 121.1k from your car at Ultra. (2) **Restyling at Low.** `RetroStyle` styles each scene child once, by its epoch marker, so a mesh that appears later under an already-styled group would render with its standard material under `RetroPass`. With the Retro style attached, it calls `retro.restyle(group)` after every change it makes to a subtree: each person's LOD swap or body rebuild, each card-to-mesh swap, and each swap of your car and its stand-in. `restyle()` is idempotent, so a repeat costs one traverse. It reads `def.budgets`. Nothing in `lot57/` changes. | `engine/visibility.ts`; Lot 57 can use it for the Shed. |
| (the game's Retro style, `src/game/render/style.ts`, on `claude/modes`) | Imported directly, like `Environment`, once `claude/modes` has merged into `claude/sports-bar`: it's a game module, not Lot 57's. At Low the bar's page makes one `RetroStyle(renderer)`, calls `attach(scene, roots)`, and each frame `render(scene, camera, world)` in place of `renderer.render`, with `world` from the game's `Environment` (sun direction, daylight, saturation, its sky to hide, its hemisphere light). Leaving Low calls `detach()`. As read on 2026-10-21 at about 02:20 UTC it was uncommitted in the `tsu-modes` worktree (RS1). | Unchanged: Lot 57's P1d uses the same module. |

The `PRESET` values as read:

| | Low | High (the bar's HD) | Ultra |
| --- | --- | --- | --- |
| Shadow map | none | 2048 | 4096 |
| Post-processing | off | on | on |
| Bloom | off | on | on |
| GTAO | off | off | on |
| MSAA | 0 | 4 | 4 |
| Max pixel ratio | 1 | 2 | 2 |
| Render scale | 0.85 | 1 | 1 |
| Point lights | 0 | 4 | 8 |
| People quality | phone | high | high |
| Textures | 512 | 1024 | 1024 |

**The bar's Low row (decision 15).** Decision 15 (`PROJECT_OC_DECISIONS.md`) makes Low a full-resolution Retro look,
the phone default, not a scaled-down fallback. So the bar's copy changes Lot 57's Low row in three places, and records
the change under the copy's marker:
- render scale 1 and pixel ratio up to 2, never under 1 (the game's `RETRO` preset on `claude/modes`, as read);
- the Retro style module on (`style: 'retro'`): its single full-screen pass replaces the composer, which stays off;
- still no shadow map. The game's `RETRO` preset turns on a 1024 hard sun map; the bar's Low doesn't, because a sun
  pass would redraw your car (26 calls) and the parked cars (up to 25) and break Low's whole-frame budget (see the
  budgets). Its hard shadows are the hard-edged blobs and the baked light. That differs from the `RETRO` preset and from
  decision 15's "hard shadows", so it's recorded as an open question for the owner, not settled here (see "Owner
  questions").

The other two rows are Lot 57's High and Ultra as read; decision 15 calls High "HD". Lot 57's P1d brings the same three
modes, and when it lands the copy is re-synced to it (S4).

**When the move happens (E0).** Lot 57's files belong to the `claude/onfoot` workflow and are being edited now. So:
1. **Until Lot 57's P1d is committed,** the bar never edits `lot57/`, `main.ts`, `index.html` or `people/`, as in the
   table.
2. **After P1d is committed,** E0 does the move as one mechanical commit, on a branch that has merged `claude/onfoot`.
   - It's done by whichever workflow then owns `claude/onfoot`, or by the S4 builder after the merge.
   - It does everything in the table's last column.
3. **E0's check.** Lot 57's own checks pass unchanged after it:
   - its walk test;
   - `stats()` at each preset;
   - its screenshots, compared pixel for pixel at the same clock, seed and quality.

   The bar's S1 to S4 checks pass too.

### Who changes `src/onfoot/people/`

Three pieces of work change the people builder:
- **F5's people specs:** a finger rig that adds bones, the expression system and the hair silhouette. They're designed
  as specs first, then built on `claude/people-2` (the `tsu-people` worktree).
- **Lot 57's P1d** (maximum graphics) on `claude/onfoot`: people lit with rim and fill, and LOD use at High and Ultra.
- **The bar's clips** (S2a, S2b and S3a): drink, eat, pool stance and shot, dart throw, shuffleboard slide, three dances,
  cheer, groan and clap, plus an upper-body overlay so a seated person can cheer.

**Who may change it before E0.** Only F5's builders (on `claude/people-2`) and Lot 57's P1d (on `claude/onfoot`). Where
both touch the same file, F5's change lands first and P1d's is rebased onto it, as the merge order below says. The bar
changes nothing in `people/` before E0 (step 4), and asks for anything it needs through `PROJECT_OC_HANDOFF.md`.

**Merge order:**
1. F5's implementation merges into `claude/always-on`.
2. `claude/onfoot` merges it, and P1d commits on top.
3. `claude/sports-bar` merges `claude/onfoot`.
4. E0 moves the bar's clips into `people/`.

**Before E0, the bar doesn't edit `people/`.** Its clips live in `engine/sim/clips.ts` as an external pose layer:
- After `person.update(dt)`, the layer finds the skeleton: the first `SkinnedMesh` in `person.group`.
- It looks bones up by name, never by index (`skeleton.getBoneByName('chest')`, with the names from `people/body.ts`'s
  `BONES`). So F5's new finger bones don't throw it off.
- It multiplies its own rotations onto those bones. `anim.ts` rewrites every bone on each update, so nothing
  accumulates.

**At E0** the clips move into `people/anim.ts` as new `AnimName`s and an overlay. That's one additive commit that
changes no existing clip, and the people test page's renders of the existing clips must stay pixel-identical.

### A venue is data

Each venue exports one `VenueDef` from `src/onfoot/venues/<id>/def.ts`. It's mostly plain data (JSON-compatible). It
also holds a dynamic import of its own slice and one predicate:

```ts
export interface VenueDef {
  id: 'lot57' | 'sportsbar';
  name: string;                 // from the venue's brand constant (BAR_NAME)
  template: 'taproom-yard' | 'sports-bar';
  slice: () => Promise<SliceJson>;              // import('../../../data/anaheim/sportsbar-slice.json')
  frame: { origin: [number, number]; u: [number, number]; v: [number, number] };   // game coords and unit axes
  anchor: [number, number];     // the open-data point (game x, z)
  groundM: number;              // terrain height under the site (the game's own grid)
  site: {                       // what of the data our layout replaces
    dropSegs?: number[];        // slice segments the street build skips (the bar: [416], redrawn by its lot builder)
    dropBld?: number[];         // slice buildings the street build skips
    replaceRing?: P2[];
    keepHost?: { bld: number; unit: P2[] };     // the bar: building 61, with our unit carved from it
  };
  edge: P2[];                   // the walkable boundary for this phase (local)
  schedule: Schedule;
  rooms: Room[];                // floors, walls with openings, ceilings, raised areas (frame polygons)
  indoor: (u: number, v: number) => boolean;    // inside a room with a roof; built from rooms; BarPlayer uses it
  ceilingM?: number;            // the bar: 3.6
  objects: Placement[];         // { type, id, at: [u, v], rot, opts? } from the smart-object catalogue
  screens?: ScreenPlacement[];  // { id, at, rot, w, h, channel: 'featured' | 1 | 2 | 3 }
  lights: Emitter[];            // baked at Low, a budgeted subset real at HD and Ultra
  staff: StaffPlan;             // counts by crowd share, capped by the budget; posts (bar lane, pass, host stand)
  parking: { stalls: Stall[]; yours: number };  // Lot 57's Stall type, in local metres
  lines: string[];              // line-set ids
  sim: 'light' | 'full';        // Lot 57: 'light' (Phase 1 behaviour). The bar: 'full'.
  palette: Record<string, string>;
  budgets: Record<Quality, Budget>;
}
export type VisState = 'inside' | 'outside' | 'overhead';    // see "Inside, outside and overhead"
export interface Budget {
  calls: number; tris: number;  // the scene pass (see "Phone performance budgets")
  frameCalls: number; frameTris: number;      // the whole frame: the pass plus shadow maps, GTAO's pass and post
  live: number; staff: number;  // simulated people in the room, and how many of them may be staff
  drawn: Record<VisState, { lod0: number; lod1: number; atLod: number }>;
                                // atLod: how many live people are drawn as meshes (the nearest the camera, or the
                                // overhead's target); the first lod0 and lod1 of them at those LODs, the rest LOD 2;
                                // everyone else a card. Inside and overhead it's the live cap.
  cars: Record<VisState, { near: number; yours: 'detailed' | 'standin' }>;   // parked.near and your car
  castPeople: number;           // people outside the unit casting into the sun's map, nearest first, LOD 1 bodies
  fillerMinM: number;           // no filler stands or sits closer to the player than this
}
export interface Schedule {
  capacity: number;             // fictional
  hours: [number, number][];    // per weekday, Sun..Sat: [open, close] in that business day's hours, 0 to 26
                                // ([11, 26] is 11:00 to 02:00 the next morning); [0, 0] closed
  bands: { from: number; to: number; share: [number, number, number, number] }[];   // Mon-Thu, Fri, Sat, Sun
                                // same 0-to-26 hours: a band from 24 to 26 is 00:00 to 02:00 of the next calendar
                                // day, counted in the column of the day the evening began
  events: { day: number; from: number; to: number; factor: number; label: string }[];   // fictional
  weather: { rain: number; fog: number };      // multipliers
  noiseSeed: number;            // the +-10% noise: lot57/clock.ts's noise() hash of the calendar weekday and whole
                                // hour, XORed first with noiseSeed * 83492791; Lot 57's seed 0 reproduces it exactly
}
// engine/schedule.ts
export function crowdShare(s: Schedule, day: number, hour: number, extra?: (day: number, hour: number) => number): number;
```

**The `extra` hook** exists for what the def can't hold: the featured match's ×1.25 comes from the TV schedule, not
from a fixed weekly event. The bar passes `tv.featuredFactor`, which returns 1.25 from 30 minutes before the day's
featured kick-off to its final whistle, and 1 otherwise (the times are under "The featured match"). It multiplies with
the listed events. Lot 57 passes nothing.

At E0, Lot 57's def is written from its `PLAN`: a world-aligned frame, origin (-5100, -8350), `sim: 'light'`. Its
schedule reproduces `lot57/clock.ts` exactly: `[11, 25]` on Friday and Saturday, and a 24-to-25 band for its 00–01 hour.

**`sim: 'light'` versus `'full'`.** Lot 57's plan says "no needs meters". With `'light'`, the engine runs Lot 57's
Phase 1 behaviour: sit, order, join and leave, talking groups and the crowd. With `'full'` it adds everything in the
next section. Lot 57 stays `'light'` until the owner asks otherwise.

## The Sims-like systems

Everything below lives in `engine/sim/` and is described as data, so a third venue can reuse it. The player and the
NPCs run on the same model: needs, moods, personality, smart objects and the same interactions. The player chooses;
NPCs choose by utility.

### Sim time

- **The clock is the venue's clock.** Live uses the device clock and weekday (Pacific). The test hooks can set a day and
  hour. The time presets map as at Lot 57.
- **Needs, actions and relationships run in sim minutes.** One sim minute is one real minute at 1× speed.
- **Tests can speed this up.** `setTimeScale(k)`, k from 1 to 120, and `fastForward(simMinutes)` exist for tests.
  Fast-forward advances needs, actions and matches deterministically. It doesn't move the device clock.

### Needs

Five needs for the player and every guest, each from 0 (empty) to 100 (full). NPCs also have a hidden sixth, bladder.
It drives restroom trips and isn't shown or given to the player, to keep a phone game light.

| Need | Starts (seeded) | Falls by, per sim minute | Main ways up |
| --- | --- | --- | --- |
| Hunger | 55–80 | 0.8 | Eating: +10 a minute while eating; a basket is +35 to +60 |
| Thirst | 50–75 | 1.6 (2.2 while dancing or playing) | Sips: +7 each, about 6 a drink; water +20 |
| Fun | 50–70 | 1.2 while doing nothing fun; 0 during a fun action | Games, watching, dancing, the jukebox, jokes |
| Social | 40–70 | 1.0 × (0.6 + 0.8·outgoing) when not in a group or conversation (0.6 to 1.4; 1.0 at 0.5); 0 in one | Talking, joking, cheering together, high-fives, toasts |
| Energy | 60–90 | 0.4 standing or walking; 0 seated; more in some actions (below) | Sitting +0.8 a minute; café de olla +15 |
| Bladder (NPCs, hidden) | 70–100 | 0.6, and -8 per finished drink | A restroom visit sets it to 100 |

- **Rates while doing things,** per sim minute:
  - watching the game: fun +2.5, × 1.6 while the screen shows the featured match in play (kick-off to final whistle;
    see "The featured match"), × (0.6 + 0.8 × fan);
  - pool: fun +6, social +2.5, energy -0.6;
  - darts: fun +6.5, social +2.5, energy -0.4;
  - shuffleboard: fun +6, social +2.5, energy -0.4;
  - a conversation: social +4, fun +1;
  - dancing: fun +8, social +2, energy -2.5;
  - eating: hunger +10.

  One-offs on completion: the jukebox, fun +6; water, thirst +20; restroom, bladder set to 100.
- **What a visit feels like:**
  - In a 10-minute visit that only watches the game, thirst falls about 16 and fun rises.
  - Standing alone at the back, social falls about 10.
  - So within a few minutes the meters give you a reason to act, which is the point.
- **No fail states.**
  - Nothing ends the visit or hurts you.
  - Low needs bring moodlets and a nudge in the UI ("Thirsty: the bar's 8 m away").
  - At energy below 10 the player gets one prompt, "Worn out. Head home?", with Drive (in the game) or Leave
    (on the page).
- **The meters** (see "Controls and UI") show each need as a bar with an icon, a word ("Thirsty", "Bored") and a colour
  band: 60 and up green, 30 to 59 amber, under 30 red. They aren't colour alone; there's always the word, and the
  number on tap.

### Moods, moodlets and emotions

- **Mood (0–100)** = 20 + 0.6 × the weighted needs average + the sum of active moodlets, clamped to 0–100.
  - **The weighted needs average** is `Σ b_k·m_k·n_k / Σ b_k·m_k` over the five shown needs. Bladder isn't in mood.
  - **The base weights b:** hunger 0.2, thirst 0.2, fun 0.25, social 0.25, energy 0.1.
  - **The trait multipliers m** are under "Personality".
  - **Labels:** Elated 85 and up, Happy 65–84, Fine 45–64, Meh 25–44, Low under 25.
  - **What it gives:**
    - Full needs read 80 (Happy).
    - Needs averaging 50 read 50 (Fine).
    - Empty needs read 20 (Low).
    - Elated takes a moodlet on top of good needs; a goal for my team at full needs reads 95.
  - **An average guest** (every trait 0.5, so every m is 1) arrives with needs averaging 62 and a mood of about 57
    (Fine). After 20 sim minutes standing alone doing nothing, the average is 41 and the mood 44.5 (Meh, just under
    Fine). Without moodlets, Low takes collapsed needs: an average under about 8. Otherwise it takes bad moodlets on top
    of poor needs. So "Low" means the AI has let someone down, and S3a checks for it.
- **Moodlets** are short events with a value that fades linearly to 0 over its duration:

| Moodlet | Value | Lasts (sim min) | Moodlet | Value | Lasts |
| --- | --- | --- | --- | --- | --- |
| Goal for my team | +15 | 10 | Great chat | +8 | 10 |
| Goal against my team | -8 | 6 | Shared a laugh | +6 | 8 |
| My team won | +20 | 30 | Joke fell flat | -4 | 4 |
| My team lost | -12 | 20 | High-five | +5 | 5 |
| Won a game (pool, darts, shuffleboard) | +12 × (0.6 + 0.8·competitive) | 15 | Toast | +6 | 8 |
| Lost a close one | -4 | 5 | Got a round | +10 | 15 |
| Good food (a favourite) | +6 | 15 | Bought a round | +8 | 15 |
| Introduced to someone | +4 | 6 | Brushed off | -5 | 5 |
| Too crowded (crowd share over 0.9, outgoing under 0.4) | -3 | while it lasts | Last call | -2 | until close |

- **Emotion.** One emotion is shown with the mood face. It's the strongest that applies:
  - Excited: a team moment in the last 5 minutes.
  - Playful: a joke landed, or the playful trait plus a happy mood.
  - Confident: won a game.
  - Social: in a good conversation.
  - Bored: fun under 30.
  - Lonely: social under 30.
  - Hungry, Thirsty or Tired: the matching need under 30, or energy under 25.
  - Gutted: their team lost in the last 20 minutes. It's mild.
  - Otherwise, Fine.
- **Emotions change behaviour.** These bonuses feed the utility AI:
  - Excited: cheer, high-five and dance +15.
  - Bored: fun actions +20.
  - Lonely: social actions +20.
  - Gutted: dance -20, and Console is accepted more often.
- **Emotions change bodies.** The people builder's expressions follow mood: smile, laugh, neutral, listen. Walk speed
  is ×0.9 when Low and ×1.05 when Excited. Posture slumps a little when Low.

### Personality

Every person has five traits from 0 to 1, seeded:
- **outgoing:** social decays × (0.6 + 0.8·outgoing) (the needs table), and social actions score higher (`m_social`
  and the social affinity);
- **playful:** jokes land (Joke's base) and get told (Joke's affinity is playful);
- **competitive:** games score higher (the game affinity) and wins mean more: the "Won a game" moodlet is
  +12 × (0.6 + 0.8·competitive), from +7.2 to +16.8;
- **fan:** watching scores higher and reactions are bigger;
- **active:** dancing and games over sitting.

Plus:
- **A team:** one of the 16 fictional teams, or none.
  - Arrivals from 2 hours before the day's featured kick-off to its final whistle: half support one of the featured
    match's two teams, a quarter each (see "The featured match"). The other half split as below.
  - Otherwise, and on Tuesday, when there's no featured match: 30% Marigold League, 25% Canyon Gridiron, 45% none.
- **Favourites:** a drink, a food and a game.

The player's traits default to 0.5, and there's no trait picker. They act on the player as on anyone: the player's own
outgoing scales their social decay (× 1.0 at 0.5), and the trait multipliers below weight their mood. The utility AI
uses them only when autonomy is on (below). The `setTraits()` hook (S2a) sets them for tests. The player picks their
team on the TV guide card ("Pick a side"), or none.

**Trait multipliers m** (used by mood and by the utility AI's need terms):
- hunger, thirst and bladder: 1.0;
- fun: `0.8 + 0.4·playful`;
- social: `0.6 + 0.8·outgoing`;
- energy: `1.2 - 0.4·active`.

Bladder has no trait and weight 1.0 in the score. It isn't in mood.

### Smart objects

As The Sims does it: objects advertise what they offer, and people (the player through menus, NPCs through the utility
AI) pick from those adverts. The catalogue is data in `venues/sportsbar/objects.ts`; the types live in `engine/sim/`.

```ts
type Need = 'hunger' | 'thirst' | 'fun' | 'social' | 'energy' | 'bladder';
interface Slot { id: string; at: [number, number]; face: number; pose: 'sit' | 'stand' | 'lean' | 'play' | 'dance' | 'staff';
  height?: number; role: 'user' | 'watcher' | 'staff' }
interface Advert {
  action: string; label: string;               // 'order-drink', "Order a drink"
  deltas: Partial<Record<Need, number>>;       // expected total change over the action (rates × duration + one-offs);
                                               // for a continuous advert, rates × the 5 sim-minute scoring window
  minutes: [number, number] | 'continuous';    // duration range (sim); continuous: no end of its own (below)
  overlay?: boolean;                           // runs alongside the current action without ending it (below)
  wait?: [number, number];                     // seconds until the item is in hand, not counting the walk
  party?: [number, number];                    // people needed (pool: [2, 4])
  requires?: ('open' | 'staffed' | 'holding:drink' | 'holding:food' | 'notHolding:drink' | 'notHolding:food'
              | 'seated' | 'gameNight' | 'screenInView' | 'npcOnly')[];
  tags: ('drink' | 'food' | 'game' | 'watch' | 'social' | 'dance' | 'rest' | 'music' | 'comfort')[];
  slots: string[];                             // which of the object's slots it uses
}
interface SmartObjectType { type: string; colliders: Shape[]; slots: Slot[]; adverts: Advert[]; model: string }
```

| Object (count) | Slots | Adverts: deltas over the action |
| --- | --- | --- |
| Bar counter (1) | 9 stools, 4 standing gaps, the server pick-up, 4 bartenders' spots | Order a drink: thirst +42, social +3; wait 4–8 s, then sip for about 6 min. Order food: hunger +45, energy +5; wait 60–180 s (the kitchen). Both require `notHolding`. Both are overlays for someone already on a stool or in a gap. Lean and chat: social +12 over 5 min. Watch the bar screens: continuous, as Watch the game. |
| Booth (5) | 4 seats | Sit: continuous, energy +0.8 a minute (+4 in the window). Eat (needs food), Chat with the table, Watch (2 of 4 seats face the TV wall). Order (table service, below). |
| High-top (6) | 4 stools | Sit, Eat, Chat, Watch, Order (table service) |
| Window rail (2) | 4 stools each | Sit, Eat, People-watch: continuous, fun +0.8 a minute (+4 in the window) |
| Screens (12, as one family) | any slot with the screen in view | Watch the game: continuous, fun 2.5 a minute × match and fan factors; social +1 a minute with 2 or more watchers within 3 m |
| Standing floor (1) | 20 standing spots | Stand and watch: continuous, as Watch the game (the big screen). It costs standing energy (-0.4 a minute). There's no table service here. |
| Pool table (2) | 2 or 4 players, 4 watchers | Play pool: fun +40, social +15, energy -4, over 5–8 min, party [2, 4]. Watch pool: fun +8 over 4 min. |
| Dartboard (3) | 1–2 players, 2 watchers | Play darts: fun +30, social +10, over 3–5 min, party [1, 2] |
| Shuffleboard (1) | 2 or 4 players, 3 watchers | Play shuffleboard: fun +35, social +12, over 5–7 min, party [2, 4] |
| Jukebox (1) | 1 | Pick a song: fun +6, 20 s |
| Water station (1) | 1 | Get water: thirst +20, 15 s |
| Restroom doors (2) | 1 each, hidden | NPC only: bladder set to 100 over 1–2 min, out of sight |
| Dance spot (1, game nights) | 12 of the standing floor's spots | Dance: fun +35, social +10, energy -12, over 3–5 min. Requires `gameNight` (defined under "The featured match"). |
| Patio table (6), patio rail (1), heaters (2) | 4 / 6 / area | Sit, Eat, Chat, Watch (the two patio screens), Order (table service, at the tables). Watch the freeway: continuous, fun +1 and energy +0.8 a minute (+5 and +4 in the window). Heaters: +2 mood at night within 2.5 m. |
| Kitchen pass (1), host stand (1) | staff | Staff jobs only |

**Table service** is the Order advert at booths, high-tops and patio tables. It's an overlay and requires `seated` and
`notHolding`:
- **Order a drink:** thirst +42, social +3. The wait is the server's expected arrival (30 to 90 s, by staffing),
  plus 8 s to order and about 20 s to bring it from the bar.
- **Order food:** hunger +45, energy +5. The wait is the arrival, plus 8 s, plus the kitchen's 60 to 180 s.

The person keeps sitting, watching or chatting while the server comes.

**Continuous adverts** (Watch the game, Sit, People-watch, Watch the freeway, Stand and watch, standing in a group) have
no end of their own. They're scored over a fixed **5 sim-minute window**: their deltas are the rates × 5. While in
one, a person decides again every 20 sim seconds.

**Overlays** run alongside the current action without ending it, so hysteresis doesn't apply to them. These are the
two Order adverts while you're at the counter or seated at a table, and the automatic sips and bites. They're scored
apart from the other adverts at each decision. The best overlay scoring 25 or more is taken.

- **Seats keep Lot 57's `Seat` shape** (position, seat height, facing, where you stand to sit). An object's slots are
  seats or spots, so tap to go, Sit and the walk grid work exactly as at Lot 57.
- **Reservations.**
  - Choosing an action reserves its slots for the walk there plus 10 s, so two people never head for one stool.
  - If a reservation lapses, the person plans again.
  - A slot's capacity is never exceeded; that's a check.
- **Party actions** (pool, darts, shuffleboard) start with an invite. The initiator picks a partner by relationship and
  competitiveness, and the partner accepts or not through its own utility. With no partner in 30 s, darts become solo
  practice and the others are dropped.

### The action queue

Every person has a queue of up to 3 actions, The Sims way. The player adds to it from menus. NPCs add one at a time from
the utility AI.
- **Walking first.** An action walks there first: tap to go, the A* path, string-pulled.
- **Cancelling.** The player cancels by tapping its icon. Moving the stick cancels the current walk, as at Lot 57.
- **Interruptions.** Big moments on the screens add a short reaction in front of the current action, then the action
  resumes. Staff calls (last call, closing) clear the queue.

### Ordering and the menu (ours)

Ordering for yourself is free.
- **At the bar,** a bartender makes it in 4 to 8 seconds and hands it over.
- **At a booth, high-top or patio table,** a server arrives within 30 to 90 s, depending on staffing. They take the
  order in a sheet with big buttons and bring it, food from the kitchen pass in 1 to 3 minutes.
- **What you hold:** a cup or a basket, in the corner of the first-person view or in your avatar's hand in third person.
  Sips and bites play automatically every 40 to 70 s, or on a tap.

The menu sheet says it plainly: "You drove here, so your drinks are alcohol-free. On the house."

| Drinks (the player's menu) | | Food | |
| --- | --- | --- | --- |
| Added-Time lime soda | thirst | Wings: Katella hot, lemon-pepper or mango-habanero | hunger |
| Tamarindo agua fresca | thirst | Carne asada loaded fries | hunger |
| Cucumber-chile cooler | thirst | Street-corn nachos | hunger |
| Zero-proof lager (non-alcoholic) | thirst | Smash burger | hunger |
| Iced café de olla | thirst, energy +15 | Al pastor sliders | hunger |
| Root beer float | thirst, fun +3 | Veggie quesadilla | hunger |
| Water (also self-serve) | thirst | Pretzel bites with queso; churro bites | hunger, fun +2 |

Each item is data: id, name, kind, deltas, prep seconds, sips or bites, the held model, and a tag the lines can use.
- **NPCs** order from the same list plus "a pint": a plain glass, unlabelled, scene only, as at Lot 57.
- **There are no prices** in any currency.

### The games: pool, darts, shuffleboard

Each is a playable mini-game for the player and a simulated game for NPCs, using the same rules.

- **Pool.**
  - **Physics.** 2D table physics: balls r 0.028 m on a 1.98 m × 0.99 m bed, ball-ball restitution 0.95, cushions
    0.75, rolling deceleration 0.25 m/s², six pockets r 0.055. Fixed 240 Hz substeps, no spin.
  - **Rules.** Simplified 8-ball: solids or stripes, the 8 last. A scratch gives ball in hand anywhere. No called
    shots.
  - **Controls.** Drag back from the cue ball to aim and set power. A guide line shows the first contact. Release to
    shoot.
  - **The view.** The camera goes overhead of the table for your shot and returns after.
  - **NPC shot selection.** For each of their own balls b (the 8 once they're cleared) and each pocket k:
    1. The ghost ball G is `b - 2r·û`, where û is the unit vector from b to k.
    2. Both paths must be clear: no other ball's centre within 2r of the cue-to-G segment or of the b-to-k segment.
       Side pockets also need û within 50° of the cushion's normal.
    3. The cut angle θ is between (G - cue) and û. A shot with θ over 70° is skipped.
    4. The shot's score is `cos θ - 0.25·(d1 + d2) / 2.2`, where d1 is cue to G and d2 is b to k, in metres, and 2.2 m
       is the table's diagonal. The best shot is taken.
    5. Its speed: the object ball needs `v_b = √(2·0.25·(d2 + 0.1))`. At contact the cue ball needs
       `v_c = v_b / (0.975·cos θ)`. So the cue starts at `v_0 = 1.15·√(v_c² + 2·0.25·d1)`.
    6. If no shot passes, it plays safe: full ball on its nearest own ball at 1.2 m/s.

    Then the aim error: σ = 6° - 4.5°·competitive (1.5° to 6°), and the power ×N(1, 0.08).
  - **Games nobody is watching.** An NPC game runs the physics while it's on screen or within 15 m of the player.
    Otherwise it's resolved statistically:
    - Each turn takes 15 to 30 s and pots k balls, with k geometric with p = 0.25 + 0.35·competitive.
    - A shot on the 8 scratches with p 0.03.
    - When the player comes within 15 m or looks at the table, the balls left are laid out at seeded positions (no two
      within 2r, none in a pocket mouth), and the physics takes over.

    Darts and shuffleboard games off screen are resolved the same way, each throw's score drawn from the thrower's
    skill.
- **Darts.**
  - **Rules.** 301, straight out (no double needed), bust over.
  - **Throwing.** Flick up to throw. Your aim sways; holding steadies it for 1.2 s, then the sway grows. Low energy
    widens the sway a little.
  - **The board** is the standard generic 20-segment layout, drawn in code.
- **Shuffleboard.**
  - **Rules.** Four pucks a side, alternating. Zones 1, 2 and 3, and 4 for a puck hanging off the end. First to 15.
  - **Controls.** Swipe to slide.
  - **Physics.** Pucks r 0.026 m on a 6.7 m × 0.51 m bed. Sliding friction μ = 0.07, so they decelerate at
    0.69 m/s²: a release at 3.0 m/s travels 6.55 m (v² / 2μg). Puck-puck restitution 0.8; the side rails 0.6. Fixed 240 Hz
    substeps. A puck past the end drops into the gutter.
  - **NPCs** aim at their target zone, with speed error σ = 0.10 - 0.07·competitive m/s and line error
    σ = 1.5° - 1.0°·competitive.
- **Results.** A win gives the winner the "Won a game" moodlet and 5 tokens; the loser in a close game gets "Lost a
  close one". Playing together counts as an interaction for relationships (+6 for the winner, +4 for the loser, when
  both are in a good mood). Nothing is wagered.

### The games on the screens (fictional leagues)

Two fictional leagues of our own, with code-drawn crests and two colours per team:

| Marigold League (soccer-like) | Abbr. | Canyon Gridiron Circuit (gridiron-like) | Abbr. |
| --- | --- | --- | --- |
| Harborline FC | HBL | Interchange Flyovers | INT |
| Arroyo Kestrels | ARK | Basin Freight | BAF |
| Citrus Grove Sparrows | CGS | Sunset Signal | SSG |
| Palisade Lanterns | PAL | Ironwood Ratchets | IWR |
| Saltflat Terns | SFT | Copperline Haulers | CPH |
| Ridgeview Sundials | RVS | Breakwater Gantries | BWG |
| Bluffside Undertow | BLU | Dune Patrol | DNP |
| Mesa Quail | MSQ | Grove Pickers | GRP |

Four earlier names were dropped because each shared a word with a real team's name or nickname:
- Foxes (Leicester City; Atlas in Liga MX are los Zorros);
- Iron (Scunthorpe United, and a defunct US spring-football team);
- Cranes (Uganda's national team);
- Rivets (a US summer-collegiate baseball team).

**Checking the names.**
- **The test.** It checks every team, league and channel name against a blocklist in
  `tests/onfoot/sportsbar-blocklist.json`.
- **How it matches.** Each blocklist entry is a word or a phrase, matched as a whole word or phrase, with case and
  accents folded, anywhere in our names. So one shared nickname fails the test. Generic words (FC, City, United, Club,
  Athletic, Real, League) aren't entries. Our three-letter codes aren't matched, since three letters collide with
  everything.
- **What the blocklist has:**
  - **US and Canadian major leagues:** team names and nicknames from the NFL, MLB, NBA, NHL, MLS, WNBA and NWSL, plus
    the minor-league and college teams of Southern California.
  - **Liga MX:** clubs and nicknames, for example América and las Águilas, Chivas, Cruz Azul and la Máquina, Pumas,
    Tigres, Rayados, Diablos Rojos, Guerreros, la Fiera, Tuzos, Zorros, Xolos, Rayos, Gallos Blancos, Bravos.
  - **The major international soccer leagues and competitions:** Premier League, EFL Championship, La Liga, Serie A,
    Bundesliga, Ligue 1, Eredivisie, Primeira Liga, the Scottish Premiership, the Brasileirão and Argentina's top
    flight; the Champions League, Europa League, Copa Libertadores, Concacaf Champions Cup, Leagues Cup, World Cup,
    Gold Cup, Copa América and the Euros.
  - **Their clubs:** the top-flight clubs of those leagues, with their English, Spanish and Portuguese nicknames, for
    example Foxes, Gunners, Red Devils, Spurs, Toffees, Magpies, Hammers, Irons, Saints, Seagulls, Villans, Wolves,
    Cherries, Bees, Eagles, Clarets, Hornets, Canaries, Owls.
  - **National teams' nicknames,** for example El Tri, Seleção, Albiceleste, Les Bleus, Azzurri, La Roja, Oranje, Three
    Lions, Socceroos, Super Eagles, Black Stars, Indomitable Lions, Cranes, Samurai Blue.
  - **Other real leagues and tournaments,** broadcasters, and phrases such as "Monday Night".
- **Before release,** the names are searched again.

**Formats are ours.** Both leagues use a quick format:
- The Marigold League plays 2 × 10-minute halves with a running clock.
- The Gridiron Circuit plays 4 × 6-minute quarters.
- Matches run back to back in each league's windows, so a short visit sees real moments.

**The schedule** is fictional and seeded: `seed = hash(venue noiseSeed, ISO week, day, slot, channel)`. The ISO week is
the device's current week, the one `anaheimDate` uses for the sun; tests pin it with `setWeek(n)`.

| Channel | Shows |
| --- | --- |
| 1 · Marigold League | Wed and Fri 19:00 to 23:00; Sat 12:00 to 23:30; Sun 11:00 to 16:00. A kick-off every 30 minutes from the window's start: 10-minute halves, a 5-minute half-time, the final whistle 25 minutes after kick-off, then 5 minutes of the score card. The last kick-off is the one that ends inside the window (Wed and Fri 22:30, Sat 23:00, Sun 15:30). |
| 2 · Canyon Gridiron | Sun 10:00 to 20:00; Mon and Thu 17:30 to 22:00. A kick-off every 45 minutes from the window's start: 6-minute quarters, 2-minute breaks after the first and third, a 6-minute half-time, the final whistle 34 minutes after kick-off. The last kick-off ends inside the window (Sun 19:00, Mon and Thu 21:15). |
| 3 · Highlights | Replays of the newest simulated goals and scores, up to 12, from the day's completed fixtures. Until a day's first final whistle, and all of Tuesday, it shows the previous match day's instead, under its name ("Sunday's highlights · simulated"); its fixtures are regenerated from their seeds. |
| The big screen | The day's featured channel (below) all day: Marigold on Wednesday, Friday and Saturday, gridiron on Sunday, Monday and Thursday. Highlights on Tuesday, and whenever its channel has no fixture in play. |

**The featured match.** Every rule that says "featured" means exactly one fixture a day, from this table, and no
other: the other fixtures on the big screen, before and after it, aren't featured.

| Day | Featured fixture (slot, channel) | Kick-off | Final whistle | Crowd ×1.25 (`tv.featuredFactor`) | `gameNight` |
| --- | --- | --- | --- | --- | --- |
| Monday | the 19:00 gridiron, channel 2 | 19:00 | 19:34 | 18:30 to 19:34 | no |
| Tuesday | none (no matches; the darts league night) | | | none | no |
| Wednesday | the 20:00 Marigold, channel 1 | 20:00 | 20:25 | 19:30 to 20:25 | no |
| Thursday | the 19:00 gridiron, channel 2 | 19:00 | 19:34 | 18:30 to 19:34 | no |
| Friday | the 20:00 Marigold, channel 1 | 20:00 | 20:25 | 19:30 to 20:25 | 20:25 to close (02:00) |
| Saturday | the 20:00 Marigold, channel 1 | 20:00 | 20:25 | 19:30 to 20:25 | 20:25 to close (02:00) |
| Sunday | the 14:30 gridiron, channel 2 | 14:30 | 15:04 | 14:00 to 15:04 | no |

- **`gameNight`** is true on Friday and Saturday from the featured match's final whistle, never before 20:00, until
  close. Its 00:00 to 02:00 belongs to the business day that opened the evening, as in the crowd table, so Saturday
  01:00 is Friday's game night. `tv.featured(day)`, `tv.featuredFactor(day, hour)` and `gameNight(day, hour)` live in
  `engine/sim/tv.ts`.
- **What uses it, and nothing else:**
  - the crowd's ×1.25 (`tv.featuredFactor`, through `crowdShare`'s `extra` hook);
  - watching's ×1.6, while the featured match is in play on the screen being watched;
  - the utility AI's event term, +25·fan on watch adverts for screens showing it, while it's in play;
  - team support: half the arrivals from 2 hours before its kick-off to its final whistle back one of its two teams;
  - the host, at the door from the start of the ×1.25 window to its end, and through `gameNight`;
  - `gameNight`: the dance spot's advert, the floor lights at 60% and the louder jukebox, the chance to start dancing
    at the featured final whistle, and S2a's dance check and dance screenshot.

**The match model.** Each fixture's whole event list is generated from its seed when it's created. Opening the page in
the middle of a match fast-forwards to the right minute. The same clock always gives the same scores, so tests can
reproduce it.
- **Marigold.**
  - Per team per minute, a chance arrives at rate `0.35 × attack / defence`. Ratings run 0.8 to 1.2, seeded per
    season.
  - A chance is on target with p 0.45, and an on-target chance scores with p 0.32: about 2 goals a match.
  - Chances on target that don't score are "big chances" (an "ooh"): about 4 a match.
- **Gridiron.** Possessions alternate, 1.5 to 3 minutes each.
  - Outcomes: touchdown 0.24, field goal 0.16, punt 0.45, turnover 0.15.
  - A big play inside a drive has p 0.35.
  - That's about 10 to 11 possessions, 2.5 touchdowns and 1.7 field goals a game.
- **Events.** Each is `{ channel, kind: 'goal' | 'bigChance' | 'td' | 'fg' | 'bigPlay' | 'final', team, intensity 0..1,
  t }`. The crowd reacts to these.

**The broadcast picture.** Drawn in canvas, one canvas per channel shared by every screen on it.
- **Marigold:** a tilted pitch with 22 dots that hold a shape and drift with the ball, and the ball's run to goal on a
  chance.
- **Gridiron:** a field with yard lines, the snap and the players' runs.
- **Banners.** "GOAL" and "TOUCHDOWN" banners in the scoring team's colours.
- **The score bug** reads like "HBL 1–0 ARK · 14'". A "SIMULATED" tag sits in the corner of every frame on every
  screen.
- **Resolution and redraw rate** by preset: Low 512 × 288 at 8 Hz, HD 1024 × 576 at 15 Hz, Ultra 1024 × 576 at
  30 Hz.
- **The TV guide card** reads "Fictional leagues · simulated matches · not live".

### How the crowd reacts

For each event, every person who can see a screen on that channel reacts, after a staggered 0.2 to 0.7 s delay.
- **Who can see.** Each seat and spot has a precomputed list of visible screens (within 25 m and 60° of facing).
  Standing people use their zone's list.

| Who | Reaction (probability × animation) |
| --- | --- |
| Supports the scoring team | p = 0.3 + 0.7·fan. Cheer: arms up for 0.8 to 2.5 s, and a jump if active > 0.6. Then a high-five with a nearby supporter (40%) or a toast (20%). "Goal for my team" moodlet. |
| Supports the other team | Same p. Groan: hands to the head for 1 to 2 s, then sit back. "Goal against" moodlet. |
| Neutral | p 0.25: clap, or an "ooh" for a big chance |
| Final whistle | Winners: "My team won", and, at the featured match's final whistle on Friday or Saturday (where `gameNight` begins), a chance to start dancing: a winner who can see a screen, with active over 0.4 and fun under 70, puts Dance at the front of their queue with p = 0.5 × active (0.2 to 0.5). Losers: "My team lost". |

The room's sound swells with the number reacting (see "Audio"). For the player, a big **Cheer** button appears for 8 s
after any moment. Cheering with others nearby counts as a Cheer interaction with each of them, up to 4.

### Dancing on game nights

**When.** While `gameNight` holds: Friday and Saturday from the featured match's final whistle (20:25 by the schedule,
never before 20:00) until close (see "The featured match").
- The lights over the floor drop to 60%. The jukebox plays the game's own KFWY tracks louder through the room filter.
- The dance spot opens: its advert turns on.

**Who.** The Dance advert has no trait gate: while `gameNight` holds anyone may take it, and its affinity ((active +
playful) / 2) and fun's urgency make active, bored people the likeliest. "Active over 0.4 and fun under 70" gates only
the one direct chance at the featured final whistle (p = 0.5 × active, under "How the crowd reacts"); it isn't a
`requires` on the advert. The player taps Dance from anywhere and walks there.

**How.** Three procedural dance loops (sway, two-step, arm pump) on the people builder's rig, each person with their own
tempo phase. The spot holds 12 at a time.

### Interacting with people

Tap a person and a radial menu opens with up to six options that fit the moment. A seventh, "More…", opens a list.
NPCs use the same interactions on each other through the utility AI.

**Whether they accept:**

```
p = clamp(0.05, 0.97, base + 0.004·rapport + 0.002·friendship + 0.15·(target.outgoing - 0.5)
                      + (target.mood - 50) / 250 + memoryTerm + context)
```

`memoryTerm` is +0.05 for each of the last 3 memories of the same kind that went well, and -0.08 for each that didn't.

`context` is the sum of these, clamped to -0.25 to +0.25:
- **+0.10** when both support the team that scored in the last 60 s (for Talk, Joke, Cheer together, High-five and
  Toast).
- **-0.10** when the target's team conceded in the last 5 minutes (for Joke and Challenge).
- **-0.20** when the target is mid-turn in a game: lining up a shot, a throw or a slide.
- **-0.10** when the target is talking in a group the actor isn't in (for anything but Join).

| Interaction | Offered when | base | If accepted (rapport Δ; both people) | If not |
| --- | --- | --- | --- | --- |
| Talk | always, unless the target's group already has 6 | 0.75 | +6; social +12; "Great chat" after 3 good exchanges | -3; social +2 |
| Joke | always | 0.55 + 0.3·target playful | +9; fun +6, social +8; "Shared a laugh" | -6; "Joke fell flat" |
| Cheer together | within 8 s of a moment, same team or neutral | 0.85 | +5; fun +5 | they just don't join |
| High-five | within 60 s of a score for a team you share, after a game together, or friendship ≥ 45 after a landed joke | 0.9 | +8; "High-five" | -2 (left hanging) |
| Toast | both holding drinks, and a moment or friendship ≥ 20 | 0.85 | +7; social +8; "Toast" | none |
| Buy a round | at their table or group (2 to 6 people), tokens ≥ cost | 0.97 | +15 with each; they get "Got a round", you get "Bought a round" | none |
| Introduce… (pick a second person) | you've met both A and B, and they haven't met | 0.8 | A and B start at rapport 10 + 0.3·min(your friendships); +5 with you; "introduced by you" memory for both | -2 |
| Challenge (pool, darts or shuffleboard) | a table or board is free | 0.5 + 0.4·target competitive | starts a game together | -1 |
| Ask about their team | target has a team | 0.9 | +4; their team shows on their card | none |
| Console | their team lost in the last 20 min | 0.8 | +8; halves "My team lost" | -2 |
| Say goodbye | in a conversation | 1 | +2; ends politely | none |

**Rules for rounds.**
- A round costs 4 tokens a person, delivered by staff in 1 to 2 minutes.
- Each person gets their favourite. The player's own is alcohol-free.
- A group can be bought a round once every 10 sim minutes.
- NPCs buy rounds too: outgoing above 0.6 and a group of 3 or more, at most once a visit.

**How each interaction plays.** As a short beat:
1. Walk up (tap to go) and face each other.
2. A 2 to 4 s animation.
3. A caption line from the line sets, tagged by interaction, outcome and context.
4. Feedback: a small lime "+" spark rising over the head, or a coral "–" puff. They're drawn in the HUD layer at the
   head's screen position, not in the 3D scene, so they cost no draw calls.

**Talk in detail.** It is Lot 57's exchange:
- A line, then two reply chips, warm or quip.
- Warm adds 2.
- Quip adds 4 if the target is playful above 0.5, and takes 2 otherwise.
- After two or three exchanges they wrap up.

**Joining groups.** Join and Leave work exactly as at Lot 57: the circle opens a gap and turns to you.

**Talk, Join and groups** (the player and NPCs alike). Groups are Lot 57's talking groups, 2 to 6 people.
- **An accepted Talk, or a Join,** puts both people in one group:
  - if the target is in a group of fewer than 6, the actor joins it, and the circle (or the table) makes room;
  - if the target is alone, a new group of 2 forms where the target is: a standing circle, or their table if they're
    seated and the actor can sit at it;
  - toward a member of a group of 6, Talk and Join aren't offered.
- **Every other interaction** (Joke, Toast, High-five and the rest) is a beat between two people, inside a group or
  across a table. It doesn't make a group.
- **Leaving.** Say goodbye, the wrap-up after two or three exchanges, or a decision for an action somewhere else takes
  a person out. A group left with one person ends.

### Relationships and memory

Two numbers per pair, as The Sims 2 kept daily and lifetime relationships:

```ts
interface Rel {
  a: PersonId; b: PersonId;
  rapport: number;      // -100..100, this visit
  friendship: number;   // -100..100, lasting (regulars and the player only)
  met: number; last: number;               // sim time first met, last interaction
  mem: Memory[];        // ring of the last 8
  highlights: Memory[]; // up to 3: the first meeting and the biggest moments
}
interface Memory { t: number; kind: string; good: boolean; delta: number; ctx?: string }   // ctx: team id, game, item
```

**How they change:**
- **An outcome Δ** updates both numbers:
  - `rapport += Δ·(1 - |rapport|/150)`;
  - `friendship += k·Δ·(1 - |friendship|/150)`, with k 0.35 when Δ > 0 and 0.15 when it's negative.
- **Rapport fades** toward 0 by 1.5 a sim minute once they've gone 5 sim minutes without interacting.
- **Friendship fades** toward 0 by 0.5 per device day apart. It never drops below 20 once it has reached 45: old
  friends stay friendly.

**Levels** come from friendship and appear on the person's card:

| Friendship | Level |
| --- | --- |
| never met | Stranger |
| 0 to 19 | Acquaintance |
| 20 to 44 | Friendly |
| 45 to 74 | Friend |
| 75 and up | Good friend |
| -1 to -29 | Awkward |
| -30 and below | Cold |

During a visit, rapport of 30 and up adds a "Getting along" chip.

**What memory changes:**
1. **The lines people say.** Lines tagged `remembers:<kind>` can be picked, such as "You're the one who bought the round
   when Undertow scored. Respect."
2. **Acceptance:** the `memoryTerm` above.
3. **NPC choices:** +10 toward someone they share a highlight with.

**Storage.** Pairs are sparse: at most 64 tracked per person, the weakest and oldest dropped first.

### NPC autonomy (utility AI)

Each NPC decides when its action ends, and while in a continuous action (watching, sitting, standing in a group)
every 20 sim seconds. A decision scores the adverts the candidate rule lets in (under "People advertise like objects" and "The budget"),
from objects and from the people present:

```
score(A) = Σ_k  m_k · Δ_k(A) · urgency(n_k)          // the needs, k = hunger, thirst, fun, social, energy, bladder
         + 20 · affinity(A)                            // 0..1
         + emotion(A) + event(A) + memory(A)
         + urgent(A)                                   // +30 for each urgent need A raises by 10 or more
         - 0.6 · walk(A) - 15 · occupancy(A) - 0.05 · wait(A)
         - 25 · (A leaves a conversation mid-turn)
urgency(n) = 0.2 + 1.8 · ((100 - n) / 100)²          // full 0.2; half 0.65; 29: 1.11; empty 2.0
```

**Every term:**
- **m_k** are the trait multipliers under "Personality". Bladder's is 1.0.
- **Δ_k(A)** is the advert's delta for need k, clipped to the room left (at most 100 - n_k). A continuous advert's delta
  is its rate × the 5 sim-minute window.
- **affinity(A)** runs from 0 to 1. Each tag maps to a trait:
  - game → competitive; watch → fan; social → outgoing; music → playful; Joke → playful (it replaces social's
    outgoing for Joke);
  - dance → (active + playful) / 2; rest → 1 - active;
  - drink, food and comfort → 0.

  An advert with several tags takes its strongest (the max). Add 0.25 if the advert is the person's favourite game,
  drink or food. Cap the total at 1.
- **emotion(A)** is the emotion bonuses above: Excited +15 on cheer, high-five and dance; Bored +20 on fun-tagged
  adverts; Lonely +20 on social; Gutted -20 on dance.
- **event(A)**: while the featured match is in play (kick-off to final whistle, from "The featured match"), +25·fan on
  watch adverts for screens showing it; no other fixture earns it. For 60 s after a goal or a touchdown, +30 on cheer,
  high-five and toast.
- **memory(A)** is +10 on a social advert toward someone they share a highlight with.
- **urgent(A).** A need under 30 is urgent. The rule is under "Urgent needs".
- **walk(A)** is the path length in metres to the advert's slot: the A* length, or the straight line × 1.3 before a
  path exists. It's 0 for overlays and for the slot the person is already in.
- **occupancy(A)** runs from 0 to 1:
  - For objects with several user slots (the bar counter's 13 stools and gaps, a pool table's 4 players and 4
    watchers, a dartboard, the shuffleboard, the standing floor), it's the share of those slots that others have
    reserved or are using.
  - For a person's social advert, it's (group size - 4) / 2, clamped to 0..1: a crowded circle.
  - Single-slot objects aren't counted, because a taken slot isn't offered at all.
- **wait(A)** is the advert's `wait` in seconds (the mean of its range): a bar drink 6, bar food 120, table service
  88 for a drink (60 + 8 + 20) and 188 for food (60 + 8 + 120).

**How the choice is made.**
- **Sampling.** Take the top three scores and pick one with probability ∝ `exp((s - best) / 8)`. The best usually wins,
  but people aren't robots.
- **Overlays** are scored apart from the rest. The best one scoring 25 or more is taken, without ending the current
  action.
- **Hysteresis.** A continuous action is dropped only if the new best beats its current score by 25% plus 10.
- **Urgent needs.** When any need is under 30:
  1. adverts that raise that need by 10 or more get +30 (`urgent`);
  2. hysteresis is off for them;
  3. the current continuous action, and every other advert that shares a tag with it, is scored without its affinity,
     emotion and event terms. Watching the match, but thirsty: no other screen outbids the drink either.

  The arithmetic, at thirst 29 (urgency 1.11), Saturday 20:10, with the featured match in play:
  - **The hard case.** A fan (fan 1.0, other traits 0.5) is standing on the standing floor, with fun 40, social 60 and
    energy 70.
    - Watching scores 70.5: fun 28 × 0.85 = 23.7, social 2.4, energy -0.7, affinity 20, event 25.
    - Without the urgent rule, a drink at the bar 12 m away, with 10 of the counter's 13 stools and gaps taken, scores
      28.9: thirst 46.5, social 1.5, walk -7.2, occupancy -11.5 (15 × 10/13), wait -0.3. Hysteresis would ask for 98.
    - With the rule, the drink scores 58.9 and water 8 m away 47.3 (22.1 + 30 - 4.8). Watching is re-scored at 25.5, and
      watching the bar's screens from a free stool 12 m away at 6.7 (25.5 - 7.2 - 11.5, unrounded).
    - So a drink-tagged action is picked with p = (1 + 0.235) / (1 + 0.235 + 0.015) = 0.988 at each decision.
  - **The typical case.** The same thirst, fan 0.5, seated at a high-top. Table service is an overlay and scores 73.6
    (46.5 + 1.5 + 30 - 4.4). That's over 25, so the person orders without leaving the match.
  - **Without urgency,** a seated person orders by table service at about thirst 45 (the overlay scores 28) and not at
    50 (24). So most seated people never reach the red.

  S3a's check ("70% within two decisions") has that margin. People in a timed action (a pool game, a dance) decide when
  it ends, which is still their next decision.
- **People advertise like objects.** Each candidate person (below) offers the interactions in the table under
  "Interacting with people" whose "Offered when" holds, and each is scored with the same formula as an object's advert.
  - **The deltas.** An interaction I toward target T advertises its expected change to each need:

    ```
    Δ_k(I, T) = p · Δ_k(I accepted) + (1 - p) · Δ_k(I not accepted)
    ```

    p is the acceptance formula above, worked out for this actor and this target (rapport, friendship, the target's
    outgoing and mood, memory and context). The two Δs are the need changes in the table's "If accepted" and "If not"
    columns. Rapport changes and moodlets aren't needs, so they don't enter. For example, Talk at p 0.8 advertises
    social 0.8 × 12 + 0.2 × 2 = 10. Joke at p 0.7 advertises fun 4.2 and social 5.6.
  - **The other terms** are an object's: affinity by tag (social → outgoing, Joke → playful, Challenge → competitive,
    Cheer together → fan); emotion; event; memory (+10 toward a shared highlight); walk, the path to the target or to
    the gap their group would open; occupancy, the group term above.
  - **Not scored this way:** an NPC's Buy a round follows its own rule ("Rules for rounds"), and staff aren't offered
    interactions by NPCs.
  - So friends score higher (friendship raises p), lonely people seek company (Lonely +20, and social's urgency), and
    playful people tell jokes (Joke's affinity).
- **The candidate rule.** One decision considers at most 8 people:
  - first everyone present with friendship 20 or more toward the decider, most friendly first;
  - then everyone within 8 m, or in the same zone (a zone in the "Inside" table, the patio or the front walk), nearest
    first.

  Staff and fillers aren't candidates. Each candidate offers at most 6 interactions: those whose "Offered when" holds,
  the 6 with the largest `Σ m_k·Δ_k(I, T)` if more hold.
- **The budget.** At most 6 decisions a frame, staggered. Each scores at most 89 adverts:
  - **objects: at most 41.** For each object type, only the instance with the nearest free slot is scored, once per
    advert. The catalogue has 41 adverts across its types: bar counter 4, booth 6, high-top 6, window rail 3, screens 1,
    standing floor 1, pool table 2, dartboard 1, shuffleboard 1, jukebox 1, water station 1, restroom 1, dance spot 1,
    patio table 7, patio rail 5. Overlays (table service, the counter's Order) count only for the object the person is
    already at.
  - **people: at most 48,** 8 candidates × 6.

  The target is under 0.4 ms for 6 decisions on desktop; it's unmeasured until S3a, which logs it.
- **The log.** `__onfoot.decisions(n)` returns the last n decisions: the NPC, the needs, and the top three with scores.
- **The watchdog.** No NPC may sit in one action, or fail to move toward its target, for over 60 sim seconds without a
  reason the log names. A stuck person is moved to the nearest free cell and plans again.

### Conversations and lines

Lot 57's group state machine carries over unchanged: formation, one speaker at a time, listeners turning, nods,
laughter as a group event, idles and mingling. The bar adds the interaction beats above, inside groups.

**Group sizes and places.** Groups are 2 to 6 people. They form at booths, high-tops, the bar and the patio, and in
standing circles by the screens and the games.

**The lines.** Short and original, written by us.
- About 120 lines in S3b (a starter set of 30 in S3a), growing to about 250, tagged by:
  - interaction and outcome;
  - topic: the match on screen, teams, pool, darts, food, cars and driving, the freeway, the weather, the week;
  - time of day and the game's simulated weather;
  - the player's state, and memory.
- They never mention real businesses, people, teams, leagues, events or live data.

A few:
- "Ref added three minutes. Three! Where'd he find three?"
- "Undertow can't hold a lead to save their lives. Watch."
- "Table two's free and I need someone to beat."
- "Wings are actually hot tonight. Get the lemon-pepper if you value your life."
- "You come off the 5? Katella's a parking lot this time of night."
- "Three darts, three different zip codes. Story of my life."
- "Shuffleboard's all touch. Don't muscle it."
- Joke: "My darts game is like my parking. Technically on the board."

**Speech is never voiced.** Captions carry the words, and the murmur is synthesised, as at Lot 57.

### Regulars, walk-ins and staff

- **Regulars.** A pool of 48 seeded regulars persists on the device.
  - Each has a look (people builder seed), a first name (from a list of 200 common first names; no surnames), traits, a
    team, favourites, and the days and hours they come.
  - Friend groups of 2 to 5 arrive together.
  - The player's friendships with regulars carry over between visits, so the bar remembers you.
- **Walk-ins** fill the rest of the crowd and are forgotten when they leave.
- **Arrivals.** Parties of 1 to 6 walk in from the courtyard lot, or are dropped at the front aisle. Each arrival plans
  its first action (order, find seats, join friends); after that the utility AI takes over. Stays are log-normal, with
  a median of 80 minutes.
- **Staff,** in the house uniform, run on a job queue rather than needs. Their numbers depend on the crowd share s:

  | Staff | Count | What they do |
  | --- | --- | --- |
  | Bartenders | 2 when s < 0.35, 3 under 0.7, else 4 | Serve the counter first come first served: make 4–8 s, hand over. Idles: wipe and polish. |
  | Servers | 1 when s < 0.3, 2 under 0.65, else 3 | Visit tables seated more than 4 min without an order: take the order (8 s), send the ticket, pick up at the pass or the bar, deliver, bus empties. |
  | Host | at the door when s ≥ 0.6, from the start of the featured match's ×1.25 window to its end, and through `gameNight` (all three under "The featured match") | Greets at the door. |
  | Barback | when s ≥ 0.5 | Collects empties. |
  | Cooks (2) | unseen | Hands and plates at the pass. |

  - **Budgets, not the crowd.** Staff count toward the render budgets, not the crowd.
  - **Up to 9 are seen** at HD and Ultra.
  - **On Low, at most 5 are drawn:** 2 bartenders, 2 servers and the host. There's no barback; the bartenders collect
    the empties. Service keeps its timings, so the counter's queue just runs longer.

### The simulated crowd

Target crowd = capacity (130) × the curve below × events × weather × seeded noise (±10%, from the venue's seed, the
weekday and the hour, as Lot 57's clock computes it). Capped at 1.0. Parties arrive at random (Poisson), stay, and leave, so the room converges on the target.

| Hours | Mon–Thu | Fri | Sat | Sun |
| --- | --- | --- | --- | --- |
| 09–11 | closed | closed | 20% | 25% |
| 11–14 | 25% | 30% | 35% | 45% |
| 14–17 | 15% | 25% | 50% | 60% |
| 17–20 | 45% | 70% | 80% | 65% |
| 20–23 | 40% | 90% | 95% | 35% |
| 23–24 | 20% | 75% | 80% | 15% |
| 24–26 (00–02 the next morning) | closed | 45% | 50% | closed |

**The last row belongs to the evening before.** The 24–26 band is 00:00 to 02:00 of the next calendar day, counted in
the column of the business day that opened that evening:
- Friday's 45% is Saturday 00:00 to 02:00.
- Saturday's 50% is Sunday 00:00 to 02:00.
- Sunday and Monday to Thursday close at 24:00, so their columns read "closed".

The `Schedule` writes it that way: Friday and Saturday's hours are `[11, 26]` and `[9, 26]`.

- **Fictional events:**
  - **The featured match** on the big screen: ×1.25, from 30 minutes before its kick-off to its final whistle, one
    window a day at the times in "The featured match" (none on Tuesday). Its times come from the TV schedule, so the bar
    supplies it through `crowdShare`'s `extra` hook (`tv.featuredFactor`), not as a fixed event.
  - **Tuesday house darts league,** 19:00 to 22:00: ×1.15.
  - **Wednesday pool tournament,** 19:00 to 22:00: ×1.10.

  None of these is tied to a real game, team or calendar.
- **Weather (the game's simulated weather):** in rain the patio closes and its people move inside (×0.95 overall); fog
  ×0.95.
- **How many you see is the target.** The guests in the room always add up to the target, so a Packed night looks
  packed on a phone too. They come in two tiers:
  - **Live people:** simulated and animated, up to the preset's cap, staff included. The cap is 36 at Low (at most 5
    staff), 70 at HD and 100 at Ultra. All of them are simulated wherever the camera is; how they're drawn depends on
    where the camera is (see "Inside, outside and overhead"): from outside the unit, only the nearest 12, 24 or 40 are
    meshes and the rest are cards.
  - **Fillers** make up the rest (next).
- **On screen:** the chip, always visible, reads "Simulated crowd · Lively" (Quiet, Easy, Lively, Packed). Tapping it
  says: "Stoppage Time is a fictional sports bar. The crowd, the matches on the screens and the people here are
  simulated from the time of day and the day of the week. Nothing here is live, and nobody here is a real person or
  another player." No head count is ever shown.

### Fillers

Fillers are guests with no simulation. Lot 57's plan uses 40 impostors on Low for the same job.
- **What they are.** Each one sits in a free seat or stands at a free standing spot, posed seated or standing and facing
  the slot's way.
  - They have no needs, no AI, no identity and no interactions.
  - They're never regulars and never anyone the player has met.
- **How they're drawn.** One `InstancedMesh` of camera-facing quads (2 triangles each), with blob shadows in the shared
  instanced blob mesh.
  - **The atlas.** Its cells come from 8 seeded people at LOD 2, each in 3 poses (seated, standing, cheering), rendered
    from 8 directions at load (192 cells).
  - **Atlas size.** At Low it's a 1024 × 1024 render target with 48 × 96 px cells. At HD and Ultra it's 2048 × 2048
    with 96 × 192 px cells.
  - **Per instance:** the position, the facing, the look and the pose. The shader picks the direction cell from the
    camera's bearing.
  - **The cost** is 1 draw call for all of them, 2 triangles each, plus their blobs.
  - **Building it.** The atlas is rendered in idle slices after the first frame, from bodies in the preset's own look.
    At Low its 8 LOD 2 bodies are toon-styled first (`retro.restyle()` on them, under the same lights), so the cards
    match the toon people; the cards' own material is a shader material, which the Stylizer leaves as it is, and
    `RetroPass` then grades cards and people alike. At HD and Ultra the bodies keep their standard materials. Switching
    to or from Low renders the atlas again. Until it exists, fillers aren't shown.
- **Cards for live people.** From outside the unit, live people past the preset's mesh count (see "Inside, outside and
  overhead") are drawn as cards in this same mesh, each with the atlas look nearest its colours, posed by what it's
  doing. They keep their simulation. Through the glazing at a distance, a card reads as a person.
- **Where they go.** Fillers take free slots at least 6 m from the player at Low and 9 m at HD and Ultra (the
  budget's `fillerMinM`). In the overhead view, that distance is measured from the camera's target.
  - A table is all live or all fillers, never mixed.
  - No fillers go on the patio when it's closed for rain.
  - How many: `fillers = min(target guests - live guests, free eligible slots)`.
- **When you come near.** When the player comes within that distance of a filler's table or spot, or taps a filler,
  that table or spot is handed to live guests. A booth, high-top or patio table moves as one unit of 4; a stool or a
  standing spot moves on its own.
  - **The new guests** are walk-ins, made in the same frame from a pool of 6 pre-built spare bodies (LOD 2).
  - **If that would pass the live cap,** the farthest table of live walk-ins is demoted to fillers first, and their
    bodies join the pool. That table must be seated and idle, with no regulars and nobody the player has met.
  - **The swap** happens on a frame when the slot is off screen, or at the distance if it's still on screen.
  - A tapped filler's menu opens once the swap is done.
- **Reactions.** On a goal or a touchdown, each filler who can see a screen on that channel switches to the cheering
  cell for 1.5 s, with p 0.4, after a staggered 0.2 to 0.7 s.
- **The chip** reads the target's level, and the room shows it.

### Tokens and saving

**Tokens are house tokens.**
- **Earned:**
  - 50 on your first visit;
  - 5 per game won;
  - 2 for a first good conversation with someone new;
  - 1 per 5 minutes in the bar (at most 12 a visit);
  - 5 for each of tonight's three (below).
- **Tonight's three.** Each visit draws three goals, seeded by the date and the visit, from a list of about 12, so
  needs aren't the only reason to do things. For example:
  - win a game of darts;
  - toast a goal with someone;
  - introduce two people;
  - buy a round;
  - make a regular laugh;
  - cheer a goal with three people;
  - watch a match to the final whistle;
  - land a 3 at shuffleboard;
  - pot two balls in one pool turn;
  - order your favourite.

  They show once on the way in and on a small card in the pause menu. They're optional, with no timer and nothing to
  fail.
- **Spent** only on rounds.
- **Never bought, never exchanged.** No purchase path and no exchange for the game's Credits; the owner decides that
  when the bar joins the game (open decision).
- **Never staked** on anything.
- **The label** says: "House tokens are part of the game. They can't be bought and have no cash value."

**Saving.**
- **What.** Tokens, the regulars' pool seed, friendships, memories and highlights, the player's team, and settings.
- **Where.** `localStorage` under `oc.onfoot.sportsbar.v1`. Every read and write is wrapped, and the page works without
  storage.
- **The label** says "Saved on this device only".
- **In the game later,** this moves into the profile through a migration, done by whoever owns `profile.ts`.

## Controls and UI

Everything Lot 57 teaches carries over: drag left to walk, drag right to look, tap to go, the one action button. The
bar adds the life-sim layer without adding a controls screen. The first visit shows one 6-second hint ("Tap people and
things to see what you can do"), after Lot 57's.

**Phone, landscape (844 × 390):**
- **Top left:** Car (in the game) or Exit (on the page). Below it, the action queue: up to 3 icons, 40 px; tap one to
  cancel it.
- **Top centre:** the needs strip.
  - Five 28 px rings with icons. Tap to open the panel: five labelled bars with the word, the number and the active
    moodlets.
  - The mood face and emotion sit beside it.
- **Top right:**
  - The view switch: first person, third person, overhead.
  - Pause.
  - The TV chip, which reads "On now: HBL 1–0 ARK · simulated" and opens the guide.
- **Bottom left:** the floating stick, as at Lot 57. It's hidden in overhead view.
- **Bottom right:** the 76 px action button and, when it fits, the second action. The big Cheer button takes this place
  for 8 s after a moment.
- **The radial menu:** up to 6 pills of 56 px on a 92 px circle round the tapped person or object, clamped on screen.
  Each label is a verb ("Play pool", "Toast", "Buy a round · 12 tokens").
- **A person's card** opens with a long press or the "i" in their menu. It shows:
  - first name, relationship level and bar, team if known, mood face;
  - their last memory with you, such as "You toasted Undertow's late winner together".
- **People here,** from the pause menu: everyone present you've met, sorted by friendship.
- **The always-visible chips:** "Simulated crowd · …" and the clock. The map credit sits in the corner of the pause menu
  and on the page's first screen.

**Phone, portrait (390 × 844):** the same pieces stacked.
- The needs strip goes under the top row and the TV chip moves into it.
- The radial menu shrinks to 48 px pills on an 80 px circle.

**Desktop:**
- WASD or the arrows to walk, Shift to jog outdoors, drag or pointer-lock to look.
- Click to go or open a menu. Keys 1 to 6 pick menu items.
- E for the action, Q for the second action.
- V cycles the views; O goes straight to overhead.
- Tab opens the needs panel, G the TV guide, C the car, Esc pauses.
- In overhead view: the wheel zooms, right-drag rotates, and Q and E rotate 45°.

**Gamepad:**
- Left stick to walk, right stick to look.
- A for the action, X for the second action. Y cycles the view, and B leaves or stands.
- LB opens the radial menu on the nearest person or object; the right stick picks the item.
- Back is the car.

**Autonomy for the player.** A setting, off by default: "Let my driver act on their own when idle". When it's on, after
25 s idle your avatar runs the utility AI with your traits: sits when tired, watches the featured match, joins friends.
Any input takes back control.

**Accessibility:**
- **Contrast.** All UI text is at least 4.5:1 on its backing.
- **Needs** are never colour-only.
- **Text** has three sizes.
- **Everything is captioned,** since there's no voice.
- **Reduced motion** turns off head bob, camera moves and the GOAL and TOUCHDOWN banner animations. The banners still
  appear, without motion.
- **One thumb.** The whole place is playable with one thumb through tap to go and the radial menu.

## Camera

- **First person** is the default, exactly as at Lot 57: eye height from your driver, a 1.5 cm head bob (off with
  reduced motion), seated eye 1.15 m. Pitch is limited to about 55° down and 45° up. It's wider in portrait.
- **Third person** is Lot 57's `Player.camera()`, unchanged: 2.4 m behind, 0.45 m right, 1.75 m up. Tall colliders
  pull it in, and the avatar fades within 0.7 m. Indoors, `BarPlayer.camera()` then keeps it under the 3.6 m ceiling:
  it pulls the camera toward the head, along the same line, until it's at most 3.3 m up. The look target doesn't
  change.
- **Overhead (the build view).** The classic life-sim camera, in the bar's own `engine/overhead.ts`. Lot 57's camera
  code isn't edited.
  - **Angles.** It looks down at 55° (adjustable 35° to 75°) from 8 to 35 m away.
  - **Moving it.** It rotates freely, or in 45° steps with Q and E or a two-finger twist. It pans with a one-finger
    drag, and pinch zooms. It's clamped to the bar, the patio and the lot.
  - **Walls.** Ceiling and roof are hidden. Walls cut away: any wall whose outward face is toward the camera drops to
    0.9 m, with a capped top edge. The far walls stay full height so the room still reads.
  - **What's on screen.** Tap to go and the radial menus are the controls here; the stick is hidden.
  - **Changing views** takes a 0.5 s move, or a cut with reduced motion.
  - **Arranging furniture is not part of S1 to S4** (see "Roadmap only").
- **Game cameras.** In pool, darts and shuffleboard, your turn moves the camera to the game's own view (above the table,
  behind the oche, behind the puck) and returns it afterwards. They're the bar's, in `venues/sportsbar/gamecams.ts`.
- **Watch.** After 20 s seated, or on a tap of Watch, the camera drifts slowly between the big screen, the liveliest
  group and the patio. Any touch ends it. It's Lot 57's behaviour with the bar's targets.

## Audio (all made in code)

| Sound | How |
| --- | --- |
| Room murmur | Lot 57's synthesised babble (filtered noise with moving formants), spatialised for the 4 nearest groups. Its level follows the head count. |
| Broadcast | A wordless "commentary" bed: a band-limited formant voice with pitch contours and no words. It rises and falls with match intensity. |
| Crowd reactions | Cheer: shaped noise bursts plus granular claps. Groan: a low formant swell. "Ooh": a rising swell. Level ∝ the number reacting. |
| Pool | Ball clicks by modal synthesis (2–4 kHz partials, 30 ms decay), the break as a cluster, cushion thuds, the pocket drop |
| Darts, shuffleboard | Dart thunk (low-passed noise plus a cork resonance). The puck's slide (a filtered noise sweep with speed) and its clack. |
| Bar and kitchen | Glass clinks (inharmonic partials), the pass bell, the fryer (noise), the ice scoop |
| Music | The jukebox plays the game's own KFWY 96.9 tracks, composed in code, through a speaker filter. It's louder on dance nights. |
| Outside | The I-5's hum from the freeway side (low-passed pink noise, rising at the patio). A faint 120 Hz transformer hum by the substation fence. Car doors in the lot. |
| Interface | Soft ticks for menus, a chime for moodlets, the rising spark |

- **Space.** The interior reverb is a code-made impulse response: 0.8 s of exponentially decaying noise, low-passed.
  The patio is drier.
- **Voices.** The cap is 12 on Low, 24 on HD and 32 on Ultra. HRTF panning on HD and Ultra; equal-power on Low.
- **Mix.** Separate volume sliders for the room, the screens, the music and effects.

## Graphics: Low, HD, Ultra

There are exactly three modes, as decision 15 (`PROJECT_OC_DECISIONS.md`, 2026-10-21) sets them for the game, Lot 57
and the bar alike. Low and HD are free; Ultra is an entitlement. In code they keep Lot 57's ids, `'low'`, `'high'` and
`'ultra'` (the `Quality` type in `lot57/mats.ts`); the pause sheet's buttons read Low, HD and Ultra.

- **Low: the Retro look, and the phone default.** It isn't a blurry fallback. It's drawn at full resolution and crisp:
  render scale 1, and the device's pixel ratio up to 2, never under 1. It's drawn through the game's shared Retro style
  module (`src/game/render/style.ts`, RS1 on `claude/modes`; see the module map). The game uses it, and Lot 57's P1d
  will, so the three share one look. The module has three parts:
  - **`Stylizer`** swaps each material for a cel-shaded toon material. It keeps the colour, map, emissive, vertex and
    instance colours and skinning. The light is two-tone, with a narrow mid band and a hard specular spot.
  - **`RetroSky`** draws flat colour bands from the fog's colour at the horizon up to the zenith, and a hard sun disc.
    It replaces only the game's realistic `Sky` (and hides the flare). The `Environment`'s cloud deck (alpha-cut to hard
    edges), its mountain ring and its stars stay, so Low's sky is 4 draws (see the budgets).
  - **`RetroPass`** is one full-screen pass. It does the tone map, a saturation lift, dark ink where the depth says
    there's an edge, and a limited palette with a 4 × 4 Bayer dither.

  Low is the default on a phone (a coarse pointer), the way Lot 57's page picks it. When RS3's style guide exists, the
  bar's Low follows it, and S4 checks against it.
- **HD: realistic.** This is Lot 57's High preset as read, renamed: realistic materials, bloom, the 2048 sun shadow map
  and 4 real lights.
- **Ultra: the maximum.** This is Lot 57's Ultra as read, plus whatever the Ultra graphics lane (`claude/gfx`) lands
  when it merges. It's an entitlement flag only, from RS2's shared entitlement: owner mode and the test build unlock it,
  as decision 15 says.
  - There's no real money anywhere: the page has no price and no purchase path.
  - A locked Ultra button reads "Ultra · locked" and opens nothing.
  - Test hooks can set Ultra in test builds.

The bar meets the maximum-graphics standard Lot 57's P1d sets, in each mode's own look:
- a sun and sky that follow the clock;
- emissive lights, with soft bloom at HD and Ultra, and budgeted shadow-casting lights at Ultra;
- baked ambient occlusion and light in vertex colours (Lot 57's `Batch.bake`, run by `Kit.finish`);
- materials made in code (canvas textures, normal maps from height);
- people lit with rim and fill at HD and Ultra, and toon-shaded at Low.

**Switching.** The modes switch through `setQuality` and the pause sheet, with frame ms and draw calls measured at
each. The shadow, post and light settings are the bar's `PRESET` copy (see the module map): Lot 57's High and Ultra as
read, and Low per decision 15. If P1d changes them, the copy follows at S4. Low's look needs the Retro module. Until
`claude/modes` merges into `claude/sports-bar`, Low draws with the standard materials at full resolution; S4 turns the
Retro style on.

| | Low (Retro, the phone default) | HD | Ultra (an entitlement) |
| --- | --- | --- | --- |
| Resolution | Full: render scale 1, pixel ratio up to 2 and never under 1 | Render scale 1, pixel ratio up to 2 | The same |
| Look | Retro: toon materials, ink outlines, a limited palette with dither, a banded sky | Realistic | Realistic, the maximum |
| Interior light | All fixtures baked into vertex colour from `Emitter`s (pendants, neon, screens, back bar, LED strip), then lit in two tones by the toon materials. Emissive surfaces. No real-time lights indoors. | Plus 4 real lights: the two pool pendants as spot lights, a TV-wall fill and the back bar | Plus a rect-area light for the TV wall glow and the back bar. The pool spots cast shadows. Up to 8 real lights. |
| Outdoor light | The sun and the Retro sky. Hard-edged blob shadows; no shadow map (see the budgets, and "Owner questions") | Sun shadows, 2048 map | 4096 map, soft PCF |
| Post | `RetroPass` only: one full-screen draw. No composer, no bloom, no MSAA | Bloom, and 4× MSAA on the render target | Plus GTAO |
| Materials | Toon versions of the standard materials. 512 px textures: near-uniform ones flattened to their average colour, the rest posterized (the module's `'auto'`) | 1024 px. A reflection cube baked once at load from the interior, for wood, brass and glass. | Clearcoat on the bar top and pool rails. Sheen on booth vinyl and cloth. 16× anisotropic filtering. |
| Screens | 512 × 288 at 8 Hz, then through the palette like everything else | 1024 × 576 at 15 Hz | 1024 × 576 at 30 Hz |
| People | Toon-shaded, at the LODs in "Inside, outside and overhead" | The same rule, at high quality | The same rule, at high quality |
| Details | Neon as emissive tubes | Plus soft light cones under the pool pendants | Plus dust in the pendant cones, and the freeway's light streams in full |

**Lighting design.**
- **Inside.** Warm 2700 K pendants over the pool tables and high-tops, a cool lime LED strip under the bar's lip, the
  coral neon "+3", and the TV wall's moving light washing the standing area.
- **Outside.** The patio pergola's warm linear lights and the night-violet facade, with the lime halo on the letters.
- **Beyond.** From the patio at night, the I-5's traffic: instanced headlight and tail-light pairs moving along the
  freeway's centrelines from the slice. They're cheap, the best backdrop the site has, and they say "driving game"
  without a word.

**Materials.**
- **Floors and wood:** polished concrete with faint aggregate and the chalk inlay; oak with grain.
- **Booths:** coral vinyl with tufting from the normal map.
- **Games:** night-violet cloth with a nap; boards with sisal fibre.
- **Steel and glass:** brushed brass rails, black steel, glass with the room reflected.
- **Outside:** stucco and painted block for the host building, worn asphalt with oil spots and our stall striping,
  agave in planters.

## Phone performance budgets

These are targets. Draw calls and triangles can be measured here (`renderer.info`). Frame rate can't: SwiftShader
says nothing about a phone, and the fill-rate cost of Low's full resolution can only be measured on a phone. The
interior is the hard part for phones: everyone in the room is within 30 m, so distance culling helps less than at
Lot 57.

**What's counted.** `renderer.info` adds up every pass in a frame, so `stats()` reports two things:
- **`pass`** is the scene drawn once from the camera. The hook measures it with one plain
  `renderer.render(scene, camera)` between `info` resets, with the shadow maps not updating and no composer. At Low
  that's the same scene `RetroPass` renders into its target.
- **`frame`** is the whole frame, as Lot 57's `stats()` reports it. It adds the shadow maps, GTAO's normal pass at
  Ultra (which draws the scene again), the post quads, and at Low `RetroPass`'s one full-screen draw.

### What things cost

These are measured unless they're marked. The people rows are Lot 57's measurements (`PROJECT_OC_ON_FOOT.md`, 14
October). The car rows were measured on 2026-10-21 (see "How these numbers were measured"). NPCs aren't instanced:
each LOD 1 or LOD 2 person is its own draw call, and a LOD 0 person is 17 to 20.

| | Low (phone quality) | HD and Ultra (high quality) |
| --- | --- | --- |
| A person at LOD 0 | 71k triangles, 17 calls | 150k to 210k, 17 to 20 calls; budgeted at 210k and 20 |
| LOD 1 | 7.5k, 1 call | 11.6k, 1 call |
| LOD 2 | 1.5k, 1 call | Not measured. **Assumed** 1.5k and 1 call, as on phone |
| Fillers, cards for live people, and every blob shadow | 2 triangles each, in 2 calls for all; budgeted at 0.5k | The same |
| Your car: `yourCar`, `buildCar` with the full cabin, at the preset's people quality, as Lot 57's page builds it | The GT (the default) is 62.2k in 25 meshes. The heaviest of the four drivable cars, the Corsa, is 65.6k in 26. **Budgeted at 65.6k and 26 calls.** A shell cabin would save only 7.0k. | The GT is 118.3k in 25; the Corsa 121.1k in 26. **Budgeted at 121.1k and 26 calls.** |
| Your car's stand-in (ours) | 152 triangles, 1 call | The same |
| A detailed parked car: `ParkedCars`, built at `'phone'` on every preset, as Lot 57's page builds it | 2.87k (2.88k for the pickup), in 4 instanced parts. Up to 20 calls for the 5 kinds, however many cars there are. | The same, because Lot 57 builds them at phone quality on every preset. At high quality one would be 5.58k. |
| A parked stand-in | 152 triangles; 1 call per kind, up to 5 | The same |
| Parked cars in all | At most 61: the stall estimate's 62, less yours | The same |
| What a car puts into the sun's map | No map at Low | A detailed parked car's paint and trim, 2.69k (budgeted 2.70k); your car whole; a stand-in whole |

**The allocations (ours; S1 measures them).** The bar's own building and the streets aren't built yet, so they're
allocations. The street rows stand on `tools/anaheim/sportsbar_sets.py`'s estimate, with headroom; Low's sky row is
counted from the code:

| | Low | HD | Ultra |
| --- | --- | --- | --- |
| The venue: our unit inside and out, the rest of building 61 as massing, the patio, the front walk, the lot's surface and stall paint, the pole lights and the signs | 40 calls, 50k | 50 calls, 90k | 60 calls, 150k |
| The near streets: what the glazing can show. Every feature, on every layer, with any part in the glazed sectors (beyond the line of the front wall or of the south wall) within 150 m of the unit's centre, frame (18, 8). Counted by `tools/anaheim/sportsbar_sets.py`: 34 of the 614 street pieces left once `dropSegs` drops seg 416, 5 of the 425 buildings besides building 61, 25 of the 205 infrastructure shapes, 26 of the 536 infrastructure points, and none of the 67 land-use or 18 water areas. Among them: both I-5 carriageways (seg 362 and 560, 99 m and 105 m away at their nearest) and the I-5 links 360, 361, 425, 561 and 562; the Katella bridge (infra 92, 6,350 m²); East Katella (135, 355, 423, 426) and Anaheim Way; South Claudina Way (391, its main leg, 411 and 417); the substation across the street (infra 167, 7,272 m²) with its two transformers and the power lines; and 12 power poles, the four along Claudina Way at x -6605 among them. Plus the I-5 light streams: two instanced quad meshes, a quad per car's head or tail lights, for 100 cars at Low, 200 at HD and 400 at Ultra (0.4k, 0.8k and 1.6k; ours). The script estimates the rest at 6.7k triangles in 11 batches, so 13 calls with the streams. | 14 calls, 10k | 14 calls, 15k | 15 calls, 25k |
| All the streets: the near set and the far set, which is the rest of the slice (580 street pieces, 420 buildings, 180 infrastructure shapes, 510 points, and all the land use and water), plus our own street trees. At Low and HD the far set is drawn simple: buildings as plain walls and roofs, flat sidewalks, no markings or crosswalk paint, fences without posts, and of the point props only the poles, towers, signals and lamps. At Ultra it's drawn in full. The script estimates the far set at 24.9k in 11 batches simple and 63.9k in 14 in full, so all the streets at 31.9k at Low, 32.3k at HD and 72.2k at Ultra, with the streams. | 25 calls, 35k | 30 calls, 60k | 40 calls, 120k |
| The sky | `RetroSky` (a 32 × 16 sphere, 960 triangles, the sun disc in its shader) and what the game's `Environment` keeps under `RetroStyle`: the cloud deck (1,488 triangles, alpha-cut), the mountain ring (512) and the stars (points). 4 calls, 3.0k (2,960) | The game's sky, sun and flare: 4 calls, 5k | 4 calls, 5k |
| Each of Ultra's two pool spots: its table and lamp | | | 4 calls, 6k |

### Held items, table items and game pieces

The small things that move: drinks and baskets in live people's hands, plates, glasses and empties on the tables,
servers' trays, the pool balls and cues, the darts and the shuffleboard pucks.
- **Instanced.** One `InstancedMesh` per item model. Each frame every instance's matrix is set from its holder's hand
  bone or from its slot, and `count` is the number in use. One model serves several items by its scale (a disc is a
  plate, a tray or a puck; a stick is a cue or a dart), and colour is per instance. Drawn as one mesh per item instead,
  the 36 live people at Low inside would add about 36 calls against that column's margin; instanced, all of them cost
  6 calls.
- **Who shows them.** Items in hands are drawn only for people drawn as meshes; a card shows none.
- **Shadows.** At HD and Ultra they cast into the sun's map outside and overhead. Inside, `visibility.ts` turns their
  `castShadow` off, as it does the cars'. They aren't in the pool spots' maps.
- **The sums** count every model at its cap, since an instanced mesh is drawn whole when its bounding sphere is in
  view.

| Model (ours: the triangles are allocations, measured in S2a and S2b) | Cap | Low | HD and Ultra |
| --- | --- | --- | --- |
| Glass: drinks in hands and on tables, and the empties | 132, a place each | 20 | 40 |
| Basket: food in hands and on tables | 40 | 24 | 48 |
| Disc: plates and empty plates (40), servers' trays (6), shuffleboard pucks (8) | 54 | 16 | 32 |
| Ball: the pool balls on both tables, coloured per instance | 32 | 32 | 128 |
| Band: the striped balls' bands, 7 a table | 14 | 16 | 32 |
| Stick: cues (8) and darts (18) | 26 | 12 | 24 |
| **All six at their caps** | 298 | **6 calls, 6.0k** | **6 calls, 14.1k** |

### Inside, outside and overhead

three.js skips only what's outside the camera's view, and only object by object. That leaves three problems:
- the parked cars are instanced meshes with one bounding sphere round the whole lot;
- the street batches span the slice;
- Lot 57's page starts you at your car's door.

Without a rule, whenever the lot is in view every car is drawn, and from outside every live person in the room is drawn
too. So `venues/sportsbar/visibility.ts` decides what's drawn (the module map's row; it becomes `engine/visibility.ts`
at E0). It works from three states:
- **Inside:** first or third person, with the camera inside the unit (`def.indoor` at the camera's frame position, below
  the ceiling). The patio counts as outside: `def.indoor` is false there.
- **Outside:** first or third person anywhere else.
- **Overhead:** the overhead view, wherever its target is.

The state changes on the frame the camera crosses the front door's line or the patio door's. A swap there is a
one-frame change at a distance. S1 takes screenshots on both sides of each door to look for it.

| | Inside | Outside | Overhead |
| --- | --- | --- | --- |
| Live people drawn as meshes | All of them (the live cap), at their LODs | The nearest to the camera, inside the unit or out: Low 12, HD 24, Ultra 40. Everyone else is a card (see "Fillers"). | All of them, at their LODs |
| LOD 0 | Low 1 (the person you talk to); HD 1 (that person, else your avatar in third person); Ultra 2 (both) | Low none: the person you talk to stays at LOD 1, as while their LOD 0 builds. HD 1, Ultra 2, as inside. | None: the camera is 8 to 35 m away, and the person you talk to stays at LOD 1 |
| LOD 1 (the nearest, after LOD 0) | Low 6, HD 16, Ultra 40 | Low 7 (the person you talk to and 6 more), HD 6, Ultra 18 | Low 6, HD 16, Ultra 40, nearest the target |
| Parked cars (`parked.near`) | All stand-ins (0) | Detailed: Low 4, HD 12, Ultra 36; the rest stand-ins | Low 0; HD 12; Ultra 36 |
| Your car | Its stand-in, except at Ultra (detailed) | Detailed | Its stand-in at Low; detailed at HD and Ultra |
| Streets | The near set only | All | All |
| What casts into the sun's map (HD and Ultra; Low has no map) | The venue's casting batches and the near streets. No cars, no items, and no people, your avatar included (`visibility.ts` turns the cars' and items' `castShadow` off). | The venue, all streets, your car, the parked cars, the items, and the people outside the unit nearest the camera: HD 6, Ultra 20, with their LOD 1 bodies | As outside, with the people nearest the target |
| Ultra's pool spots | They update: their table, its lamp, and the people within 2 m (with LOD 1 bodies) | Frozen (`shadow.autoUpdate = false`): the room is seen only through glass | They update |

- **A LOD 0 person casts with their LOD 1 body.** It's kept on layer 1, which the sun's shadow camera sees and the main
  camera doesn't. Lot 57's page already does this for your first-person body. So a LOD 0 is never drawn into a shadow
  map.
- **Your avatar in third person** counts as one of the people at LOD 0 or LOD 1. In first person it's on layer 1: at HD
  and Ultra it casts only outdoors, and at Low there's no map for it to cast into.
- **No LOD 0 outdoors at Low** is the price of your car on screen: the two don't fit Low's budget together (71k plus
  65.6k). Indoors, your car is a stand-in, and the person you talk to gets their LOD 0.
- **`def.budgets`** holds these numbers (`drawn`, `cars` and `castPeople` in `Budget`).

**Where the page starts you.** By your car's driver door in your courtyard stall, 0.2 m out (turned with the stall,
as the module map's `lot.ts` row computes it for stalls facing 0 or π), in first person, looking
toward the unit's north-east corner, where the walk to the door turns. That's Lot 57's spawn, with the bar's stall. It's
the outside state, so the first frame falls under the outside column, and the `stall` pose below is its worst case. The
URL's `at`, `yaw`, `pitch` and `view` work as on Lot 57's page.

### The budget poses

Every budget check names one of these poses: S1 without people, S3a, S3b and S4 with them. The bar's `pose(name)` hook sets
each one, using the `go`, `look`, `view` and overhead hooks underneath. Positions are in the building frame (u, v) and
game (x, z), in metres. The eye height is your driver's (Lot 57's `eyeHeight`), and third person is Lot 57's camera.

| Pose | State | View | Where | Looking at |
| --- | --- | --- | --- | --- |
| `door` | inside | first person | Just inside the front door: frame (5.0, 8.2), game (-6617.6, -9343.3) | The big screen's centre, 2.2 m up: frame (35.8, 4.75), game (-6647.1, -9353.0) |
| `tv-east` | inside | third person | The standing floor: frame (33.5, 4.75), game (-6645.0, -9352.0) | The front door, 1.5 m up: frame (3.6, 8.2), game (-6616.4, -9342.8) |
| `stall` | outside | third person | The spawn, by your car's driver door (`yourCar().door`; the stalls are S1's layout) | The unit's north-east corner, 1.5 m up: frame (6.4, 16.5), game (-6615.5, -9351.5) |
| `patio` | outside | third person | The patio's east end: frame (3.0, -2.75), game (-6620.4, -9332.5) | West along the patio, 1.0 m up: frame (20.0, -2.75), game (-6635.8, -9339.6) |
| `overhead` | overhead | overhead | The target is the unit's centre, frame (18, 8), game (-6629.6, -9348.6). The camera is 35 m away at 55° down: 28.7 m up, over frame (18, -12.1), game (-6637.9, -9330.3). | The target. The camera faces along +v, north-north-east. |

**Every pose runs under the same conditions:**
- **Clock and weather.** Saturday 21:00 (`setClock('Sat', 21)`), clear. The crowd target is then 130 × 0.95 × the noise
  (0.9 to 1.1), capped at 130: 111 to 130 guests, over every preset's live cap. It's in `gameNight`, after the featured
  match.
- **Seeds.** `setWeek(43)` for the TV schedule, `seed(1)` for the crowd and the regulars, and the parked cars' fill seed
  621 (Lot 57's day × 100 + hour).
- **The live cap reached.** `fastForward(30)`, then `people().live` equals the preset's cap. For `stall` and `patio`,
  `crowdAt('outside', n)` then seats walk-ins on the patio and the front walk until the preset's outside mesh count (12,
  24 or 40) are outside the unit.
- **Screen sizes.** 844 × 390; also 390 × 844 for `door` and `overhead`, because portrait's 78° field of view sees more.
- **Presets.** Low, HD and Ultra, through `setQuality`.

A state's column below is the worst case over its poses. Any pose that measures over its column fails the check.

### The sums

Each sum assumes every live person in the state's count is in view, every stall is full and every item model is at its
cap. Every column passes its own
budget. The sums add the unrounded figures (61 stand-ins are 9,272 triangles, for instance), so re-adding the rounded
ones can come out 0.1k higher.

**Low** (Retro, phone quality). The pass and the frame both have 150 calls and 250k triangles.

| | Inside (`door`, `tv-east`) | Outside (`stall`, `patio`) | Overhead (`overhead`) |
| --- | --- | --- | --- |
| People as meshes | 36: LOD 0 1 (17 calls, 71k); LOD 1 6 (6, 45k); LOD 2 29 (29, 43.5k) | 12: LOD 1 7 (7, 52.5k); LOD 2 5 (5, 7.5k) | 36: LOD 1 6 (6, 45k); LOD 2 30 (30, 45k) |
| Fillers, cards and blobs | 2, 0.5k | 2, 0.5k | 2, 0.5k |
| Held items, table items and game pieces | 6, 6.0k | 6, 6.0k | 6, 6.0k |
| Parked cars (61) | 61 stand-ins: 5, 9.3k | 4 detailed (11.5k) and 57 stand-ins (8.7k): 25, 20.2k | 61 stand-ins: 5, 9.3k |
| Your car | Stand-in: 1, 0.2k | 26, 65.6k | Stand-in: 1, 0.2k |
| The venue | 40, 50k | 40, 50k | 40, 50k |
| Streets | Near: 14, 10k | All: 25, 35k | All: 25, 35k |
| Sky | 4, 3.0k | 4, 3.0k | 4, 3.0k |
| **Pass** | **124 calls, 238.4k** | **140 calls, 240.3k** | **119 calls, 193.9k** |
| Without people or items (S1's check) | 64 calls, 72.4k | 120 calls, 173.8k | 75 calls, 97.4k |
| Margin against 150 and 250k | 26 calls, 11.6k (4.6%) | 10 calls, 9.7k (3.9%) | 31 calls, 56.1k (22.4%) |
| `RetroPass`'s full-screen draw | 1 call | 1 call | 1 call |
| Shadow maps | None (an owner question: see "Owner questions") | None | None |
| **Frame** | **125 calls, 238.4k** | **141 calls, 240.3k** | **120 calls, 193.9k** |
| Margin against 150 and 250k | 25 calls, 11.6k (4.6%) | 9 calls, 9.7k (3.9%) | 30 calls, 56.1k (22.4%) |

**HD** (high quality). The pass has 350 calls and 700k triangles; the frame 500 calls and 1.1M.

| | Inside | Outside | Overhead |
| --- | --- | --- | --- |
| People as meshes | 70: LOD 0 1 (20, 210k); LOD 1 16 (16, 185.6k); LOD 2 53 (53, 79.5k) | 24: LOD 0 1 (20, 210k); LOD 1 6 (6, 69.6k); LOD 2 17 (17, 25.5k) | 70: LOD 1 16 (16, 185.6k); LOD 2 54 (54, 81k) |
| Fillers, cards and blobs | 2, 0.5k | 2, 0.5k | 2, 0.5k |
| Held items, table items and game pieces | 6, 14.1k | 6, 14.1k | 6, 14.1k |
| Parked cars | 61 stand-ins: 5, 9.3k | 12 detailed (34.6k) and 49 stand-ins (7.4k): 25, 42.1k | As outside: 25, 42.1k |
| Your car | Stand-in: 1, 0.2k | 26, 121.1k | 26, 121.1k |
| The venue | 50, 90k | 50, 90k | 50, 90k |
| Streets | Near: 14, 15k | All: 30, 60k | All: 30, 60k |
| Sky | 4, 5k | 4, 5k | 4, 5k |
| **Pass** | **171 calls, 609.1k** | **186 calls, 637.9k** | **213 calls, 599.4k** |
| Without people or items (S1's check) | 74 calls, 119.4k | 135 calls, 318.2k | 135 calls, 318.2k |
| Margin against 350 and 700k | 179 calls, 90.9k (13.0%) | 164 calls, 62.1k (8.9%) | 137 calls, 100.6k (14.4%) |
| The sun's 2048 map | The venue (50, 90k) and the near streets (14, 15k): 64, 105k | The venue (50, 90k), the streets (30, 60k), your car (26, 121.1k), the parked cars (15, 39.8k), 6 people (6, 69.6k) and the items (6, 14.1k): 133, 394.6k | As outside: 133, 394.6k |
| Post (bloom and the output pass) | About 15 calls | 15 | 15 |
| **Frame** | **250 calls, 714.2k** | **334 calls, 1,032.5k** | **361 calls, 994.0k** |
| Margin against 500 and 1.1M | 250 calls, 385.9k (35.1%) | 166 calls, 67.5k (6.1%) | 139 calls, 106.0k (9.6%) |

**Ultra** (high quality). The pass has 600 calls and 1.5M triangles; the frame 1,400 calls and 3.6M.

| | Inside | Outside | Overhead |
| --- | --- | --- | --- |
| People as meshes | 100: LOD 0 2 (40, 420k); LOD 1 40 (40, 464k); LOD 2 58 (58, 87k) | 40: LOD 0 2 (40, 420k); LOD 1 18 (18, 208.8k); LOD 2 20 (20, 30k) | 100: LOD 1 40 (40, 464k); LOD 2 60 (60, 90k) |
| Fillers, cards and blobs | 2, 0.5k | 2, 0.5k | 2, 0.5k |
| Held items, table items and game pieces | 6, 14.1k | 6, 14.1k | 6, 14.1k |
| Parked cars | 61 stand-ins: 5, 9.3k | 36 detailed (103.8k) and 25 stand-ins (3.8k): 25, 107.6k | As outside: 25, 107.6k |
| Your car | Detailed: 26, 121.1k | 26, 121.1k | 26, 121.1k |
| The venue | 60, 150k | 60, 150k | 60, 150k |
| Streets | Near: 15, 25k | All: 40, 120k | All: 40, 120k |
| Sky | 4, 5k | 4, 5k | 4, 5k |
| **Pass** | **256 calls, 1,296.0k** | **241 calls, 1,177.1k** | **263 calls, 1,072.3k** |
| Without people or items (S1's check) | 110 calls, 310.4k | 155 calls, 503.7k | 155 calls, 503.7k |
| Margin against 600 and 1.5M | 344 calls, 204.0k (13.6%) | 359 calls, 322.9k (21.5%) | 337 calls, 427.7k (28.5%) |
| The sun's 4096 map | The venue and the near streets: 75, 175k | The venue (60, 150k), the streets (40, 120k), your car (26, 121.1k), the parked cars (15, 101.0k), 20 people (20, 232k) and the items (6, 14.1k): 167, 738.2k | As outside: 167, 738.2k |
| The two pool spots | Each: its table and lamp (4, 6k) and up to 8 people's LOD 1 bodies (8, 92.8k). Both: 24, 197.6k | Frozen: 0 | 24, 197.6k |
| GTAO's normal pass (the pass again) | 256, 1,296.0k | 241, 1,177.1k | 263, 1,072.3k |
| Post (bloom, GTAO's three passes, output) | About 20 calls | 20 | 20 |
| **Frame** | **631 calls, 2,964.6k** | **669 calls, 3,092.5k** | **737 calls, 3,080.5k** |
| Margin against 1,400 and 3.6M | 769 calls, 635.4k (17.7%) | 731 calls, 507.5k (14.1%) | 663 calls, 519.5k (14.4%) |

The post quads are an estimate from three.js 0.160's passes; S4 measures them. They're 2 triangles each.

**Who is at which LOD:**
- **The person you start talking to** stays at LOD 1 until their LOD 0 is ready. A LOD 0 build takes seconds: 4.6 s at
  phone quality and 7 to 9.5 s at high quality, on a desktop CPU, in one synchronous call, so as the builder stands it
  stalls the page for that long (see "Owner questions").
- **Your avatar's LOD 0** at HD and Ultra is built when you first switch to third person, as Lot 57's page does.
- **Phone LOD 0.** Lot 57's plan records it as 18% over its 60k target. If the people builder reaches that target,
  Low's inside column gains 11k.

**If a measurement comes in over** (S1 for the allocations, S3a, S3b and S4 with people), each preset gives back in this
order. The change goes into the def's budgets and into this plan.
- **Low, inside:**
  1. LOD 1 from 6 to 4 (12k);
  2. the near set's road markings and crosswalk paint dropped (4.0k, by the script's estimate);
  3. the person you talk to stays at LOD 1, as outside (63.5k and 16 calls).

  Together they free about 79.5k and 16 calls beyond the column's 11.6k margin.
- **Low, outside:**
  1. `parked.near` from 4 to 0 (10.9k and up to 20 calls);
  2. LOD 1 from 7 to 4 (18k);
  3. the far set's poles, towers, signals and lamps dropped (5.3k, by the script's estimate);
  4. your car as its stand-in when the camera is over 15 m from it (65.4k and 25 calls). This doesn't help at
     `stall`.
- **HD:**
  1. `parked.near` from 12 to 6 (16.4k in the pass, 15.3k in the sun's map);
  2. LOD 1 outside from 6 to 4 (20.2k);
  3. the people casting into the sun's map from 6 to 3 (34.8k of the frame).
- **Ultra:**
  1. `parked.near` from 36 to 16 (54.6k in the pass, 51.0k in the sun's map);
  2. LOD 1 outside from 18 to 10 (80.8k).

**What casts shadows** is the table's row under "Inside, outside and overhead". Indoors, people's contact shadows are the
blobs. Ultra's pool spots render only their table, its lamp and the people within 2 m of it.

### Everything else

| Budget | Low | HD | Ultra |
| --- | --- | --- | --- |
| Real-time lights | Sun only (on the patio) plus hemisphere | Plus 4 | Plus 8, 2 shadowed spots |
| Shadow maps | None: hard-edged blob shadows | The sun's, 2048 | The sun's, 4096, and the two pool spots |
| Canvas textures | 14 or fewer at 512 px (3 screen channels included) | 20 at 1024 | 20 at 1024 |
| Filler atlas (a render target) | 1024 × 1024 | 2048 × 2048 | 2048 × 2048 |
| Render targets for the look | `RetroPass`'s half-float colour target with a depth texture, at full resolution | The composer's | The composer's, plus GTAO's |
| Simulation CPU per frame (needs, AI, crowd, paths, matches, fillers, visibility) | Under 2.5 ms on a mid phone (unmeasured) | Under 3 ms | Under 4 ms |
| Utility AI | 6 decisions a frame, under 0.4 ms on desktop (a target) | Same | Same |
| Audio voices | 12 | 24 | 32 |
| Street data in the page | `sportsbar-slice.json`, 47 KB gzipped (measured) | Same | Same |
| Code added (the bar and `engine/sim/`) | Under 180 KB minified | Same | Same |
| First frame you can walk | Under 6 s on desktop (an estimate), then people build in the background | Same | Same |

**People are slow to build.** Lot 57 measured 30 people at about 15 s on a desktop CPU. Each build is one synchronous
call: 0.29 s at LOD 2 and 0.71 s at LOD 1 at phone quality, and 4.6 s for a phone LOD 0, on a desktop CPU.
- The page builds 8 people before the first frame. After it, one person per idle callback (`requestIdleCallback`, or a
  0 ms timeout where that's missing), never two in one callback, and only after a frame that took under 20 ms, so
  builds never run back to back. LOD 2 first, upgrading as people come near. The 6 spare bodies that fillers hand
  over to come from the same queue.
- That limits how often a build lands, not how long it takes: each is still a stalled frame of 0.29 s or more on a
  desktop, and longer on a phone. S3a logs the longest frame while the room fills. Removing the stall needs a build
  in a worker, or a builder that yields between steps, in `people/`, which the bar doesn't edit before E0; it's an
  owner question (see "Owner questions").
- Leaving guests' bodies are reused for arrivals, with new colours and accessories where the builder allows.

## Honesty labels and checks

| Where | Text |
| --- | --- |
| Crowd chip | "Simulated crowd · Lively" (always visible on foot) |
| Chip, tapped | "Stoppage Time is a fictional sports bar. The crowd, the matches on the screens and the people here are simulated from the time of day and the day of the week. Nothing here is live, and nobody here is a real person or another player." |
| Every screen | A "SIMULATED" corner tag in every frame. Never "LIVE". |
| TV guide | "Fictional leagues · simulated matches · not live" |
| Menu | "You drove here, so your drinks are alcohol-free. On the house." |
| Tokens | "House tokens are part of the game. They can't be bought and have no cash value." |
| Saving | "Saved on this device only" |
| Destination card (in the game) | "Stoppage Time · fictional sports bar · simulated crowd" |
| Credit | "Map data: Overture Maps Foundation, derived from OpenStreetMap contributors (ODbL), with a few street records from TomTom (ODbL); Microsoft ML Buildings (ODbL); heights from USGS lidar; land cover from ESA WorldCover (CC BY 4.0); one location point from Overture places (CDLA Permissive 2.0)." TomTom is named because 23 of the slice's fetched segment records list it (its `licences`), and the slice's own `attribution` names it. The last two are this slice's: its land cover is CC BY 4.0, which requires the credit, and its `venue` point comes from Overture places. |

**Checks** (run in S1 and kept in every later phase):
1. **The real name.** It appears nowhere in `src/`, `src/data/anaheim/sportsbar-*.json` or the built page. The grep uses
   the lookup key from `tools/anaheim/venue.py` with case and punctuation folded. The tooling is the one place it may
   appear.
2. **Real sports names.** No team, league or channel name matches the blocklist.
3. **Honesty words.** Words are matched whole, with case folded, so "Lively" passes.
   - **Canvas and broadcast frames:** no "live" at all. The test wraps `fillText` and `strokeText` on every canvas
     before the page loads and records each string drawn: the channel canvases (score bug, banners, ticker, the
     SIMULATED tag), the boards, the signs and the menus drawn in canvas. No frame says "LIVE" in any case, and there's
     no allowlist here.
   - **UI strings:** "live" may appear only inside the two allowlisted negations, exactly "Nothing here is live" (the
     tapped chip; Lot 57's chip has the same sentence) and "not live" (the TV guide card). The test reads the page's
     text nodes, with every sheet and card opened, and the `aria-label`, `title`, `alt` and `placeholder` values.
     Attribute names and other attribute values aren't UI text, so `aria-live` and Lot 57's `data-c="live"` pass.
   - **Everywhere (canvas and UI):** no "real-time" or "people here now"; no odds words ("odds", "moneyline", "point
     spread", "over/under", "parlay", "wager", "sportsbook"); no whole-word "bet"; no currency signs ($, €, £, ¥) or
     "USD".
4. **No places file.** The built page doesn't contain the places file.
5. **The player's menu.** Every item is alcohol-free (a data check).

## Joining the game later

Like Lot 57's Phase 3, done in the game's workflow, which owns `Game.ts`. The exits and routes are S0-data's
(`src/data/anaheim/sportsbar-freeway-link.json`; the file is authoritative and was still being refined while this was
written):

| From | Exit (sign text from OSM) | Game ramp(s) | Ramp meets the street | Then | To the lot |
| --- | --- | --- | --- | --- | --- |
| I-5 North (path 0) | Disney Way / Katella Avenue | 124 | Anaheim Way, 365.5 m down the ramp, at (-6452.1, -9098.5) | North-west on Anaheim Way through the East Katella Avenue signals, right onto South Claudina Way, north about 116 m past the front, left into the courtyard driveway | 352 m (0.22 mi) |
| I-5 South (path 1) | Katella Avenue / Orangewood Avenue | 791, 573 | East Katella Avenue at Manchester Avenue, 215.4 m along, at (-6867.1, -9224.5) | Manchester Avenue briefly, east on East Katella Avenue through the Manchester and Anaheim Way signals, Anaheim Way, then South Claudina Way as above | 545 m (0.34 mi) |

The file also lists farther exits, with routes from 1.1 to 3.1 km: Anaheim Boulevard / Disney Way, Gene Autry Way (both
directions), Harbor Boulevard, and Ball Road / Harbor Boulevard. Each route ends on the courtyard aisle at
(-6613.2, -9374.9).

1. **J1: a fade.**
   - "Stoppage Time" becomes a navigation destination; the I-5 North exit is the default.
   - About 80 m before ramp 124 meets Anaheim Way, or on a tap of the prompt on any listed ramp, the screen fades and
     you're parked in your stall.
   - The toast says: "Drove Anaheim Way to Stoppage Time · street driving isn't built yet."
   - Get out, Drive, the saved parked car and the return to an on-ramp are Lot 57's Phase 3a code. The destination comes
     from the `VenueDef`.
2. **J2: drive it.** The 352 m from ramp 124's terminal, on the real geometry, through the Katella signals, then
   Claudina Way and into the lot. It's a short surface-street slice in the OC streets work, next to Lot 57's 804 m.
3. **J1 check.** From Free Drive on the I-5 North, `navigateTo('Stoppage Time')` arrives parked. Then:
   - get out, walk in, order, walk back;
   - drive, and end up on a freeway with no errors.

   Lot 57's hand-off still passes.

## Roadmap only

None of these exist, and none will be claimed:
- Multiplayer: other real people in the bar, chat, voice, friends.
- Real matches, real scores, real schedules, live occupancy or real events, from any source.
- Partnerships with, or branding from, the real bar or any real venue. Using the real name needs the owner's
  confirmation of ownership or permission, in writing, recorded in `PROJECT_OC_DECISIONS.md`. The swap is then one
  constant plus the sign art.
- Betting, odds, or anything bought with real money.
- Romance or dating.
- Arrange mode: moving the bar's tables and booths in overhead view, saved per device. It's natural for the build
  camera, but it's later.
- Careers, a staff job for the player, or running the bar.
- Photoreal people, voice acting, motion capture.

## Phases

Each phase works like Lot 57's:
- **It ends with its checks passing** in Playwright (headless Chromium, SwiftShader, one process at a time; nine
  workflows share this machine).
- **Screenshots** go in `tests/out/sportsbar/`, and every one cited is looked at.
- **`npx tsc --noEmit`** must pass.
- **Results** are logged in `PROJECT_OC_PROGRESS.md`. Nothing is marked done on trust.

**Order.** Decision 12 puts the bar next after Lot 57. S1 needs only what Lot 57's P1a builds (the venue, the avatar,
controls, collisions and hooks), so it starts once P1a is committed, from the latest `claude/onfoot` commit merged into
`claude/sports-bar`. S2a, S3a and S3b use P1b and P1c if they've landed (see the module map). S4's Low needs the Retro
module from `claude/modes` merged in.

### S0: plan and data (done in Phase 0)

- **Deliverables.**
  - This plan.
  - S0-data: the bar's slice, the derived lot, the freeway link and the README section in `tools/anaheim/`.
- **Checks.** S0-data's own (Lot 57's outputs byte-identical; the spot checks; the name grep) and this plan's review.

### S1: the venue and the avatar in it

- **Brief.**
  - **The page.** `src/onfoot/sportsbar.html` with its own Vite config (`src/onfoot/vite.sportsbar.config.ts`), so
    neither the game's config nor Lot 57's changes. The config writes `dist/sportsbar/sportsbar.html`.
  - **The engine facade.** `src/onfoot/engine/`, exactly as the module map says:
    - re-exports of Lot 57's modules (never of `data.ts`, `coords.ts` or `main.ts`);
    - the new `schedule.ts`, `frame.ts`, `streets.ts` and `overhead.ts`;
    - the bar's `BarPlayer`, `BarInput`, `BarHud`, `lot.ts`, `mats.ts`, `visibility.ts` and the marked `PRESET` copy in
      `venues/sportsbar/`.

    No edits to `lot57/`, `main.ts`, `index.html` or `people/`.
  - **The venue def.** `venues/sportsbar/def.ts` and `brand.ts` (`BAR_NAME`).
  - **The frame.** Computed from building 61 and checked against the table under "The building frame".
  - **The streets and buildings** from `sportsbar-slice.json`, with building 61 kept as massing and our unit carved
    from it. The other units are generic, with no names.
  - **Our facade, sign and blade sign.** The patio. The courtyard stalls and your stall.
  - **The front,** as in "The front": the walk, the kerb ramp, the planters, the bike rack, and aisle 416 redrawn at
    4.5 m, one-way, with the mapped 416 dropped from the street build.
  - **The interior,** every fixture placed from the `objects` and `screens` data:
    - the bar, booths, high-tops and window rails;
    - the pool tables, dartboards and shuffleboard, static for now;
    - the TV wall and screens, showing a still "SIMULATED" test card;
    - the restroom and kitchen doors and the pass;
    - the jukebox and water station.
  - **The doors.** The front door opens as you approach; the patio door too.
  - **Closed hours:** locked, dark, and the blade sign reads "Closed · opens …".
  - **Your driver as the avatar,** spawned by your car's driver door (see "Where the page starts you"). Walking, tap to
    go and Sit on every seat.
  - **The visibility rule** for cars and streets (`venues/sportsbar/visibility.ts`; see "Inside, outside and
    overhead"): `parked.near` by state, your car and its stand-in, and `engine/streets.ts` building the near and far
    street sets. S3a adds the people rules.
  - **The three cameras,** the overhead with wall cutaway.
  - **Collisions and the walk grid**, with the 0.15 m slab, the raised front walk, its ramp and the patio. The walls
    are 0.25 m thick, and the party wall is 0.2 m.
  - **The edge** is the lot, the front walk, the patio and the interior. Past it, a quiet wall and Lot 57's toast.
  - **The chip** (level from the schedule; no people yet), the clock and the credit.
  - **Test hooks** on `window.__onfoot`:
    - `setClock(day, hour)` and `setQuality('low' | 'high' | 'ultra')` (`'high'` is HD). The hour is calendar time, 0 to 23.99, as on
      Lot 57's page; the engine maps 00:00 to 02:00 to the previous business day;
    - `stats()`, with `pass` and `frame` as in the budgets;
    - `go(x, z)` and `tap(x, z)`, in game coordinates;
    - `act()`, `view(mode)` and `frames`;
    - `frame()`, the building frame's O, A and B;
    - `layout()`, the front's and the patio's polygons and aisle 416's drawn ribbon, in frame coordinates;
    - `pose(name)`, one of the budget poses; `vis()`, the visibility state and what it drew (parked near, your car,
      street sets, and from S3a the people by draw mode);
    - Lot 57's other hooks, with the same signatures: `look`, `walk`, `sim`, `pos`, `colliders`, `region`, `seats`,
      `randomFree`, `render`, `freeze`, `reducedMotion`, `bobRange`, `camera`, `toast`, `hint`, `hud`, `tapScreen`,
      `actions`, `clock`, `liveClock`, `yourCar` and `breakdown`.
- **Checks.**
  - Boots with no console errors.
  - The frame matches the building-frame table to 0.1 m. The bar's point lands inside our unit.
  - 1,000 random walks through the hooks never end inside a collider or cross a wall, the patio fence or the party
    wall.
  - Tap to go reaches every one of the 91 seats. Sit and stand work on each kind.
  - Closed hours: the door is locked; the lot is walkable.
  - **The front fits.** From `layout()`, none of these overlaps aisle 416's drawn ribbon, and each is at least 0.4 m
    from it: the front walk, the door ramp and its flares, the bike rack with its bikes, the planters, the patio and
    its fence. The ribbon is at least 3.5 m from building 61.
  - **Every interior zone** in the "Inside" table, and every slot, lies inside the walls' inner faces.
  - **Nothing overlaps.** No two zones overlap. No two slots overlap, and no slot or object collider lies in another
    zone; a zone's own slots and colliders are exempt from it.
    - **The circles are radii.** A seat is a circle of radius 0.45 m; a standing, staff or player spot is a circle of
      radius 0.3 m, as the player's body is (Lot 57's `RADIUS`). Touching is allowed; overlapping by more than 1 mm
      isn't.
    - **Slots of one object** are exempt from each other only where one piece of furniture spaces them: the booth run's
      seats (two to a bench, and neighbouring booths' benches back to back on one backrest), one high-top's four
      stools and one patio table's four chairs. Other slots of one object aren't: the bar's stools, standing gaps and
      pick-up must clear each other.
    - The shuffleboard's thrower spot clears the south window rail's first stool (1.59 m apart, centre to centre).
    - `tools/anaheim/sportsbar_zones.py` runs the same test on the plan's numbers; S1 runs it on the built `objects`
      data.
  - **The honesty checks** (above): the real name, the honesty words (check 3, on the chip, the test card and every
    sheet), the places file, the credit visible.
  - **No Lot 57 data.** The bar's built page contains no part of Lot 57's `slice.json`. A search of
    `dist/sportsbar/sportsbar.html` finds neither that slice's `what` text ("Anaheim stadium-district slice") nor the
    first 16 numbers of its first segment's encoded points, written as the build writes them: comma-separated, no
    spaces (`-61996,-101450,87,163,…`). The build embeds JSON as a string (`json: { stringify: true }`), so both
    searches are plain text. It does find the bar slice's own `what` text.
  - **The scene budgets without people or items.** At every budget pose (`door`, `tv-east`, `stall`, `patio`, `overhead`), under
    the poses' conditions (Saturday 21:00, week 43, the fill seed 621, 844 × 390 and the portrait pair), at Low, HD and
    Ultra: `stats().pass` is within the "Without people or items" row of that state's column. `breakdown()` is
    logged, grouped as the venue, the near streets, the far streets, the sky, `your-car` and its stand-in, and
    `parked-*`. The bar's `breakdown()` counts only what's drawn: it skips objects hidden by `visible` on themselves or
    an ancestor (the far streets from inside, your car or its stand-in, an instanced mesh with no instances) and
    applies three.js's frustum test as the renderer does, so its total agrees with `stats().pass` within 1% at every
    pose.
  - **The street sets.** The built near set holds exactly the features `tools/anaheim/sportsbar_sets.py` lists as near
    (34 street pieces, 5 buildings, 25 infrastructure shapes, 26 points), and the far set the rest. The near batches
    come to at most 14 calls at Low and HD and 15 at Ultra, and all the streets within their row.
  - **The cars as measured.** `your-car` is 62.2k triangles at Low and 118.3k at HD and Ultra for the default car
    (±2%), and never over 65.6k and 121.1k for any of the four. At each pose, `parked-*` is `near` × at most 2.88k plus
    the stand-ins × 152, in at most 25 calls, with `near` as the visibility table says for that state.
  - **The visibility states.** Walking in and out of both doors switches the state on the crossing frame (`vis()`), and
    screenshots on each side of each door show no car or street popping in view, the I-5 and Claudina Way included.
  - **Lot 57 is unaffected.** Its page still builds, and its checks pass unchanged.
- **Screenshots.**
  - 1280 × 720, 844 × 390 and 390 × 844.
  - Noon and Saturday 21:00.
  - First person from the door (the `door` pose), at the bar, toward the TV wall, and at the pool tables.
  - The spawn: first person by your car's door, at noon and at Saturday 21:00.
  - Third person on the patio.
  - Overhead with the walls cut away.
  - The exterior from the lot at night.
- **Look at them:** does it read as a believable neighbourhood sports bar in a SoCal strip, not a grey box?

### S2a: needs, objects, ordering and the screens

- **Brief.**
  - **`engine/sim/`:** needs, moods and moodlets, personality (with the trait scalings), the smart-object catalogue and
    adverts, reservations, the action queue, held items (instanced: see "Held items, table items and game pieces").
  - **The player's UI:** the needs strip and panel, the mood face, the queue icons, the radial menu for objects.
  - **Ordering:** at the counter, and table service with one bartender and one server as scripted staff (full staff
    in S3a). Our menu, eating and drinking.
  - **The screens:** the TV system (leagues, the schedule's slots, the featured match and `gameNight`, match models,
    broadcast canvases, highlights, the guide card, "Pick a side").
  - **Watching** for fun.
  - **The jukebox and the water station.**
  - **The dance spot during `gameNight`** (the player only, in S2a).
  - **Tokens and saving.**
  - **The pool table, the dartboards and the shuffleboard** stay static props in S2a: S2b makes them playable.
  - **New animation clips** on the people builder's rig: drink, eat, dance ×3, cheer, groan, clap. S2b adds the game
    clips on the same layer.
    - They're in `engine/sim/clips.ts`, as the external pose layer in "Who changes `src/onfoot/people/`". `people/`
      isn't edited.
    - The layer offers `clips.play(person, name)` and an upper-body overlay, so a seated person can cheer.
    - At E0 they become new `AnimName`s in `people/anim.ts`.
    - If a clip can't be made to look right, ship the rest and write the clip up in `PROJECT_OC_HANDOFF.md` for the
      design review queue.
  - **Hooks:** `needs()`, `setNeeds()`, `setTraits(traits)` (the player's traits, for tests), `mood()`,
    `use(objectId, action)`, `queue()`, `tv()` (fixtures, scores, events, the featured match and `gameNight`),
    `setWeek(n)`, `setTimeScale(k)`, `fastForward(min)`, `tokens()`.
- **Checks.**
  - Needs decay at the table's rates: fast-forward 10 sim minutes, and every need is within ±1 of the formula, at
    outgoing 0, 0.5 and 1 for social, each set with `setTraits({ outgoing })` before its run. A unit test of
    `engine/sim`'s decay, with the traits as its input, checks the same rates without the page.
  - **Items.** Everything the player holds, orders or leaves as an empty is an instance in the six item meshes:
    `breakdown()` shows no other new mesh, and each model's triangles per instance are within its row (see "Held
    items, table items and game pieces").
  - Mood follows its formula: at full needs and no moodlets, `mood()` reads 80 (Happy); at the seeded average it reads
    within 1 of `20 + 0.6 × the weighted average`.
  - The clip layer leaves `people/` untouched (`git diff` on it is empty), and each clip plays on a person built at
    each LOD.
  - Each action works end to end through the hooks, with the needs moving the right way:
    - order a drink: wait, hold, sips raise thirst;
    - order food at a table: a server comes, the food arrives, eating raises hunger;
    - watching raises fun, by ×1.6 only while the featured match is in play on the watched screen;
    - the jukebox and water;
    - Dance is offered only during `gameNight`: not on Friday at 20:24 or Thursday at 21:00; offered on Friday at 20:26,
      Saturday at 21:00 and Saturday at 01:59 (Friday's game night).
  - **The featured match.** `tv()` gives exactly one featured fixture a day, with the slot, channel, kick-off and final
    whistle in "The featured match", and none on Tuesday. `tv.featuredFactor` is 1.25 only inside that day's window.
    Other fixtures on the big screen aren't featured.
  - **Highlights** show the previous match day's goals on Tuesday and before a day's first final whistle, under its
    name.
  - The same clock gives the same fixtures and scores twice. Honesty check 3 passes on every screen frame: each has
    "SIMULATED", and none has "live" in any case.
  - The menu: alcohol-free for the player, no prices. The blocklist test passes.
  - Saving round-trips, and the page works with storage blocked.
- **Screenshots.**
  - The needs panel open (390 × 844, 844 × 390).
  - The radial menu on the bar, ordering, and holding a drink in first person.
  - The TV wall with the featured match and a GOAL banner, and the guide card. The shot is taken at the featured
    match's first goal, found from `tv()`'s events for Saturday of week 43, not at a fixed time.
  - A `gameNight` dance at 1280 × 720, Saturday 21:00.

### S2b: the games

- **Brief.**
  - **Playable pool, darts and shuffleboard** against the scripted house opponent: the physics, the rules, the
    controls, and the house opponent's shot selection and aim error, as under "The games".
  - **The game cameras** (`venues/sportsbar/gamecams.ts`): above the table, behind the oche, behind the puck.
  - **Results:** the winner's moodlet (scaled by competitive), tokens, and "Lost a close one".
  - **Clips:** pool stance and shot, dart throw, shuffleboard slide, on S2a's clip layer, with `people/` still
    untouched.
  - **The pieces** are the instanced ball, band, stick and disc meshes (see "Held items, table items and game
    pieces"), their matrices set from the physics each frame.
  - **Hooks:** `game(id)` (the state of a table or board), `shoot(id, params)` for scripted shots.
- **Checks.**
  - A pool game, a darts game and a shuffleboard game each complete with a winner, the moodlets and the tokens.
  - With all three games set up, `breakdown()` shows the pieces in the items row's meshes, with no other new calls.
  - Pool physics: energy never grows, no ball ever leaves the table, and 500 random breaks all settle in under 20 s.
  - The house opponent's pool shots: in 200 seeded racks, every chosen shot passes the clear-path test and has a cut
    under 70°, or it's a safety.
  - Darts: 301 straight out, and a throw past zero busts.
  - Shuffleboard: a puck released at 3.0 m/s stops 6.55 m ± 0.05 m away.
  - The game cameras return to the player's view after each turn, or cut with reduced motion.
  - Each game clip plays on a person built at each LOD, and `git diff` on `people/` is still empty.
- **Screenshots.**
  - A pool shot overhead, darts behind the oche, and a shuffleboard slide, at 844 × 390 and 1280 × 720.

### S3a: the crowd, staff, fillers and how people are drawn

S3 is split, as S2 was: S3a fills the room and draws it within budget; S3b adds what people do with each other. Each
ends with its own checks and its own budget run at the poses.

- **Brief.**
  - **The crowd.** Spawning by the schedule: the persistent regulars' pool and walk-ins, parties arriving from the lot
    and the drop-off, stays and leaving. Arriving parties keep together as Lot 57's talking groups (its group state
    machine and murmur, with a starter set of 30 lines; S3b adds the rest).
  - **Autonomy over objects.** The utility AI over the objects' adverts (under "NPC autonomy"): the need, urgency,
    affinity, emotion, event, walk, occupancy and wait terms, overlays, hysteresis, the top-three sampling,
    reservations, the watchdog and the decision log. People's own adverts come in S3b.
  - **Staff:** bartenders, servers, host and barback on the job queue; the cooks' hands at the pass. Restroom visits.
  - **Fillers:** the filler atlas (at Low from toon-styled bodies; see "Fillers"), the one instanced mesh of cards,
    where fillers go, the hand-over to live guests with the 6 spare bodies, and their reactions.
  - **How people are drawn:** people's LODs and the visibility rule for people (meshes, cards, LODs and shadow casters
    by state; see "Inside, outside and overhead"), with `visibility.ts`'s restyle at Low, and the background builds,
    one person per idle callback (see "People are slow to build").
  - **Moods and emotions** on faces and bodies.
  - **Crowd reactions** to the screens, with the dance chance at the featured final whistle.
  - **Hooks:** `people()`, `decisions(n)`, `seed(n)`, and `crowdAt(zone, n)` (seats walk-ins in a zone, for the budget
    poses).
- **Checks.**
  - **Needs drive choices.** The population is NPCs with thirst under 30 who aren't holding a drink or waiting on one.
    At least 70% of them choose a drink-tagged action (a bar drink, table service or water) within their next two
    decisions, from `decisions(n)`. Likewise hunger and food, and fun and a fun action. The arithmetic under "Urgent
    needs" predicts about 99%.
  - **Mood.** At Saturday 21:00, after a 30 sim-minute fast-forward, the median NPC mood is Fine or better, and under
    15% of NPCs are Low.
  - **No stuck people.** No NPC stuck over 60 sim s across a 30 sim-minute fast-forward at Saturday 21:00. No slot is
    ever over capacity.
  - **Reactions.** Over 10 seeded goals, the share of the scoring team's live supporters who can see a screen and react
    within 1 s is within 12 points of their mean p (0.3 + 0.7·fan; about 150 samples, so 12 points is about 3 standard
    deviations). Nobody who can't see a screen reacts. At the featured final whistle on Friday and Saturday, only
    winners who can see a screen, with active over 0.4 and fun under 70, start dancing through the direct chance.
  - **The crowd by clock.**
    - Tuesday 15:00 has fewer people than Saturday 21:00.
    - Closed hours have nobody inside.
    - Staff counts follow the share, and Low never draws more than 5.
    - The live count never passes the preset's cap.
  - **Fillers.**
    - At each preset, at Saturday 21:00 and Tuesday 15:00, live guests plus fillers equal the target guest count, or
      live guests plus every free eligible slot if that's fewer.
    - No filler is nearer the player than the preset's minimum distance.
    - No table mixes fillers and live people.
    - Tapping a filler gives a live person, and their menu opens.
  - **Low stays Retro.** At Low, after a 30 sim-minute fast-forward at Saturday 21:00 with the camera walked through
    every pose, every mesh under every live person, your car and its stand-in wears a toon material
    (`retro.stylizer.isMine`), and the cards wear their own shader material: no standard material reaches `RetroPass`
    after the LOD swaps, rebuilds and swaps.
  - **The background build is logged.** From the first frame until the room reaches its live cap, at each preset, the
    longest frame, the number of frames over 50 ms and the builds that caused them are logged. It's a record, not a
    pass mark: SwiftShader here says nothing about a phone (see "Owner questions").
  - **Budgets.** At every budget pose and preset, under the poses' conditions (Saturday 21:00, week 43, `seed(1)`, the
    fill seed 621, the caps reached as the poses say, and every item model at its cap): `stats().pass` is within its
    column's pass row and budget, and `stats().frame` within its frame row. Outdoors, `vis()` shows no more meshes than
    the outside counts, and no person drawn as a card holds an item. Simulation ms and the 6 decisions' ms are
    reported.
- **Screenshots.**
  - A Saturday 21:00 goal, before and after (1280 × 720 and 390 × 844).
  - The overhead view of a packed Friday.
  - Low (844 × 390), Saturday 21:00, the `door` pose: does the room read as packed?
  - The `stall` and `patio` poses at Low: do the people inside read through the glazing as cards?
  - A Tuesday 15:00 quiet afternoon.

### S3b: interactions, relationships and conversations

- **Brief.**
  - **People advertise.** Person adverts with the expected-delta formula and the candidate rule (under "NPC
    autonomy"), scored beside the objects' adverts.
  - **The 11 interactions** with their acceptance formula and beats, for NPCs and the player: the player's radial menu
    for people, Introduce and Buy a round included, and NPCs' rounds.
  - **Groups.** Talk and Join forming and joining groups of 2 to 6, the beats inside them, and leaving.
  - **Relationships and memory,** persistence for regulars, people cards and the People here list.
  - **Conversations and lines:** about 120 lines.
  - **NPC games:** party invites by relationship and competitiveness, games on screen on the physics, games off screen
    resolved statistically.
  - **Hooks:** `rel(id?)` and `interact(targetId, kind)`.
- **Checks.**
  - **Conversations.** In every sampled group, at most one speaker at a time, and listeners face the speaker in at least
    70% of samples (Lot 57's check).
  - **People advertise.** In `decisions(n)`, every person advert's score uses the expected deltas, no decision scores
    more than 8 people or 89 adverts, and every accepted Talk or Join leaves both in one group of 2 to 6.
  - **Each interaction end to end.** Each of the 11 runs through `interact()`: the beat plays, the caption shows, and
    rapport, the needs and the memory move by the table's numbers. A round costs 4 tokens a person, and a group can't
    be bought another within 10 sim minutes.
  - **Relationship maths.** Unit tests against the formulas: rapport and friendship updates, decay, the memory ring of
    8, highlights, the level thresholds. Persistence round-trips across a reload.
  - **NPC games.** An on-screen NPC pool game uses the physics. One off screen is resolved statistically, and when the
    player walks up, the balls are laid out for the counts left.
  - **Budgets.** S3a's budget run again, at every pose and preset under the same conditions, with groups talking and
    NPC games in play. The sparks and puffs are in the HUD layer, so they add no draw calls.
- **Screenshots.**
  - A conversation with the radial menu open, and a person's card.
  - Buying a round, and a toast.
  - An NPC pool game in play, from the overhead view.

### S4: maximum graphics and polish

- **Brief.**
  - **The graphics table:** Low, HD and Ultra (above), on the P1d standard and decision 15. Low turns on the shared
    Retro style module once `claude/modes` has merged (if RS1 hasn't landed by S4, Low ships at full resolution with
    the standard materials, and the handoff says so). Ultra reads the shared entitlement from RS2, with no price or
    purchase path. Before E0 the settings are the bar's marked `PRESET` copy, re-synced with Lot 57's `main.ts`; after
    it, the shared `engine/quality.ts`. The lighting design and the
    code-made materials. The I-5 light streams. The night exterior and the neon. People lit with rim and fill.
  - **Then polish:**
    - the transitions, the audio mix and the dance-night lighting;
    - the reduced-motion and text-size settings;
    - the remaining lines, to about 250;
    - a performance pass.
  - **E0** (the move into `engine/`) if Lot 57's P1d has been committed by then; otherwise it's left as the first task
    of whoever next touches both venues.
- **Checks.**
  - **Screenshots** at 1280 × 720 and 390 × 844 at noon, golden hour and Saturday 21:00, at Low, HD and Ultra: inside
    at the TV wall, the bar, the pool tables, the patio toward the freeway, and the exterior from the lot.
  - **Before and after** against S3a's and S3b's shots.
  - **`stats()`** at every budget pose and preset, under the poses' conditions: `pass` within its column's pass row and
    `frame` within its frame row, now with the final materials, the Retro pass at Low and the post chains measured.
  - **Low is Retro.** At Low, `RetroStyle` is attached, the render scale is 1 and the pixel ratio is at least 1; at HD
    and Ultra it's detached. A locked Ultra shows "Ultra · locked" and no price.
  - **The `PRESET` copy** matches Lot 57's `main.ts` at the time, or the difference is written up.
  - No console errors, and the honesty checks.
  - **If E0 ran,** Lot 57's checks are unchanged after it.
- **Look at every screenshot:** would a player stop and take a photo of it?

## Owner questions

Two questions this plan records and doesn't settle. They're also listed in `PROJECT_OC_HANDOFF.md`.

1. **Does Low draw a sun shadow map?**
   - Decision 15 lists "hard shadows" in Low's look, and the game's `RETRO` preset (on `claude/modes`) turns on a 1024
     sun map, which `RetroStyle.attach()` switches to three.js's hard-edged `BasicShadowMap`.
   - The bar's Low, as planned, draws no map: its shadows are the hard-edged blobs and the baked light. Outside, Low's
     frame is already at 141 of its 150 calls and 240.3k of its 250k (see the sums).
   - **If the owner, or RS3's style guide, asks for hard sun shadows at Low,** the bar turns on the 1024
     `BasicShadowMap` with a short caster list: the venue's own casting batches, and, outside, your car's 152-triangle
     stand-in on the shadow layer (the way a LOD 0 person casts with their LOD 1 body) and the people outside the unit
     with LOD 2 bodies. No streets, parked cars or items cast at Low. **An estimate:** that adds about 15 calls and 30k
     for the venue's batches (an allocation; the venue isn't built), plus outside 1 call for the stand-in and 4 calls
     and 6k for 4 people. Low can't absorb it without its fallbacks: outside the first three (`parked.near` 4 to 0, LOD
     1 from 7 to 4, the far props: 20 calls and 34.2k back), inside all three (16 calls and 79.5k back), so Low would
     show fewer detailed parked cars, fewer LOD 1 people and no LOD 0.
   - **The question:** keep Low without a sun map, as planned, or turn it on and take those fallbacks?
2. **Person builds stall the page, worst on a phone.**
   - Each person build is one synchronous call to the people builder: 0.29 s at LOD 2 and 0.71 s at LOD 1 at phone
     quality, and 4.6 s for a phone LOD 0, measured on a desktop CPU (Lot 57, 14 October). A phone is slower, by an
     amount nobody has measured.
   - The plan builds one person per idle callback, never two together and never back to back, and S3a logs the
     longest frame. That spreads the stalls out, but each is still a frozen frame of 0.29 s or more while the room
     fills (36 people at Low, 70 at HD, 100 at Ultra, plus 6 spares), and a 4.6 s freeze when you start talking to
     someone at Low and their LOD 0 builds.
   - Removing the stalls needs the people builder to build in a worker, or to yield between steps. That's in
     `people/`, which the bar doesn't edit before E0 (F5's builders and Lot 57's P1d own it), and it would serve Lot 57
     too.
   - **The question:** accept the stalls for now, with S3a's log as the record, or ask `people/`'s owners for a worker
     or step-wise build before S3a? And meanwhile, should the bar skip LOD 0 at Low (the person you talk to stays at LOD
     1, as outside), which removes the 4.6 s freeze and frees 63.5k inside?

## Risks

- **Scope.** A life sim is a huge genre.
  - This is a slice: one bar, five needs, about a dozen object actions, eleven social interactions, two fictional
    leagues and three games.
  - Each phase ships something playable.
  - If time runs short, cut lines and polish before cutting systems. Fewer interactions done well beat more done badly.
- **Two workflows, one engine.**
  - Lot 57's files are moving under the bar's feet: they changed while this plan was checked against them.
  - The guard: S1 to S4 only import (`engine/` as a facade). They subclass or wrap where Lot 57 is coupled (`BarPlayer`,
    `BarInput`, `BarHud`). They copy only the marked `PRESET`, the page loop and the build plugin. E0 is one mechanical
    move after P1d, checked by Lot 57's own tests.
  - If Lot 57's APIs change before E0, the bar adapts; Lot 57 doesn't.
  - The S1 builder re-reads the module map's "What exists now" against the code of the day and corrects the plan first
    if it has drifted.
- **Three writers on `people/`.**
  - F5's builders, Lot 57's P1d and the bar's clips all want to change the people builder.
  - The guard: the merge order under "Who changes `src/onfoot/people/`". The bar's clips stay outside `people/` until
    E0, and look bones up by name.
- **Fillers can look flat.**
  - Impostor cards at 6 to 9 m can read as cut-outs, especially from above.
  - The mitigations: 8 directions, three poses, the cheer, and the promotion radius.
  - In the overhead view the distance is measured from the camera's target, so what you're looking at is live.
- **People are slow to build and costly indoors.** At about 0.5 s per person on a desktop CPU, phones are slower, and
  each build is one synchronous call, so each is a stalled frame (an owner question). Progressive building, reused
  bodies and the LOD caps are the plan. Low's triangle margins are 4.6% inside and 3.9% outside (see the sums), and
  the venue, street and item rows are allocations or estimates until S1 and S2a measure them.
- **New animations.**
  - Cheering, dancing, pool and darts are new clips on a rig built for talking, walking and sitting.
  - Procedural clips can look stiff. The mitigation is timing variety.
  - If a clip can't be made to read well, it's written up for review instead of shipped stiff.
- **AI that looks dumb.**
  - Utility AI can dither, crowd one object, or make everyone do the same thing.
  - The guards: hysteresis, reservations, the softmax top three, occupancy costs, the watchdog, and the decision log for
    tests.
- **Too close to the real bar.**
  - The site is real, on purpose. The guard is the rule set: our name (searched), our look, no photos, the real name
    only in the tooling (checked by grep).
  - The real bar's unit size and layout are unknown to us; ours is an assumption, and it's ours.
- **Sports and brands.**
  - Fictional leagues can still collide with a real team's name; the blocklist test and a search before release guard
    it.
  - No series' trade dress is copied; "Sims-like" stays out of the product.
- **Alcohol, rounds and ratings.** A bar in a driving game, with rounds bought.
  - The player's menu is alcohol-free; rounds are "their usual", never named; nobody is shown drunk; nothing rewards
    drinking.
  - Store ratings may still care that glasses are on screen and that it's a bar.
- **Gambling perception.** Sports bars show odds; ours never does. Tokens can't be bought, sold, exchanged or staked.
- **Data quality.**
  - No parking area is mapped: the lot is derived, and the stalls are ours.
  - No sidewalk is mapped on our side of Claudina Way.
  - The place point is approximate.
  - The building is one footprint with 11 other businesses' records in it.
  - The street world is as accurate as OpenStreetMap's mapping, and we don't claim more.
- **Phones are unmeasured.** As for everything in this game, the budgets are targets until someone runs it on a phone.
- **Honesty drift.** Broadcast graphics invite "LIVE" in the corner. Check 3 reads every string drawn on a canvas on
  every screenshot run.
- **The Retro look on people and screens.** The toon swap keeps skinning and colours, but the people builder's own
  shaders (eyes, strand hair) and the broadcast canvases under the palette and dither may not read well. S4 looks at
  every Low screenshot, and the RS3 style guide is the reference.
- **The visibility rule can show.** Cars swap at the doors, people beyond the outdoor count are cards through the glass,
  and the far streets are hidden from inside. The near set is chosen by any part in the glazed sectors, so nothing
  the glazing shows within 150 m is hidden; beyond 150 m it can be. The door screenshots in S1 and the card
  screenshots in S3a look for it.
  If a swap reads badly, the fallbacks under the sums say what to give back instead.

## Data sources and licences

From Overture Maps release `2026-09-23.1`, as recorded in the slice's `licences`:

| Theme / type | Used for | Licence in the rows | In the page? |
| --- | --- | --- | --- |
| `transportation/segment`, `connector` | Streets, aisles, driveways, footways, speed limits | ODbL-1.0 (OpenStreetMap; 23 pieces also list TomTom, ODbL-1.0) | Yes, credited |
| `buildings/building` | Footprints and heights, building 61 | ODbL-1.0 (OpenStreetMap 560, Microsoft ML Buildings 123). USGS lidar heights (119) carry no licence string; USGS 3DEP data is US public domain. | Yes, credited |
| `base/land_use`, `water`, `infrastructure` | The substation, power poles, signals, crossings, bridges, fences | ODbL-1.0 (OpenStreetMap) | Yes, credited |
| `base/land_cover` | Ground cover | CC-BY-4.0 (ESA WorldCover) | Yes, credited |
| `places/place` | Locating the real bar | CDLA-Permissive-2.0 (Overture, Meta, Overture signals) | **Only the bar's point:** the slice's `venue` x, z, lon and lat, with no name and no id, credited. The places file never ships. |
| Game terrain | Ground height | As in `tools/oc-network/README.md` | Already in the game |

The credit line is the game's, plus the two sources this slice adds (see "Honesty labels"). Not used: Google Maps, Apple Maps, or any photo of the real bar.

## How these numbers were measured

Every measurement was taken on 2026-10-21.

- **The bar's point, category and confidence** come from S0-data's `tools/anaheim/data/sportsbar-venue.json`. That's
  the Overture places record found by address and confirmed by the lookup key in `tools/anaheim/venue.py`.
- **The host building** is building 61 in `src/data/anaheim/sportsbar-slice.json`: footprint ring, height, lidar flag,
  class. Its area and the 11 other place records in it come from the slice's site block. Its shape, the arm's
  direction and depth, and the building frame were computed from that ring.
  - A, the arm's axis, is the mean of the two long edges' unit vectors.
  - B is A turned 90° toward the courtyard.
  - The table's (u, v) values are dot products with A and B.
- **The lot** is the slice venue block's `lot_p` ring, `lot_aisles` and `lot_entries`. Its area moved from 3,018 to
  3,031 m² across S0-data's runs while this was written; the latest run gives 3,025 m².
- **The stall estimate** comes from the lengths of aisle 415's legs and the clear depth beside them, at 2.75 m × 5.5 m
  per stall. A layout of four rows on the two east-west legs, kept inside the derived lot (0.3 m tolerance) and off
  building 61, fits 62. It's ours, not the data's. The fill bias in the module map (0.75 to 0.94, mean 0.84) is Lot 57's
  `fill()` rule applied to those 62 stalls.
- **Streets, speeds, the substation, the bridge and signals** were read from the slice and from the Overture cache in
  `tools/anaheim/data/` (`segments-5km.parquet`, `city-building.parquet` and `slice-infrastructure.parquet`).
  Distances are from the bar's point to each feature's nearest edge, in game metres.
- **Ground heights** were sampled from the terrain grid in `src/data/oc-network.json`, decoded as
  `Network.decodeTerrain()` does it, with bilinear lookup. The site's range is from every 2 m grid point inside building
  61 or the derived lot (1,487 points).
- **Our unit and the patio** were tested against building 61 with shapely:
  - The unit (u 0 to 36) has an area of 529 m², all of it inside the footprint, and so does every interior zone in the
    "Inside" table.
  - The patio has an area of 99 m² and doesn't overlap the building. 25 m² of it lies in the derived lot, and it's
    4.17 m from aisle 416's centreline at the closest point.
  - The walls: the footprint was shrunk 0.25 m and cut at u 35.8, giving 505 m² inside. The old booth line (v 0.5)
    was 0.46 m² inside the south wall.
  - **The layout** was checked in shapely by `tools/anaheim/sportsbar_zones.py`, which holds the "Inside" table's
    zones and slots and tests them under S1's rule (radii 0.45 m for seats and 0.3 m for spots; furniture-spaced seats
    exempt from each other):
    - every zone lies inside the inner faces: at least 0.15 m clear, except the kitchen and the TV wall, which are
      meant to meet the walls (the TV wall's zone starts at v 0.8; the south wall's inner face is at v 0.65 there);
    - no two zones overlap, and no slot overlaps another slot or another zone. The high-tops stop at v 10.0, so the
      water station's spot (29.3, 10.85) and the pass's server spots (30.6, 10.35 and 11.0) are clear of them. The
      bar's 9 stools (u 14.6 to 23.0), its 4 gaps (u 13.75, 23.8, 24.45, 25.1) and the pick-up spot (u 26.15) clear
      each other by 5 cm or more;
    - the front wall's inner face is u = 0.388·v + 0.27, and the window-rail stools stand 0.6 m in from it, so the
      first south rail stool's centre is (2.04, 2.9), 1.59 m from the shuffleboard thrower's spot at (2.7, 1.45);
    - run against the round-3 layout (the TV wall from v 0.5, the high-tops to v 11.5, 12 stools), it reports the
      faults the review found.
- **The front** was laid out in a front-wall frame (d out from the wall's outer face, s along it) and tested with
  shapely against the slice:
  - aisle 416's mapped centreline is 4.44 m out at the south-east corner, 3.69 m at the door's centre and 2.95 m at
    the north-east corner (4.36 to 3.04 m along the glazing, s 1 to 16.7);
  - our redrawn 4.5 m aisle ribbon (79.8 m long) clears building 61 by 3.75 m, the patio by 1.93 m and the power pole
    by 2.74 m;
  - it clears Claudina Way's kerbs (11 m class width) by 5.85 m on the main leg (north of the bend; 6.28 m south of
    it) and 3.66 m on the south-west leg;
  - it clears the front walk and the ramp by 0.45 m, the bike rack by 0.85 m and the planters by 1.05 m;
  - S0-data's derived lot's east edge in front of the unit is at d 5.47 at the south-east corner and d 9.44 at the
    north-east corner.
- **The budget sums** are arithmetic. They add Lot 57's measured people costs (quoted in the budgets section), the car
  costs below, Low's sky as counted from the code (below), and our allocations for the venue, the streets, the items,
  HD's and Ultra's sky and the pool spots. The street allocations stand on the estimate below.
  - HD's LOD 2 cost is an assumption, since only the phone's was measured.
  - The post-quad counts were read from three.js 0.160.1's `UnrealBloomPass` (13 full-screen draws), `OutputPass` (1)
    and `GTAOPass` (3 besides its normal pass).
  - `RetroPass`'s one full-screen draw and `RetroSky`'s 32 × 16 sphere were read from `src/game/render/style.ts` in the
    `tsu-modes` worktree (`claude/modes`, uncommitted) at about 02:20 UTC.
  - **Low's sky** was counted from the same worktree at about 05:30 UTC. `RetroStyle.render()` hides only the world's
    realistic `sky` and its `flare`. `src/game/env/Environment.ts` keeps its cloud deck (a part sphere, 48 × 16
    segments to 0.42π: 1,488 triangles, which `RetroStyle` alpha-cuts), its mountain ring (256 quads: 512 triangles)
    and its stars (1,400 points). With `RetroSky`'s 960 that's 4 calls and 2,960 triangles. This plan's code review
    measured the same 4 calls and about 3.0k at the 21:00 poses.
  - The crowd at the budget poses: 130 × 0.95 (Saturday 20–23) × 0.9 to 1.1, capped at 130.
  - The poses' game coordinates come from the building frame's O, A and B.
- **The car costs** were measured on 2026-10-21 by building each model in Node from the game's own builders, the ones
  Lot 57's `lot.ts` imports:
  - **How.** `src/preview/car.ts`'s `buildCar` with `cabin: 'full'`, and `src/preview/traffic.ts`'s `trafficParts` with
    wheels, with a stub canvas for their textures. Each mesh's index count over 3 was summed, with three.js 0.160.1.
    Those files are the same in this worktree and in `tsu-foot`.
  - **Your car, phone and high.**
    - GT: 62,158 triangles in 25 meshes, and 118,304.
    - Brio: 60,646 and 113,810.
    - Corsa: 65,567 and 121,091, in 26.
    - Vela E: 56,776 and 108,978.
    - The GT's shell cabin: 55,152 and 111,298, 7,006 less.
  - **Parked cars.** Each traffic kind's 4 parts total 2,872 triangles (sedan, SUV, coupe, van) or 2,884 (pickup) at
    phone quality, and 5,584 to 5,596 at high. The sedan's paint and trim, the parts Lot 57 lets cast, are 1,442 and
    1,246.
  - **A stand-in** is 152, counted from Lot 57's `proxyGeometry`: two 12-triangle boxes and four 8-sided, 32-triangle
    cylinders.
  - `renderer.info` counts the same triangles for each mesh it draws. The S0 code review measured the same figures for
    the GT and the parked cars.
- **The near and far street sets** were counted from `sportsbar-slice.json` by `tools/anaheim/sportsbar_sets.py`,
  which a reviewer can re-run:
  - **The rule.** A feature, on any layer, is near if any part of it (shapely's `intersects`, so a piece crossing the
    region with no vertex in it counts) lies in the glazed sectors within 150 m of frame (18, 8). The glazed sectors are
    the half-planes beyond the line of the front wall's outer face (-0.932 u + 0.362 v ≥ 0) and beyond the line of the
    arm's south wall (v ≤ 0.012 u). Building 61 is left to the venue, and seg 416 is dropped (`site.dropSegs`).
  - **The count.** 34 of 614 street pieces, 5 of 425 buildings, 25 of 205 infrastructure shapes, 26 of 536 points, and
    none of the 67 land-use or 18 water areas. Earlier rounds counted by middle point and centroid in the sectors
    u ≤ 7 or v ≤ 0: 19 pieces once seg 416 is left out (the plan said 20, with 416). Any vertex in those sectors adds 13
    pieces, among them Claudina's main leg (391), the I-5 pieces 362, 425 and 560 to 562 and Katella's 135 and 355; the
    true glazed sectors add two service ways (385 and 407), a gate, and the three Claudina poles north of the front
    (x -6605, z -9388 to -9461) that u ≤ 7 missed.
  - **Which set.** The substation across the street (infra 167, its fence, its two transformers and the power lines
    over it) is near; the two other substations in the slice (infra 48 and 126, 469 m and 545 m away) are far. 12
    power poles are near, the four along Claudina Way at x -6605 among them; the rest are far. No land use or water is
    near: none of it reaches the glazed sectors within 150 m.
  - **The triangles are an estimate,** not a measurement: a cost model of `engine/streets.ts` drawing as Lot 57's
    `data.ts` does, from its `Batch` primitives (ribbon 2 triangles per edge, slab 6, walls 2, cap n - 2, a cylinder 4
    per segment), with our own small props for the point features (a pole 36, a signal 68, a lamp 50). It gives the near
    set 6.7k in 11 batches (4.0k of it road markings and crosswalk paint), and the far set 24.9k in 11 batches drawn
    simple (5.3k of that its poles, towers, signals and lamps) or 63.9k in 14 in full. S1 measures the real figures.
- **The utility arithmetic** under "Urgent needs" was computed from the formulas as written, with the traits, needs,
  distances and occupancy stated there.
- **Lot 57's code** was read in the `tsu-foot` worktree (`claude/onfoot`, uncommitted) on 2026-10-21 at about
  01:00 UTC, and re-read at about 01:45 UTC: `lot57/*.ts`, `main.ts`, `index.html`, `vite.config.ts` and `people/`
  (`index.ts`, `anim.ts`, `person.ts`, `skeleton.ts`, `body.ts`). `hud.ts`, `lot.ts`, `main.ts`, `clock.ts`'s `DAYS`,
  `geom.ts`'s `Kit` and `tests/onfoot.mjs`'s budget views were read again at about 02:20 UTC. This revision re-read
  `lot.ts` (`buildLot`'s door offset, `ParkedCars`' stand-ins with `castShadow = true`, `yourCar`'s placement),
  `main.ts` (`applyQuality` restoring `castShadow` from `userData.cast`, the spawn at `lot.door` less 0.2 m in z),
  `data.ts` and `geom.ts`'s `Batch` primitives at about 05:30 UTC. Files there were still changing as it was read.
- **The railway's distance** is the nearest rail piece in the slice to the bar's point.
- **Exits and routes** come from `src/data/anaheim/sportsbar-freeway-link.json`.
  - The signals on each route are the slice's `transportation:traffic_signals` points within 20 m of the decoded route
    polyline.
  - The route turns were read from the decoded polyline of the I-5 North route.
- **Sizes:** `sportsbar-slice.json` is 133,400 bytes, 47,177 gzipped at level 9, in its latest run.
- **The name searches** were one web search per candidate on 2026-10-21. Their results are in "The name".
- **Lot 57's figures** (people LOD costs, build times, the phone LOD 0 triangle count) are quoted from
  `PROJECT_OC_ON_FOOT.md`, measured there on 2026-10-14.
