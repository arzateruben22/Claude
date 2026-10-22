/**
 * Light Markdown for Advisor text: paragraphs (blank-line separated), "- " bullet lists, **bold**,
 * and `[metric.id]` citation tokens. Pure; renders to a tiny AST so the UI never injects HTML.
 */
import { splitCitations } from "./citations";

export type Inline = { type: "text"; value: string; bold?: boolean } | { type: "cite"; id: string };
export type Block = { type: "p"; lines: Inline[][] } | { type: "ul"; items: Inline[][] };

function inlines(text: string, isKnown: (id: string) => boolean): Inline[] {
  const out: Inline[] = [];
  for (const seg of splitCitations(text, isKnown)) {
    if (seg.type === "cite") {
      out.push(seg);
      continue;
    }
    const parts = seg.value.split(/\*\*(.+?)\*\*/g);
    parts.forEach((p, i) => {
      if (p) out.push({ type: "text", value: p, ...(i % 2 === 1 ? { bold: true } : {}) });
    });
  }
  return out;
}

export function parseRichText(text: string, isKnown: (id: string) => boolean): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    let para: string[] = [];
    let items: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ type: "p", lines: para.map((l) => inlines(l, isKnown)) });
      para = [];
    };
    const flushList = () => {
      if (items.length) blocks.push({ type: "ul", items: items.map((l) => inlines(l, isKnown)) });
      items = [];
    };
    for (const line of lines) {
      const m = line.match(/^\s*[-*•]\s+(.*)$/);
      if (m) {
        flushPara();
        items.push(m[1]!);
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/** Plain text without citation tokens or bold markers (for clipboard, print and screen-reader summaries). */
export function plainText(text: string): string {
  return text
    .replace(/\s?\[[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?:\s*,\s*[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)*\](?!\()/gi, "")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}
