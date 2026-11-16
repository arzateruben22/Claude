"""Reality Rulebook S3 Part 3 (popcorn at 100x, soap bubble at 1,000x): shared timeline.
Line windows are placeholders (about 0.36 s a word); the owner's recording retimes them.
Part 3 is odd: spoken like/follow line (D3 follow / D4 subscribe), no 'Part 3 of 8' closer."""

FPS = 30
W, H = 1080, 1920
TOTAL = 54.6

# (id, text, start, end): the narration, one caption chunk list per line
LINES = [
    ("L1", "This popcorn kernel is about to explode.", 0.4, 3.0),
    ("L2", "Let's slow it down… a hundred times.", 3.4, 6.3),
    ("L3", "Inside, a tiny drop of water turned to steam.", 6.8, 10.1),
    ("L4", "At about three hundred fifty-five degrees Fahrenheit… the shell gave up.", 10.6, 15.0),
    ("L5", "That white foam is starch, puffed up by the steam.", 15.5, 19.3),
    ("L6", "Now something even faster. A soap bubble.", 19.9, 22.8),
    ("L7", "A hundred times slower isn't enough. Let's go a thousand.", 23.3, 27.3),
    ("L8", "A popped kernel touches it, and the hole races around the bubble. The film rolls up into a ring of tiny droplets.", 27.8, 35.3),
    ("L9", "In real life, this whole pop is over in about a hundredth of a second.", 35.8, 40.8),
    ("D3", None, 41.3, 43.36),   # owner's recorded like/follow line (no caption: it is the pop-up's moment)
    ("L10", "And those colors? The film is about a hundred times thinner than a human hair.", 43.9, 49.1),
    ("L11", "Next time, we slow down something you can't even see: sound.", 49.6, 53.8),
]

# caption chunks: (text, start, end); built from the lines by splitting at sentence ends and balancing words
CAPS = [
    ("This popcorn kernel\nis about to explode.", 0.4, 3.0),
    ("Let's slow it down…\na hundred times.", 3.4, 6.3),
    ("Inside, a tiny drop of water\nturned to steam.", 6.8, 10.1),
    ("At about 355 degrees Fahrenheit…\nthe shell gave up.", 10.6, 15.0),
    ("That white foam is starch,\npuffed up by the steam.", 15.5, 19.3),
    ("Now something even faster.\nA soap bubble.", 19.9, 22.8),
    ("A hundred times slower\nisn't enough. Let's go a thousand.", 23.3, 27.3),
    ("A popped kernel touches it.\nThe hole races around the bubble.", 27.8, 31.6),
    ("The film rolls up into\na ring of tiny droplets.", 31.7, 35.3),
    ("In real life, this whole pop is over\nin about a hundredth of a second.", 35.8, 40.8),
    ("And those colors? The film is about\na hundred times thinner than a human hair.", 43.9, 49.1),
    ("Next time, we slow down something\nyou can't even see: sound.", 49.6, 53.8),
]

# counter states: (number, label1, label2, start, end)
COUNTER = [
    ("1×", "real time", "one popcorn kernel", 0.0, 4.9),
    ("100×", "slower", "one popcorn kernel", 4.9, 19.9),
    ("100×", "slower", "one soap bubble", 19.9, 26.3),
    ("1,000×", "slower", "one soap bubble", 26.3, 50.6),
    ("1,000×", "up next", "sound", 50.6, TOTAL),
]

# schematic card (drawn): start, end
CARD = (30.3, 34.6)

# burst/pop sound anchors
T_BURST = 4.5
T_POP = 28.4
