// The server's and the worker's copies of js/skin/core are up to date.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ROOT } from "../pg/harness.mjs";

test("generated copies of the shared logic match js/skin/core", () => {
  try { execFileSync(process.execPath, ["scripts/build-skin-core.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }); }
  catch (e) { assert.fail(String(e.stderr || e.stdout)); }
});
