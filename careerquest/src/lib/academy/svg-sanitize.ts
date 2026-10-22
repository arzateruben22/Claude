/**
 * Allowlist SVG sanitizer for lesson diagrams.
 *
 * The input is tokenized by a small strict parser and re-serialized from scratch: only allowlisted
 * elements and attributes survive, every attribute value and text node is entity-decoded, checked
 * and re-escaped, so malformed markup can never smuggle a tag or attribute through. Removed:
 * `<script>`, `<style>`, `<foreignObject>`, `<use>`, `<image>`, `<a>`, animation elements and any
 * other non-allowlisted element (together with its content), every `on*` handler, `href` /
 * `xlink:href`, `class`, external or `data:` references, `url()` inside `style`, comments, CDATA,
 * processing instructions and doctypes. `url(#local-id)` is kept only for marker/fill/stroke
 * references to elements in the same document.
 *
 * Pure and isomorphic (no DOM), so it runs in Server Components and in unit tests.
 */

const ALLOWED_ELEMENTS = new Map(
  ["svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text", "tspan", "defs", "marker", "title", "desc"].map(
    (n) => [n.toLowerCase(), n] as const,
  ),
);

/** Elements whose text content is meaningful. */
const TEXT_ELEMENTS = new Set(["text", "tspan", "title", "desc"]);

/** Attribute names are case-sensitive in SVG; the map restores canonical case from lowercase. */
const ALLOWED_ATTRIBUTES = new Map(
  [
    // geometry
    "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points", "dx", "dy",
    "rotate", "textLength", "lengthAdjust", "viewBox", "preserveAspectRatio", "transform",
    // markers
    "refX", "refY", "markerWidth", "markerHeight", "markerUnits", "orient",
    // presentation
    "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit", "opacity", "color",
    "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
    "alignment-baseline", "baseline-shift", "letter-spacing", "word-spacing", "text-decoration", "vector-effect",
    "marker-start", "marker-mid", "marker-end", "clip-rule", "shape-rendering", "paint-order", "display", "visibility",
    // identity and accessibility
    "id", "role", "aria-label", "aria-hidden", "aria-labelledby", "aria-describedby", "focusable", "style", "xmlns",
  ].map((n) => [n.toLowerCase(), n] as const),
);

/** Attributes that may reference a local element with `url(#id)`. */
const LOCAL_URL_ATTRIBUTES = new Set(["fill", "stroke", "marker-start", "marker-mid", "marker-end"]);

/** CSS properties that may appear inside a sanitized `style` attribute. */
const ALLOWED_STYLE_PROPERTIES = new Set([
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit", "opacity", "color", "font-family", "font-size", "font-weight",
  "font-style", "text-anchor", "dominant-baseline", "letter-spacing", "text-decoration", "display", "visibility",
]);

const SVG_NS = "http://www.w3.org/2000/svg";
const LOCAL_URL_RE = /^url\(\s*#[A-Za-z_][\w.:-]*\s*\)$/;
const MAX_NODES = 8000;
const MAX_DEPTH = 40;

export type SanitizeSvgOptions = {
  /** Accessible name for the root `<svg>` (adds role="img" + aria-label). */
  label?: string;
  /**
   * Map of lowercase hex colors to CSS values (e.g. `{"#4cc9ff": "var(--accent)"}`) so diagrams
   * drawn for the dark theme follow the active theme. Applied as a trailing `style` declaration
   * (presentation attributes do not accept `var()`), keeping the attribute as a fallback.
   */
  themeColors?: Record<string, string>;
};

type ElementNode = { kind: "element"; name: string; attrs: [string, string][]; children: Node[] };
type TextNode = { kind: "text"; text: string };
type Node = ElementNode | TextNode;

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "";
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

/** Strip whitespace and control characters that browsers ignore inside schemes ("java\nscript:"). */
function compact(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]+/g, "").toLowerCase();
}

function hasDangerousReference(value: string): boolean {
  const c = compact(value);
  return (
    c.includes("javascript:") ||
    c.includes("vbscript:") ||
    c.includes("data:") ||
    c.includes("expression(") ||
    c.includes("@import") ||
    c.includes("\\") ||
    c.includes("<") ||
    /(?:https?|ftp|file):/.test(c) ||
    c.includes("//")
  );
}

function sanitizeStyle(value: string): string | null {
  const kept: string[] = [];
  for (const decl of value.split(";")) {
    const idx = decl.indexOf(":");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPERTIES.has(prop) || !val) continue;
    if (/url\s*\(/i.test(val) || hasDangerousReference(val) || /[{}]/.test(val)) continue;
    kept.push(`${prop}:${val}`);
  }
  return kept.length ? kept.join(";") : null;
}

function sanitizeAttribute(rawName: string, rawValue: string): [string, string] | null {
  const lower = rawName.toLowerCase();
  if (lower.startsWith("on")) return null;
  const name = ALLOWED_ATTRIBUTES.get(lower);
  if (!name) return null; // href, xlink:href, class, src, any namespaced or unknown attribute
  const value = decodeEntities(rawValue).trim();
  if (value.length > 20_000) return null;

  if (name === "xmlns") return value === SVG_NS ? [name, value] : null;
  if (name === "style") {
    const style = sanitizeStyle(value);
    return style ? [name, style] : null;
  }
  if (/url\s*\(/i.test(value)) {
    return LOCAL_URL_ATTRIBUTES.has(lower) && LOCAL_URL_RE.test(value) ? [name, value] : null;
  }
  if (hasDangerousReference(value)) return null;
  return [name, value];
}

// ---------------------------------------------------------------------------
// Tokenizer / tree builder
// ---------------------------------------------------------------------------

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttributes(source: string): [string, string][] {
  const attrs: [string, string][] = [];
  const seen = new Set<string>();
  for (const m of source.matchAll(ATTR_RE)) {
    const name = m[1]!;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // first occurrence wins, like browsers
    seen.add(key);
    attrs.push([name, m[2] ?? m[3] ?? m[4] ?? ""]);
  }
  return attrs;
}

function parse(input: string): Node[] {
  const root: ElementNode = { kind: "element", name: "#root", attrs: [], children: [] };
  const stack: ElementNode[] = [root];
  let i = 0;
  let count = 0;
  const n = input.length;

  const top = () => stack[stack.length - 1]!;

  while (i < n && count < MAX_NODES) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      top().children.push({ kind: "text", text: input.slice(i) });
      break;
    }
    if (lt > i) top().children.push({ kind: "text", text: input.slice(i, lt) });
    i = lt;

    if (input.startsWith("<!--", i)) {
      const end = input.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (input.startsWith("<![CDATA[", i)) {
      // CDATA in SVG wraps scripts and stylesheets; neither is allowed, so drop it entirely.
      const end = input.indexOf("]]>", i + 9);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (input[i + 1] === "!" || input[i + 1] === "?") {
      const end = input.indexOf(">", i + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }

    const close = /^<\/\s*([A-Za-z][\w:.-]*)\s*>/.exec(input.slice(i, i + 200));
    if (close) {
      const name = close[1]!.toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s]!.name.toLowerCase() === name) {
          stack.length = s;
          break;
        }
      }
      i += close[0].length;
      continue;
    }

    const open = /^<([A-Za-z][\w:.-]*)/.exec(input.slice(i, i + 200));
    if (!open) {
      top().children.push({ kind: "text", text: "<" });
      i += 1;
      continue;
    }
    // Find the end of the tag, skipping '>' inside quoted attribute values.
    let j = i + open[0].length;
    let quote: string | null = null;
    while (j < n) {
      const ch = input[j]!;
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
      j++;
    }
    if (j >= n) break; // unterminated tag: drop the rest
    let attrSource = input.slice(i + open[0].length, j);
    const selfClosing = /\/\s*$/.test(attrSource);
    if (selfClosing) attrSource = attrSource.replace(/\/\s*$/, "");
    const el: ElementNode = { kind: "element", name: open[1]!, attrs: parseAttributes(attrSource), children: [] };
    count++;
    top().children.push(el);
    const pushed = !selfClosing && stack.length < MAX_DEPTH;
    if (pushed) stack.push(el);
    i = j + 1;

    // Raw-text elements: never parse their content as markup.
    const lower = el.name.toLowerCase();
    if (!selfClosing && (lower === "script" || lower === "style")) {
      const endRe = new RegExp(`</\\s*${lower}\\s*>`, "i");
      const rest = input.slice(i);
      const m = endRe.exec(rest);
      i = m ? i + m.index + m[0].length : n;
      if (pushed) stack.pop();
    }
  }
  return root.children;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

function serialize(node: Node, parentName: string, options: SanitizeSvgOptions, isRoot: boolean): string {
  if (node.kind === "text") {
    if (!TEXT_ELEMENTS.has(parentName)) return node.text.trim() ? "" : " ";
    return escapeText(decodeEntities(node.text));
  }
  const canonical = ALLOWED_ELEMENTS.get(node.name.toLowerCase());
  if (!canonical) return ""; // drop the element and everything inside it

  const attrs: [string, string][] = [];
  for (const [rawName, rawValue] of node.attrs) {
    const clean = sanitizeAttribute(rawName, rawValue);
    if (clean) attrs.push(clean);
  }

  if (options.themeColors) {
    const extra: string[] = [];
    for (const [name, value] of attrs) {
      if (name !== "fill" && name !== "stroke") continue;
      const mapped = options.themeColors[value.toLowerCase()];
      if (mapped && !hasDangerousReference(mapped) && !/url\s*\(/i.test(mapped)) extra.push(`${name}:${mapped}`);
    }
    if (extra.length) {
      const idx = attrs.findIndex(([n]) => n === "style");
      if (idx === -1) attrs.push(["style", extra.join(";")]);
      else attrs[idx] = ["style", `${attrs[idx]![1]};${extra.join(";")}`];
    }
  }

  if (isRoot) {
    const replaced = options.label ? ["xmlns", "role", "aria-label", "aria-hidden"] : ["xmlns"];
    const filtered = attrs.filter(([n]) => !replaced.includes(n));
    filtered.unshift(["xmlns", SVG_NS]);
    if (options.label) filtered.push(["role", "img"], ["aria-label", options.label]);
    attrs.length = 0;
    attrs.push(...filtered);
  }

  const attrText = attrs.map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join("");
  const inner = node.children.map((c) => serialize(c, canonical, options, false)).join("");
  const trimmed = TEXT_ELEMENTS.has(canonical) ? inner : inner.replace(/\s+/g, " ").trim();
  return trimmed ? `<${canonical}${attrText}>${trimmed}</${canonical}>` : `<${canonical}${attrText}/>`;
}

/**
 * Sanitize an SVG document. Returns the clean markup of the first `<svg>` root element, or an
 * empty string when there is none.
 */
export function sanitizeSvg(input: string, options: SanitizeSvgOptions = {}): string {
  if (typeof input !== "string" || !input) return "";
  const nodes = parse(input.slice(0, 400_000));
  const root = nodes.find((n): n is ElementNode => n.kind === "element" && n.name.toLowerCase() === "svg");
  if (!root) return "";
  return serialize(root, "#root", options, true);
}

/** Dark-theme hex colors used by the lesson diagrams, mapped to the app's semantic tokens. */
export const DIAGRAM_THEME_COLORS: Record<string, string> = {
  "#4cc9ff": "var(--accent)",
  "#f3c75b": "var(--gold)",
  "#3ddc97": "var(--success)",
  "#ff6b6b": "var(--danger)",
  "#9aa6b8": "var(--fg-muted)",
  "#7aa2ff": "var(--info)",
  "#f5a524": "var(--warning)",
};
