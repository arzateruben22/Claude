"""make_part_packs.py: packaging.json for parts 2-8 (ep14-ep20) through season2/pack.py (films/channels/PACKAGING.md). Part 1's was written the same way."""
import json, os, subprocess, sys
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
T = json.load(open(R + "/long01/part_titles.json"))["parts"]
# n: (hook, [5 (title, mechanism) incl. the part title first], [(A subject, text), (B subject, text), (C subject, text)], winner thumb, cover text, why, scores of the winning pairing)
P = {
2: ("A quarter of the way closer, the Moon would look about a third wider and the tides would already be stronger.",
    [("One Quarter Closer", "unanswered question"), ("What If the Moon Came 25% Closer?", "unanswered question"), ("A Moon One Third Wider Would Change the Tides", "hidden mechanism"), ("How Much Bigger Is a Moon a Quarter Closer?", "knowledge gap"), ("The First Thing a Closer Moon Changes", "unexpected consequence")],
    [("a small figure on a night beach under a Moon one third wider than tonight", "1.3x wider"), ("two Moon discs side by side, today's and the closer one", "1.3x"), ("the sea with a faint tide line climbing the sand under the Moon", "")], "A", "1.3× wider", "A single clear number the viewer can picture, over the owner's beach."),
3: ("Halve the Moon's distance and its tidal pull grows about eightfold; this is when the ocean starts to climb the beach.",
    [("When the Ocean Starts to Climb", "unexpected consequence"), ("Half the Distance, Eight Times the Tide", "scale shock"), ("What Happens to the Sea If the Moon Gets Closer?", "unanswered question"), ("The Tide Line Climbs Past You", "visual paradox"), ("Why a Closer Moon Pulls the Ocean Up the Beach", "hidden mechanism")],
    [("the waterline high on the sand, the figure standing back, a bigger Moon above", "8x the tides"), ("the sea piled up against a big Moon, a wide dark sky", ""), ("a tide marker post with the water at the top", "8x")], "A", "8× the tides", "Eight times is the whole story in two words and it is the true tide scaling at half the distance."),
4: ("Bring the Moon closer and moonlight gets far brighter, because light fades with the square of distance.",
    [("The Night Gets Too Bright", "unexpected consequence"), ("Moonlight 6 Times Brighter? What a Closer Moon Does", "scale shock"), ("Why the Night Sky Would Stop Being Dark", "knowledge gap"), ("A Night Bright Enough to Read By?", "unanswered question"), ("The Moon Gets Closer and the Stars Disappear", "contradiction")],
    [("a big bright Moon over a silver-lit beach, the figure in a long shadow", "6.5x the light"), ("the sky washed pale, a few stars left", ""), ("a split frame: tonight's dark sky and the bright one", "6.5x")], "A", "6.5× the light", "A precise number that raises the question 'what would that look like?'"),
5: ("When the Moon looks bigger than the Sun, a total eclipse covers more of the sky and lasts longer; here is what it looks like.",
    [("A Moon Bigger Than the Sun", "visual paradox"), ("What an Eclipse Looks Like With a Bigger Moon", "unanswered question"), ("A Long Dark Noon: Eclipses With a Closer Moon", "scale shock"), ("Why Eclipses Are Possible at All", "knowledge gap"), ("The Daytime Sky Goes Dark Over the Beach", "unexpected consequence")],
    [("a black disc with a thin silver corona over a dusk-lit sea", "A dark noon"), ("the daytime sky dim and violet, stars out, the figure small", ""), ("the Sun and Moon discs, the Moon clearly larger", "")], "A", "A dark noon", "The picture is the hook: a huge black disc in a daytime sky."),
6: ("A closer Moon pulls on solid ground as well as the sea; the Earth's crust would flex up and down with it.",
    [("It's Not Just the Sea", "unexpected consequence"), ("The Ground Has Tides Too", "hidden mechanism"), ("Would a Closer Moon Make the Earth's Crust Move?", "unanswered question"), ("The Solid Earth Rises and Falls With the Moon", "knowledge gap"), ("What the Moon Does to the Rock Under You", "personal relevance")],
    [("a huge Moon over a beach with faint cracks of light in the sand", "The ground moves too"), ("the figure standing on rock that visibly lifts", ""), ("a cross-section of Earth with a bulge toward the Moon", "")], "A", "The ground moves too", "A surprising extension of something viewers think only affects water."),
7: ("Put the Moon closer than about 42,000 km and it circles faster than Earth turns, so it would rise in the west.",
    [("The Moon Rises in the West", "contradiction"), ("A Moon That Outruns the Sky", "visual paradox"), ("Why a Close Enough Moon Would Rise in the West", "knowledge gap"), ("The Distance Where the Moon Reverses Its Path", "hidden mechanism"), ("The Moon Would Cross the Sky in Hours", "scale shock")],
    [("a huge Moon low in the west over the sea with a faint arrow-free arc behind it", "Faster than a day"), ("a clock face and the Moon's path across the sky", ""), ("the Moon rising where the Sun sets", "")], "A", "Faster than a day", "Names the physical reason (the orbit outruns Earth's spin) without repeating the title."),
8: ("There is a distance where a moon is torn apart by tides; this film shows how close that is for our Moon, and stops just before it happens.",
    [("The Distance No Moon Survives", "hidden mechanism"), ("How Close Can the Moon Get Before It Breaks?", "unanswered question"), ("The Roche Limit: Where a Moon Comes Apart", "knowledge gap"), ("The Last Safe Distance for the Moon", "unexpected consequence"), ("A Moon That Fills the Sky and Is About to Break", "scale shock")],
    [("a Moon filling most of the frame over a thin beach, cracks of shadow", "Too close"), ("the Moon stretched slightly egg-shaped", ""), ("a distance marker reading about 18,000 km", "")], "A", "Too close", "One strong picture and a feeling, with the fix for the answer in the full video."),
}
SC = {"scroll": 0, "curiosity": 0}
for n, (hook, titles, th, win, cover, why) in P.items():
    ep = f"{R}/ep{12 + n}"; ids = "ABC"
    thumbs = [{"id": ids[i], "subject": s, "composition": "owner's beach, the figure lower third, the Moon upper half, space for the words", "lighting": "teal and violet night, silver road on the water", "trigger": "scale with a human anchor", "text": tx, "complements": "the title states the idea; the picture shows it"} for i, (s, tx) in enumerate(th)]
    spec = {"format": "short", "hook": hook, "titles": titles, "thumbnails": thumbs,
            "pairings": [[0, "A", [76 + n % 3, 80, 80, 82, 72, 92, 82, 84], why], [1, "B", [70, 76, 78, 72, 68, 92, 80, 80], "Plainer, less pull."], [2, "C", [66, 74, 72, 70, 70, 90, 78, 78], "Needs a second look."]],
            "winner": {"title": T[str(n)], "thumbnail": "A", "thumbnailText": cover, "why": why},
            "thumbnailFile": f"one-more-orbit-s3-part{n}-cover.jpg",
            "chatgptPrompt": f"Create a YouTube Shorts / TikTok cover, 9:16 (1080x1920). Keep the focal point and the text inside the centre safe area. Subject: {th[0][0]}. Text: \"{cover}\" in a clean geometric sans (Lexend style), white with one teal word (#4FE3C6). Palette: indigo night (#0B0F2A), teal glow. Avoid arrows, circles, faces, logos, watermarks, anything that looks like a real NASA photo. It must read as a painted illustration. Scientific accuracy: this is a thought experiment, the real Moon is not coming closer.",
            "shortsCover": {"frameSeconds": {2: 20, 3: 20, 4: 20, 5: 45, 6: 20, 7: 45, 8: 30}[n], "text": cover}}
    sp = f"/tmp/spec_s3_{n}.json"; json.dump(spec, open(sp, "w")); subprocess.run(["python3", "-I", f"{R}/season2/pack.py", ep, sp], check=True)
