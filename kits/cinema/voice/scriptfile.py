"""Reading a film's script.md, and matching spoken words to script words. No audio libraries, so
the compiler can use it with the system Python."""
import re
from pathlib import Path


def script_lines(path):
    """[(beat id, spoken text, starred words)] from a script.md."""
    out, beat = [], None
    text = Path(path).read_text()
    for m in re.finditer(r"^## (\S+)|^vo: (.*?)(?=\n\s*\n|\nend card|\n## |\Z)", text, re.S | re.M):
        if m.group(1):
            beat = m.group(1)
            continue
        raw = re.sub(r"\s+", " ", m.group(2)).strip()
        stars = re.findall(r"\*([^*]+)\*", raw)
        out.append((beat, re.sub(r"\{[^}]*\}", "", raw).replace("*", "").strip(), stars))
    return out


NUM = dict(zip("0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 30 40 50 60 70 80 90 100".split(),
               ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
                "sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred").split()))


def norm(w):
    """Lower-case, letters only, and digits as words (the recognizer writes "12", scripts "twelve")."""
    w = re.sub(r"[^a-z0-9']", "", w.lower())
    return NUM.get(w, w)
