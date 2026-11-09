# Writing, research and pacing standards v2 (owner, 8 Nov 2026)

Applies to every new video and every episode still in production, on all channels. Keep each channel's look, narrator,
approved topics, runtime (60 s minimum where set) and export quality. The goal: interesting facts a viewer understands
on the first listen, with visuals that make them want to keep watching.

## 1. Understandable on the first listen
- Pitch it so a sixth grader can follow and an adult stays interested. Smart viewer, new to the topic.
- Familiar words, short sentences, one main idea at a time. Explain any unfamiliar term in the same breath.
- Everyday comparisons and concrete examples, without losing accuracy. Ideas in the order you need them.
- Natural and confident, never childish.
- Check: `kits/cinema/script/lint.py` now reports a reading grade per beat (warns above grade 8, whole script above 7)
  and any sentence over 22 words. It is a guide; the real test is reading it aloud once.

## 2. Facts that strengthen the story
- One clear question per video, answered by a few memorable facts.
- Favour surprising explanations, useful insights, myth corrections, clear cause and effect.
- For each major fact: what it means, why it happens, why the viewer should care.
- Turn big numbers and odd units into comparisons. Cut trivia that interrupts the story.

## 3. Verify before you dramatise
- Prefer primary research and authoritative scientific or educational organisations. Match each claim to a source that
  actually supports it. Keep the conditions and the uncertainty ("in mice", "about", "estimated").
- Label what is established, what is a hypothesis, and what is a thought experiment.
- Never invent statistics, studies, quotations or citations. Remove or flag anything you cannot verify.
- A claim stays OPEN until a person opens its source page. Search excerpts alone never make it OK.

## 4. An immediate reason to watch
- The first 2-3 seconds: a striking visual plus a specific question, surprising fact or recognisable situation.
- The subject is clear immediately. No greetings, slow logo intros, or "Did you know?".
- Promise only what the video fully delivers.

## 5. Keep it moving
- Structure: hook, essential context, increasingly interesting explanation, strongest reveal, satisfying takeaway.
- Every sentence answers something, explains a consequence, or raises the next relevant question.
- Resolve small questions along the way. Cut repetition, filler and setup. Leave time to understand.

## 6. Faster visuals when they help
- Starting point: a meaningful visual change every 2-4 seconds (a new shot, a useful close-up, an example appearing,
  a diagram developing). Faster for action, comparisons and reveals; hold longer for reading or a key idea.
- Every visual explains or advances the current sentence. One main idea on screen. Captions readable on a phone.
- No random cuts, constant zooms, flashing or decorative motion.

## 7. Audio and the ending
- Narration clearly above music and effects. Sound accents and short pauses only where they help.
- End on the promised answer and a memorable takeaway. A loop only when it fits. Any call to action after the payoff.
- Meet the runtime by adding useful explanation, never padding.

## Deliverables per episode (in the episode folder)
1. `script.md`: the finished narration script (as now).
2. `review/scene-table.md`: a timestamped table with columns `time | narration | visual | on-screen text | sound`,
   one row per visual change.
3. `review/claims-table.md`: `claim | source (direct link) | what the source actually says | qualifications | status
   (OPEN / OK, person-checked)`.
4. `review/clarity-review.md`: the final clarity and pacing pass: the lint grade per beat, every line rewritten for a
   sixth grader and why, and every moment cut or tightened because it dragged or overwhelmed.
Review the rendered draft against all of the above when rendering is available, and say clearly what is done and what is
still blocked.

## Reviewers
The (a)-(h) gate is unchanged. Reviewers also check first-listen clarity (1), one question answered (2), sources (3),
the 2-3 s hook (4), the visual-change rhythm (6) and the ending (7), and the four deliverables above.
