/* global chrome */
/**
 * CareerQuest Job Tracker — shared content-script helpers.
 *
 * Loaded before every platform detector via the manifest "js" array (classic
 * script, no ES imports). Exposes ONE documented global, `window.__cqCommon`,
 * which platform scripts use to register their detector; registering sets the
 * second documented global, `window.__cqDetect` (a zero-arg function returning
 * the current detection result).
 *
 * Privacy contract (see PRIVACY.md): helpers only ever read JSON-LD JobPosting
 * metadata, <meta>/<title>, visible non-form text, and the page URL. Form
 * controls (input/textarea/select) are never read.
 */
(() => {
  if (window.__cqCommon) return;

  const LIMITS = Object.freeze({
    company: 200,
    title: 200,
    location: 200,
    salaryText: 120,
    requisitionId: 64,
    pageTitle: 300,
    confirmationText: 300,
    url: 2048,
    visibleText: 200_000,
  });

  /** Tags whose contents are never read (scripts, styles and all form controls). */
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "INPUT", "TEXTAREA", "SELECT", "OPTION", "DATALIST", "IFRAME", "OBJECT", "EMBED", "HEAD", "TITLE", "META", "LINK"]);

  const HOST_PLATFORMS = [
    [/(^|\.)indeed\.com$/, "INDEED"],
    [/(^|\.)linkedin\.com$/, "LINKEDIN"],
    [/(^|\.)glassdoor\.(com|co\.uk|ca)$/, "GLASSDOOR"],
    [/(^|\.)ziprecruiter\.com$/, "ZIPRECRUITER"],
    [/(^|\.)myworkdayjobs\.com$|(^|\.)myworkday\.com$|(^|\.)workday\.com$/, "WORKDAY"],
    [/(^|\.)greenhouse\.io$/, "GREENHOUSE"],
    [/(^|\.)lever\.co$/, "LEVER"],
    [/(^|\.)smartrecruiters\.com$/, "SMARTRECRUITERS"],
    [/(^|\.)icims\.com$/, "ICIMS"],
    [/(^|\.)adp\.com$/, "ADP"],
    [/(^|\.)governmentjobs\.com$/, "GOVERNMENTJOBS"],
    [/(^|\.)usajobs\.gov$/, "USAJOBS"],
  ];

  const REQ_ID_PATTERNS = [
    /\b(?:req(?:uisition)?|job|posting|position|vacancy|announcement)\s*(?:id|number|no\.?|#)\s*[:#-]?\s*([A-Z]{0,6}-?\d{2,}[A-Z0-9-]*)/i,
    /\b(?:req(?:uisition)?)\s*[:#-]?\s*([A-Z]{0,6}-?\d{2,}[A-Z0-9-]*)/i,
    /\b(R-?\d{4,})\b/,
    /\b(JR-?\d{4,})\b/i,
    /\b(REQ-?\d{3,})\b/i,
    /\b(\d{4,}BR)\b/,
    /\b([A-Z]{2,5}-\d{4,})\b/,
  ];

  const SALARY_RE =
    /(?:(?:USD|US\$|\$|CA\$|€|£)\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?\s?[kK]?(?:\s?(?:-|–|—|to)\s?(?:USD|US\$|\$|€|£)?\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?\s?[kK]?)?)(?:\s?(?:\/|per|an?|each)\s?(?:hour|hr|year|yr|annum|month|mo|week|wk|day)|\s?(?:hourly|annually|yearly|monthly))?/;

  /** Characters that always end a sentence (block edges are emitted as "\n"). */
  const HARD_BOUNDARY = /[\n\r•|]/;

  /** Page chrome that never holds a confirmation: its text is not searched for phrases. */
  const EXCLUDED_REGIONS = 'nav, footer, [role="navigation"], [role="contentinfo"]';
  /** Overlays / live alerts: where single-page apps render "Application sent" style confirmations. */
  const OVERLAY_REGIONS = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="alert"]';
  const HEADING_REGIONS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  /** Region ranks for a phrase hit (higher = stronger evidence). */
  const REGION = Object.freeze(["body", "heading", "overlay", "element"]);

  /** Inline formatting boxes: text inside them belongs to the surrounding block. */
  const INLINE_DISPLAYS = new Set(["inline", "contents"]);

  /** A selector that is only a tag name ("h1") identifies nothing platform-specific. */
  const BARE_TAG_SELECTOR = /^[a-z][a-z0-9]*$/i;

  /** Applicant contact details are masked out of any confirmation sentence. */
  const EMAIL_RE = /[^\s@<>()[\]"',;:]+@[^\s<>()[\]"',;:]*/g;
  const PHONE_CANDIDATE_RE = /(?<![\w-])\+?[\d(][\d\s().-]{7,}\d(?![\w-])/g;

  /* ------------------------------------------------------------------ */
  /* Text helpers                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Collapses whitespace, trims and caps the length.
   * @param {unknown} value
   * @param {number} [max]
   * @returns {string}
   */
  function sanitize(value, max = 500) {
    if (value == null) return "";
    const s = String(value).replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max).trim() : s;
  }

  /** @param {Element | null | undefined} el */
  function textOf(el) {
    return el ? sanitize(el.textContent, 2000) : "";
  }

  /**
   * First non-empty text among the given selectors.
   * @param {ParentNode} root
   * @param {string[]} selectors
   * @returns {{ text: string, selector: string } | null}
   */
  function firstText(root, selectors) {
    for (const selector of selectors) {
      let el = null;
      try {
        el = root.querySelector(selector);
      } catch {
        continue;
      }
      const text = textOf(el);
      if (text) return { text, selector };
    }
    return null;
  }

  /**
   * First non-empty attribute value among selectors.
   * @param {ParentNode} root
   * @param {Array<[string, string]>} pairs [selector, attribute]
   */
  function firstAttr(root, pairs) {
    for (const [selector, attr] of pairs) {
      let el = null;
      try {
        el = root.querySelector(selector);
      } catch {
        continue;
      }
      const v = el && sanitize(el.getAttribute(attr), 500);
      if (v) return { text: v, selector };
    }
    return null;
  }

  /** @param {Document} doc @param {string} name */
  function meta(doc, name) {
    const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el ? sanitize(el.getAttribute("content"), 500) : "";
  }

  /** @param {Element} el */
  function isElementVisible(el) {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    // Content of a closed <details> (FAQ accordions) is not rendered, but its
    // computed style still says display:block.
    const parent = el.parentElement;
    if (parent && parent.tagName === "DETAILS" && !parent.open && el.tagName !== "SUMMARY") return false;
    const view = el.ownerDocument.defaultView;
    if (!view) return true;
    const cs = view.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    return true;
  }

  /**
   * Visible, non-form text of the document (or a subtree), in document order.
   * Text of different block-level boxes (paragraphs, headings, list items,
   * table cells, inline-block chips, …) is joined with "\n" so a sentence can
   * never run from one element into the next; text inside one block is joined
   * with a space. Hidden subtrees (display:none, visibility:hidden,
   * hidden/aria-hidden, closed <details>) and form controls are skipped.
   * @param {Document | Element} root
   * @param {{ maxChars?: number, exclude?: string }} [opts] exclude: selector of subtrees to skip
   * @returns {{ text: string, starts: number[], nodes: Text[] }}
   */
  function collectText(root, opts = {}) {
    const maxChars = opts.maxChars ?? LIMITS.visibleText;
    const doc = root.nodeType === 9 ? /** @type {Document} */ (root) : root.ownerDocument;
    const start = root.nodeType === 9 ? doc.body : root;
    /** @type {{ text: string, starts: number[], nodes: Text[] }} */
    const out = { text: "", starts: [], nodes: [] };
    if (!start) return out;
    const excluded = new Set();
    if (opts.exclude) {
      try {
        for (const el of start.querySelectorAll(opts.exclude)) excluded.add(el);
      } catch {
        /* invalid selector: exclude nothing */
      }
    }
    const view = doc.defaultView;
    /** @type {Map<Element, boolean>} */
    const visCache = new Map();
    const visible = (el) => {
      if (visCache.has(el)) return visCache.get(el);
      let v = !excluded.has(el) && isElementVisible(el);
      if (v && el.parentElement && el !== start) v = visible(el.parentElement);
      visCache.set(el, v);
      return v;
    };
    /** @type {Map<Element, Element>} */
    const blockCache = new Map();
    const blockOf = (el) => {
      const chain = [];
      let cur = el;
      let block = start;
      while (cur && cur !== start) {
        if (blockCache.has(cur)) {
          block = blockCache.get(cur);
          break;
        }
        chain.push(cur);
        const display = view ? view.getComputedStyle(cur).display : "block";
        if (!INLINE_DISPLAYS.has(display)) {
          block = cur;
          break;
        }
        cur = cur.parentElement;
      }
      for (const c of chain) blockCache.set(c, block);
      return block;
    };
    const walker = doc.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (!visible(/** @type {Element} */ (node))) return NodeFilter.FILTER_REJECT;
          return /** @type {Element} */ (node).tagName === "BR" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (!parent || !visible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let lastBlock = null;
    let lineBreak = false;
    // Inside one block, adjacent text nodes are joined with a space only where
    // the markup has whitespace ("been <b>submitted</b>." → "been submitted.").
    let space = false;
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 1) {
        lineBreak = true; // <br>
        continue;
      }
      const raw = node.nodeValue || "";
      const t = raw.replace(/\s+/g, " ").trim();
      if (!t) {
        space = true;
        continue;
      }
      const block = blockOf(node.parentElement);
      if (out.text) out.text += lineBreak || block !== lastBlock ? "\n" : space || /^\s/.test(raw) ? " " : "";
      lineBreak = false;
      space = /\s$/.test(raw);
      lastBlock = block;
      out.starts.push(out.text.length);
      out.nodes.push(/** @type {Text} */ (node));
      out.text += t;
      if (out.text.length > maxChars) break;
    }
    return out;
  }

  /**
   * Visible, non-form text (see collectText); block edges are "\n".
   * @param {Document | Element} root
   * @param {number} [maxChars]
   */
  function visibleText(root, maxChars = LIMITS.visibleText) {
    return collectText(root, { maxChars }).text;
  }

  /** @param {string} text @param {number} i */
  function isSentenceEnd(text, i) {
    const c = text[i];
    if (HARD_BOUNDARY.test(c)) return true;
    // "." inside "x.com", "$28.50" or "R-1.2" is not a sentence end.
    return /[.!?]/.test(c) && (i + 1 >= text.length || /\s/.test(text[i + 1]));
  }

  /**
   * Masks e-mail addresses (also partial ones cut at a sentence end) and phone
   * numbers (10–15 digits) so applicant contact details never leave the page.
   * @param {string} text
   */
  function maskPii(text) {
    if (!text) return "";
    return String(text)
      .replace(EMAIL_RE, "[email]")
      .replace(PHONE_CANDIDATE_RE, (m) => {
        const digits = m.replace(/\D/g, "").length;
        return digits >= 10 && digits <= 15 ? "[phone]" : m;
      });
  }

  /**
   * Extracts the sentence around a match, capped at `max` characters and
   * centred on the match when the sentence is longer than the cap. The sentence
   * never extends past the block (element) that contains the match.
   * @param {string} text
   * @param {number} index
   * @param {number} length
   * @param {number} [max]
   */
  function extractSentence(text, index, length, max = LIMITS.confirmationText) {
    let start = index;
    while (start > 0 && !isSentenceEnd(text, start - 1) && index - start < 160) start--;
    let end = index + length;
    while (end < text.length && !isSentenceEnd(text, end) && end - index < 240) end++;
    if (end < text.length && /[.!?]/.test(text[end])) end++;
    let sentence = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (sentence.length > max) {
      const matchStart = index - start;
      const from = Math.max(0, Math.min(matchStart - Math.floor((max - length) / 2), sentence.length - max));
      sentence = sentence.slice(from, from + max).trim();
    }
    return sentence;
  }

  const WORD_CHAR = /[\p{L}\p{N}]/u;

  /** Is text[index, index+length) a whole-word occurrence? */
  function wordBounded(text, index, length) {
    const before = index > 0 ? text[index - 1] : "";
    const after = text[index + length] || "";
    return !(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after));
  }

  /** Text node that contains offset `index` of a collectText() result. */
  function nodeAt(collected, index) {
    let lo = 0;
    let hi = collected.starts.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (collected.starts[mid] <= index) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found === -1 ? null : collected.nodes[found];
  }

  /**
   * Where on the page a text node sits: 3 inside a platform confirmation
   * element, 2 inside a dialog/alert, 1 inside a heading, 0 anywhere else.
   * @param {Node | null} node
   * @param {string[]} confirmationSelectors
   */
  function regionRank(node, confirmationSelectors = []) {
    const el = node && node.parentElement;
    if (!el) return 0;
    for (const selector of confirmationSelectors) {
      try {
        if (el.closest(selector)) return 3;
      } catch {
        /* invalid selector */
      }
    }
    if (el.closest(OVERLAY_REGIONS)) return 2;
    if (el.closest(HEADING_REGIONS)) return 1;
    return 0;
  }

  /**
   * Finds the best whole-word occurrence of any phrase (case-insensitive):
   * occurrences inside a confirmation element beat dialogs, which beat
   * headings, which beat body text; ties go to the earlier phrase.
   * @param {{ text: string, starts: number[], nodes: Text[] }} collected
   * @param {string[]} phrases
   * @param {string[]} [confirmationSelectors]
   * @returns {{ phrase: string, sentence: string, region: string } | null}
   */
  function locatePhrase(collected, phrases, confirmationSelectors = []) {
    const text = collected.text;
    if (!text) return null;
    const lower = text.toLowerCase();
    let best = null;
    for (const phrase of phrases) {
      const p = String(phrase || "").toLowerCase();
      if (!p) continue;
      let from = 0;
      for (let n = 0; n < 25; n++) {
        const i = lower.indexOf(p, from);
        if (i === -1) break;
        from = i + 1;
        if (!wordBounded(lower, i, p.length)) continue;
        const rank = regionRank(nodeAt(collected, i), confirmationSelectors);
        if (!best || rank > best.rank) best = { phrase, index: i, length: p.length, rank };
        if (rank === 3) break;
      }
      if (best && best.rank === 3) break;
    }
    if (!best) return null;
    return { phrase: best.phrase, sentence: maskPii(extractSentence(text, best.index, best.length)), region: REGION[best.rank] };
  }

  /**
   * Ambiguous one-word phrases ("Applied") count only as a standalone badge or
   * button: the whole text of an element must be the phrase (ignoring
   * punctuation/symbols such as "✓"), so "Applied Materials" or "applied
   * behavior analysis" never match. A phrase that appears on more than one
   * element is a list of badges, not a confirmation, and is ignored.
   * @param {{ text: string, starts: number[], nodes: Text[] }} collected
   * @param {string[]} phrases
   * @param {string[]} [confirmationSelectors]
   */
  function findStandalonePhrase(collected, phrases, confirmationSelectors = []) {
    for (const phrase of phrases) {
      const escaped = String(phrase || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!escaped) continue;
      const re = new RegExp(`^[^\\p{L}\\p{N}]*${escaped}[^\\p{L}\\p{N}]*$`, "iu");
      const hits = [];
      for (const node of collected.nodes) {
        if (!re.test(sanitize(node.nodeValue, 200))) continue;
        const el = node.parentElement;
        if (!el || !re.test(sanitize(el.textContent, 200))) continue;
        hits.push(node);
        if (hits.length > 1) break;
      }
      if (hits.length === 1) {
        return { phrase, sentence: sanitize(hits[0].nodeValue, LIMITS.confirmationText), region: REGION[regionRank(hits[0], confirmationSelectors)] };
      }
      if (hits.length > 1) return null;
    }
    return null;
  }

  /**
   * Looks for any of the phrases in the visible text (whole words,
   * case-insensitive). Navigation and footer text is ignored.
   * @param {Document | Element} root
   * @param {string[]} phrases
   * @returns {{ phrase: string, sentence: string } | null}
   */
  function findConfirmation(root, phrases) {
    const hit = locatePhrase(collectText(root, { exclude: EXCLUDED_REGIONS }), phrases);
    return hit ? { phrase: hit.phrase, sentence: hit.sentence } : null;
  }

  /** decodeURIComponent that never throws (URLs may contain a stray "%"). @param {string} value */
  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return String(value ?? "");
    }
  }

  /**
   * Best-effort requisition / job id from free text or a URL.
   * @param {string | null | undefined} text
   */
  function extractRequisitionId(text) {
    if (!text) return "";
    for (const re of REQ_ID_PATTERNS) {
      const m = text.match(re);
      if (m && m[1] && /\d/.test(m[1])) return sanitize(m[1].toUpperCase(), LIMITS.requisitionId);
    }
    return "";
  }

  /** @param {string | null | undefined} text */
  function extractSalaryText(text) {
    if (!text) return "";
    const m = text.match(SALARY_RE);
    return m ? sanitize(m[0], LIMITS.salaryText) : "";
  }

  /** @param {string} url @param {string[]} fragments */
  function urlHasAny(url, fragments) {
    const u = String(url || "").toLowerCase();
    return fragments.some((f) => u.includes(f.toLowerCase()));
  }

  /** Platform enum value for a URL host. @param {string} url */
  function platformForUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      for (const [re, platform] of HOST_PLATFORMS) if (re.test(host)) return platform;
      return "COMPANY_SITE";
    } catch {
      return "OTHER";
    }
  }

  /** Canonical page URL (link[rel=canonical] on the same host, else the given URL) without fragment. */
  function canonicalUrl(doc, url) {
    const link = doc.querySelector('link[rel="canonical"]');
    const href = link && link.getAttribute("href");
    let out = url;
    if (href) {
      try {
        const c = new URL(href, url);
        const u = new URL(url);
        if (c.hostname === u.hostname) out = c.toString();
      } catch {
        /* ignore */
      }
    }
    const i = out.indexOf("#");
    return sanitize(i === -1 ? out : out.slice(0, i), LIMITS.url);
  }

  /* ------------------------------------------------------------------ */
  /* Structured data                                                      */
  /* ------------------------------------------------------------------ */

  /** @param {unknown} v */
  function asArray(v) {
    return Array.isArray(v) ? v : v == null ? [] : [v];
  }

  /** @param {unknown} node */
  function isJobPosting(node) {
    if (!node || typeof node !== "object") return false;
    const t = /** @type {any} */ (node)["@type"];
    return asArray(t).some((x) => String(x).toLowerCase() === "jobposting");
  }

  /** Depth-first search for JobPosting nodes (handles @graph, arrays, mainEntity). */
  function collectJobPostings(node, out, depth = 0) {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node)) {
      for (const n of node) collectJobPostings(n, out, depth + 1);
      return;
    }
    if (isJobPosting(node)) out.push(node);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
      if (node[key]) collectJobPostings(node[key], out, depth + 1);
    }
  }

  /** @param {any} loc */
  function formatJobLocation(loc) {
    const parts = [];
    for (const l of asArray(loc)) {
      if (!l) continue;
      if (typeof l === "string") {
        parts.push(l);
        continue;
      }
      const addr = l.address || l;
      if (typeof addr === "string") {
        parts.push(addr);
        continue;
      }
      const segs = [addr.addressLocality, addr.addressRegion, addr.addressCountry && typeof addr.addressCountry === "object" ? addr.addressCountry.name : addr.addressCountry].filter(Boolean);
      if (segs.length) parts.push(segs.join(", "));
      else if (l.name) parts.push(l.name);
    }
    return sanitize(parts.filter(Boolean).slice(0, 3).join(" · "), LIMITS.location);
  }

  /** @param {any} salary */
  function formatBaseSalary(salary) {
    if (!salary) return "";
    if (typeof salary === "string") return extractSalaryText(salary) || sanitize(salary, LIMITS.salaryText);
    const currency = salary.currency || "";
    const value = salary.value;
    const unit = (value && value.unitText) || salary.unitText || "";
    const fmt = (n) => (n == null || n === "" ? null : Number(n).toLocaleString("en-US"));
    let range = "";
    if (value && typeof value === "object") {
      const min = fmt(value.minValue);
      const max = fmt(value.maxValue);
      const single = fmt(value.value);
      if (min && max) range = `${min} - ${max}`;
      else range = single || min || max || "";
    } else if (value != null) {
      range = fmt(value) || "";
    }
    if (!range) return "";
    const unitLabel = unit ? ` per ${String(unit).toLowerCase()}` : "";
    return sanitize(`${currency === "USD" ? "$" : currency ? currency + " " : ""}${range}${unitLabel}`, LIMITS.salaryText);
  }

  /**
   * Parses schema.org JobPosting JSON-LD from the document.
   * @param {Document} doc
   * @returns {{ title: string, company: string, location: string, salaryText: string, requisitionId: string, url: string } | null}
   */
  function parseJsonLdJobPosting(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const postings = [];
    for (const s of scripts) {
      let data;
      try {
        data = JSON.parse(s.textContent || "");
      } catch {
        continue;
      }
      collectJobPostings(data, postings);
    }
    const job = postings[0];
    if (!job) return null;
    const org = job.hiringOrganization;
    const company = typeof org === "string" ? org : org && (org.name || org.legalName);
    const identifier = job.identifier;
    const reqRaw = typeof identifier === "string" ? identifier : identifier && (identifier.value || identifier.name);
    return {
      title: sanitize(job.title || job.name, LIMITS.title),
      company: sanitize(company, LIMITS.company),
      location: formatJobLocation(job.jobLocation) || (job.jobLocationType ? sanitize(job.jobLocationType, LIMITS.location) : ""),
      salaryText: formatBaseSalary(job.baseSalary || job.estimatedSalary),
      requisitionId: sanitize(reqRaw, LIMITS.requisitionId),
      url: sanitize(job.url, LIMITS.url),
    };
  }

  /**
   * Open Graph / meta fallbacks.
   * @param {Document} doc
   */
  function metaFallbacks(doc) {
    const title = meta(doc, "og:title") || meta(doc, "twitter:title") || sanitize(doc.title, LIMITS.pageTitle);
    return {
      title: sanitize(title, LIMITS.title),
      siteName: sanitize(meta(doc, "og:site_name"), LIMITS.company),
      description: sanitize(meta(doc, "og:description") || meta(doc, "description"), 1000),
    };
  }

  const SITE_NAME_RE = /^(indeed(\.com)?|linkedin|glassdoor|ziprecruiter|workday|greenhouse|lever|smartrecruiters|icims|adp|governmentjobs|usajobs|careers?|jobs?|career pages|job details tab)$/i;

  /**
   * Splits "Electrician - Acme Corp - Irvine, CA | Indeed.com"-style titles.
   * Leading "(3) " notification counters and trailing site names are dropped.
   * @param {string} pageTitle
   * @returns {{ title: string, company: string, location: string }}
   */
  function splitTitle(pageTitle) {
    const cleaned = sanitize(pageTitle, LIMITS.pageTitle).replace(/^\(\d+\)\s*/, "");
    const parts = cleaned.split(/\s+[-–—|·]\s+/).map((p) => p.trim()).filter(Boolean);
    while (parts.length > 1 && SITE_NAME_RE.test(parts[parts.length - 1])) parts.pop();
    return { title: parts[0] || "", company: parts[1] || "", location: parts[2] || "" };
  }

  /** Strips "Req ID:" / "Job Number -" style labels from a requisition value. */
  function stripRequisitionLabel(text) {
    return sanitize(text, 200).replace(/^(?:(?:req(?:uisition)?|job|posting|position|vacancy|announcement)\s*)?(?:id|number|no\.?|#)?\s*[:#–-]?\s*/i, "").trim();
  }

  /* ------------------------------------------------------------------ */
  /* Scoring                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Confidence for a confirmation signal (product rules). Only a phrase that is
   * corroborated by a platform confirmation route or element reaches the
   * auto-record threshold (0.8); everything else is a prompt for the user.
   *   strong phrase + route + element → 0.95
   *   strong phrase + route or element → 0.9
   *   strong phrase only → 0.7 (prompt)
   *   weak phrase ("Applied") + route/element → 0.7, alone → 0.6 (prompt)
   *   route or element only → 0.7 (prompt)
   * @param {{ phrase: boolean, route: boolean, element: boolean, weak?: boolean }} signals
   */
  function scoreConfirmation(signals) {
    const corroborated = !!(signals.route || signals.element);
    if (signals.phrase && !signals.weak) {
      if (signals.route && signals.element) return 0.95;
      return corroborated ? 0.9 : 0.7;
    }
    if (signals.phrase) return corroborated ? 0.7 : 0.6;
    return corroborated ? 0.7 : 0;
  }

  /**
   * Builds a normalised detection result.
   * @param {Partial<import("../lib/capture.js").Detection> & { platform: string, url: string }} partial
   */
  function makeResult(partial) {
    const r = {
      kind: partial.kind ?? null,
      platform: partial.platform,
      url: sanitize(partial.url, LIMITS.url),
      pageTitle: sanitize(partial.pageTitle, LIMITS.pageTitle),
      company: sanitize(partial.company, LIMITS.company),
      title: sanitize(partial.title, LIMITS.title),
      location: sanitize(partial.location, LIMITS.location),
      salaryText: sanitize(partial.salaryText, LIMITS.salaryText),
      requisitionId: sanitize(partial.requisitionId, LIMITS.requisitionId),
      confidence: Math.min(1, Math.max(0, Number(partial.confidence) || 0)),
      detectedBy: Array.isArray(partial.detectedBy) ? partial.detectedBy.slice(0, 20) : [],
    };
    if (partial.confirmationText) r.confirmationText = sanitize(maskPii(partial.confirmationText), LIMITS.confirmationText);
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Runtime: observe the page, talk to the background worker             */
  /* ------------------------------------------------------------------ */

  const hasRuntime = () => typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;

  /**
   * Debounced MutationObserver + URL poll so SPA navigations and late-rendered
   * confirmation banners are noticed.
   * @param {{ onChange: () => void, debounceMs?: number, maxWaitMs?: number, pollMs?: number }} opts
   * @returns {() => void} stop function
   */
  function watchPage({ onChange, debounceMs = 600, maxWaitMs = 2500, pollMs = 1000 }) {
    let timer = null;
    let firstPending = 0;
    const fire = () => {
      timer = null;
      firstPending = 0;
      onChange();
    };
    const schedule = () => {
      const now = Date.now();
      if (!firstPending) firstPending = now;
      if (timer) clearTimeout(timer);
      const wait = now - firstPending >= maxWaitMs ? 0 : debounceMs;
      timer = setTimeout(fire, wait);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    let lastHref = location.href;
    const poll = setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        schedule();
      }
    }, pollMs);
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      observer.disconnect();
      clearInterval(poll);
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("hashchange", schedule);
      if (timer) clearTimeout(timer);
    };
  }

  /**
   * Registers a platform detector. Sets `window.__cqDetect` and, when running as
   * a real content script, reports detections to the background worker whenever
   * they change.
   * @param {{ platform: string, detect: (doc: Document, url: string) => object | null, autoRun?: boolean }} spec
   */
  function registerDetector(spec) {
    const run = () => {
      try {
        return spec.detect(document, location.href);
      } catch (err) {
        return makeResult({ platform: spec.platform, url: location.href, pageTitle: document.title, detectedBy: [`error:${(err && err.message) || "detect"}`] });
      }
    };
    window.__cqDetect = run;
    if (spec.autoRun === false || !hasRuntime()) return;

    let lastSerialized = "";
    const report = () => {
      const detection = run();
      const serialized = JSON.stringify(detection);
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;
      try {
        chrome.runtime.sendMessage({ type: "cq:detection", detection }, () => void chrome.runtime.lastError);
      } catch {
        /* extension reloaded; nothing to do */
      }
    };
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === "cq:detect-now") {
        sendResponse({ detection: run() });
        return false;
      }
      return false;
    });
    report();
    watchPage({ onChange: report });
  }


  /* ------------------------------------------------------------------ */
  /* Config-driven detector shared by every platform script               */
  /* ------------------------------------------------------------------ */

  /** Element and all ancestors visible? @param {Element | null} el */
  function isVisibleDeep(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (!isElementVisible(node)) return false;
    }
    return !!el;
  }

  /**
   * First selector that matches a visible element.
   * @param {ParentNode} root
   * @param {string[]} selectors
   */
  function firstVisible(root, selectors) {
    for (const selector of selectors) {
      let els;
      try {
        els = root.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of els) if (isVisibleDeep(el)) return selector;
    }
    return null;
  }

  /**
   * Phrase search over an already-computed visible text string (whole words).
   * @param {string} text
   * @param {string[]} phrases
   */
  function findPhrase(text, phrases) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
      const p = phrase.toLowerCase();
      let from = 0;
      for (let n = 0; n < 25; n++) {
        const i = lower.indexOf(p, from);
        if (i === -1) break;
        from = i + 1;
        if (wordBounded(lower, i, p.length)) return { phrase, sentence: maskPii(extractSentence(text, i, p.length)) };
      }
    }
    return null;
  }

  /** First visible element matching any selector (or null). */
  function firstVisibleElement(root, selectors) {
    for (const selector of selectors || []) {
      let els;
      try {
        els = root.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of els) if (isVisibleDeep(el)) return el;
    }
    return null;
  }

  /**
   * @typedef {object} DetectorConfig
   * @property {string} platform
   * @property {string[]} confirmationPhrases      strong phrases (whole words)
   * @property {string[]} [weakPhrases]            ambiguous one-word phrases: only as a standalone badge, never above 0.7
   * @property {string[]} [confirmationRoutes]     URL fragments of confirmation routes
   * @property {string[]} [confirmationSelectors]  platform-specific confirmation elements
   * @property {string[]} [applyRoutes]            URL fragments of the apply flow
   * @property {string[]} [applySelectors]         apply-form elements
   * @property {string[]} [jobContainers]          posting/description containers: free-text scans are limited to these when present
   * @property {{ title?: string[], company?: string[], location?: string[], salaryText?: string[], requisitionId?: string[] }} [selectors]
   * @property {Array<[string, string]>} [companyAttrs]   [selector, attribute] fallbacks for company (e.g. logo alt)
   * @property {(doc: Document, url: string, fields: Record<string, string>, detectedBy: string[]) => void} [custom]
   * @property {(doc: Document, url: string, fields: Record<string, string>, detectedBy: string[]) => void} [fallback]
   * @property {boolean} [scanTextForRequisition]  default true (job postings only)
   * @property {boolean} [scanTextForSalary]       default true (job postings only)
   * @property {boolean} [lenientJobEvidence]      user-initiated capture: any title counts as a job page
   */

  /**
   * Builds a detect(doc, url) function from declarative config.
   *
   * Field precedence: JSON-LD → platform selectors → custom hook → og:site_name →
   * URL → (job postings only) text scans of the posting → fallback hook →
   * (job postings only) <title>/og:title split.
   *
   * Privacy: the free-text salary / requisition scans run only when the page
   * was identified as a job posting (JSON-LD JobPosting or a platform-specific
   * title/company element) and is neither an apply form nor a confirmation, so
   * an applicant's own answers on review/confirmation pages are never read.
   * @param {DetectorConfig} config
   */
  function createDetector(config) {
    const sel = config.selectors || {};
    const confirmationSelectors = config.confirmationSelectors || [];
    return function detect(doc, url) {
      const pageTitle = doc.title;
      const detectedBy = [];
      const fields = { company: "", title: "", location: "", salaryText: "", requisitionId: "" };

      // 1. JSON-LD JobPosting.
      const ld = parseJsonLdJobPosting(doc);
      const hasJsonLd = !!(ld && (ld.title || ld.company));
      if (hasJsonLd) {
        Object.assign(fields, { company: ld.company, title: ld.title, location: ld.location, salaryText: ld.salaryText, requisitionId: ld.requisitionId });
        detectedBy.push("jsonld");
      }

      // 2. Platform selectors fill the gaps. A title/company hit from a
      //    platform-specific selector (not a bare "h1") is evidence of a posting.
      let selectorHits = 0;
      let jobElementHits = 0;
      for (const key of ["title", "company", "location", "salaryText", "requisitionId"]) {
        if (fields[key] || !sel[key]) continue;
        const hit = firstText(doc, sel[key]);
        if (!hit) continue;
        if (key === "requisitionId") {
          const bare = stripRequisitionLabel(hit.text);
          fields.requisitionId = /^\S{2,64}$/.test(bare) ? bare : extractRequisitionId(hit.text) || bare.slice(0, LIMITS.requisitionId);
        } else {
          fields[key] = hit.text;
        }
        detectedBy.push(`selector:${key}`);
        selectorHits++;
        if ((key === "title" || key === "company") && !BARE_TAG_SELECTOR.test(hit.selector)) jobElementHits++;
      }
      if (!fields.company && config.companyAttrs) {
        const hit = firstAttr(doc, config.companyAttrs);
        if (hit) {
          fields.company = hit.text;
          detectedBy.push("attr:company");
          selectorHits++;
          jobElementHits++;
        }
      }

      // 3. Platform-specific logic, then cheap generic sources.
      if (config.custom) config.custom(doc, url, fields, detectedBy);
      if (!fields.company) {
        const site = meta(doc, "og:site_name");
        if (site) {
          fields.company = site;
          detectedBy.push("og:site_name");
        }
      }
      if (!fields.requisitionId) {
        const fromUrl = extractRequisitionId(safeDecode(url));
        if (fromUrl) {
          fields.requisitionId = fromUrl;
          detectedBy.push("url:requisition");
        }
      }
      const jobEvidence = hasJsonLd || jobElementHits > 0 || !!config.lenientJobEvidence;

      // 4. Confirmation signals. Phrases are searched in visible text outside
      //    nav/footer; strong phrases on whole words, weak ones only as a badge.
      //    (No <title> fallback here: on apply/confirmation pages the title is
      //    usually the site name; the background pre-fills missing job details
      //    from the job page seen earlier in the tab.)
      const collected = collectText(doc, { exclude: EXCLUDED_REGIONS });
      const route = urlHasAny(url, config.confirmationRoutes || []);
      const element = firstVisible(doc, confirmationSelectors);
      let found = locatePhrase(collected, config.confirmationPhrases || [], confirmationSelectors);
      let weak = false;
      if (!found) {
        found = findStandalonePhrase(collected, config.weakPhrases || [], confirmationSelectors);
        weak = !!found;
      }
      // JSON-LD JobPosting says "this is a posting": a phrase in its description
      // or a status line proves nothing. It still counts inside the platform's
      // confirmation element or a dialog/alert, or as a heading on a page that
      // also has a confirmation route/element.
      let phraseCounts = !!found;
      if (found && hasJsonLd && found.region !== "element" && found.region !== "overlay" && !(found.region === "heading" && (route || element))) {
        phraseCounts = false;
      }
      const confirmationScore = scoreConfirmation({ phrase: phraseCounts, weak, route, element: !!element });

      // 5. Apply flow (never recorded as submitted).
      const applyRoute = urlHasAny(url, config.applyRoutes || []);
      const applyEl = firstVisible(doc, config.applySelectors || []);

      const kind = confirmationScore >= 0.5 ? "CONFIRMATION_PAGE" : applyRoute || applyEl ? "APPLY_STARTED" : jobEvidence ? "JOB_PAGE" : null;

      // 6. Free-text scans: job postings only, limited to the posting container when known.
      if (kind === "JOB_PAGE" && (!fields.requisitionId || !fields.salaryText)) {
        const scope = firstVisibleElement(doc, config.jobContainers) || doc;
        const text = visibleText(scope, 20000);
        if (!fields.requisitionId && config.scanTextForRequisition !== false) {
          const id = extractRequisitionId(text);
          if (id) {
            fields.requisitionId = id;
            detectedBy.push("text:requisition");
          }
        }
        if (!fields.salaryText && config.scanTextForSalary !== false) {
          const s = extractSalaryText(text);
          if (s) {
            fields.salaryText = s;
            detectedBy.push("text:salary");
          }
        }
      }
      if (config.fallback) config.fallback(doc, url, fields, detectedBy);
      if (fields.requisitionId) fields.requisitionId = fields.requisitionId.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (fields.title && /\s[|·]\s/.test(fields.title)) fields.title = splitTitle(fields.title).title;

      const base = { platform: config.platform, url: canonicalUrl(doc, url), pageTitle };

      if (kind === "CONFIRMATION_PAGE") {
        const by = [...detectedBy];
        if (phraseCounts) by.push(`${weak ? "weak-phrase" : "phrase"}:${found.phrase}`);
        if (route) by.push("confirmation-route");
        if (element) by.push(`confirmation-element:${element}`);
        // A heading such as "Thank you for applying!" picked up by a generic
        // title selector is not the job title.
        const confirmationFields = { ...fields };
        const phrases = [...(config.confirmationPhrases || []), ...(config.weakPhrases || [])];
        if (confirmationFields.title && findPhrase(confirmationFields.title, phrases)) {
          confirmationFields.title = "";
          const i = by.indexOf("selector:title");
          if (i !== -1) by.splice(i, 1);
        }
        return makeResult({ ...base, ...confirmationFields, kind, confidence: confirmationScore, detectedBy: by, confirmationText: phraseCounts ? found.sentence : undefined });
      }

      if (kind === "APPLY_STARTED") {
        const by = [...detectedBy];
        if (applyRoute) by.push("apply-route");
        if (applyEl) by.push(`apply-element:${applyEl}`);
        return makeResult({ ...base, ...fields, kind, confidence: 0.5, detectedBy: by });
      }

      // 7. Job page: last resort for the title is the page title / Open Graph
      //    title, but only on a page already identified as a posting.
      if (kind === "JOB_PAGE") {
        if (!fields.title) {
          const m = metaFallbacks(doc);
          if (m.title) {
            const split = splitTitle(m.title);
            fields.title = split.title;
            if (!fields.company && split.company) fields.company = split.company;
            if (!fields.location && split.location) fields.location = split.location;
            detectedBy.push("meta");
          }
        }
        if (fields.title) {
          const confidence = hasJsonLd ? 0.9 : jobElementHits > 0 ? 0.7 : 0.5;
          return makeResult({ ...base, ...fields, kind: "JOB_PAGE", confidence, detectedBy });
        }
      }
      // Not recognisably a posting (account pages, candidate home, …): report the
      // fields as hints only; the background never prompts or looks these up.
      return makeResult({ ...base, ...fields, kind: null, confidence: 0, detectedBy });
    };
  }

  /** "acme-corp" → "Acme Corp" (used for company guesses from hostnames/paths). */
  function titleCase(slug) {
    return sanitize(String(slug || "").replace(/[-_]+/g, " "), 100).replace(/\b\w/g, (c) => c.toUpperCase());
  }

  window.__cqCommon = Object.freeze({
    LIMITS,
    sanitize,
    textOf,
    firstText,
    firstAttr,
    meta,
    visibleText,
    collectText,
    extractSentence,
    maskPii,
    locatePhrase,
    findStandalonePhrase,
    findConfirmation,
    safeDecode,
    extractRequisitionId,
    extractSalaryText,
    urlHasAny,
    platformForUrl,
    canonicalUrl,
    parseJsonLdJobPosting,
    metaFallbacks,
    splitTitle,
    stripRequisitionLabel,
    scoreConfirmation,
    makeResult,
    watchPage,
    registerDetector,
    createDetector,
    isVisibleDeep,
    firstVisible,
    findPhrase,
    firstVisibleElement,
    titleCase,
    EXCLUDED_REGIONS,
  });
})();
