import { describe, expect, it } from "vitest";
import { buildMetadata, captionBody, clean, composePostText, cut, LIMITS, parsePostingNotes, postingSheet, type MetaInput } from "../src/domain/metadata";

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
  it("long titles and many sources are cut with a warning, never silently", () => {
    const long = { ...input, episode: { ...input.episode, title: "A".repeat(120) }, sources: Array.from({ length: 80 }, (_, k) => ({ key: `c${k}`, claim: "claim ".repeat(20), publisher: `Publisher ${k}`, url: `https://pub${k}.example.org/${k}` })) };
    const m = buildMetadata(long);
    expect(m.youtube.title.length).toBeLessThanOrEqual(100);
    expect(m.youtube.warnings).toContain("title cut to 100 characters");
    expect(m.youtube.caption.length).toBeLessThanOrEqual(5000);
    expect(m.youtube.caption.trim().endsWith("#Shorts #physics #science")).toBe(true);
    expect(m.tiktok.pinnedComment.length).toBeLessThanOrEqual(150);
    expect(m.tiktok.warnings[0]).toMatch(/pinned comment shortened/);
  });
  it("missing hook or sources are warned about", () => {
    const m = buildMetadata({ ...input, beats: [], sources: [] });
    expect(m.youtube.warnings).toEqual(expect.arrayContaining(["no hook line found in the script", "no sources recorded"]));
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
