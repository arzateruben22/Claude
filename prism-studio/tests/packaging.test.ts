// Packaging (src/domain/packaging.ts, films/channels/PACKAGING.md): packaging.json is read forgivingly, stored on the
// episode or lesson by the importer (a bad file never fails an import), and its winner title is the YouTube title
// exactly. TikTok and Instagram keep their captions (#fyp first), and nothing is marked uploaded.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { packagingTitle, pairingsView, parsePackaging, readPackagingFile } from "../src/domain/packaging";
import { buildMetadata, FYP_TAG, type MetaInput } from "../src/domain/metadata";
import { pushPath } from "../src/domain/media-push";
import { approve, currentApproval } from "../src/domain/approvals";
import { editExport } from "../src/domain/episodes";
import { markUploaded } from "../src/domain/publications";
import { regenerateExports } from "../src/domain/exports";
import { editLesson, approveLesson, lessonHash } from "../src/domain/lessons";

/** A packaging.json as the builders write it (with the extra fields the real drafts carry: channel, video, notes). */
const draft = (winner = "What If Earth Spun Faster and Couldn't Stop?") => ({
  version: 1, format: "short", channel: "Possibility Lab", video: "ep01", hook: "Shorten the day and you float.",
  titles: [
    { text: winner, mechanism: "unexpected consequence" },
    { text: "At 84 Minutes a Day, You'd Weigh Nothing", mechanism: "scale shock" },
    { text: "Spin Earth Faster and the Poles Run Dry", mechanism: "contradiction" },
    { text: "How Fast Is the Earth Spinning You Right Now?", mechanism: "personal relevance" },
    { text: "How Short Can a Day Get Before You Float?", mechanism: "unanswered question" },
  ],
  thumbnails: [
    { id: "A", subject: "a person floating above a beach", composition: "left third", lighting: "dawn streak", trigger: "visual paradox", text: "84-MINUTE DAY", complements: "the number" },
    { id: "B", subject: "the Earth with dry poles", composition: "centred-left", lighting: "hard sun", trigger: "scale shock", text: "POLES: DRY", complements: "a second consequence" },
    { id: "C", subject: "fanned shadows at noon", composition: "high view", lighting: "noon blur", trigger: "hidden mechanism", text: "", complements: "silent" },
  ],
  pairings: [
    { title: 0, thumbnail: "A", scores: { scroll: 88, curiosity: 90, clarity: 86, synergy: 90, originality: 80, accuracy: 92, mobile: 86, satisfaction: 92 }, note: "premise in the title" },
    { title: 4, thumbnail: "B", scores: { scroll: 84, curiosity: 85, clarity: 74, synergy: 70, originality: 86, accuracy: 84, mobile: 72, satisfaction: 85 }, note: "two hooks" },
    { title: 1, thumbnail: "C", scores: { scroll: 78, curiosity: 82, clarity: 76, synergy: 80, originality: 84, accuracy: 90, mobile: 74, satisfaction: 88 }, note: "accurate" },
  ],
  winner: { title: winner, thumbnail: "A", thumbnailText: "84-MINUTE DAY", why: "The picture jumps to the most impossible moment." },
  testAndCompare: ["A", "B", "C"],
  checks: { halfSecond: true, curiosity: true, duplication: true, competition: true, truth: true, satisfaction: true, originality: true },
  notes: "Truth: the figure floats only slightly.",
  thumbnailFile: "earth-spin-thumb.jpg",
  chatgptPrompt: "Create a YouTube thumbnail, 9:16 (1080x1920).\nSubject: one person floating above a beach.",
  shortsCover: { frameSeconds: null, text: "84-MINUTE DAY", note: "use the floating moment" },
});

describe("reading packaging.json", () => {
  it("keeps the known fields of a real draft and ignores the extra ones", () => {
    const p = parsePackaging(draft())!;
    expect(p.winner).toEqual({ title: "What If Earth Spun Faster and Couldn't Stop?", thumbnail: "A", thumbnailText: "84-MINUTE DAY", why: "The picture jumps to the most impossible moment." });
    expect(p.titles).toHaveLength(5);
    expect(p.thumbnails.map((t) => t.id)).toEqual(["A", "B", "C"]);
    expect(p.pairings[0].scores.curiosity).toBe(90);
    expect(p.testAndCompare).toEqual(["A", "B", "C"]);
    expect(p.shortsCover).toEqual({ frameSeconds: null, text: "84-MINUTE DAY" });
    expect(p.chatgptPrompt).toMatch(/^Create a YouTube thumbnail/);
    expect(p).not.toHaveProperty("channel");
    expect(p).not.toHaveProperty("notes");
    expect(packagingTitle(p)).toBe("What If Earth Spun Faster and Couldn't Stop?");
  });

  it("tolerates missing and malformed fields one by one, never failing the whole file", () => {
    const p = parsePackaging({
      winner: { title: "  The Moon Starts Coming Closer. It Won't Stop.  " },
      titles: [{ text: "ok", mechanism: 7 }, { mechanism: "no text" }, "not an object"],
      pairings: [{ title: "zero", thumbnail: "A", scores: { scroll: 500, curiosity: "high", clarity: 70 } }],
      checks: { truth: false, halfSecond: "yes" },
      thumbnailFile: "../../secret.jpg",
      format: "vertical",
      shortsCover: { frameSeconds: -1 },
    })!;
    expect(p.winner?.title).toBe("The Moon Starts Coming Closer. It Won't Stop.");
    expect(p.titles).toEqual([{ text: "ok", mechanism: "" }]);
    expect(p.pairings[0]).toMatchObject({ title: null, thumbnail: "A" });
    expect(p.pairings[0].scores).toMatchObject({ scroll: null, curiosity: null, clarity: 70, mobile: null });
    expect(p.checks).toEqual({ truth: false });
    expect(p.thumbnailFile).toBe("");   // a path is never taken
    expect(p.format).toBeNull();
    expect(p.shortsCover).toEqual({ frameSeconds: null, text: "" });
    expect(p.thumbnails).toEqual([]);
    expect(p.chatgptPrompt).toBe("");
  });

  it("is null for anything that isn't a packaging", () => {
    for (const raw of [null, 3, "x", [], {}, { hook: "only a hook" }, { winner: {} }]) expect(parsePackaging(raw)).toBeNull();
  });

  it("never uses a winner title longer than YouTube's 100 characters", () => {
    const long = "W".repeat(101);
    const p = parsePackaging({ ...draft(), winner: { title: long } })!;
    expect(p.winner?.title).toBe(long);   // kept for the screen
    expect(packagingTitle(p)).toBeNull();
  });

  it("reads a file forgivingly", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pack-read-"));
    try {
      expect(readPackagingFile(path.join(dir, "packaging.json"))).toEqual({});
      fs.writeFileSync(path.join(dir, "packaging.json"), "{ not json");
      expect(readPackagingFile(path.join(dir, "packaging.json")).problem).toMatch(/not JSON/);
      fs.writeFileSync(path.join(dir, "packaging.json"), JSON.stringify({ hook: "x" }));
      expect(readPackagingFile(path.join(dir, "packaging.json")).problem).toMatch(/no winner title/);
      fs.writeFileSync(path.join(dir, "packaging.json"), JSON.stringify(draft()));
      expect(readPackagingFile(path.join(dir, "packaging.json")).packaging?.winner?.thumbnail).toBe("A");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it("pairs each scored pairing with its title and thumbnail concept, the winner marked", () => {
    const v = pairingsView(parsePackaging(draft())!);
    expect(v.map((x) => [x.title.slice(0, 12), x.thumbnail, x.winner])).toEqual([["What If Eart", "A", true], ["How Short Ca", "B", false], ["At 84 Minute", "C", false]]);
    expect(v[0].scores.map((s) => s.axis)).toEqual(["scroll", "curiosity", "clarity", "synergy", "originality", "accuracy", "mobile", "satisfaction"]);
    expect(v[1].concept?.subject).toBe("the Earth with dry poles");
  });

  it("media push accepts packaging.json and the rendered thumbnail for episodes and long videos", () => {
    expect(pushPath("films/channels/physics/ep07/out/packaging.json")).not.toBeNull();
    expect(pushPath("films/channels/physics/ep07/out/the-slinky-thumb.jpg")).not.toBeNull();
    expect(pushPath("films/channels/whatif/compilations/earth-spin/packaging.json")).not.toBeNull();
    expect(pushPath("films/channels/whatif/compilations/earth-spin/earth-spin-thumb-16x9.jpg")).not.toBeNull();
    expect(pushPath("films/channels/physics/ep07/packaging.json")).toBeNull();   // only out/ in an episode folder
  });
});

describe("the YouTube title", () => {
  const input: MetaInput = {
    channel: { name: "Possibility Lab", label: "WHAT IF?", tagline: "Impossible questions, honest assumptions, real calculations.", topic: "whatif" },
    episode: { number: 7, title: "Walking to the Moon", seriesTitle: "Season 2: Even more impossible", seriesOrder: 1, seriesTotal: 6, season: 2 },
    beats: [{ beat: "hook", vo: "What if you walked to the Moon?" }, { beat: "takeaway", vo: "It would take nine years. {c1}" }],
    sources: [{ key: "c1", claim: "The Moon is 384,400 km away", url: "https://science.nasa.gov/moon/" }],
    disclosures: { aiVoice: true, aiVisuals: false },
  };
  it("without packaging: the episode title with the channel and its number, as before", () => {
    expect(buildMetadata(input).youtube.title).toBe("Walking to the Moon | Possibility Lab S2 · Ep 1");
  });
  it("with packaging: exactly the winner title, no suffix; the series line stays in the description", () => {
    const plain = buildMetadata(input), m = buildMetadata({ ...input, packagingTitle: "Walk to the Moon? Pack for Nine Years" });
    expect(m.youtube.title).toBe("Walk to the Moon? Pack for Nine Years");
    expect(m.youtube.caption).toContain("Series: Season 2: Even more impossible, part 1 of 6.");
    expect(m.youtube.caption).toBe(plain.youtube.caption);
    // TikTok and Instagram are untouched: same captions, #fyp first
    for (const p of ["tiktok", "instagram"] as const) {
      expect(m[p]).toEqual(plain[p]);
      expect(m[p].hashtags.split(" ")[0]).toBe(FYP_TAG);
    }
  });
  it("an empty packaging title falls back", () => {
    expect(buildMetadata({ ...input, packagingTitle: "  " }).youtube.title).toBe("Walking to the Moon | Possibility Lab S2 · Ep 1");
  });
});

// ── the importer ──────────────────────────────────────────────────────────────────────────────────────────────────
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "pack-import-"));
const EP = "films/channels/physics/ep01", COMP = "films/channels/physics/compilations/vol01";
const write = (rel: string, body: string) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
write(`${EP}/film.json`, JSON.stringify({ dur: 30 }));
write(`${EP}/out/thrown-9x16.mp4`, "physics master");
write(`${EP}/out/thrown-9x16.jpg`, "poster");
write(`${COMP}/vol01-16x9.mp4`, "physics long video");
write(`${COMP}/description.md`, "Forces you can see\n\nChapters…");

let db: DB, end: () => Promise<void>;
let importEpisodes: (d: DB) => Promise<string[]>;
beforeAll(async () => {
  ({ db, end } = await freshDb());
  process.env.FILMS_REPO_ROOT = ROOT;
  ({ importEpisodes } = await import("../scripts/import-episodes"));
});
afterAll(async () => { await end(); fs.rmSync(ROOT, { recursive: true, force: true }); });

const episode = async () => {
  const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
  const [e] = await db.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, 1)));
  const [v] = await db.select().from(S.versions).where(eq(S.versions.episodeId, e.id));
  const xs = await db.select().from(S.platformExports).where(eq(S.platformExports.versionId, v.id));
  const pubs = await db.select().from(S.publications).where(eq(S.publications.episodeId, e.id));
  return { e, x: (p: string) => xs.find((x) => x.platform === p)!, pubs };
};
const lesson = async () => (await db.select().from(S.lessons).where(eq(S.lessons.name, "vol01")))[0];

describe("importing packaging", () => {
  it("an episode without packaging.json keeps today's title", async () => {
    await importEpisodes(db);
    const { e, x } = await episode();
    expect(e.packaging).toBeNull();
    expect(x("youtube").title).toMatch(/ \| Reality Rulebook No\. 001$/);
    expect((await lesson()).title).toBe("Forces you can see");
  });

  it("stores the packaging and makes the winner the YouTube title, approvals lapsing, nothing marked uploaded", async () => {
    const before = await episode();
    await approve(db, { exportId: before.x("youtube").id, destinationId: before.pubs.find((p) => p.exportId === before.x("youtube").id)!.destinationId });
    write(`${EP}/out/packaging.json`, JSON.stringify(draft("Thrown or Dropped? They Land Together")));
    const report = await importEpisodes(db);
    expect(report.find((l) => l.startsWith("physics ep1:"))).toMatch(/packaging title/);
    const { e, x, pubs } = await episode();
    expect(e.packaging?.winner?.title).toBe("Thrown or Dropped? They Land Together");
    expect(x("youtube").title).toBe("Thrown or Dropped? They Land Together");
    expect(x("tiktok").hashtags.split(" ")[0]).toBe(FYP_TAG);
    expect(x("tiktok").title).not.toBe("Thrown or Dropped? They Land Together");   // TikTok's label stays the episode's
    expect(await currentApproval(db, x("youtube").id, pubs.find((p) => p.exportId === x("youtube").id)!.destinationId)).toBeNull();
    expect(pubs.every((p) => p.status === "planned" && !p.reportedAt)).toBe(true);
  });

  it("the same packaging again leaves the owner's own title edit alone; a new winner replaces it", async () => {
    await editExport(db, (await episode()).x("youtube").id, { title: "My own title" });
    await importEpisodes(db);
    expect((await episode()).x("youtube").title).toBe("My own title");
    write(`${EP}/out/packaging.json`, JSON.stringify(draft("Drop It or Throw It: Same Landing")));
    await importEpisodes(db);
    expect((await episode()).x("youtube").title).toBe("Drop It or Throw It: Same Landing");
    // regenerating the text from the database keeps the winner title too
    await regenerateExports(db, (await episode()).e.id);
    expect((await episode()).x("youtube").title).toBe("Drop It or Throw It: Same Landing");
  });

  it("a broken packaging.json never fails the import and keeps what was stored", async () => {
    write(`${EP}/out/packaging.json`, "{ half written");
    const report = await importEpisodes(db);
    expect(report.some((l) => /physics ep1: packaging\.json unreadable/.test(l))).toBe(true);
    const { e, x } = await episode();
    expect(e.packaging?.winner?.title).toBe("Drop It or Throw It: Same Landing");
    expect(x("youtube").title).toBe("Drop It or Throw It: Same Landing");
  });

  it("a post already on YouTube keeps the title it went up with", async () => {
    const { x, pubs } = await episode();
    await markUploaded(db, pubs.find((p) => p.exportId === x("youtube").id)!.id, {});
    write(`${EP}/out/packaging.json`, JSON.stringify(draft("A Third Winner After Posting")));
    const report = await importEpisodes(db);
    expect(report).toContain("physics ep1: packaging title not applied (already on YouTube)");
    const after = await episode();
    expect(after.x("youtube").title).toBe("Drop It or Throw It: Same Landing");
    expect(after.e.packaging?.winner?.title).toBe("A Third Winner After Posting");   // the record still updates
  });

  it("a long video's packaging is stored and its winner becomes the title; the owner's later edit stays", async () => {
    write(`${COMP}/packaging.json`, JSON.stringify({ ...draft("Six Everyday Things Physics Can't Fake"), format: "long", thumbnailFile: "vol01-thumb.jpg" }));
    await approveLesson(db, (await lesson()).id);
    await importEpisodes(db);
    let l = await lesson();
    expect(l.packaging?.format).toBe("long");
    expect(l.title).toBe("Six Everyday Things Physics Can't Fake");
    expect(l.approvedHash).toBe("");   // the title changed: approve again
    expect(l.state).toBe("ready_for_review");
    await editLesson(db, l.id, { title: "The owner's title" });
    await approveLesson(db, l.id);
    await importEpisodes(db);
    l = await lesson();
    expect(l.title).toBe("The owner's title");
    expect(l.approvedHash).toBe(lessonHash(l));   // untouched: still approved
    expect(l.state).not.toBe("published");
  });
});
