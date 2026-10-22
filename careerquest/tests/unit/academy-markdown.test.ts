import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { parseInline, parseMarkdown, markdownToText } from "@/lib/academy/markdown";
import { InlineMarkdown, Markdown } from "@/components/academy/markdown";

const html = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

describe("markdown parser", () => {
  it("parses bold, italic, code and nested emphasis", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " " },
      { type: "em", children: [{ type: "text", value: "c" }] },
      { type: "text", value: " " },
      { type: "code", value: "d" },
    ]);
    expect(parseInline("**bold *and italic***")[0]).toEqual({
      type: "strong",
      children: [
        { type: "text", value: "bold " },
        { type: "em", children: [{ type: "text", value: "and italic" }] },
      ],
    });
  });

  it("leaves unmatched or spaced asterisks, underscores and escapes as text", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", value: "2 * 3 = 6" }]);
    expect(parseInline("V_drop = I × R_wire")).toEqual([{ type: "text", value: "V_drop = I × R_wire" }]);
    expect(parseInline("\\*not italic\\*")).toEqual([{ type: "text", value: "*not italic*" }]);
    expect(parseInline("**unclosed")).toEqual([{ type: "text", value: "**unclosed" }]);
  });

  it("parses paragraphs, line breaks, lists and headings", () => {
    const blocks = parseMarkdown("Para one\nline two\n\n- a\n- **b**\n  continued\n\n3. three\n4. four\n\n## Head");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol", "heading"]);
    expect(blocks[0]).toEqual({ type: "p", children: [{ type: "text", value: "Para one" }, { type: "br" }, { type: "text", value: "line two" }] });
    const ul = blocks[1];
    expect(ul?.type === "ul" && ul.items.length).toBe(2);
    expect(ul?.type === "ul" && ul.items[1]).toEqual([{ type: "strong", children: [{ type: "text", value: "b" }] }, { type: "br" }, { type: "text", value: "continued" }]);
    const ol = blocks[2];
    expect(ol?.type === "ol" && ol.start).toBe(3);
    expect(markdownToText("**Hi** *there*\n- x")).toBe("Hi there x");
  });

  it("parses every lesson's text without throwing and finds no stray markers", () => {
    const dir = path.join(process.cwd(), "data", "academy", "lessons");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const s of lesson.sections) {
        if (s.type !== "text") continue;
        const text = markdownToText(s.markdown);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\*\*/);
      }
    }
  });
});

describe("markdown renderer", () => {
  it("renders React elements for each construct", () => {
    const out = html("Hello **world** and *you*\nnext `code`\n\n- one\n- two\n\n1. first");
    expect(out).toContain("<strong");
    expect(out).toContain(">world</strong>");
    expect(out).toContain("<em>you</em>");
    expect(out).toContain("<br/>");
    expect(out).toContain(">code</code>");
    expect(out).toMatch(/<ul[^>]*><li>one<\/li><li>two<\/li><\/ul>/);
    expect(out).toMatch(/<ol start="1"[^>]*><li>first<\/li><\/ol>/);
  });

  it("escapes raw HTML instead of injecting it", () => {
    const out = html('<script>alert(1)</script> <img src=x onerror="alert(1)"> **<b>x</b>**');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    const inline = renderToStaticMarkup(createElement(InlineMarkdown, { source: "<a href='javascript:alert(1)'>x</a>" }));
    expect(inline).not.toContain("<a ");
    expect(inline).toContain("&lt;a href=");
  });
});
