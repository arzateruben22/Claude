#!/usr/bin/env bash
# Downloads the models the thumbnail cut-outs need (run from vice-unfiltered/).
# All from Hugging Face: BiRefNet (MIT), MODNet (Apache-2.0). Whisper models download on first use.
set -e
mkdir -p assets/models
dl() { [ -s "$2" ] && echo "have $2" || curl -L --fail -o "$2" "$1"; }
dl https://huggingface.co/onnx-community/BiRefNet-portrait-ONNX/resolve/main/onnx/model.onnx assets/models/birefnet_portrait.onnx
dl https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx assets/models/birefnet_lite.onnx
dl https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx assets/models/modnet.onnx
echo "models ready in assets/models/"
