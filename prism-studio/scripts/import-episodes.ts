// Import the real episodes produced by the films pipeline (films/channels/<channel>/epNN) into the studio:
// series with the bibles' planned slate, episodes with their scripts and claims (as sources), and for every
// delivered final (out/*-9x16.mp4) a version, three platform exports (YouTube's from out/*-9x16-youtube.mp4 when
// there is one) and planned publications.
// Idempotent: re-running updates in place and never duplicates episodes, versions or publications. An episode whose
// video was cleared after posting keeps all of its records; its text (title, captions, sources) still updates.
// Then every long video a cloud session built and pushed (compilations/<name>/ with a *-16x9.mp4) is registered as
// the channel's lesson of that name (registerCompilation): new ones are added, rebuilt ones refreshed, a corrected
// chapters.txt or description.md picked up, and parts not linked yet tried again (a part links when its episode title equals
// its chapters.txt line).
// An archived channel (src/domain/channels.ts) is skipped entirely: whatever files a push brings, its rows stay as they are.
// An archived (uploaded) season's episodes (src/domain/season-archive.ts) keep their render, exports and publications
// exactly as they are, like a cleared video, so an import never brings the season back; their text still updates.
// packaging.json (out/packaging.json, compilations/<name>/packaging.json; src/domain/packaging.ts) is stored on the episode
// or lesson when present, and its winner title becomes the YouTube title; a missing or bad one never fails the import.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { createEpisode, addVersion, upsertExport, editExport } from "../src/domain/episodes";
import type { Topic } from "../src/domain/catalog";
import { captionsToSrt } from "../src/domain/srt";
import { buildMetadata, hookQuestion, postingNotesFor, type MetaInput } from "../src/domain/metadata";
import { disclosureNotes, episodeDisclosures } from "../src/domain/disclosures";
import { registerCompilation } from "../src/domain/lessons";
import { activeChannels, isArchived } from "../src/domain/channels";
import { seasonArchive } from "../src/domain/season-archive";
import { packagingTitle, readPackagingFile } from "../src/domain/packaging";
import { loadEnv } from "./env";
loadEnv();

const ROOT = path.resolve(process.env.FILMS_REPO_ROOT || "..");
export const SLATES: Record<string, { series: string; objective: string; titles: string[] }> = {
  physics: { series: "Season 1: Forces you can see", objective: "See the laws of motion at work in everyday objects, measured on screen.", titles: ["Thrown or dropped?", "The swing's secret", "Where does the bounce go?", "The hammer and the feather", "The spinning chair", "The ten-metre straw"] },
  space: { series: "Season 1: How far, how fast", objective: "Feel the scale of our cosmic neighbourhood through light-travel time and motion.", titles: ["If the Sun vanished", "Nearest star", "Venus day", "Falling Moon", "Sun size", "Your speed"] },
  body: { series: "Season 1: The traffic inside you", objective: "Follow how your body moves cells, oxygen and signals to where they're needed.", titles: ["Single file", "A billion passengers", "The jump", "The gap", "Where breath goes", "The exit"] },
  skincare: { series: "Season 1: Under the surface", objective: "See what your skin is really doing, with the evidence on the screen.", titles: ["The fight you never saw", "Where a glow comes from", "What's in a scar", "The deadliest dose", "The sunscreen experiment", "Same list as cigarettes"] },
  whatif: { series: "Season 1: Impossible, worked out", objective: "Take an impossible question, state every assumption, and land on a real number you can feel.", titles: ["Through the Earth", "Everyone, one place", "All the ants", "Count to a billion", "Everybody jump", "Every raindrop at once"] },
};

type Slate = { series: string; objective: string; titles: string[] };
// Season 2: episode folders ep07-ep12, numbered "Season 2 · Episode 1-6" on screen. Titles are fallbacks: a delivered
// film's own title (film.json) wins.
export const SEASON2: Record<string, Slate> = {
  physics: { series: "Season 2: Everyday surprises", objective: "Find the physics hiding in ordinary things, shown and measured on screen.", titles: ["The slinky that waits", "Spaghetti almost never breaks in two", "The nut that rises", "The ring a coffee drop leaves", "Listen to the cup fill", "Episode 6"] },
  space: { series: "Season 2: Bigger than it looks", objective: "Turn the universe's biggest numbers into pictures you can feel.", titles: ["Trees or stars", "Dark sky", "Your gold", "The black hole's edge", "Episode 5", "Episode 6"] },
  whatif: { series: "Season 2: Even more impossible", objective: "Take an impossible question, state every assumption, and land on a real number you can feel.", titles: ["Walking to the Moon", "Everyone holds hands", "A rope round the Earth", "Episode 4", "Episode 5", "Episode 6"] },
  skincare: { series: "Season 2: What your skin does", objective: "See what your skin does on its own, with the evidence on the screen.", titles: ["Why goosebumps happen", "Why fingers wrinkle in water", "How sweat cools you", "What a tan really is", "The brick wall on your skin", "Fingerprints before birth"] },
};

// Season 3 (films/channels/SEASON-FORMAT.md). Reality Rulebook, One More Orbit and Possibility Lab: one long film
// (compilations/<film-slug>/) plus 8 parts in ep13-ep20. Skin Sense: 6 premium episodes in ep13-ep18. Titles are
// fallbacks, as in Season 2: a delivered film's own title (film.json) wins, and packaging.json's winner title is the
// YouTube title. A part's title must equal its line in the film's chapters.txt, or the film can't link it
// (src/domain/lessons.ts), so the film channels' fallbacks are the chapter titles as planned. Series titles never change
// once imported: the series row is found by its title.
export const SEASON3: Record<string, Slate> = {
  physics: { series: "Season 3: One second, slowed down", objective: "Slow one ordinary second further and further until even light crawls, every number checked on screen.",
    titles: ["Watch a wing, slowed ten times", "A fly's wings, then a splash", "A popcorn pop, in slow motion", "Watch sound cross a kitchen", "A bullet, through an apple, slowly", "Lightning, a million times slower", "Slow light until it crawls", "Slower than a snail: light"] },
  space: { series: "Season 3: The Moon comes closer", objective: "Bring the Moon closer step by step and feel every change it makes, every number sourced.",
    titles: ["The Moon starts coming closer", "One quarter closer", "Half the distance, the sea climbs", "The night gets too bright", "When the Moon outgrows the Sun", "The ground moves too", "The Moon rises in the wrong place", "The distance no moon survives"] },
  whatif: { series: "Season 3: The Earth spins faster", objective: "Speed up the Earth's spin, state every assumption, and land on numbers you can feel.",
    titles: ["What if Earth spun faster?", "A twelve-hour day", "The air can't keep up", "The oceans slide to the equator", "Six-hour days and faster storms", "A thousand days in a year", "A day as long as a movie", "Almost weightless"] },
  skincare: { series: "Season 3: Inside your skin, slowly", objective: "Follow one slow journey inside your skin in each episode, with the evidence on the screen.",
    titles: ["What one shiver does inside you", "Where do your skin cells go?", "What is actually inside a pore?", "How one pore turns into a pimple", "Every hair on you is scheduled to fall out", "Your skin is still healing after it looks healed"] },
};

/** Every season's slates, in order. A channel's seasons follow one another with no gap. */
const SEASONS = [SLATES, SEASON2, SEASON3];

/** Every season of a channel, with its season number and the folder number of its first episode (ep01, ep07, ep13, …):
 *  each season starts right after the previous one's last folder, so a new season needs only its slate. */
export function seasonsFor(slug: string): { season: number; first: number; slate: Slate }[] {
  const out: { season: number; first: number; slate: Slate }[] = [];
  let first = 1;
  for (const [i, slates] of SEASONS.entries()) {
    const slate = slates[slug];
    if (!slate) break;   // no season after a gap: its folder numbers couldn't be known
    out.push({ season: i + 1, first, slate });
    first += slate.titles.length;
  }
  return out;
}

/** The season slate and the 1-based place in it for an episode folder number (ep09 → season 2, episode 3). */
export function slateForEpisode(slug: string, folderNumber: number) {
  const s = seasonsFor(slug).filter((x) => folderNumber >= x.first && folderNumber < x.first + x.slate.titles.length).at(-1);
  return s ? { ...s, order: folderNumber - s.first + 1 } : null;
}

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

/** Everything the metadata engine needs, from an episode folder and its channel (with out/packaging.json's winner title). */
export function metaInputFor(dir: string, ch: { name: string; label: string; tagline: string; topic: Topic }, ep: MetaInput["episode"]): MetaInput {
  const info = scriptInfo(dir);
  const pkg = readPackagingFile(path.join(dir, "out", "packaging.json")).packaging;
  const claimsPath = path.join(dir, "claims.json");
  const claims: { id: string; claim: string; source_title?: string; source_url?: string }[] = fs.existsSync(claimsPath) ? JSON.parse(fs.readFileSync(claimsPath, "utf8")) : [];
  return {
    channel: ch, episode: ep,
    beats: (info?.beats ?? []).filter((b) => b.vo).map((b) => ({ beat: b.beat, vo: b.vo! })),
    sources: claims.map((c) => ({ key: c.id, claim: c.claim, title: c.source_title, publisher: (() => { try { return new URL(c.source_url ?? "").hostname.replace(/^www\./, ""); } catch { return c.source_title ?? ""; } })(), url: c.source_url })),
    disclosures: episodeDisclosures(dir),   // film.json disclosures.aiVoice / aiVisuals (src/domain/disclosures.ts)
    next: info?.next ? `Next: ${info.next}` : null,
    packagingTitle: packagingTitle(pkg),
  };
}

export async function importEpisodes(d = db()) {
  const report: string[] = [];
  const archive = await seasonArchive(d);   // the uploaded seasons as they stand before this import
  for (const slug of Object.keys(SLATES)) for (const { season: seasonNo, first, slate } of seasonsFor(slug)) {
    const [ch] = await d.select().from(S.channels).where(eq(S.channels.slug, slug));
    if (!ch?.filmsPath) continue;
    // archived: never imported, so a stray push can't bring it back (its rows stay exactly as they are)
    if (isArchived(ch)) { if (first === 1) report.push(`${slug}: archived, skipped`); continue; }
    // a later season is created only once its first episode folder exists, so plans don't show up as empty seasons
    if (first > 1 && !fs.existsSync(path.join(ROOT, ch.filmsPath, `ep${String(first).padStart(2, "0")}`))) continue;
    let [se] = await d.select().from(S.series).where(and(eq(S.series.channelId, ch.id), eq(S.series.title, slate.series)));
    if (!se) [se] = await d.insert(S.series).values({ channelId: ch.id, title: slate.series, objective: slate.objective, audience: ch.editorial.audience, status: "active" }).returning();
    await d.insert(S.seasons).values({ seriesId: se.id, number: seasonNo, title: `Season ${seasonNo}` }).onConflictDoNothing();
    const season = await d.select().from(S.seasons).where(and(eq(S.seasons.seriesId, se.id), eq(S.seasons.number, seasonNo)));
    for (const [i, title] of slate.titles.entries()) {
      const order = i + 1, n = first + i, dir = path.join(ROOT, ch.filmsPath, `ep${String(n).padStart(2, "0")}`);
      const exists = fs.existsSync(dir), info = exists ? scriptInfo(dir) : null;
      const film = exists && fs.existsSync(path.join(dir, "film.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "film.json"), "utf8")) : null;
      const out = exists && fs.existsSync(path.join(dir, "out")) ? fs.readdirSync(path.join(dir, "out")).find((f) => /-9x16\.mp4$/.test(f)) : undefined;
      const state = out ? "ready_for_review" : info ? "script" : "idea";
      let [ep] = await d.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, n)));
      if (!ep) ep = await createEpisode(d, { channelId: ch.id, title, seriesId: se.id, seriesOrder: order, number: n, state, filmsPath: exists ? rel(dir) : null });
      // the hook line: up to its question mark when it asks one, else its first sentence as it is (a statement stays one)
      const question = hookQuestion(info?.vo[0] ?? "") || ep.question;
      // the title and thumbnail package: stored when the file is usable; a bad file is reported and the stored one kept
      const pkg = exists ? readPackagingFile(path.join(dir, "out", "packaging.json")) : {};
      if (pkg.problem) report.push(`${slug} ep${n}: ${pkg.problem}; kept what was there`);
      const pkgTitle = packagingTitle(pkg.packaging ?? ep.packaging), pkgTitleChanged = !!pkgTitle && pkgTitle !== packagingTitle(ep.packaging);
      // a video erased from the server after posting (src/domain/media-cleanup.ts): its .mp4 is missing on purpose
      const cleared = !!ep.videoClearedAt;
      const advance = !cleared && ["idea", "research", "outline", "script"].includes(ep.state) ? state : ep.state;   // never move an episode backwards
      await d.update(S.episodes).set({
        title: film?.title?.title ? plain(film.title.title) : title, question, seasonId: season[0].id, seriesId: se.id, seriesOrder: order,
        script: info ? info.vo.join("\n\n") : ep.script, storyboard: info ? info.beats : ep.storyboard, durationS: film?.dur ?? ep.durationS,
        captionsSrt: film?.captions ? captionsToSrt(film.captions) : ep.captionsSrt,
        filmsPath: exists ? rel(dir) : ep.filmsPath, state: advance as typeof ep.state, updatedAt: new Date(),
        ...(pkg.packaging ? { packaging: pkg.packaging } : {}),
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
      // cleared: the missing .mp4 is expected, not an error; its version, exports and publications stay exactly as they are
      if (cleared) { report.push(`${slug} ep${n}: video cleared after posting (records kept)`); continue; }
      // an uploaded season: every post is up, so a re-render or new text never touches its render or posts
      if (archive.episodeIds.has(ep.id)) { report.push(`${slug} ep${n}: season uploaded and archived (records kept)`); continue; }
      if (!out) { report.push(`${slug} ep${n}: ${state}`); continue; }
      const file = path.join(dir, "out", out), hash = sha256File(file);
      const existing = await d.select().from(S.versions).where(and(eq(S.versions.episodeId, ep.id), eq(S.versions.sha256, hash)));
      let ver = existing[0];
      if (!ver) {
        const qaPath = path.join(dir, "build", "qa-delivery.json");
        ver = await addVersion(d, { episodeId: ep.id, videoPath: `films:${rel(file)}`, sha256: hash, posterPath: `films:${rel(file.replace(/\.mp4$/, ".jpg"))}`,
          width: 1080, height: 1920, durationS: film?.dur, label: "final", qa: fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, "utf8")) : {} });
      }
      const input = metaInputFor(dir, { name: ch.name, label: ch.label, tagline: ch.tagline, topic: ch.topic as Topic },
        { number: n, title: film?.title?.title ? plain(film.title.title) : title, durationS: film?.dur, seriesTitle: slate.series, seriesOrder: order, seriesTotal: slate.titles.length, season: seasonNo });
      const meta = buildMetadata({ ...input, packagingTitle: pkgTitle });
      // a new or changed winner title reaches an existing YouTube export too (its approval lapses, as on any edit), unless
      // the episode is already on YouTube; the same packaging again leaves the owner's own edits alone
      const onYouTube = pkgTitleChanged && (await d.select({ id: S.publications.id }).from(S.publications)
        .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId))
        .where(and(eq(S.publications.episodeId, ep.id), eq(S.destinations.platform, "youtube"), inArray(S.publications.status, ["owner_reported", "scheduled_on_platform", "verified_published"])))).length > 0;
      // the designed 9:16 cover (npm run covers) when it is newer than this render (the covers script's own rule), else
      // the film's poster: a cover drawn from an earlier render never rides on a re-rendered video
      const coverFile = file.replace(/-9x16\.mp4$/, "-cover.jpg");
      const coverFresh = fs.existsSync(coverFile) && fs.statSync(coverFile).mtimeMs > fs.statSync(file).mtimeMs;
      const coverPath = `films:${rel(coverFresh ? coverFile : file.replace(/\.mp4$/, ".jpg"))}`;
      // YouTube gets the 1440p version (kits/cinema/film/youtube1440.py) when it is at least as new as this render;
      // TikTok and Instagram stop at 1080×1920, so they get the master
      const ytFile = file.replace(/-9x16\.mp4$/, "-9x16-youtube.mp4");
      const yt = fs.existsSync(ytFile) && fs.statSync(ytFile).mtimeMs >= fs.statSync(file).mtimeMs ? { file: ytFile, hash: sha256File(ytFile) } : null;
      for (const platform of ["youtube", "tiktok", "instagram"] as const) {
        const m = meta[platform];
        const use = platform === "youtube" && yt ? yt : { file, hash };
        const x = await upsertExport(d, { versionId: ver.id, platform, filePath: `films:${rel(use.file)}`, fileSha256: use.hash,
          title: m.title, caption: m.caption, hashtags: m.hashtags, coverPath,
          disclosures: { ...input.disclosures, notes: disclosureNotes(input.disclosures) },
          postingNotes: postingNotesFor(m) });
        if (x.coverPath !== coverPath) await editExport(d, x.id, { coverPath });   // an existing export: approvals bound to the old cover are withdrawn
        if (platform === "youtube" && pkgTitleChanged && x.title !== m.title) {
          if (onYouTube) report.push(`${slug} ep${n}: packaging title not applied (already on YouTube)`);
          else await editExport(d, x.id, { title: m.title });
        }
      }
      // planned publications for this channel's YouTube and TikTok (Instagram picks from the backlog separately)
      const dests = await d.select().from(S.destinations).where(eq(S.destinations.channelId, ch.id));
      for (const dest of dests) {
        const [x] = await d.select().from(S.platformExports).where(and(eq(S.platformExports.versionId, ver.id), eq(S.platformExports.platform, dest.platform)));
        await d.insert(S.publications).values({ episodeId: ep.id, destinationId: dest.id, exportId: x.id, kind: "short", status: "planned" })
          .onConflictDoUpdate({ target: [S.publications.episodeId, S.publications.destinationId], set: { exportId: x.id, updatedAt: new Date() } });
      }
      report.push(`${slug} ep${n}: version ${ver.versionNo} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB), 3 exports${yt ? ", YouTube 1440p" : ""}${pkgTitle ? ", packaging title" : ""}`);
    }
  }
  // long videos last, so the episodes their chapters name are already here to link
  const comp = await importCompilations(d);
  report.push(...comp.report);
  if (comp.failed.length) throw new Error(`episodes imported; ${comp.failed.length} long video(s) not registered: ${comp.failed.join("; ")}`);
  return report;
}

const sha256Stream = (f: string) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  fs.createReadStream(f).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
});
const FOLDER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** A compilation folder's long video: <name>-16x9.mp4, else its first other *-16x9.mp4 (never a .part upload). */
export function compilationVideo(dir: string, name: string): string | null {
  const files = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && FOLDER.test(e.name) && /-16x9\.mp4$/.test(e.name)).map((e) => e.name).sort();
  return files.includes(`${name}-16x9.mp4`) ? `${name}-16x9.mp4` : files[0] ?? null;
}

/** Register each active channel's pushed long videos (films/channels/<ch>/compilations/<name>/) as lessons. Only the
 *  video is required; a missing thumbnail, chapters, description or QA (or an unreadable qa.json) is left empty. One
 *  folder that fails doesn't stop the others; the failures are returned. An archived channel's folders are never read. */
export async function importCompilations(d = db()) {
  const report: string[] = [], failed: string[] = [];
  for (const ch of await activeChannels(d)) {
    const base = ch.filmsPath ? path.join(ROOT, ch.filmsPath, "compilations") : "";
    if (!base || !fs.existsSync(base)) continue;
    const folders = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory() && FOLDER.test(e.name)).map((e) => e.name).sort();
    for (const name of folders) {
      const dir = path.join(base, name), where = `${ch.slug} compilations/${name}`;
      try {
        const video = compilationVideo(dir, name);
        if (!video) { report.push(`${where}: no *-16x9.mp4 yet`); continue; }
        const text = (f: string) => { try { return fs.readFileSync(path.join(dir, f), "utf8"); } catch { return ""; } };
        let qa: Record<string, unknown> = {};
        try { const j = JSON.parse(text("qa.json") || "{}"); if (j && typeof j === "object" && !Array.isArray(j)) qa = j; } catch { /* unreadable: "QA not attached" */ }
        const pkg = readPackagingFile(path.join(dir, "packaging.json"));
        if (pkg.problem) report.push(`${where}: ${pkg.problem}; kept what was there`);
        const r = await registerCompilation(d, ch.id, name, {
          videoPath: `films:${rel(path.join(dir, video))}`, videoSha256: await sha256Stream(path.join(dir, video)),
          thumbnailPath: fs.existsSync(path.join(dir, "thumbnail.jpg")) ? `films:${rel(path.join(dir, "thumbnail.jpg"))}` : "",
          chapters: text("chapters.txt"), description: text("description.md"), qa, packaging: pkg.packaging,
        });
        report.push(`${where}: ${r.action} "${r.lesson.title}"${r.linked ? `, ${r.linked} episodes linked` : ""}${r.notes?.length ? `; ${r.notes.join("; ")}` : ""}`);
      } catch (e) {
        failed.push(`${where}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { report, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const line of await importEpisodes()) console.log(line);
  await pool().end();
}
