// Runs a batch of print and picture jobs in one Chromium.
//   node render.cjs jobs.json
// Job kinds:
//   {kind:"pdf",  html, pdf, fields}             print to PDF; write each fillable spot's box (page, x, y, w, h in pt)
//   {kind:"shot", html, out, selector, scale, width, height, type, quality}
//                                                one picture per element matching selector: out-1.jpg, out-2.jpg…
// Prints a JSON report: pages that run past their footer, and any page errors.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  const report = [];
  for (const job of jobs) {
    const scale = job.scale || 1;
    const page = await browser.newPage({
      viewport: { width: job.width || 816, height: job.height || 1056 },
      deviceScaleFactor: scale,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("file://" + path.resolve(job.html));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(job.wait || 150);
    if (job.kind === "pdf") {
      const info = await page.evaluate(() => {
        const px2pt = 0.75;
        const pages = [...document.querySelectorAll(".page")];
        const fields = [];
        const over = [];
        pages.forEach((pg, i) => {
          const r = pg.getBoundingClientRect();
          const foot = pg.querySelector(".foot");
          const limit = foot ? foot.getBoundingClientRect().top - 4 : r.bottom;
          let bottom = 0;
          pg.querySelectorAll("*").forEach((el) => {
            if (el.closest(".foot")) return;
            const b = el.getBoundingClientRect();
            if (b.height > 0 && b.bottom > bottom) bottom = b.bottom;
          });
          if (bottom > limit + 0.5) over.push({ page: i + 1, by: Math.round(bottom - limit) });
          pg.querySelectorAll("[data-f]").forEach((el) => {
            const b = el.getBoundingClientRect();
            fields.push({
              page: i, name: el.dataset.f, type: el.dataset.t,
              x: (b.left - r.left) * px2pt, y: (b.top - r.top) * px2pt,
              w: b.width * px2pt, h: b.height * px2pt,
            });
          });
        });
        return { fields, over, pages: pages.length, spare: pages.map((pg) => {
          const foot = pg.querySelector(".foot");
          const limit = foot ? foot.getBoundingClientRect().top : pg.getBoundingClientRect().bottom;
          let bottom = 0;
          pg.querySelectorAll("*").forEach((el) => {
            if (el.closest(".foot")) return;
            const b = el.getBoundingClientRect();
            if (b.height > 0 && b.bottom > bottom) bottom = b.bottom;
          });
          return Math.round(limit - bottom);
        }) };
      });
      await page.pdf({ path: job.pdf, preferCSSPageSize: true, printBackground: true });
      if (job.fields) fs.writeFileSync(job.fields, JSON.stringify(info.fields));
      report.push({ job: path.basename(job.pdf), pages: info.pages, over: info.over, spare: info.spare, errors });
    } else {
      const els = await page.$$(job.selector);
      let n = 0;
      for (const el of els) {
        n += 1;
        const out = els.length === 1 && job.single ? job.out : `${job.out}-${n}.${job.type === "png" ? "png" : "jpg"}`;
        const opts = { path: out, type: job.type === "png" ? "png" : "jpeg" };
        if (opts.type === "jpeg") opts.quality = job.quality || 88;
        await el.screenshot(opts);
      }
      report.push({ job: path.basename(job.out), shots: n, errors });
    }
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(report));
})().catch((e) => { console.error(e); process.exit(1); });
