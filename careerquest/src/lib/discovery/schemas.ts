/**
 * Form validation for Job Discovery and mobile share (pure; used by server actions and tests).
 */
import { z } from "zod";

const text = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((v) => {
      const t = v?.replace(/\s+/g, " ").trim();
      return t ? t : undefined;
    });

const longText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    });

export const httpUrlField = z
  .string()
  .max(2048, "The link must be at most 2,048 characters")
  .optional()
  .transform((v) => {
    const t = v?.trim();
    if (!t) return undefined;
    return /^www\./i.test(t) ? `https://${t}` : t;
  })
  .refine((v) => {
    if (v === undefined) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname);
    } catch {
      return false;
    }
  }, "Enter a full link starting with https:// or http://");

const required = (max: number, label: string) =>
  z
    .string({ message: `${label} is required` })
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`));

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

export const leadInputSchema = z.object({
  title: required(200, "Job title"),
  company: required(200, "Company"),
  url: httpUrlField,
  location: text(160, "Location"),
  salaryText: text(120, "Pay"),
  category: text(80, "Category"),
  notes: longText(5000, "Notes"),
  requiresCompanyVehicle: checkbox,
  requiresDrivingRecord: checkbox,
  requiresCdl: checkbox,
});

export type LeadInput = z.output<typeof leadInputSchema>;

export const leadIdSchema = z.object({ leadId: z.uuid("Unknown lead.") });

export const leadStatusSchema = z.object({
  leadId: z.uuid("Unknown lead."),
  status: z.enum(["NEW", "SAVED", "DISMISSED"]),
});

export const convertLeadSchema = z.object({
  leadId: z.uuid("Unknown lead."),
  mode: z.enum(["saved", "applied"]),
  attachTo: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .pipe(z.uuid("Unknown application.").optional()),
  force: checkbox,
});

export const PRIORITY_LABELS: Record<1 | 2 | 3, string> = { 1: "High", 2: "Medium", 3: "Low" };

export const targetCompanySchema = z.object({
  name: required(200, "Company name"),
  website: httpUrlField,
  careersUrl: httpUrlField,
  category: text(80, "Category"),
  priority: z.coerce.number({ message: "Choose a priority" }).int().min(1, "Choose a priority").max(3, "Choose a priority"),
  notes: longText(2000, "Notes"),
});

export type TargetCompanyInput = z.output<typeof targetCompanySchema>;

export const targetCompanyIdSchema = z.object({ companyId: z.uuid("Unknown company.") });

export const shareDecisionSchema = z.object({
  decision: z.enum(["lead", "track", "applied"]),
  url: httpUrlField,
  title: text(200, "Job title"),
  company: text(200, "Company"),
  location: text(160, "Location"),
  salaryText: text(120, "Pay"),
  sharedText: longText(20_000, "Shared text"),
  attachTo: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .pipe(z.uuid("Unknown application.").optional()),
  force: checkbox,
});

export type ShareDecisionInput = z.output<typeof shareDecisionSchema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A follow-up choice button after an uncertain match (or "this one" on a listed match):
 * `<mode>:attach:<applicationId>` or `<mode>:new`. One button carries the whole decision, so it
 * can live in the same form as the primary buttons. Returns null for anything else.
 */
export function parseChoice<M extends string>(
  value: string | undefined | null,
  modes: readonly M[],
): { mode: M; attachTo?: string; force: boolean } | null {
  if (!value) return null;
  const [mode, kind, id] = value.split(":");
  if (!mode || !(modes as readonly string[]).includes(mode)) return null;
  if (kind === "new" && id === undefined) return { mode: mode as M, force: true };
  if (kind === "attach" && id && UUID_RE.test(id)) return { mode: mode as M, attachTo: id.toLowerCase(), force: false };
  return null;
}

export const choiceValue = (mode: string, attachTo?: string) => (attachTo ? `${mode}:attach:${attachTo}` : `${mode}:new`);
