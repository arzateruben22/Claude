/**
 * Renders the creations gallery to data/preview/creations.html and screenshots
 * it (plus one close-up sheet per creation and a reveal frame strip) with
 * Playwright.
 *
 *   cd prism-studio && npx tsx scripts/preview-creations.tsx [--only=rift_dragon] [--out=dir] [--no-shots]
 */
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Creation, CREATIONS, EvolutionReveal, type CreationKey, type CreationProps, type Form } from "../src/creations/index";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "1"];
  }),
);
const OUT = path.resolve(args.out ?? path.join(process.cwd(), "data/preview"));
const KEYS = (Object.keys(CREATIONS) as CreationKey[]).filter((k) => !args.only || args.only.split(",").includes(k));
mkdirSync(OUT, { recursive: true });

type Cell = Omit<CreationProps, "creation"> & { note: string };
const IVORY = "#F6F1E7";
const DARK = "#141210";

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:28px;background:#DCD6CB;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2A2622}
  h1{font:600 22px/1.2 Georgia,serif;margin:0 0 18px}
  h2{font:600 17px/1.2 Georgia,serif;margin:26px 0 10px}
  h2 span{font:500 12px system-ui,sans-serif;opacity:.6;margin-left:10px}
  .row{display:flex;gap:12px;flex-wrap:nowrap;margin-bottom:12px}
  .card{border-radius:18px;padding:10px 10px 8px;display:flex;flex-direction:column;align-items:center}
  .card.ivory{background:${IVORY};color:#4A4038}
  .card.dark{background:${DARK};color:#CFC6BA}
  .card svg{display:block}
  .card p{margin:4px 0 0;font-size:11px;letter-spacing:.02em;text-align:center;width:0;min-width:100%}
  .rev{display:flex;gap:12px}
  .rev .card{width:auto}
</style></head><body>${body}</body></html>`;

/** each page is rendered as ONE React tree so useId stays unique across cards */
function Card({ k, c, bg, size }: { k: CreationKey; c: Cell; bg: "ivory" | "dark"; size: number }) {
  const { note, ...props } = c;
  return (
    <div className={`card ${bg}`}>
      <Creation creation={k} size={size} {...props} />
      <p>{note}</p>
    </div>
  );
}

const formName = (key: CreationKey, form: Form) => CREATIONS[key].forms[form - 1];
const F: Form[] = [1, 2, 3, 4, 5];

/* ---------------- main gallery ---------------- */
const gallery = renderToStaticMarkup(
  <>
    <h1>Prism Studio · creations</h1>
    {KEYS.map((key) => {
      const m = CREATIONS[key];
      const rowA: Cell[] = F.map((form) => ({ form, branch: "a", note: `${form} · ${formName(key, form)}` }));
      const rowB: Cell[] = [
        { form: 3, branch: "b", note: `3b · ${m.branches.b.name}` },
        { form: 4, branch: "b", note: "4b" },
        { form: 5, branch: "b", note: "5b" },
        { form: 5, branch: "a", ascended: true, note: "5a · ascended" },
        { form: 3, branch: "a", locked: true, note: "3 · locked" },
        { form: 3, branch: "a", activity: "rendering", note: "3 · rendering" },
      ];
      return (
        <section key={key}>
          <h2>
            {m.name}
            <span>
              {m.topic} · a = {m.branches.a.name} · b = {m.branches.b.name}
            </span>
          </h2>
          <div className="row">
            {rowA.map((c, i) => (
              <Card key={i} k={key} c={c} bg="ivory" size={200} />
            ))}
          </div>
          <div className="row">
            {rowB.map((c, i) => (
              <Card key={i} k={key} c={c} bg="dark" size={200} />
            ))}
          </div>
        </section>
      );
    })}
  </>,
);
writeFileSync(path.join(OUT, "creations.html"), page("Creations gallery", gallery));

/* ---------------- close-up sheets ---------------- */
for (const key of KEYS) {
  const m = CREATIONS[key];
  const rows: [Cell[], "ivory" | "dark"][] = [
    [F.map((form) => ({ form, branch: "a", note: `${form}a · ${formName(key, form)}` })), "ivory"],
    [F.map((form) => ({ form, branch: "a", note: `${form}a` })), "dark"],
    [
      [
        { form: 3, branch: "b", note: "3b" },
        { form: 4, branch: "b", note: "4b" },
        { form: 5, branch: "b", note: "5b" },
        { form: 5, branch: "a", ascended: true, note: "5a ascended" },
        { form: 5, branch: "b", ascended: true, note: "5b ascended" },
      ],
      "ivory",
    ],
    [
      [
        { form: 3, branch: "b", note: "3b" },
        { form: 4, branch: "b", note: "4b" },
        { form: 5, branch: "b", note: "5b" },
        { form: 4, branch: "a", locked: true, note: "4 locked" },
        { form: 2, branch: null, ascended: true, activity: "researching", note: "2 ascended · researching" },
      ],
      "dark",
    ],
  ];
  const body = renderToStaticMarkup(
    <>
      <h1>{m.name}</h1>
      {rows.map(([cells, bg], r) => (
        <div className="row" key={r}>
          {cells.map((c, i) => (
            <Card key={i} k={key} c={c} bg={bg} size={300} />
          ))}
        </div>
      ))}
    </>,
  );
  writeFileSync(path.join(OUT, `creation-${key}.html`), page(m.name, body));
}

/* ---------------- reveal strip (phases driven by class changes) ---------------- */
const revealKey = KEYS[0];
const reveal = renderToStaticMarkup(
  <div className="rev">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className={`card ${i % 2 ? "dark" : "ivory"}`} data-i={i}>
        <EvolutionReveal creation={revealKey} from={2} to={3} branch="a" size={260} />
      </div>
    ))}
  </div>,
);
writeFileSync(path.join(OUT, "reveal.html"), page("Reveal", reveal));

/* ---------------- screenshots ---------------- */
async function shots() {
  const req = createRequire(import.meta.url);
  const globalRoot = execSync("npm root -g").toString().trim();
  type Page = {
    goto(u: string): Promise<unknown>;
    waitForTimeout(ms: number): Promise<void>;
    screenshot(o: { path: string; fullPage?: boolean }): Promise<unknown>;
    evaluate(fn: () => void): Promise<void>;
  };
  type Browser = { newPage(o: { viewport: { width: number; height: number } }): Promise<Page>; close(): Promise<void> };
  const { chromium } = req(path.join(globalRoot, "playwright")) as { chromium: { launch(o?: { executablePath?: string }): Promise<Browser> } };
  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
  const pg = await browser.newPage({ viewport: { width: 1720, height: 900 } });
  const snap = async (html: string, png: string) => {
    await pg.goto(`file://${path.join(OUT, html)}`);
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: path.join(OUT, png), fullPage: true });
    console.log("wrote", path.join(OUT, png));
  };
  if (!args.only) await snap("creations.html", "creations.png");
  for (const key of KEYS) await snap(`creation-${key}.html`, `creation-${key}.png`);
  // reveal: freeze each card at a different phase
  await pg.goto(`file://${path.join(OUT, "reveal.html")}`);
  await pg.evaluate(() => {
    const phases = ["charge", "burst", "reveal", "done"];
    document.querySelectorAll<HTMLElement>(".rev .card").forEach((card, i) => {
      const root = card.firstElementChild as HTMLElement;
      root.classList.remove("charge");
      root.classList.add(phases[i]);
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const anims = el.getAnimations();
        anims.forEach((a) => {
          a.pause();
          a.currentTime = i === 0 ? 1100 : i === 1 ? 160 : 700;
        });
      });
    });
  });
  await pg.waitForTimeout(100);
  await pg.screenshot({ path: path.join(OUT, "reveal.png"), fullPage: true });
  console.log("wrote", path.join(OUT, "reveal.png"));
  await browser.close();
}

if (!args["no-shots"]) {
  shots().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
