"""clean_claims.py: viewer-facing claims for the YouTube 'Sources' list (Prism builds it from claims.json `claim` + `source_title`).
`claim` = the plain spoken sentence; the old technical text moves to `derivation`; derived numbers get source_title 'Our calculation (shown in the film)'.
Then every part's claims.json (ep13..ep20) is rewritten from long01/claims.json (the claims its chapter uses). Idempotent."""
import json, os, re
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")); L1 = R + "/long01"
cl = json.load(open(L1 + "/claims.json"))
used = set(re.findall(r"\{(c\d+)\}", open(L1 + "/script.md").read()))
dropped = [c["id"] for c in cl if c["id"] not in used]; cl = [c for c in cl if c["id"] in used]      # claims for lines that were cut leave long01 too
print("dropped (no longer said in the film):", dropped)
PLAIN = {
"c1": "On average the Moon is about 384,400 km from Earth.",
"c2": "The Moon is drifting away from Earth by about 3.8 centimeters a year.",
"c3": "Seen from Earth, the Moon looks about half a degree wide.",
"c4": "The Sun and the Moon look about the same size in our sky.",
"c5": "A Moon at three quarters of today's distance would look about one and a third times wider.",
"c6": "Half of today's distance is about 192,000 km.",
"c7": "A Moon at half the distance would look about twice as wide.",
"c8": "Tides come from the difference in the Moon's pull across the Earth.",
"c9": "The tide-raising pull gets weaker with the cube of the distance.",
"c10": "At half the distance, the Moon's tidal pull would be about eight times stronger.",
"c11": "Reflected moonlight gets weaker with the square of the distance, so a closer Moon would be brighter.",
"c13": "A Moon on a smaller orbit would travel faster across the sky.",
"c15": "A Moon that looks bigger than the Sun covers it completely when the two line up, and its shadow on Earth is wider.",
"c16": "A total solar eclipse can be seen somewhere on Earth roughly every year and a half.",
"c17": "The Moon's orbit is tilted about 5 degrees, so eclipses do not happen every month.",
"c18": "The solid ground is lifted and lowered by the Moon's pull by tens of centimeters a day.",
"c19": "A Moon at 50,000 km would look nearly eight times wider than tonight's.",
"c20": "At 50,000 km the Moon's tidal pull would be about 450 times today's.",
"c21": "At 50,000 km a lap around Earth would take about a day and a quarter.",
"c22": "A moon closer than about 42,000 km orbits faster than the Earth turns, so it would rise in the west.",
"c23": "Inside the Roche limit, a body's own gravity can no longer hold it together against tides.",
"c24": "For a fluid Moon, the Roche limit is about 18,000 km from Earth's centre.",
"c25": "For a rigid Moon, the Roche limit is about 9,500 km from Earth's centre.",
"c26": "At 18,000 km the Moon would look more than 20 times wider than tonight's.",
"c27": "Material torn from a moon inside the Roche limit can spread out into a ring.",
"c28": "Light takes about a second and a quarter to travel from the Moon to Earth.",
"c29": "At three quarters of the distance, moonlight would take about one second to arrive.",
"c30": "At three quarters of the distance, the tidal pull would be more than twice today's.",
"c31": "In our thought experiment the Moon is brought to 150,000 km.",
"c32": "A Moon at 150,000 km would look about two and a half times wider.",
"c33": "A Moon at 150,000 km would give about six and a half times the moonlight.",
"c34": "At 150,000 km, one lap around Earth would take about seven days instead of 27.",
"c35": "In our thought experiment the Moon is brought to 100,000 km.",
"c36": "A Moon at 100,000 km would look nearly four times wider.",
"c37": "In our thought experiment the Moon is brought to 70,000 km.",
"c38": "A Moon at 70,000 km would look about five and a half times wider.",
"c39": "At 70,000 km the Moon's tidal pull would be more than 160 times today's.",
"c40": "In our thought experiment the Moon is brought to 50,000 km.",
"c41": "At 18,000 km the Moon would span roughly 11 degrees at the horizon, wider than a fist held at arm's length.",
"c42": "The Sun's tidal effect on Earth is roughly half the Moon's.",
"c43": "Tides slow the Earth's spin and push the Moon's orbit outward, which is why it drifts away.",
"c44": "Inside the Roche limit material spreads into rings; outside it, material clumps into moons.",
"c45": "Saturn's rings are made of ice and rock, mostly small icy grains.",
"c48": "The Moon's distance is measured by bouncing laser pulses off mirrors left by the Apollo missions.",
}
def plain(s): s = re.sub(r"\{c\d+\}|\{-\}", "", s).strip(); return s[0].upper() + s[1:] if s else s
for c in cl:
    if "derivation" not in c: c["derivation"] = c["claim"]
    c["claim"] = PLAIN.get(c["id"]) or plain(c.get("sentence") or c["claim"])
    t = (c.get("source_title") or "").split(" — ")[0].strip()
    if not t or not c.get("source_url"): t = "Our thought experiment (not a measurement)" if "waypoint" in c["derivation"] else "Our calculation (shown in the film)"; c["source_url"] = ""
    c["source_title"] = t
    for k in ("claim", "source_title", "note"):
        if k in c: c[k] = re.sub(r"calc\\.py", "our calculation", c[k]).replace("calc.py", "our calculation")
json.dump(cl, open(L1 + "/claims.json", "w"), indent=1, ensure_ascii=False)
sc = open(L1 + "/script.md").read()
for n in range(1, 9):
    sec = re.search(rf"## ch{n} .*?(?=\n## |\Z)", sc, re.S).group(0); tags = set(re.findall(r"\{(c\d+)\}", sec))
    json.dump([c for c in cl if c["id"] in tags], open(f"{R}/ep{12 + n}/claims.json", "w"), indent=1, ensure_ascii=False)
bad = [c["id"] for c in cl if re.search(r"calc\.py|atan|\bc\d+\b", c["claim"] + c["source_title"])]
print(len(cl), "claims; still technical:", bad)
for c in cl[:4] + [x for x in cl if x["id"] in ("c10", "c24")]: print(c["id"], "|", c["claim"], "|", c["source_title"])
