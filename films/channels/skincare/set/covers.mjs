// Covers for the new Skin Sense look (ivory/navy serif): out/skin-sense-00N-cover.jpg (1080x1920), -cover-480.jpg, -thumb.jpg (1280x720).
//   node films/channels/skincare/set/covers.mjs ep04:ep04-01.webp:"The message behind a frown" ...   (ep:hero picture:title)
// Built from the episode's hero picture; no risk words over skin. Written after the mp4 so the importer takes them (mtime newer).
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL, fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const HERE = path.dirname(fileURLToPath(import.meta.url)), SK = path.resolve(HERE, ".."), require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib", "node_modules/playwright"));
const font = (f) => pathToFileURL(path.join(SK, "fonts", f)).href;
const css = `@font-face{font-family:NR;src:url(${font("Newsreader-VF.ttf")});font-weight:200 800}@font-face{font-family:RH;src:url(${font("RedHatText-VF.ttf")});font-weight:300 700}
*{margin:0;box-sizing:border-box}body{background:#F8F2E7;color:#0E1B3D;font-family:RH,sans-serif}
.eb{font:600 30px RH;letter-spacing:.2em;text-transform:uppercase;color:#2F8F86}.t{font:600 112px/1.02 NR,serif;letter-spacing:-.01em}`;
const eb = (n) => +n >= 7 ? `Skin Sense · Season 2 · Episode ${+n - 6}` : `Skin Sense · No. ${n}`;
const cover = (img, n, title) => `<style>${css}body{width:1080px;height:1920px;position:relative;overflow:hidden}
.im{position:absolute;inset:0;background:url(${img}) center/cover}.v{position:absolute;inset:0;background:linear-gradient(#F8F2E7 0,#F8F2E7 17%,rgba(248,242,231,.0) 40%,rgba(248,242,231,0) 82%,#F8F2E7 100%)}
.h{position:absolute;left:80px;right:80px;top:150px}.f{position:absolute;left:80px;bottom:120px;font:600 34px RH;letter-spacing:.14em;color:#0E1B3D}.t{margin-top:26px}</style>
<div class=im></div><div class=v></div><div class=h><div class=eb>${eb(n)}</div><div class=t>${title}</div></div><div class=f>Narration: synthetic voice (AI)</div>`;
const thumb = (img, n, title) => `<style>${css}body{width:1280px;height:720px;position:relative;overflow:hidden}
.im{position:absolute;right:0;top:0;bottom:0;width:470px;background:url(${img}) center 38%/cover}.v{position:absolute;right:430px;top:0;bottom:0;width:120px;background:linear-gradient(90deg,#F8F2E7,rgba(248,242,231,0))}
.h{position:absolute;left:70px;top:150px;width:700px}.t{font-size:96px;margin-top:20px}.eb{font-size:28px}</style><div class=im></div><div class=v></div><div class=h><div class=eb>${eb(n)}</div><div class=t>${title}</div></div>`;
const tmp = path.join(SK, "set", ".cover.html"); const show = async (h) => { fs.writeFileSync(tmp, h); await pg.goto(pathToFileURL(tmp).href); };
const b = await chromium.launch(); const pg = await b.newPage();
for (const spec of process.argv.slice(2)) {
  const [ep, hero, ...tt] = spec.split(":"); const title = tt.join(":"), n = "0" + ep.replace("ep", "").replace(/^0/, ""), D = path.join(SK, ep), out = path.join(D, "out");
  const img = pathToFileURL(path.join(D, "art", hero)).href, name = `skin-sense-${n.padStart(3, "0")}`;
  await pg.setViewportSize({ width: 1080, height: 1920 }); await show(cover(img, n.padStart(3, "0"), title)); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(out, `${name}-cover.jpg`), type: "jpeg", quality: 92 });
  await pg.setViewportSize({ width: 1280, height: 720 }); await show(thumb(img, n.padStart(3, "0"), title)); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(out, `${name}-thumb.jpg`), type: "jpeg", quality: 92 });
  console.log(ep, "covers written");
}
await b.close(); fs.rmSync(tmp, { force: true });
