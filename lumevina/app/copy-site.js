/* Copies the website (the folder above this one) into www/, which is
   what Capacitor packages into the iOS app. Run via `npm run build`
   (or `npm run sync`, which also runs `cap sync`). The site IS the
   app — no build step, no transformation, just a copy. */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..");
const OUT = path.join(__dirname, "www");

const INCLUDE = ["index.html", "privacy.html", "css", "js", "fonts"];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const entry of INCLUDE) {
  const from = path.join(SRC, entry);
  if (!fs.existsSync(from)) {
    console.warn("skipping missing:", entry);
    continue;
  }
  fs.cpSync(from, path.join(OUT, entry), { recursive: true });
}

console.log("Copied site into app/www — run `npx cap sync` to update iOS.");
