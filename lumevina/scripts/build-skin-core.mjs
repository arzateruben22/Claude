#!/usr/bin/env node
// Lumevina — publish the shared Skin Intelligence logic to the server and the worker
//
//   node scripts/build-skin-core.mjs          write the copies
//   node scripts/build-skin-core.mjs --check  fail if any copy is out of date (the tests run this)
//
// js/skin/core/*.js is the one place the rules live (regions, measurements,
// wording, consent, change detection, validation, access, reports). The
// website loads it from there; this copies it, unchanged but for a header,
// to server/functions/_shared/skin/core/ for the edge functions (Supabase
// bundles only what sits under functions/), and writes the parts the Python
// worker needs to skin-intelligence/worker/lumevina_skin/catalog.json.
// Same idea as scripts/build-services.mjs → _shared/catalog.ts.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "js", "skin", "core");
const OUT = join(root, "server", "functions", "_shared", "skin", "core");
const WORKER = join(root, "skin-intelligence", "worker", "lumevina_skin", "catalog.json");
const check = process.argv.includes("--check");

const header = (f) => `// GENERATED from js/skin/core/${f} by scripts/build-skin-core.mjs. Edit the original, then run it.\n`;
const stale = [];

const write = (path, text) => {
  const same = existsSync(path) && readFileSync(path, "utf8") === text;
  if (same) return;
  if (check) { stale.push(path.replace(root + "/", "")); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log("wrote", path.replace(root + "/", ""));
};

const files = readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
for (const f of files) write(join(OUT, f), header(f) + readFileSync(join(SRC, f), "utf8"));
for (const f of existsSync(OUT) ? readdirSync(OUT) : []) if (!files.includes(f)) stale.push(`server/functions/_shared/skin/core/${f} (no longer in js/skin/core)`);

const regions = await import(pathToFileURL(join(SRC, "regions.js")));
const measurements = await import(pathToFileURL(join(SRC, "measurements.js")));
const catalog = {
  generated_by: "scripts/build-skin-core.mjs from js/skin/core",
  algorithm_family: measurements.ALGORITHM_FAMILY,
  regions: regions.REGIONS.map(({ id, label, kind }) => ({ id, label, kind })),
  landmarks: regions.LANDMARKS,
  keypoints: regions.KEYPOINTS,
  measurements: Object.fromEntries(Object.entries(measurements.MEASUREMENTS).map(([k, m]) =>
    [k, { unit: m.unit, better: m.better, needs_calibration: !!m.needsCalibration }])),
};
write(WORKER, JSON.stringify(catalog, null, 2) + "\n");

if (check && stale.length) {
  console.error("Out of date (run node scripts/build-skin-core.mjs):\n  " + stale.join("\n  "));
  process.exit(1);
}
