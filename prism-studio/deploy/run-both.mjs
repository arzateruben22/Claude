// One container, two processes: the web app (Next's standalone server) and the worker, for hosts where a disk can be
// attached to one service only (Railway; docs/LAUNCH-CHECKLIST.md). Both read the same media and films folders.
// If either stops, the other is stopped too and the container exits, so the host restarts the pair. SIGTERM goes to
// both (the worker finishes its current job first).
import { spawn } from "node:child_process";

const kids = [
  spawn("node", ["server.js"], { stdio: "inherit", env: { ...process.env, HOSTNAME: "0.0.0.0" } }),
  spawn("tsx", ["worker/index.ts"], { stdio: "inherit" }),
];
let exiting = false;
const stopAll = (sig) => { for (const k of kids) if (k.exitCode === null && k.signalCode === null) k.kill(sig); };
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { exiting = true; stopAll(sig); });
for (const k of kids) k.on("exit", (code, signal) => {
  if (!exiting) console.error(`[run-both] ${k.spawnargs.join(" ")} exited (${signal ?? code}); stopping the other`);
  exiting = true;
  stopAll("SIGTERM");
  if (kids.every((x) => x.exitCode !== null || x.signalCode !== null)) process.exit(code ?? 1);
});
