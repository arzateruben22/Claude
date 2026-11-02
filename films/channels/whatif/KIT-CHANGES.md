# Kit changes made for Back of the Envelope

Every change is additive: nothing an existing film calls behaves differently.

| Date | File | Change | Why | Old films unchanged? |
|---|---|---|---|---|
| 2026-10-27 | `kits/cinema/studio/instruments.py` | New voices `pluck` (Karplus–Strong pizzicato, seeded burst) and `scratch` (pencil on paper: band-passed seeded noise with a grainy amplitude; `rise` swells toward its end) | The channel's sound (bible §3): a plucked string and pencil foley; no existing voice is either | Yes: new functions only |
| 2026-10-27 | `kits/cinema/studio/compose.py` | `pluck` as a melodic voice (`_melodic`) and `pluck` / `scratch` as foley voices (`_voice`) | The preset `envelope-working` names them | Yes: two new branches, reached only when a preset names the voice |
| 2026-10-27 | `kits/cinema/studio/qa.py` | `METHOD` rows: `pluck` → rise, `scratch` → wave | QA must know how to find the new sounds in the stem | Yes: two new dictionary rows |
| 2026-10-27 | `kits/cinema/events.json` | Rows `term.write`, `answer.box` (span), `fall` (span) | The running sum's terms, the boxed answer and the fall are sound events | Yes: three rows appended; no render code reads this file |
| 2026-10-27 | `kits/cinema/studio/vibes/envelope-working.json` | New preset (D lydian, 90 BPM) | The channel's sound | Yes: a new file |

| 2026-11-02 | `kits/cinema/script/numerals.py` (+ a case in `test_numerals.py`) | "X and a half million/billion/thousand" keeps its scale word (it returned 2.5 and dropped "million": "about 2.5 ants") | No. 003's caption | Yes: no committed script in any channel says "and a half" before a scale word (grep); every other phrase takes the old path; 40 of 40 tests pass |

**Checked:** Rest Frame No. 001's sheet rendered with the studio before and after the change
(`git stash` of the three studio files): `mix.wav` and all three stems byte-identical
(sha256 `d7bb8092…`, music `94c9d438…`, effects `e5d139f0…`, dialog `5071e5db…`).

Copied, not changed: `set/rig.js` (Light Minute's), `set/look.js` (Light Minute's; default ground
renamed to `graphite`), `set/aces.js` (Rest Frame's). The originals are untouched.
- set/tower.js: optional `tip` (the needle's top radius in m; default unchanged). set/crowd.js: the square is
  centred on its group (`vP` minus the model translation; identical output at the origin, which is where No. 002
  uses it). Both are channel set pieces, not shared kit files.
- kits/cinema/cinema3d.js (shared, additive): `CINEMA.holdCuts` (opt-in, default off). When true, a frame's
  motion-blur sub-frames are clamped inside the shot that holds the frame (from `window.FILM.shots`), so no frame
  blends two shots across a hard cut. Films that don't set it render byte-identically. First used by No. 003.
- set/crowd.js: optional `far: [lo, hi]` (when the dots give way to their average; default [0.12, 0.7], as
  before) and `aniso` (measure the footprint along both screen axes, for slanted views; default off). Unset,
  the output is unchanged.
- kits/cinema/film/compilation.mjs (shared, additive): an optional theme key `compilation.introPromiseWidth` (CSS
  px) caps the intro card's promise line, so a long promise wraps beside the posters instead of running under
  them. Themes without the key render byte-identically. This channel sets 860. Note for the coordinator: the
  intro lays out at 1920 px with the posters from x ≈ 1036, while the promise may run to 1240, so any promise wider
  than ~900 px slides under the posters. Space's promise (64 characters) is likely affected in its vol01.
