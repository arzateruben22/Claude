/**
 * Request validation for the browser-extension API (pure, unit-tested).
 *
 * The extension (`extension/src/lib/capture.js#buildCapturePayload`) sends an allow-listed payload;
 * the server re-validates every field with strict caps and rejects unknown keys, so nothing that is
 * not documented can be stored. Free text is whitespace-collapsed and e-mail addresses / phone
 * numbers in the confirmation sentence and page title are masked again server-side.
 */
import { z } from "zod";
import { ApplicationSource } from "@/generated/prisma/enums";

export const EXTENSION_LIMITS = {
  url: 2048,
  text: 300,
  confirmationText: 300,
  detectedByItems: 32,
  id: 64,
  /** Largest accepted JSON body for POST /captures. */
  bodyBytes: 16 * 1024,
} as const;

export const CAPTURE_KINDS = ["JOB_PAGE", "APPLY_STARTED", "CONFIRMATION_PAGE", "MANUAL_CONFIRMATION"] as const;
export type ApiCaptureKind = (typeof CAPTURE_KINDS)[number];

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

const EMAIL_RE = /[^\s@<>()[\]"',;:]+@[^\s<>()[\]"',;:]*/g;
const PHONE_CANDIDATE_RE = /(?<![\w-])\+?[\d(][\d\s().-]{7,}\d(?![\w-])/g;

/** Masks e-mail addresses and 10–15 digit phone numbers (same rule as the extension). */
export function maskPii(text: string): string {
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_CANDIDATE_RE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 10 && digits <= 15 ? "[phone]" : m;
  });
}

/** Collapse whitespace and trim; empty → undefined. */
export function cleanText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .nullish()
    .transform((v) => cleanText(v));

const httpUrl = z
  .string()
  .max(EXTENSION_LIMITS.url, `url must be at most ${EXTENSION_LIMITS.url} characters`)
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, "url is required")
  .refine(isHttpUrl, "url must be an http(s) URL");

export const captureEvidenceSchema = z.strictObject({
  pageTitle: z.string().max(EXTENSION_LIMITS.text),
  detectedBy: z.array(z.string().max(EXTENSION_LIMITS.text)).max(EXTENSION_LIMITS.detectedByItems),
  confirmationText: z.string().max(EXTENSION_LIMITS.confirmationText).optional(),
  capturedAt: z.iso.datetime({ offset: true, message: "capturedAt must be an ISO date-time" }),
  /** Random id the extension reuses for every retry of the same capture (idempotency key). */
  captureId: z.string().max(EXTENSION_LIMITS.id).optional(),
});

export const captureBodySchema = z.strictObject({
  kind: z.enum(CAPTURE_KINDS),
  url: httpUrl,
  platform: z.enum(ApplicationSource).nullish(),
  company: optionalText(EXTENSION_LIMITS.text),
  title: optionalText(EXTENSION_LIMITS.text),
  location: optionalText(EXTENSION_LIMITS.text),
  salaryText: optionalText(EXTENSION_LIMITS.text),
  requisitionId: optionalText(EXTENSION_LIMITS.text),
  confidence: z.number().min(0, "confidence must be between 0 and 1").max(1, "confidence must be between 0 and 1"),
  evidence: captureEvidenceSchema,
  applicationId: z
    .string()
    .max(EXTENSION_LIMITS.id)
    .nullish()
    .transform((v) => cleanText(v)),
});

export type CaptureBody = z.output<typeof captureBodySchema>;

/** The evidence JSON stored on ExtensionCapture: allow-listed, cleaned, PII-masked. */
export type StoredCaptureEvidence = {
  pageTitle: string;
  detectedBy: string[];
  confirmationText?: string;
  capturedAt: string;
  captureId?: string;
};

export function storedEvidence(body: CaptureBody): StoredCaptureEvidence {
  const keepsText = body.kind === "CONFIRMATION_PAGE" || body.kind === "MANUAL_CONFIRMATION";
  const confirmation = keepsText ? cleanText(body.evidence.confirmationText) : undefined;
  const detectedBy = [
    ...new Set(body.evidence.detectedBy.map((s) => cleanText(s)).filter((s): s is string => Boolean(s))),
  ];
  const captureId = cleanText(body.evidence.captureId);
  return {
    pageTitle: maskPii(cleanText(body.evidence.pageTitle) ?? ""),
    detectedBy,
    ...(confirmation ? { confirmationText: maskPii(confirmation) } : {}),
    capturedAt: new Date(body.evidence.capturedAt).toISOString(),
    ...(captureId ? { captureId } : {}),
  };
}

export const lookupQuerySchema = z
  .strictObject({
    url: z
      .string()
      .max(EXTENSION_LIMITS.url)
      .optional()
      .transform((v) => cleanText(v))
      .refine((v) => v === undefined || isHttpUrl(v), "url must be an http(s) URL"),
    company: optionalText(EXTENSION_LIMITS.text),
    title: optionalText(EXTENSION_LIMITS.text),
    requisitionId: optionalText(EXTENSION_LIMITS.text),
  })
  .refine((q) => Boolean(q.url || q.company || q.requisitionId), {
    message: "Provide url, company or requisitionId.",
  });

export type LookupQuery = z.output<typeof lookupQuerySchema>;

/** Parse URLSearchParams into the lookup query (a repeated parameter is rejected). */
export function parseLookupQuery(params: URLSearchParams): { ok: true; data: LookupQuery } | { ok: false; error: string } {
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) return { ok: false, error: `Parameter "${k}" was given more than once.` };
    raw[k] = v;
  }
  const parsed = lookupQuerySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
  return { ok: true, data: parsed.data };
}

/** One readable line for an API error body: "<path>: <message>". */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
