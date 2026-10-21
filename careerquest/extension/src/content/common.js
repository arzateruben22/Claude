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

  const SENTENCE_BOUNDARY = /[.!?\n\r•|]/;

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
    const view = el.ownerDocument.defaultView;
    if (!view) return true;
    const cs = view.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    return true;
  }

  /**
   * Visible, non-form text of the document (or a subtree), whitespace-collapsed.
   * Hidden subtrees (display:none, visibility:hidden, hidden/aria-hidden) are skipped.
   * @param {Document | Element} root
   * @param {number} [maxChars]
   */
  function visibleText(root, maxChars = LIMITS.visibleText) {
    const doc = root.nodeType === 9 ? /** @type {Document} */ (root) : root.ownerDocument;
    const start = root.nodeType === 9 ? doc.body : root;
    if (!start) return "";
    /** @type {Map<Element, boolean>} */
    const cache = new Map();
    const visible = (el) => {
      if (cache.has(el)) return cache.get(el);
      let v = isElementVisible(el);
      if (v && el.parentElement && el !== start) v = visible(el.parentElement);
      cache.set(el, v);
      return v;
    };
    const walker = doc.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !visible(parent)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const parts = [];
    let total = 0;
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue.replace(/\s+/g, " ");
      parts.push(t);
      total += t.length;
      if (total > maxChars) break;
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  /**
   * Extracts the sentence around a match, capped at `max` characters and
   * centred on the match when the sentence is longer than the cap.
   * @param {string} text
   * @param {number} index
   * @param {number} length
   * @param {number} [max]
   */
  function extractSentence(text, index, length, max = LIMITS.confirmationText) {
    let start = index;
    while (start > 0 && !SENTENCE_BOUNDARY.test(text[start - 1]) && index - start < 160) start--;
    let end = index + length;
    while (end < text.length && !SENTENCE_BOUNDARY.test(text[end]) && end - index < 240) end++;
    if (end < text.length && /[.!?]/.test(text[end])) end++;
    let sentence = text.slice(start, end).trim();
    if (sentence.length > max) {
      const matchStart = index - start;
      const from = Math.max(0, Math.min(matchStart - Math.floor((max - length) / 2), sentence.length - max));
      sentence = sentence.slice(from, from + max).trim();
    }
    return sentence;
  }

  /**
   * Looks for any of the phrases in the visible text (case-insensitive).
   * @param {Document | Element} root
   * @param {string[]} phrases
   * @returns {{ phrase: string, sentence: string } | null}
   */
  function findConfirmation(root, phrases) {
    const text = visibleText(root);
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
      const p = phrase.toLowerCase();
      const i = lower.indexOf(p);
      if (i !== -1) return { phrase, sentence: extractSentence(text, i, p.length) };
    }
    return null;
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
   * Confidence for a confirmation signal (product rules):
   * platform element/URL + phrase → ≥ 0.9, phrase only → 0.8, route only → 0.7.
   * @param {{ phrase: boolean, route: boolean, element: boolean }} signals
   */
  function scoreConfirmation(signals) {
    if (signals.phrase && signals.route && signals.element) return 0.95;
    if (signals.phrase && (signals.route || signals.element)) return 0.9;
    if (signals.phrase) return 0.8;
    if (signals.route || signals.element) return 0.7;
    return 0;
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
    if (partial.confirmationText) r.confirmationText = sanitize(partial.confirmationText, LIMITS.confirmationText);
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
   * Phrase search over an already-computed visible text string.
   * @param {string} text
   * @param {string[]} phrases
   */
  function findPhrase(text, phrases) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
      const p = phrase.toLowerCase();
      const i = lower.indexOf(p);
      if (i !== -1) return { phrase, sentence: extractSentence(text, i, p.length) };
    }
    return null;
  }

  /**
   * @typedef {object} DetectorConfig
   * @property {string} platform
   * @property {string[]} confirmationPhrases      strong phrases: phrase alone → 0.8
   * @property {string[]} [weakPhrases]            ambiguous phrases: alone → 0.6 (prompt), with route/element → ≥ 0.9
   * @property {string[]} [confirmationRoutes]     URL fragments of confirmation routes
   * @property {string[]} [confirmationSelectors]  platform-specific confirmation elements
   * @property {string[]} [applyRoutes]            URL fragments of the apply flow
   * @property {string[]} [applySelectors]         apply-form elements
   * @property {{ title?: string[], company?: string[], location?: string[], salaryText?: string[], requisitionId?: string[] }} [selectors]
   * @property {Array<[string, string]>} [companyAttrs]   [selector, attribute] fallbacks for company (e.g. logo alt)
   * @property {(doc: Document, url: string, fields: Record<string, string>, detectedBy: string[]) => void} [custom]
   * @property {boolean} [scanTextForRequisition]  default true
   * @property {boolean} [scanTextForSalary]       default true
   */

  /**
   * Builds a detect(doc, url) function from declarative config.
   * Field precedence: JSON-LD → platform selectors → custom hook → og:site_name →
   * URL/text scans → fallback hook → (job pages only) <title>/og:title split.
   * @param {DetectorConfig} config
   */
  function createDetector(config) {
    const sel = config.selectors || {};
    return function detect(doc, url) {
      const pageTitle = doc.title;
      const detectedBy = [];
      const text = visibleText(doc);
      const fields = { company: "", title: "", location: "", salaryText: "", requisitionId: "" };

      // 1. JSON-LD JobPosting.
      const ld = parseJsonLdJobPosting(doc);
      const hasJsonLd = !!(ld && (ld.title || ld.company));
      if (hasJsonLd) {
        Object.assign(fields, { company: ld.company, title: ld.title, location: ld.location, salaryText: ld.salaryText, requisitionId: ld.requisitionId });
        detectedBy.push("jsonld");
      }

      // 2. Platform selectors fill the gaps.
      let selectorHits = 0;
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
      }
      if (!fields.company && config.companyAttrs) {
        const hit = firstAttr(doc, config.companyAttrs);
        if (hit) {
          fields.company = hit.text;
          detectedBy.push("attr:company");
          selectorHits++;
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
        const fromUrl = extractRequisitionId(decodeURIComponent(url));
        if (fromUrl) {
          fields.requisitionId = fromUrl;
          detectedBy.push("url:requisition");
        }
      }
      if (!fields.requisitionId && config.scanTextForRequisition !== false) {
        const id = extractRequisitionId(text.slice(0, 20000));
        if (id) {
          fields.requisitionId = id;
          detectedBy.push("text:requisition");
        }
      }
      if (!fields.salaryText && config.scanTextForSalary !== false) {
        const s = extractSalaryText(text.slice(0, 20000));
        if (s) {
          fields.salaryText = s;
          detectedBy.push("text:salary");
        }
      }
      if (config.fallback) config.fallback(doc, url, fields, detectedBy);
      if (fields.requisitionId) fields.requisitionId = fields.requisitionId.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (fields.title && /\s[|·]\s/.test(fields.title)) fields.title = splitTitle(fields.title).title;

      const base = { platform: config.platform, url: canonicalUrl(doc, url), pageTitle, ...fields };

      // 4. Confirmation signals. (No <title> fallback here: on apply/confirmation
      //    pages the title is usually the site name; the background pre-fills
      //    missing job details from the job page seen earlier in the tab.)
      const strong = findPhrase(text, config.confirmationPhrases || []);
      const weak = strong ? null : findPhrase(text, config.weakPhrases || []);
      const found = strong || weak;
      const route = urlHasAny(url, config.confirmationRoutes || []);
      const element = firstVisible(doc, config.confirmationSelectors || []);
      if (found || route || element) {
        let confidence = scoreConfirmation({ phrase: !!found, route, element: !!element });
        if (weak && !route && !element) confidence = 0.6;
        if (confidence >= 0.5) {
          const by = [...detectedBy];
          if (found) by.push(`phrase:${found.phrase}`);
          if (route) by.push("confirmation-route");
          if (element) by.push(`confirmation-element:${element}`);
          return makeResult({ ...base, kind: "CONFIRMATION_PAGE", confidence, detectedBy: by, confirmationText: found ? found.sentence : undefined });
        }
      }

      // 5. Apply flow (never recorded as submitted).
      const applyRoute = urlHasAny(url, config.applyRoutes || []);
      const applyEl = firstVisible(doc, config.applySelectors || []);
      if (applyRoute || applyEl) {
        const by = [...detectedBy];
        if (applyRoute) by.push("apply-route");
        if (applyEl) by.push(`apply-element:${applyEl}`);
        return makeResult({ ...base, kind: "APPLY_STARTED", confidence: 0.5, detectedBy: by });
      }

      // 6. Job page: last resort is the page title / Open Graph title.
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
      if (fields.title && (fields.company || selectorHits > 0 || hasJsonLd)) {
        const confidence = hasJsonLd ? 0.9 : selectorHits > 0 ? 0.7 : 0.5;
        return makeResult({ ...base, ...fields, kind: "JOB_PAGE", confidence, detectedBy });
      }
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
    extractSentence,
    findConfirmation,
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
    titleCase,
  });
})();
