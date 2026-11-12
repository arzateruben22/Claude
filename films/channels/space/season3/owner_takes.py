"""owner_takes.py: every candidate take of every script line in the owner's recording: slide each line's words over the ASR word stream, keep runs that match (>= 0.5), best first.
Writes /tmp/ovoice/candidates.json. usage: python3 owner_takes.py"""
import difflib, json, re
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(); TENS = "x x twenty thirty forty fifty sixty seventy eighty ninety".split()
def say(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + say(n % 100))
    return say(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + say(n % 1000))
def expand(tok):
    """a recognizer token -> the spoken words (digits spelled out): '288,000,' -> two hundred eighty eight thousand"""
    t = tok.strip(".,?!").replace(",", "")
    if t.isdigit():
        if len(t) == 4 and t[2:] != "00" and not t.endswith("000"): return say(int(t[:2])).split() + say(int(t[2:])).split()   # '2520' -> twenty five twenty
        return say(int(t)).split()
    if re.fullmatch(r"\d+\.\d+", t): a, b = t.split("."); return say(int(a)).split() + ["point"] + [ONES[int(d)] for d in b]
    return [tok]
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
raw = json.load(open("/tmp/ovoice/asr_words.json")); asr = []
for w, s0, e0 in raw:                                       # drop the duplicate slot hits, spell digits out
    if asr and abs(s0 - asr[-1][1]) < 0.15 and norm(w) == norm(asr[-1][0]): continue
    ws = expand(w); d = (e0 - s0) / len(ws)
    for k, x in enumerate(ws): asr.append((x, s0 + k * d, s0 + (k + 1) * d))
aw = [norm(w) for w, s, e in asr]
sys_lines = {}
for l in open("/home/user/claude/films/channels/space/long01/v4/lines.txt"):
    if "|" in l and not l.startswith("#"): i, t = l.rstrip("\n").split("|", 1); sys_lines[i] = t
B = {"B1": "Watch the Moon. It's coming closer.", "B2": "A quarter closer. What changes first?", "B3": "Half the distance. Now the ocean climbs.", "B4": "The night is getting too bright.",
     "B5": "What happens when the Moon outgrows the Sun?", "B6": "It's not just the sea. The ground moves too.", "B7": "Watch it rise in the wrong place.", "B8": "There's a distance no moon survives."}
D = {"D1": "If that made the sky feel bigger, tap like and follow.", "D2": "If that made the sky feel bigger, tap like and subscribe.", "D3": "Still looking up? Tap like and follow.", "D4": "Still looking up? Tap like and subscribe."}
sys_lines.update(B); sys_lines.update(D)
# spoken numerals as words in the recording: ASR writes digits or words; compare on a number-word normalisation
NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "20": "twenty", "25": "twentyfive", "30": "thirty", "42": "fortytwo"}
res = {}
for lid, text in sys_lines.items():
    sw = [norm(x) for w in text.replace("-", " ").split() for x in ([w] if True else []) if norm(x)]; n = len(sw); cands = []
    for i in range(len(aw)):
        for L in (n - 2, n - 1, n, n + 1, n + 2, n + 3):
            if L < 2 or i + L > len(aw): continue
            r = difflib.SequenceMatcher(None, sw, aw[i:i + L]).ratio()
            if r >= 0.5: cands.append((r, i, i + L))
    cands.sort(reverse=True); chosen = []
    for r, i, j in cands:
        if all(j <= a or i >= b for _, a, b in chosen): chosen.append((r, i, j))
    res[lid] = [{"ratio": round(r, 2), "t0": asr[i][1], "t1": asr[j - 1][2], "heard": " ".join(w for w, _, _ in asr[i:j])} for r, i, j in sorted(chosen, key=lambda x: asr[x[1]][1])]
json.dump(res, open("/tmp/ovoice/candidates.json", "w"), indent=1)
for lid, c in res.items(): print(lid, [(x["t0"], x["t1"], x["ratio"]) for x in c])
