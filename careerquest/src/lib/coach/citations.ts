/**
 * Citation tokens: `[metric.id]` or `[metric.id, other.id]` inside advisor text. Pure.
 *
 * Metric ids always contain a dot, so bracketed draft placeholders such as "[Hiring manager's name]"
 * and Markdown links "[text](url)" are never mistaken for citations.
 */

const ID = "[a-z][a-z0-9_-]*(?:\\.[a-z0-9_-]+)+";
const TOKEN = new RegExp(`\\[(\\s*${ID}(?:\\s*,\\s*${ID})*\\s*)\\](?!\\()`, "gi");

export type ContentSegment = { type: "text"; value: string } | { type: "cite"; id: string };

/**
 * Keep only citations whose id is known; unknown ids are dropped from the text and from the list.
 * Multi-id tokens are split into one token per id. Returns the cleaned text and the ids in order.
 */
export function extractCitations(text: string, isKnown: (id: string) => boolean): { text: string; citations: string[] } {
  const citations: string[] = [];
  const cleaned = text.replace(TOKEN, (_match, inner: string) => {
    const ids = inner
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((id) => id && isKnown(id));
    for (const id of ids) if (!citations.includes(id)) citations.push(id);
    return ids.map((id) => `[${id}]`).join("");
  });
  // Tidy spaces left behind by removed tokens (" ." → ".").
  const tidy = cleaned.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ");
  return { text: tidy, citations };
}

/** Split text into plain segments and citation segments (only ids accepted by `isKnown`). */
export function splitCitations(text: string, isKnown: (id: string) => boolean): ContentSegment[] {
  const out: ContentSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    for (const raw of match[1]!.split(",")) {
      const id = raw.trim().toLowerCase();
      if (id && isKnown(id)) out.push({ type: "cite", id });
    }
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  // Merge adjacent text segments (dropped citations leave them split).
  const merged: ContentSegment[] = [];
  for (const seg of out) {
    const prev = merged[merged.length - 1];
    if (seg.type === "text" && prev?.type === "text") prev.value += seg.value;
    else merged.push({ ...seg });
  }
  return merged;
}

/** Every citation id in a text, regardless of whether it is known. */
export function citationIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(TOKEN)) {
    for (const raw of match[1]!.split(",")) {
      const id = raw.trim().toLowerCase();
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}
