# Project OC: on foot

This is the plan for getting out of the car and spending time at hangout spots, starting with one venue in Anaheim. It
answers the owner's ask: "get out and socialize in local hangout spots like Golden Road ... and map it exactly with
the streets of Anaheim", and the master prompt's item: a Sims-like walkable world with NPCs that look like they're
talking and simulated crowds, never claiming live occupancy.

**Status (2026-10-13): planned.** A prototype is being built in `src/onfoot/` alongside this plan, and the Anaheim
data in `tools/anaheim/` and `src/data/anaheim/`. This doc doesn't report on them; check `PROJECT_OC_PROGRESS.md`
for what's built and verified. Every number below was measured from open data on 2026-10-13 unless it's marked as a
target, an estimate or a choice of ours. How each was measured is at the end.

## Ground rules

- **Our own venue.** The hangout is fictional: our name, our sign, our building, our layout, our menu. No real
  business name, logo, sign, menu, interior or trade dress appears on screen. The real taproom was used only to find
  the spot in open data. This plan was written from open map data alone; no photos of the real venue were used.
- **Real streets are fine.** Street names and geometry are public facts. They come from OpenStreetMap through Overture
  Maps, credited (ODbL). Never Google Maps.
- **Nothing is live.** Crowds, NPCs, events, hours, signal timings and street traffic are simulated, from the time of
  day and the day of the week, and the screen says so. No live occupancy, no live events, no multiplayer.
- **No real money.** Ordering is free and only changes what you're holding. Credits aren't spent here.
- **Made in code.** Every model, texture, animation and sound is generated in code. No downloaded models, textures,
  voices or motion capture.
- **The player doesn't drink and drive.** The player's menu is alcohol-free (sodas, aguas frescas, coffee,
  non-alcoholic beer, food), because you drove here and you'll drive away. NPCs may hold pints as part of the scene.

## The venue: Lot 57

**Lot 57 · Taproom & Yard** is our own hangout: a converted 1960s tilt-up warehouse in a business park, with a
string-lit yard, lawn games and a food-truck bay, a few minutes off the 57. The name nods to the freeway you exit
from; route numbers are public facts. A web search on 2026-10-13 found no taproom, brewery or beer garden called
"Lot 57" in Orange County. Search again before anything ships.

**Character.** Where drivers end the night. People pull in, park where they can see their car, and stay for an hour.
It's loud in a friendly way: groups at long tables, a bag-toss game that's been going all evening, the stadium's
lights to the north-north-east (plain, unnamed massing in our world), the hum of the 57. Weekday afternoons are quiet; Friday and Saturday
nights are packed (simulated, see below).

**Identity (ours, distinct from any real venue):**
- Palette: night teal `#12333A`, lamp cream `#F3E6C4`, signal red `#C8462F`, patina green `#4F7F6A`, brick
  `#8E4A36`. No gold-and-black.
- The sign: a steel pylon at the Orangewood and Dupont corner with a lit cabinet (4.2 m × 2.9 m, its top at about 7.2 m). "LOT 57" in tall condensed
  capitals, cream on teal; "TAPROOM · YARD · TRUCKS" below in red. The glyph is three lane lines converging on a
  single bulb. Drawn in canvas at load.
- The building, "the Shed": brick-red tilt-up walls, a five-tooth sawtooth roof facing north, four roll-up doors
  onto the yard.
- Inside: a 16 m bar along the west wall with 20 stools, a tap wall of plain coloured handles (no marks), stainless
  tanks behind glass at the south end, high-tops, and a chalkboard menu of our own items. One screen shows the game's
  own leaderboard, labelled "Local leaderboard · this device only", as the game does.
- The trucks are ours too: **Two Lane Tacos** and **Night Shift Noodles** (names to be searched before release, like
  the venue's).
- House music is the game's own radio (KFWY 96.9 Freeway FM, composed in code) through a small-speaker filter.

### Where it sits

The spot is on the south side of East Orangewood Avenue, inside the block wrapped by the loop of South Dupont Drive,
in Anaheim's stadium district. Game coordinates (x east, z south, metres from 33.72° N, 117.83° W, as the game
uses):

| Feature | Where (x, z) | From the data |
| --- | --- | --- |
| Venue anchor | (-5121, -8345) | The open-data point used to locate it. The two place records for that address are 10 m apart. |
| Ground height | 45.1 m | The game's own terrain. A 400 m × 300 m box round the site spans 43.8 to 46.1 m: flat. |
| East Orangewood Avenue | centreline z ≈ -8419 | Secondary, 40 mph limit in the data. Mapped sidewalks at z ≈ -8404 (south) and -8436 (north): about 30 m kerb to kerb. Split into two carriageways west of Dupont. |
| South Dupont Drive | west leg x ≈ -5162, east leg x ≈ -5032 | A 596 m loop south of Orangewood; a residential leg runs north to z ≈ -8612. |
| Signals on Orangewood | Dupont (-5165, -8419); stadium entrance (-4812, -8399); State College (-5482, -8420) | Mapped traffic-signal points. |
| Crosswalks | across Orangewood at x ≈ -5152; across Dupont north leg at z ≈ -8439; across the east leg at z ≈ -8402 | Mapped crossing ways. |
| Santa Ana River bridge | Orangewood, x ≈ -4619 to -4511 (about 108 m) | Bridge flag on the Orangewood segment; the river is in Overture's water theme. |
| CA-57 | x ≈ -4430 at Orangewood | On a bridge over Orangewood (the motorway segment's bridge flag). |

The real buildings on the venue's part of the block (one 2,607 m² building and four small roofed structures) are
removed from our data and replaced by our own layout. The rest of the block (business-park buildings and the lot
aisles) stays as the data has it, rendered as generic buildings with no names.

### Site plan

North is up (toward Orangewood). World coordinates; all sizes are our design.

```
                 East Orangewood Avenue (about 30 m kerb to kerb, 40 mph)
 ==============================================================================
   sidewalk          crosswalk x~-5152                            sidewalk
 +--SIGN---planter wall-----------[ GATE ]-----------planter wall-----------+
 | +------------+  :  .  .  .  .  .  .  .  .  .  : +--------------------+  |
 | |  THE SHED  |  :  T     T     T    string     : |  LAWN: bag toss x3,|  |
 | |  taproom   |  :  T     T     T    lights     : |  block tower       |  |
 | |  bar, tanks|  :  T     T     T    over the   : +--------------------+  |
 | |  high-tops |  :  T     T     T    yard       : |  TRUCK 1  TRUCK 2  |  |
 | +------------+  :  .  .  .  .  .  .  .  .  .  : |  picnic tables     |  |
 +--------------------------[ lot gate ]-----------+--------------------+--+
 |  stalls  [][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][]  |
 <== aisle z~-8323 =========================================================> to Dupont east leg
 |  stalls  [][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][]  |
 |  stalls  [][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][]  |
 <== aisle z~-8303 (entry from Dupont west leg) ==============================
 |  stalls  [][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][]  |
 +--------- rest of the business park (generic buildings from footprints) --+
 ^ South Dupont Drive, west leg (x~-5162)          east leg (x~-5032) ^
```

| Part | Extent (x, z) | Contents |
| --- | --- | --- |
| Frontage | z ≈ -8398, x -5148 to -5048 | Low brick planter wall, 8 m front gate at x -5104 to -5096, the sign at (-5151, -8398), its cabinet turned 45° to face the corner and Orangewood. |
| The Shed (taproom) | x -5148 to -5120, z -8394 to -8342 | 28 m × 52 m. Bar and 20 stools, 6 high-tops, tank wall, chalkboard menu. |
| The yard | x -5120 to -5078, z -8394 to -8342 | 12 communal tables in three rows of four, 8 seats each (96). 8 light poles, 6 m tall, about 300 bulbs on catenaries. 4 patio heaters. |
| Lawn | x -5078 to -5048, z -8394 to -8366 | Turf. Three bag-toss lanes, a giant stacking-block table, two clusters of lawn chairs. |
| Food-truck bay | x -5078 to -5048, z -8364 to -8342 | Two trucks with windows facing the yard, a third slot for busy nights, 4 picnic tables (24 seats). |
| Lot | x -5153 to -5042, z -8336 to -8290 | About 120 stalls in four rows on the two mapped aisles. Entries from Dupont where the mapped driveways are. "Your" stall is the one nearest the lot gate. |

Fictional capacity: 220 people. Fictional hours: Monday to Thursday 11:00 to 23:00, Friday and Saturday 11:00 to
01:00, Sunday 10:00 to 21:00. When it's closed the yard is dark, the gate is shut and the sign reads "Closed · opens
11:00"; you can still walk the lot and the sidewalks.

## Getting there

Three of the game's exits lead here most directly. Each ramp ends at a real street, and the real streets lead to
the lot. The route lengths come from the data workflow's `src/data/anaheim/freeway-link.json`; I checked
the ramp ids, their junctions and where they meet Orangewood against `src/data/oc-network.json`.

| From | Exit (sign text from OSM) | Game ramp | Ramp meets the street | Then | To the lot |
| --- | --- | --- | --- | --- | --- |
| CA-57 South | Orangewood Avenue | 1142 (leaves path 9 at control point 554) | Orangewood, 356 m down the ramp, west of the freeway | Right onto East Orangewood, over the Santa Ana River bridge, past the stadium-entrance signal, left at the South Dupont Drive signal, first left into the lot | 804 m (0.50 mi) |
| I-5 North | State College Boulevard / The City Drive | 1264 (leaves path 0 at 1698) | State College Boulevard, 532 m down the ramp | North on South State College Boulevard about 390 m, right on East Orangewood about 320 m, right at Dupont, first left | 810 m (0.50 mi) |
| CA-57 North | Orangewood Avenue | 562 (leaves path 8 at 25) | Orangewood, 410 m along, east of the freeway, where the data names it West Orangewood Avenue | Left (west), under the 57, then as from the 57 South | 974 m (0.61 mi) |

The CA-57 South exit is the default: one right turn and one left.

**What the game does about it, in two steps:**

1. **First (phase 3a): a fade.** The game has no surface streets yet; today a street ramp moves you to a nearby
   on-ramp. "Lot 57" becomes a navigation destination. The route ends on one of the three ramps. About 80 m before
   the ramp meets the street, or when you tap the "Lot 57" prompt on any of those ramps, the screen fades for about
   a second and your car is parked in your stall. A toast says so plainly: "Drove Orangewood Ave to Lot 57 · street
   driving isn't built yet."
2. **Then (phase 3b): drive it.** The 804 m from the 57 South ramp, on the real geometry, with the three signals,
   then turn into the lot and park. This is the first piece of the roadmap's "City expansion" item.

**Parking.** In the lot, stalls near you are outlined. Stop inside one (within about 0.8 m and 20° of its axis, below
1 m/s) and hold for a second, or tap "Park here". In phase 3a the fade parks you in your stall directly.

## Getting out and back in

- **Get out.** When the car is parked, a "Get out" button replaces the pedals. The engine winds down, the cockpit
  view turns toward the door, a short fade, and you're standing by the driver's door in first person. The door
  closes behind you with a thunk and our own lock chirp. Under 1.5 s. With reduced motion it's a plain fade.
- **Your car stays.** It sits in its stall with its paint, so you can see it from the yard. Other parked cars are
  the game's fictional traffic models.
- **Back in.** Walk within about 1.8 m of the driver's door and tap "Drive", or tap "Car" at any time to walk back
  automatically. Long-press "Car" to skip the walk. Fade, cockpit, engine start.
- **Leaving.** In phase 3a a fade puts you on the nearest on-ramp, as the game already does for street ramps. In
  phase 3b you drive out by Dupont and Orangewood.
- **Saving.** Where you parked is saved in the profile (a v2 migration, done by whoever owns `profile.ts`).

## Controls

The owner wants big thumbs and no controls screen. On foot there are three things to learn, and a hint shows them
once, for six seconds, on the first visit: "Drag left to walk · drag right to look · tap to go".

**Phone (landscape or portrait):**
- **Walk.** A floating stick appears wherever the left thumb lands, in the left 45% of the screen. A short push
  walks (1.4 m/s); a full push jogs (3.0 m/s) outdoors. Inside the Shed it's walking only.
- **Look.** Drag anywhere on the right 55%. Pitch is limited to about 55° down and 45° up.
- **Tap to go.** A quick tap on the world (under about 220 ms, under 12 px of movement) walks you there by a path
  round obstacles, shown as faint dots. Tap a seat to sit in it, a person or group to walk up to them, the bar or a
  truck window to order. Moving the stick cancels it. This is the Sims-like part, and it makes the whole place
  playable with one thumb.
- **One action button** (76 px, bottom right) shows the best thing to do where you are: Sit, Stand, Order, Join,
  Leave, Play, Drive. A second, smaller button appears only when two make sense, such as Sit and Order at the bar.
- **Top left:** "Car". **Top right:** the view switch (first or third person) and the pause menu.

**Keyboard and mouse:** WASD or arrows to walk, hold Shift to jog, drag or pointer-lock to look, click to go or
use, E for the action, Q for the second action, V for the view, C for the car, Esc to pause.

**Gamepad:** left stick to walk, right stick to look, A for the action, X for the second action, Y for the view, B to
leave or stand, Back for the car.

## Camera

- **First person** is the default, matching the game's driver's-seat identity. The eye height comes from your
  driver (about 1.50 to 1.70 m). Field of view follows the game's rule: wider in portrait.
- A slight head bob when walking, about 1.5 cm, switched off by reduced motion. No camera roll.
- **Sitting** lowers the eye to about 1.15 m and limits the look to about 100° either side of the seat's facing.
- **Third person** (optional, V): 2.4 m behind, 0.45 m right, 1.75 m up, looking at the head. A ray against the
  static colliders pulls it in so it never goes through a wall; your avatar fades out when the camera gets within
  0.7 m of it. You see your driver: archetype, male or female version, skin tone, and the cosmetics from
  `drivers.ts` (watch, ring, bracelet; painted nails when the game adds them).
- **Watch.** Sitting still for 20 s, or tapping Watch, starts a slow drift between the liveliest group, the lawn
  games, the sunset and the light towers. Any touch ends it.

## Movement and collisions

- **The body** is a kinematic capsule, radius 0.3 m. It reaches its speed in about 0.25 s and stops in 0.15 s.
  No jumping. It steps up 0.18 m, enough for a 0.15 m kerb. The site is flat, so the ground is the game's terrain
  plus small raised surfaces (sidewalks, the patio).
- **What blocks you** is resolved in 2D on the ground plane: building footprints and our structures as polygons;
  tables, benches, trucks, planters and parked cars as boxes; poles, heaters and trees as circles; fences as
  segments. Three push-out passes a step, sliding along walls. Static colliders sit in a 4 m spatial hash.
- **People** are soft. NPCs step aside for you and you can ease through a crowd, so a group can never trap you.
- **Streets.** Kerbs are soft walls except at crosswalks. Cars on the streets always stop for you, wherever you
  are; nobody is ever hit.
- **Tap to go and NPC paths** use a walkability grid of 0.5 m cells over the walkable area, A* with corner
  smoothing. No navmesh library.
- **The edge.** In phase 1 you can walk the venue's block and the Orangewood sidewalks from State College Boulevard
  to the stadium-entrance signal. Past that a toast says "That's the edge of the hangout area for now" and a quiet
  collider holds you. The construction site north of Orangewood (in the land-use data) makes a natural, fenced edge.
- **Never stuck.** If anything ever leaves you inside a collider, you're moved to the nearest free cell.

## What you can do

- **Walk** the yard, the Shed, the lawn, the lot and the sidewalks. Look at the light towers and your car.
- **Sit** at any free seat: 96 in the yard, 24 at the trucks, 20 at the bar, 24 at high-tops. Tap the seat, or use
  Sit for the nearest. Groups at your table may turn and include you.
- **Order** at the bar or a truck window. A sheet with five big buttons. A staff NPC makes it in 4 to 8 seconds and
  hands it over; you hold it (a cup or a basket in the corner of the first-person view, in your avatar's hand in third
  person). Free, fictional, alcohol-free for the player. Sample items, all ours: Orangewood Fizz (orange soda),
  cucumber-lime agua fresca, horchata cold brew, zero-proof hazy (non-alcoholic), soft pretzel, birria tacos (Two
  Lane Tacos), garlic noodles (Night Shift Noodles).
- **Watch** the place go by.
- **Talk.** Walk up to a group and tap Join. They open a gap in their circle and turn to you. Someone says a short
  line (shown as a caption); you get two reply chips and Leave. They answer, and after two or three exchanges they
  wrap up ("Good talking. Drive safe.") and go back to their own conversation. There's no story or branching
  beyond that.
- **Later (phase 4):** a bag-toss mini-game (swipe to throw), more lines, stats such as time spent at hangouts.

**The lines** are short, original, and written by us. About 60 for phase 1 and 200 by phase 4, tagged by time of day,
the game's simulated weather, and your state (car, level, best streak). They never mention real businesses, real
people, real events or live data. A few:
- "That your Vela out front? Clean."
- "Best streak? Mine's like forty seconds over a hundred. Don't laugh."
- "Truck on the left does the birria. Trust me."
- "Is it bag toss or cornhole? We've been arguing for an hour."
- "Those light towers get me every time."
- "Long week. First time I've sat down since Monday."
- "I park at the back so nobody dings it."

Speech is never voiced. Groups make a soft murmur: babble synthesised in code (filtered noise with moving formant
bands), spatialised for the four nearest groups. Laughter, glass clinks and the truck fryers are synthesised too.

## NPCs

### How they're made

- **Built in code from parts.** Each person is a puppet of rigid parts: torso, pelvis, head, upper arms, forearms,
  hands, thighs, shins, feet, plus hair and hat variants. Each part type is one `InstancedMesh` for every NPC, so
  the whole crowd costs about 12 to 16 draw calls, not one per person. Per-instance colour gives skin, tops,
  bottoms and hair; per-instance scale gives heights from about 1.52 to 1.95 m and three builds.
- **Stylised, not photoreal.** Simple faces (eyes, brows and a mouth that opens and closes) that read at a few
  metres. Body language carries the scene at phone distances.
- **Clothes follow the clock and weather**: sunglasses by day, jackets at night and in rain.
- **Level of detail.** Full animation within 15 m at 30 Hz, simpler within 40 m at 10 Hz, flat impostors beyond
  45 m. The impostors are rendered at load from our own puppet, in code.

### The people builder (`src/onfoot/people/`, built; supersedes the puppet plan above up close)

Every person is generated in code from one continuous body generator: no downloaded models, textures or scans, and no
real person's likeness. Adults only (21 to 75).

- **API** (`src/onfoot/people/index.ts`): `buildPerson(o: PersonOptions): Person` with `group`, `setExpression(name,
  weight?)` (neutral, smile, laugh, playful, talking, listen, surprised), `say(line, seconds)` (drives the AA, EE, OO,
  MM, FF visemes), `lookAt(target)` (eyes and head), `play('idle' | 'talk' | 'walk' | 'sit' | 'laugh' | 'turn')`,
  `update(dt)`, `setLod(0 | 1 | 2)`, `eyes()`, `stats()`. Also `randomPerson(seed)`, `preset(name)` (16 presets,
  `reference` is the red satin slip dress, gold hoops, fine chain, black quilted bag and loose updo), and
  `lodFor(distance, quality)`.
- **Bodies**: signed-distance primitives meshed into one smooth skin, skinned to a 26-bone skeleton. Continuous
  parameters: height, heads-tall, fat, fat distribution (apple to pear, belly, softness), muscle, shoulder and hip
  width, bust, posture, age. The lineup (`people-bodies.png`) runs from very thin to heavy, petite to 1.88 m, 24 to
  75.
- **Faces**: skull, brow ridge, cheekbones, nose, philtrum, lips and ears in the same field. Separate eyeballs (iris
  with fibres, pupil, wet cornea), lofted lids that blink, lash and brow cards, teeth and tongue. Expressions are
  morph targets on every head mesh.
- **Clothes**: offset shells generated from each body (so they fit every size), clipped to necklines, hems and
  sleeves, with satin, cotton, denim, leather and wool shading. Shoes, heels and boots, plus hoops, studs, chains,
  watches, rings, glasses and bags.
- **Hair**: a volume per style (updo, long, bob, short, curly, ponytail, receding, buzz, bald) with a strand shader,
  plus strand cards with Kajiya-Kay highlights. Updos get face-framing locks.

Measured on 14 October 2026 (SwiftShader, 960x540; triangles and draw calls from `renderer.info`; build times are
desktop CPU, so a phone will be slower, by an amount not yet measured):

| Level | Used for | High (desktop) | Phone |
| --- | --- | --- | --- |
| LOD 0 | the person you talk to, and the closest few on desktop | about 150k to 210k tris, 17 to 20 calls, 7 to 9.5 s build | 71k tris, 17 calls, 4.6 s build |
| LOD 1 | patio distance | 11.6k tris, 1 call, 1.0 s build | 7.5k tris, 1 call, 0.71 s build |
| LOD 2 | far crowd | not used inside 14 m | 1.5k tris, 1 call, 0.29 s build |

A crowd of 30 (`view=crowd`): on phone quality it's 17 at LOD 1 and 13 at LOD 2. The whole scene, patio included,
draws in 53 calls and 152k triangles, inside the phone budget below. Animating all 30 costs 0.7 ms a frame. On high
quality it's 2 at LOD 0 and 28 at LOD 1: 89 calls and 748k triangles, just over the High triangle budget.
(Measured 2026-10-14 in headless Chromium with SwiftShader at 960x540; build times are desktop CPU.)

Where it falls short (candidly):
- It looks like a game conversation scene, not a photograph. The faces read as people with expressions (neutral,
  smile, a wink with a dark lash line on the closed lid, talking) but still look like CG: skin is smooth, faces are
  long and a little mannequin-like, and in the front conversation shot the updo reads as a sleek cap (the bun shows
  from three-quarter and behind, not from the front). The teeth now sit with an overbite and the lower row hidden,
  but a talking mouth still shows a narrow pale band rather than individual teeth.
- Clothes are offset shells: a big belly in a tee hangs as a smooth bell, with no wrinkles finer than the waist and
  elbow folds.
- The bodies lineup shows thin to obese, but at fat 1 the build is a hand-tuned soft limit on the belly; heavier
  presets were checked walking (people-walk-obese.png: arms clear of the belly, the tee follows) but not sitting since
  that change; the tee's back shows a dark yoke line across the shoulder blades.
- Phone LOD 0 is 71k triangles, about 18% over the 60k target.
- NPCs aren't instanced: each one is its own skinned mesh, so it's one draw call per person (30 for 30), not the 16
  for every NPC planned below.
- Building people is slow. 30 people took about 15 s on a desktop CPU, so the game must build them over several frames or
  in a worker, cache them, and start from far LODs. None of that is built yet.

### Groups that look like they're talking

A conversation is a small state machine per group of two to six:
- **Formation.** Standing groups make a circle facing a shared centre, 0.55 to 0.9 m out. Seated groups use the
  table. When someone joins or leaves, the circle re-spaces.
- **Turns.** One speaker at a time. A turn lasts 1 to 10 s (median about 3.5 s), with 0.2 to 0.8 s pauses. The next
  speaker is usually whoever was being looked at. Brief overlaps happen about one turn in ten.
- **The speaker** gestures in beats (forearm raise, open palm, a point, a shrug), with the mouth moving on a noise
  envelope.
- **Listeners** look at the speaker most of the time, with glances at others, their drink or a phone. They nod in
  the speaker's pauses (8 to 12° at about 2 Hz, for 0.6 s).
- **Laughter** is a group event, about 1.5 a minute scaled by mood. The speaker starts it and the rest follow
  within 0.3 s: shoulders bounce, heads tip back.
- **Idles:** weight shifts, breathing, sipping every 40 to 90 s, hands in pockets, arms crossed.
- **Mingling.** Now and then someone drifts to another group or to the bar and back, so the place keeps moving.

### Walkers, arrivals and staff

- **Walkers** use the real sidewalks along Orangewood and Dupont and cross only at the mapped crosswalks on the walk
  signal. Some walk dogs (made in code), some jog, some head toward the stadium or the lot.
- **Arrivals.** Parties of one to six walk in from cars in the lot and from drop-offs at the Dupont kerb. In phase 2
  their cars drive in from the street first. Each arrival has a plan: order, find a table or a spot, stay, leave.
- **Staff**, in patina-green aprons: two to four bartenders (pouring, wiping), one or two cooks per truck, a host at
  the gate, a busser making rounds of the tables, and a lot attendant waving cars in on busy nights.

## Simulated crowds

**The rule:** the crowd is simulated from the time of day and the day of the week, and the screen says so. It
isn't connected to the real venue, real stadium events, real hours, or any website.

- **The clock** is the game's. Live uses the device clock and weekday. The time presets set the sun, not an hour, so
  for the crowd we count them as 06:30 (sunrise), 13:00 (day), 19:15 (sunset) and 22:00 (night), on the device's
  weekday.
- **Target crowd** = capacity (220) × the curve below × weather × an event-night factor × seeded noise (±10%,
  seeded by date and hour so tests can reproduce it).
- **The crowd converges** to that target: parties arrive at random (Poisson), stay a while (log-normal, median about
  75 minutes) and leave.

| Hours | Mon–Thu | Fri | Sat | Sun |
| --- | --- | --- | --- | --- |
| 10–11 | closed | closed | closed | 20% |
| 11–14 | 15% | 20% | 35% | 45% |
| 14–17 | 15% | 25% | 55% | 70% |
| 17–20 | 45% | 70% | 85% | 55% |
| 20–23 | 55% | 90% | 95% | 20% (closes 21:00) |
| 23–01 | closed | 50% | 55% | closed |

- **Weather (simulated by the game):** rain cuts the crowd by about 25% and moves people inside and under cover;
  fog by about 10%.
- **Event nights are ours:** a fictional Tuesday trivia night (+15%, 19:00 to 21:00) and a fictional first-Friday
  truck row (a third truck). Nothing is tied to a real game, concert or calendar.
- **How many you see** is capped by the graphics preset (see the budgets). The rest are inside or out of view.
- **On screen:** a chip that always shows on foot, "Simulated crowd · Lively", with Quiet, Easy, Lively or Packed.
  Tapping it opens: "Lot 57 is a fictional hangout. The crowd is simulated from the time of day and the day of the
  week. Nothing here is live, and nobody here is a real person or another player." The destination card reads
  "Lot 57 · fictional hangout · simulated crowd". No head count is ever shown to the player.

## The street world around it

The streets are the real ones, as OpenStreetMap maps them, through Overture. They are exactly as accurate as the
mapping is; we haven't measured that against a survey. What isn't in the data, we fill with defaults and say so.

| Thing | From open data | Ours |
| --- | --- | --- |
| Street centrelines and names | Overture `transportation/segment` (OSM, ODbL) | Names pass an allowlist (below) |
| Road width | Mapped sidewalks where they exist (they do along Orangewood and Dupont); width tags are rare (6 of 2,294 road segments in the 3.3 km × 2.4 km box) | Class defaults: primary 22 m, secondary 18 m, tertiary 14 m (the game's overpass widths); residential 11 m, service 6 m (ours) |
| Lanes and markings | No lane counts in this release | Inferred from width: centre lines, lane lines, stop bars, turn arrows |
| Speed limits | On 230 of 2,294 road segments (40 mph on Orangewood and State College) | Class defaults elsewhere |
| Signals | Traffic-signal points (17 in the 1.2 km box round the venue) | Poles, mast arms, heads, pedestrian heads, and our fixed timings (90 s cycle) |
| Crosswalks | Crossing ways and points (41 crossing ways in the box) | Ladder markings |
| Sidewalks | Mapped sidewalk lines (57 in the box) | 1.8 m sidewalks where none are mapped |
| Buildings | Footprints and heights (OSM, Microsoft ML Buildings, USGS lidar); 2,188 of 2,574 in the box have a height | Facades and roofs by class; the venue parcel replaced; landmarks such as the stadium are plain, unnamed massing |
| Land use | Parking, grass, construction, residential | Surfaces and fences |
| Lamps, bus stops, poles, light towers | Infrastructure points | Models in code; bus stops have no names or route signs |
| Parked cars and street traffic | — | Simulated, using the game's fictional car models |

**Names on screen.** Only street names, on blade signs at intersections, from road classes (primary to residential).
The data carries business names in places it shouldn't for us: a sidewalk named after the real taproom, service roads
named "Stadium Entrance" and "Media Enterance", 79 named buildings in the box, and thousands of named places. None
of those are shown. The places theme is used to locate spots and never ships with the game; footway, service and
building names are dropped when the tiles are built. A check greps the shipped data and `src/onfoot/` for the real
venue's name.

**Street traffic (phase 2).** A few cars on Orangewood, Dupont and State College, at or under the posted limits,
stopping at our signals and for pedestrians, some turning into the lot to drop people off. Six to twenty in view.

## Scaling up

**More hangouts.** Each hangout is a record in `src/data/anaheim/hangouts.json`: id, fictional name, template,
anchor, site polygon, which real footprints it replaces, the exits and street routes that lead there, lot stalls,
hours, crowd curve and line set. Templates make new spots cheap:
- `taproom-yard` (Lot 57),
- `coffee-bar` in a strip-mall lot,
- `taco-stand` on a corner,
- `car-meet` (a big lot at night where people walk round each other's fictional cars, which suits this game),
- `night-market`, `beach-lot`, `park`.

A new spot is chosen from open data (land use and place categories show where people gather), then renamed and
designed from scratch, with the same checklist: name searched, no real marks, nothing traced from photos.

**All of Anaheim.** Measured from Overture, inside Anaheim's city boundary (Overture divisions, from OSM): 131.1 km²,
74,285 buildings, 28,528 transportation segments (10,956 service, 6,730 residential, 5,790 footway, 985 primary,
937 tertiary, 623 secondary), and 24,848 infrastructure features (4,170 street lamps, 3,389 crossings, 724 traffic
signals, 666 bus stops).
- One 1.2 km × 1.2 km tile round the venue (343 buildings, 466 street pieces, 125 points), delta-coded in decimetres
  and simplified to 0.3 m, is 73.5 KB of JSON and **23.2 KB gzipped**.
- Scaled by those counts, the whole city would be **about 3.4 MB gzipped**. That's an estimate from one tile with few
  houses. Re-measure it with the real pipeline before deciding anything.
- That's more than the whole game today (about 3 MB as one file). So the from-disk single-file build carries only
  the hangout tiles (tens of KB each). The full city would be separate tile files, loaded as you go, which works
  when the game is hosted but not from a file opened from disk.
- Streaming works like the game's terrain: tiles of a few hundred metres, nearest first, buildings merged into one
  mesh per tile beyond 300 m.

**Beyond Anaheim:** the same pipeline and templates, city by city, with the same data-budget discipline as the
freeways (the roadmap puts those at about 1.2 MB per county).

## Phone performance budgets

These are targets. Draw calls and triangles can be measured here (`renderer.info` doesn't depend on the GPU). Frame
rate can't: SwiftShader in this sandbox draws the game's Low preset at about 2 fps, which says nothing about a
phone. For comparison, the driving game's Low preset measured about 400 to 800 draw calls and 440k to 500k triangles
here. The on-foot scene is small and slow-moving, so it should sit well under that.

| Budget | Low (phones) | High |
| --- | --- | --- |
| Draw calls, whole on-foot scene | 150 or fewer | 350 or fewer |
| Triangles | 250k or fewer | 700k or fewer |
| Fully animated NPCs | 40 | 110 |
| Impostor NPCs | 40 | 100 |
| Draw calls for all NPCs | 16 or fewer | 24 or fewer |
| Lights | sun and sky only; string-light bulbs are emissive | plus up to 4 point lights; 1024 shadow map |
| NPC shadows | one instanced blob-shadow mesh | shadow map near you, blobs beyond |
| Canvas textures | 12 or fewer, 512 px | 16 or fewer, 1024 px |
| Simulation CPU per frame (NPCs, crowd, paths) | under 2 ms on a mid phone (unmeasured) | under 3 ms |
| Venue and street data in the build | under 120 KB gzipped | same |
| Code added | under 150 KB minified | same |
| Time to get out of the car | under 2 s | same |

Bloom on the string lights, ambient occlusion and the 1024 shadow map follow the game's quality presets. The
on-foot scene shares the game's single WebGL renderer: phones can't afford a second context.

## Roadmap only

None of these exist and none will be claimed:
- Multiplayer: other real people in the hangout, chat, voice, friends. It needs servers, accounts, moderation and
  anti-cheat.
- Real events, real schedules, real hours or live occupancy, from any source.
- Partnerships with, or branding from, real venues.
- Ordering or paying for anything real. No real money anywhere.
- Photoreal people, voice acting, motion capture.
- Houses you can walk into. The parking and get-out systems here are the base for the "buy houses and park your car
  there" item.

## Phases

Each phase ends with its checks passing in Playwright (headless Chromium, SwiftShader), screenshots in
`tests/out/onfoot/`, and the results logged in `PROJECT_OC_PROGRESS.md`. Nothing is marked done on trust.

### Phase 0: plan and data (now)

- **Deliverables.** This plan; the Anaheim pipeline in `tools/anaheim/` writing tiles to `src/data/anaheim/` (the data
  workflow); the freeway link (`freeway-link.json`).
- **Checks.**
  - The pipeline re-runs to byte-identical output.
  - Attribution and licences are in every file.
  - Shipped tiles carry no place, footway, service or building names, and the real venue's name appears nowhere in
    `src/onfoot/` or the shipped data.
  - Counts are printed and match the source.

### Phase 1: the venue on foot (a standalone page, not yet the game)

- **Deliverables.**
  - Lot 57 built in code: the Shed, the yard, string lights, the lawn, trucks, the lot and the sign. The rest of the
    block and the Orangewood frontage come from data.
  - Your driver as the avatar. First and third person. Touch, keyboard and gamepad.
  - Collisions. Tap to go. Sit, Order, Join and Leave.
  - 40 NPCs in talking groups, with staff.
  - The crowd curve and the "Simulated crowd" chip.
  - Test hooks on `window.__onfoot`: `setClock(day, hour)`, `stats()` (NPCs, groups, seated, walkers, draw calls,
    triangles, sim ms), `go(x, z)`, `tap(x, z)`, `act()`, `view()`, `frames`.
  - The page is `src/onfoot/index.html`, built with its own Vite config in `src/onfoot/` so the game's config and
    `package.json` don't change.
- **Checks.**
  - Boots with no console errors. Screenshots at 844 × 390, 390 × 844 and 1280 × 720.
  - 1,000 random walks never end inside a collider or pass through a wall.
  - Tap to go reaches every seat. Sit, stand, order and hold work end to end.
  - Tuesday 15:00 has fewer people than Saturday 21:00. Closed hours have nobody inside.
  - In every sampled group, at most one speaker at a time, and listeners face the speaker in at least 70% of
    samples.
  - The chip is visible in every on-foot screenshot.
  - Low preset within its draw-call and triangle budgets.
  - Reduced motion turns off head bob and transitions.
  - `npx tsc --noEmit` passes.

### Phase 2: the streets round it

- **Deliverables.**
  - Orangewood from State College Boulevard to the river bridge, the Dupont loop and its north leg, and State
    College's frontage.
  - Sidewalks, crosswalks, signals with pedestrian heads, lamps, unnamed bus shelters, and buildings from the 1.2 km
    tile.
  - Parked cars, sidewalk walkers and slow street traffic.
- **Checks.**
  - Every mapped crossing and signal in the area is drawn (counts match the tile).
  - Walkers cross only on walk.
  - Cars stop at red and for people. A scan finds no person ever inside a car's box.
  - Street-name blades show only allowlisted road names.
  - The tile fits its budget.

### Phase 3: into the game

The game's code belongs to the game's workflow; this phase is done there.

- **3a deliverables.**
  - A "Lot 57" destination and the fade hand-off from ramps 1142, 1264 and 562.
  - Parking, Get out and Drive, the saved parked car, and the return to an on-ramp.
  - A new group in `npm test`.
- **3a check.** From Free Drive on the 57 South, `navigateTo('Lot 57')` arrives parked. Then get out, walk to the
  gate, come back, drive, and end up back on a freeway with no errors.
- **3b deliverables.** The drivable 804 m from the 57 South ramp, with signals, as the first surface street.
- **3b check.** The autopilot drives from the 57 South to the stall without touching a kerb or running a red.

### Phase 4: depth

- **Deliverables.**
  - Replies and 200 lines.
  - The bag-toss mini-game.
  - Murmur, laughter and clinks.
  - Rain behaviour (umbrellas, moving inside).
  - Hangout stats and achievements (profile v2).
- **Checks.**
  - Each line's tags fire only in their context.
  - Audio voices stay at or below the cap.
  - Profile migration round-trips.

### Phase 5: scale

- **Deliverables.**
  - `hangouts.json`, and a second spot from a template (a car-meet lot is the natural one).
  - Anaheim tiles streaming.
  - Surface driving between spots, with the City expansion item.
- **Checks.**
  - The whole-city tile set is measured against the estimate above.
  - Memory stays flat over a 20-minute walk across tiles.

## Risks

- **Phones are unmeasured.** Like the driving game, nothing has run on a real phone. The budgets are targets until
  someone measures them.
- **NPCs can look stiff.** Procedural animation on rigid parts can read as robotic. The mitigations are timing variety
  (no two groups in step), stylised looks, and keeping the camera at conversational distance. If it still looks wrong,
  fewer NPCs done well beats more done badly.
- **Too close to the real place.** The spot is the real taproom's, on purpose. The guard is the rule set: our name
  (searched), our identity, our layout, the real footprints replaced, no names from the data on screen, no photos
  used. Search the venue and truck names again before release.
- **Data quality.** OSM mapping is good here but not perfect. It has typos ("Samta Ana River Trail", "Media
  Enterance"), business names on sidewalks, almost no widths, no lane counts, and some buildings without heights
  (386 of 2,574 in the box). The street world is as accurate as the mapping, and the doc doesn't claim more.
- **ODbL share-alike.** The tiles we derive are a database derived from OSM. They stay credited and available under
  the ODbL, as `oc-network.json` already is.
- **Build size.** The single-file build can't lazy-load from disk. A whole city can't ride inside it; only the
  hangout tiles can.
- **Alcohol and driving.** A taproom in a driving game. The player's menu is alcohol-free and nothing rewards
  drinking. Rating and store review may still care that pints are on screen.
- **"Sims-like" sets a high bar.** The Sims is a huge game. This is a vertical slice: walking, sitting, ordering,
  talking in short exchanges, and a crowd that feels alive. No needs meters, building or careers.
- **Two workflows share the game.** Phase 3 depends on `Game.ts` changes owned by another workflow. The contract (a
  destination, the hand-off at the ramps, an "enter on foot" call, a "resume driving" call) should be agreed before
  either side builds it.
- **Honesty drift.** Words like "live" or "now" creep into UI copy. A check greps the on-foot UI strings for "live",
  "real-time" and "people here now".

## Data sources and licences

Licences are as recorded in each row's `sources` field of Overture release `2026-09-23.1`, for a box of about
3.3 km × 2.4 km round the venue (longitude -117.895 to -117.862, latitude 33.788 to 33.810).

| Theme / type | Used for | Licence in the rows | Ships with the game? |
| --- | --- | --- | --- |
| `transportation/segment` | Streets, sidewalks, crosswalks, lot aisles, speed limits | ODbL-1.0 (OpenStreetMap; some contributions from TomTom, also ODbL-1.0) | Yes, credited |
| `buildings/building` | Footprints and heights | ODbL-1.0 (OpenStreetMap, Microsoft ML Buildings). Heights from USGS Lidar carry no licence string; USGS data is a US government product | Yes, credited (OSM, Microsoft, USGS) |
| `base/land_use`, `base/infrastructure`, `base/water` | Lots, grass, construction, signals, crossings, lamps, the river | ODbL-1.0 (OpenStreetMap) | Yes, credited |
| `divisions/division_area` | Anaheim's boundary, for counts and tiling | ODbL-1.0 (OpenStreetMap) | Boundary only, credited |
| `places/place` | Locating the real spot only | CDLA-Permissive-2.0, Apache-2.0 (Foursquare), CC0-1.0 (AllThePlaces) | **No** |
| Game terrain (AWS Terrain Tiles) | Ground height | As in `tools/oc-network/README.md` | Already in the game |

The credit line follows the game's: "Map data: Overture Maps Foundation, derived from OpenStreetMap contributors
(ODbL); Microsoft ML Buildings (ODbL); heights from USGS lidar."

Not used: Google Maps, or any proprietary map; OpenStreetMap's Overpass API, which this sandbox's egress policy
blocks (and isn't needed).

## How these numbers were measured

- **Overture rows** were range-read from the public S3 bucket (release `2026-09-23.1`) with the same `RangeFile`
  approach as `tools/oc-network/`, filtered to the box above. That returned 2,316 transportation segments, 2,574
  buildings, 163 land-use areas and 1,157 infrastructure features. Places were read only to find the spot.
- **Game coordinates** use the game's projection: x = (lon + 117.83) × 111,320 × cos 33.72°, z = -(lat - 33.72) ×
  110,574.
- **Ground heights** were sampled from the terrain grid in `src/data/oc-network.json`, decoded the way
  `Network.decodeTerrain()` does it.
- **Ramps** were decoded from `oc-network.json`:
  - Ramp 1142 (from path 9, the 57 South) passes within 10 m of its Orangewood terminal at about 358 m along. That
    agrees with the data workflow's 356.3 m.
  - Ramp 562 leaves and rejoins path 8 (the 57 North) at control points 25 and 54. OSM chains the off-ramp and
    on-ramp through the street signal into one link piece.
  - Ramp 1264 leaves path 0 (I-5 North) and ends on State College Boulevard.
- **Anaheim totals** count every row whose bounding-box centre lies inside the Anaheim locality polygon from Overture
  divisions.
- **Tile size**: the 1.2 km tile was encoded as compact JSON (decimetre delta coordinates, 0.3 m simplification) and
  gzipped at level 9.
- **The name search** was one web search on 2026-10-13 for a "Lot 57" taproom, brewery or beer garden in Anaheim or
  Orange County. It found none.
