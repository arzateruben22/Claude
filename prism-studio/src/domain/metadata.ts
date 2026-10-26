// Posting text for every platform, generated from the episode itself: the script's beats, its sourced claims,
// the series, the channel. Pure and deterministic (the same episode always gives the same text), so a regenerated
// export has the same content hash unless the script or sources changed. Platform limits are enforced and
// anything that had to be cut is reported as a warning, never silently.
export type Topic = "skincare" | "physics" | "body" | "space" | "whatif";
export type Platform = "youtube" | "tiktok" | "instagram";

export interface MetaInput {
  channel: { name: string; label: string; tagline: string; topic: Topic };
  episode: { number: number; title: string; durationS?: number | null; seriesTitle?: string | null; seriesOrder?: number | null; seriesTotal?: number | null };
  /** the script's beats in order, each with its spoken line(s); markers like {c1} and *stars* may still be present */
  beats: { beat: string; vo: string }[];
  sources: { key: string; claim: string; title?: string; publisher?: string; url?: string }[];
  disclosures: { aiVoice: boolean; aiVisuals: boolean; branded?: boolean };
  /** the end card's "Next: …" line when the script has one */
  next?: string | null;
}

export interface PlatformMeta {
  /** YouTube: the video title. TikTok/Instagram: an internal label only (they have no title field). */
  title: string;
  /** YouTube: the description. TikTok/Instagram: the caption, hashtags included. */
  caption: string;
  hashtags: string;
  /** YouTube keyword tags (≤ 500 characters in all) */
  tags: string[];
  /** the first/pinned comment: the sources, for platforms with no description */
  pinnedComment: string;
  warnings: string[];
}

export const LIMITS = {
  youtube: { title: 100, description: 5000, tags: 500 },
  tiktok: { caption: 2200, captionTarget: 300, comment: 150 },
  instagram: { caption: 2200, hashtags: 30, comment: 2200 },
} as const;

export const HASHTAG_SETS: Record<Topic, Record<Platform, string[]>> = {
  physics: { youtube: ["#Shorts", "#physics", "#science"], tiktok: ["#physics", "#science", "#learnontiktok", "#stem", "#slowmotion"], instagram: ["#physics", "#science", "#stem", "#sciencefacts", "#learnsomethingnew", "#slowmotion", "#education", "#physicsfun"] },
  space: { youtube: ["#Shorts", "#space", "#astronomy"], tiktok: ["#space", "#astronomy", "#learnontiktok", "#science", "#cosmos"], instagram: ["#space", "#astronomy", "#cosmos", "#science", "#universe", "#sciencefacts", "#stem", "#spacefacts"] },
  body: { youtube: ["#Shorts", "#humanbody", "#biology"], tiktok: ["#humanbody", "#biology", "#learnontiktok", "#science", "#anatomy"], instagram: ["#humanbody", "#biology", "#anatomy", "#science", "#physiology", "#sciencefacts", "#stem", "#learnsomethingnew"] },
  skincare: { youtube: ["#Shorts", "#skincare", "#skinscience"], tiktok: ["#skincare", "#skinscience", "#learnontiktok", "#dermatology", "#skinbarrier"], instagram: ["#skincare", "#skinscience", "#dermatology", "#skinbarrier", "#skincarefacts", "#science", "#learnsomethingnew", "#skincareroutine"] },
  whatif: { youtube: ["#Shorts", "#whatif", "#science"], tiktok: ["#whatif", "#science", "#learnontiktok", "#thoughtexperiment", "#stem"], instagram: ["#whatif", "#science", "#thoughtexperiment", "#stem", "#sciencefacts", "#curiosity", "#learnsomethingnew", "#physics"] },
};

/** Spoken text without the script's markup: {c1,c2} / {-} claim tags, *emphasis*, direction braces, stray spaces. */
export function clean(vo: string): string {
  return vo.replace(/\{[^}]*\}/g, "").replace(/\*/g, "").replace(/\s+([,.;:!?…])/g, "$1").replace(/\s+/g, " ").trim();
}

const sentences = (s: string) => clean(s).split(/(?<=[.!?…])\s+/).filter(Boolean);
const firstSentence = (s: string) => sentences(s)[0] ?? "";
const beat = (beats: MetaInput["beats"], ...names: string[]) => { for (const n of names) { const b = beats.find((x) => x.beat === n); if (b && clean(b.vo)) return clean(b.vo); } return ""; };

/** Cut at a word boundary with an ellipsis, never mid-word, never over `max`. */
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  const at = head.lastIndexOf(" ");
  return (at > max * 0.5 ? head.slice(0, at) : head).replace(/[,;:\s]+$/, "") + "…";
}

const channelName = (c: MetaInput["channel"]) => c.name.replace(/ \(name TBD\)$/, "");
const padNo = (n: number) => `No. ${String(n).padStart(3, "0")}`;
const host = (u?: string) => { try { return new URL(u ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } };
/** Short, recognisable names for the publishers the channels cite most; anything else shows its domain. */
export const PUBLISHERS: Record<string, string> = {
  "openstax.org": "OpenStax", "phys.libretexts.org": "LibreTexts Physics", "bio.libretexts.org": "LibreTexts Biology", "chem.libretexts.org": "LibreTexts Chemistry",
  "spark.iop.org": "IOP Spark", "galileoandeinstein.phys.virginia.edu": "UVA Galileo and Einstein", "nhlbi.nih.gov": "NHLBI (NIH)", "ncbi.nlm.nih.gov": "NCBI (NIH)",
  "nih.gov": "NIH", "ligo.caltech.edu": "LIGO", "nasa.gov": "NASA", "science.nasa.gov": "NASA Science", "solarsystem.nasa.gov": "NASA", "esa.int": "ESA",
  "britannica.com": "Britannica", "aad.org": "American Academy of Dermatology", "who.int": "WHO", "cdc.gov": "CDC", "physics.nist.gov": "NIST", "nist.gov": "NIST",
  "hyperphysics.phy-astr.gsu.edu": "HyperPhysics", "en.wikipedia.org": "Wikipedia", "iau.org": "IAU", "nature.com": "Nature", "science.org": "Science",
};
const publisherName = (h: string) => PUBLISHERS[h] ?? PUBLISHERS[h.split(".").slice(-2).join(".")] ?? h;
const sourceLabel = (s: MetaInput["sources"][number]) => { const h = host(s.url) || (s.publisher && /^[\w.-]+\.[a-z]{2,}$/i.test(s.publisher) ? s.publisher : ""); return h ? publisherName(h) : s.publisher || s.title || "source"; };
const uniqueSources = (sources: MetaInput["sources"]) => {
  const seen = new Set<string>(), out: MetaInput["sources"] = [];
  for (const s of sources) { const k = s.url || s.title || s.claim; if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out;
};

export function buildMetadata(input: MetaInput): Record<Platform, PlatformMeta> {
  const ch = channelName(input.channel), topic = input.channel.topic, ep = input.episode;
  const hook = beat(input.beats, "hook");
  const why = beat(input.beats, "why");
  const takeaway = beat(input.beats, "takeaway", "whoa");
  const question = hook.includes("?") ? hook.slice(0, hook.indexOf("?") + 1) : hook;
  const oneLiner = firstSentence(takeaway) || firstSentence(why);
  const srcs = uniqueSources(input.sources);
  const series = ep.seriesTitle ? `${ep.seriesTitle}${ep.seriesOrder ? `, part ${ep.seriesOrder}${ep.seriesTotal ? ` of ${ep.seriesTotal}` : ""}` : ""}` : "";
  const next = input.next ? clean(input.next).replace(/^next:\s*/i, "") : "";
  const ai = input.disclosures.aiVoice || input.disclosures.aiVisuals
    ? `Narration: synthetic voice (AI)${input.disclosures.aiVisuals ? "; AI-generated visuals" : ""}. Animation: code-rendered, no stock footage. Every number is checked against the sources.`
    : "Animation: code-rendered, no stock footage. Every number is checked against the sources.";
  const sourceLines = srcs.map((s, i) => `${i + 1}. ${clean(s.claim)} — ${sourceLabel(s)}${s.url ? `: ${s.url}` : ""}`);
  const sourceShort = srcs.map(sourceLabel).filter((v, i, a) => a.indexOf(v) === i);

  // ── YouTube (Shorts): a title and a full description ──────────────────────
  const yw: string[] = [];
  let title = `${ep.title} | ${ch} ${padNo(ep.number)}`;
  if (title.length > LIMITS.youtube.title) title = `${ep.title} | ${ch}`;
  if (title.length > LIMITS.youtube.title) { title = cut(ep.title, LIMITS.youtube.title); yw.push("title cut to 100 characters"); }
  const ytTags = HASHTAG_SETS[topic].youtube;
  const ytParts = [
    hook, [why, takeaway].filter(Boolean).join(" "),
    [series ? `Series: ${series}.` : "", next ? `Next: ${next}` : ""].filter(Boolean).join(" "),
    sourceLines.length ? `Sources\n${sourceLines.join("\n")}` : "",
    ai, `${ch}: ${input.channel.tagline}`.replace(/:\s*$/, ""), ytTags.join(" "),
  ].filter(Boolean);
  let description = ytParts.join("\n\n");
  if (description.length > LIMITS.youtube.description) { description = cut(description, LIMITS.youtube.description - ytTags.join(" ").length - 2) + "\n\n" + ytTags.join(" "); yw.push("description cut to 5,000 characters"); }
  const tags: string[] = [];
  for (const t of [ch, ...ytTags.map((h) => h.slice(1).toLowerCase()).filter((h) => h !== "shorts"), ...ep.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3), "science", "explainer", "education"]) {
    if (t && !tags.includes(t) && tags.join(",").length + t.length + 1 <= LIMITS.youtube.tags) tags.push(t);
  }
  if (!hook) yw.push("no hook line found in the script");
  if (!srcs.length) yw.push("no sources recorded");

  // ── TikTok: a short caption with hashtags; the sources go in a pinned comment ────────────
  const tw: string[] = [];
  const ttTags = HASHTAG_SETS[topic].tiktok.join(" ");
  const ttBody = [question || cut(hook, 120), oneLiner].filter(Boolean).join(" ");
  const ttRoom = LIMITS.tiktok.captionTarget - ttTags.length - 1 - (ai ? 0 : 0);
  let ttCaption = `${cut(ttBody, Math.max(60, ttRoom))} ${ttTags}`.trim();
  if (ttCaption.length > LIMITS.tiktok.caption) { ttCaption = cut(ttCaption, LIMITS.tiktok.caption); tw.push("caption cut to 2,200 characters"); }
  let ttComment = `Sources: ${sourceShort.join("; ")}. Synthetic (AI) voice; code-rendered animation.`;
  if (ttComment.length > LIMITS.tiktok.comment) {
    ttComment = cut(`Sources: ${sourceShort.join("; ")}`, LIMITS.tiktok.comment - 12) + " AI voice.";
    if (ttComment.length > LIMITS.tiktok.comment) ttComment = cut(ttComment, LIMITS.tiktok.comment);
    tw.push("pinned comment shortened to 150 characters: list the sources in a reply thread");
  }

  // ── Instagram: caption with line breaks, hashtags after a gap; sources in the first comment ─
  const iw: string[] = [];
  const igTags = HASHTAG_SETS[topic].instagram.slice(0, LIMITS.instagram.hashtags);
  const igText = [hook, [why ? firstSentence(why) : "", oneLiner].filter(Boolean).join(" "), series ? `${series}.` : "", "Sources in the first comment. " + (input.disclosures.aiVoice ? "Synthetic (AI) narration; code-rendered animation." : "Code-rendered animation.")].filter(Boolean).join("\n\n");
  let igCaption = `${igText}\n\n${igTags.join(" ")}`;
  if (igCaption.length > LIMITS.instagram.caption) { igCaption = `${cut(igText, LIMITS.instagram.caption - igTags.join(" ").length - 2)}\n\n${igTags.join(" ")}`; iw.push("caption cut to 2,200 characters"); }
  let igComment = sourceLines.length ? `Sources\n${sourceLines.join("\n")}` : "";
  if (igComment.length > LIMITS.instagram.comment) { igComment = cut(igComment, LIMITS.instagram.comment); iw.push("sources comment cut to 2,200 characters"); }

  return {
    youtube: { title, caption: description, hashtags: ytTags.join(" "), tags, pinnedComment: sourceLines.length ? `Sources\n${sourceLines.join("\n")}` : "", warnings: yw },
    tiktok: { title: `${ep.title} (${ch} ${padNo(ep.number)})`, caption: ttCaption, hashtags: ttTags, tags: [], pinnedComment: ttComment, warnings: tw },
    instagram: { title: `${ep.title} (${ch} ${padNo(ep.number)})`, caption: igCaption, hashtags: igTags.join(" "), tags: [], pinnedComment: igComment, warnings: iw },
  };
}

/** A posting sheet a person can read or paste from (also written next to each delivered episode as POSTING.md). */
export function postingSheet(input: MetaInput, meta = buildMetadata(input)): string {
  const ch = channelName(input.channel);
  const block = (p: Platform, label: string, lines: string[]) => [`## ${label}`, ...lines, meta[p].warnings.length ? `> Check: ${meta[p].warnings.join("; ")}` : "", ""].join("\n");
  return [
    `# Posting sheet: ${ch} ${padNo(input.episode.number)}, "${input.episode.title}"`, "",
    `Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel).`, "",
    block("youtube", "YouTube Shorts", ["**Title**", "", meta.youtube.title, "", "**Description**", "", "```", meta.youtube.caption, "```", "", `**Tags**: ${meta.youtube.tags.join(", ")}`, "", "**Captions**: upload the .srt (English).", "**Pinned comment**", "", "```", meta.youtube.pinnedComment, "```"]),
    block("tiktok", "TikTok", ["**Caption**", "", "```", meta.tiktok.caption, "```", "", "**Pinned comment** (150-character limit)", "", "```", meta.tiktok.pinnedComment, "```"]),
    block("instagram", "Instagram Reel (shared account)", ["**Caption**", "", "```", meta.instagram.caption, "```", "", "**First comment**", "", "```", meta.instagram.pinnedComment, "```"]),
  ].join("\n");
}

// ── the text a person pastes ──────────────────────────────────────────────────────────────────────────────────────
type PostText = { caption: string; hashtags: string };

/** The exact text to paste into the platform: the stored caption, with the hashtags added only when the caption doesn't
 *  already carry them (buildMetadata ends every caption with its tags, so normally nothing is added). */
export function composePostText(x: PostText): string {
  const caption = x.caption.trimEnd(), tags = x.hashtags.trim();
  if (!tags || caption.includes(tags)) return caption;
  return caption ? `${caption}\n\n${tags}` : tags;
}

/** The caption without its trailing hashtag line, for showing the words and the tags in separate boxes. */
export function captionBody(x: PostText): string {
  const caption = x.caption.trimEnd(), tags = x.hashtags.trim();
  return tags && caption.endsWith(tags) ? caption.slice(0, -tags.length).trimEnd() : caption;
}

/** An export's posting notes, split into the parts a screen shows separately. regenerateExports and the episode import
 *  write them as blocks separated by a blank line: the label instructions, "Pinned/first comment:", "Tags:", "Check:".
 *  Anything else (the owner's own notes) stays in `other`, word for word. */
export function parsePostingNotes(notes: string | null | undefined) {
  const out = { comment: "", tags: "", checks: [] as string[], aiLabel: false, captionsOff: false, other: [] as string[] };
  for (const raw of (notes ?? "").split(/\n\s*\n(?=\S)/)) {
    const b = raw.trim();
    if (!b) continue;
    if (/^Pinned\/first comment:/i.test(b)) out.comment = b.replace(/^Pinned\/first comment:\s*/i, "").trim();
    else if (/^Tags:/i.test(b)) out.tags = b.replace(/^Tags:\s*/i, "").trim();
    else if (/^Check:/i.test(b)) out.checks.push(...b.replace(/^Check:\s*/i, "").split(/;\s*/).filter(Boolean));
    else if (/synthetic content label/i.test(b) && b.length < 200) { out.aiLabel = true; out.captionsOff = /auto-captions off/i.test(b); }
    else out.other.push(b);
  }
  return out;
}
