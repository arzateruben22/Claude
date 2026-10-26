// npm run preview: real screenshots of the studio for docs/preview-gallery/. It starts the production server on a free
// port against the dev database (DATABASE_URL from .env.local), signs in with data/DEV-PASSWORD.txt, takes the wall
// (desktop and phone), the Instagram screen, one channel screen, Costs and Settings → Notifications as JPEGs, rewrites
// the figures and the date in docs/preview-gallery/index.html, and stops the server by its process group.
//   npm run preview [-- --build | --no-build] [--channel=<slug>]
// It builds first (niced) when there is no production build or the sources are newer than it; --build always builds,
// --no-build never does. Signing in adds an auth.sign_in row to the dev audit log, as any sign-in does.
// The captions and alt text are written here (SHOTS and figuresHtml); edit them here, not in index.html.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync, execSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";
import { RIG, RIG_ORDER, INSTAGRAM_SLUG } from "../src/lib/rig";
import { loadEnv } from "./env";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
loadEnv(ROOT);
const OUT = path.join(ROOT, "docs", "preview-gallery");
const INDEX = path.join(OUT, "index.html");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const opt = (name: string) => flag(name)?.split("=")[1];

// ── minimal Playwright types (the package is installed globally, like scripts/preview-creations.tsx uses it) ─────────
type Viewport = { width: number; height: number };
type Page = {
  goto(url: string, o?: { waitUntil?: string; timeout?: number }): Promise<{ status(): number } | null>;
  url(): string;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(test: (u: URL) => boolean, o?: { timeout?: number }): Promise<void>;
  waitForLoadState(state: string, o?: { timeout?: number }): Promise<void>;
  waitForFunction(fn: string, arg?: unknown, o?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  textContent(selector: string): Promise<string | null>;
  screenshot(o: { path: string; type: "jpeg"; quality: number }): Promise<unknown>;
  on(event: "pageerror", fn: (e: Error) => void): void;
  on(event: "response", fn: (r: { status(): number; url(): string }) => void): void;
  close(): Promise<void>;
};
type Context = { newPage(): Promise<Page>; storageState(): Promise<unknown>; close(): Promise<void> };
type ContextOptions = { viewport: Viewport; deviceScaleFactor: number; isMobile?: boolean; hasTouch?: boolean; colorScheme?: string; reducedMotion?: string;
  permissions?: string[]; userAgent?: string; storageState?: unknown };
type Browser = { newContext(o: ContextOptions): Promise<Context>; close(): Promise<void> };
type Chromium = { launch(o?: { executablePath?: string; channel?: string }): Promise<Browser> };

function chromium(): Chromium {
  const req = createRequire(import.meta.url);
  try { return (req("playwright") as { chromium: Chromium }).chromium; } catch { /* not a dependency: use the global one */ }
  const globalRoot = execSync("npm root -g").toString().trim();
  try { return (req(path.join(globalRoot, "playwright")) as { chromium: Chromium }).chromium; } catch {
    throw new Error("Playwright isn't installed. Run: npm install -g playwright && npx playwright install chromium");
  }
}

// ── the shots ────────────────────────────────────────────────────────────────────────────────────────────────────────
// desktop: 1440 px wide; "wide" shots are drawn at 5/6 scale, so they come out 1200 px wide (the gallery's crop).
// phone: 390 × 844 at 2× (780 × 1688), the first screen as a phone shows it.
type Device = "desktop" | "wide" | "phone";
type Shot = { file: string; url: string; device: Device; height: number; scrollTo?: string };
const WIDE = 1200 / 1440;
// a phone browser, so the screens that name the device (Settings → Notifications) say so
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

function shotsFor(channel: string): Shot[] {
  return [
    { file: "wall-desktop.jpg", url: "/", device: "desktop", height: 900 },
    { file: "wall-phone.jpg", url: "/", device: "phone", height: 844 },
    { file: "instagram.jpg", url: `/m/${INSTAGRAM_SLUG}`, device: "wide", height: 1560 },
    { file: "channel.jpg", url: `/m/${channel}`, device: "wide", height: 1320 },
    { file: "settings-phone.jpg", url: "/settings", device: "phone", height: 844, scrollTo: "#notifications" },
    { file: "costs.jpg", url: "/costs", device: "wide", height: 1320 },
  ];
}

// ── the server ───────────────────────────────────────────────────────────────────────────────────────────────────────
function newestMtime(p: string): number {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  let m = 0;
  for (const e of fs.readdirSync(p)) if (e !== "node_modules" && !e.startsWith(".")) m = Math.max(m, newestMtime(path.join(p, e)));
  return m;
}

function ensureBuild() {
  const id = path.join(ROOT, ".next", "BUILD_ID");
  const built = fs.existsSync(id) ? fs.statSync(id).mtimeMs : 0;
  const sources = Math.max(...["src", "public", "next.config.ts", "package.json", "package-lock.json"].map((p) => newestMtime(path.join(ROOT, p))));
  const why = flag("build") ? "--build" : !built ? "no production build yet" : sources > built ? "the sources are newer than the build" : "";
  if (!why || flag("no-build")) {
    if (!built) throw new Error("There is no production build; run without --no-build (or npx next build first).");
    return;
  }
  console.log(`Building (${why})…`);
  const niced = process.platform !== "win32";
  const r = spawnSync(niced ? "nice" : process.execPath, niced ? ["-n", "10", process.execPath, NEXT_BIN, "build"] : [NEXT_BIN, "build"], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error("next build failed");
}

const freePort = () => new Promise<number>((resolve, reject) => {
  const s = net.createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address() as net.AddressInfo;
    s.close(() => resolve(port));
  });
});

let server: ChildProcess | null = null;
const serverLog: string[] = [];

async function startServer(port: number) {
  // its own process group (detached), so stopping it takes next start's children too
  server = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
  });
  for (const s of [server.stdout, server.stderr]) s?.on("data", (b: Buffer) => serverLog.push(...b.toString().split("\n").filter(Boolean)));
  const base = `http://127.0.0.1:${port}`;
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`The server stopped (exit ${server.exitCode}):\n${serverLog.slice(-20).join("\n")}`);
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return base;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`The server didn't answer /api/health within 60 s:\n${serverLog.slice(-20).join("\n")}`);
}

async function stopServer() {
  const s = server;
  server = null;
  if (!s?.pid || s.exitCode !== null) return;
  const gone = new Promise<void>((resolve) => s.once("exit", () => resolve()));
  const kill = (sig: NodeJS.Signals) => { try { process.kill(-s.pid!, sig); } catch { /* already gone */ } };
  kill("SIGTERM");
  const timer = setTimeout(() => kill("SIGKILL"), 8_000);
  await gone;
  clearTimeout(timer);
  kill("SIGKILL");   // anything left in the group
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { void stopServer().finally(() => process.exit(130)); });

// ── the figures in index.html ────────────────────────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Width and height from a JPEG's frame header. */
function jpegSize(file: string): { w: number; h: number } {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${file}: no JPEG frame header`);
}

type Names = Record<string, string>;
function figuresHtml(names: Names, channel: { slug: string; name: string }) {
  const img = (file: string, alt: string) => { const { w, h } = jpegSize(path.join(OUT, file)); return `<img class="shot" src="${file}" width="${w}" height="${h}" alt="${esc(alt)}">`; };
  const n = (slug: string) => names[slug] ?? slug;
  const left = [RIG.outerLeft, RIG.innerLeft].map(n).join(" and "), right = [RIG.innerRight, RIG.outerRight].map(n).join(" and ");
  return `
  <figure>
    ${img("wall-desktop.jpg", `The home screen: six monitors over a dark New York skyline at night. Instagram is the large screen in the middle with today's posts; ${n(RIG.top)} sits above it; ${left} are on the left; ${right} are on the right.`)}
    <figcaption>
      <p><b>The wall.</b> Instagram in the middle: two posts a day from any series, and no episode goes up twice. ${esc(n(RIG.top))} sits above it. ${esc(left)} are on the left, ${esc(right)} on the right. A screen stays dark until its channel has a finished episode.</p>
      <p>The skyline is original code-rendered art (Manhattan at 2 a.m.), not a photo.</p>
    </figcaption>
  </figure>

  <section class="pair" aria-label="Phone and Instagram screen">
    <figure>
      ${img("wall-phone.jpg", "The same wall on a phone: Instagram first, then the channels with episodes, with a tab bar at the bottom.")}
      <figcaption><p><b>On a phone,</b> Instagram comes first, then the channels with episodes.</p></figcaption>
    </figure>
    <figure>
      ${img("instagram.jpg", "The Instagram screen: today's slots, each with a cover, the caption, hashtags and a first comment with the sources.")}
      <figcaption>
        <p><b>The Instagram screen.</b> Today's two slots with the episode the rotation picked for each, its caption and hashtags, and the sources for the first comment. A slot whose time passes with nothing planned shows as missed and keeps its episode for later.</p>
      </figcaption>
    </figure>
  </section>

  <figure>
    ${img("channel.jpg", `A channel screen for ${channel.name}: separate YouTube and TikTok cards, each with the cover, title, description or caption, hashtags, pinned comment and copy buttons.`)}
    <figcaption>
      <p><b>A channel screen.</b> One card per account (YouTube, TikTok) with copy buttons for each field and the cover. Download and Open YouTube or Open TikTok appear only after you approve that exact video and text; until then the card says what is missing.</p>
    </figcaption>
  </figure>

  <section class="pair" aria-label="Notifications and Costs">
    <figure>
      ${img("settings-phone.jpg", "Settings on a phone, at the Notifications card: what Prism notifies about, and the button to turn notifications on for this device.")}
      <figcaption><p><b>Notifications,</b> in Settings. Turn them on for each phone or computer. Prism tells you when an upload is due, when a scheduled publish needs you, and when an Instagram slot passes with nothing planned. Each event once.</p></figcaption>
    </figure>
    <figure>
      ${img("costs.jpg", "The Costs screen: this month's spending against the production budget, a month-by-month view, the budgets and the cost entries.")}
      <figcaption>
        <p><b>Costs.</b> A monthly production budget per channel, and an optional ceiling for the whole studio. Each entry is something you paid for, or an estimate; estimates and voided entries never count as spent. Prism records costs and never pays anything. Paid generation stays off until a channel's budget has room.</p>
      </figcaption>
    </figure>
  </section>
  `;
}

function rewriteIndex(names: Names, channel: { slug: string; name: string }, tz: string) {
  const html = fs.readFileSync(INDEX, "utf8");
  const START = "<!-- figures: written by npm run preview (scripts/preview.ts); edit them there -->", END = "<!-- /figures -->";
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${INDEX}: the ${START} … ${END} markers are missing`);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date());
  const next = (html.slice(0, a + START.length) + figuresHtml(names, channel) + html.slice(b))
    .replace(/(<div class="kicker">Preview · )[^<]*?( · real screenshots<\/div>)/, `$1${date}$2`);
  fs.writeFileSync(INDEX, next);
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function studioFacts() {
  const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const tz = ((await p.query("select timezone from studio_settings limit 1")).rows[0]?.timezone as string | undefined) ?? "America/Los_Angeles";
    const chans = (await p.query(`select c.slug, c.name, exists (select 1 from episodes e join versions v on v.episode_id = e.id and not v.superseded
      where e.channel_id = c.id and not e.is_demo) as has_render from channels c`)).rows as { slug: string; name: string; has_render: boolean }[];
    return { tz, chans: chans.map((c) => ({ ...c, name: c.name.replace(/ \(name TBD\)$/, "") })) };
  } finally {
    await p.end();
  }
}

async function main() {
  const pwFile = path.join(ROOT, "data", "DEV-PASSWORD.txt");
  if (!fs.existsSync(pwFile)) throw new Error("data/DEV-PASSWORD.txt is missing (the dev passphrase, matching OWNER_PASSWORD_HASH in .env.local).");
  const passphrase = fs.readFileSync(pwFile, "utf8").trim();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL isn't set (.env.local).");

  const { tz, chans } = await studioFacts();
  const names: Names = Object.fromEntries(chans.map((c) => [c.slug, c.name]));
  // the channel screen: --channel, else the first rig screen (inner pair first) whose channel has a render
  const prefer = [RIG.innerRight, RIG.innerLeft, RIG.top, RIG.outerLeft, RIG.outerRight];
  const slug = opt("channel") ?? prefer.find((s) => chans.find((c) => c.slug === s)?.has_render) ?? RIG_ORDER.find((r) => r.slug !== INSTAGRAM_SLUG)!.slug;
  if (!names[slug]) throw new Error(`No channel "${slug}" (have: ${Object.keys(names).join(", ")}).`);

  ensureBuild();
  const port = await freePort();
  const base = await startServer(port);
  console.log(`Server on ${base} (process group ${server!.pid}), dev database`);

  // full Chromium in its new headless mode: the old headless shell reports notifications as blocked whatever is granted
  const pw = chromium();
  const browser = await pw.launch({ channel: "chromium" }).catch(() => pw.launch()).catch(() => pw.launch({ executablePath: "/opt/pw-browsers/chromium" }));
  const problems: string[] = [];
  try {
    // notifications allowed, as on a device where the owner said yes (headless Chromium denies them by default, and
    // Settings would then show "blocked"); nothing subscribes, since no button is pressed
    const common = { colorScheme: "dark", reducedMotion: "reduce", permissions: ["notifications"] };
    const signin = await browser.newContext({ ...common, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await signin.newPage();
    await page.goto(`${base}/login`);
    await page.fill('input[name="passphrase"]', passphrase);
    await page.click('button:has-text("Sign in")');
    try {
      await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
    } catch {
      throw new Error(`Sign-in didn't open the studio: ${(await page.textContent('[role="status"]'))?.trim() || page.url()} (check data/DEV-PASSWORD.txt against OWNER_PASSWORD_HASH)`);
    }
    const storageState = await signin.storageState();
    await signin.close();

    const contexts = new Map<string, Context>();
    const contextFor = async (device: Device, height: number) => {
      const key = `${device}:${height}`;
      if (!contexts.has(key)) contexts.set(key, await browser.newContext({ ...common, storageState,
        ...(device === "phone" ? { viewport: { width: 390, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: PHONE_UA }
          : { viewport: { width: 1440, height }, deviceScaleFactor: device === "wide" ? WIDE : 1 }) }));
      return contexts.get(key)!;
    };

    fs.mkdirSync(OUT, { recursive: true });
    for (const shot of shotsFor(slug)) {
      const tab = await (await contextFor(shot.device, shot.height)).newPage();
      tab.on("pageerror", (e) => problems.push(`${shot.url}: page error: ${e.message}`));
      tab.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(base)) problems.push(`${shot.url}: ${r.status()} ${r.url().slice(base.length)}`); });
      const res = await tab.goto(`${base}${shot.url}`, { waitUntil: "load" });
      if (!res || res.status() >= 400 || new URL(tab.url()).pathname === "/login") throw new Error(`${shot.url} didn't open (status ${res?.status()}, at ${tab.url()})`);
      await tab.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await tab.evaluate("document.fonts.ready.then(() => true)");
      await tab.waitForFunction("[...document.images].every((i) => i.complete)", undefined, { timeout: 15_000 }).catch(() => undefined);
      if (shot.scrollTo) {
        const found = await tab.evaluate<boolean>(`(() => { const el = document.querySelector(${JSON.stringify(shot.scrollTo)}); if (!el) return false;
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16); return true; })()`);
        if (!found) throw new Error(`${shot.url}: ${shot.scrollTo} isn't on the page`);
      }
      await tab.waitForTimeout(700);
      const file = path.join(OUT, shot.file);
      await tab.screenshot({ path: file, type: "jpeg", quality: 82 });
      const { w, h } = jpegSize(file);
      console.log(`  ${shot.file.padEnd(20)} ${w}×${h}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  ${shot.url}`);
      await tab.close();
    }
    for (const c of contexts.values()) await c.close();
  } finally {
    await browser.close();
    await stopServer();
    console.log("Server stopped.");
  }

  rewriteIndex(names, { slug, name: names[slug] }, tz);
  console.log(`Wrote ${path.relative(ROOT, INDEX)}`);
  if (problems.length) {
    console.warn(`\n${problems.length} problem${problems.length === 1 ? "" : "s"} while capturing:\n  ${[...new Set(problems)].join("\n  ")}`);
    process.exitCode = 1;
  }
}

main().catch(async (e) => {
  await stopServer();
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
