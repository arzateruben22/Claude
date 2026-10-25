// Minimal .env.local / .env loader for scripts and the worker (Next loads them itself).
import fs from "node:fs";
import path from "node:path";
export function loadEnv(dir = path.resolve(new URL("..", import.meta.url).pathname)) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
}
