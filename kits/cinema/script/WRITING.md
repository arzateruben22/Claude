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
3. **One number per sentence,** said the way people say it ("about a hundred and twenty days").
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
