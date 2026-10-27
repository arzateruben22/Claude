# Kit changes made for Back of the Envelope

Every change is additive: nothing an existing film calls behaves differently.

| Date | File | Change | Why | Old films unchanged? |
|---|---|---|---|---|
| 2026-10-27 | `kits/cinema/studio/instruments.py` | New voices `pluck` (Karplus–Strong pizzicato, seeded burst) and `scratch` (pencil on paper: band-passed seeded noise with a grainy amplitude; `rise` swells toward its end) | The channel's sound (bible §3): a plucked string and pencil foley; no existing voice is either | Yes: new functions only |
| 2026-10-27 | `kits/cinema/studio/compose.py` | `pluck` as a melodic voice (`_melodic`) and `pluck` / `scratch` as foley voices (`_voice`) | The preset `envelope-working` names them | Yes: two new branches, reached only when a preset names the voice |
| 2026-10-27 | `kits/cinema/studio/qa.py` | `METHOD` rows: `pluck` → rise, `scratch` → wave | QA must know how to find the new sounds in the stem | Yes: two new dictionary rows |
| 2026-10-27 | `kits/cinema/events.json` | Rows `term.write`, `answer.box` (span), `fall` (span) | The running sum's terms, the boxed answer and the fall are sound events | Yes: three rows appended; no render code reads this file |
| 2026-10-27 | `kits/cinema/studio/vibes/envelope-working.json` | New preset (D lydian, 90 BPM) | The channel's sound | Yes: a new file |

**Checked:** Rest Frame No. 001's sheet rendered with the studio before and after the change
(`git stash` of the three studio files): `mix.wav` and all three stems byte-identical
(sha256 `d7bb8092…`, music `94c9d438…`, effects `e5d139f0…`, dialog `5071e5db…`).

Copied, not changed: `set/rig.js` (Light Minute's), `set/look.js` (Light Minute's; default ground
renamed to `graphite`), `set/aces.js` (Rest Frame's). The originals are untouched.
