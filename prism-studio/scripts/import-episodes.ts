// Import the real episodes produced by the films pipeline (films/channels/<channel>/epNN) into the studio:
// series with the bibles' planned slate, episodes with their scripts and claims (as sources), and for every
// delivered final (out/*-9x16.mp4) a version, three platform exports and planned publications.
// Idempotent: re-running updates in place and never duplicates episodes, versions or publications.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { createEpisode, addVersion, upsertExport } from "../src/domain/episodes";
import type { Topic } from "../src/domain/catalog";
import { captionsToSrt } from "../src/domain/srt";
import { buildMetadata, type MetaInput } from "../src/domain/metadata";
import { loadEnv } from "./env";
loadEnv();

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
export const SLATES: Record<string, { series: string; objective: string; titles: string[] }> = {
  physics: { series: "Season 1: Forces you can see", objective: "See the laws of motion at work in everyday objects, measured on screen.", titles: ["Thrown or dropped?", "The swing's secret", "Where does the bounce go?", "The hammer and the feather", "The spinning chair", "The ten-metre straw"] },
  space: { series: "Season 1: How far, how fast", objective: "Feel the scale of our cosmic neighbourhood through light-travel time and motion.", titles: ["If the Sun vanished", "Nearest star", "Venus day", "Falling Moon", "Sun size", "Your speed"] },
  body: { series: "Season 1: The traffic inside you", objective: "Follow how your body moves cells, oxygen and signals to where they're needed.", titles: ["Single file", "A billion passengers", "The jump", "The gap", "Where breath goes", "The exit"] },
};

const sha256File = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const rel = (f: string) => path.relative(ROOT, f);
const plain = (s: string) => s.replace(/\*/g, "");

/** The script's beats in order, each with its direction and its spoken line(s) (markup kept for the metadata engine). */
export function scriptInfo(dir: string) {
  const p = path.join(dir, "script.md");
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, "utf8");
  const beats: { beat: string; picture: string; vo?: string }[] = [];
  for (const m of text.matchAll(/^## (\w+) \{([^}]*)\}[^\n]*\n([\s\S]*?)(?=\n## |\nend card:|$(?![\r\n]))/gm)) {
    const voM = /^vo: ([\s\S]*?)(?=\n\n|\n?$)/.exec(m[3]);   // no m flag: $ is the end of the beat, not of a line
    beats.push({ beat: m[1], picture: m[2].slice(0, 240), vo: voM ? voM[1].replace(/\s+/g, " ").trim() : undefined });
  }
  const vo = beats.map((b) => plain((b.vo ?? "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim())).filter(Boolean);
  const next = /^end card: "Next: ([^"]+)"/m.exec(text)?.[1] ?? null;
  return { text, vo, beats, next };
}

/** Everything the metadata engine needs, from an episode folder and its channel. */
export function metaInputFor(dir: string, ch: { name: string; label: string; tagline: string; topic: Topic }, ep: { number: number; title: string; durationS?: number | null; seriesTitle?: string | null; seriesOrder?: number | null; seriesTotal?: number | null }): MetaInput {
  const info = scriptInfo(dir);
  const claimsPath = path.join(dir, "claims.json");
  const claims: { id: string; claim: string; source_title?: string; source_url?: string }[] = fs.existsSync(claimsPath) ? JSON.parse(fs.readFileSync(claimsPath, "utf8")) : [];
  return {
    channel: ch, episode: ep,
    beats: (info?.beats ?? []).filter((b) => b.vo).map((b) => ({ beat: b.beat, vo: b.vo! })),
    sources: claims.map((c) => ({ key: c.id, claim: c.claim, title: c.source_title, publisher: (() => { try { return new URL(c.source_url ?? "").hostname.replace(/^www\./, ""); } catch { return c.source_title ?? ""; } })(), url: c.source_url })),
    disclosures: { aiVoice: true, aiVisuals: false },
    next: info?.next ? `Next: ${info.next}` : null,
  };
}

export async function importEpisodes(d = db()) {
  const report: string[] = [];
  for (const [slug, slate] of Object.entries(SLATES)) {
    const [ch] = await d.select().from(S.channels).where(eq(S.channels.slug, slug));
    if (!ch?.filmsPath) continue;
    let [se] = await d.select().from(S.series).where(and(eq(S.series.channelId, ch.id), eq(S.series.title, slate.series)));
    if (!se) [se] = await d.insert(S.series).values({ channelId: ch.id, title: slate.series, objective: slate.objective, audience: ch.editorial.audience, status: "active" }).returning();
    await d.insert(S.seasons).values({ seriesId: se.id, number: 1, title: "Season 1" }).onConflictDoNothing();
    const season = await d.select().from(S.seasons).where(and(eq(S.seasons.seriesId, se.id), eq(S.seasons.number, 1)));
    for (const [i, title] of slate.titles.entries()) {
      const n = i + 1, dir = path.join(ROOT, ch.filmsPath, `ep${String(n).padStart(2, "0")}`);
      const exists = fs.existsSync(dir), info = exists ? scriptInfo(dir) : null;
      const film = exists && fs.existsSync(path.join(dir, "film.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "film.json"), "utf8")) : null;
      const out = exists && fs.existsSync(path.join(dir, "out")) ? fs.readdirSync(path.join(dir, "out")).find((f) => /-9x16\.mp4$/.test(f)) : undefined;
      const state = out ? "ready_for_review" : info ? "script" : "idea";
      let [ep] = await d.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, n)));
      if (!ep) ep = await createEpisode(d, { channelId: ch.id, title, seriesId: se.id, seriesOrder: n, number: n, state, filmsPath: exists ? rel(dir) : null });
      const question = info?.vo[0]?.split("?")[0] ? info.vo[0].split("?")[0] + "?" : ep.question;
      const advance = ["idea", "research", "outline", "script"].includes(ep.state) ? state : ep.state;   // never move an episode backwards
      await d.update(S.episodes).set({
        title: film?.title?.title ? plain(film.title.title) : title, question, seasonId: season[0].id, seriesId: se.id, seriesOrder: n,
        script: info ? info.vo.join("\n\n") : ep.script, storyboard: info ? info.beats : ep.storyboard, durationS: film?.dur ?? ep.durationS,
        captionsSrt: film?.captions ? captionsToSrt(film.captions) : ep.captionsSrt,
        filmsPath: exists ? rel(dir) : ep.filmsPath, state: advance as typeof ep.state, updatedAt: new Date(),
      }).where(eq(S.episodes.id, ep.id));
      // claims → sources (replace: claims.json is the source of truth for an imported episode)
      const claimsPath = path.join(dir, "claims.json");
      if (exists && fs.existsSync(claimsPath)) {
        await d.delete(S.sources).where(eq(S.sources.episodeId, ep.id));
        for (const c of JSON.parse(fs.readFileSync(claimsPath, "utf8"))) {
          await d.insert(S.sources).values({ episodeId: ep.id, claimKey: c.id, claim: c.claim, sentence: c.sentence, url: c.source_url ?? "", title: c.source_title ?? "",
            publisher: (() => { try { return new URL(c.source_url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
            retrievedAt: c.accessed ?? "", verifiedVia: c.verified_via ?? "", status: c.status === "ok" ? "ok" : "unresolved", uncertainty: c.note ?? "" });
        }
      }
      if (!out) { report.push(`${slug} ep${n}: ${state}`); continue; }
      const file = path.join(dir, "out", out), hash = sha256File(file);
      const existing = await d.select().from(S.versions).where(and(eq(S.versions.episodeId, ep.id), eq(S.versions.sha256, hash)));
      let ver = existing[0];
      if (!ver) {
        const qaPath = path.join(dir, "build", "qa-delivery.json");
        ver = await addVersion(d, { episodeId: ep.id, videoPath: `films:${rel(file)}`, sha256: hash, posterPath: `films:${rel(file.replace(/\.mp4$/, ".jpg"))}`,
          width: 1080, height: 1920, durationS: film?.dur, label: "final", qa: fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, "utf8")) : {} });
      }
      const meta = buildMetadata(metaInputFor(dir, { name: ch.name, label: ch.label, tagline: ch.tagline, topic: ch.topic as Topic },
        { number: n, title: film?.title?.title ? plain(film.title.title) : title, durationS: film?.dur, seriesTitle: slate.series, seriesOrder: n, seriesTotal: slate.titles.length }));
      for (const platform of ["youtube", "tiktok", "instagram"] as const) {
        const m = meta[platform];
        await upsertExport(d, { versionId: ver.id, platform, filePath: `films:${rel(file)}`, fileSha256: hash,
          title: m.title, caption: m.caption, hashtags: m.hashtags, coverPath: `films:${rel(file.replace(/\.mp4$/, ".jpg"))}`,
          disclosures: { aiVoice: true, aiVisuals: false, notes: "Code-rendered (procedural) animation; synthetic narration." },
          postingNotes: ["Turn on the platform's AI-generated/synthetic content label. Captions are burned in: leave auto-captions off.",
            m.pinnedComment ? `Pinned/first comment:\n${m.pinnedComment}` : "", m.tags.length ? `Tags: ${m.tags.join(", ")}` : "", m.warnings.length ? `Check: ${m.warnings.join("; ")}` : ""].filter(Boolean).join("\n\n") });
      }
      // planned publications for this channel's YouTube and TikTok (Instagram picks from the backlog separately)
      const dests = await d.select().from(S.destinations).where(eq(S.destinations.channelId, ch.id));
      for (const dest of dests) {
        const [x] = await d.select().from(S.platformExports).where(and(eq(S.platformExports.versionId, ver.id), eq(S.platformExports.platform, dest.platform)));
        await d.insert(S.publications).values({ episodeId: ep.id, destinationId: dest.id, exportId: x.id, kind: "short", status: "planned" })
          .onConflictDoUpdate({ target: [S.publications.episodeId, S.publications.destinationId], set: { exportId: x.id, updatedAt: new Date() } });
      }
      report.push(`${slug} ep${n}: version ${ver.versionNo} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB), 3 exports`);
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const line of await importEpisodes()) console.log(line);
  await pool().end();
}
