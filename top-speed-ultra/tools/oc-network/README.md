# OC network builder

Builds `src/data/oc-network.json`, the real Orange County freeway network the game drives on.

## What goes in

- **Freeway geometry** comes from Overture Maps' `transportation/segment` theme (release `2026-09-23.1`). That theme
  is derived from OpenStreetMap, under the ODbL. The scripts range-read only the parquet row groups that cover
  Orange County, about 130 MB. They keep motorways, motorway links, trunks and the primary, secondary and
  tertiary streets that cross the freeways.
- **Elevation** comes from AWS Terrain Tiles (Terrarium PNG, zoom 13, about 16 m a pixel). The US sources are
  USGS 3DEP and NED. There are 324 tiles, about 25 MB.

Nothing is copied from Google Maps or any other proprietary map.

## What comes out

One JSON file, about 2.3 MB:

- **`paths`**:
  - 20 carriageways, the ten freeways in both directions: I-5, I-405, CA-91, 55, 57, 22, 73, 133, 241 and 261.
  - 1,247 ramp pieces.
  - Each path holds simplified control points (x, z, y in decimetres, delta-coded) and a lane count.
- **`junctions`**: where paths meet, as (path, control-point index) pairs.
- **`signs`**: OSM `destinations` labels at every diverge, for the green guide signs.
- **`overpasses`**: 247 real street bridges over the freeways.
- **`terrain`**: a 60 m elevation grid, int16 in quarter metres, row-delta coded, gzipped, then base64.

Local coordinates: x is east and z is south, in metres from 33.72° N, 117.83° W (equirectangular).

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scan.py           # find the row groups that cover OC
.venv/bin/python fetch.py          # motorways and ramps
.venv/bin/python fetch_streets.py  # crossing streets (for the overpasses)
.venv/bin/python fetch_dem.py      # elevation tiles
.venv/bin/python build.py ../../src/data/oc-network.json
```

## What `build.py` does

1. **Carriageways.** Picks the longest chain of each route's motorway segments, per direction. Northbound and
   eastbound count as forward.
2. **Ramps.** Collects every link edge reachable from those chains within 5 km. It splits them into pieces between
   junctions, and gives two lanes to the pieces that join two freeways.
3. **Smoothing.** Resamples every path at 2 m and smooths it with a 80 m window for freeways and 18 m for ramps.
   Junction points stay pinned.
4. **Push-apart.** Pushes paired carriageways apart wherever their pavements would overlap.
5. **Engineered profiles.** Starts from the bare earth: a morphological close then open over 320 m bridges dips and
   cuts humps. Grades are capped at 5.5% for freeways and 8% for ramps, with vertical curves.
6. **Grade separation.**
   - Where a freeway crosses a freeway, the upper one (by OSM `level`) is lifted to clear the lower by 7.2 m.
   - Ramps are solved as one elastic network. They're pinned where they overlap the freeway they leave or join,
     and must clear every crossing by 7 m.
7. **Checks.** Prints the clearance at every crossing, the height step at every junction, and the steepest grades.

Last run:
- 502 of 506 crossings clear 6.5 m.
- The largest junction step is 0.29 m.
- Freeway grades stay under about 7% everywhere except two lifts.
