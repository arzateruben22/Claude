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
  `description.md` (title line and chapter list), `packaging.json` and the thumbnail. Prism registers it as a long
  video ("lesson").
- Parts: the next free `films/channels/<channel>/epNN/` folders, one per part, each with script.md, claims.json,
  film.json, `out/` (the 9:16 final, cover and packaging.json) as for any episode.
- Prism links parts to the film only if each `description.md` chapter title matches a part's title exactly, so
  keep them identical.
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
- **Look gate:** before an episode is built, the owner approves one still frame and a 10-second test clip.
- **Voice: Evelyn, soft and close.** An ASMR-style lesson: close to the mic, unhurried, warm, every word clear, so it
  sounds like a lesson where you actually learn something. Music stays low and captions are always on.
  - **Her real recordings only, never an AI copy of her voice.** The owner gets her OK in writing and asks whether
    she wants to be credited by name. The studio never contacts her directly.
  - No Lumevina name, products or links in Skin Sense. The channel's no-brands and no-advice rules still apply.
  - A soft AI voice stands in for the look test and drafts only; the finals wait for her recording.
  - Her recording script uses the standard layout, adapted for shorts: Part A is each episode's narration, plus the
    long video's opening, bridges and finale; there are no part openings or closers; Part D is the like/follow lines.
- **Long video:** at the end of the season, the six episodes are joined with an opening, bridges and a finale into one
  long video of at least 8:30, as in Season 2 (6 x about 80 s, plus about a minute of new narration).
- **Every Skin Sense rule still applies:** one skin tone per episode matched to its art, never a face (acne only inside
  a pore), no disease, risk or damage words over skin art, AI illustrations disclosed, no advice, and claims stay OPEN
  until a person opens the source.
