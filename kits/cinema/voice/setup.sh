#!/bin/bash
# The voice toolchain: Kokoro-82M (text to speech) and Parakeet TDT 0.6B v2 (word timings), offline.
# Models are never committed (GitHub's 100 MB limit); this rebuilds them from pinned sources and
# checks every file's SHA256. Hugging Face is blocked from the studio's containers, so everything
# comes from GitHub release files.
#
#   kits/cinema/voice/setup.sh [DIR]      (default: $HOME/.cache/cinema-voice)
#
# Then: export CINEMA_VOICE=DIR, and run the voice scripts with $CINEMA_VOICE/venv/bin/python.
# Films commit the WAVs and timing JSON this makes, so rendering and mixing never need it.
#
# Licences: Kokoro-82M and its voices Apache-2.0, kokoro-onnx MIT, Parakeet CC-BY-4.0 (credit
# NVIDIA), sherpa-onnx Apache-2.0, Silero VAD MIT. Record them in the film's assets.md.
set -euo pipefail
DIR=${1:-$HOME/.cache/cinema-voice}
mkdir -p "$DIR/models"
K=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
S=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models

fetch() {   # url file sha256
  if [ -f "$2" ] && echo "$3  $2" | sha256sum -c --status; then return; fi
  curl -fsSL --retry 4 -o "$2.part" "$1" && mv "$2.part" "$2"
  echo "$3  $2" | sha256sum -c --quiet
}
fetch $K/kokoro-v1.0.onnx "$DIR/models/kokoro-v1.0.onnx" 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
fetch $K/voices-v1.0.bin "$DIR/models/voices-v1.0.bin" bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d
fetch $S/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2 "$DIR/models/parakeet.tar.bz2" 157c157bc51155e03e37d2466522a3a737dd9c72bb25f36eb18912964161e1ad
fetch $S/silero_vad.onnx "$DIR/models/silero_vad.onnx" 9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6
[ -d "$DIR/models/parakeet" ] || { mkdir -p "$DIR/models/parakeet" && tar -xjf "$DIR/models/parakeet.tar.bz2" -C "$DIR/models/parakeet" --strip-components 1; }

[ -x "$DIR/venv/bin/python" ] || python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install -q --disable-pip-version-check \
  kokoro-onnx==0.6.1 onnxruntime==1.31.0 soundfile==0.14.0 sherpa-onnx==1.13.8 espeakng-loader==0.2.4 phonemizer==3.4.0 "numpy>=2"
"$DIR/venv/bin/python" -c "import kokoro_onnx, sherpa_onnx, onnxruntime; print('voice toolchain ready: onnxruntime', onnxruntime.__version__)"
