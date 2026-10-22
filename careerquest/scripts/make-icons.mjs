// Renders public/icons/icon.svg to the PNG sizes used by the PWA manifest and iOS. Usage: node scripts/make-icons.mjs .
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const root = process.argv[2];
const svg = readFileSync(`${root}/public/icons/icon.svg`, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const jobs = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12 },
];
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const inner = Math.round(j.size * (1 - 2 * j.pad));
  await page.setContent(`<html><body style="margin:0;background:#0b0e14;display:flex;align-items:center;justify-content:center;width:${j.size}px;height:${j.size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('width="512" height="512"', `width="${inner}" height="${inner}"`)}</div></body></html>`);
  await page.screenshot({ path: `${root}/public/icons/${j.file}`, omitBackground: false });
}
await browser.close();
console.log("done");
