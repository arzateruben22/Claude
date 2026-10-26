// npm start: run the production build the way the Docker image does, with Next's standalone server
// (.next/standalone/server.js). `next start` doesn't support `output: "standalone"`, and Next says so on every start.
//   npx next build && npm start                      # http://localhost:3100
//   npm start -- -p 3107 -H 127.0.0.1                # another port, or one interface only
// Like the Dockerfile, it first puts .next/static and public next to server.js (a fresh copy each start, so a rebuild
// never serves the previous build's files). The server changes into .next/standalone, so the env files are read here,
// from the project (.env.local, then .env, never over what's already set), and the media paths in them are made absolute.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, ".next", "standalone");
const server = path.join(dir, "server.js");
if (!fs.existsSync(server)) {
  console.error("There is no production build in .next/standalone: run `npx next build` first.");
  process.exit(1);
}

for (const [from, to] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"]]) {
  fs.rmSync(path.join(root, to), { recursive: true, force: true });
  fs.cpSync(path.join(root, from), path.join(root, to), { recursive: true });
}

// the same rules as scripts/env.ts (the worker's and the scripts' loader)
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
// src/lib/media.ts resolves these against the working directory: keep them pointing where they do from the project
process.env.FILMS_REPO_ROOT = path.resolve(root, process.env.FILMS_REPO_ROOT || "..");
process.env.MEDIA_ROOT = path.resolve(root, process.env.MEDIA_ROOT || "./data/media");

const arg = (...names) => {
  const i = process.argv.findIndex((a) => names.includes(a));
  return i >= 0 ? process.argv[i + 1] : undefined;
};
process.env.PORT = arg("-p", "--port") ?? process.env.PORT ?? "3100";
// every interface, like `next start` (a shell's or Docker's HOSTNAME is the machine's name, not an address to bind)
process.env.HOSTNAME = arg("-H", "--hostname") ?? "0.0.0.0";
process.env.NODE_ENV = "production";

await import(pathToFileURL(server).href);
