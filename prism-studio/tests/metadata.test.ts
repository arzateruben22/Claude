import { describe, expect, it } from "vitest";
import { buildMetadata, captionBody, clean, composePostText, cut, handOffText, LIMITS, parsePostingNotes, postingNotesFor, postingSheet, sourcesThread, type MetaInput } from "../src/domain/metadata";

const input: MetaInput = {
  channel: { name: "Rest Frame", label: "PHYSICS", tagline: "Everyday things, slowed down until the physics shows.", topic: "physics" },
  episode: { number: 1, title: "Thrown or dropped?", durationS: 74.9, seriesTitle: "Season 1: Forces you can see", seriesOrder: 1, seriesTotal: 6 },
  beats: [
    { beat: "hook", vo: "Which ball lands *first*? One thrown sideways, one just dropped. {-}" },
    { beat: "normal", vo: "First, just the drop, slowed twenty times. {-} Ghosts every twentieth of a second, and the gaps keep *growing*. {c1}" },
    { beat: "why", vo: "Gravity pulls only *down*, so at every tick, both sit at the *same height*. {c13}" },
    { beat: "takeaway", vo: "Speed decides where a ball lands. Height alone decides when. {c2} That holds even for a bullet fired level. {c14}" },
    { beat: "tease", vo: "Next: one pendulum, big swing against small. It's *almost* a tie. {-}" },
  ],
  sources: [
    { key: "c1", claim: "A falling body's speed grows steadily", publisher: "openstax.org", url: "https://openstax.org/books/college-physics-2e/pages/2-7-falling-objects" },
    { key: "c2", claim: "Horizontal and vertical motions are independent", publisher: "openstax.org", url: "https://openstax.org/books/college-physics-2e/pages/3-4-projectile-motion" },
    { key: "c13", claim: "Galileo's two-motion analysis", publisher: "IOP Spark", url: "https://spark.iop.org/projectiles" },
  ],
  disclosures: { aiVoice: true, aiVisuals: false },
  next: "Next: the swing's secret",
};

describe("metadata", () => {
  it("strips the script's markup", () => {
    expect(clean("Which ball lands *first*? {-} Both {c1,c2} sit at the *same height* .")).toBe("Which ball lands first? Both sit at the same height.");
  });
  it("cuts at a word boundary", () => {
    expect(cut("one two three four five", 12)).toBe("one two…");
    expect(cut("short", 12)).toBe("short");
  });
  it("is deterministic and within every platform limit", () => {
    const a = buildMetadata(input), b = buildMetadata(input);
    expect(a).toEqual(b);
    expect(a.youtube.title).toBe("Thrown or dropped? | Rest Frame No. 001");
    expect(a.youtube.title.length).toBeLessThanOrEqual(LIMITS.youtube.title);
    expect(a.youtube.caption.length).toBeLessThanOrEqual(LIMITS.youtube.description);
    expect(a.youtube.tags.join(",").length).toBeLessThanOrEqual(LIMITS.youtube.tags);
    expect(a.tiktok.caption.length).toBeLessThanOrEqual(LIMITS.tiktok.captionTarget + 20);
    expect(a.tiktok.pinnedComment.length).toBeLessThanOrEqual(LIMITS.tiktok.comment);
    expect(a.instagram.caption.length).toBeLessThanOrEqual(LIMITS.instagram.caption);
    expect(a.instagram.hashtags.split(" ").length).toBeLessThanOrEqual(LIMITS.instagram.hashtags);
    expect(a.youtube.warnings).toEqual([]); expect(a.tiktok.warnings).toEqual([]); expect(a.instagram.warnings).toEqual([]);
  });
  it("YouTube description: hook, why + takeaway, series and next, numbered sources, AI label, hashtags last", () => {
    const d = buildMetadata(input).youtube.caption;
    expect(d.startsWith("Which ball lands first? One thrown sideways, one just dropped.")).toBe(true);
    expect(d).toContain("Series: Season 1: Forces you can see, part 1 of 6. Next: the swing's secret");
    expect(d).toContain("Sources\n1. A falling body's speed grows steadily — OpenStax: https://openstax.org/books/college-physics-2e/pages/2-7-falling-objects");
    expect(d).toContain("3. Galileo's two-motion analysis — IOP Spark");
    expect(d).toContain("Narration: synthetic voice (AI)");
    expect(d.trim().endsWith("#Shorts #physics #science")).toBe(true);
    expect(d).not.toContain("*"); expect(d).not.toContain("{c");
  });
  it("TikTok: the question, one takeaway sentence, five hashtags; sources in a 150-character comment", () => {
    const t = buildMetadata(input).tiktok;
    expect(t.caption).toBe("Which ball lands first? Speed decides where a ball lands. #physics #science #learnontiktok #stem #slowmotion");
    expect(t.pinnedComment).toBe("Sources: OpenStax; IOP Spark. Synthetic (AI) voice; code-rendered animation.");
  });
  it("Instagram: hook, a line of why/takeaway, 'sources in the first comment', hashtags after a gap; the comment lists sources", () => {
    const i = buildMetadata(input).instagram;
    expect(i.caption).toContain("Which ball lands first?");
    expect(i.caption).toContain("Sources in the first comment. Synthetic (AI) narration; code-rendered animation.");
    expect(i.caption.endsWith("\n\n#physics #science #stem #sciencefacts #learnsomethingnew #slowmotion #education #physicsfun")).toBe(true);
    expect(i.pinnedComment.startsWith("Sources\n1. ")).toBe(true);
  });
  it("long titles are cut with a warning, never silently; many sources become a thread, not a cut", () => {
    const long = { ...input, episode: { ...input.episode, title: "A".repeat(120) }, sources: Array.from({ length: 80 }, (_, k) => ({ key: `c${k}`, claim: "claim ".repeat(20), publisher: `Publisher ${k}`, url: `https://pub${k}.example.org/${k}` })) };
    const m = buildMetadata(long);
    expect(m.youtube.title.length).toBeLessThanOrEqual(100);
    expect(m.youtube.warnings).toContain("title cut to 100 characters");
    expect(m.youtube.caption.length).toBeLessThanOrEqual(5000);
    expect(m.youtube.caption.trim().endsWith("#Shorts #physics #science")).toBe(true);
    for (const p of ["youtube", "tiktok", "instagram"] as const) {
      const thread = [m[p].pinnedComment, ...m[p].replies];
      for (const c of thread) expect(c.length, p).toBeLessThanOrEqual(LIMITS[p].comment);
      expect(m[p].warnings.some((w) => /comment/.test(w)), p).toBe(false);
    }
    expect(m.tiktok.replies.length).toBeGreaterThan(5);
    expect(m.instagram.replies.length).toBeGreaterThan(0);
    expect(m.youtube.replies.length).toBeGreaterThan(0);   // 80 long source lines pass even YouTube's 10,000 characters
  });
  it("missing hook or sources are warned about", () => {
    const m = buildMetadata({ ...input, beats: [], sources: [] });
    expect(m.youtube.warnings).toEqual(expect.arrayContaining(["no hook line found in the script", "no sources recorded"]));
    for (const p of ["youtube", "tiktok", "instagram"] as const) expect([m[p].pinnedComment, m[p].replies], p).toEqual(["", []]);   // no "Sources: ." comment
  });
  it("the posting sheet carries every platform's text", () => {
    const s = postingSheet(input);
    expect(s).toContain("## YouTube Shorts"); expect(s).toContain("## TikTok"); expect(s).toContain("## Instagram Reel");
    expect(s).toContain("Thrown or dropped? | Rest Frame No. 001");
  });
});

describe("the pasted text", () => {
  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  it("carries each platform's hashtags exactly once", () => {
    const m = buildMetadata(input);
    for (const p of ["youtube", "tiktok", "instagram"] as const) {
      const text = composePostText(m[p]);
      expect(count(text, m[p].hashtags), p).toBe(1);
      expect(text.startsWith(captionBody(m[p])), p).toBe(true);
      expect(captionBody(m[p]).includes(m[p].hashtags), p).toBe(false);
    }
  });
  it("adds the hashtags when an edited caption dropped them, and never doubles them", () => {
    expect(composePostText({ caption: "Which lands first?", hashtags: "#physics #stem" })).toBe("Which lands first?\n\n#physics #stem");
    expect(composePostText({ caption: "Which lands first? #physics #stem", hashtags: "#physics #stem" })).toBe("Which lands first? #physics #stem");
    expect(composePostText({ caption: "Plain", hashtags: "" })).toBe("Plain");
  });
  it("splits posting notes into the comment, tags, checks and the label checklist", () => {
    const n = parsePostingNotes("Turn on the platform's AI-generated/synthetic content label. Captions are burned in: leave auto-captions off.\n\nPinned/first comment:\nSources\n1. A — OpenStax: https://openstax.org/x\n2. B — NASA\n\nTags: physics, science\n\nCheck: title cut; no hook\n\nPost after 6pm.");
    expect(n).toMatchObject({ comment: "Sources\n1. A — OpenStax: https://openstax.org/x\n2. B — NASA", tags: "physics, science", checks: ["title cut", "no hook"], aiLabel: true, captionsOff: true, other: ["Post after 6pm."] });
    expect(parsePostingNotes(null)).toMatchObject({ comment: "", other: [] });
  });
});

// ── the sources thread ────────────────────────────────────────────────────────────────────────────────────────────────
const many = (n: number, claim: (k: number) => string, publisher: (k: number) => string) =>
  Array.from({ length: n }, (_, k) => ({ key: `c${k + 1}`, claim: claim(k), publisher: publisher(k), url: `https://www.${publisher(k).toLowerCase().replace(/[^a-z0-9]/g, "")}.org/page/${k + 1}` }));

describe("the sources thread", () => {
  const head = (i: number, n: number) => (n === 1 ? "Sources: " : `Sources ${i}/${n}: `);
  it("keeps everything in one comment when it fits, under the plain heading", () => {
    expect(sourcesThread(["OpenStax", "NASA"], { limit: 150, sep: "; ", head })).toEqual({ comments: ["Sources: OpenStax; NASA"], oversize: [] });
    expect(sourcesThread([], { limit: 150, sep: "; ", head })).toEqual({ comments: [], oversize: [] });
  });
  it("splits only between sources, numbers every comment and loses nothing", () => {
    const items = Array.from({ length: 80 }, (_, k) => `Publisher number ${k + 1}`);
    const t = sourcesThread(items, { limit: 150, sep: "; ", head });
    const n = t.comments.length;
    expect(n).toBeGreaterThanOrEqual(10);   // two-digit counts: "Sources 10/12" is longer, and still fits
    t.comments.forEach((c, i) => { expect(c.length).toBeLessThanOrEqual(150); expect(c.startsWith(`Sources ${i + 1}/${n}: `)).toBe(true); });
    expect(t.comments.flatMap((c, i) => c.slice(`Sources ${i + 1}/${n}: `.length).split("; "))).toEqual(items);
    expect(t.oversize).toEqual([]);
  });
  it("shortens only a source that can't fit a comment on its own, and says which", () => {
    const t = sourcesThread(["Short", "X".repeat(400), "Also short"], { limit: 150, sep: "; ", head });
    expect(t.oversize).toEqual([1]);
    expect(t.comments).toHaveLength(3);
    for (const c of t.comments) expect(c.length).toBeLessThanOrEqual(150);
    expect(t.comments[2]).toBe("Sources 3/3: Also short");
  });

  it("TikTok: publishers in 150-character comments; the first keeps the production note; replies are numbered", () => {
    const m = buildMetadata({ ...input, sources: many(14, (k) => `Claim ${k}`, (k) => `Observatory of Place ${k + 1}`) }).tiktok;
    const thread = [m.pinnedComment, ...m.replies];
    expect(thread.length).toBeGreaterThan(1);
    thread.forEach((c, i) => { expect(c.length).toBeLessThanOrEqual(LIMITS.tiktok.comment); expect(c.startsWith(`Sources ${i + 1}/${thread.length}: `)).toBe(true); });
    expect(m.pinnedComment.endsWith(". Synthetic (AI) voice; code-rendered animation.")).toBe(true);
    expect(m.replies.every((r) => r.endsWith(".") && !r.includes("Synthetic"))).toBe(true);
    for (let k = 1; k <= 14; k++) expect(thread.filter((c) => new RegExp(`\\b(www\\.)?observatoryofplace${k}\\.org\\b`).test(c))).toHaveLength(1);
    expect(m.warnings).toEqual([]);
  });
  it("Instagram: numbered source lines in 2,200-character comments, numbering carried across the thread", () => {
    const m = buildMetadata({ ...input, sources: many(30, (k) => `Claim ${k + 1}: ${"a sourced sentence ".repeat(6)}`, (k) => `Publisher ${k + 1}`) }).instagram;
    const thread = [m.pinnedComment, ...m.replies];
    expect(thread.length).toBeGreaterThan(1);
    thread.forEach((c, i) => { expect(c.length).toBeLessThanOrEqual(LIMITS.instagram.comment); expect(c.split("\n")[0]).toBe(`Sources ${i + 1}/${thread.length}`); });
    const numbers = thread.flatMap((c) => c.split("\n").slice(1).map((l) => Number(/^(\d+)\. /.exec(l)?.[1])));
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, k) => k + 1));
    expect(m.warnings).toEqual([]);
    expect(buildMetadata(input).instagram.replies).toEqual([]);   // three sources: one comment, plain "Sources" heading
  });
  it("warns only when a single source alone is longer than the platform's limit", () => {
    const huge = buildMetadata({ ...input, sources: [...input.sources, { key: "c99", claim: "word ".repeat(700), publisher: "Example", url: "https://example.org/x" }] });
    expect(huge.instagram.warnings).toEqual(["source 4 alone is longer than Instagram's 2,200-character comment: shortened"]);
    for (const c of [huge.instagram.pinnedComment, ...huge.instagram.replies]) expect(c.length).toBeLessThanOrEqual(2200);
    expect(huge.youtube.warnings).toEqual([]);   // 3,500 characters fit one YouTube comment
    expect(huge.tiktok.warnings).toEqual([]);    // TikTok lists the publisher, not the claim
    const longName = buildMetadata({ ...input, sources: [{ key: "c1", claim: "x", title: "T".repeat(200) }] });
    expect(longName.tiktok.warnings).toHaveLength(1);
    expect(longName.tiktok.warnings[0]).toMatch(/alone is longer than TikTok's 150-character comment: shortened$/);
    for (const c of [longName.tiktok.pinnedComment, ...longName.tiktok.replies]) expect(c.length).toBeLessThanOrEqual(150);
  });

  it("posting notes carry each reply as its own block, and read back in order (older notes have none)", () => {
    const m = buildMetadata({ ...input, sources: many(14, (k) => `Claim ${k}`, (k) => `Observatory of Place ${k + 1}`) }).tiktok;
    const notes = parsePostingNotes(postingNotesFor(m));
    expect(notes.comment).toBe(m.pinnedComment);
    expect(notes.replies).toEqual(m.replies);
    expect(notes.aiLabel).toBe(true);
    expect(notes.other).toEqual([]);
    expect(parsePostingNotes("Pinned/first comment:\nSources: A\n\nReply 2:\nSources 3/3: C.\n\nReply 1:\nSources 2/3: B.").replies).toEqual(["Sources 2/3: B.", "Sources 3/3: C."]);
    expect(parsePostingNotes("Pinned/first comment:\nSources: A; B.").replies).toEqual([]);
  });
  it("the posting sheet and posting.json carry the replies; posting.json keeps every earlier field", () => {
    const big = { ...input, sources: many(30, (k) => `Claim ${k + 1}: ${"a sourced sentence ".repeat(6)}`, (k) => `Observatory of Place ${k + 1}`) };
    const m = buildMetadata(big), sheet = postingSheet(big, m);
    expect(sheet).toContain("**Reply 1** (2 of");
    for (const r of [...m.tiktok.replies, ...m.instagram.replies]) expect(sheet).toContain(r);
    const json = JSON.parse(JSON.stringify(m));
    for (const p of ["youtube", "tiktok", "instagram"] as const) {
      expect(Object.keys(json[p])).toEqual(expect.arrayContaining(["title", "caption", "hashtags", "tags", "pinnedComment", "warnings", "replies"]));
      expect(typeof json[p].pinnedComment).toBe("string");
    }
  });
  it("the ZIP's text file: title, caption, account, the comment and each reply in posting order, then the other notes", () => {
    const m = buildMetadata({ ...input, sources: many(14, (k) => `Claim ${k}`, (k) => `Observatory of Place ${k + 1}`) });
    const t = handOffText({ title: m.tiktok.title, caption: m.tiktok.caption, hashtags: m.tiktok.hashtags, postingNotes: `${postingNotesFor(m.tiktok)}\n\nPost after 6pm.` }, "tiktok", "@restframe on tiktok");
    const n = m.tiktok.replies.length + 1;
    expect(t).not.toContain("TITLE");
    const order = ["CAPTION\n", "POST TO\n@restframe on tiktok", `PINNED COMMENT (1 of ${n})\n${m.tiktok.pinnedComment}`, ...m.tiktok.replies.map((r, k) => `REPLY ${k + 1} (${k + 2} of ${n}, under the pinned comment)\n${r}`), "NOTES\n"].map((s) => t.indexOf(s));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const notes = t.slice(t.indexOf("NOTES\n"));
    expect(notes).toContain("Post after 6pm."); expect(notes).not.toContain("Sources");   // the comments aren't repeated in the notes
    const yt = handOffText({ title: m.youtube.title, caption: m.youtube.caption, hashtags: m.youtube.hashtags, postingNotes: postingNotesFor(m.youtube) }, "youtube", "@rf on youtube");
    expect(yt.startsWith(`TITLE\n${m.youtube.title}\n`)).toBe(true);
    expect(yt).toContain("PINNED COMMENT\nSources\n1. ");
    expect(handOffText({ title: "", caption: "Hi", hashtags: "", postingNotes: "" }, "instagram", "@x on instagram")).toBe("CAPTION\nHi\n\nPOST TO\n@x on instagram\n");
  });
});
