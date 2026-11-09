"""python3 -I kits/cinema/script/test_via.py: lint.py accepts verified_via "not read" and still rejects other values (exit 1 on a failure)."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

LINT = Path(__file__).resolve().parent / "lint.py"
SCRIPT = "# T\n\n## hook {pre: 0.03} (0-3.4 s)\nvo: Why is the sky dark? {c1}\n"
CLAIM = {"id": "c1", "sentence": "Why is the sky dark?", "claim": "x", "source_url": "https://example.org/", "source_title": "t",
         "accessed": "2026-11-09", "verified_via": "", "status": "TODO open link"}


def run(via):
    with tempfile.TemporaryDirectory() as d:
        Path(d, "script.md").write_text(SCRIPT)
        Path(d, "claims.json").write_text(json.dumps([{**CLAIM, "verified_via": via}]))
        return subprocess.run([sys.executable, "-I", str(LINT), d], capture_output=True, text=True).stdout


bad = []
for st in ("OPEN", "SOURCE-READ", "bogus"):
    with tempfile.TemporaryDirectory() as d:
        Path(d, "script.md").write_text(SCRIPT)
        Path(d, "claims.json").write_text(json.dumps([{**CLAIM, "verified_via": "page", "status": st}]))
        out = subprocess.run([sys.executable, "-I", str(LINT), d], capture_output=True, text=True).stdout
    has = "status must be one of" in out
    print(f"status {st!r}: {'rejected' if has else 'accepted'}")
    if has != (st == "bogus"):
        bad.append(st)
for via, want_error in (("not read", False), ("page", False), ("search excerpt", False), ("guessed", True)):
    out = run(via)
    has = "verified_via must be one of" in out
    print(f"{via!r}: {'rejected' if has else 'accepted'}")
    if has != want_error:
        bad.append(via)
sys.exit(1 if bad else 0)
