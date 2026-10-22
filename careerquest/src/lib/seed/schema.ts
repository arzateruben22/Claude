/**
 * Validation and mapping for the reference-data seed files in `data/seed/`.
 *
 * This module is shared by `prisma/seed.ts` (run with tsx, which does not resolve the "@/" alias)
 * and by the app, so it must only use relative imports and must not import "server-only".
 *
 * Honesty rules enforced here (not only in the UI):
 *  - a program is stored as OPEN only when the seed says OPEN *and* the fact carries a verification
 *    date and at least one source URL; anything else is stored as UNVERIFIED;
 *  - `startingWageVerified` is only true when a starting wage text exists;
 *  - dates are taken from the file as calendar days ("YYYY-MM-DD") and never invented.
 */
import { z } from "zod";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const httpUrl = z.string().trim().max(2048).refine(isHttpUrl, "Must be an http(s) URL.");

const dayKey = z
  .string()
  .trim()
  .regex(DAY_KEY, "Use YYYY-MM-DD.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Not a calendar date.");

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const textList = z.array(z.string().trim().min(1).max(1000)).max(60).default([]);

export const RECRUITMENT_STATUSES = ["OPEN", "CLOSED", "UNVERIFIED"] as const;
export type SeedRecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const programSeedSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens.")
    .max(80),
  name: z.string().trim().min(1).max(300),
  sponsor: z.string().trim().min(1).max(500),
  region: z.string().trim().min(1).max(80),
  isUnion: z.boolean(),
  website: httpUrl.nullable().optional(),
  applyUrl: httpUrl.nullable().optional(),
  eligibility: textList,
  processSteps: textList,
  durationYears: z.number().positive().max(10).nullable().optional(),
  classroomHours: optionalText,
  startingWage: optionalText,
  startingWageVerified: z.boolean().default(false),
  fees: optionalText,
  contact: z
    .object({
      phone: z.string().trim().max(300).optional(),
      address: z.string().trim().max(600).optional(),
      email: z.string().trim().max(200).optional(),
    })
    .default({}),
  recruitmentStatus: z.enum(RECRUITMENT_STATUSES).default("UNVERIFIED"),
  recruitmentNote: optionalText,
  sourceUrls: z.array(httpUrl).max(40).default([]),
  verifiedOn: dayKey.nullable().optional(),
});

export type ProgramSeed = z.output<typeof programSeedSchema>;

export const certificationSeedSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Code must be UPPER_SNAKE_CASE.")
    .max(60),
  name: z.string().trim().min(1).max(200),
  hoursRequired: z.number().int().positive().max(100_000),
  notes: optionalText,
  sourceUrl: httpUrl.nullable().optional(),
  verifiedOn: dayKey.nullable().optional(),
});

export type CertificationSeed = z.output<typeof certificationSeedSchema>;

/** UTC-midnight Date for a seed calendar day (the column is a timestamp; display it in UTC). */
export function seedDay(key: string | null | undefined): Date | null {
  if (!key || !DAY_KEY.test(key)) return null;
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ProgramContact = { phone?: string; address?: string; email?: string };

/** Column values for `ApprenticeshipProgram` (everything except id/timestamps). */
export type ProgramRow = {
  slug: string;
  name: string;
  sponsor: string;
  region: string;
  isUnion: boolean;
  website: string | null;
  applyUrl: string | null;
  eligibility: string[];
  processSteps: string[];
  durationYears: number | null;
  classroomHours: string | null;
  startingWage: string | null;
  startingWageVerified: boolean;
  fees: string | null;
  contact: ProgramContact;
  recruitmentStatus: SeedRecruitmentStatus;
  recruitmentNote: string | null;
  sourceUrls: string[];
  verifiedOn: Date | null;
};

export function toProgramRow(p: ProgramSeed): { row: ProgramRow; warnings: string[] } {
  const warnings: string[] = [];
  const sourceUrls = [...new Set(p.sourceUrls)];
  const verifiedOn = seedDay(p.verifiedOn ?? null);
  let recruitmentStatus = p.recruitmentStatus;
  if (recruitmentStatus === "OPEN" && (!verifiedOn || sourceUrls.length === 0)) {
    recruitmentStatus = "UNVERIFIED";
    warnings.push(`${p.slug}: OPEN without a verification date and source URL is stored as UNVERIFIED.`);
  }
  const startingWage = p.startingWage ?? null;
  const startingWageVerified = p.startingWageVerified && startingWage !== null;
  if (p.startingWageVerified && !startingWage) warnings.push(`${p.slug}: startingWageVerified without a wage text is stored as unverified.`);
  const contact: ProgramContact = {};
  if (p.contact.phone) contact.phone = p.contact.phone;
  if (p.contact.address) contact.address = p.contact.address;
  if (p.contact.email) contact.email = p.contact.email;
  return {
    row: {
      slug: p.slug,
      name: p.name,
      sponsor: p.sponsor,
      region: p.region,
      isUnion: p.isUnion,
      website: p.website ?? null,
      applyUrl: p.applyUrl ?? null,
      eligibility: p.eligibility,
      processSteps: p.processSteps,
      durationYears: p.durationYears ?? null,
      classroomHours: p.classroomHours,
      startingWage,
      startingWageVerified,
      fees: p.fees,
      contact,
      recruitmentStatus,
      recruitmentNote: p.recruitmentNote,
      sourceUrls,
      verifiedOn,
    },
    warnings,
  };
}

/** Column values for `CertificationRequirement` (everything except id/updatedAt). */
export type CertificationRow = {
  code: string;
  name: string;
  hoursRequired: number;
  notes: string | null;
  sourceUrl: string | null;
  verifiedOn: Date | null;
};

export function toCertificationRow(c: CertificationSeed): CertificationRow {
  return {
    code: c.code,
    name: c.name,
    hoursRequired: c.hoursRequired,
    notes: c.notes,
    sourceUrl: c.sourceUrl ?? null,
    verifiedOn: seedDay(c.verifiedOn ?? null),
  };
}

export type ParsedSeed<T> = { items: T[]; errors: string[] };

function issueText(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");
}

/**
 * Validate a seed array. Invalid entries are skipped with an error message (never fatal), and a
 * repeated key keeps the first entry.
 */
export function parseSeedArray<S extends z.ZodTypeAny>(
  raw: unknown,
  schema: S,
  keyOf: (item: z.output<S>) => string,
  label: string,
): ParsedSeed<z.output<S>> {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { items: [], errors: [`${label}: expected a JSON array.`] };
  const seen = new Set<string>();
  const items: z.output<S>[] = [];
  raw.forEach((entry, i) => {
    const parsed = schema.safeParse(entry);
    if (!parsed.success) {
      errors.push(`${label}[${i}]: ${issueText(parsed.error)}`);
      return;
    }
    const key = keyOf(parsed.data);
    if (seen.has(key)) {
      errors.push(`${label}[${i}]: duplicate key "${key}" skipped.`);
      return;
    }
    seen.add(key);
    items.push(parsed.data);
  });
  return { items, errors };
}

export function parseProgramSeeds(raw: unknown): { rows: ProgramRow[]; errors: string[]; warnings: string[] } {
  const parsed = parseSeedArray(raw, programSeedSchema, (p) => p.slug, "apprenticeship_programs");
  const warnings: string[] = [];
  const rows = parsed.items.map((p) => {
    const r = toProgramRow(p);
    warnings.push(...r.warnings);
    return r.row;
  });
  return { rows, errors: parsed.errors, warnings };
}

export function parseCertificationSeeds(raw: unknown): { rows: CertificationRow[]; errors: string[] } {
  const parsed = parseSeedArray(raw, certificationSeedSchema, (c) => c.code, "certification_requirements");
  return { rows: parsed.items.map(toCertificationRow), errors: parsed.errors };
}
