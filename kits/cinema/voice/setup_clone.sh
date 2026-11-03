#!/bin/bash
# Clone-voice toolchain: Chatterbox (MIT code + weights) on CPU, in its own venv. Needs huggingface.co
# (weights) and download.pytorch.org is NOT needed (torch comes from PyPI). Weights never go in git.
#   kits/cinema/voice/setup_clone.sh [DIR]      (default: $HOME/.cache/cinema-voice)
set -euo pipefail
DIR=${1:-$HOME/.cache/cinema-voice}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$DIR/models/chatterbox"
[ -x "$DIR/clone-venv/bin/python" ] || python3.11 -m venv "$DIR/clone-venv" 2>/dev/null || python3 -m venv "$DIR/clone-venv"
"$DIR/clone-venv/bin/pip" install -q --disable-pip-version-check chatterbox-tts==0.1.7 huggingface_hub soundfile pyloudnorm
"$DIR/clone-venv/bin/python" -I - "$HERE/clone.lock.json" "$DIR/models/chatterbox" <<'PY'
import hashlib, json, sys
from huggingface_hub import snapshot_download, model_info
lock_p, dest = sys.argv[1], sys.argv[2]
lock = json.load(open(lock_p))
info = model_info(lock["repo"], revision=None if lock["revision"].startswith("TODO") else lock["revision"])
lic = [t for t in info.tags if t.startswith("license:")]
assert lic == ["license:" + lock["licence_expected"]], f"weights licence is {lic}, expected {lock['licence_expected']}: stop"
snapshot_download(lock["repo"], revision=info.sha, local_dir=dest, allow_patterns=list(lock["files"]))
def sha(p):
    h = hashlib.sha256(); h.update(open(p, "rb").read()); return h.hexdigest()
first = not any(lock["files"].values())
for f in lock["files"]:
    got = sha(f"{dest}/{f}")
    if lock["files"][f] and lock["files"][f] != got: sys.exit(f"SHA256 mismatch for {f}")
    lock["files"][f] = got
lock["revision"] = info.sha
json.dump(lock, open(lock_p, "w"), indent=1)
print("weights ready at", dest, "(FIRST download: review and commit clone.lock.json)" if first else "(hashes verified)")
PY
