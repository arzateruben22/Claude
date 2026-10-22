/**
 * Dependency-free HTML → readable text conversion for email bodies.
 *
 * - `<script>`, `<style>`, `<head>`, comments (incl. Outlook conditional comments), hidden preheader
 *   elements, images and tracking pixels are removed;
 * - links are reduced to their visible text (the href is collected separately, never inlined);
 * - block elements and table rows become line breaks, table cells are separated by a space;
 * - entities are decoded after tags are stripped (so `&lt;b&gt;` stays literal text);
 * - whitespace is collapsed per line and runs of blank lines are reduced to one.
 */

export type EmailLink = { text: string; url: string };

/** Largest HTML input converted; anything beyond is ignored (oversized marketing mail). */
export const MAX_HTML_CHARS = 2_000_000;
const MAX_LINKS = 60;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  zwnj: "",
  zwj: "",
  shy: "",
  middot: "·",
  bull: "•",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  minus: "−",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup2: "²",
  sup3: "³",
  para: "¶",
  sect: "§",
  dagger: "†",
  Dagger: "‡",
  prime: "′",
  Prime: "″",
  cent: "¢",
  pound: "£",
  euro: "€",
  yen: "¥",
  dollar: "$",
  percnt: "%",
  num: "#",
  commat: "@",
  colon: ":",
  semi: ";",
  comma: ",",
  period: ".",
  excl: "!",
  quest: "?",
  lpar: "(",
  rpar: ")",
  lsqb: "[",
  rsqb: "]",
  lcub: "{",
  rcub: "}",
  sol: "/",
  bsol: "\\",
  verbar: "|",
  vert: "|",
  equals: "=",
  plus: "+",
  ast: "*",
  hyphen: "-",
  dash: "-",
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  check: "✓",
  iexcl: "¡",
  iquest: "¿",
  ordf: "ª",
  ordm: "º",
  micro: "µ",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Auml: "Ä",
  Aring: "Å",
  AElig: "Æ",
  Ccedil: "Ç",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Euml: "Ë",
  Igrave: "Ì",
  Iacute: "Í",
  Icirc: "Î",
  Iuml: "Ï",
  Ntilde: "Ñ",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Ouml: "Ö",
  Oslash: "Ø",
  Ugrave: "Ù",
  Uacute: "Ú",
  Ucirc: "Û",
  Uuml: "Ü",
  Yacute: "Ý",
  szlig: "ß",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  aelig: "æ",
  ccedil: "ç",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  euml: "ë",
  igrave: "ì",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  ntilde: "ñ",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  oslash: "ø",
  ugrave: "ù",
  uacute: "ú",
  ucirc: "û",
  uuml: "ü",
  yacute: "ý",
  yuml: "ÿ",
};

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return "�";
  // Windows-1252 C1 range commonly emitted by Outlook (&#150; = en dash, &#146; = apostrophe …).
  const cp1252: Record<number, string> = {
    0x80: "€",
    0x82: "‚",
    0x84: "„",
    0x85: "…",
    0x8b: "‹",
    0x91: "‘",
    0x92: "’",
    0x93: "“",
    0x94: "”",
    0x95: "•",
    0x96: "–",
    0x97: "—",
    0x99: "™",
    0x9b: "›",
  };
  if (cp1252[n]) return cp1252[n];
  return String.fromCodePoint(n);
}

/** Decode HTML character references (named, decimal and hex). Unknown names are left as-is. */
export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});?/g, (whole, ref: string) => {
    if (ref[0] === "#") {
      const n = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return codePoint(n);
    }
    const named = NAMED_ENTITIES[ref] ?? NAMED_ENTITIES[ref.toLowerCase()];
    return named ?? whole;
  });
}

/** Zero-width and invisible padding characters used in email preheaders. */
const INVISIBLE = /[​-‍⁠﻿­͏᠎]/g;

/** Collapse whitespace inside each line, trim lines and keep at most one blank line in a row. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v  -   　]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = re.exec(tag);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim();
}

const BLOCK_TAGS =
  /^(p|div|br|tr|table|thead|tbody|tfoot|h[1-6]|ul|ol|dl|dt|dd|blockquote|section|article|header|footer|nav|aside|main|center|address|pre|hr|form|fieldset|figure|figcaption|caption)$/i;

function isTrackingUrl(url: string): boolean {
  return /\/(open|track|pixel|beacon|emimp)(\.php|\.gif|\?|\/|$)|\.gif(\?|$)/i.test(url);
}

/**
 * Convert an HTML email body to readable plain text. Also returns the links it found
 * (visible text + href) so callers can pick an application/posting URL without inlining URLs.
 */
export function htmlToTextWithLinks(html: string): { text: string; links: EmailLink[] } {
  let h = html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) : html;
  h = h
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, " ")
    .replace(/<!DOCTYPE[^>]*>/gi, " ")
    .replace(/<(head|script|style|noscript|title|template|svg|xml|object|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    // Hidden preheaders / spacer blocks: `<span style="display:none">…</span>` (non-nested only).
    .replace(
      /<(span|div|p|td)\b[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|mso-hide\s*:\s*all|visibility\s*:\s*hidden)[^"']*["'][^>]*>((?:(?!<\1[\s>])[\s\S]){0,5000}?)<\/\1\s*>/gi,
      " ",
    );

  const links: EmailLink[] = [];
  // Anchors: keep their visible text, remember the href. (Bounded so malformed markup stays linear;
  // an unmatched <a> is stripped like any other tag below and its text is kept.)
  h = h.replace(/<a\b([^>]*)>([\s\S]{0,8000}?)<\/a\s*>/gi, (_whole, attrs: string, inner: string) => {
    const href = attr(` ${attrs}`, "href");
    const visible = normalizeWhitespace(decodeEntities(inner.replace(/<[^>]+>/g, " "))).replace(/\n+/g, " ");
    if (href && /^https?:\/\//i.test(href) && !isTrackingUrl(href) && links.length < MAX_LINKS) {
      links.push({ text: visible, url: href });
    }
    return visible ? ` ${inner} ` : " ";
  });

  // Images (logos, tracking pixels) are dropped entirely.
  h = h.replace(/<img\b[^>]*>/gi, " ");

  // Structural tags → line breaks; cells → spaces; list items → bullets; other tags → nothing.
  h = h.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g, (tag: string, name: string) => {
    const closing = tag.startsWith("</");
    const lower = name.toLowerCase();
    if (lower === "li") return closing ? "" : "\n- ";
    if (lower === "td" || lower === "th") return " ";
    if (BLOCK_TAGS.test(lower)) return "\n";
    return "";
  });
  // Any stray "<" fragments left by malformed markup.
  h = h.replace(/<[^>\n]{0,200}>/g, " ");

  const text = normalizeWhitespace(decodeEntities(h));
  return { text, links };
}

export function htmlToText(html: string): string {
  return htmlToTextWithLinks(html).text;
}

/** Plain-text URLs with the label that precedes them ("Track your application: https://…"). */
export function linksFromPlainText(text: string): EmailLink[] {
  const out: EmailLink[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && out.length < MAX_LINKS; i++) {
    const line = lines[i]!;
    const re = /\bhttps?:\/\/[^\s<>()"'\]\[]+/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) && out.length < MAX_LINKS) {
      const url = m[0].replace(/[.,;:!?]+$/, "");
      if (isTrackingUrl(url)) continue;
      let label = line.slice(0, m.index).replace(/[\s:–—-]+$/, "").trim();
      if (!label && i > 0) label = (lines[i - 1] ?? "").replace(/[\s:–—-]+$/, "").trim();
      out.push({ text: label.slice(-120), url });
    }
  }
  return out;
}
