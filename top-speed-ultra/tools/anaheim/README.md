# Anaheim street and building data

Builds the data for the on-foot mode: a 3 km walkable slice of Anaheim's stadium district around our own fictional
hangout, a city-wide street layer, and the link from the game's freeway exits to the venue.

The venue is ours. The real taproom at that spot is used only to find a point in open data. No real business name,
sign, menu or trade dress goes into the data. Street names do, because they are public facts.

## Outputs (`src/data/anaheim/`)

| File | Size | What's in it |
| --- | --- | --- |
| `slice.json` | 720 KB | Every transportation segment, connector, building, building part, place (category and point only), land use, water area, infrastructure feature and land-cover piece in a 3 km x 3 km box around the venue |
| `streets-city.json` | 1.15 MB | Anaheim's street centrelines (motorway to residential) clipped to the city limits, with class, name, one-way and intersections, plus the city boundary |
| `freeway-link.json` | 10 KB | The game freeway exits near the venue (path ids into `src/data/oc-network.json`) and the real streets from each ramp to the venue lot |

### Format

All three files share the same format:

- Coordinates are the game's own: x east and z south, in metres from 33.72 N, 117.83 W. The projection is
  `tools/oc-network/common.py` `proj`, so everything lines up with `oc-network.json`. The spot checks below confirm
  the freeways sit within a median of 0.3 m.
- Points are stored as integer decimetres and delta-coded per geometry. The first pair is absolute and each later
  pair is the step from the one before. `conn` (the connector list) is delta-coded as one long run.
- Classes, subclasses, names and categories are indices into `dict`. Each file has a `keys` block that documents
  every field.

To decode, keep a running sum and divide by 10:

```js
const pts = []; let x = 0, z = 0;
for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; pts.push([x / 10, z / 10]); }
```

**`slice.json` segment fields:**
- `c` is the class, written as `rail:<class>` for rail.
- `s` is the subclass: sidewalk, crosswalk, parking_aisle, driveway, link or alley.
- `n` is the name and `r` is the route (CA-57, I-5).
- `k` holds [vertex, connector] pairs, the intersections.
- `sp` is the speed limit in mph.
- `w` is the width in metres.
- `ow` is one-way: 1 means along the points, -1 means against them.
- `nf` means foot traffic is denied.
- `lv` is the OSM level. It's an int, or [from, to, level] fractions of the piece.
- `br`, `tn`, `lk`, `cv` and `uc` mark bridge, tunnel, link, covered and under construction. 1 means the whole
  piece, otherwise [from, to] fractions.

**`slice.json` building fields:**
- `p` is the outer ring, counter-clockwise, and `hl` holds the holes.
- `h` is the height in metres and `mh` is the minimum height.
- `f` is the number of floors.
- `c` is the class and `t` is the subtype.
- `r` is the roof shape.
- `lid` means the height came from USGS lidar.

**`slice.json` venue fields:**
- `x` and `z` are the point.
- `bld` is the building it stands in.
- `lot` indexes `infra` for the nearest mapped parking area, 11 m away and 1,104 m2.

## Sources and licences

The data comes from Overture Maps release `2026-09-23.1` on `overturemaps-us-west-2`. The scripts make HTTP range
reads of only the parquet row groups whose bbox statistics intersect, never whole files. Nothing comes from Google
Maps.

The licences below are the ones Overture lists in each record's `sources`, counted over the rows fetched for the
slice. `slice.json` repeats them under `licences`.

| Overture type | Sources (records) | Licence |
| --- | --- | --- |
| transportation/segment | OpenStreetMap (4,112), TomTom (159) | ODbL-1.0 (both, as listed) |
| transportation/connector | OpenStreetMap (4,667) | ODbL-1.0 |
| buildings/building | OpenStreetMap (3,164), Microsoft ML Buildings (472) | ODbL-1.0 |
| | USGS Lidar (752, heights) | No licence string in Overture. USGS 3DEP data is US public domain. |
| buildings/building_part | OpenStreetMap (5) | ODbL-1.0 |
| places/place | Overture, meta, Overture-signals, BrightQuery, Microsoft, DAC, PinMeTo | CDLA-Permissive-2.0 |
| | Foursquare (170) | Apache-2.0 |
| | AllThePlaces (27) | CC0-1.0 |
| base/land_use, water, infrastructure | OpenStreetMap | ODbL-1.0 |
| base/land_cover | ESA WorldCover (6) | CC-BY-4.0 |
| divisions/division_area (the city limits) | OpenStreetMap | ODbL-1.0 |

Credit line, also in each file's `attribution`: "Overture Maps Foundation; OpenStreetMap contributors (ODbL);
Microsoft ML Buildings (ODbL); USGS 3DEP; ESA WorldCover (CC BY 4.0); places CDLA Permissive 2.0."

Overture's `2026-09-23.1` segments have **no lane counts**. The OSM API and Overpass are blocked from this build
machine (proxy 403), so lanes could not be joined from OSM either. `width_rules` exist on only a few segments. The
game has to pick lane counts by class.

## Run it

```bash
pip install -r requirements.txt   # pyarrow, shapely, requests, numpy, pillow
python3 scan.py transportation segment   # and: transportation connector, buildings building, buildings building_part,
                                         # places place, base land_use, base water, base infrastructure,
                                         # base land_cover, divisions division_area  (footers only; data/hits-*.json)
python3 venue.py         # finds the spot -> data/venue.json
python3 fetch_slice.py   # range-reads the slice box -> data/slice-*.parquet (about 6 s)
python3 build_slice.py   # -> src/data/anaheim/slice.json, data/slice-counts.json
python3 city.py          # city limits, streets-city.json, city-wide cost -> data/city-measure.json (about 40 s)
python3 link.py          # -> src/data/anaheim/freeway-link.json
python3 verify.py        # spot checks -> data/verify.json
python3 render.py        # -> tests/out/onfoot/data-overview.png, data-venue.png, data-city.png
```

`ana.py` holds the shared code:
- the game projection, loaded from `tools/oc-network`
- `RangeFile`
- `fetch(theme, type, bbox, columns)`
- the slice box
- the decimetre and delta encoders
- the street-name filter

`data/` is a gitignored cache, about 57 MB.

## How the venue spot was found

`venue.py` searches Overture places for records whose address contains "2210" and "Orangewood". It finds three, all
within 11 m of each other: a brewery, a pub and a hot-dog stand that share the site. It takes the brewery-category
record with the highest confidence:
- id `965183c5-f3ad-4774-9b81-a40e6b7fb2ac`
- confidence 0.985
- lon -117.885310, lat 33.795473
- game x -5121.2, z -8345.4

Only that point is kept. The three real place records are dropped from the slice's places.

The point falls inside a mapped building that is 7 m tall (slice building 1589), 73 m south of the Orangewood Ave
centreline.

## Slice contents (last run)

The box runs from the venue -1,500 to +1,500 m east and -1,800 to +1,200 m south: game box
(-6621, -10145, -3621, -7145). That's 3 km x 3 km. It reaches Katella Ave and the arena to the north, the CA-57,
Douglass Rd and the Santa Ana River to the east, State College Blvd and the I-5 to the west and south-west, and
Chapman Ave to the south.

**Segments.** There are 2,891 segment pieces, clipped to the box.

| Class | Pieces |
| --- | --- |
| service | 1,518 (602 parking aisles, 145 driveways, 6 alleys) |
| footway | 495 (166 sidewalks, 57 crosswalks) |
| residential | 237 |
| unknown | 152 |
| tertiary | 116 |
| primary | 110 |
| motorway | 96 (73 of them links) |
| secondary | 62 |
| rail | 41 |
| unclassified | 23 |
| cycleway | 18 |
| steps | 16 |
| path | 3 |
| bridleway | 3 |
| pedestrian | 1 |

They meet at 4,443 connectors. Every connector landed on a vertex: 0 misses.

**Street names.** There are 140 street names. 73 names on service roads, footways and rail lines were dropped
because those are often named after a business. In this slice, one driveway carried the taproom's own name.

**Buildings.**
- 2,928 buildings, counted by centroid in the box.
- 2,497 have a height (642 of those from lidar) and 64 have floors.
- 4 have a roof shape.
- 5 building parts.
- 1 tall sign structure mapped as a building is reclassed `sign_structure`.

**Places.** 2,610 places, category and point only. Places with confidence below 0.5 (261) and places not open
(215) are left out.

**Other features.**
- 213 land-use polygons.
- 123 water features.
- 430 infrastructure shapes: parking areas, bridges, kerbs, fences, power lines.
- 1,400 infrastructure points: crossings, signals, stops, bus stops, benches, lamps, hydrants.
- 2 land-cover pieces.

## City-wide cost (all of Anaheim, inside the city limits)

The city limits are Overture division_area `b963ed79-44ba-4d2a-94a3-055fedb5640f`, the locality "Anaheim", 131.3
km2. Sizes use the same encoding as the slice.

| Layer | Segments | Connectors | km | KB | KB gzip |
| --- | --- | --- | --- | --- | --- |
| main streets (motorway to tertiary) | 3,030 | 6,613 | 580 | 379 | 127 |
| main + local (adds residential, unclassified, living street): **`streets-city.json`** | 10,000 | 15,700 | 1,366 | 1,118 | 355 |
| main + local + service | 21,698 | 31,875 | 2,557 | 2,272 | 735 |
| every segment (adds footways and rail) | 28,837 | 41,117 | 3,242 | 3,133 | 1,023 |
| buildings | 74,312 (65,785 with height) | | | 6,473 | 2,113 |
| main + local + buildings | | | | 7,591 | 2,468 |
| everything + buildings | | | | 9,606 | 3,136 |

## The freeway link (`freeway-link.json`)

The game has no surface streets. `link.py` takes the game's exit ramps near the venue and finds the street
connector each one touches, its ramp terminal. It then routes over the slice's drivable graph to the venue lot. The
route obeys one-way tags and weights side streets and lot aisles so arterials win.

| Freeway | Sign | Ramp path | Terminal on | Drive to lot | Streets |
| --- | --- | --- | --- | --- | --- |
| CA-57 S (path 9) | Orangewood Avenue | 1142 | East Orangewood Ave | 804 m | East Orangewood Ave, South Dupont Dr, lot aisle |
| I-5 N (path 0) | State College Boulevard / The City Drive | 1264 | South State College Blvd / Anaheim Way | 810 m | South State College Blvd, East Orangewood Ave, South Dupont Dr, lot aisle |
| CA-57 N (path 8) | Orangewood Avenue | 562 | West Orangewood Ave (city of Orange side) | 974 m | West Orangewood Ave, East Orangewood Ave, South Dupont Dr, lot aisle |

The file also lists the farther exits:
- Chapman Ave, 1,440 m
- Gene Autry Way, 1,686 m
- Katella Ave, 2,437 to 2,836 m

The router's shortest legal route from the CA-57 Katella terminals turns around via Douglass Rd. That has not been
checked against real turn rules.

**For the game team.**
- In the game network, CA-57 ramps 562 and 1142 are each one path from the freeway, past Orangewood and back on: OSM
  joins the off-ramp and the on-ramp at the street node.
- The street terminal is mid-path:
  - 562 at about s = 410 m, 1.8 m from the centreline.
  - 1142 at s = 356 m.
- I-5 N ramp 1264 ends at its terminal, s = 532 m.
- Each exit entry carries the route polyline (`route.p`) for a guidance line.

## Spot checks (`verify.py`, last run: 12 of 12 pass)

**Street directions.**
- East Orangewood Ave runs east-west, bearing 179 deg. It's 69 m north of the venue.
- South State College Blvd runs north-south, bearing 88 deg. It's 365 m west of the venue.
- East Katella Ave runs east-west, bearing 7 deg, about 977 m north of the venue.
- East Gene Autry Way runs east-west between them, 470 m north of the venue.
- South Douglass Rd bends north-east (bearing 52 deg) from Katella toward the arena, east of the CA-57.

**Freeway positions.**
- The CA-57 runs north-south, bearing 87 deg. Its mean is 571 m east of the venue, east of the stadium centroid,
  which is 242 m east of the venue.
- The I-5 runs NW-SE, bearing 130 deg, in the south-west of the slice.

**Landmarks.**
- The stadium footprint's centroid is 17 m from the stadium's published coordinates (33.8003 N, 117.8827 W).
- A 14,015 m2 footprint sits on the arena's published point (33.8078 N, 117.8766 W).

**Game freeways.** The game's CA-57 paths 8 and 9 lie on Overture's CA-57 centrelines: median 0.3 m, max 4.0 m over
293 samples. The I-5 paths 0 and 1 lie on Overture's I-5: median 0.0 m, max 0.7 m.

**Renders.** `tests/out/onfoot/data-overview.png`, `data-venue.png` and `data-city.png` have been looked at:
- The streets, freeways, river, stadium, arena and venue sit where the checks say.
- The Anaheim outline has its long east-west shape, with the hills to the east.

## Notes

- Some real street names contain brand-like words, such as "Via Ferrari", a residential street in Anaheim Hills. They
  are real street names. Whether to show them on screen is the game team's call.
- The building names in Overture (the stadium, a hotel, a tower) are not written out. Only footprints, heights and
  classes are.
