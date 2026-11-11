"""Write packaging.json for the Earth-spin long video and its 8 parts (PACKAGING.md; the covers are re-cut from the film's own figure frames: the
figure doing the action, the goal in frame, the setup never the answer). Run after the film is final to fix frameSeconds; the text is final now.
Part titles = the chapter titles in the long video's description, character for character (Prism links parts to the film by them)."""
import json
COVER = {1: (28.0, "24 h to 90 min"), 2: (20.0, "Sunset in 6 hours"), 3: (25.0, "1,670 km/h wind"), 4: (22.0, "Seas pile up here")}      # part -> (frame second, cover words that add a new layer; never the title)

from pathlib import Path
HERE = Path(__file__).resolve().parent
LIGHT = "the film's own look: a deep slate background (#171A1E), a glossy blue mannequin figure with no face standing on a dark graph-paper plain, soft cool key light, magenta (#EB63FF) accent"
SCORE = lambda *v: dict(zip("scroll curiosity clarity synergy originality accuracy mobile satisfaction".split(), v))
CH = [
 ("What If Earth Spun Faster?", "You stand on the equator and the Earth begins to spin faster, a little more every second.",
  "the blue figure standing on the equator at dawn, seen from behind, the Sun a small disk on a low horizon", "figure left third, low horizon, empty sky right", ["What If Earth Spun Faster?", "What if the Earth Never Stopped Speeding Up?", "You Are Moving 1,670 km/h Right Now", "Why You Can't Feel the Earth Spin", "A Day That Only Gets Shorter"]),
 ("The day is shrinking fast", "The day falls from 24 hours to 12 and the ground at the equator speeds up to 3,340 km/h.",
  "the figure under a sky with several Suns drawn as a fast streak of light across the sky", "figure low left, the Sun streak arcing over", ["The day is shrinking fast", "Twelve Hours of Daylight Is Gone", "The Sun Now Crosses the Sky in Six Hours", "Nearly Three Times the Speed of Sound, Standing Still", "What a Twelve Hour Day Does to You"]),
 ("The air can't keep up with the ground", "The ground speeds up at once and the air is left behind: for the first hours, a wind of about 1,670 km/h.",
  "the figure leaning into a streaming sheet of dust and white streaks racing past across the frame", "figure left third leaning, streaks across the frame", ["The air can't keep up with the ground", "A Wind Four Times Faster Than Any Ever Measured", "Why the Air Gets Left Behind", "The Wind That Would Strip the Ground", "When the Ground Outruns the Sky"]),
 ("The oceans slide toward the equator", "At a twelve hour day the water wants to stand about 33 kilometers higher at the equator than today.",
  "the figure standing at a shoreline of a dark plain while a pale glowing sea gathers in a band toward the horizon", "figure at the left, the water band across the right", ["The oceans slide toward the equator", "Where Would the Oceans Go?", "The Poles Would Run Dry First", "A Planet That Pushes Its Own Water Away", "The Sea Piled Up at the Equator"]),
 ("Storms and the six hour day", "At a six hour day the Sun races across in three hours and storms are steered four times harder.",
  "the figure under a dark sky with a large spiralling storm swirl of white cloud tightening to a narrow band", "figure left, the storm swirl upper right", ["Storms and the six hour day", "Weather Squeezed Into Tight Bands", "Four Times Stronger Storms", "A Sunrise Every Six Hours", "Why Nobody Could Forecast This"]),
 ("The year gets thousands of days", "A year holds about 1,460 days at a six hour day, over 6,000 at the end, with a sunrise every 84 minutes.",
  "the figure beside a wall calendar whose pages are fanning off in a blur", "figure left, calendar upper right with pages flying", ["The year gets thousands of days", "A Sunrise Every 84 Minutes", "How Many Days in a Year Now?", "The Calendar That Broke", "Sleeping Eight Times a Day"]),
 ("A day as long as a movie", "At a two hour day you weigh half as much and the Sun crosses the sky in an hour.",
  "the figure standing on tiptoe, arms out, with a glowing outline showing a lighter footstep", "figure centre, tiptoe, soft glow beneath its feet", ["A day as long as a movie", "Half Your Weight, Half a Movie Long", "You Weigh Half of What You Did", "Two Hours and Everything Is Lighter", "Buildings Holding On With Half the Force"]),
 ("The ninety minute day", "At a day of an hour and a half you weigh about one eighth of what you did.",
  "the figure on tiptoe at the equator with the horizon curving and a small glowing sun streak racing, a pale ring of dust lifting at its feet", "figure low left, curving horizon, streak upper right", ["The ninety minute day", "You Weigh One Eighth of What You Did", "One More Nudge", "A Sunrise Every Hour and a Half", "The Last Step Before Weightless"]),
]
def part(n, ch):
    t, hook, subj, comp, titles = ch
    th = [dict(id="A", subject=subj, composition=comp, lighting=LIGHT, trigger="a tiny 'you' doing an ordinary action at an impossible scale; the goal is in view and the answer is not", text="", complements="shows the setup only; every number stays in the video"),
          dict(id="B", subject="the glowing day-length readout alone on a dark ground, the figure small below it", composition="readout upper third, figure lower third", lighting=LIGHT, trigger="knowledge gap", text="", complements="a weaker focal point at phone size"),
          dict(id="C", subject="the Earth seen from space with a bright band of day crossing it", composition="globe centred", lighting=LIGHT, trigger="scale", text="", complements="no human anchor")]
    return {"version": 1, "format": "short", "channel": "Possibility Lab", "video": f"Season 3 part {n} of 8", "hook": hook,
      "titles": [dict(text=x, mechanism=m) for x, m in zip(titles, ["unanswered question", "unexpected consequence", "scale shock", "hidden mechanism", "contradiction"])],
      "thumbnails": th,
      "pairings": [dict(title=0, thumbnail="A", scores=SCORE(86, 86, 88, 88, 82, 92, 86, 90), note="the title is the chapter's own plain statement; the cover is the figure about to meet it; clear at phone size"),
                   dict(title=2, thumbnail="B", scores=SCORE(76, 78, 72, 70, 74, 90, 70, 82), note="a number on the cover gives the answer away"),
                   dict(title=1, thumbnail="C", scores=SCORE(70, 74, 74, 66, 70, 92, 72, 80), note="no human anchor")],
      "scoresNote": "Scores are 1-100 creative judgments, not CTR predictions.",
      "winner": dict(title=t, thumbnail="A", thumbnailText=COVER.get(n, (None, ""))[1], why="The title is the chapter's own title in the long video, so Prism links the part to the film; the cover shows the figure in the setup, with no answer on screen."),
      "testAndCompare": ["A", "B"],
      "checks": dict(halfSecond=True, curiosity=True, duplication=True, competition=True, truth=True, satisfaction=True, originality=True),
      "checksNote": "My own creative judgments, not measured. truth: the cover is a frame of the film (setup only). The part never gives the film's ending.",
      "thumbnailFile": f"possibility-lab-s3p{n}-cover.jpg",
      "chatgptPrompt": "Create a YouTube Shorts cover, 9:16 (1080x1920).\nSubject: " + subj + ".\nComposition: 9:16 vertical; " + comp + "; keep everything important clear of the bottom quarter and the right-hand edge.\nLighting and treatment: " + LIGHT + "; clean, minimal, high contrast, stylised 3-D render.\nMood: wonder and anticipation.\nText: No text.\nScientific accuracy: it shows the setup only, never the answer; it is a diagram-style illustration, not a photograph.\nAvoid: no arrows, circles, faces, realistic people, logos, watermarks, extra text, or anything that looks like a real photograph.\nStyle: premium, art-directed, minimal 3-D science illustration that matches a clean code-rendered animation; not photorealistic, not generic AI art.",
      "shortsCover": dict(frameSeconds=COVER.get(n, (None, ""))[0], text=COVER.get(n, (None, ""))[1])}
for n, ch in enumerate(CH, 1):
    d = HERE / "parts" / f"part{n}"
    d.mkdir(parents=True, exist_ok=True)
    (d / "packaging.json").write_text(json.dumps(part(n, ch), indent=1, ensure_ascii=False))
# the long video
long = {"version": 1, "format": "long", "channel": "Possibility Lab", "video": "compilations/earth-spin",
  "hook": "Shorten the day to about 1 h 24 min and the ground at the equator moves at orbital speed: you weigh nothing.",
  "titles": [dict(text="What If Earth Spun Faster and Couldn't Stop?", mechanism="unexpected consequence"), dict(text="How Fast Can the Earth Spin Before You Float?", mechanism="unanswered question"),
             dict(text="Spin Earth Faster and the Poles Run Dry", mechanism="contradiction"), dict(text="A Day Only 84 Minutes Long: What Would It Do to You?", mechanism="scale shock"),
             dict(text="How Fast Are You Moving Right Now?", mechanism="personal relevance")],
  "thumbnails": [dict(id="A", subject="the blue figure close to the camera on its toes at the equator, the Sun a huge streak across a low horizon, a pale ring of dust lifting at its feet", composition="figure large on the left third at about 55% of the frame height, a low curving horizon, a huge sun streak on the right, a big empty sky", lighting=LIGHT + "; a magenta rim light on the figure", trigger="a tiny 'you' on tiptoe; the goal is the racing Sun and no answer is shown", text="", complements="the title asks the question; the picture shows the setup"),
                 dict(id="B", subject="the Earth with a band of ocean gathered round the equator and bare grey poles", composition="globe large centre-left", lighting=LIGHT, trigger="scale shock", text="", complements="adds a second consequence"),
                 dict(id="C", subject="the figure standing small on a plain with several Suns ghosted across the sky", composition="figure lower left, Suns arcing", lighting=LIGHT, trigger="visual paradox", text="", complements="silent picture of a day lasting minutes")],
  "pairings": [dict(title=0, thumbnail="A", scores=SCORE(88, 90, 86, 90, 80, 92, 86, 92), note="premise in the title, the setup in the picture"),
               dict(title=1, thumbnail="B", scores=SCORE(82, 84, 74, 72, 84, 86, 72, 85), note="two hooks dilute each other"),
               dict(title=3, thumbnail="C", scores=SCORE(74, 76, 70, 68, 72, 90, 70, 82), note="a number in the title gives the answer away")],
  "scoresNote": "Scores are 1-100 creative judgments, not CTR predictions.",
  "winner": dict(title="What If Earth Spun Faster and Couldn't Stop?", thumbnail="A", thumbnailText="", why="The title sets up the escalation and the picture shows the figure in the setup, the Sun racing, with no answer on screen."),
  "testAndCompare": ["A", "B"], "checks": dict(halfSecond=True, curiosity=True, duplication=True, competition=True, truth=True, satisfaction=True, originality=True),
  "checksNote": "My own creative judgments, not measured. truth: the cover is a frame of the film; the figure on tiptoe is the 1 h 30 beat.",
  "thumbnailFile": "possibility-lab-earth-spin-thumb-16x9.jpg",
  "chatgptPrompt": "Create a YouTube thumbnail, 16:9 (1920x1080).\nSubject: a smooth, glossy blue mannequin-style figure (simple rounded head and body, no facial features), seen from behind and slightly to the side, standing on tiptoe on a dark ground plane covered in a faint glowing grid, a few small glowing specks lifting off the ground around its feet.\nComposition: low camera close behind the figure; the figure fills the left third, about 55% of the frame height; the grid ground recedes to a low, gently curved horizon, with a large empty sky on the right.\nLighting and treatment: a huge low sun just above the horizon on the right, stretched into a short bright streak as if racing across the sky; a deep blue-violet sky fading to near-black at the top; a magenta (#EB63FF) rim light on the figure and a cool blue glow under its feet; clean, minimal, high contrast, stylised 3-D render.\nMood: disbelief: is it about to float?\nText: No text.\nScientific accuracy: the figure is only a little lighter, standing, not flying; it shows the setup only, never the answer.\nAvoid: no arrows, circles, faces, realistic people, logos, watermarks, extra text, spaceships, explosions.\nStyle: premium, art-directed, minimal 3-D science illustration that matches a clean code-rendered animation; not photorealistic, not generic AI art."}
(HERE / "packaging.json").write_text(json.dumps(long, indent=1, ensure_ascii=False))
print("wrote 8 part packagings and the long video's")
