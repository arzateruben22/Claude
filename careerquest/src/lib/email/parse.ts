/**
 * Email parsing for every email path (Gmail/Outlook sync, EML/MBOX upload, pasted source).
 *
 * Produces a provider-neutral `ParsedEmail`: identifiers, addresses, subject, Date header, readable
 * plain text (HTML converted, attachments ignored, capped at 200 KB) and the few headers the
 * classifier uses. Nothing here touches the database.
 */
import { createHash } from "node:crypto";
import { simpleParser, type AddressObject } from "mailparser";
import {
  htmlToTextWithLinks,
  linksFromPlainText,
  normalizeWhitespace,
  type EmailLink,
} from "./html";

export type { EmailLink } from "./html";

/** Maximum size of `ParsedEmail.text` in UTF-8 bytes. */
export const MAX_TEXT_BYTES = 200 * 1024;
const MAX_ID_LENGTH = 255;
const MAX_HEADER_LENGTH = 1000;

export type ParsedEmailHeaders = {
  /** Raw `List-Unsubscribe` value (bulk-mail signal). */
  listUnsubscribe: string | null;
  /** Raw `Auto-Submitted` value ("auto-generated" etc.). */
  autoSubmitted: string | null;
  /** First `Reply-To` address, lower-cased. */
  replyTo: string | null;
  /** Raw `Authentication-Results` value added by the receiving server (DKIM/SPF/DMARC), if present. */
  authenticationResults: string | null;
};

export type ParsedEmail = {
  /** Message-ID without angle brackets; fallback `sha256:<hex>` of key headers + body prefix. */
  externalId: string;
  /** Root of References / In-Reply-To (or the provider's conversation id); null for a new thread. */
  threadId: string | null;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  subject: string | null;
  /** The Date header (null when absent or unparseable — never "now"). */
  receivedAt: Date | null;
  /** Readable plain text (text part, or HTML converted), whitespace-normalized, ≤ 200 KB. */
  text: string;
  headers: ParsedEmailHeaders;
  /** Links found in the body (visible text + URL), used to pick an application/posting URL. */
  links: EmailLink[];
};

/** Truncate to at most `maxBytes` of UTF-8 without splitting a character. */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const buf = Buffer.from(text, "utf8").subarray(0, maxBytes);
  return buf.toString("utf8").replace(/�+$/, "");
}

function stripAngles(id: string | null | undefined): string | null {
  if (!id) return null;
  const m = /<([^<>]+)>/.exec(id);
  const v = (m ? m[1]! : id).trim();
  if (!v) return null;
  return v.length > MAX_ID_LENGTH ? `sha256:${sha256(v)}` : v;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function fallbackId(parts: Array<string | null | undefined>): string {
  return `sha256:${sha256(parts.map((p) => p ?? "").join("\n"))}`;
}

function oneLine(s: string | null | undefined, max = MAX_HEADER_LENGTH): string | null {
  if (!s) return null;
  const v = s.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

/** Parse an RFC 5322 Date value strictly; unparseable values yield null rather than "now". */
export function parseDateHeader(value: string | null | undefined): Date | null {
  if (!value) return null;
  const cleaned = value.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

function firstAddress(obj: AddressObject | AddressObject[] | undefined): { address: string | null; name: string | null } {
  const list = Array.isArray(obj) ? obj : obj ? [obj] : [];
  for (const group of list) {
    for (const v of group.value ?? []) {
      if (v.address) return { address: v.address.trim().toLowerCase(), name: oneLine(v.name, 200) };
      // Address groups ("undisclosed-recipients: ;" or named groups) nest members.
      for (const g of v.group ?? []) {
        if (g.address) return { address: g.address.trim().toLowerCase(), name: oneLine(g.name, 200) };
      }
    }
  }
  return { address: null, name: null };
}

function dedupeLinks(links: EmailLink[]): EmailLink[] {
  const seen = new Set<string>();
  const out: EmailLink[] = [];
  for (const l of links) {
    if (seen.has(l.url)) continue;
    seen.add(l.url);
    out.push(l);
  }
  return out;
}

/**
 * Choose the readable body: the text/plain part when it carries real content, otherwise the HTML
 * part converted to text. Links are collected from both.
 */
function chooseBody(plain: string, html: string): { text: string; links: EmailLink[] } {
  const converted = html ? htmlToTextWithLinks(html) : null;
  const plainText = normalizeWhitespace(plain);
  const plainChars = plainText.replace(/\s/g, "").length;
  const htmlChars = converted ? converted.text.replace(/\s/g, "").length : 0;
  // A stub text part ("View this email in your browser") next to a full HTML body.
  const stub = converted !== null && plainChars < 200 && plainChars * 4 < htmlChars;
  if (plainChars >= 20 && !stub) {
    return { text: plainText, links: dedupeLinks([...linksFromPlainText(plainText), ...(converted?.links ?? [])]) };
  }
  if (converted) return { text: converted.text, links: dedupeLinks(converted.links) };
  return { text: plainText, links: dedupeLinks(linksFromPlainText(plainText)) };
}

export type ParseMeta = {
  /** Provider message id, used as externalId only when the message has no Message-ID header. */
  id?: string | null;
  /** Provider conversation/thread id; overrides the References-derived thread root. */
  threadId?: string | null;
};

/** Parse raw RFC 5322 source (an .eml file, one mbox message, a Gmail `raw` payload, pasted source). */
export async function parseEmail(raw: string | Buffer, meta: ParseMeta = {}): Promise<ParsedEmail> {
  const mail = await simpleParser(raw, {
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipTextLinks: true,
    skipImageLinks: true,
  });

  const headerValue = (key: string): string | null => {
    const line = mail.headerLines?.find((h) => h.key.toLowerCase() === key)?.line;
    if (!line) return null;
    const idx = line.indexOf(":");
    return oneLine(idx >= 0 ? line.slice(idx + 1) : line);
  };

  const from = firstAddress(mail.from);
  const to = firstAddress(mail.to);
  const replyTo = firstAddress(mail.replyTo);
  const subject = oneLine(mail.subject);
  const rawDate = headerValue("date");
  const receivedAt = parseDateHeader(rawDate);

  const body = chooseBody(typeof mail.text === "string" ? mail.text : "", typeof mail.html === "string" ? mail.html : "");
  const text = truncateUtf8(body.text, MAX_TEXT_BYTES);

  const references = Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [];
  const refRoot = references.length ? references[0] : null;
  const inReplyTo = mail.inReplyTo ? (/<[^<>]+>/.exec(mail.inReplyTo)?.[0] ?? mail.inReplyTo) : null;

  const externalId =
    stripAngles(mail.messageId) ??
    (meta.id ? stripAngles(meta.id) : null) ??
    fallbackId([from.address, to.address, subject, rawDate, text.slice(0, 4096)]);

  return {
    externalId,
    threadId: oneLine(meta.threadId ?? null, MAX_ID_LENGTH) ?? stripAngles(refRoot) ?? stripAngles(inReplyTo),
    fromAddress: from.address,
    fromName: from.name,
    toAddress: to.address,
    subject,
    receivedAt,
    text,
    headers: {
      listUnsubscribe: headerValue("list-unsubscribe"),
      autoSubmitted: headerValue("auto-submitted"),
      authenticationResults: headerValue("authentication-results"),
      replyTo: replyTo.address,
    },
    links: body.links,
  };
}

/** Alias used by the fixture README. */
export const parseEml = parseEmail;

const ENVELOPE_WEEKDAY = /^From \S+ +(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/;
const ENVELOPE_TIME = /^From \S+ .*\b\d{1,2}:\d{2}:\d{2}\b.*\b\d{4}\b/;

/**
 * Split an mbox file into raw messages (LF line endings). Envelope lines are `From ` lines at the
 * start of the file or after a blank line that look like `From <sender> <date>`; body lines escaped
 * as `>From ` (mboxrd/mboxo) are unescaped by one level. Content without any envelope line is
 * returned as a single message.
 */
export function splitMbox(content: string | Buffer): string[] {
  const s = (typeof content === "string" ? content : content.toString("utf8")).replace(/\r\n?/g, "\n");
  const lines = s.split("\n");
  const messages: string[] = [];
  let current: string[] | null = null;
  let sawEnvelope = false;

  const flush = () => {
    if (!current) return;
    const msg = current.join("\n").replace(/\n+$/, "");
    if (msg.trim()) messages.push(`${msg}\n`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const atBoundary = i === 0 || lines[i - 1] === "";
    if (atBoundary && line.startsWith("From ") && (ENVELOPE_WEEKDAY.test(line) || ENVELOPE_TIME.test(line))) {
      flush();
      current = [];
      sawEnvelope = true;
      continue;
    }
    if (current === null) current = [];
    current.push(sawEnvelope ? line.replace(/^>(>*From )/, "$1") : line);
  }
  flush();
  return messages;
}

/** Parse a Gmail API `format=raw` payload (base64url RFC 5322 source). */
export async function parseGmailRaw(raw: string, meta: ParseMeta = {}): Promise<ParsedEmail> {
  // Node's base64 decoder accepts both the standard and the URL-safe alphabet.
  const buf = Buffer.from(raw.replace(/\s+/g, ""), "base64");
  return parseEmail(buf, { ...meta, id: meta.id ? `gmail:${meta.id}` : null });
}

/** The subset of a Microsoft Graph `message` resource this module reads. */
export type GraphEmailAddress = { emailAddress?: { name?: string | null; address?: string | null } | null } | null;
export type GraphMessage = {
  id?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  from?: GraphEmailAddress;
  sender?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[] | null;
  replyTo?: GraphEmailAddress[] | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }> | null;
};

/** Convert a Microsoft Graph message JSON into a ParsedEmail (no MIME parsing needed). */
export function fromGraphMessage(graph: GraphMessage): ParsedEmail {
  const sender = graph.from?.emailAddress ?? graph.sender?.emailAddress ?? null;
  const to = graph.toRecipients?.find((r) => r?.emailAddress?.address)?.emailAddress ?? null;
  const reply = graph.replyTo?.find((r) => r?.emailAddress?.address)?.emailAddress ?? null;
  const header = (name: string) =>
    oneLine(graph.internetMessageHeaders?.find((h) => h?.name?.toLowerCase() === name)?.value ?? null);

  const content = graph.body?.content ?? "";
  const isHtml = (graph.body?.contentType ?? "").toLowerCase() === "html";
  const body = isHtml ? chooseBody("", content) : chooseBody(content, "");
  const text = truncateUtf8(body.text, MAX_TEXT_BYTES);

  const received = graph.receivedDateTime ?? graph.sentDateTime ?? null;
  const receivedAt = received ? new Date(received) : null;
  const subject = oneLine(graph.subject ?? null);
  const fromAddress = sender?.address ? sender.address.trim().toLowerCase() : null;
  const toAddress = to?.address ? to.address.trim().toLowerCase() : null;

  return {
    externalId:
      stripAngles(graph.internetMessageId) ??
      (graph.id ? `graph:${graph.id.slice(0, MAX_ID_LENGTH)}` : null) ??
      fallbackId([fromAddress, toAddress, subject, received, text.slice(0, 4096)]),
    threadId: oneLine(graph.conversationId ?? null, MAX_ID_LENGTH),
    fromAddress,
    fromName: oneLine(sender?.name ?? null, 200),
    toAddress,
    subject,
    receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
    text,
    headers: {
      listUnsubscribe: header("list-unsubscribe"),
      autoSubmitted: header("auto-submitted"),
      authenticationResults: header("authentication-results"),
      replyTo: reply?.address ? reply.address.trim().toLowerCase() : null,
    },
    links: body.links,
  };
}
