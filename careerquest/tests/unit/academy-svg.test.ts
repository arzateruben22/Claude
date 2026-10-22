import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DIAGRAM_THEME_COLORS, decodeEntities, sanitizeSvg } from "@/lib/academy/svg-sanitize";

const wrap = (inner: string, attrs = 'viewBox="0 0 10 10"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe("SVG sanitizer — removals", () => {
  it("removes <script> elements, including CDATA and uppercase variants", () => {
    const out = sanitizeSvg(
      wrap('<script>alert(1)</script><SCRIPT type="text/javascript">alert(2)</SCRIPT><script><![CDATA[alert(3)]]></script><line x1="0" y1="0" x2="1" y2="1"/>'),
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toContain("alert");
    expect(out).toContain('<line x1="0" y1="0" x2="1" y2="1"/>');
  });

  it("removes every on* event handler", () => {
    const out = sanitizeSvg(
      `<svg onload="alert(1)" viewBox="0 0 10 10"><rect onclick="alert(2)" OnMouseOver='alert(3)' onfocusin=alert(4) x="1" y="1" width="2" height="2"/></svg>`,
    );
    expect(out).not.toMatch(/\bon[a-z]+=/i);
    expect(out).not.toContain("alert");
    expect(out).toContain('<rect x="1" y="1" width="2" height="2"/>');
  });

  it("removes href / xlink:href and elements that load external resources", () => {
    const out = sanitizeSvg(
      wrap(
        '<a href="https://evil.example"><text>click</text></a>' +
          '<use href="https://evil.example/sprite.svg#x"/>' +
          '<use xlink:href="#local"/>' +
          '<image href="https://evil.example/x.png" width="10" height="10"/>' +
          '<text xlink:href="javascript:alert(1)" href="javascript:alert(2)" x="1">safe</text>',
      ),
    );
    expect(out).not.toMatch(/href/i);
    expect(out).not.toContain("evil.example");
    expect(out).not.toMatch(/<use|<image|<a[ >]/);
    expect(out).toContain('<text x="1">safe</text>');
  });

  it("removes foreignObject, style elements, animation and iframes with their content", () => {
    const out = sanitizeSvg(
      wrap(
        '<foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="javascript:alert(1)"></iframe></body></foreignObject>' +
          "<style>@import url(https://evil.example/x.css); rect { fill: url(https://evil.example/x) }</style>" +
          '<animate attributeName="href" to="javascript:alert(1)"/><set attributeName="onmouseover" to="alert(1)"/>' +
          '<circle cx="5" cy="5" r="2"/>',
      ),
    );
    expect(out).not.toMatch(/foreignObject|iframe|<style|animate|<set|@import|evil/i);
    expect(out).toContain('<circle cx="5" cy="5" r="2"/>');
  });

  it("strips url() from style attributes and external url() references from paint", () => {
    const out = sanitizeSvg(
      wrap(
        '<rect style="fill: url(https://evil.example/p.svg#g); stroke: red; behavior: url(x.htc)" width="1" height="1"/>' +
          '<rect fill="url(https://evil.example/p.svg#g)" stroke="url(&quot;data:image/svg+xml,x&quot;)" width="2" height="2"/>' +
          '<rect style="background-image:url(javascript:alert(1))" width="3" height="3"/>',
      ),
    );
    expect(out).not.toMatch(/url\(/);
    expect(out).not.toContain("evil");
    expect(out).toContain('style="stroke:red"');
    expect(out).toContain('<rect width="2" height="2"/>');
    expect(out).toContain('<rect width="3" height="3"/>');
  });

  it("decodes entities before checking values, so encoded javascript: is still caught", () => {
    expect(decodeEntities("&#106;&#x61;vascript&colon;")).toBe("javascript&colon;");
    const out = sanitizeSvg(wrap('<rect style="fill:&#106;avascript:alert(1)" transform="java&#x0A;script:alert(1)" width="1" height="1"/>'));
    expect(out).not.toMatch(/javascript|alert/);
  });

  it("drops comments, doctypes, processing instructions, class and unknown namespaced attributes", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><!-- hi --><svg viewBox="0 0 1 1" class="fixed inset-0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ev="http://www.w3.org/2001/xml-events"><g ev:event="click" class="z-50"><path d="M0 0L1 1"/></g></svg>',
    );
    expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g><path d="M0 0L1 1"/></g></svg>');
  });

  it("escapes text so it can never break out into markup", () => {
    const out = sanitizeSvg(wrap("<text>a &lt;script&gt; &amp; b</text><text><![CDATA[<script>x</script>]]>ok</text>"));
    expect(out).toContain("<text>a &lt;script&gt; &amp; b</text>");
    expect(out).toContain("<text>ok</text>");
    expect(out).not.toContain("<script");
  });

  it("returns an empty string when there is no svg root", () => {
    expect(sanitizeSvg("<div>hi</div>")).toBe("");
    expect(sanitizeSvg("<script>alert(1)</script>")).toBe("");
    expect(sanitizeSvg("")).toBe("");
  });

  it("survives malformed markup without leaking tags", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 1 1"><g><rect width="1" height="1"><text x="0">a</g><circle r="1" onload="x"');
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(out).not.toContain("onload");
    expect(out).not.toContain("circle"); // unterminated tag dropped
  });
});

describe("SVG sanitizer — preservation", () => {
  it("keeps allowlisted elements, geometry and local marker references", () => {
    const input = wrap(
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>' +
        '<line x1="0" y1="0" x2="5" y2="5" marker-end="url(#arrow)" stroke-dasharray="4 2"/>' +
        '<text x="1" y="2" text-anchor="middle" font-weight="600">V<tspan dy="2">2</tspan></text><title>Diagram</title>',
    );
    const out = sanitizeSvg(input);
    expect(out).toContain('<marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">');
    expect(out).toContain('marker-end="url(#arrow)"');
    expect(out).toContain('<text x="1" y="2" text-anchor="middle" font-weight="600">V<tspan dy="2">2</tspan></text>');
    expect(out).toContain("<title>Diagram</title>");
  });

  it("adds an accessible label and theme color overrides when asked", () => {
    const out = sanitizeSvg(wrap('<circle r="1" fill="#4CC9FF" stroke="#9aa6b8" style="opacity:0.5"/>'), {
      label: 'Ohm\'s "law"',
      themeColors: DIAGRAM_THEME_COLORS,
    });
    expect(out).toContain('role="img" aria-label="Ohm\'s &quot;law&quot;"');
    expect(out).toContain('style="opacity:0.5;fill:var(--accent);stroke:var(--fg-muted)"');
    expect(out).toContain('fill="#4CC9FF"');
  });

  it("keeps every real lesson diagram intact (same drawable element counts)", () => {
    const dir = path.join(process.cwd(), "data", "academy", "lessons");
    let diagrams = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const s of lesson.sections) {
        if (s.type !== "diagram") continue;
        diagrams++;
        const out = sanitizeSvg(s.svg, { label: s.title, themeColors: DIAGRAM_THEME_COLORS });
        for (const tag of ["line", "path", "text", "circle", "rect", "polyline", "polygon", "ellipse", "tspan", "g", "marker"]) {
          const count = (str: string) => (str.match(new RegExp(`<${tag}[\\s/>]`, "g")) ?? []).length;
          expect(count(out), `${f} <${tag}>`).toBe(count(s.svg));
        }
        // idempotent
        expect(sanitizeSvg(out)).toBe(sanitizeSvg(out, {}));
      }
    }
    expect(diagrams).toBeGreaterThan(10);
  });
});
