# ep07 claims table (Possibility Lab No. 007, Walking to the Moon)

Every claim is **OPEN**. No source page has been opened by a person, and this build session could not open them either
(its network policy blocks nasa.gov, doi.org and the other source hosts, HTTP 403 from the proxy). So the
"what the source says" column holds what the source is *expected* to say, from the builder's memory, marked **UNREAD**.
A person must open each link and fix the wording before posting.

| claim | source (direct link) | what the source actually says | qualifications | status |
|---|---|---|---|---|
| c1: The Moon sits about thirty Earths away, lined up side by side, with nothing but dark between. | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html | UNREAD. Expected: The Moon's mean distance from Earth is about 384,400 km (shown on screen as '384,400 km'; the Moon's orbit is elliptical, 356,400-406,700 km). | Candidate source, not opened by a person. Mean distance is the 'perigee/apogee' average; the film says 'about'. | OPEN |
| c2: The Moon sits about thirty Earths away, lined up side by side, with nothing but dark between. | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html | UNREAD. Expected: 384,400 km / 12,756 km (Earth's equatorial diameter) = 30.1: 'about thirty Earths'. | Candidate source, not opened. Division is in calc.py (earths = 30). Mean diameter 12,742 km gives 30.2: same answer. | OPEN |
| c3: Walk at an easy pace, the kind you could chat through. | https://doi.org/10.1093/ageing/26.1.15 | UNREAD. Expected: An easy walking pace is about 5 km/h (about 1.4 m/s); comfortable gait speed in healthy adults is roughly 1.3-1.4 m/s. | Candidate source, not opened. Paper's means are about 1.3-1.4 m/s (4.7-5.0 km/h); the film says 'easy pace' and shows 5 km/h as an input, with 4 and 6 as the sensitivity. | OPEN |
| c4: You would arrive in about nine years. | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html (source of an input) | Not a sourced fact: arithmetic from the claims above, done in calc.py. | Computed, not a sourced claim; its inputs are c1 and c3. | OPEN |
| c5: So give yourself a working day of walking. | none (assumption) | Not a sourced fact: an assumption the film labels on screen. | A modelling choice, not a measurement. Sensitivity: 4 h a day doubles the years. | OPEN |
| c6: A working day of walking gets you there in about twenty-six years. | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html (source of an input) | Not a sourced fact: arithmetic from the claims above, done in calc.py. | Computed; inputs c1, c3, c5. | OPEN |
| c7: Stick to the popular daily step goal, and it is closer to a hundred and forty. | https://doi.org/10.2165/00007256-200434010-00001 | UNREAD. Expected: 10,000 steps a day is the popular goal; at an assumed 0.75 m a step that is 7.5 km a day, so 384,400 / 7.5 = 51,253 days = 140 years: 'closer to a hundred and forty'. | Candidate source, not opened, for the 10,000-step goal only. The 0.75 m stride is an ASSUMPTION (about 0.4 x height); say 'about' and badge it. A person should open the paper for the goal's origin before posting. | OPEN |
| c8: Slower adds years, quicker trims a few, but it never gets close. | https://doi.org/10.1093/ageing/26.1.15 (source of an input) | Not a sourced fact: arithmetic from the claims above, done in calc.py. | Computed; the sensitivity rows on the work card. | OPEN |
| c9: The Apollo crews made the same trip in about three days. | https://www.nasa.gov/mission/apollo-11/ | UNREAD. Expected: Apollo 11 left Earth on 16 July 1969 and entered lunar orbit on 19 July: about three days. | Candidate source, not opened. Launch 13:32 UTC 16 July; lunar orbit insertion about 17:22 UTC 19 July (about 76 h). 'About three days' is the claim. | OPEN |

Extra qualifications to check when the sources are opened:
- c1: the film uses the centre-to-centre mean distance (384,400 km). Walking from surface to surface is about 376,300 km (2% less); 'about' covers it.
- c3 and c7: the 5 km/h pace and the 10,000-step goal are everyday figures, not a medical target. The 0.75 m stride is an assumption.
- c9: say 'about three days'; the crew's flight time depends on the mission.
