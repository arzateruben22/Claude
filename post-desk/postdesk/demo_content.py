"""Hand-written sample posts for the demo and for running without a Claude key.

Niche: AI tools and the people building with them (the default in desk.toml).
"""

ORIGINALS = {
    "take": [
        "Your AI stack doesn't need ten tools. It needs one you trust and a habit of checking its work.",
        'The fastest way to learn a new tool is to build something small you actually need with it.',
        'Prompts are code now. Version them, test them, and stop pasting them into chat windows.',
        'Most automation fails at the hand-off, not the task. Decide who checks the result before you start.',
        "Most AI agents are a for-loop with a credit card. The good ones know when to stop and ask a human.",
        "The best prompt is a clear spec. If you can't explain the task to a new hire, Claude can't do it either.",
        "Shipping beats polishing. A rough tool people use teaches you more than a perfect one nobody opens.",
        "The moat isn't the model. It's the boring workflow you built around it.",
        "AI won't replace developers. It'll replace the part of the job everyone already hated.",
        "If your demo needs ten minutes of setup, it's not a demo. It's homework.",
        "Agents don't fail because they're dumb. They fail because nobody told them what done looks like.",
    ],
    "list": [
        'A good weekly AI review:\n\n1. What did it save me?\n2. What did it get wrong?\n3. What should I hand it next?',
        "Before you call it an agent, check:\n\n- It has a goal\n- It has limits\n- It can say it's stuck\n- Someone reads its log",
        "Cheap ways to make AI output better:\n\n- Give an example\n- Ask for less\n- Say who it's for\n- Ask it to check itself",
        'What to automate first:\n\n1. Things you do weekly\n2. That follow the same steps\n3. Where a mistake is cheap',
        "Before an agent touches real money:\n\n1. Paper trade first\n2. Hard spending caps\n3. A human approves big moves\n4. Logs you actually read\n5. An off switch",
        "Signs your AI side project is real:\n\n- Someone uses it twice\n- It saves you an hour a week\n- You'd be annoyed if it broke",
        "Three questions I ask every AI tool:\n\n1. What does it cost per task?\n2. What happens when it's wrong?\n3. Can I see what it did?",
        "What makes a side project stick:\n\n1. It fixes your own problem\n2. You can demo it in 30 seconds\n3. You ship something every week",
        "Before you automate anything, write down:\n\n- What done looks like\n- Who checks it\n- What it's allowed to spend",
        "Habits that make AI coding work:\n\n- Small asks, not big ones\n- Tests before trust\n- Read every diff\n- Commit often",
    ],
    "how_to": [
        'How to stop an agent from looping: give it a step limit and a clear stop rule, and log every step so you can see where it spun.',
        'How to pick a model: start with the smallest one, test it on ten real examples, and only move up when it fails one that matters.',
        'How to write release notes nobody skips: lead with what changed for the reader, one line each, no internal names.',
        'How to keep an AI project cheap: cap the spend per day, log every call, and look at the log every Friday.',
        "How to get better answers from Claude: give it the goal, the limits, and one example of a good result. Then ask what's missing.",
        "How I review AI-written code: run it, read the diff, then ask the model to find its own bug. It usually can.",
        "Test an idea in a weekend: one page, one button, one way to pay. If nobody clicks, you just saved a month.",
        "Cut your AI bill without losing quality: reuse long instructions, ask for shorter answers, and give sorting jobs to a smaller model.",
        "Write a spec an agent can follow: who it's for, what done means, what it must never do, and how you'll check it.",
        "Turn a messy brain dump into a plan: paste it in and ask for three next steps, each under 20 minutes.",
    ],
    "question": [
        "What's the one AI habit you picked up this year that you'd never drop?",
        'Would you let an agent send email for you without checking first? Why or why not?',
        "What's the smallest tool you've built that you use every single day?",
        'Which job do you think AI makes more fun, not less?',
        "What's one task you've handed to AI and never looked back?",
        "Honest answer: do you read the code your AI writes, or just run it?",
        "Smarter model or faster model. You only get one. Which?",
        "What's the most useful thing you've built in under a day?",
        "If you could automate one hour of your week, which hour would it be?",
        "What's a tool everyone loves that you quietly don't?",
    ],
    "story": [
        'Gave an agent a vague task and got a vague result. Rewrote the ask in three lines and it nailed it.',
        'The demo worked on the first try. The real data broke it in five minutes. Test with the messy stuff early.',
        'Deleted half the features from a side project. Usage went up. Fewer choices, more doing.',
        'A friend asked how long their app took to build. Two days to build, two weeks to make it boring and reliable.',
        "Spent three hours debugging. The fix was one line. The bug was in my prompt, not my code.",
        "Built a tool just for me last month. Three friends asked for it this week. That's how it starts.",
        "Asked an agent to clean up my files. It made a plan, asked before deleting anything, and finished in four minutes.",
        "First version of my app had forty settings. Version two has four. People finally use it.",
        "Tried to automate my whole morning. Ended up automating one email. Still worth it.",
        "Watched someone who's never coded ship a working site in an afternoon. The gap is closing fast.",
    ],
    "data": [
        "A post with a link costs about 13 times more to send through X's API than one without. Worth knowing before you automate.",
        "Most of a post's views arrive in its first day. Judge a post after 24 hours, not after 20 minutes.",
        "Reading one post through X's API costs half a cent. A scout that reads 100 posts a day is 50 cents.",
        'Three checks catch most bad AI output: does it answer the question, are the facts sourced, would you sign it.',
        "Our paper-trading bot made 1,192 trades in a month and lost money. Good. The scorecard caught it before real money did.",
        "A two-person team with good tools now covers what took ten people a few years ago.",
        "Small teams ship faster with AI, but the real win is how many ideas they can afford to test.",
        "Half the AI tools I tried this year are gone. The ones left all did one job really well.",
        "The cheapest model that gets the job right beats the smartest model that costs 10x more.",
        "Every agent I trust has the same three parts: a budget, a log, and a human who can say no.",
    ],
}

QUOTE_TAKES = [
    "Worth reading twice. The trick isn't the tool, it's deciding what done looks like before you start.",
    'Agree, with one addition: put a spending cap on anything that runs while you sleep.',
    'This matches what I see: small teams win by testing more ideas, not by working longer hours.',
    'The underrated part here is the checklist. Boring process is what makes the clever part safe.',
    'Good point, and it cuts both ways: easier to build means easier to copy. Distribution matters more now.',
    "The part worth copying: they shipped the small version first and let people pull them toward the rest.",
    "Good reminder that the boring parts (logs, limits, a human check) are what make agents safe to use.",
    "This is why I test with fake money first. Clean demos hide messy edge cases.",
    "Underrated point. Speed matters less than how cheaply you can try the next idea.",
    "Clear ask in, clear result out. Most failures I see start with a vague request.",
    "The real story: one person with good tools can now cover a whole team's to-do list.",
    "Saving this. The best AI workflows look boring from the outside and save hours inside.",
]

TRENDING = [   # (author, text) for the demo scout
    ("builderbecca", "We cut our agent's cost by more than half just by reusing the system prompt. Nothing else changed."),
    ("agentops_dan", "Shipped a support bot in two days. It now answers most tickets before a human wakes up."),
    ("shipfast_sam", "Most AI startups are one API change away from zero. Build the workflow, not the wrapper."),
    ("mlnotes", "Our team stopped writing first drafts. We only edit now. Output doubled, meetings didn't."),
    ("indiehackrjo", "The only agents I trust ask before they spend money. Everything else is a demo."),
    ("devtools_daily", "Vibe coding is fun until you have to maintain it. Write the tests."),
    ("promptcraft", "Stop asking AI to be creative. Ask it to be specific. Creativity shows up on its own."),
    ("solofounder_li", "One year, zero employees, three products. AI did the boring 80%. I did the 20% people pay for."),
    ("opsgarden", "Our biggest AI win this quarter wasn't a model. It was a checklist the model follows."),
    ("tinyteams", "Hiring is slower than ever and output is higher than ever. Both are because of AI."),
]

HEADLINES = [
    "Why AI agents still need a human in the loop",
    "Show HN: I built an agent that files my receipts",
    "The quiet rise of one-person software companies",
    "A practical guide to testing LLM apps",
    "What happens when your coding assistant writes the tests too",
    "Small models are getting good at narrow jobs",
    "How teams are budgeting for AI in 2026",
    "The case for boring AI products",
]


# -- comedy style ([writer] style = "comedy"): gym life, raves, everyday life ----------------------

COMEDY_ORIGINALS = {
    "hot_take": [
        "If you still need 15 minutes on the bike to warm up, you're officially unc. Respectfully.",
        'Calling the headliner mid is free. Your aura after saying it is not.',
        "Unpopular opinion: cardio is optional. Running is a reaction to danger and I am not in danger.",
        "Gym mirrors should be closed before 7am. Nobody is ready for that.",
        "If you rerack your weights you're a better person than most people with a podcast.",
        "Leg day is a scam invented by people who own stairs.",
        "The best part of any rave is the 4am gas station snack run. I will not be taking questions.",
        "Pineapple on pizza is fine. Pineapple in a protein shake is a crime.",
        "Grunting at the gym is the adult version of 'look at me' and I fully support it.",
        "Texting 'k' should count as a declaration of war.",
        "Morning people aren't better than us. They just went to bed while we were at the rave.",
        "Clapping when the DJ finishes is correct. Clapping when the plane lands is also correct. Fight me on neither.",
    ],
    "observation": [
        "Pre-workout hit, playlist hit, gym crush walked in. I'm locked in and cooked at the same time.",
        'Nothing says unc like checking the set times so you can leave before the traffic.',
        "Every gym has one guy who has been about to start his set since 2019.",
        "Nothing humbles you faster than a staircase the day after leg day.",
        "The festival lineup drops and suddenly everyone in the group chat is a music critic.",
        "Pre-workout kicks in and suddenly you're drafting a text to your ex about your new PR.",
        "Gym playlists are just songs that make you think you're in a movie training montage.",
        "Every festival group has one friend who always knows where everyone is and one friend who is the emergency.",
        "Saying 'last set' at the gym is the most common lie told indoors.",
        "Walking to my car after the gym like I just came home from a war.",
    ],
    "pov": [
        "pov: you said 'one more song' and now your back is making unc noises",
        "pov: your gym crush asks if you crack and you're too cooked from leg day to answer",
        "pov: you made eye contact in the gym mirror and now you both have to pretend it never happened",
        "pov: the drop is coming and your friend picks this exact moment to tell you a story",
        "pov: you said 'one more song' three hours ago",
        "pov: your gym crush starts using the machine you've been waiting for",
        "pov: it's 7am, you're still wearing kandi, and your mom is calling",
        "pov: you skipped leg day and now the stairs know",
        "pov: the DJ finally plays your song and you're in the bathroom line",
        "pov: you're the only one who wipes down the bench and you're quietly furious about it",
    ],
    "list": [
        "Types of people at the gym:\n\n1. The mirror philosopher\n2. The 45-minute phone call\n3. The guy who grunts on warm-ups\n4. You, pretending not to notice all three",
        "Rave survival kit:\n\n- comfy shoes\n- earplugs\n- a phone charger\n- one friend who never loses the group",
        "Signs it was a good rave:\n\n- your feet hurt\n- your voice is gone\n- you have 400 blurry videos of the same light show",
        "Gym excuses, ranked:\n\n3. 'my pre-workout hasn't kicked in'\n2. 'I'm deloading'\n1. 'it's a rest day' (it's the fourth one)",
        "Things that should be illegal at the gym:\n\n- sitting on a machine to scroll\n- curling in the squat rack\n- unsolicited form advice",
        "Festival group chat, in stages:\n\n1. 'we should all go!!'\n2. tickets bought\n3. nobody books the hotel\n4. 'who has a charger'",
        "Things you hear at 3am at a rave:\n\n- 'this is the best night of my life'\n- 'where are my friends'\n- 'one more song'",
        "Relationship red flags:\n\n- doesn't rerack weights\n- leaves before the headliner\n- replies 'k'",
    ],
    "fake_headline": [
        "BREAKING: man who called the DJ 'mid' loses 1,000 aura on the spot",
        "Report: local raver completely cooked after promising 'I'm just going for the opener'",
        "BREAKING: Local man who said 'last set' 40 minutes ago still on last set",
        "Scientists confirm the gym is mostly people waiting for the same bench",
        "Report: man who skipped leg day for three years now legally classified as a lollipop",
        "Festival introduces new 'exit' feature after attendees spend six hours looking for one",
        "BREAKING: rave friend who 'knows a shortcut' leads group into a parking lot again",
        "Local woman's 'quick gym session' enters its third hour, family remains hopeful",
        "BREAKING: man returns weights to the rack, gym staff in tears",
        "Area raver insists sunrise set was 'life changing', cannot name a single song from it",
    ],
    "this_or_that": [
        'Lose all your gym progress or lose all your aura. Choose carefully.',
        'Delulu about your gym crush or delulu about your bench PR. Pick your poison.',
        "Leg day or a rave the same night. You only get one working body.",
        "Gym at 5am or gym at 10pm. There is no middle.",
        "Front row at the rave or in the back where you can breathe?",
        "Never skip leg day again or never wait for a bench again. Pick one.",
        "Sunrise set or headliner set. You only get one forever.",
        "Protein shake with water or with milk. This decides who I trust.",
        "Gym crush: say hi, or admire from a respectful distance for two years?",
        "Headphones at the gym: music or a podcast?",
    ],
}

COMEDY_QUOTE_TAKES = [
    "This is the most accurate thing posted today and I'm saying that from the squat rack.",
    "Saving this to show my legs what they could have been.",
    "Every rave group has this person, and if you don't know who it is, it's you.",
    "Read this between sets and now I need a longer rest.",
    "I felt this in my calves, which is wild because I've never trained them.",
    "The accuracy is upsetting. I need to sit down on the leg press I'm not using.",
    "This belongs in a museum, right next to my unused gym membership card.",
    "Somebody finally said it and now I can go home.",
    "My group chat is going to be arguing about this for the rest of the week.",
    "This is peak gym culture and I'm proud to be part of the problem.",
]

COMEDY_TRENDING = [   # (author, text) for the demo scout: invented accounts
    ("liftlaughs", "Nobody tells you the hardest part of the gym is finding parking."),
    ("bassdropdiaries", "The best rave moments are the ones you won't remember filming."),
    ("gymthoughts", "Pre-workout and bad decisions kick in at the same time for me."),
    ("festivalfeed", "Festival season means my step count finally matches my personality."),
    ("cardiohater", "Treadmill: 45 minutes. Distance: emotional."),
    ("ravecore", "Lost my friends at the rave, found three new ones and a hat."),
    ("benchwaiter", "Been waiting for this bench so long I've started paying rent."),
    ("dailydeadpan", "My alarm and I have agreed to see other people."),
    ("legdaylegend", "Did legs yesterday. I live on the couch now."),
    ("sunriseset", "A sunrise set hits different when you've been awake since yesterday."),
]

COMEDY_HEADLINES = [   # demo only: invented
    "Gyms brace for the January rush, again",
    "Festival season tickets go on sale this week",
    "Why everyone at the gym suddenly owns the same water bottle",
    "The rise of the 5am gym crowd",
    "Rave fashion trends for the new season",
    "Is pre-workout the new coffee?",
    "The etiquette of sharing gym equipment",
    "How festival crowds plan their sets",
]


def demo_pool(style: str):
    """(originals by format, quote takes, trending posts, headlines) for a writer style."""
    if style == "comedy":
        return COMEDY_ORIGINALS, COMEDY_QUOTE_TAKES, COMEDY_TRENDING, COMEDY_HEADLINES
    return ORIGINALS, QUOTE_TAKES, TRENDING, HEADLINES
