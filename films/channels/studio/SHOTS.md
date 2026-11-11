# Shots: plan the episode as one film

An episode is one continuous film made of defined shots. This page says how to plan those shots, what each field of
the shot manifest means, and which camera, light and material choices the code really offers today.

| File | What it is |
|---|---|
| `shots.json` in the episode folder | The shot manifest: every shot, in order |
| [schema/shot.schema.json](schema/shot.schema.json) | Its schema |
| [templates/shots.example.json](templates/shots.example.json) | A filled example: Skin Sense Season 3 Episode 1, nine shots, one camera path, no cut |
| [tools/validate.py](tools/validate.py) | Checks the manifest against the schema and against `episode.json` |

The manifest is a plan first and a record second. Before the build it says what each shot must do. After the build it
says what each shot really used. It never names a technique the engine does not have
([README.md](README.md), "Maximum-fidelity standard").

## 1. The rule: one film, not a list of clips

- **One world.** The episode is one place the camera moves through. The story standard is in
  [kits/cinema/script/WRITING.md](../../../kits/cinema/script/WRITING.md), "The picture".
- **Every shot starts where the last one ended.** Shot N's `endState` is shot N+1's `startState`.
- **Every join has a reason.** The camera moves because the narration or the subject moves.
- **Frame 0 is already composed.** It works as the poster. The last frame either returns to it (a loop) or closes.
- **A shot with no purpose is cut.** So is a shot whose picture does not change.
- **Each aspect is its own film.** A 16:9 film and its 9:16 parts each get their own manifest and framing. Never a crop.

## 2. How to plan

1. Read `script.md`, `claims.json`, the channel identity ([identities/](identities/)) and the season look.
2. Write the **journey** in one or two sentences: where the camera starts, where it goes, where it ends.
3. Mark the **stations** on the narration: each place where the picture must show something new.
4. Cut the journey into shots. One shot is one camera idea. Most shots run 3 to 15 s. Slow formats (Skin Sense's
   ASMR lessons) sit at the long end. `validate.py` asks you to split a planned shot longer than 20 s.
5. Fill every field (section 3). Write joins from both sides (section 4).
6. Write the `continuity` list: what stays the same in every shot (section 5).
7. Run `validate.py` (section 10).
8. Show the manifest and get a go-ahead **before any scene code** (the `cinema-kit` skill, step 2). Render stills
   before the full render, and show them to the owner.

`tools/new_episode.py` writes one placeholder shot per story beat. That is a starting grid, not a shot list. Split
and rewrite it.

## 3. The fields

Required unless marked optional. Time windows are a plan until the voice is measured; then the compile step's word
anchors replace them.

| Field | What it holds | What good looks like |
|---|---|---|
| `id` | `S01`, `S02`, ... in order. A shot added later takes a letter: `S04a` | Stable once a review has seen it |
| `beat` (optional) | The story beat in `script.md` this shot belongs to | One beat may hold several shots; one shot may span two beats |
| `purpose` | Why the shot exists | One sentence a viewer could confirm: "By the last frame the hairs have risen and the viewer wants to know why" |
| `seconds` | `[start, end]` on the episode clock | On whole frames. The first shot starts at 0; no gap, no overlap; the last ends at the planned length |
| `aspect` | `9:16` or `16:9` | The episode's own aspect |
| `camera.preset` | A name from section 6 | Tells the builder which code to use |
| `camera.from`, `camera.to` | Where the camera is and what it looks at, first frame and last | Places in the world and in the frame ("hairs across the lower third"), not adjectives |
| `camera.lens` | Field of view in degrees, and what is in focus | "About 30 degrees, focus on the nearest hair". The engine takes a field of view, not millimetres |
| `camera.focus`, `camera.speed` (optional) | What the focus follows; how fast the move is | Inside the channel's own limits (section 6) |
| `subject` | The one thing the eye is on | One line wins: the brightest thing in frame is what the caption names |
| `motion` | What moves in the world, and on which word it lands | Names the spoken word: "On 'narrow' the loop tightens" |
| `lighting` | The light in this shot | A preset from section 7, plus what changes. Anything not built says "to build" |
| `environment` | The place: ground, depth, air, particles | The channel's ground colour and nothing borrowed from another channel |
| `materials` | What things are made of | Real materials and passes from section 7. Costly ones (transmission) only where a still shows the gain |
| `principle` | The science this shot shows | One or two plain sentences. It must match the claims listed. A simplification is called one |
| `startState`, `endState` | The first and last frame, described | Checkable against the neighbours. "As S03 ends" is a valid start |
| `transitionIn`, `transitionOut` | A term from section 4, then `: ` and the detail | The same term on both sides of a join |
| `narration` | The lines spoken during the shot | Line ids (`vo04`), or the id and the text. Empty for a picture-only shot |
| `onScreenText` (optional) | Any word or number on screen besides captions | Exact figures live on screen, meaning lives in the voice. Skin Sense Season 3: one word or number per episode |
| `sound` | Music level, foley and sound events | In the channel's sound rules (identity file, `sound.rules`) |
| `assets` | Paths the shot needs | Relative to the episode folder. Code modules, art, recordings, references |
| `claims` | Ids in `claims.json` that the picture or narration states | Every fact the shot shows has an id. Empty only when the shot states nothing outside the film |
| `qa` | Acceptance checks | Yes-or-no questions, three to five. At least one a script can answer and one a person must |
| `status` | `planned`, `built` or `approved` | `built` after stills exist. `approved` only by the owner or the reviewer |
| `aiArt` (optional) | `true` when an AI-made image appears in the picture | See section 9 |
| `reference` (optional) | A reference frame the builder matches | Never shown in the film (section 8b) |
| `notes` (optional) | Anything else | After the build: what the shot really used, if it differs from the plan |

Top level: `version`, `episode` (the id in `episode.json`), `shots`, and optionally `journey` and `continuity`.

## 4. Transition vocabulary

Every `transitionIn` and `transitionOut` starts with one of these terms. A join is one event, so the shot that leaves
and the shot that arrives name it with the same term. The story standard asks for match cuts, pushes and scale jumps,
never a hard reset.

| Term | What happens | Use it when | Not when | In the code today |
|---|---|---|---|---|
| `open` | The first frame of the episode, already composed | The first shot's `transitionIn`, always | Anywhere else | Frame 0 is the poster (`film.json` `poster`) |
| `hold` | The camera stays. The subject changes | A reveal needs stillness; a picture-only beat; the payoff | The picture would not change at all | A camera key held (`kits/cinema/keys.js`); Reality Rulebook's locked measure view |
| `motivated push` | One continuous camera move: push in, pull back, track or arc | The narration names something the camera then goes to, or the subject moves and the camera follows | The move has no reason, or it is faster than the channel allows | Keyed cameras everywhere: `keys.js`, the channels' `set/rig.js`, Skin Sense's `set/w3d.js` |
| `scale change` | A continuous move across powers of ten: the world shrinks or grows around a focus point | The idea itself is about scale (street to galaxy, skin to cell) | More than once per episode on One More Orbit; without a motion-blur floor | `kits/cinema/sci/ladder.js` (`createLadder`, `logDolly`); the `scale.jump` event in `kits/cinema/events.json` |
| `through-the-surface` | The camera passes through a surface into what lies under it, or back out | Going inside: skin, a planet, a wall of water. The surface stays in frame through the pass | The frame would go fully dark or flat for more than a few frames | A keyed move through layered geometry; `kits/cinema/sci/cutaway.js` opens a shell with a flat cap. A reusable descent rig is Roadmap stage 2 |
| `match cut` | A cut where shape, position or motion matches across it | Two places or times must meet (a fingertip ridge and a sand ripple) | The match is only a colour | No helper: the builder aligns the two frames by hand and checks them side by side |
| `cut on sound` | A plain cut that lands on a sound, with the subject in the same part of the screen | A change of place that no move can bridge | Skin Sense's ASMR lessons (no hits) | Shot changes in `film.json` `shots`; the sound cue comes from the same timeline |
| `dissolve` | One picture fades into another over about a second | Skin Sense Season 2: a painting gives way to the 3-D scene | To hide a join that has no reason | `paintings` with `fin` and `fout` in Skin Sense's `set/w3d.js` |
| `loop` | The last frame equals frame 0 | The last shot's `transitionOut` when the episode loops | The last frame only resembles frame 0 | By hand: the last camera key copies the first. Possibility Lab also fixes the music tail (`epNN/loopfix.sh`) |
| `close` | The last frame holds, or the end card arrives | The last shot's `transitionOut` when there is no loop | Before the last line has landed | The end card in `kits/cinema/sci/hud.js`; a final hold of at least 1.5 s |

`validate.py` enforces three things: the first shot opens with `open`; the last shot leaves with `loop` or `close`;
both sides of every join use the same term.

## 5. Continuity rules

Write the ones that apply into the manifest's `continuity` list, in the episode's own words.

1. **Light keeps its side.** The key light does not jump from left to right across a join.
2. **Travel keeps its direction.** If deeper is down, it stays down. If the Moon comes from the right, it keeps coming from the right.
3. **One subject at a time.** What delivered the last beat drops to about a third of its strength when the next begins.
4. **The readout keeps its place.** A spine readout or live number sits in the same empty region all episode and never covers the subject.
5. **Colour stays in the channel.** Only the identity's palette and the season look's colours. Each accent keeps one meaning (One More Orbit: teal is light, lilac is gravity).
6. **One skin tone per Skin Sense episode**, in every layer and every shot. Never a face.
7. **Speed stays inside the channel's limits** (section 6). A scale change carries a motion-blur floor.
8. **Text is counted.** Captions, plus what the channel allows: at most two text blocks at once ([CTA.md](../CTA.md) calls it the 2-text-block rule); Skin Sense Season 3 allows one word or number per episode.
9. **Sound follows the picture.** A sound event sits on the first frame that shows its cause. Skin Sense Season 3: no hits, stings or whooshes at all.
10. **A meaningful change every 2 to 4 s** ([briefs/STANDARDS-v2.md](../briefs/STANDARDS-v2.md)). ASMR lessons move more slowly on purpose; the change may be a slow one, but the picture never freezes.
11. **Safe box.** The subject and all text stay inside the channel theme's safe box for that aspect.
12. **At most 3 flashes a second**, and captions at 4.5:1 contrast, in every shot.

## 6. Camera presets

These names are planning words for `camera.preset`. Each maps to code that exists today. A shared preset file that
scene code reads directly does not exist yet: Roadmap stage 2 ([LIBRARY.md](LIBRARY.md), section 4).

| Preset | What it is | Code | Channels | Limits |
|---|---|---|---|---|
| `locked` | No camera motion | A single key, or two equal keys (`kits/cinema/keys.js` holds the first and last key) | All | |
| `keyed-move` | Position, look-at and field of view keyed over time, with an ease per key. Portrait gets its own distance and lens | `kits/cinema/keys.js` (`camAt`, `placeCamera`) | Any scene | |
| `tracking` | Keys given relative to a subject's path, so the shot cannot lose it | `keys.js` keys with `rel` and `aim` | Any scene | |
| `rack-focus` | Focus moves from one target to another over about 0.45 s | `keys.js` (`focusAt`, `focusTrack`) into `window.CINEMA_FOCUS` | Channels on the kit finish | Not on Skin Sense's `--plain` path, where focus is the distance to the look target |
| `handheld` | Tiny, slow, repeatable sway | `keys.js` `handheld(t, amp)` | Kit films | Not allowed on One More Orbit, Possibility Lab or Skin Sense ("never handheld") |
| `measure-view` | Locked, square to the grid, long lens (portrait field of view 30 to 36 degrees), deep focus | The episode's `compile.py` writes `film.json` `cam` | Reality Rulebook | The default view |
| `slider-drift` | A slow sideways drift, 2 to 5 cm a second | Same | Reality Rulebook | |
| `the-turn` | One 60 to 90 degree turn, landing on a starred word | Same | Reality Rulebook | One per episode |
| `macro-push` | A push into a contact moment while time is slowed | Same | Reality Rulebook | |
| `diagram-view` | Locked, 60 to 75 degrees above the orbital plane | `set/rig.js` (`createRig`) | One More Orbit | Field of view 18 to 28 degrees for planets, 40 to 50 for galaxies |
| `mount-drift` | Distance eased in log space | `set/rig.js` | One More Orbit, Possibility Lab | At most 5% a second on One More Orbit |
| `mount-arc` | A slow arc around the target | `set/rig.js` | One More Orbit, Possibility Lab | One More Orbit: the bible allows 6 degrees a second; the episodes' `compile.py` keeps azimuth at 1.5 or under, because stars are points the motion blur cannot see. Possibility Lab: at most 3 degrees a second |
| `scale-jump` | A dolly in log space across scale rungs, with crossfades | `kits/cinema/sci/ladder.js` | One More Orbit, Reality Rulebook | One per One More Orbit episode, at most 3 s, with a motion-blur floor |
| `keyed-flight` | One continuous flight keyed as position, look-at, field of view and roll; focus follows the look target | Skin Sense `set/w3d.js` (`camAt`, `camPose`), keys in the episode's data file | Skin Sense Season 2 | Base field of view 30 degrees |
| `painting-push` | A slow scale-up on a painting around a focus point, fading into the 3-D scene | Skin Sense `set/w3d.js` `paintings` (`s0`, `s1`, `focus`, `fin`, `fout`) | Skin Sense Season 2 | The painting is AI art: section 9 |

Not built yet:

| Wanted | Status |
|---|---|
| A named preset library in the kit that `camera.preset` resolves to | Roadmap stage 2 |
| One shared camera rig (today `set/rig.js` is copied between two channels) | Roadmap stage 2 |
| A reusable through-the-surface descent rig for Skin Sense Season 3's night look | Roadmap stage 2. Today it is a `keyed-flight` built per episode; the night look itself is not built |
| Lens effects: distortion, anamorphic flares, chromatic aberration | Not in the kit. Do not ask for them in a manifest |
| Camera shake beyond `handheld` | Not in the kit |

Describe a lens as a field of view and a focus target. A millimetre lens name ("85 mm macro") is only a mood word for
a reference picture (section 8b); the engine has no such setting.

## 7. Lighting and material presets

Name these in `lighting` and `materials`. Paths are on each channel's own branch unless they start with `kits/`.

### Lighting

| Preset | What it is | Code | Shadows |
|---|---|---|---|
| `daylight-lab` | Soft key from above front-left, hemisphere fill, cool rim, on a ruled-paper cyc | Reality Rulebook `set/props.js`, `set/cyc.js` | None today |
| `star-key` | The star is the one key light, plus a 4% fill so night sides keep their shape. Bloom only on stars and light fronts | One More Orbit `set/planet.js` (`sunDir` and the night fill, in the shader), `set/star.js`, and the episode's `scene.mjs` | None |
| `desk-light` | One warm-white desk lamp plus a 6% fill, over a graph-paper desk | Possibility Lab `set/desk.js` (the lamp's pool on the paper), `set/globe.js` (one-lamp shading) | No shadow maps. `set/desk.js` draws soft blob shadows under up to six objects |
| `ivory-studio` | A procedural soft-box environment, a warm key, a rim and a hemisphere fill | Skin Sense `set/w3d.js`; `set/studio.js` `createStudio` | Soft shadows, 2048 px (`PCFSoftShadowMap`) |
| `night-look` | Skin Sense Season 3: tissue that glows from within on a dark green-black ground, one soft key | A brief only (`s3-looktest/BRIEF.md`). **To build**, and pending the owner's look gate | To decide at the look test |
| `light-shafts` | Additive shaft geometry, glow sprites and bloom | Skin Sense `set/studio.js` `createShaft`, `set/w3d.js` `mkGlow` | An approximation of volumetric light |

### Materials

| Preset | What it is | Code |
|---|---|---|
| `skin` | Sheen, clearcoat and an attenuation tint with warm fill. It approximates subsurface scattering | Skin Sense `set/studio.js` `skinMaterial` |
| `cell`, `nucleus`, `strand`, `fluid` | Translucent cell bodies, glowing nuclei, hair and fibre strands, moving fluid | Skin Sense `set/studio.js` `cellMaterial`, `nucleusMaterial`, `strandMaterial`, `fluidMaterial` |
| `tube` | Tubes along a path: hairs, fibres, vessels | Skin Sense `set/w3d.js` `makeTube`; `kits/cinema/sci/path.js` |
| `lit-prop` | Standard lit materials on real-looking props, colours fed through ACES so they land on the theme tokens | Reality Rulebook `set/props.js`, `set/aces.js` |
| `glass-cheap` | Glass and a liquid column without the costly transmission material | Reality Rulebook `set/straw.js` |
| `shader-body` | Planets, stars and sky drawn by custom shaders | One More Orbit `set/planet.js`, `set/star.js`, `set/sky.js` |
| `chalk-model` | The chalk globe and the flat blue anchor figure | Possibility Lab `set/globe.js`, `set/anchor.js` |
| `transmission` | Real refraction through a physical material, in screen space | three.js `MeshPhysicalMaterial`. Correct in the capability test at about 1.6 s a frame against 0.8 to 1.2 s |
| `liquid` | Liquid that beads, necks and merges | `kits/cinema/metaballs.js` |
| `cutaway` | A shell cut open by a plane with a flat cap | `kits/cinema/sci/cutaway.js` |
| `particles` | Seeded particle swarms | `kits/cinema/sci/swarm.js` |
| `light-front`, `strobe` | Expanding fronts and rings; ghost copies at equal time steps | `kits/cinema/sci/front.js`, `kits/cinema/sci/strobe.js` |

### The finish

| Path | Gives | Does not give |
|---|---|---|
| Kit finish, `kits/cinema/cinema3d.js` (Reality Rulebook, One More Orbit, Possibility Lab) | Motion blur, bokeh depth of field, bloom, ACES | Grain; blur on captions and labels |
| Skin Sense's own finish in `set/w3d.js`, rendered with `--plain` | 4x MSAA, a 20-tap depth of field, bloom, ACES | Motion blur |
| Grain | A channel helper only: Skin Sense `set/studio.js` `createGrain`, `set/look3.js` `grainV3` | Not in the kit: Roadmap stage 2 |

### Do not write these into a manifest

Ray-traced anything, path tracing, global illumination, true volumetric light, true subsurface scattering, ambient
occlusion, HDR output, native 1440 or 4K video. None of them exists in the engine today. The full table, with what
stands in for each, is in [README.md](README.md), "The directive's wish-list, as it stands". Shadows on Reality
Rulebook, One More Orbit and Possibility Lab, an ambient occlusion pass, kit grain and `.hdr` environments are
Roadmap stage 2.

## 8. Prompt templates

### a. Briefing a builder on one shot

Fill it from the manifest. Send it with `shots.json`, not instead of it.

```
SHOT BRIEF: <episode id> <shot id>, <start> to <end> s, <aspect>
Channel: <name>. Branch: <branch>. Folder: <filmsPath>/<folder>/.
Read first: films/channels/studio/identities/<slug>.json ("rules" and "never" are binding), this episode's
episode.json and shots.json, films/channels/studio/SHOTS.md.

Purpose: <purpose>
Narration during the shot: <line ids and text>
The science it shows: <principle>   Claims: <ids>

Starts from: <startState>            Join in: <transitionIn>
Camera: <preset>. From <from> to <to>. Lens: <lens>. Focus: <focus>. Speed: <speed>.
Subject: <subject>
Motion: <motion>
Light: <lighting>
Place: <environment>
Materials: <materials>
On-screen text: <onScreenText, or "captions only">
Sound: <sound>
Ends on: <endState>                  Join out: <transitionOut>

Use only what exists: the camera, light and material presets in SHOTS.md sections 6 and 7. If the shot needs
something marked "to build" or "Roadmap", say so before building it.
Build order: stills at the first frame, the landing word and the last frame, with the final finish. Show them.
No full render before the owner has approved the stills.
Done when: <each qa check>
Report back: what the shot really used (finish, materials, measured seconds per frame), any change from this
brief, and every TODO. Never report a technique, size or number that was not measured.
Do not: change another channel's files, commit build/ folders, push, or post.
```

### b. Asking ChatGPT for a reference frame

The owner makes these pictures by hand. Give the owner two things to paste: the channel's **STEP 1** from
[CHATGPT-ART-PROMPTS.md](../CHATGPT-ART-PROMPTS.md) (once per chat, one chat per channel), then this shot prompt.

```
Reference frame for <channel name>, shot <shot id>. This is a reference for an animator, not a finished picture.
Format: <vertical 1080 x 1920 (9:16) | horizontal 1920 x 1080 (16:9)>.
Moment: the <first | last> frame of the shot.
Subject: <subject, described physically and accurately>.
Camera: <from or to, in plain words>; <wide | close-up | macro>; <angle>.
Light: <lighting, in plain words>.
Place: <environment>.
Colours: <the season look's colours with hex values>. Only these. <the channel's "never" colours> must not appear.
Materials: <materials, in plain words>.
Scientific accuracy: <what the picture must get right, from "principle">.
Leave calm, empty space <where captions and titles go for this channel>.
Avoid: any text, letters, numbers, labels, arrows, logos or watermarks; any real person's face;
<the channel's own "never" list>; anything that looks like a real photograph of a real event.
Style: <the look summary from the identity file, one sentence>.
```

Rules for reference frames:

- One prompt per frame. Ask for the first or the last frame of a shot, never "the whole shot".
- A lens in millimetres is allowed here as a mood word. It is not a setting the builder can match.
- The owner names the file as [CHATGPT-ART-PROMPTS.md](../CHATGPT-ART-PROMPTS.md) says (`<channel>-ep<NN>-<shot>.png`) and
  sends it. The builder stores a reference-only frame under `art/ref/` in the episode folder, apart from art that is
  shown, and lists it in the shot's `reference` field.
- Skin Sense's Season 3 look draws on the Skin School course. No Lumevina name, logo or product in any prompt.
- The words in the prompt follow the same truth rules as the script: nothing the film does not show or explain.

## 9. Owner-made AI art

The rule: **an AI-made image is always disclosed, and never presented as a photo.**

| Case | What to do |
|---|---|
| The image, or any part of it, appears in the picture (a painting, a background, a texture, a layer, a cover) | Set `aiArt: true` on each shot that shows it. Set `disclosures.aiVisuals: true` in `episode.json`; the compile step copies it to `film.json`, which is what Prism reads. Carry the channel's label on the end card or in the description ("Illustrations: AI-generated"). List the files in `assets` |
| The image is a reference only: the builder matches it in code and no pixel of it is shown | List it in the shot's `reference` field and in the episode's `assets.md`. No on-screen label is needed. If the builder later composites it in, the first row applies at once |
| In doubt | Treat it as shown, and disclose |

Also:

- A code render or an AI image that could pass for a photo or a measurement carries "Illustration"
  ([PACKAGING.md](../PACKAGING.md), "Truth rules").
- Skin Sense: AI illustrations are always disclosed, and the captions carry "Education, not medical advice".
- An owner's painting is smaller than the frame it fills (One More Orbit's are 1672x941; Skin Sense ep12's are
  941x1672). It is upscaled, so never call that picture native at a larger size.
- `validate.py` fails an episode whose shots carry `aiArt: true` while `disclosures.aiVisuals` is not `true`.

## 10. Check it

```
python3 -I films/channels/studio/tools/validate.py <episode folder>
python3 -I films/channels/studio/tools/validate.py films/channels/studio/templates/episode.example.json
```

It reads `episode.json`, `shots.json` and `claims.json` together. For shots it checks: the schema; windows that start
at 0 with no gap or overlap and end with the story beats; each shot in the episode's aspect; the three transition
rules; every claim id present in `claims.json`; no TODO left in a shot marked `built` or `approved`; `aiArt` against
the disclosures. Exit status 1 and one line per problem. Details: [NEW-EPISODE.md](NEW-EPISODE.md), "Check the plan".

The example validates with two warnings, both true of the real episode today: its sources are not opened, and
Evelyn's written OK is not on record.
