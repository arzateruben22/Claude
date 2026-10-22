/**
 * Upload validation for user documents (pay stubs, hour reports, certificates, résumés). Pure.
 *
 * A file is accepted only when ALL of these hold:
 *  - size is 1 byte … 10 MB;
 *  - the extension is on the allowlist (pdf, png, jpg, jpeg, webp);
 *  - the leading bytes (magic number) identify one of those formats; and
 *  - the sniffed format matches the extension (a PNG renamed to .pdf is rejected).
 * The stored MIME type always comes from the sniffed bytes, never from the browser.
 */
import { DocumentKind } from "@/generated/prisma/enums";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_LABEL = "10 MB";

export type SniffedFormat = "pdf" | "png" | "jpeg" | "webp";

export const FORMAT_MIME: Record<SniffedFormat, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Stored file extension per format. */
export const FORMAT_EXTENSION: Record<SniffedFormat, string> = { pdf: "pdf", png: "png", jpeg: "jpg", webp: "webp" };

const EXTENSION_FORMAT: Record<string, SniffedFormat> = { pdf: "pdf", png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp" };

export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
export const ALLOWED_TYPES_LABEL = "PDF, PNG, JPG or WEBP";

const ALLOWED_MIME = new Set(Object.values(FORMAT_MIME));

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP = [0x57, 0x45, 0x42, 0x50]; // WEBP

/** Identify the format from the leading bytes, or null when it is not an allowed format. */
export function sniffFormat(bytes: Uint8Array): SniffedFormat | null {
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "webp";
  return null;
}

/** Lower-case extension of a file name ("" when there is none). */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * Display-safe file name: no directory parts, no control or bidi-override characters, collapsed
 * whitespace, at most 120 characters (the extension is kept).
 */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!base || base === "." || base === "..") return "document";
  if (base.length <= 120) return base;
  const ext = extensionOf(base);
  const keep = ext ? 120 - ext.length - 1 : 120;
  return ext ? `${base.slice(0, keep)}.${ext}` : base.slice(0, 120);
}

export type UploadCandidate = { name: string; size: number; bytes: Uint8Array };

export type UploadCheck =
  | { ok: true; format: SniffedFormat; mimeType: string; extension: string; fileName: string }
  | { ok: false; code: "EMPTY" | "TOO_LARGE" | "EXTENSION" | "CONTENT" | "MISMATCH"; error: string };

/** Size + extension checks that need no file content (run before reading the bytes). */
export function precheckUpload(name: string, size: number): UploadCheck | null {
  if (!Number.isFinite(size) || size <= 0) return { ok: false, code: "EMPTY", error: "The file is empty." };
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, code: "TOO_LARGE", error: `The file is larger than ${MAX_DOCUMENT_LABEL}.` };
  const ext = extensionOf(name);
  if (!EXTENSION_FORMAT[ext]) return { ok: false, code: "EXTENSION", error: `Only ${ALLOWED_TYPES_LABEL} files can be uploaded.` };
  return null;
}

export function validateUpload(file: UploadCandidate): UploadCheck {
  const pre = precheckUpload(file.name, Math.max(file.size, file.bytes.byteLength));
  if (pre) return pre;
  const declared = EXTENSION_FORMAT[extensionOf(file.name)]!;
  const sniffed = sniffFormat(file.bytes);
  if (!sniffed) {
    return { ok: false, code: "CONTENT", error: `The file content is not a valid ${ALLOWED_TYPES_LABEL} file.` };
  }
  if (sniffed !== declared) {
    return {
      ok: false,
      code: "MISMATCH",
      error: `The file content (${sniffed.toUpperCase()}) does not match its .${extensionOf(file.name)} extension.`,
    };
  }
  return {
    ok: true,
    format: sniffed,
    mimeType: FORMAT_MIME[sniffed],
    extension: FORMAT_EXTENSION[sniffed],
    fileName: sanitizeFileName(file.name),
  };
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  RESUME: "Résumé",
  CERTIFICATE: "Certificate",
  PAY_STUB: "Pay stub",
  HOURS_VERIFICATION: "Employer letter / union hour report",
  TRAINEE_CARD: "Trainee registration card",
  OFFER_LETTER: "Offer letter",
  OTHER: "Other document",
};

export const DOCUMENT_KINDS = Object.values(DocumentKind) as DocumentKind[];

/** Document kinds that can back EMPLOYER_VERIFIED / OFFICIAL_RECORD work hours. */
export const HOUR_PROOF_KINDS: readonly DocumentKind[] = ["PAY_STUB", "HOURS_VERIFICATION", "OTHER"];

/** Document kinds shown on the certification tracker. */
export const CERTIFICATION_DOC_KINDS: readonly DocumentKind[] = ["CERTIFICATE", "TRAINEE_CARD"];

/** Human size, e.g. "1.4 MB". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** RFC 6266 Content-Disposition value with an ASCII fallback and an RFC 5987 UTF-8 name. */
export function contentDisposition(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") || "document";
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Download URL for a document (owner-only route; 404 for anyone else). */
export function documentHref(id: string): string {
  return `/api/documents/${encodeURIComponent(id)}`;
}
