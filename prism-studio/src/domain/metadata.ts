// Posting text for every platform, generated from the episode itself: the script's beats, its sourced claims,
// the series, the channel. Pure and deterministic (the same episode always gives the same text), so a regenerated
// export has the same content hash unless the script or sources changed. Platform limits are enforced and
// anything that had to be cut is reported as a warning, never silently. The narration is written for the voice, so its
// numbers are put in written form first (writtenForms: "In twenty seventeen" → "In 2017"); titles, sources and hashtags
// are never changed. Sources that don't fit one comment become a thread: the first comment and numbered replies.
import { writtenForms } from "./written";
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
  /** replies under the first/pinned comment, in order, when the sources don't fit one comment ("Sources 2/3", …);
   *  empty when they do. Each is within the platform's comment limit. */
  replies: string[];
  warnings: string[];
}

export const LIMITS = {
  youtube: { title: 100, description: 5000, tags: 500, comment: 10000 },
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
/** A beat's narration as written copy: markup removed, numbers in written form. */
const beat = (beats: MetaInput["beats"], ...names: string[]) => { for (const n of names) { const b = beats.find((x) => x.beat === n); if (b && clean(b.vo)) return writtenForms(clean(b.vo)); } return ""; };

/** Cut at a word boundary with an ellipsis, never mid-word, never over `max`. */
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  const at = head.lastIndexOf(" ");
  return (at > max * 0.5 ? head.slice(0, at) : head).replace(/[,;:\s]+$/, "") + "…";
}

/** The sources as a thread: the first comment plus as many replies as needed, each within `limit` characters, split only
 *  between sources. A single comment keeps the plain heading (head(1, 1)); a thread numbers every comment (head(i, n),
 *  "Sources 1/3"). A source too long for a comment on its own is shortened to fit, and its index is in `oversize`. */
export function sourcesThread(items: string[], o: { limit: number; sep: string; head: (i: number, n: number) => string; tail?: (i: number, n: number) => string }) {
  const render = (i: number, n: number, xs: string[]) => o.head(i, n) + xs.join(o.sep) + (o.tail?.(i, n) ?? "");
  const pack = (n: number) => {
    const comments: string[] = [], oversize: number[] = [];
    let cur: string[] = [];
    for (const [k, item] of items.entries()) {
      if (cur.length && render(comments.length + 1, n, [...cur, item]).length > o.limit) { comments.push(render(comments.length + 1, n, cur)); cur = []; }
      const i = comments.length + 1;
      if (!cur.length && render(i, n, [item]).length > o.limit) { oversize.push(k); cur = [cut(item, Math.max(1, o.limit - render(i, n, []).length))]; }
      else cur.push(item);
    }
    if (cur.length) comments.push(render(comments.length + 1, n, cur));
    return { comments, oversize };
  };
  if (!items.length) return { comments: [] as string[], oversize: [] as number[] };
  // a numbered heading is longer than the plain one, and "10/10" than "9/9": repack until the count it names is the count it
  // makes (longer headings never make fewer comments, so this settles within a few rounds)
  let n = 1, r = pack(n);
  while (r.comments.length !== n && n < items.length + 1) { n = r.comments.length; r = pack(n); }
  return r;
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
  /** the numbered source lines as a thread of comments within `limit` ("Sources" / "Sources 1/2", one source per line) */
  const listThread = (limit: number, platform: string, warn: string[]) => {
    const t = sourcesThread(sourceLines, { limit, sep: "\n", head: (i, n) => (n === 1 ? "Sources\n" : `Sources ${i}/${n}\n`) });
    for (const k of t.oversize) warn.push(`source ${k + 1} alone is longer than ${platform}'s ${limit.toLocaleString("en-US")}-character comment: shortened`);
    return t.comments;
  };

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
  const ytThread = listThread(LIMITS.youtube.comment, "YouTube", yw);

  // ── TikTok: a short caption with hashtags; the sources go in a pinned comment ────────────
  const tw: string[] = [];
  const ttTags = HASHTAG_SETS[topic].tiktok.join(" ");
  const ttBody = [question || cut(hook, 120), oneLiner].filter(Boolean).join(" ");
  const ttRoom = LIMITS.tiktok.captionTarget - ttTags.length - 1 - (ai ? 0 : 0);
  let ttCaption = `${cut(ttBody, Math.max(60, ttRoom))} ${ttTags}`.trim();
  if (ttCaption.length > LIMITS.tiktok.caption) { ttCaption = cut(ttCaption, LIMITS.tiktok.caption); tw.push("caption cut to 2,200 characters"); }
  // the publishers, "; "-separated; the first comment also carries the production note. Too many for 150 characters: a
  // thread ("Sources 1/2: OpenStax; NASA. Synthetic (AI) voice; …" then "Sources 2/2: ESA; IAU.")
  const ttNote = input.disclosures.aiVoice ? "Synthetic (AI) voice; code-rendered animation." : "Code-rendered animation.";
  const tt = sourceShort.length
    ? sourcesThread(sourceShort, { limit: LIMITS.tiktok.comment, sep: "; ", head: (i, n) => (n === 1 ? "Sources: " : `Sources ${i}/${n}: `), tail: (i) => (i === 1 ? `. ${ttNote}` : ".") })
    : { comments: [ttNote], oversize: [] as number[] };   // no sources: the production note is still the pinned comment
  for (const k of tt.oversize) tw.push(`the source name "${sourceShort[k].replace(/;/g, ",")}" alone is longer than TikTok's 150-character comment: shortened`);
  if (!srcs.length) tw.push("no sources recorded");

  // ── Instagram: caption with line breaks, hashtags after a gap; sources in the first comment ─
  const iw: string[] = [];
  const igTags = HASHTAG_SETS[topic].instagram.slice(0, LIMITS.instagram.hashtags);
  const igNote = input.disclosures.aiVoice ? "Synthetic (AI) narration; code-rendered animation." : "Code-rendered animation.";
  const igText = [hook, [why ? firstSentence(why) : "", oneLiner].filter(Boolean).join(" "), series ? `${series}.` : "", srcs.length ? `Sources in the first comment. ${igNote}` : igNote].filter(Boolean).join("\n\n");
  let igCaption = `${igText}\n\n${igTags.join(" ")}`;
  if (igCaption.length > LIMITS.instagram.caption) { igCaption = `${cut(igText, LIMITS.instagram.caption - igTags.join(" ").length - 2)}\n\n${igTags.join(" ")}`; iw.push("caption cut to 2,200 characters"); }
  const igThread = listThread(LIMITS.instagram.comment, "Instagram", iw);
  if (!srcs.length) iw.push("no sources recorded");

  const [ytFirst = "", ...ytReplies] = ytThread, [ttFirst = "", ...ttReplies] = tt.comments, [igFirst = "", ...igReplies] = igThread;
  return {
    youtube: { title, caption: description, hashtags: ytTags.join(" "), tags, pinnedComment: ytFirst, replies: ytReplies, warnings: yw },
    tiktok: { title: `${ep.title} (${ch} ${padNo(ep.number)})`, caption: ttCaption, hashtags: ttTags, tags: [], pinnedComment: ttFirst, replies: ttReplies, warnings: tw },
    instagram: { title: `${ep.title} (${ch} ${padNo(ep.number)})`, caption: igCaption, hashtags: igTags.join(" "), tags: [], pinnedComment: igFirst, replies: igReplies, warnings: iw },
  };
}

/** The first comment's name on each platform: YouTube and TikTok pin it; on Instagram it is simply the first. */
export const FIRST_COMMENT: Record<Platform, string> = { youtube: "Pinned comment", tiktok: "Pinned comment", instagram: "First comment" };

/** An export's posting notes, as regenerateExports and the episode import store them: the label instructions, the
 *  first/pinned comment, its replies, the YouTube tags and anything to check, as blocks separated by a blank line
 *  (parsePostingNotes reads them back). */
export function postingNotesFor(m: PlatformMeta): string {
  return ["Turn on the platform's AI-generated/synthetic content label. Captions are burned in: leave auto-captions off.",
    m.pinnedComment ? `Pinned/first comment:\n${m.pinnedComment}` : "", ...(m.replies ?? []).map((r, k) => `Reply ${k + 1}:\n${r}`),
    m.tags.length ? `Tags: ${m.tags.join(", ")}` : "", m.warnings.length ? `Check: ${m.warnings.join("; ")}` : ""].filter(Boolean).join("\n\n");
}

/** A posting sheet a person can read or paste from (also written next to each delivered episode as POSTING.md). */
export function postingSheet(input: MetaInput, meta = buildMetadata(input)): string {
  const ch = channelName(input.channel);
  const block = (p: Platform, label: string, lines: string[]) => [`## ${label}`, ...lines, meta[p].warnings.length ? `> Check: ${meta[p].warnings.join("; ")}` : "", ""].join("\n");
  /** the first comment, then each reply as its own block to paste under it */
  const thread = (p: Platform, limit: string) => {
    const first = FIRST_COMMENT[p], replies = meta[p].replies ?? [], n = replies.length + 1;
    if (!meta[p].pinnedComment) return [];
    return [`**${first}** (${n > 1 ? `1 of ${n} · ` : ""}${limit}-character limit)${n > 1 ? ": post it, then each reply under it, in order" : ""}`, "", "```", meta[p].pinnedComment, "```",
      ...replies.flatMap((r, k) => ["", `**Reply ${k + 1}** (${k + 2} of ${n}, under the ${first.toLowerCase()})`, "", "```", r, "```"])];
  };
  return [
    `# Posting sheet: ${ch} ${padNo(input.episode.number)}, "${input.episode.title}"`, "",
    `Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel).`, "",
    block("youtube", "YouTube Shorts", ["**Title**", "", meta.youtube.title, "", "**Description**", "", "```", meta.youtube.caption, "```", "", `**Tags**: ${meta.youtube.tags.join(", ")}`, "", "**Captions**: upload the .srt (English).", "", ...thread("youtube", "10,000")]),
    block("tiktok", "TikTok", ["**Caption**", "", "```", meta.tiktok.caption, "```", "", ...thread("tiktok", "150")]),
    block("instagram", "Instagram Reel (shared account)", ["**Caption**", "", "```", meta.instagram.caption, "```", "", ...thread("instagram", "2,200")]),
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

const noteBlocks = (notes: string | null | undefined) => (notes ?? "").split(/\n\s*\n(?=\S)/).map((b) => b.trim()).filter(Boolean);
const THREAD_BLOCK = /^(Pinned\/first comment|Reply \d+):/i;

/** An export's posting notes, split into the parts a screen shows separately. regenerateExports and the episode import
 *  write them as blocks separated by a blank line (postingNotesFor): the label instructions, "Pinned/first comment:",
 *  "Reply 1:", "Reply 2:" …, "Tags:", "Check:". Notes written before replies existed simply have none. Anything else (the
 *  owner's own notes) stays in `other`, word for word. */
export function parsePostingNotes(notes: string | null | undefined) {
  const out = { comment: "", replies: [] as string[], tags: "", checks: [] as string[], aiLabel: false, captionsOff: false, other: [] as string[] };
  const replies: [number, string][] = [];
  for (const b of noteBlocks(notes)) {
    const reply = /^Reply (\d+):\s*/i.exec(b);
    if (/^Pinned\/first comment:/i.test(b)) out.comment = b.replace(/^Pinned\/first comment:\s*/i, "").trim();
    else if (reply) { const text = b.slice(reply[0].length).trim(); if (text) replies.push([Number(reply[1]), text]); }
    else if (/^Tags:/i.test(b)) out.tags = b.replace(/^Tags:\s*/i, "").trim();
    else if (/^Check:/i.test(b)) out.checks.push(...b.replace(/^Check:\s*/i, "").split(/;\s*/).filter(Boolean));
    else if (/synthetic content label/i.test(b) && b.length < 200) { out.aiLabel = true; out.captionsOff = /auto-captions off/i.test(b); }
    else out.other.push(b);
  }
  out.replies = replies.sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  return out;
}

/** The text file in an upload task's ZIP bundle: the title (YouTube), the exact caption, where to post it, the first/pinned
 *  comment and each reply in posting order, then the rest of the notes. */
export function handOffText(x: PostText & { title: string; postingNotes: string | null }, platform: Platform, postTo: string): string {
  const notes = parsePostingNotes(x.postingNotes), n = notes.replies.length + 1;
  const first = FIRST_COMMENT[platform].toUpperCase(), rest = noteBlocks(x.postingNotes).filter((b) => !THREAD_BLOCK.test(b)).join("\n\n");
  return [platform === "youtube" ? `TITLE\n${x.title}\n` : "", `CAPTION\n${composePostText(x)}\n`, `POST TO\n${postTo}\n`,
    notes.comment ? `${first}${n > 1 ? ` (1 of ${n})` : ""}\n${notes.comment}\n` : "",
    ...notes.replies.map((r, k) => `REPLY ${k + 1} (${k + 2} of ${n}, under the ${first.toLowerCase()})\n${r}\n`),
    rest ? `NOTES\n${rest}\n` : ""].filter(Boolean).join("\n");
}
