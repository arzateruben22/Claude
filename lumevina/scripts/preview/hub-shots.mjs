// The hub's card pictures, captured from the pages the hub opens, so every card shows the page as it is now.
//   PLAYWRIGHT_DIR=<dir with playwright> CHROMIUM=<browser> node scripts/preview/hub-shots.mjs <built hub dir>
// Writes docs/hub/img/*.jpg (build-hub.sh copies them beside the hub).
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hub = path.resolve(process.argv[2] || "");
const out = path.join(root, "docs/hub/img");
const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--allow-file-access-from-files"] });

// phones at 390 wide, 2x; desktop pages at 1280 x 800, saved at 800 x 500
const PHONE = { viewport: { width: 390, height: 824 }, deviceScaleFactor: 2 };
const DESK = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.625 };
// [picture, page, size, the heading to start at, how long the page animates first]
const shots = [
  ["home", "site.html", PHONE],
  ["app", "app.html", PHONE],
  ["school", "file://" + path.join(root, "school.html") + "#learn-8-2", PHONE],
  ["dash-phone", "dashboard.html#checkout", PHONE],   // the client list, ready to check someone out
  ["blueprint", "blueprint.html", DESK, null, 5000],
  ["plan", "plan.html", DESK],
  ["shipping", "shipping.html", DESK],
  ["playbook", "file://" + path.join(root, "knowledge/playbook/evelyn-playbook.html"), DESK]
];
const quiet = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}" +
  "html.lv-enter body{opacity:1!important}.reveal{opacity:1!important;transform:none!important}";
for (const [name, page, opt, at, wait] of shots) {
  const p = await browser.newPage(opt);
  const url = page.startsWith("file://") ? page : "file://" + path.join(hub, page);
  await p.goto(url, { waitUntil: "load" });
  await p.addStyleTag({ content: quiet }).catch(() => {});
  if (at) await p.evaluate((t) => { const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim().startsWith(t));
    if (h) { (h.closest("section, .card, .panel") || h).scrollIntoView({ block: "start" }); window.scrollBy(0, -24); } }, at);
  await p.waitForTimeout(wait || 1500);
  await p.screenshot({ path: path.join(out, name + ".jpg"), type: "jpeg", quality: 82 });
  await p.close();
  console.log(name, fs.statSync(path.join(out, name + ".jpg")).size);
}

// the library: three of the vertical clips' first frames, side by side (the three re-cut in the block look)
const posters = ["8-2", "11-1", "10-1"].map((id) => path.join(root, "marketing/ads/out/video", id + "-9x16.jpg")).filter((f) => fs.existsSync(f));
const tmp = path.join(hub, ".library-shot.html"), lib = await browser.newPage(DESK);
fs.writeFileSync(tmp, '<body style="margin:0;height:800px;display:flex;gap:28px;justify-content:center;align-items:center;background:#EDE5DA">' +
  posters.map((f, i) => '<img src="file://' + f + '" style="height:' + (i === 1 ? 700 : 620) + 'px;border-radius:26px;box-shadow:0 30px 60px rgba(74,52,42,.25)">').join("") + "</body>");
await lib.goto("file://" + tmp, { waitUntil: "load" });
await lib.waitForTimeout(800);
fs.unlinkSync(tmp);
await lib.screenshot({ path: path.join(out, "library.jpg"), type: "jpeg", quality: 82 });
console.log("library", fs.statSync(path.join(out, "library.jpg")).size);
await browser.close();
