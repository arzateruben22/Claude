/**
 * Tiny markdown parser for lesson text. Supported: paragraphs, hard line breaks (a single newline),
 * `**bold**`, `*italic*`, `` `code` ``, unordered (`-`, `*`, `+`) and ordered (`1.`, `1)`) lists,
 * `#`–`###` headings and backslash escapes. It produces a plain AST; `components/academy/markdown`
 * turns that into React elements, so no HTML string is ever injected and raw HTML in the source is
 * shown as text.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "br" };

export type Block =
  | { type: "p"; children: Inline[] }
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; start: number; items: Inline[][] };

const ESCAPABLE = new Set(["\\", "`", "*", "_", "#", "-", "+", ".", "!", "(", ")", "[", "]"]);
const MAX_INPUT = 50_000;

function pushText(out: Inline[], value: string) {
  if (!value) return;
  const last = out[out.length - 1];
  if (last && last.type === "text") last.value += value;
  else out.push({ type: "text", value });
}

/** Find the closing delimiter for emphasis: not preceded by whitespace and not part of a longer run. */
function findClosing(s: string, from: number, delim: "**" | "*"): number {
  let i = from;
  while (i < s.length) {
    if (s[i] === "\\") {
      i += 2;
      continue;
    }
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    if (s.startsWith(delim, i) && !/\s/.test(s[i - 1] ?? " ")) {
      if (delim === "*") {
        // A single '*' must not be half of a '**' pair.
        if (s[i + 1] === "*") {
          const close = s.indexOf("**", i + 2);
          if (close === -1) return -1;
          i = close + 2;
          continue;
        }
        return i;
      }
      // In a run like "***" the closing "**" is the last two, so "**a *b***" nests correctly.
      let run = 0;
      while (s[i + run] === "*") run++;
      return i + run - 2;
    }
    i++;
  }
  return -1;
}

export function parseInline(s: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\" && i + 1 < s.length && ESCAPABLE.has(s[i + 1]!)) {
      pushText(out, s[i + 1]!);
      i += 2;
      continue;
    }
    if (ch === "\n") {
      out.push({ type: "br" });
      i++;
      continue;
    }
    if (ch === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > i + 1) {
        out.push({ type: "code", value: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 6 && s.startsWith("**", i) && s[i + 2] && !/\s/.test(s[i + 2]!)) {
      const end = findClosing(s, i + 2, "**");
      if (end > i + 2) {
        out.push({ type: "strong", children: parseInline(s.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }
    if (depth < 6 && ch === "*" && s[i + 1] !== "*" && s[i + 1] && !/\s/.test(s[i + 1]!)) {
      const end = findClosing(s, i + 1, "*");
      if (end > i + 1) {
        out.push({ type: "em", children: parseInline(s.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }
    // Plain text up to the next special character.
    let j = i + 1;
    while (j < s.length && !"\\\n`*".includes(s[j]!)) j++;
    pushText(out, s.slice(i, j));
    i = j;
  }
  return out;
}

const UL_RE = /^\s{0,3}[-*+]\s+(.*)$/;
const OL_RE = /^\s{0,3}(\d{1,6})[.)]\s+(.*)$/;
const HEADING_RE = /^\s{0,3}(#{1,3})\s+(.*?)\s*#*\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = (source ?? "").slice(0, MAX_INPUT).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length as 1 | 2 | 3, children: parseInline(heading[2]!) });
      i++;
      continue;
    }

    const ul = UL_RE.exec(line);
    const ol = ul ? null : OL_RE.exec(line);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const re = ordered ? OL_RE : UL_RE;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const m = re.exec(current);
        if (m) {
          items.push(ordered ? m[2]! : m[1]!);
          i++;
          continue;
        }
        // An indented, non-blank line continues the previous item.
        if (current.trim() && /^\s{2,}/.test(current) && items.length && !UL_RE.exec(current) && !OL_RE.exec(current)) {
          items[items.length - 1] += `\n${current.trim()}`;
          i++;
          continue;
        }
        break;
      }
      const parsed = items.map((t) => parseInline(t));
      blocks.push(ordered ? { type: "ol", start: Number(ol![1]), items: parsed } : { type: "ul", items: parsed });
      continue;
    }

    // Paragraph: consecutive non-blank lines that do not start another block.
    const para: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      if (!current.trim() || (para.length && (UL_RE.test(current) || OL_RE.test(current) || HEADING_RE.test(current)))) break;
      para.push(current.trim());
      i++;
    }
    blocks.push({ type: "p", children: parseInline(para.join("\n")) });
  }
  return blocks;
}

/** Plain-text rendering of inline markdown (for aria-labels and metadata). */
export function inlineToText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === "text" || n.type === "code" ? n.value : n.type === "br" ? " " : inlineToText(n.children)))
    .join("");
}

export function markdownToText(source: string): string {
  return parseMarkdown(source)
    .map((b) => (b.type === "ul" || b.type === "ol" ? b.items.map(inlineToText).join(" ") : inlineToText(b.children)))
    .join(" ");
}
