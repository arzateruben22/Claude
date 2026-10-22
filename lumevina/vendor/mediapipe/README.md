# MediaPipe Tasks Vision 1.1.1 (vendored)

`vision_bundle.mjs` is `@mediapipe/tasks-vision@1.1.1` from npm, unchanged
(Apache License 2.0, © Google LLC; https://github.com/google-ai-edge/mediapipe).
SHA-256: a84921e02321e582484c1f8126d344b5f33b791fa09c640a52e20ee8632068f1

It runs the face landmark model in the browser during capture, to guide
positioning and show which area will be measured. No image leaves the device
for this.

The WebAssembly runtime (`vision_wasm_internal.{js,wasm}`, 13.5 MB) and the
face model (`face_landmarker.task`, 3.8 MB) load from pinned URLs by default
(jsDelivr for the runtime, Google's model storage for the model; see
`js/skin/face.js`). To self-host them, run
`node scripts/fetch-skin-vendor.mjs`, which downloads both here and checks
their SHA-256, and set `skin.mediapipeWasm` and `skin.faceModel` in
`js/site-config.js` to `vendor/mediapipe` paths. They are git-ignored.
