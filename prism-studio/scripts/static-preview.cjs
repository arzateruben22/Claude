// Save the running studio as a clickable, read-only static site: every page reachable from the wall, with its CSS,
// fonts, wallpaper, covers and light preview copies of the videos. Links point at the saved pages; forms are off.
//   npm run build, then start the app on a throwaway copy of the database (npm start -- -p 3111), then:
//   BASE=http://127.0.0.1:3111 node scripts/static-preview.cjs <out dir>   (publish <out dir>/index.html with the rest as files)
//   FILES_BASE=https://github.com/<owner>/<repo>/raw/<branch>/ makes the download buttons fetch the full-quality files from there
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE || "http://127.0.0.1:3111";
const OUT = path.resolve(process.argv[2]);
const PASS = fs.readFileSync(path.join(__dirname, "../data/DEV-PASSWORD.txt"), "utf8").trim();
const MAX_PAGES = 160;
const FILES_BASE = (process.env.FILES_BASE || "").replace(/\/?$/, "/").replace(/^\/$/, "");   // see the download buttons below
const SKIP = /^\/(api|login|logout|_next|offline)(\/|$)|\.(webmanifest|js|png|jpg|svg|ico|mp4|zip|srt)$/;

const pageFile = (u) => {
  if (u.pathname === "/" && !u.search) return "./";
  const base = (u.pathname.replace(/^\/|\/$/g, "") || "home").replace(/\//g, "-");
  const q = u.search ? "--" + u.search.slice(1).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  return `${base}${q}.html`;
};
const assetName = (u) => {
  if (u.pathname === "/api/media") {
    const key = u.searchParams.get("k") || "";
    return "media/" + path.basename(key.split("?")[0]).replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  return u.pathname.replace(/^\/+/, "").replace(/^_next\/static\//, "next/").replace(/[^a-zA-Z0-9._/-]/g, "_");
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="passphrase"]', PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button:has-text("Sign in")')]);

  const queue = ["/"], seen = new Set(["/"]), pages = new Map();   // url path+search → html
  while (queue.length && pages.size < MAX_PAGES) {
    const p = queue.shift();
    const resp = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
    if (!resp || resp.status() >= 400 || new URL(page.url()).pathname.startsWith("/login")) { console.log("skip", p, resp && resp.status()); continue; }
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
    // open every <details> so the saved page shows what the app reveals on tap (the static copy has no scripts)
    pages.set(p, await page.content());
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of links) {
      let u; try { u = new URL(h, BASE + p); } catch { continue; }
      if (u.origin !== new URL(BASE).origin || SKIP.test(u.pathname)) continue;
      const k = u.pathname + u.search;
      if (!seen.has(k)) { seen.add(k); queue.push(k); }
    }
  }
  console.log(`pages: ${pages.size}${queue.length ? ` (stopped at ${MAX_PAGES}; ${queue.length} left)` : ""}`);

  // assets: fetch with the signed-in context, CSS rewritten so its url()s point at local copies
  const assets = new Map();   // absolute url → local name
  const fetchAsset = async (abs) => {
    if (assets.has(abs)) return assets.get(abs);
    const u = new URL(abs), name = assetName(u);
    assets.set(abs, name);
    const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");   // the session cookie is Secure: send it by hand over local http
    const r = await ctx.request.get(abs, { headers: { cookie } });
    if (!r.ok()) { console.log("asset failed", r.status(), abs); return name; }
    const file = path.join(OUT, "assets", name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let body = await r.body();
    if (/\.css$/.test(u.pathname)) {
      let css = body.toString("utf8");
      const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((x) => !x.startsWith("data:") && !x.startsWith("#")))];
      const local = new Map();
      for (const x of urls) {
        const a = new URL(x, abs).href;
        if (new URL(a).origin !== new URL(BASE).origin) continue;
        local.set(x, path.relative(path.dirname(name), await fetchAsset(a)));
      }
      css = css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, x) => (local.has(x) ? `url(${q}${local.get(x)}${q})` : m));   // one pass: no URL rewritten twice
      body = Buffer.from(css);
    }
    if (/\.mp4$/i.test(name)) {   // a light preview copy, ~0.8 Mbps: 540 px wide, or 854 px for a 16:9 long video
      const tmp = file + ".src.mp4"; fs.writeFileSync(tmp, body);
      const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", tmp]).toString().trim().split(",").map(Number);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-vf", `scale=${w > h ? 854 : 540}:-2`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-maxrate", "850k", "-bufsize", "1700k", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", file]);
      fs.rmSync(tmp);
    } else fs.writeFileSync(file, body);
    return name;
  };

  const banner = `<div class="static-banner" role="note">Read-only preview of Prism Studio · copy buttons work; buttons that change things are off</div>`;
  const helper = `<script>
document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("button[data-copy]");
  if (b) {
    e.preventDefault();
    var t = b.getAttribute("data-copy"), done = function () { var s = b.querySelector("span"); if (s) { var o = s.textContent; s.textContent = "Copied"; setTimeout(function () { s.textContent = o; }, 1500); } };
    try { navigator.clipboard.writeText(t).then(done, function () { fallback(); }); } catch (_) { fallback(); }
    function fallback() { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (_) {} ta.remove(); done(); }
    return;
  }
  var x = e.target.closest && e.target.closest("button:not([data-copy]):not([type=button]), input[type=submit]");
  if (x) { e.preventDefault(); x.setAttribute("title", "Off in the read-only preview"); }
}, true);
</script>`;
  const css = `<style>.static-banner{position:sticky;top:env(safe-area-inset-top,0px);z-index:50;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:#0A0C10;color:#B0B6C0;font:500 12px/1.4 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid rgba(222,229,240,.12);text-align:center}</style>`;

  const written = [];
  for (const [p, html0] of pages) {
    const here = new URL(BASE + p);
    let html = html0
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b[^>]*rel="(?:preload|modulepreload|manifest|prefetch)"[^>]*>/gi, "")
      .replace(/<link\b[^>]*as="script"[^>]*>/gi, "")
      .replace(/<template[\s\S]*?<\/template>/gi, "");
    // links between pages
    html = html.replace(/(<a\b[^>]*?\shref=")([^"]*)(")/gi, (m, a, h, z) => {
      let u; try { u = new URL(h.replace(/&amp;/g, "&"), here); } catch { return m; }
      if (u.origin !== here.origin) return m;
      const k = u.pathname + u.search;
      if (pages.has(k)) return a + pageFile(u) + (u.hash || "") + z;
      if (u.pathname.startsWith("/api/media")) {
        // a download button: with FILES_BASE (where the films repo's files can be fetched, e.g. a public repo's raw
        // URL), point it at the full-quality file there; otherwise leave it (it is handled with the assets below)
        const f = /^films:(?:films\/)?(.+)$/.exec(u.searchParams.get("k") || "");
        return FILES_BASE && f && u.searchParams.has("dl") ? a + FILES_BASE + "films/" + f[1] + z : m;
      }
      return a + "#" + z;
    });
    // assets: src, poster, href of stylesheets/icons, srcset, url() in style attributes and <style> blocks
    const refs = new Set();
    for (const m of html.matchAll(/\s(?:src|poster|href)="([^"]+)"/g)) refs.add(m[1]);
    for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) m[1].split(",").forEach((s) => refs.add(s.trim().split(/\s+/)[0]));
    for (const m of html.matchAll(/url\((?:&quot;|['"])?([^'")&]+)(?:&quot;|['"])?\)/g)) refs.add(m[1]);
    const local = new Map();
    for (const r of refs) {
      let u; try { u = new URL(r.replace(/&amp;/g, "&"), here); } catch { continue; }
      if (u.origin !== here.origin) continue;
      if (pages.has(u.pathname + u.search) || u.pathname.endsWith(".html")) continue;
      if (!/^\/(_next\/static|fonts|wallpaper|icons|api\/media|icon\.png|favicon)/.test(u.pathname)) continue;
      local.set(r, "assets/" + (await fetchAsset(u.href)));
    }
    // one pass per kind, so nothing is rewritten twice
    html = html.replace(/(\s(?:src|poster|href)=")([^"]+)(")/g, (m, a, v, z) => (local.has(v) ? a + local.get(v) + z : m));
    html = html.replace(/(\ssrcset=")([^"]+)(")/g, (m, a, v, z) => a + v.split(",").map((s) => { const [u, ...w] = s.trim().split(/\s+/); return [local.get(u) || u, ...w].join(" "); }).join(", ") + z);
    html = html.replace(/url\((&quot;|['"])?([^'")&]+)(&quot;|['"])?\)/g, (m, q1, u, q2) => (local.has(u) ? `url(${q1 || ""}${local.get(u)}${q2 || ""})` : m));
    html = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`).replace(/<\/head>/i, `${css}</head>`).replace(/<\/body>/i, `${helper}</body>`);
    const f = pageFile(here);
    if (f === "./") {
      // the artifact's own page: content only (the publisher adds the document skeleton)
      const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, "").replace(/<title>[\s\S]*?<\/title>/i, "");
      const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
      fs.writeFileSync(path.join(OUT, "index.html"), `<title>Prism Studio</title>\n${head}\n${body}\n`);
    } else {
      fs.writeFileSync(path.join(OUT, f), html.startsWith("<!DOCTYPE") || html.startsWith("<!doctype") ? html : "<!doctype html>\n" + html);
      written.push(f);
    }
  }
  console.log(`wrote index.html + ${written.length} pages, ${assets.size} assets`);
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
