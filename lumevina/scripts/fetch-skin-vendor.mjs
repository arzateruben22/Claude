#!/usr/bin/env node
// Lumevina — download MediaPipe's WebAssembly runtime and face model next to
// the vendored bundle, so the capture screens load nothing from third parties.
//
//   node scripts/fetch-skin-vendor.mjs
//
// Then set, in js/site-config.js:  skin: { mediapipeWasm: "vendor/mediapipe", faceModel: "vendor/mediapipe/face_landmarker.task" }
// Each file's SHA-256 is checked; a changed file is refused.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "mediapipe");
const FILES = [
  { url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm/vision_wasm_internal.js", name: "vision_wasm_internal.js", sha256: "6522286aa32dd93eff17c3da002b0649516f87abfec7a80b5bfe5c9625caa5f8" },
  { url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm/vision_wasm_internal.wasm", name: "vision_wasm_internal.wasm", sha256: "0e101a010e262ef8e78f22e3c95b60a9705fd06962753c9acd6356d9fb56b7bd" },
  { url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task", name: "face_landmarker.task", sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff" },
];

for (const f of FILES) {
  const r = await fetch(f.url);
  if (!r.ok) throw new Error(`${f.url}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== f.sha256) throw new Error(`${f.name}: SHA-256 ${got}, expected ${f.sha256}. Not saved.`);
  writeFileSync(join(dir, f.name), buf);
  console.log(`saved ${f.name} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
