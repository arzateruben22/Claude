# How the studio's science films talk

The story standard for every channel and every episode: Rest Frame, Light Minute, Meanwhile, Inside,
Skin School and every channel after them. The bar is a series a viewer would believe had a big
budget. The budget doesn't make that series good, though. What makes it good is that every line
earns the next second of attention, and none of it sounds like it is trying.

`lint.py` checks the mechanical rules: the word counts, the pace, the hook timing, the claims and the
"Never write" list. A person checks the rest with the read-aloud test at the end of this file.

## The promise

Each episode is **one idea told as a small story**. It sets up something the viewer thinks they
know, then shows a picture that breaks it. It gives the reason, makes it bigger, and ends on a line
that changes how they see the first frame. The facts are the drama, so we don't add hype.

## The shape (60–75 s, the seven beats)

| Beat | Its job | Sounds like |
|---|---|---|
| **hook** (0–4 s) | A question or a claim about the picture on screen that the viewer can't answer yet. Specific and short, spoken by 2 s | "Throw one. Drop one. Same moment. Which lands first?" |
| **normal** | The rule of this little world, fast, with one number made human | "Even sunlight needs eight minutes and twenty seconds to reach us." |
| **change** | The picture breaks the expectation. Say less here and let the picture land | "Now switch it off. Nothing happens." |
| **why** | The reason, told through a **person, a wrong idea, or stakes**. One mechanism, in plain words | "Old gunnery books drew cannonballs flying straight, then dropping. Galileo saw two motions at once." |
| **whoa** | Escalate: the same idea, bigger, wider, longer, or for your whole life | "And it does this every day for about a hundred and twenty days." |
| **segment** | The channel's signature beat (measure it / light time / meanwhile), the same shape every week | "Meanwhile, as you watched, your bone marrow made over a hundred million new red cells." |
| **takeaway** | A **reframe** you could repeat to a friend, not a summary. Short. It's the button | "Speed decides where it lands. Height alone decides when." |
| **tease** | A real question for next time, specific enough to want | "Next: a big swing races a tiny one. It's almost a tie." |

## Ten rules

1. **Open loops.** Every beat raises the question the next beat answers. A line that answers
   nothing and asks nothing gets cut.
2. **Concrete before abstract.** Show the thing, then name it. A number gets a picture the viewer
   already has: narrower than the cell, 1.2 Earths, before farming existed.
3. **Few numbers, felt.** The voice carries the meaning; the screen carries the exact figures. At most one number in a
   sentence and about four in an episode, each said the way people say it and turned into a feeling ("a full day",
   "longer than people have lived in Europe"). See **Flow** below.
4. **Talk to one person, in the present tense.** "You" belongs where the viewer really is in it:
   your sky, your blood, your hand.
5. **Short sentences, varied.** A three-word sentence after a long one is a drumbeat. Put the
   stressed word last, where the voice lands.
6. **Let the picture talk.** Picture-only holds come before a reveal, not after it. Never describe
   what the viewer can plainly see ("here we see", "as you can see").
7. **A person, a wrong idea, or stakes, every episode.** Galileo against the gunners' drawings.
   Cells that can't bend and jam the smallest vessels. Earth circling a Sun that isn't there. That
   is where the story is.
8. **Earn the wonder; never announce it.** If a line needs "amazing" to be amazing, the fact
   isn't doing its job. Find a better fact or a better picture.
9. **Honest, always.** Idealisations are said aloud or badged. Use "about" and "nearly". Every
   factual sentence goes in `claims.json`, and a new fact needs a source before it is voiced.
10. **Read it aloud at the narrator's pace.** If you stumble, wince or run out of breath, rewrite
    the line.

## Flow: the viewer should be carried, not taught (the owner, 29 Oct)

The facts are right in our first seasons, but they arrive as separate drops: a number, a name, a date, the next
number. Each beat starts over, and the recurring segment lands like a station break. The bar now is a film the
viewer slides through without noticing the joins, the way a good storyteller sounds: one unbroken thought, every
line already leaning into the next, a calm voice that makes the strange feel inevitable.

1. **One thread, no restarts.** Every sentence hands something to the next: a word, an image, a question, a
   "so", "and", "but" or "which means". Read the script with the beat headings hidden: if you can hear where a
   heading was, stitch it.
2. **The voice carries meaning; the screen carries specifics.** Exact figures, units, dates and full names go on
   the readout, the labels and the end-card footnote, where the eye can take them in at its own speed. The voice
   says what they *mean*: "half a century later", "the man who made the stain", "a full day". Name a person aloud
   only when the story turns on them.
3. **Fewer facts, deeper.** Three facts that build beat a dozen that stack. Cut any fact that isn't a step toward
   the whoa; it can live in the description's sources.
4. **Rhythm like breathing.** A long, flowing sentence that opens a picture, then a short one that lands it.
   Never three clipped sentences in a row (`lint.py` warns). Put the weight on the last word.
5. **Callbacks.** Bring back a word or image from the hook at the end, changed by everything in between ("Do
   your nerve cells touch?" ends on "They don't touch. They whisper."). The loop back to frame 0 should feel
   like it was always going to land there.
6. **Weave the segment in.** The recurring beat (measure it, light time, meanwhile, to scale, show your work) is
   part of the story's last turn, not an announcement: "And while you've been listening…", not "Meanwhile:".
7. **Tone: intimate and unhurried.** One curious person telling one friend something they can't stop thinking
   about. Wonder shows in the pacing (a held breath before the reveal, a slower phrase after it), never in
   adjectives. Voice slightly below the narrator's default speed, with real pauses at the turns.
8. **The picture moves with the sentence.** A cut or camera move lands on the word that turns the thought; one
   continuous world (below) is what makes the voice feel continuous. Transitions are match cuts, pushes and
   scale jumps, never a hard reset.

Example, Meanwhile, Inside 004 (the facts are the same, and all the specifics still appear, on screen):

> *Before:* "Camillo Golgi, who made the stain, saw one continuous web. With it, Santiago Ramón y Cajal saw separate
> cells. In nineteen oh six they shared a Nobel, still arguing. In the nineteen fifties, electron microscopes finally
> showed it: a gap."
>
> *After:* "The man who invented the stain saw one unbroken web. The man who borrowed it saw separate cells, almost
> touching. They shared a Nobel Prize, still arguing. It took a sharper kind of microscope, half a century later, to
> settle it. There is a gap."

## The picture: what the best references do

From the user's references, including "What if a black hole was heading for Earth?" (moon2animation, 10.9M
views, 80 s). It has no narration. It is one locked shot from a pier at night, and the black hole grows from
a dot to filling the sky while one readout counts down. What makes that kind of short hold:

1. **One world, few cuts.** Stage the episode as one continuous place the camera moves through (push, pull,
   orbit, scale jump). When a cut is needed, cut on a sound and keep the subject in the same part of the
   screen.
2. **A spine readout.** One number lives on screen through the whole episode and changes as the story
   escalates. The reference goes distance, then tide height, then distance, then "the event horizon: HERE".
   Its small label names the beat. A number that keeps moving holds the eye between lines. When it reaches its final value it holds there, lit, through the whoa and the takeaway, and its label changes to say what the number now means; it never leaves at the payoff. Park it in the frame's empty region, not over the subject or its path.
3. **Human scale.** At least once, anchor the big idea to a place the viewer knows: a beach, a kitchen,
   their own hand, their sky. Show the consequence there: the tide rising, the drink climbing the straw.
4. **Escalate in visible steps.** Every beat changes the picture, not just the words. A beat whose image
   doesn't change is a beat to cut.
5. **One idea per caption line.** When a beat is a single image, one short line can carry it ("The tides keep
   rising.").
6. **End on a loop and a fact.** The last frame hands back to frame 0 (the same composition or the same
   question), so a replay feels seamless. The end card carries one true-fact footnote that grounds the
   premise (the reference: "The first lone black hole was found in 2022, about 5,000 light-years away").
7. **Let the sound build.** The score rises with the escalation and drops to near-silence for the final
   reveal.
8. **One line wins.** The line or object the caption names is the brightest thing in the picture at that moment; whatever delivered the previous beat (a front, a ring, a prop) drops to about a third of its strength as the new beat begins. Honesty notes are metadata: one tier below labels in size and colour. Each top corner holds at most two notes at once (the speed column left, the standing cheats right), with the spine readout between them; a framing tag visits for 4 s at most, and a third note waits for one to leave.

## Never write

`lint.py` warns on these:
- **Shock promises:** "you won't believe", "this will surprise you".
- **Announced wonder:** "mind-blowing", "insane", "crazy", "unbelievable", "jaw-dropping", "epic".
- **Openers:** "Did you know", "Have you ever wondered".
- **Fillers:** "here's the thing", "let that sink in", "literally".
- **"Science says".** Name what was measured instead.
- **Talking about the video:** "in this video", "today we", "stick around", "wait for it", "like and subscribe".
- **Fake cliffhangers:** "but there's a catch" with no catch after it.
- **Exclamation marks.**
- **Two questions in one beat outside the hook.**

Don't write these either (no lint check):
- clickbait superlatives ("the most important thing you'll ever learn");
- jokes that aren't about the subject;
- trend slang;
- a moral at the end.

## The read-aloud test (before voicing)

- [ ] Muted, frame 0 plus the hook's words make you want the answer.
- [ ] Each beat's last line makes you want the next beat.
- [ ] The why has a person, a wrong idea or stakes.
- [ ] The whoa is bigger than the change, not a repeat of it.
- [ ] The takeaway is one line a viewer could repeat at dinner.
- [ ] Nothing in it would embarrass the channel's expert reviewer.
- [ ] Read aloud at pace, it sounds like someone who loves this, talking to one friend.
- [ ] With the beat headings hidden, you can't hear where they were (Flow).
- [ ] The voice says about four numbers at most; the rest are on screen.
- [ ] The last line calls back to the first.
