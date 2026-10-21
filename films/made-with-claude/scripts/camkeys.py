"""Edit camera keys in timeline.json from the command line (keeps the file's one-key-per-line layout).
python3 -I scripts/camkeys.py FORMAT T key=json ...   e.g.  16x9 2.55 'pos=[-2.4,1.6,4.6]' 'look=[0.4,0.5,-0.1]'
"""
import json, re, sys
from pathlib import Path
P = Path(__file__).resolve().parent.parent / "src" / "timeline.json"

def dump(J):
    out = json.dumps(J, indent=2, ensure_ascii=False)
    out = re.sub(r'\{\n\s+"t":([^{}]*?)\n\s+\}', lambda m: '{ "t":' + re.sub(r'\s*\n\s*', ' ', m.group(1)) + ' }', out)
    out = re.sub(r'\{\n\s+"type":([^{}]*?)\n\s+\}', lambda m: '{ "type":' + re.sub(r'\s*\n\s*', ' ', m.group(1)) + ' }', out)
    out = re.sub(r'\{\n\s+"id":([^{}]*?)\n\s+\}', lambda m: '{ "id":' + re.sub(r'\s*\n\s*', ' ', m.group(1)) + ' }', out)
    out = re.sub(r'\[\n\s+([^\[\]{}]*?)\n\s+\]', lambda m: '[' + re.sub(r'\s*\n\s*', ' ', m.group(1)) + ']', out)
    return out + "\n"

if __name__ == "__main__":
    J = json.loads(P.read_text())
    if len(sys.argv) > 2:
        fmt, t = sys.argv[1], float(sys.argv[2])
        key = next(k for k in J["camera"][fmt] if abs(k["t"] - t) < 1e-6)
        for kv in sys.argv[3:]:
            k, v = kv.split("=", 1)
            if v == "null": key.pop(k, None)
            else: key[k] = json.loads(v)
    P.write_text(dump(J))
