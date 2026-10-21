// The ad creatives: six concepts, each as a square (1080×1080, feed) and a
// story (1080×1920, Stories and Reels covers), in the site's own palette,
// type and product photos. Nothing in them that she or a label hasn't said.
//
//   node marketing/ads/build-ads.mjs        (from lumevina/; needs playwright)
//   → marketing/ads/out/<concept>-<size>.jpg
//
// Change the words below, run it again, upload the JPEGs to Meta Ads Manager
// or Google's asset library. The copy that goes beside them is in
// marketing/campaigns.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, "out"), tmp = path.join(here, ".tmp");
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const photo = (id) => { const p = CAT.products.find((x) => x.id === id); return p?.photo ? path.join(root, p.photo) : null; };

// ── the concepts ──
const CONCEPTS = [
  { id: "pickup", eyebrow: "Woodland Hills", h: "Pick it up at your facial.", sub: "Evelyn's professional shelf is online. Free pickup at the studio; $8 shipping anywhere, free over $75.",
    products: ["fr-ultra-gentle-cleanser", "fr-8pct-mandelic-serum", "fr-brilliant-defense-50"], cta: "Shop on the website" },
  { id: "shelf", eyebrow: "The shelf", h: "The skincare from her treatment room, for home.", sub: "Face Reality · GlyMed Plus · Mixi Skincare · Circadia. Every product is one Evelyn stocks for her clients.",
    products: ["fr-barrier-cream-cleanser", "fr-hydraremedy-gel-serum", "fr-cran-peptide-cream", "fr-powdermineral-spf-50"], cta: "Shop on the website" },
  { id: "first-facial", eyebrow: "New clients start here", h: "New here? Start with a facial.", sub: "A consultation, a look at what you use now, and a fully customized facial. 60 minutes, $220, one on one with Evelyn.",
    products: [], hero: "img/services/custom.webp", cta: "Book on the website" },
  { id: "acne", eyebrow: "Acne Bootcamp", h: "Breakouts? Start a plan, not a product.", sub: "A consultation and treatment, a home routine Evelyn adjusts with you, and a visit every few weeks. She tells everyone: give it 90 days.",
    products: [], hero: "img/services/acne.webp", cta: "Book the consultation" },
  { id: "gift", eyebrow: "The gift of glow", h: "A facial they'll actually use.", sub: "A gift certificate for any treatment or amount, emailed today or on the day you choose. No expiry.",
    products: [], hero: "img/services/ageless.webp", cta: "Send a gift certificate", tone: "sand" },
  { id: "wax", eyebrow: "Wax Wednesday", h: "Brazilian, $65 on Wednesdays.", sub: "Hard wax, one on one, 40 minutes. Woodland Hills, free parking, a card holds your time.",
    products: [], hero: "img/services/brazilian.webp", cta: "Book on the website" },
];

const fontFace = (fam, file, weight, style = "normal") =>
  `@font-face { font-family: "${fam}"; src: url("file://${path.join(root, "fonts", file)}") format("woff2"); font-weight: ${weight}; font-style: ${style}; }`;
const css = (w, h, story) => `
  ${fontFace("Cormorant", "cormorant-garamond-latin-500-normal.woff2", 500)}
  ${fontFace("Cormorant", "cormorant-garamond-latin-500-italic.woff2", 500, "italic")}
  ${fontFace("Jost", "jost-latin-300-normal.woff2", 300)}
  ${fontFace("Jost", "jost-latin-400-normal.woff2", 400)}
  ${fontFace("Jost", "jost-latin-500-normal.woff2", 500)}
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body { background: #F5F1EA; color: #161412; font-family: "Jost", sans-serif; }
  body.sand { background: #E6DCCF; }
  .ad { position: relative; width: ${w}px; height: ${h}px; padding: ${story ? "150px 96px 170px" : "88px 88px 84px"}; display: flex; flex-direction: column; }
  .eyebrow { font-size: ${story ? 34 : 28}px; font-weight: 500; letter-spacing: 0.28em; text-transform: uppercase; color: #7D5A44; }
  h1 { font-family: "Cormorant", serif; font-weight: 500; font-size: ${story ? 118 : 92}px; line-height: 1.02; letter-spacing: -0.02em; margin-top: ${story ? 34 : 26}px; max-width: ${story ? 880 : 900}px; text-wrap: balance; }
  h1 em { font-style: italic; color: #4A342A; }
  .sub { font-size: ${story ? 38 : 32}px; font-weight: 300; line-height: 1.4; color: #4A342A; margin-top: ${story ? 36 : 28}px; max-width: ${story ? 860 : 820}px; }
  .shelf { display: flex; gap: ${story ? 28 : 22}px; margin: auto 0; align-items: flex-end; justify-content: center; }
  .shelf img { height: ${story ? 520 : 300}px; width: auto; max-width: ${story ? 290 : 230}px; object-fit: cover; border-radius: ${story ? 28 : 22}px; box-shadow: 0 20px 40px rgba(74,52,42,0.14); }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: ${story ? 0 : 48}px; }
  .cta { display: inline-block; white-space: nowrap; background: #161412; color: #fff; font-size: ${story ? 34 : 30}px; font-weight: 500; padding: ${story ? "24px 44px" : "22px 40px"}; border-radius: 999px; }
  .brand { font-family: "Cormorant", serif; font-size: ${story ? 40 : 34}px; letter-spacing: 0.04em; color: #161412; }
  .brand small { display: block; font-family: "Jost", sans-serif; font-size: ${story ? 20 : 18}px; letter-spacing: 0.16em; text-transform: uppercase; color: #7D5A44; margin-top: 6px; white-space: nowrap; }
  .foot { gap: 24px; }
  .mark { position: absolute; top: ${story ? 70 : 44}px; right: ${story ? 96 : 88}px; width: ${story ? 130 : 110}px; height: ${story ? 130 : 110}px; border-radius: 50%; border: 2px solid #B2967D; display: grid; place-items: center; font-family: "Cormorant", serif; font-size: ${story ? 64 : 54}px; color: #4A342A; }
  .hero { margin: auto 0; height: ${story ? 720 : 380}px; border-radius: 32px; background-size: cover; background-position: center; box-shadow: 0 24px 48px rgba(74,52,42,0.18); }
`;
const html = (c, w, h, story) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(w, h, story)}</style></head>
<body class="${c.tone || ""}"><div class="ad">
  <div class="mark" aria-hidden="true">L</div>
  <p class="eyebrow">${c.eyebrow}</p>
  <h1>${c.h.replace(/\b(facial|home|plan|use|Wednesdays)\b(?=[.,]?)/, "<em>$1</em>")}</h1>
  <p class="sub">${c.sub}</p>
  ${c.products.length ? `<div class="shelf">${c.products.map((id) => photo(id)).filter(Boolean).map((f) => `<img src="file://${f}" alt="">`).join("")}</div>` : ""}
  ${c.hero ? `<div class="hero" style="background-image:url('file://${path.join(root, c.hero)}')"></div>` : ""}
  <div class="foot"><span class="brand">Lumevina Aesthetics Spa<small>Evelyn Romero · Woodland Hills</small></span><span class="cta">${c.cta} →</span></div>
</div></body></html>`;

// playwright from this project, or from the folder PLAYWRIGHT_DIR names (any folder with it in node_modules)
import { createRequire } from "node:module";
const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let made = 0;
for (const c of CONCEPTS) {
  for (const [size, w, h] of [["square", 1080, 1080], ["story", 1080, 1920]]) {
    const file = path.join(tmp, `${c.id}-${size}.html`);
    fs.writeFileSync(file, html(c, w, h, size === "story"));
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto("file://" + file);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${c.id}-${size}.jpg`), type: "jpeg", quality: 92 });
    await page.close();
    made++;
  }
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ads: ${made} creatives in marketing/ads/out/`);
