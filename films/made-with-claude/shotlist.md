# "Made with Claude — Breakout" · shot list

12.00 s · 30 fps · 360 frames · 120 BPM, so a beat is 0.5 s (15 frames) and a bar is 2 s.
The machine-readable version is `src/timeline.json`. The camera, mascot path, UI events and
every sound cue are read from it.

| # | Time (frames) | Shot | Entry state | Action | Exit state | Purpose | Sound |
|---|---------------|------|-------------|--------|-----------|---------|-------|
| S1 | 0.00–1.50 (0–44) | **Establish** | Frame 0 is already composed: the whole editor slab on the desk under a warm key light. The comp viewer shows the coral pixel sprite selected with handles; playhead at 0;00;00;00. | The camera glides down and in (wide → viewer medium), with focus pulling from the slab to the sprite. The sprite does a tiny squash-wiggle on 0.5 and 1.0. | The viewer fills most of the frame, centered on the sprite. | Hook: a recognizable editor, a cute character, and the question "what's it going to do?" | Filtered intro: pads and a muted arp · two sprite "blips" (0.5, 1.0) |
| S2 | 1.50–2.50 (45–74) | **Breakout** | Close on the sprite in the viewer. | 1.50–1.80: the sprite's 70 pixels extrude out of the screen as voxels in a radial wave. 1.78–1.93: the voxel creature stands up about its feet line. 1.92–1.98: the voxels glow hot and collapse. **1.96–2.00**: the 3D mascot pops in with an overshoot inside a soft glow burst. **2.00 (drop)**: a shockwave ring on the screen, the glass shatters into 70 shards plus sparks, and the mascot leaps out facing the lens. The camera pulls back and up, aimed at the mascot. | Mascot at the apex of its arc above the menu bar; shards falling out of focus. | The transformation, the drop, and the first big wow. | Riser 1.50 → 2.00 · impact + glass shatter + sub-drop at 2.00 · full beat starts |
| S3 | 2.50–4.00 (75–119) | **Menu-bar hops** | Low, close camera skimming the menu and toolbar; the mascot drops in from above. | Lands at **2.50**, then hops on **3.00** and **3.50**. Each landing presses a toolbar button, which dips and lights blue. The camera trucks right with it. Out of focus behind it, the viewer starts typing "MADE WITH CLAUDE". | The mascot crouches, then leaps right at 3.75; whip pan begins. | Character and play. The UI is physical. | Hop "boing" (take-off) + soft thud (land) on each beat · whoosh 3.75 |
| S4 | 4.00–5.50 (120–164) | **Glow** | Whip lands on the Effects & Presets panel, three-quarter top view. | Lands **4.00** beside the search field. The field types g·l·o·w on 16ths (4.000/4.125/4.250/4.375) while the mascot bounces once per keystroke. The tree filters to Stylize ▸ **Glow**. **4.50** it stomps the right end of the highlighted Glow row (the word stays visible), and the row flashes. A coral-white light streak flies from the row to the viewer, and at **5.00** the title in the viewer blooms with glow (focus racks to the viewer). | Mascot turns toward the timeline and leaps at 5.25. | The tool literally gets used: search → apply effect. | Key clicks on 16ths · stomp + "select" chime 4.50 · streak whoosh → glow swell 5.00 |
| S5 | 5.50–9.50 (165–284) | **Keyframes** | Camera dives to a low angle along the timeline. Colored layer bars recede in perspective; the playhead glows. | Lands on the time ruler at **6.00** and drives the playhead as it trots right. On **6.5, 7.0, 7.5, 8.0, 8.5, 9.0** it fires a light beam down onto a layer bar, and a glowing keyframe pops up with an overshoot. The timecode counts. In the background the title builds as keys land: spark at 7.0, swoosh at 8.0, "OPUS 5.5" at 9.0. | Leaps up and out of frame at 9.25; the camera whips up. | Shows the craft: keyframes make the animation happen. | Six zaps + dings on the beats (pentatonic, rising) · footsteps on 8ths · whoosh 9.25 |
| S6 | 9.50–12.00 (285–359) | **Made with Claude** | Whip settles onto the comp viewer: a tilted slab and the finished, glowing title card. | The mascot drops onto the comp's lower edge beside "OPUS 5.5" at **10.00**, squashes and settles, and its reflection appears in the glossy screen. At **10.50** its eyes close into happy arcs (‿ ‿). The title's glow breathes. The camera drifts slowly in. | **The last frame is the full card with the mascot.** No fade, so it works as the poster and the loop point. | The thing to remember: MADE WITH CLAUDE · OPUS 5.5. | Land thud 10.00 · "content" chirp 10.50 · outro chord and riser tail; music resolves by 11.9 |

## Reading budget

| Card | Words | Clean on screen | Notes |
|------|-------|-----------------|-------|
| "glow" search | 1 | 4.375–5.25 | Typed live; UI scale is large in that shot |
| Title card | 3 + 2 | 10.0–12.0 (2.0 s), and partially from 9.0 | The final hold must be ≥ 1.5 s |

## Continuity rules

- There is one mascot, one editor and one timeline position. The playhead time and the
  timecode readouts match the mascot's progress (the editor's 0–12 s ruler maps to the film).
- Toolbar buttons the mascot pressed stay lit for 0.3 s. Keyframes it created stay in the
  timeline through S6.
- The title card in the viewer only advances when the story causes it: typed during S3,
  glowed at 5.00, spark at 7.0, swoosh at 8.0, "OPUS 5.5" at 9.0.

## Camera notes (as built)

- Camera keys are either absolute or **mascot-relative** (`"rel": true`): an offset from a
  smoothed ground track of the mascot, so tracking shots can't lose the hero. `"aim"` tilts
  the look target toward the mascot's body, which keeps the big jumps in frame.
- `scripts/framing.cjs` reports where the mascot sits on screen in every frame. The only
  flagged frames are the three whip jumps (3.25–4.0, 5.25–6.0, 9.25–10.0) and the
  deliberate pan to the viewer (4.6–5.3).
- 9:16 has its own keys: higher vantage points and a 50–56° portrait lens. The end card
  pulls back so the title fills about 85% of the width, above the platform-UI zone.
