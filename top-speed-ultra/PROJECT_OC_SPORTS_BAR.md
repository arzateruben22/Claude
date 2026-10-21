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
and `sportsbar-freeway-link.json`, extending `tools/anaheim/`. This plan uses their numbers. The engine it builds on is
Lot 57's Phase 1, which is being built right now in `src/onfoot/lot57/` on `claude/onfoot`. This doc doesn't report on
either; check `PROJECT_OC_PROGRESS.md` for what's built and verified. Facts about the site come from that data. Each
number is either measured (the method is at the end) or marked as **ours** (a design choice), **an estimate** or **an
assumption**.

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
- **Friday and Saturday nights** are loud: a featured match on the big screen, goals that lift the whole room, and the
  floor in front of the screens turning into a dance spot after the final whistle (simulated, see below).
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
| Lot aisles (slice `seg` 415, 416) | 415 loops through the courtyard; 416 wraps the tip | 415 enters from S Claudina Way at z ≈ -9395 and z ≈ -9375. 416 runs north-south about 3.5 m in front of the tip's east face (x ≈ -6613), curves round the tip about 11 m south of it, and ends at a driveway that joins Anaheim Way at (-6656, -9316). That driveway is one-way, entry only, so cars leave by Claudina Way. |
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
- **Size.** 529 m² gross (measured from the frame, and wholly inside building 61), or about 490 m² inside the walls.
- **Walls.** A party wall at u = 36 separates it from the next unit.
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
        '.      '----------------------------'       36 m         |> aisle 416 runs N-S in front (x -6613)
          '.                                      [ PATIO ]       |
            '._____ aisle 416 round the south side ______________/    S Claudina Way bends SW
                     \ driveway from Anaheim Way (-6656, -9316)           to Anaheim Way
   ========= Anaheim Way (primary, 40 mph), 43 m south-west of the bar =================
   =========== I-5 Santa Ana Freeway, about 100 m south-west ===========
                                                   ===== East Katella Ave, 117 m south =====
```

| Part | Where | Contents (ours unless noted) |
| --- | --- | --- |
| Stoppage Time | building frame u 0–36 | See "Inside". Floor slab 0.15 m up, with a ramp at the entry. Ceiling 3.6 m inside the 4.3 m building (the lidar height). The parapet sign band on our unit rises to 5.4 m (ours). |
| Front walk | along the east face | 1.5 m concrete walk between the glazing and aisle 416 (the aisle is mapped; the walk is ours). A bike rack, two planters, and the ride-share pick-up kerb, which is just aisle 416 marked with a painted box. |
| Patio | u 2–20, v -5.5–0 (outside the south wall) | 99 m², on the strip between the arm and aisle 416. **Assumption:** the strip is open paving; nothing is mapped on it, and S0-data's derived lot covers its east quarter (25 m²). Its outer edge is 4.2 m from the aisle's centreline. Details are under "Inside". It's entered only from inside. |
| Courtyard lot | the derived lot polygon | Stalls are ours, 2.75 m × 5.5 m along aisle 415. **Estimate:** 55 to 60 stalls. "Your" stall is the courtyard stall nearest the routes' end at (-6613.2, -9374.9), about 30 m from the door. 6 m pole lights (ours; no lamps are mapped here). |
| Perimeter | aisle 416 round the arm and spine | A drive aisle (mapped) with landscape strips (ours) between it and Anaheim Way. |
| The rest of the frame | the slice | Streets, the I-5 and its Katella bridge, the substation behind a chain-link fence with its transformers and power poles, the railway and buildings, from the data. Building colours by class, as at Lot 57. |

Fictional hours: Monday to Thursday 11:00 to 24:00, Friday 11:00 to 02:00, Saturday 09:00 to 02:00, Sunday 09:00 to
24:00. The weekend opens early for the fictional morning matches.

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
  |  only)    | 2 doors|  o  o  o  o  o  o  o  o  o  o  o  o |  oche  ::::::   \
  |      PASS +--d--d--+   (12 stools)                       |                  \
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
| Entry | front wall, centre (3.6, 8.2) | | A 1.8 m double door and a ramp up the 0.15 m slab. A host stand at (6.8, 8.2). |
| Window rails | along the front wall | 1.2–6.3 and 10.0–15.0 | Drink rails with 8 stools, 4 each side of the door, looking out at the drive and Claudina Way. |
| Darts | 7.6–12.6 | 11.5–15.8 | Three boards on the north wall at u 8.4, 10.1 and 11.8, bullseye 1.73 m up. Oche line at v 13.38 (2.37 m). A code-drawn chalk scoreboard beside each board. |
| Pool | 8.9–17.4 | 4.3–9.5 | Two 7 ft tables, long axis along v, centres (11.0, 6.9) and (15.3, 6.9). 1.45 m cue clearance all round. A pendant lamp over each. |
| Shuffleboard | 2.2–8.9 | 1.15–1.75 | One 22 ft (6.7 m) table along the south wall, scored at the west end. Players stand at the east end and along its north side. |
| Bar | 14.0–27.0 | 13.3–15.8 | 13 m oak counter. Customer edge at v 13.3, counter to 14.05, bartenders' lane to 15.2, back bar to 15.8. 12 stools at v 12.85, every 1.05 m from u 14.6. Brass foot rail. Server pick-up at the west end (u 25.5–26.8). Staff flap at u 27.0–27.6. Four 65-inch screens above the back bar at u 15.5, 18.7, 21.9 and 25.1. A tap wall with plain coloured handles and no marks. |
| Restrooms | 27.6–31.0 | 11.6–15.8 | A block with two doors on its south face at u 28.4 and 30.2, each with our own "Restroom" pictogram. **Doors only:** not enterable. A water station between them at (29.3, 11.4). |
| Kitchen | 31.0–35.8 | 9.0–15.8 | **Doors only.** A 2 m pass window on its east face (v 9.3–11.3): stainless shelf, heat lamps, ticket rail and bell, with the lit kitchen visible behind. A staff swing door on its south face at u 33–34. |
| TV wall | inner face of the party wall, u 35.8 | 0.5–9.0 | The big screen, 3.2 m × 1.8 m, centred at v 4.75, 1.3 to 3.1 m up. Four 50-inch screens, two stacked each side. A lime LED score ticker below the big screen. |
| Standing and dance spot | 31.5–35.5 | 0.8–8.6 | Clear floor, 31 m², with the centre-circle inlay. Standing room for the big match; on game nights, the dance spot. The jukebox stands at (31.6, 0.8). |
| Booths | 20.5–31.3 | 0.5–2.1 | 5 coral booths of 4 seats along the south windows, 2.15 m apart. Table across the booth, a bench each side: half the seats face the TV wall. |
| High-tops | 19.5–31.0 | 3.0–11.5 | 6 round oak high-tops with 4 stools each, centred at (21.0, 4.6), (24.6, 4.6), (28.2, 4.6), (21.0, 8.6), (24.6, 8.6) and (28.2, 8.6). |
| Patio door | south wall, u 18.0–19.8 | | Glass double door. |
| Patio | 2–20 | -5.5–0 | A steel pergola with louvres and warm linear lights. 6 four-top tables, 2 patio heaters, a drink rail on the south fence with 6 stools facing the freeway, planters with agave and grasses, and a 1.1 m glass and steel fence. Two outdoor screens on the building wall at u 6 and u 14. |

**Seats:**
- Bar 12, booths 20, high-tops 24 and window rails 8: 64 inside.
- The patio: 24 at tables and 6 at the rail: 30.

**Fictional capacity: 130**, with standing room. It's never shown as a number.

**Screens:** 12 in all: the big screen, 4 beside it, 4 over the bar, 2 on the patio and 1 above the darts. They show
three channels (see "The games on the screens").

## One engine with Lot 57

The bar is built on the on-foot machinery Lot 57's Phase 1 is building, not on a copy of it. There is one engine with
two venues described as data, plus the bar's new life-sim layer written into the engine so Lot 57 can adopt it later.

### What exists now (read-only, `claude/onfoot`, in progress)

In `src/onfoot/lot57/`:
- **`geom.ts`**: `Batch`, `Kit`, `Emitter` and baked vertex lighting, plus `offsetLine`, `polyLen`, `along`,
  `pointInPoly`, `rand` and `canvasTex`.
- **`collide.ts`**: colliders, the 4 m hash and `ray`.
- **`walkgrid.ts`**: 0.5 m cells, `free`, `raised`, A* and string pulling.
- **`clock.ts`**: Lot 57's hours and curve hard-coded, plus the generic Pacific-time helpers.
- **`coords.ts`**: `ORIGIN`, `PLAN`, `SITE`, `EDGE`.
- **`data.ts`**: `buildStreets`, which statically imports Lot 57's `slice.json` and handles the Dupont loop, the
  construction fence and the stadium's light towers.
- **`tex.ts`**: generic surfaces, plus Lot 57's sign atlas.
- **`mats.ts`**: materials and `setNight`.
- **`venue.ts`**: the `Seat`, `Spot`, `Venue` and `Tree` types and `buildVenue`.

The avatar, controls, camera, actions, NPC groups, crowd, chip, quality presets and the page shell are P1a to P1d's
work in progress.

`src/onfoot/people/` (the people builder) is already shared.

### The module map

The table gives the target layout, `src/onfoot/engine/` plus `src/onfoot/venues/<id>/`:

| Today (Lot 57) | Becomes | Change |
| --- | --- | --- |
| `lot57/geom.ts` | `engine/geom.ts` | Moved as is. |
| `lot57/collide.ts` | `engine/collide.ts` | Moved as is. |
| `lot57/walkgrid.ts` | `engine/walkgrid.ts` | Moved as is. The bar uses `raised` for its 0.15 m slab and patio. |
| `lot57/clock.ts` | `engine/clock.ts` + `engine/schedule.ts` | `DAYS`, `anaheimDate`, `pacificOffset`, `liveClock`, `fmtClock` and `parseDay` move as is. `isOpen`, `closesAt`, `opensAt`, `crowdShare` and `crowdLevel` take a `Schedule` from the venue (below). `lot57/clock.ts` keeps its exports as one-line wrappers over Lot 57's schedule, so its callers and tests don't change. |
| `lot57/coords.ts` | `engine/frame.ts` + `venues/lot57/plan.ts` | `makeFrame(origin, axisU, axisV)` gives `toLocal` and `toGame`. Lot 57's frame is world-aligned. `PLAN`, `SITE`, `EDGE` and `inShed` stay Lot 57's. |
| `lot57/data.ts` | `engine/streets.ts` | `buildStreets(slice, frame, opts)`. The slice is passed in (each page imports only its own). `opts`: the view and near boxes, the site to drop, kerb rules, and an `extras(slice, frame)` hook. Lot 57's Dupont block ring, construction fence and light towers move into its hook. |
| `lot57/tex.ts` | `engine/tex.ts` + `venues/lot57/tex.ts` | Shared: the asphalt, concrete, pavers, turf, dirt, glow, picket and chain textures, plus the `condensed()` and `grain()` helpers. Lot 57 keeps `PAL`, `tiltupTex`, `labelsAtlas` and `readerTex`. |
| `lot57/mats.ts` | `engine/mats.ts` + venue extension | A shared base set. Each venue adds its own materials and its own `setNight` additions. |
| `lot57/venue.ts` types | `engine/venue-types.ts` | `Seat`, `Spot` and `Tree` move. `Seat` and `Spot` become the base of the smart objects (below). `buildVenue` stays Lot 57's. |
| P1a: avatar, controls, camera, hooks, page shell | `engine/avatar.ts`, `controls.ts`, `camera.ts`, `hooks.ts`, `page.ts` | As Lot 57 builds them. The bar adds an overhead mode to `camera.ts`. |
| P1b: tap to go, Sit, Order, Join, Leave, held items | `engine/actions.ts`, `engine/held.ts` | The action set becomes data: smart-object adverts. |
| P1c: NPCs, talking groups, crowd, staff, chip | `engine/crowd.ts`, `groups.ts`, `staff.ts`, `ui/chip.ts` | Crowd from `Schedule`. Staff jobs become a generic job queue. |
| P1d: Low, High and Ultra, post-processing, lights | `engine/quality.ts`, `engine/post.ts` | Shared as is. |
| `people/` | unchanged path | Gains the new animation clips (S2, S3). |
| (new) | `engine/sim/` | Needs, moods, personality, smart objects, the action queue, utility AI, interactions, relationships and memory, the TV leagues, tokens and saving. Written engine-first; the bar turns it on. |

**When the move happens (E0).** Lot 57's files belong to the `claude/onfoot` workflow and are being edited now. So:
1. **Until Lot 57's P1d is committed**, the bar never edits `lot57/`.
   - S1 creates `engine/` as a facade: `export * from '../lot57/geom'` and so on, for the modules that are already
     generic.
   - It adds new files only for what Lot 57 has hard-coded: `engine/schedule.ts`, `engine/frame.ts`, and
     `engine/streets.ts` if `buildStreets` can't take a slice.
   - The bar imports only from `engine/`.
2. **After P1d is committed**, E0 does the move as one mechanical commit, on a branch that has merged `claude/onfoot`.
   It is done by whichever workflow then owns `claude/onfoot`, or by the S4 builder after the merge.
   - E0 moves the generic files into `engine/` and leaves `lot57/*.ts` as re-export shims.
   - It switches `lot57/clock.ts` to `engine/schedule.ts` with Lot 57's schedule.
3. **E0's check:** Lot 57's own checks pass unchanged after it. That means:
   - its walk test;
   - `stats()` at each preset;
   - its screenshots, compared pixel for pixel at the same clock, seed and quality.

### A venue is data

Each venue exports one `VenueDef` from `src/onfoot/venues/<id>/def.ts`. It holds plain data (JSON-compatible), plus a
dynamic import of its own slice and its builder:

```ts
export interface VenueDef {
  id: 'lot57' | 'sportsbar';
  name: string;                 // from the venue's brand constant (BAR_NAME)
  template: 'taproom-yard' | 'sports-bar';
  slice: () => Promise<SliceJson>;              // import('../../../data/anaheim/sportsbar-slice.json')
  frame: { origin: [number, number]; u: [number, number]; v: [number, number] };   // game coords and unit axes
  anchor: [number, number];     // the open-data point (game x, z)
  groundM: number;              // terrain height under the site (the game's own grid)
  site: { replaceRing?: P2[]; keepHost?: { bld: number; unit: P2[] } };   // what of the data our layout replaces
  edge: P2[];                   // the walkable boundary for this phase (local)
  schedule: Schedule;
  rooms: Room[];                // floors, walls with openings, ceilings, raised areas (local polygons)
  objects: Placement[];         // { type, id, at: [u, v], rot, opts? } from the smart-object catalogue
  screens?: ScreenPlacement[];  // { id, at, rot, w, h, channel: 'featured' | 1 | 2 | 3 }
  lights: Emitter[];            // baked at Low, a budgeted subset real at High and Ultra
  staff: StaffPlan;             // counts by crowd share; posts (bar lane, pass, host stand)
  parking: { stalls: Stall[]; yours: number };
  lines: string[];              // line-set ids
  sim: 'light' | 'full';        // Lot 57: 'light' (Phase 1 behaviour). The bar: 'full'.
  palette: Record<string, string>;
  budgets?: Partial<Record<Quality, Budget>>;
}
export interface Schedule {
  capacity: number;             // fictional
  hours: [number, number][];    // per weekday, Sun..Sat: [open, close]; close > 24 runs past midnight; [0, 0] closed
  bands: { from: number; to: number; share: [number, number, number, number] }[];   // Mon-Thu, Fri, Sat, Sun
  events: { day: number; from: number; to: number; factor: number; label: string }[];   // fictional
  weather: { rain: number; fog: number };      // multipliers
  noiseSeed: number;            // the +-10% noise, seeded by venue, date and hour
}
```

Lot 57's def is written from its `PLAN` (world-aligned frame, origin (-5100, -8350), `sim: 'light'`). Its schedule
reproduces `lot57/clock.ts` exactly; a unit test compares the two at every half hour of a week.

**`sim: 'light'` versus `'full'`.** Lot 57's plan says "no needs meters". With `'light'`, the engine runs Lot 57's
Phase 1 behaviour: sit, order, join and leave, talking groups, crowd. With `'full'` it adds everything in the next
section. Lot 57 stays `'light'` until the owner asks otherwise.

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
| Social | 40–70 | 1.0 when not in a group or conversation; 0 in one | Talking, joking, cheering together, high-fives, toasts |
| Energy | 60–90 | 0.4 standing or walking; 0 seated; more in some actions (below) | Sitting +0.8 a minute; café de olla +15 |
| Bladder (NPCs, hidden) | 70–100 | 0.6, and -8 per finished drink | A restroom visit sets it to 100 |

- **Rates while doing things,** per sim minute:
  - watching the game: fun +2.5, × 1.6 for the featured match, × (0.6 + 0.8 × fan);
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

- **Mood (0–100)** = 0.6 × the weighted needs average, plus the sum of active moodlets, clamped.
  - The weights: hunger 0.2, thirst 0.2, fun 0.25, social 0.25, energy 0.1, each scaled by personality.
  - Labels: Elated 85 and up, Happy 65–84, Fine 45–64, Meh 25–44, Low under 25.
- **Moodlets** are short events with a value that fades linearly to 0 over its duration:

| Moodlet | Value | Lasts (sim min) | Moodlet | Value | Lasts |
| --- | --- | --- | --- | --- | --- |
| Goal for my team | +15 | 10 | Great chat | +8 | 10 |
| Goal against my team | -8 | 6 | Shared a laugh | +6 | 8 |
| My team won | +20 | 30 | Joke fell flat | -4 | 4 |
| My team lost | -12 | 20 | High-five | +5 | 5 |
| Won a game (pool, darts, shuffleboard) | +12 | 15 | Toast | +6 | 8 |
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
- **outgoing:** social decays faster, and social actions score higher;
- **playful:** jokes land and get told;
- **competitive:** games score higher and wins mean more;
- **fan:** watching scores higher and reactions are bigger;
- **active:** dancing and games over sitting.

Plus:
- **A team:** one of the 16 fictional teams, or none.
  - On ordinary nights: 30% Marigold League, 25% Canyon Gridiron, 45% none.
  - On a featured-match night, half the arrivals support one of the two playing teams.
- **Favourites:** a drink, a food and a game.

The player's traits default to 0.5 and are used only when autonomy is on (below). The player picks their team on the TV
guide card ("Pick a side"), or none.

Need weights from traits: hunger and thirst 1.0; fun `0.8 + 0.4·playful`; social `0.6 + 0.8·outgoing`; energy
`1.2 - 0.4·active`.

### Smart objects

As The Sims does it: objects advertise what they offer, and people (the player through menus, NPCs through the utility
AI) pick from those adverts. The catalogue is data in `venues/sportsbar/objects.ts`; the types live in `engine/sim/`.

```ts
type Need = 'hunger' | 'thirst' | 'fun' | 'social' | 'energy' | 'bladder';
interface Slot { id: string; at: [number, number]; face: number; pose: 'sit' | 'stand' | 'lean' | 'play' | 'dance' | 'staff';
  height?: number; role: 'user' | 'watcher' | 'staff' }
interface Advert {
  action: string; label: string;               // 'order-drink', "Order a drink"
  deltas: Partial<Record<Need, number>>;       // expected total change over the action (rates × duration + one-offs)
  minutes: [number, number];                   // duration range (sim)
  party?: [number, number];                    // people needed (pool: [2, 4])
  requires?: ('open' | 'staffed' | 'holding:drink' | 'holding:food' | 'gameNight' | 'screenInView' | 'npcOnly')[];
  tags: ('drink' | 'food' | 'game' | 'watch' | 'social' | 'dance' | 'rest' | 'music' | 'comfort')[];
  slots: string[];                             // which of the object's slots it uses
}
interface SmartObjectType { type: string; colliders: Shape[]; slots: Slot[]; adverts: Advert[]; model: string }
```

| Object (count) | Slots | Adverts: deltas over the action |
| --- | --- | --- |
| Bar counter (1) | 12 stools, 4 standing gaps, 4 staff | Order a drink: thirst +42, social +3 (wait 4–8 s, then sip about 6 min). Order food: hunger +45, energy +5 (kitchen 1–3 min). Lean and chat: social +12 over 5 min. Watch the bar screens: fun +10 over 5 min. |
| Booth (5) | 4 seats | Sit: energy +4 over 5 min. Eat (needs food), Chat with the table, Watch (2 of 4 seats face the TV wall). Order: a server comes. |
| High-top (6) | 4 stools | Sit, Eat, Chat, Watch, Order (a server comes) |
| Window rail (2) | 4 stools each | Sit, Eat, People-watch: fun +4 over 5 min |
| Screens (12, as one family) | any slot with the screen in view | Watch the game: fun 2.5 a minute × match and fan factors; social +1 a minute with 2 or more watchers within 3 m |
| Pool table (2) | 2 or 4 players, 4 watchers | Play pool: fun +40, social +15, energy -4, over 5–8 min, party [2, 4]. Watch pool: fun +8 over 4 min. |
| Dartboard (3) | 1–2 players, 2 watchers | Play darts: fun +30, social +10, over 3–5 min, party [1, 2] |
| Shuffleboard (1) | 2 or 4 players, 3 watchers | Play shuffleboard: fun +35, social +12, over 5–7 min, party [2, 4] |
| Jukebox (1) | 1 | Pick a song: fun +6, 20 s |
| Water station (1) | 1 | Get water: thirst +20, 15 s |
| Restroom doors (2) | 1 each, hidden | NPC only: bladder set to 100 over 1–2 min, out of sight |
| Dance spot (1, game nights) | 12 | Dance: fun +35, social +10, energy -12, over 3–5 min. Requires `gameNight`. |
| Patio table (6), patio rail (1), heaters (2) | 4 / 6 / area | Sit, Eat, Chat, Watch (the two patio screens). Watch the freeway: fun +5, energy +4, over 5 min. Heaters: +2 mood at night within 2.5 m. |
| Kitchen pass (1), host stand (1) | staff | Staff jobs only |

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
  - **NPC shots** use the same physics, with aim error σ = 1.5° to 6°, lower for more competitive people.
- **Darts.**
  - **Rules.** 301, straight out (no double needed), bust over.
  - **Throwing.** Flick up to throw. Your aim sways; holding steadies it for 1.2 s, then the sway grows. Low energy
    widens the sway a little.
  - **The board** is the standard generic 20-segment layout, drawn in code.
- **Shuffleboard.**
  - **Rules.** Four pucks a side, alternating. Zones 1, 2 and 3, and 4 for a puck hanging off the end. First to 15.
  - **Controls.** Swipe to slide. The bed's speed is a friction constant.
  - **NPCs** throw with error by skill.
- **Results.** A win gives the winner the "Won a game" moodlet and 5 tokens; the loser in a close game gets "Lost a
  close one". Playing together counts as an interaction for relationships (+6 for the winner, +4 for the loser, when
  both are in a good mood). Nothing is wagered.

### The games on the screens (fictional leagues)

Two fictional leagues of our own, with code-drawn crests and two colours per team:

| Marigold League (soccer-like) | Abbr. | Canyon Gridiron Circuit (gridiron-like) | Abbr. |
| --- | --- | --- | --- |
| Harborline FC | HBL | Interchange Iron | INT |
| Arroyo Kestrels | ARK | Basin Freight | BAF |
| Citrus Grove Sparrows | CGS | Sunset Signal | SSG |
| Palisade Lanterns | PAL | Ironwood Rivets | IWR |
| Saltflat Terns | SFT | Copperline Haulers | CPH |
| Ridgeview Foxes | RVF | Breakwater Cranes | BWC |
| Bluffside Undertow | BLU | Dune Patrol | DNP |
| Mesa Quail | MSQ | Grove Pickers | GRP |

**Checking the names.**
- A test checks every team, league and channel name against a blocklist in
  `tests/onfoot/sportsbar-blocklist.json`. It has:
  - major-league team names and nicknames (NFL, MLB, NBA, NHL, MLS, WNBA, NWSL), the minor and college teams of
    Southern California, and real leagues and tournaments;
  - broadcasters, and phrases such as "Monday Night".
- The names are searched again before release.

**Formats are ours.** Both leagues use a quick format:
- The Marigold League plays 2 × 10-minute halves with a running clock.
- The Gridiron Circuit plays 4 × 6-minute quarters.
- Matches run back to back in each league's windows, so a short visit sees real moments.

**The schedule** is fictional and seeded: `seed = hash(venue noiseSeed, ISO week, day, slot, channel)`.

| Channel | Shows |
| --- | --- |
| 1 · Marigold League | Wed and Fri 19:00 to 23:00; Sat 12:00 to 23:30; Sun 11:00 to 16:00 |
| 2 · Canyon Gridiron | Sun 10:00 to 20:00; Mon and Thu 17:30 to 22:00 |
| 3 · Highlights | Replays of the day's earlier simulated goals and scores, all day |
| Featured (the big screen) | Gridiron on Sunday afternoons and on Monday and Thursday evenings; otherwise the Marigold League; highlights when nothing is on |

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
- **Resolution and redraw rate** by preset: Low 512 × 288 at 8 Hz, High 1024 × 576 at 15 Hz, Ultra 1024 × 576 at
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
| Final whistle | Winners: "My team won", and a chance to start dancing on a game night. Losers: "My team lost". |

The room's sound swells with the number reacting (see "Audio"). For the player, a big **Cheer** button appears for 8 s
after any moment. Cheering with others nearby counts as a Cheer interaction with each of them, up to 4.

### Dancing on game nights

**When.** Friday and Saturday from 20:00, once the featured match ends, until close.
- The lights over the floor drop to 60%. The jukebox plays the game's own KFWY tracks louder through the room filter.
- The dance spot opens: its advert turns on.

**Who.** NPCs with active > 0.4 and fun under 70 are likely to go. The player taps Dance from anywhere and walks there.

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

| Interaction | Offered when | base | If accepted (rapport Δ; both people) | If not |
| --- | --- | --- | --- | --- |
| Talk | always | 0.75 | +6; social +12; "Great chat" after 3 good exchanges | -3; social +2 |
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
4. Feedback: a small lime "+" spark rising over the head, or a coral "–" puff.

**Talk in detail.** It is Lot 57's exchange:
- A line, then two reply chips, warm or quip.
- Warm adds 2.
- Quip adds 4 if the target is playful above 0.5, and takes 2 otherwise.
- After two or three exchanges they wrap up.

**Joining groups.** Join and Leave work exactly as at Lot 57: the circle opens a gap and turns to you.

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
every 20 sim seconds. A decision scores every advert it could reach, from objects and from the people present:

```
score(A) = Σ_k  w_k · Δ_k(A) · urgency(n_k)          // needs: w from traits; Δ from the advert
         + 20 · affinity(A.tags, traits)               // game × competitive, watch × fan, dance × active·playful, social × outgoing
         + emotion(A) + event(A) + memory(A)           // as above; during a featured match, watch +25·fan;
                                                       // for 60 s after a goal, cheer/high-five/toast +30
         - 0.6 · walk metres - 15 · occupancy - 25 · (leaves a conversation mid-turn)
urgency(n) = 0.2 + 1.8 · ((100 - n) / 100)²          // full 0.2; half 0.65; empty 2.0
```

**How the choice is made.**
- **Sampling.** Take the top three scores and pick one with probability ∝ `exp((s - best) / 8)`. The best usually wins,
  but people aren't robots.
- **Hysteresis.** A continuous action is dropped only if the new best beats it by 25% plus 10.
- **People advertise like objects.** Talk, Joke, Toast and so on, with deltas scaled by rapport and the target's mood.
  So lonely people seek out friends, and playful people tell jokes.
- **The budget.** At most 6 decisions a frame, staggered, each over at most about 80 adverts: under 0.4 ms on desktop.
- **The log.** `__onfoot.decisions(n)` returns the last n decisions: the NPC, the needs, and the top three with scores.
- **The watchdog.** No NPC may sit in one action, or fail to move toward its target, for over 60 sim seconds without a
  reason the log names. A stuck person is moved to the nearest free cell and plans again.

### Conversations and lines

Lot 57's group state machine carries over unchanged: formation, one speaker at a time, listeners turning, nods,
laughter as a group event, idles and mingling. The bar adds the interaction beats above, inside groups.

**Group sizes and places.** Groups are 2 to 6 people. They form at booths, high-tops, the bar and the patio, and in
standing circles by the screens and the games.

**The lines.** Short and original, written by us.
- About 120 lines in S3, growing to about 250, tagged by:
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
  | Host | at the door when s ≥ 0.6, or on a game night | Greets at the door. |
  | Barback | when s ≥ 0.5 | Collects empties. |
  | Cooks (2) | unseen | Hands and plates at the pass. |

  Staff count toward the render budgets, not the crowd.

### The simulated crowd

Target crowd = capacity (130) × the curve below × events × weather × seeded noise (±10%, seeded by venue, date and hour,
as at Lot 57). Capped at 1.0. Parties arrive at random (Poisson), stay, and leave, so the room converges on the target.

| Hours | Mon–Thu | Fri | Sat | Sun |
| --- | --- | --- | --- | --- |
| 09–11 | closed | closed | 20% | 25% |
| 11–14 | 25% | 30% | 35% | 45% |
| 14–17 | 15% | 25% | 50% | 60% |
| 17–20 | 45% | 70% | 80% | 65% |
| 20–23 | 40% | 90% | 95% | 35% |
| 23–24 | 20% | 75% | 80% | 15% |
| 00–02 | closed | 45% (Friday night) | 50% (Saturday night) | closed |

- **Fictional events:**
  - a featured match on the big screen: ×1.25, from 30 minutes before kick-off to the final whistle;
  - Tuesday house darts league, 19:00 to 22:00: ×1.15;
  - Wednesday pool tournament, 19:00 to 22:00: ×1.10.

  None of these is tied to a real game, team or calendar.
- **Weather (the game's simulated weather):** in rain the patio closes and its people move inside (×0.95 overall); fog
  ×0.95.
- **How many you see** is capped by the preset: Low 36 people including staff, High 70, Ultra 100. The rest are "out on
  the patio" or "just left". The chip still reads the target's level.
- **On screen:** the chip, always visible, reads "Simulated crowd · Lively" (Quiet, Easy, Lively, Packed). Tapping it
  says: "Stoppage Time is a fictional sports bar. The crowd, the matches on the screens and the people here are
  simulated from the time of day and the day of the week. Nothing here is live, and nobody here is a real person or
  another player." No head count is ever shown.

### Tokens and saving

**Tokens are house tokens.**
- **Earned:** 50 on your first visit, 5 per game won, 2 for a first good conversation with someone new, and 1 per 5
  minutes in the bar (at most 12 a visit).
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
- **Third person** works as at Lot 57: 2.4 m behind, 0.45 m right, 1.75 m up. Tall colliders pull it in, and the
  avatar fades within 0.7 m. Indoors the boom shortens to 1.8 m, because the ceiling is 3.6 m.
- **Overhead (the build view).** The classic life-sim camera.
  - **Angles.** It looks down at 55° (adjustable 35° to 75°) from 8 to 35 m away.
  - **Moving it.** It rotates freely, or in 45° steps with Q and E or a two-finger twist. It pans with a one-finger
    drag, and pinch zooms. It's clamped to the bar, the patio and the lot.
  - **Walls.** Ceiling and roof are hidden. Walls cut away: any wall whose outward face is toward the camera drops to
    0.9 m, with a capped top edge. The far walls stay full height so the room still reads.
  - **What's on screen.** Tap to go and the radial menus are the controls here; the stick is hidden.
  - **Changing views** takes a 0.5 s move, or a cut with reduced motion.
  - **Arranging furniture is not part of S1 to S4** (see "Roadmap only").
- **Game cameras.** In pool, darts and shuffleboard, your turn moves the camera to the game's own view (above the table,
  behind the oche, behind the puck) and returns it afterwards.
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
- **Voices.** The cap is 12 on Low, 24 on High and 32 on Ultra. HRTF panning on High and Ultra; equal-power on Low.
- **Mix.** Separate volume sliders for the room, the screens, the music and effects.

## Graphics: Low, High, Ultra

The bar meets the maximum-graphics standard Lot 57's P1d sets:
- a sun and sky that follow the clock;
- emissive lights with soft bloom, and budgeted shadow-casting lights at Ultra;
- baked ambient occlusion and light in vertex colours (Lot 57's `Kit.bake`);
- materials made in code (canvas textures, normal maps from height);
- people lit with rim and fill.

The presets are switchable through `setQuality` and a small on-page menu, with frame ms and draw calls measured at each.

| | Low (phones) | High | Ultra (desktop) |
| --- | --- | --- | --- |
| Interior light | All fixtures baked into vertex colour from `Emitter`s (pendants, neon, screens, back bar, LED strip). Emissive surfaces. No real-time lights indoors. | Plus 4 real lights: the two pool pendants as spot lights, a TV-wall fill and the back bar | Plus a rect-area light for the TV wall glow and the back bar. The pool spots cast shadows. Up to 8 real lights. |
| Outdoor light | Sun and sky. Blob shadows. | Sun shadows, 1024 map | 2048 map, soft PCF |
| Post | None | Half-resolution bloom, FXAA | GTAO (or SAO), full bloom, SMAA plus 4× MSAA |
| Materials | Standard materials, 512 px textures | 1024 px. A reflection cube baked once at load from the interior, for wood, brass and glass. | Clearcoat on the bar top and pool rails. Sheen on booth vinyl and cloth. 16× anisotropic filtering. |
| Screens | 512 × 288 at 8 Hz | 1024 × 576 at 15 Hz | 1024 × 576 at 30 Hz |
| People | 1 at LOD 0, 8 nearest at LOD 1, the rest LOD 2 | 3 / 24 / rest | 6 / 40 / rest |
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
says nothing about a phone. The interior is the hard part for phones: everyone in the room is within 30 m, so distance
culling helps less than at Lot 57.

| Budget | Low (phones) | High | Ultra |
| --- | --- | --- | --- |
| Draw calls, whole scene | 150 or fewer | 350 or fewer | 600 or fewer |
| Triangles | 250k or fewer | 700k or fewer | 1.5M or fewer |
| People visible, staff included | 36 | 70 | 100 |
| People at LOD 0 / LOD 1 | 1 / 8 | 3 / 24 | 6 / 40 |
| Venue and street meshes | 70 calls, 80k triangles | 120 calls, 200k | 160 calls, 350k |
| Real-time lights | sun only (on the patio) plus hemisphere | plus 4 | plus 8, 2 shadowed spots |
| Shadow map | none (blob shadows) | 1024 | 2048 |
| Canvas textures | 14 or fewer at 512 px (3 screen channels included) | 20 at 1024 | 20 at 1024 |
| Simulation CPU per frame (needs, AI, crowd, paths, matches) | under 2.5 ms on a mid phone (unmeasured) | under 3 ms | under 4 ms |
| Utility AI | 6 decisions a frame, under 0.4 ms | same | same |
| Audio voices | 12 | 24 | 32 |
| Street data in the page | `sportsbar-slice.json`, 47 KB gzipped (measured) | same | same |
| Code added (the bar and `engine/sim/`) | under 180 KB minified | same | same |
| First frame you can walk | under 6 s on desktop (an estimate), then people build in the background | same | same |

**Where the triangles go on Low.** One LOD 0 person is 71k (Lot 57 measured it on phone), 8 at LOD 1 are 60k, and 27 at
LOD 2 are 41k. That's 172k for people, plus 80k for the venue: 252k. That's right at the limit, so the phone LOD 0 is
used only for the person you're talking to. Lot 57's plan records phone LOD 0 as 18% over its 60k target; if the people
builder reaches that target, the margin returns.

**People are slow to build.** Lot 57 measured 30 people at about 15 s on a desktop CPU.
- The page builds 8 people before the first frame, then 2 at a time in idle slices, LOD 2 first, upgrading as people
  come near.
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
| Credit | "Map data: Overture Maps Foundation, derived from OpenStreetMap contributors (ODbL); Microsoft ML Buildings (ODbL); heights from USGS lidar." |

**Checks** (run in S1 and kept in every later phase):
1. **The real name.** It appears nowhere in `src/`, `src/data/anaheim/sportsbar-*.json` or the built page. The grep uses
   the lookup key from `tools/anaheim/venue.py` with case and punctuation folded. The tooling is the one place it may
   appear.
2. **Real sports names.** No team, league or channel name matches the blocklist.
3. **Honesty words.** The UI strings and canvas text contain no "live", "real-time", "people here now", odds, "bet" or
   currency signs.
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
- **It ends with its checks passing** in Playwright (headless Chromium, SwiftShader, one process at a time; six
  workflows share this machine).
- **Screenshots** go in `tests/out/sportsbar/`, and every one cited is looked at.
- **`npx tsc --noEmit`** must pass.
- **Results** are logged in `PROJECT_OC_PROGRESS.md`. Nothing is marked done on trust.

**Order.** The build follows Lot 57's P1a, as decision 12 orders: the venue, the avatar, controls, collisions and hooks.
S1 starts from the latest `claude/onfoot` commit merged into `claude/sports-bar`.

### S0: plan and data (done in Phase 0)

- **Deliverables.**
  - This plan.
  - S0-data: the bar's slice, the derived lot, the freeway link and the README section in `tools/anaheim/`.
- **Checks.** S0-data's own (Lot 57's outputs byte-identical; the spot checks; the name grep) and this plan's review.

### S1: the venue and the avatar in it

- **Brief.**
  - **The page.** `src/onfoot/sportsbar.html` with its own Vite config (`src/onfoot/vite.sportsbar.config.ts`), so
    neither the game's config nor Lot 57's changes.
  - **The engine facade.** `src/onfoot/engine/`, as in "One engine with Lot 57". It re-exports Lot 57's generic modules,
    with new `schedule.ts`, `frame.ts` and, if needed, `streets.ts`. No edits to `lot57/`.
  - **The venue def.** `venues/sportsbar/def.ts` and `brand.ts` (`BAR_NAME`).
  - **The frame.** Computed from building 61 and checked against the table under "The building frame".
  - **The streets and buildings** from `sportsbar-slice.json`, with building 61 kept as massing and our unit carved
    from it. The other units are generic, with no names.
  - **Our facade, sign and blade sign.** The patio. The courtyard stalls and your stall. The front walk.
  - **The interior,** every fixture placed from the `objects` and `screens` data:
    - the bar, booths, high-tops and window rails;
    - the pool tables, dartboards and shuffleboard, static for now;
    - the TV wall and screens, showing a still "SIMULATED" test card;
    - the restroom and kitchen doors and the pass;
    - the jukebox and water station.
  - **The doors.** The front door opens as you approach; the patio door too.
  - **Closed hours:** locked, dark, and the blade sign reads "Closed · opens …".
  - **Your driver as the avatar.** Walking, tap to go and Sit on every seat.
  - **The three cameras,** the overhead with wall cutaway.
  - **Collisions and the walk grid**, with the 0.15 m slab, the ramp and the patio.
  - **The edge** is the lot, the front walk, the patio and the interior. Past it, a quiet wall and Lot 57's toast.
  - **The chip** (level from the schedule; no people yet), the clock and the credit.
  - **Test hooks** on `window.__onfoot`: `setClock(day, hour)`, `setQuality('low' | 'high' | 'ultra')`, `stats()`,
    `go(x, z)` and `tap(x, z)` (game coordinates), `act()`, `view(mode)`, `frames`, and `frame()` (the building frame's
    O, A and B).
- **Checks.**
  - Boots with no console errors.
  - The frame matches the building-frame table to 0.1 m. The bar's point lands inside our unit.
  - 1,000 random walks through the hooks never end inside a collider or cross a wall, the patio fence or the party
    wall.
  - Tap to go reaches every one of the 94 seats. Sit and stand work on each kind.
  - Closed hours: the door is locked; the lot is walkable.
  - The honesty checks (above): the real name, the places file, the credit visible.
  - Low within its venue budget: 70 calls and 80k triangles for the meshes, from `stats()`.
  - Lot 57's page still builds, and its checks pass unchanged.
- **Screenshots.**
  - 1280 × 720, 844 × 390 and 390 × 844.
  - Noon and Saturday 21:00.
  - First person from the door, at the bar, toward the TV wall, and at the pool tables.
  - Third person on the patio.
  - Overhead with the walls cut away.
  - The exterior from the lot at night.
- **Look at them:** does it read as a believable neighbourhood sports bar in a SoCal strip, not a grey box?

### S2: needs and object interactions

- **Brief.**
  - **`engine/sim/`:** needs, moods and moodlets, personality, the smart-object catalogue and adverts, reservations,
    the action queue, held items.
  - **The player's UI:** the needs strip and panel, the mood face, the queue icons, the radial menu for objects.
  - **Ordering:** at the counter, and table service with one bartender and one server as scripted staff (full staff
    in S3). Our menu, eating and drinking.
  - **Games:** playable pool, darts and shuffleboard against a scripted house opponent.
  - **The screens:** the TV system (leagues, seeded schedule, match models, broadcast canvases, the guide card, "Pick a
    side").
  - **Watching** for fun.
  - **The jukebox and the water station.**
  - **The dance spot on game nights** (the player only, in S2).
  - **Tokens and saving.**
  - **New animation clips** on the people builder's rig: drink, eat, pool stance and shot, dart throw, shuffleboard
    slide, dance ×3, cheer, groan, clap.
    - The new clips go through a small, additive API: new `AnimName`s, and an upper-body overlay so a seated person can
      cheer.
    - If a clip can't be made to look right, ship the rest and write the clip up in `PROJECT_OC_HANDOFF.md` for the
      design review queue.
  - **Hooks:** `needs()`, `setNeeds()`, `mood()`, `use(objectId, action)`, `queue()`, `tv()` (fixtures, scores,
    events), `setTimeScale(k)`, `fastForward(min)`, `tokens()`.
- **Checks.**
  - Needs decay at the table's rates: fast-forward 10 sim minutes, and every need is within ±1 of the formula.
  - Each action works end to end through the hooks, with the needs moving the right way:
    - order a drink: wait, hold, sips raise thirst;
    - order food at a table: a server comes, the food arrives, eating raises hunger;
    - a pool game, a darts game and a shuffleboard game each complete with a winner, the moodlets and tokens;
    - watching raises fun;
    - the jukebox and water;
    - Dance only on game nights.
  - Pool physics: energy never grows, no ball ever leaves the table, and 500 random breaks all settle in under 20 s.
  - The same clock gives the same fixtures and scores twice. Every screen frame has "SIMULATED"; no frame says "LIVE".
  - The menu: alcohol-free for the player, no prices. The blocklist test passes.
  - Saving round-trips, and the page works with storage blocked.
- **Screenshots.**
  - The needs panel open (390 × 844, 844 × 390).
  - The radial menu on the bar, ordering, and holding a drink in first person.
  - A pool shot overhead, darts, and shuffleboard.
  - The TV wall with a match and a GOAL banner, and the guide card.
  - A game-night dance at 1280 × 720.

### S3: people: NPC autonomy, conversations and relationships

- **Brief.**
  - **The crowd.** Spawning by the schedule: the persistent regulars and walk-ins, arrivals from the lot and the
    drop-off.
  - **Autonomy.** The utility AI over the same adverts. People advertise social actions.
  - **Groups.** Lot 57's talking groups with the bar's interaction beats. The player's radial menu for people: every
    interaction in the table, including Introduce and Buy a round.
  - **Relationships** with memory, persistence for regulars, people cards and the People here list.
  - **Moods and emotions** on faces and bodies.
  - **Crowd reactions** to the screens.
  - **Staff:** bartenders, servers, host and barback on the job queue; the cooks' hands at the pass.
  - **Restroom visits.**
  - **Lines:** about 120 in S3.
  - **Hooks:** `people()`, `rel(id?)`, `interact(targetId, kind)`, `decisions(n)`, `seed(n)`.
- **Checks.**
  - **Needs drive choices.** Among NPCs with thirst under 30, at least 70% choose a drink action within their next two
    decisions. Likewise hunger and food, and fun and a fun action.
  - **No stuck people.** No NPC stuck over 60 sim s across a 30 sim-minute fast-forward at Saturday 21:00. No slot is
    ever over capacity.
  - **Conversations.** In every sampled group, at most one speaker at a time, and listeners face the speaker in at least
    70% of samples (Lot 57's check).
  - **Reactions.** A goal event makes at least 60% of the scoring team's fans in view react within 1 s, and none of the
    people who can't see a screen.
  - **Relationship maths.** Unit tests against the formulas: rapport and friendship updates, decay, the memory ring of
    8, highlights, the level thresholds. Persistence round-trips across a reload.
  - **The crowd by clock.**
    - Tuesday 15:00 has fewer people than Saturday 21:00.
    - Closed hours have nobody inside.
    - Staff counts follow the share.
    - The visible count never passes the preset cap.
  - **Budgets.** Low within its budgets with 36 people, from `stats()`. Simulation ms is reported.
- **Screenshots.**
  - A Saturday 21:00 goal, before and after (1280 × 720 and 390 × 844).
  - A conversation with the radial menu open, and a person's card.
  - Buying a round, and a toast.
  - The overhead view of a packed Friday.
  - A Tuesday 15:00 quiet afternoon.

### S4: maximum graphics and polish

- **Brief.**
  - **The graphics table:** Low, High and Ultra (above), on the P1d standard and the shared `engine/quality.ts` and
    `post.ts`. The lighting design and the code-made materials. The I-5 light streams. The night exterior and the neon.
    People lit with rim and fill.
  - **Then polish:**
    - the transitions, the audio mix and the dance-night lighting;
    - the reduced-motion and text-size settings;
    - the remaining lines, to about 250;
    - a performance pass.
  - **E0** (the move into `engine/`) if Lot 57's P1d has been committed by then; otherwise it's left as the first task
    of whoever next touches both venues.
- **Checks.**
  - **Screenshots** at 1280 × 720 and 390 × 844 at noon, golden hour and Saturday 21:00, at Low, High and Ultra: inside
    at the TV wall, the bar, the pool tables, the patio toward the freeway, and the exterior from the lot.
  - **Before and after** against S3's shots.
  - **`stats()`** at each preset within its column of the budgets.
  - No console errors, and the honesty checks.
  - **If E0 ran,** Lot 57's checks are unchanged after it.
- **Look at every screenshot:** would a player stop and take a photo of it?

## Risks

- **Scope.** A life sim is a huge genre.
  - This is a slice: one bar, five needs, about a dozen object actions, eleven social interactions, two fictional
    leagues and three games.
  - Each phase ships something playable.
  - If time runs short, cut lines and polish before cutting systems. Fewer interactions done well beat more done badly.
- **Two workflows, one engine.**
  - Lot 57's files are moving under the bar's feet.
  - The guard: S1 to S3 only import (`engine/` as a facade), and E0 is one mechanical move after P1d, checked by Lot
    57's own tests.
  - If Lot 57's APIs change before E0, the bar adapts; Lot 57 doesn't.
- **People are slow to build and costly indoors.** At about 0.5 s per person on a desktop CPU, phones are slower.
  Progressive building, reused bodies and the LOD caps are the plan. Low's triangle budget is tight (see the budgets).
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
- **Honesty drift.** Broadcast graphics invite "LIVE" in the corner. The checks grep for it on every screenshot run.

## Data sources and licences

From Overture Maps release `2026-09-23.1`, as recorded in the slice's `licences`:

| Theme / type | Used for | Licence in the rows | In the page? |
| --- | --- | --- | --- |
| `transportation/segment`, `connector` | Streets, aisles, driveways, footways, speed limits | ODbL-1.0 (OpenStreetMap; 23 pieces also list TomTom, ODbL-1.0) | Yes, credited |
| `buildings/building` | Footprints and heights, building 61 | ODbL-1.0 (OpenStreetMap 560, Microsoft ML Buildings 123). USGS lidar heights (119) carry no licence string; USGS 3DEP data is US public domain. | Yes, credited |
| `base/land_use`, `water`, `infrastructure` | The substation, power poles, signals, crossings, bridges, fences | ODbL-1.0 (OpenStreetMap) | Yes, credited |
| `base/land_cover` | Ground cover | CC-BY-4.0 (ESA WorldCover) | Yes, credited |
| `places/place` | Locating the real bar only | CDLA-Permissive-2.0 (Overture, Meta, Overture signals) | **No** |
| Game terrain | Ground height | As in `tools/oc-network/README.md` | Already in the game |

The credit line is the game's (see "Honesty labels"). Not used: Google Maps, Apple Maps, or any photo of the real bar.

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
  3,031 m² across S0-data's runs while this was written.
- **The stall estimate** comes from the lengths of aisle 415's legs and the clear depth beside them, at 2.75 m × 5.5 m
  per stall. It's ours, not the data's.
- **Streets, speeds, the substation, the bridge and signals** were read from the slice and from the Overture cache in
  `tools/anaheim/data/` (`segments-5km.parquet`, `city-building.parquet` and `slice-infrastructure.parquet`).
  Distances are from the bar's point to each feature's nearest edge, in game metres.
- **Ground heights** were sampled from the terrain grid in `src/data/oc-network.json`, decoded as
  `Network.decodeTerrain()` does it, with bilinear lookup. The site's range is from every 2 m grid point inside building
  61 or the derived lot (1,487 points).
- **Our unit and the patio** were tested against building 61 with shapely:
  - The unit (u 0 to 36) has an area of 529 m², all of it inside the footprint, and so does every interior zone in the
    "Inside" table.
  - The patio has an area of 99 m² and doesn't overlap the building. 25 m² of it lies in the derived lot, and it's 4.2 m
    from aisle 416's centreline.
- **The railway's distance** is the nearest rail piece in the slice to the bar's point.
- **Exits and routes** come from `src/data/anaheim/sportsbar-freeway-link.json`.
  - The signals on each route are the slice's `transportation:traffic_signals` points within 20 m of the decoded route
    polyline.
  - The route turns were read from the decoded polyline of the I-5 North route.
- **Sizes:** `sportsbar-slice.json` is 133,418 bytes, 47,248 gzipped at level 9.
- **The name searches** were one web search per candidate on 2026-10-21. Their results are in "The name".
- **Lot 57's figures** (people LOD costs, build times, the phone LOD 0 triangle count) are quoted from
  `PROJECT_OC_ON_FOOT.md`, measured there on 2026-10-14.
