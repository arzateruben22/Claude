# Season format: one long film, eight parts (owner's decision, 10 Nov 2026)

Applies to Reality Rulebook, One More Orbit and Possibility Lab from their next season on. Skin Sense has its own
Season 3 format: six premium lessons (see "Skin Sense Season 3" below). Body Backstage is paused and excluded.

Why: YouTube mid-roll ads need a video of at least 8:00. Every stitched Season 2 long video is 7:07-7:31, so none
qualified. Long-form watch hours are also what unlock the Partner Program (shorts views don't count toward the
4,000 hours).

## A season is one long film and its 8 parts

1. **Write the long film first, as ONE story.** One question that escalates and never resets (the day keeps
   shrinking, the Moon keeps coming, the second keeps slowing). Never glue finished shorts together, because every
   short ending is a place where viewers leave.
2. **8 chapters of about 65 s**, plus a short cold open and close, so the film runs **8:30-9:30** (never under 8:00).
3. **No chapter cards and no "1, 2, 3".** Each chapter ends on an open loop that the next chapter answers
   ("...and at twelve hours, it gets much stranger").
4. **Retention devices:**
   - a live number the viewer waits to see hit its end
   - a "wait, what?" twist at about 60%
   - the payoff in the last minute
   - a last shot that loops back to the first
5. **One scene, two renders:** 16:9 for the long film (2560x1440, plus the 1080p upload) and 9:16 for the parts
   (1080x1920, readouts relaid for portrait). Never stretch or crop one into the other.
6. **The 8 parts are the 8 chapters, cut from the 9:16 render.** Each part:
   - runs **1:01-1:15**, over a minute for TikTok Creator Rewards
   - opens with its own 2 s hook line in place of the long film's bridge line
   - ends with its cliffhanger line, then "Part N of 8. Full video on YouTube."
   - says "Part N of 8" once, at the end, not on screen the whole time (the declutter rule still applies)
7. **The ending belongs to the long film.** Part 8 stops just before the payoff. The climax or twist appears only
   in the long film.
8. **Packaging** (films/channels/PACKAGING.md): one packaging.json for the long film (16:9 thumbnail) and one per
   part (9:16 cover).
9. **Posting order** (the owner still posts by hand): the long film goes up first, so every part can link to it
   (YouTube Shorts' related-video link; "link in bio" elsewhere). Then one part a day.

## Files (so Prism imports and links everything)

- Long film: `films/channels/<channel>/compilations/<film-slug>/` with `<film-slug>-16x9.mp4`, the 1440p version,
  `chapters.txt`, `description.md` (title line first), `packaging.json`, `thumbnail.jpg` and `qa.json`. Prism
  registers it as a long video ("lesson"). The folder name is its key: never rename the folder.
- Parts: the season's own `epNN` folders, one per part. Season 3 is `ep13`-`ep20` (Skin Sense: `ep13`-`ep18`); Season
  4 starts at `ep21` (Skin Sense: `ep19`). Prism imports nothing from a folder outside its season. Each part has
  script.md, claims.json, film.json and `out/` (the 9:16 final, cover and packaging.json), as for any episode.
- **Parts link to the film through `chapters.txt` only.** Each line is `M:SS Title`, the first at `0:00`. Prism links
  the parts only when every line's title equals one part's title exactly (capital letters, `*stars*` and extra spaces
  aside), no part twice, and none already in another long video. If one line fails, nothing links. So `chapters.txt`
  has exactly one line per part, in order, and nothing else: put the cold open inside part 1's line at `0:00` and the
  close inside part 8's line, with no "Intro" or "Finale" line. `description.md` links nothing; Prism reads only its
  first line, as the long video's title.
- A part's title in Prism is its `film.json` `title.title` (stars removed). When that is empty, Prism uses the
  season's placeholder title from `prism-studio/scripts/import-episodes.ts`. The packaging winner is never the part's
  title (it is only the YouTube title). So write each chapter title into its part's `film.json` `title.title`.
- `film.json` `disclosures`: `aiVoice: false` for a real person's recording (the owner, Evelyn), `true` for any
  synthetic voice, a stand-in or a clone included; `aiVisuals: true` when an AI-made image appears. With no `aiVoice`,
  Prism labels the narration synthetic.
- `script.md`: Prism reads `## <beat> {...}` headings, each with a `vo:` line (a part: `hook`, `body`, `tease`). The
  hook's first sentence is the episode's hook line, and the body is its posting text.
- The order of pushes doesn't matter. A film imported before its parts, or with a chapter line fixed later, links on
  the next import as long as none of its parts are linked yet. A corrected `chapters.txt` or `description.md` with the
  same video is picked up too, but a description the owner edited in Prism is kept.
- Push each with push-one.sh (`compilations/<film-slug>` or `epNN`), then POST the import.

## Voice (owner, 10 Nov 2026: one recording-script format for every future season)

- **Possibility Lab and One More Orbit** are voiced by the owner from Season 3 on. Reality Rulebook keeps the AI voice
  for now. **Skin Sense Season 3 is voiced by Evelyn** (see below). Season 2 stays as it was posted.
- **Every new season gets a recording script in the standard four-part layout**, made with
  `films/channels/voice-scripts/make_recording_script.py` as soon as the season's script passes fact-check:
  - Part A: the long video's narration
  - Part B: the 8 parts' 2-second openings (plus their cliffhangers when those aren't already in Part A)
  - Part C: the closers, "Part N of eight. Full video on YouTube.", recorded once ever and reused by every channel
  - Part D: the like/follow lines, each read with "follow" then "subscribe", recorded once per channel
  Commit it as `films/channels/voice-scripts/<channel>-season-N-recording-script.md` and send it to the coordinator,
  who passes it to the owner.
- **One session per season, 7-10 minutes of reading** (owner, 11 Nov 2026). The script prints the time and warns above 10
  minutes: trim repeated or decorative lines (never a fact the story needs) while the long video still runs at least 8:30.
  The like/follow lines are two per season, rotating through CTA.md.
- **The owner uploads to `films/channels/<channel>/voice-owner/`** on the channel's branch, as `<pl|oo>-sN.m4a`,
  `<pl|oo>-sN-parts.m4a`, `part-closers.m4a` and `<pl|oo>-cta.m4a`. The builder cuts the files into lines, swaps them for
  the AI stand-in, rebuilds the captions from the recording and re-renders. The AI voice stands in until then, so
  production never waits on a recording.

## Every long video is at least 8:30 (owner, 10 Nov 2026)

This applies to every long video on every channel, new or rebuilt. Aim for **8:30-9:30**, so mid-roll ads are always
possible with margin. A long video that would land under 8:30 gets **real content added, never padding**:
- an opening hook (15-25 s) that states the thread connecting the whole video
- **bridges** between segments (6-12 s each): a cliffhanger line that links one topic to the next, so it plays as
  one story rather than "1, 2, 3"
- a **finale** (25-45 s) that pays the thread off: a ranking, a comparison of all the answers, or a closing "wait,
  what?" fact
Never stretch with slowed-down footage, silence, long holds, repeats or recaps of what was just shown. That hurts
retention, and YouTube's repetitive-content policy targets it. Every added line is fact-checked like any other.

## Season 2: done (10 Nov 2026)

All four channels finished Season 2: 6 shorts each, plus one long video each, all over 8:30 (Possibility Lab 8:40,
Reality Rulebook 9:06, One More Orbit 8:37, Skin Sense 8:37), all in Prism. Season 3 goes **one channel at a time**:
Reality Rulebook first, from Mon 16 Nov 2026 (after the weekly usage reset); the owner picks the next one when it's done.

## Skin Sense Season 3: six premium lessons (owner, 10 Nov 2026)

Quality over volume. Each episode should look like a very short, expensive sci-fi film and teach one real thing.
Take as long as it needs: the usage of about three Season 2 episodes goes into one. There is no daily-upload schedule.

- **Six episodes, 70-90 s each** (never under 60 s; over a minute also qualifies for TikTok Creator Rewards). The owner
  picks the six from the eight "life of one..." stories in `films/channels/skincare/s3-slate/`.
- **The look:** one detailed 3-D world per episode instead of diagrams and cards; one continuous camera journey through
  it; the cinema kit's film finish (depth of field, motion blur, bloom, grain); real sound design and an original
  score under the voice. Almost no on-screen text: one number or one word at the key moment, plus the captions. Skin
  Sense keeps its own identity (ivory, peach, rose, deep green `#00685F`, navy serif), never Lumevina's black, rose or gold.
- **The look (owner, 11 Nov 2026): strongly influenced by Lumevina's Skin School course, not a copy.** Reference:
  `films/skin-school-pilot/` (out/8-2-9x16.jpg). Take its vibe: soft, tactile 3-D voxel skin layers, soft studio light, a
  dark ground with a warm glow where the skin meets the dark, a calm camera. Give it Skin Sense's own touches: a very dark
  green-black ground `#0B1513` (not neutral black); voxels a little softer and slightly translucent, glowing from within;
  teal `#3FBFAE` as the only accent (signals, highlights; never rose, red or gold); captions in a small ivory serif
  `#F4EDE3` (Newsreader) on a dark rounded plate. The skin layers take each episode's one skin tone. No Lumevina name,
  logo, products or links, and no advice; get Evelyn's OK, since the look draws on her course.
- **Look gate:** before an episode is built, the owner approves one still frame and a 10-second test clip.
- **Voice: Evelyn, soft and close.** An ASMR-style lesson: close to the mic, unhurried, warm, every word clear, so it
  sounds like a lesson where you actually learn something. Music stays low and captions are always on.
  - **Her real recordings only, never an AI copy of her voice.** The owner gets her OK in writing and asks whether
    she wants to be credited by name. The studio never contacts her directly.
  - No Lumevina name, products or links in Skin Sense. The channel's no-brands and no-advice rules still apply.
  - A soft AI voice stands in for the look test and drafts only; the finals wait for her recording.
  - **It is ASMR (owner, 11 Nov 2026).** Soft-spoken or a light whisper, close to the mic, slow, steady volume. Her script
    (`films/channels/voice-scripts/skin-sense-season-3-recording-script.md`) asks for 10 s of room tone first; use it for
    noise reduction, and keep her breaths soft rather than cut to silence. Sound: gentle foley (soft brushing, droplets,
    low warm hum), music very low and slow, **no hits, stings, whooshes or sudden loudness changes**, no like-button sound.
    Slow cuts and slow camera. Each lesson lands at about 75-80 s; the like/follow line is the soft ASMR one in CTA.md.
  - Her recording script uses the standard layout, adapted for shorts: Part A is each episode's narration, plus the
    long video's opening, bridges and finale; there are no part openings or closers; Part D is the like/follow lines.
- **Long video:** at the end of the season, the six episodes are joined with an opening, bridges and a finale into one
  long video of at least 8:30, as in Season 2 (6 x about 80 s, plus about a minute of new narration).
- **Every Skin Sense rule still applies:** one skin tone per episode matched to its art, never a face (acne only inside
  a pore), no disease, risk or damage words over skin art, AI illustrations disclosed, no advice, and claims stay OPEN
  until a person opens the source.
