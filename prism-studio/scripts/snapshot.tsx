// A read-only snapshot of the studio's screens as one static page (docs/preview.html), for sharing before the
// app is hosted: Home (the five worlds), the Upload Desk, Accounts and each channel's episodes, with today's data.
// No buttons work; nothing private (no emails, no tokens) is written.
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { Creation } from "../src/creations/Creation";
import { CREATIONS } from "../src/creations/meta";
import type { CreationKey, Form } from "../src/creations/types";
import { channelXp } from "../src/domain/living";
import { formatLocal } from "../src/domain/time";
import { loadEnv } from "./env";
loadEnv();

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const STATE: Record<string, string> = { idea: "Idea", research: "Research", outline: "Outline", script: "Script", fact_check: "Fact check", storyboard: "Storyboard", assets: "Assets", narration: "Narration", captions: "Captions", render: "Render", quality_check: "Quality check", ready_for_review: "Ready for review", approved: "Approved", scheduled: "Scheduled", uploading: "Uploading", processing: "Processing", published: "Published", analytics: "Analytics", blocked: "Blocked", failed: "Failed", cancelled: "Cancelled", superseded: "Superseded", correction_needed: "Correction needed" };
const tone = (s: string) => ["published", "analytics", "approved"].includes(s) ? "good" : ["blocked", "failed", "correction_needed"].includes(s) ? "bad" : s === "ready_for_review" ? "warn" : "";
const PUB: Record<string, string> = { planned: "Planned", ready: "Ready", handed_off: "Handed off", owner_reported: "Uploaded", scheduled_on_platform: "Scheduled on platform", verified_published: "Published (verified)", failed: "Failed", cancelled: "Cancelled" };
const PLAT: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };
const PROV: Record<string, string> = { unset: "Not set up", owner_entered: "Entered", owner_confirmed: "Confirmed", integration_verified: "Verified" };
const ITEMS: Record<string, string> = { email: "Brand email (password manager, 2-step on)", youtube: "YouTube channel created", tiktok: "TikTok account created", handles: "Names and @handles saved", links: "Profile, Studio and upload links saved", upload_test: "Upload workflow checked", admin_email: "Studio/admin email chosen", instagram: "Shared Instagram created; bio explains the five topics", instagram_links: "Instagram handle and links saved" };

const d = db();
const s = (await d.select().from(S.studioSettings))[0];
const chans = await d.select().from(S.channels).orderBy(asc(S.channels.sort));
const creations = await d.select().from(S.creations);
const eps = await d.select().from(S.episodes).where(eq(S.episodes.isDemo, false)).orderBy(asc(S.episodes.number));
const dests = await d.select().from(S.destinations);
const onb = await d.select().from(S.onboarding);
const conns = await d.select({ destinationId: S.connections.destinationId, status: S.connections.status }).from(S.connections);
const series = await d.select().from(S.series);
const pubs = await d.select({ p: S.publications, e: S.episodes, dest: S.destinations }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId)).innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
  .where(inArray(S.publications.status, ["planned", "ready", "handed_off", "owner_reported", "scheduled_on_platform", "verified_published"])).orderBy(asc(S.publications.scheduledFor), asc(S.episodes.number));
const approvals = await d.select().from(S.approvals).where(sql`${S.approvals.revokedAt} is null`);
const versions = await d.select().from(S.versions).where(eq(S.versions.superseded, false));
const best = Number(((await d.execute(sql`select coalesce(max(m.value),0) as v from metric_snapshots m join publications p on p.id=m.publication_id join episodes e on e.id=p.episode_id where m.metric='views' and m.source in ('api','csv','manual') and not p.simulated and not e.is_demo and m.status<>'revised'`)).rows[0] as { v: number }).v);
const xp = new Map<string, Awaited<ReturnType<typeof channelXp>>>();
for (const c of chans) xp.set(c.id, await channelXp(d, c.id));

const name = (c: typeof chans[number]) => c.name.replace(/ \(name TBD\)$/, "");
const chip = (text: string, t = "") => `<span class="chip ${t}">${esc(text)}</span>`;
const topic = (c: typeof chans[number]) => `style="--topic:${c.color};--topic-ink:${c.colorInk}"`;
const art = (c: typeof chans[number], size: number) => {
  const cr = creations.find((x) => x.channelId === c.id)!;
  return renderToStaticMarkup(createElement(Creation, { creation: cr.creationKey as CreationKey, form: cr.form as Form, branch: (cr.branch as "a" | "b" | null) ?? null, ascended: cr.ascended, size, motion: "static" }));
};

// ── Home ─────────────────────────────────────────────────────────────────────
const now = new Date();
const due = pubs.filter((r) => ["planned", "ready", "handed_off"].includes(r.p.status) && r.p.scheduledFor && r.p.scheduledFor < new Date(+now + 86_400_000));
const toReview = eps.filter((e) => e.state === "ready_for_review").length;
const home = `
<section class="stack-lg">
  <header>
    <div class="kicker">${esc(formatLocal(now, s.timezone, { weekday: "long", month: "long", day: "numeric" }))} · read-only snapshot</div>
    <h1>Prism Studio.</h1>
    <p class="lede">${due.length ? `${due.length} upload${due.length > 1 ? "s" : ""} due today` : "Nothing due to upload today"}${toReview ? ` · ${toReview} episode${toReview > 1 ? "s" : ""} waiting for review` : ""}.</p>
  </header>
  <div class="grid2">
    <div class="card ink stack-sm">
      <div class="kicker">Today's upload desk</div>
      ${due.length ? `<ul class="list">${due.slice(0, 5).map((t) => `<li class="row spread"><span>${esc(t.e.title)}</span><span class="num">${PLAT[t.dest.platform]}</span></li>`).join("")}</ul>` : `<p class="muted">All clear. Approved episodes get planned from the calendar.</p>`}
    </div>
    <div class="card stack-sm" style="--topic:#F2A93B;--topic-ink:#8A5A00">
      <div class="kicker">1M Club: Our First Million</div>
      <div class="h2">${best.toLocaleString("en-US")} <span class="muted" style="font-size:18px">/ 1,000,000</span></div>
      <div class="muted">Best single post, platform-reported. Reward $200 from your own budget (not set up yet).</div>
    </div>
  </div>
  <div>
    <div class="section-head"><h2>The five worlds</h2><span class="faint num">${onb.filter((o) => o.done).length}/${onb.length} setup steps</span></div>
    <div class="worlds">
      ${chans.map((c) => {
        const cr = creations.find((x) => x.channelId === c.id)!, meta = CREATIONS[cr.creationKey as CreationKey], x = xp.get(c.id)!;
        const mine = eps.filter((e) => e.channelId === c.id), published = mine.filter((e) => ["published", "analytics"].includes(e.state)).length, review = mine.filter((e) => e.state === "ready_for_review").length;
        const pct = Math.round(((x.xp - x.levelStart) / Math.max(1, x.next - x.levelStart)) * 100);
        return `<a class="world" href="#ch-${c.slug}" ${topic(c)} data-go="channels" data-ch="${c.slug}">
          <span class="art">${art(c, 112)}</span>
          <span><span class="label">${esc(c.label)}</span>
            <span class="name">${esc(name(c))}${c.nameProvisional ? ` <span class="faint" style="font-size:14px;font-family:var(--ui)">· working name</span>` : ""}</span>
            <span class="form">${esc(meta.name)} · form ${cr.form}: ${esc(meta.forms[cr.form - 1])}</span>
            <span class="bar"><i style="width:${pct}%"></i></span>
            <span class="status">${chip(`Lv ${x.level} · ${x.xp} XP`)}${chip(`${published}/${mine.length} published`)}${review ? chip(`${review} to review`, "warn") : ""}</span></span></a>`;
      }).join("")}
    </div>
  </div>
</section>`;

// ── Upload Desk ───────────────────────────────────────────────────────────────
const task = (r: typeof pubs[number]) => {
  const c = chans.find((x) => x.id === r.e.channelId)!;
  const approved = r.p.exportId && approvals.some((a) => a.exportId === r.p.exportId && a.destinationId === r.dest.id);
  const ver = versions.find((v) => v.episodeId === r.e.id);
  return `<article class="card topic stack-sm" ${topic(c)}>
    <div class="row spread top"><div><div class="kicker" style="color:var(--topic-ink)">${esc(c.label)} · ${PLAT[r.dest.platform]}${r.p.scheduledFor ? ` · ${esc(formatLocal(r.p.scheduledFor, s.timezone, { weekday: "short", hour: "numeric", minute: "2-digit" }))}` : " · not scheduled"}</div>
      <h3 class="h2">${esc(r.e.title)}</h3><div class="muted" style="font-size:14px">No. ${String(r.e.number).padStart(3, "0")}${ver ? ` · render v${ver.versionNo}` : ""}</div></div>
      ${chip(PUB[r.p.status] ?? r.p.status, r.p.status === "verified_published" || r.p.status === "owner_reported" ? "good" : "")}</div>
    <div class="acct"><div class="who"><span class="avatar" style="background:var(--topic-ink)">${esc((r.dest.handle.replace("@", "") || PLAT[r.dest.platform]).slice(0, 2).toUpperCase())}</span>
      <div><div class="handle">${esc(r.dest.handle || (r.dest.shared ? "Shared Instagram" : `${name(c)} ${PLAT[r.dest.platform]}`))}</div><div class="muted" style="font-size:13px">${r.dest.handle ? "" : "Account not set up yet · "}${PLAT[r.dest.platform]}</div></div></div></div>
    <div class="row">${approved ? chip("Approved for this account", "good") : chip("Not approved yet", "warn")}${r.dest.publishMethod === "api" ? chip("Connected", "info") : chip("Manual: share / download / copy")}</div>
  </article>`;
};
const open = pubs.filter((r) => ["planned", "ready", "handed_off"].includes(r.p.status));
const upload = `
<section class="stack-lg">
  <header><div class="kicker">Manual publishing</div><h1>Upload Desk</h1><p class="lede">Each task is one exact, approved video and text for one account. On the live app: share or download it, post it, then mark it uploaded.</p></header>
  <div><div class="section-head"><h2>Due today</h2><span class="faint num">${due.length}</span></div>${due.length ? `<div class="stack">${due.map(task).join("")}</div>` : `<p class="muted">Nothing due today.</p>`}</div>
  <div><div class="section-head"><h2>Not scheduled</h2><span class="faint num">${open.filter((r) => !r.p.scheduledFor).length}</span></div><div class="stack">${open.filter((r) => !r.p.scheduledFor).map(task).join("")}</div></div>
</section>`;

// ── Accounts ──────────────────────────────────────────────────────────────────
const destCard = (x: typeof dests[number]) => {
  const conn = conns.find((c) => c.destinationId === x.id);
  return `<div class="card stack-sm"><div class="row spread"><h3>${PLAT[x.platform]}${x.shared ? " (shared)" : ""}</h3>${chip(PROV[x.provenance], x.provenance === "unset" ? "warn" : x.provenance === "integration_verified" ? "good" : "")}</div>
    <div class="h2">${esc(x.handle || "")}${x.handle ? "" : `<span class="muted">Not set up</span>`}</div>
    <div class="row">${chip(conn ? `Connected · ${conn.status}` : "Not connected", conn?.status === "connected" ? "good" : "")}${chip(x.publishMethod === "api" ? "Publishes by API" : "Manual publishing")}</div>
    <div class="faint" style="font-size:13px">Profile: ${x.profileUrl ? esc(x.profileUrl) : "—"}</div></div>`;
};
const accounts = `
<section class="stack-lg">
  <header><div class="kicker">11 destinations</div><h1>Accounts</h1><p class="lede">One YouTube channel and one TikTok account per channel, plus one Instagram for all five. Prism never stores platform passwords or recovery codes.</p></header>
  ${chans.map((c) => { const items = onb.filter((o) => o.channelId === c.id); return `<div ${topic(c)}><div class="section-head"><h2>${esc(name(c))}</h2><span class="faint num">${items.filter((i) => i.done).length}/${items.length} set up</span></div>
    <div class="grid2"><div class="card stack-sm"><div class="kicker">Checklist</div>${items.map((o) => `<div class="check"><span class="box ${o.done ? "on" : ""}">${o.done ? "✓" : ""}</span><span>${esc(ITEMS[o.item] ?? o.item)}</span></div>`).join("")}</div>
    ${dests.filter((x) => x.channelId === c.id).sort((a, b) => a.platform.localeCompare(b.platform)).reverse().map(destCard).join("")}</div></div>`; }).join("")}
  <div><div class="section-head"><h2>Shared Instagram and studio</h2><span class="faint num">${onb.filter((o) => o.channelId === null && o.done).length}/${onb.filter((o) => o.channelId === null).length} set up</span></div>
    <div class="grid2"><div class="card stack-sm"><div class="kicker">Checklist</div>${onb.filter((o) => o.channelId === null).map((o) => `<div class="check"><span class="box ${o.done ? "on" : ""}">${o.done ? "✓" : ""}</span><span>${esc(ITEMS[o.item] ?? o.item)}</span></div>`).join("")}</div>
    ${dests.filter((x) => x.shared).map(destCard).join("")}</div></div>
</section>`;

// ── Channels ──────────────────────────────────────────────────────────────────
const channels = `
<section class="stack-lg">
  <header><div class="kicker">Series and episodes</div><h1>Channels</h1></header>
  ${chans.map((c) => {
    const cr = creations.find((x) => x.channelId === c.id)!, meta = CREATIONS[cr.creationKey as CreationKey], mine = eps.filter((e) => e.channelId === c.id), ser = series.filter((x) => x.channelId === c.id);
    return `<div id="ch-${c.slug}" class="card topic stack" ${topic(c)}>
      <div class="row" style="gap:16px"><span class="art">${art(c, 96)}</span><div><div class="kicker" style="color:var(--topic-ink)">${esc(c.label)}</div><h2 style="margin:4px 0 2px">${esc(name(c))}</h2><div class="muted">${esc(c.tagline)}</div><div class="faint" style="font-size:13px">${esc(meta.name)} · form ${cr.form}: ${esc(meta.forms[cr.form - 1])} · narrator ${esc(c.voice.narrator)}</div></div></div>
      ${ser.map((x) => `<div class="card flat stack-sm"><div class="row spread"><b>${esc(x.title)}</b>${chip(x.status)}</div><div class="muted" style="font-size:14px">${esc(x.objective)}</div></div>`).join("")}
      ${mine.length ? `<ul class="list">${mine.map((e) => `<li class="row spread"><span><span class="num faint">No. ${String(e.number).padStart(3, "0")}</span> <b>${esc(e.title)}</b>${e.durationS ? ` <span class="faint">· ${e.durationS.toFixed(1)} s</span>` : ""}</span>${chip(STATE[e.state], tone(e.state))}</li>`).join("")}</ul>` : `<p class="muted">No episodes yet.</p>`}
    </div>`;
  }).join("")}
</section>`;

const html = `<title>Prism Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: one phone-width column (max 520px) on the studio's ivory ground; a dark five-tab bar at the thumb. */
:root { --ivory:#F6F1E7; --paper:#FBF8F2; --sand:#EDE5D6; --ink:#141210; --ink-2:#5A534A; --ink-3:#8A8277; --line:rgba(20,18,16,.12); --line-2:rgba(20,18,16,.22);
  --good:#1F7A4D; --warn:#9A6400; --bad:#B3261E; --info:#2747C9; --topic:#141210; --topic-ink:#141210; --nav:#141210; --nav-fg:#F6F1E7;
  --display:"Instrument Serif","Iowan Old Style",Georgia,serif; --ui:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,monospace; --r:18px; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ivory:#171411; --paper:#201c18; --sand:#2b2621; --ink:#F6F1E7; --ink-2:#C9C1B4; --ink-3:#9a9186; --line:rgba(246,241,231,.14); --line-2:rgba(246,241,231,.26); --good:#5FCB8F; --warn:#E3B04B; --bad:#F08A80; --info:#8FA3FF; --topic:#F6F1E7; --topic-ink:#F6F1E7; --nav:#0d0b09; color-scheme: dark; } }
:root[data-theme="dark"] { --ivory:#171411; --paper:#201c18; --sand:#2b2621; --ink:#F6F1E7; --ink-2:#C9C1B4; --ink-3:#9a9186; --line:rgba(246,241,231,.14); --line-2:rgba(246,241,231,.26); --good:#5FCB8F; --warn:#E3B04B; --bad:#F08A80; --info:#8FA3FF; --topic:#F6F1E7; --topic-ink:#F6F1E7; --nav:#0d0b09; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--ivory); color:var(--ink); font:400 16px/1.5 var(--ui); }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--ivory); }
.wrap { max-width:520px; margin:0 auto; padding-block:14px 110px; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); }
.note { font:500 11.5px/1.3 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); padding:8px 12px; border:1px dashed var(--line-2); border-radius:12px; margin-bottom:14px; }
h1 { font:400 clamp(38px,9vw,56px)/0.98 var(--display); letter-spacing:-.015em; margin:6px 0 10px; text-wrap:balance; }
h2 { font:400 clamp(24px,5vw,32px)/1.05 var(--display); margin:0 0 8px; } h3 { font:650 17px/1.25 var(--ui); margin:0 0 6px; }
.h2 { font:400 24px/1.05 var(--display); margin:0; }
.kicker { font:500 11.5px/1.2 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); }
.lede { font-size:17px; color:var(--ink-2); margin:0 0 6px; } .muted { color:var(--ink-2); } .faint { color:var(--ink-3); } .num { font:500 13px/1 var(--mono); font-variant-numeric:tabular-nums; }
.stack { display:grid; gap:16px; } .stack-sm { display:grid; gap:8px; } .stack-lg { display:grid; gap:28px; } .grid2 { display:grid; gap:16px; }
.row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; } .row.spread { justify-content:space-between; } .row.top { align-items:flex-start; }
.section-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:12px; border-top:1px solid var(--line-2); padding-top:14px; }
.card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r); padding:18px; min-width:0; } .card.ink { background:var(--nav); color:var(--nav-fg); border-color:transparent; } .card.ink .muted,.card.ink .kicker { color:rgba(246,241,231,.68); }
.card.flat { box-shadow:none; } .card.topic { border-top:4px solid var(--topic); }
.list { display:grid; list-style:none; margin:0; padding:0; } .list > li { padding:10px 0; border-top:1px solid var(--line); } .list > li:first-child { border-top:0; }
.worlds { display:grid; gap:14px; }
.world { position:relative; display:grid; grid-template-columns:112px 1fr; gap:14px; align-items:center; padding:14px 16px 14px 12px; text-decoration:none; color:inherit; background:linear-gradient(160deg,color-mix(in srgb,var(--topic) 13%,var(--paper)) 0%,var(--paper) 62%); border:1px solid var(--line); border-radius:22px; overflow:hidden; }
.world::after { content:""; position:absolute; right:-40px; top:-40px; width:140px; height:140px; border:1px solid color-mix(in srgb,var(--topic) 40%,transparent); transform:rotate(45deg); border-radius:18px; pointer-events:none; }
.world .label { font:500 10.5px/1 var(--mono); letter-spacing:.14em; color:var(--topic-ink); } .world .name { display:block; font:400 26px/1.02 var(--display); margin:4px 0 2px; } .world .form { display:block; font-size:13.5px; color:var(--ink-2); }
.world .status { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; } .art svg { display:block; max-width:100%; height:auto; }
.bar { display:block; height:8px; border-radius:999px; background:var(--sand); overflow:hidden; margin-top:10px; } .bar > i { display:block; height:100%; background:var(--topic-ink); border-radius:inherit; }
.chip { display:inline-flex; align-items:center; padding:4px 9px; border-radius:999px; font:600 12px/1.2 var(--ui); background:var(--sand); color:var(--ink-2); white-space:nowrap; }
.chip.good { background:color-mix(in srgb,var(--good) 14%,var(--paper)); color:var(--good); } .chip.warn { background:color-mix(in srgb,var(--warn) 14%,var(--paper)); color:var(--warn); } .chip.bad { background:color-mix(in srgb,var(--bad) 12%,var(--paper)); color:var(--bad); } .chip.info { background:color-mix(in srgb,var(--info) 12%,var(--paper)); color:var(--info); }
.acct .who { display:flex; gap:12px; align-items:center; } .avatar { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; color:#fff; font:700 14px/1 var(--mono); flex:none; } .handle { font:400 22px/1.05 var(--display); }
.check { display:flex; gap:10px; align-items:flex-start; padding:5px 0; font-size:14.5px; } .box { flex:none; width:22px; height:22px; border-radius:6px; border:1.5px solid var(--line-2); display:grid; place-items:center; font-size:13px; color:var(--good); } .box.on { border-color:var(--good); }
.tabs { position:fixed; z-index:40; left:0; right:0; bottom:0; height:calc(68px + env(safe-area-inset-bottom,0px)); padding:0 max(0px,env(safe-area-inset-left,0px)) env(safe-area-inset-bottom,0px) max(0px,env(safe-area-inset-right,0px)); display:grid; grid-template-columns:repeat(4,1fr); background:var(--nav); color:var(--nav-fg); }
.tabs button { background:none; border:0; color:rgba(246,241,231,.66); font:600 12px/1 var(--ui); letter-spacing:.02em; cursor:pointer; padding:10px 4px 8px; display:grid; place-items:center; gap:6px; }
.tabs button[aria-selected="true"] { color:var(--nav-fg); } .tabs button:focus-visible { outline:3px solid #F2A93B; outline-offset:-3px; border-radius:8px; }
.tabs svg { width:22px; height:22px; }
section[hidden] { display:none; }
@media (min-width: 720px) { .grid2 { grid-template-columns:1fr 1fr; } .wrap { max-width:960px; } .worlds { grid-template-columns:repeat(6,1fr); } .worlds > :nth-child(1),.worlds > :nth-child(2) { grid-column:span 3; } .worlds > :nth-child(n+3) { grid-column:span 2; } .world { grid-template-columns:1fr; padding:16px; } .world .art { justify-self:center; } }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
</style>
<div class="wrap">
  <div class="note">Snapshot of the live studio · ${esc(formatLocal(now, s.timezone, { dateStyle: "medium", timeStyle: "short" }))} · nothing here is clickable except the tabs</div>
  <section id="view-home">${home}</section>
  <section id="view-upload" hidden>${upload}</section>
  <section id="view-accounts" hidden>${accounts}</section>
  <section id="view-channels" hidden>${channels}</section>
</div>
<nav class="tabs" role="tablist" aria-label="Studio">
  <button role="tab" data-tab="home" aria-selected="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"/></svg>Home</button>
  <button role="tab" data-tab="upload" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5m0 0-4.5 4.5M12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>Upload</button>
  <button role="tab" data-tab="accounts" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1"/></svg>Accounts</button>
  <button role="tab" data-tab="channels" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>Channels</button>
</nav>
<script>
(function(){
  var tabs=["home","upload","accounts","channels"];
  function show(t){ if(tabs.indexOf(t)<0) t="home"; tabs.forEach(function(k){ document.getElementById("view-"+k).hidden = k!==t; }); document.querySelectorAll(".tabs button").forEach(function(b){ b.setAttribute("aria-selected", b.dataset.tab===t ? "true":"false"); }); window.scrollTo(0,0); }
  document.querySelectorAll(".tabs button").forEach(function(b){ b.addEventListener("click", function(){ show(b.dataset.tab); try{ sessionStorage.setItem("tab", b.dataset.tab);}catch(e){} }); });
  document.querySelectorAll("[data-go]").forEach(function(a){ a.addEventListener("click", function(ev){ ev.preventDefault(); show(a.dataset.go); var el=document.getElementById("ch-"+a.dataset.ch); if(el) el.scrollIntoView({block:"start"}); }); });
  var h=(location.hash||"").replace("#",""); var saved=null; try{ saved=sessionStorage.getItem("tab"); }catch(e){}
  show(tabs.indexOf(h)>=0 ? h : (saved||"home"));
})();
</script>`;

fs.mkdirSync(path.join("docs"), { recursive: true });
fs.writeFileSync(path.join("docs", "preview.html"), html);
console.log(`docs/preview.html: ${(html.length / 1024).toFixed(0)} KB · ${chans.length} channels, ${eps.length} episodes, ${dests.length} destinations, ${open.length} open tasks`);
await pool().end();
