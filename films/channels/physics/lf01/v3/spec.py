import json
def lin(pts):
    """piecewise-linear time map from [(old, new), ...]"""
    def m(t):
        if t <= pts[0][0]: return t - pts[0][0] + pts[0][1]
        for (a, b), (c, d) in zip(pts, pts[1:]):
            if t <= c: return b + (t - a) / (c - a) * (d - b)
        return t - pts[-1][0] + pts[-1][1]
    return m
def tag_badges(f, plates_on_cut):   # label rule: 1-6 s at the start, then 3 s at each plate/code cut
    out = [{"id": "lab0", "kind": "tag", "text": "Drawn by code · model", "t0": 1.0, "t1": 6.0, "slot": "tl"}]
    for k, (t, text) in enumerate(plates_on_cut): out.append({"id": f"lab{k+1}", "kind": "tag", "text": text, "t0": round(t, 2), "t1": round(t + 3.0, 2), "slot": "tl"})
    f["badges"] = out
def p5(f, win, S, E, END):
    enter = S(7) + 0.3; appr = enter - 6.5; s5 = S(8) + 1.5
    old = f["ev"]["bullet"]; m = lin([(0, 0), (old["approach"], appr), (old["enter"], enter), (57.8667, S(10)), (62.6667, END)])
    f["ev"]["bullet"] = {"enter": enter, "approach": appr, "s5": s5}
    f["cam"] = [dict(c, t=round(m(c["t"]), 4)) for c in f["cam"]]
    for p in f["plates"]: p["t0"] = 0.0; p["t1"] = round(S(10) - 0.2, 2)
    f["ev"]["fades"] = []
    tag_badges(f, [(S(10) - 0.2, "Drawn by code · model")])
    f["_ladder"] = [["1×", "real time", "one apple", 0.0, round(S(5), 2)], ["10,000×", "slower", "one bullet, one apple", round(S(5) + 1.2, 2), round(s5, 2)],
                    ["50,000×", "slower", "one bullet, one apple", round(s5, 2), round(S(10), 2)], ["50,000×", "up next", "a storm", round(S(10), 2), END]]

# sound cues per part (kitchen palette), times from the retimed film
def cues5(f, win, S, E, END):
    b = f["ev"]["bullet"]; e = b["enter"]
    return [{"at": b["approach"] + 1.0, "kind": "slowmo", "dur": 6.0, "pan": [-0.6, 0.0], "gain": -1},
            {"at": e + 0.2, "kind": "squeeze", "dur": 1.5, "gain": 1}, {"at": e + 0.4, "kind": "creak", "dur": 1.6, "gain": -4},
            {"at": e + 1.0, "kind": "splat", "dur": 0.7, "gain": 1}, {"at": e + 1.0, "kind": "boom", "dur": 2.0, "gain": -6},
            {"at": e + 1.6, "kind": "spray", "dur": 2.8, "pan": 0.3, "gain": 1}, {"at": b["s5"], "kind": "slowmo", "dur": 5.0, "pan": [0.0, 0.7], "gain": -3},
            {"at": S(9) + 1.6, "kind": "whiz", "dur": 0.5, "pan": [-0.9, 0.9], "gain": 1},
            {"at": S(10) - 0.2, "kind": "whoosh", "dur": 1.3, "pan": [-0.3, 0.5], "gain": -3}, {"at": E(10) - 2.4, "kind": "thunder", "dur": 4.0, "gain": -3}]
CUES = {5: cues5}

def p6(f, win, S, E, END):
    old = f["ev"]["leader"]; t0 = S(5) + 2.0; ground = S(8) + 0.3; sc = (ground - t0) / (old["ground"] - old["t0"])
    f["ev"]["leader"] = {"t0": round(t0, 3), "stepEvery": round(3.0 * sc, 3), "steps": old["steps"], "ground": round(ground, 3), "preT0": round(S(3) + 0.2, 3), "preEnd": round(S(3) + 3.5, 3), "preK": round(22.0 / 3.3, 3), "climb": 16.0}
    f["ev"]["storm"] = round(S(2) - 0.5, 3); f["ev"]["fades"] = []
    m = lin([(0, 0), (16.03, S(3)), (36.7, S(7)), (63.37, S(10)), (73.07, END)]); f["cam"] = [dict(c, t=round(m(c["t"]), 4)) for c in f["cam"]]
    for p in f["plates"]: p["t0"] = 0.0; p["t1"] = END
    f["factorKeys"] = [[0.0, 6.0]]
    tag_badges(f, [])
    f["_ladder"] = [["1\u00d7", "real time", "one thunderstorm", 0.0, round(S(2), 2)], ["1,000\u00d7", "slower", "one thunderstorm", round(S(2) + 1.8, 2), round(S(5) + 1.0, 2)],
                    ["1,000,000\u00d7", "slower", "one thunderstorm", round(S(5) + 1.0, 2), round(S(11), 2)], ["1,000,000\u00d7", "up next", "light itself", round(S(11), 2), END]]

def p7(f, win, S, E, END):
    F = 1e9; f["factorKeys"] = [[0.0, 9.0]]; f["ev"]["flash8"] = 1e9; f["ev"]["light9"] = 1e9
    f["ev"]["fronts"] = [{"t0": round(S(1) + 1.6, 3), "F": 1.0, "dur": 0.5}, {"t0": round(S(2) + 1.2, 3), "F": 1e7, "dur": 0.5}, {"t0": round(S(3) + 1.2, 3), "F": 1e8, "dur": 2.0}, {"t0": round(S(6) + 0.4, 3), "F": 1e9, "dur": round(END - S(6) - 0.4, 3)}]
    f["ev"]["fades"] = []
    for p in f["plates"]: p["t0"] = 0.0; p["t1"] = END
    f["cam"] = [{"t": 0.0, "look": [0.0, 1.2, -0.8], "fitW": 5.6, "yaw": -3.0, "pitch": 3.0, "ease": "p2"}, {"t": END, "look": [0.0, 1.2, -0.8], "fitW": 5.0, "yaw": 2.0, "pitch": 3.0, "ease": "sine"}]
    tag_badges(f, [])
    f["_ladder"] = [["1\u00d7", "real time", "light across a kitchen", 0.0, round(S(2) + 0.8, 2)], ["10 million\u00d7", "slower", "light across a kitchen", round(S(2) + 0.8, 2), round(S(3) + 0.8, 2)],
                    ["100 million\u00d7", "slower", "light across a kitchen", round(S(3) + 0.8, 2), round(S(4) + 1.0, 2)], ["1 billion\u00d7", "slower", "light across a kitchen", round(S(4) + 1.0, 2), round(S(9), 2)],
                    ["1 billion\u00d7", "up next", "a computer chip", round(S(9), 2), END]]

def p8(f, win, S, E, END):
    m = lin([(0, 0), (6.4, S(2) + 0.5), (11.4, E(2)), (11.97, S(3) + 0.3), (17.97, S(4) + 0.3), (21.63, S(5) + 0.3), (39.03, E(7)), (43.87, S(8)), (52.07, E(8)), (57.8, S(9)), (73.3, END)])
    ev = f["ev"]; ev["chip"] = [round(m(x), 3) for x in ev["chip"]]; ev["ruler"] = [round(m(x), 3) for x in ev["ruler"]]; ev["hair"] = [round(m(x), 3) for x in ev["hair"]]; ev["pulse"] = round(m(ev["pulse"]), 3)
    ev["fades"] = [round(m(x), 3) for x in ev["fades"]]
    f["factorKeys"] = [[round(m(t), 3), k] for t, k in f["factorKeys"]]; f["cam"] = [dict(c, t=round(m(c["t"]), 4)) for c in f["cam"]]
    for p in f["plates"]: p["t0"] = 0.0; p["t1"] = round(S(2) + 0.2, 2)
    tag_badges(f, [(S(2) + 0.2, "Drawn by code \u00b7 model")])
    f["_ladder"] = [["1 billion\u00d7", "slower", "a computer chip", 0.0, round(S(3) + 1.2, 2)], ["10 billion\u00d7", "slower", "a computer chip", round(S(3) + 1.2, 2), round(S(4) + 0.5, 2)],
                    ["100 billion\u00d7", "slower", "a computer chip", round(S(4) + 0.5, 2), round(S(5) + 0.5, 2)], ["1 trillion\u00d7", "slower", "a computer chip", round(S(5) + 0.5, 2), END]]
SPEC = {5: p5, 6: p6, 7: p7, 8: p8}
