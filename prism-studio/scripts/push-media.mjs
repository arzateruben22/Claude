// Push the finished films to a hosted studio that has no films checkout (docs/LAUNCH-CHECKLIST.md), from any machine
// with the films repo (a cloud session, a laptop): the files the importer reads per episode and the lesson
// compilations, only those new or changed since the last push, with their modified times; then it queues the import.
// Videos the studio cleared after posting (its GET lists those episode folders) are skipped.
//   STUDIO_URL=https://prism-studio-production.up.railway.app MEDIA_PUSH_TOKEN=… node scripts/push-media.mjs [--dry-run] [--no-import] [channel…]
// Transfers go through curl (it honours HTTPS_PROXY and the system CA bundle, which Node's fetch doesn't).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), flag = (f) => args.includes(f), only = args.filter((a) => !a.startsWith("--"));
const BASE = (process.env.STUDIO_URL || "").replace(/\/+$/, ""), TOKEN = process.env.MEDIA_PUSH_TOKEN || "";
if (!/^https?:\/\//.test(BASE) || TOKEN.length < 32) {
  console.error("Set STUDIO_URL (https://…) and MEDIA_PUSH_TOKEN (the same value as the host's variable)."); process.exit(2);
}
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENDPOINT = `${BASE}/api/media-push`;
// the same allow-list as the server (src/domain/media-push.ts); the server checks again
const ALLOWED = /^films\/channels\/[a-z0-9-]+\/(?:ep\d{2}\/(?:script\.md|claims\.json|film\.json|build\/qa-delivery\.json|out\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:mp4|jpg|jpeg|png|srt|vtt|json|md|txt))|compilations\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:mp4|jpg|jpeg|png|srt|vtt|json|md|txt))$/;

const DIRS = /^films\/channels\/[a-z0-9-]+\/(?:ep\d{2}(?:\/(?:out|build))?|compilations(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?)$/;

const curl = (extra) => execFileSync("curl", ["-sS", "--fail-with-body", "--retry", "3", "--retry-all-errors", "-H", `Authorization: Bearer ${TOKEN}`, ...extra], { maxBuffer: 64 * 1024 * 1024 }).toString();

function local() {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const r = `${rel}/${e.name}`, abs = path.join(dir, e.name);
      // only the folders the allow-list can match (never a render's build/frames)
      if (e.isDirectory()) { if (DIRS.test(r)) walk(abs, r); }
      else if (e.isFile() && ALLOWED.test(r)) { const s = fs.statSync(abs); out.push({ rel: r, abs, size: s.size, mtime: Math.round(s.mtimeMs) }); }
    }
  };
  const root = path.join(REPO, "films", "channels");
  for (const ch of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ch.isDirectory() || (only.length && !only.includes(ch.name))) continue;
    walk(path.join(root, ch.name), `films/channels/${ch.name}`);
  }
  return out;
}

const answer = JSON.parse(curl([ENDPOINT])), remote = answer.files ?? {};
// episodes posted everywhere have their videos erased from the studio (originals stay here, in GitHub): never send them
// again (the same rule as isClearedVideo in src/domain/media-cleanup.ts)
const cleared = answer.cleared ?? [], isCleared = (rel) => rel.endsWith(".mp4") && cleared.some((d) => rel.startsWith(`${d}/`));
const changed = local().filter((f) => { const r = remote[f.rel]; return !r || r[0] !== f.size || Math.abs(r[1] - f.mtime) > 1000; });
const todo = changed.filter((f) => !isCleared(f.rel)), skipped = changed.length - todo.length;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`${todo.length} file(s) to send, ${mb(todo.reduce((a, f) => a + f.size, 0))}${skipped ? `; ${skipped} cleared video(s) skipped` : ""}${flag("--dry-run") ? " (dry run)" : ""}`);
for (const f of todo) {
  if (flag("--dry-run")) { console.log("  would send", f.rel, mb(f.size)); continue; }
  const r = spawnSync("curl", ["-sS", "--fail-with-body", "--retry", "3", "--retry-all-errors", "-X", "PUT", "-T", f.abs,
    "-H", `Authorization: Bearer ${TOKEN}`, "-H", `x-mtime: ${f.mtime}`, "-H", "Content-Type: application/octet-stream",
    `${ENDPOINT}?path=${encodeURIComponent(f.rel)}`], { encoding: "utf8" });
  if (r.status !== 0) { console.error(`  failed ${f.rel}: ${(r.stdout || r.stderr).trim()}`); process.exit(1); }
  console.log("  sent", f.rel, mb(f.size));
}
if (!flag("--dry-run") && !flag("--no-import")) console.log("import:", curl(["-X", "POST", ENDPOINT]).trim());
