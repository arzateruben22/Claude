import "server-only";
import { prisma } from "@/lib/db";
import type { ProgramInterestStatus, RecruitmentStatus } from "@/generated/prisma/enums";
import { isHttpUrl } from "@/lib/seed/schema";
import { dateKeyInTz } from "@/lib/dates";
import { safeTimezone } from "@/lib/game/facts";
import { checklistProgress, parseChecklist, type ChecklistItem } from "./checklist";
import { matchesProgramFilters, type ProgramFilters } from "./labels";

/**
 * Read model for the apprenticeship directory. Programs are global seeded facts; interest rows are
 * per user and always looked up by (userId, programId). JSON columns are parsed defensively and
 * only http(s) URLs are ever returned for linking.
 */

export type ProgramContactView = { phone: string | null; address: string | null; email: string | null };

export type ProgramView = {
  id: string;
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
  contact: ProgramContactView;
  recruitmentStatus: RecruitmentStatus;
  recruitmentNote: string | null;
  sourceUrls: string[];
  /** "YYYY-MM-DD" of the last verification (display in UTC). */
  verifiedOnKey: string | null;
};

export type InterestView = {
  id: string;
  status: ProgramInterestStatus;
  /** "YYYY-MM-DD" in the user's timezone. */
  appliedAtKey: string | null;
  notes: string | null;
  checklist: ChecklistItem[];
  progress: { done: number; total: number };
  updatedAt: Date;
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

function contactOf(v: unknown): ProgramContactView {
  const o = typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : null);
  const email = s("email");
  return { phone: s("phone"), address: s("address"), email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null };
}

type ProgramRow = Awaited<ReturnType<typeof prisma.apprenticeshipProgram.findFirstOrThrow>>;

export function toProgramView(p: ProgramRow): ProgramView {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sponsor: p.sponsor,
    region: p.region,
    isUnion: p.isUnion,
    website: isHttpUrl(p.website) ? p.website : null,
    applyUrl: isHttpUrl(p.applyUrl) ? p.applyUrl : null,
    eligibility: strings(p.eligibility),
    processSteps: strings(p.processSteps),
    durationYears: p.durationYears,
    classroomHours: p.classroomHours,
    startingWage: p.startingWage,
    startingWageVerified: p.startingWageVerified && Boolean(p.startingWage),
    fees: p.fees,
    contact: contactOf(p.contact),
    recruitmentStatus: p.recruitmentStatus,
    recruitmentNote: p.recruitmentNote,
    sourceUrls: [...new Set(strings(p.sourceUrls).filter(isHttpUrl))],
    verifiedOnKey: p.verifiedOn ? p.verifiedOn.toISOString().slice(0, 10) : null,
  };
}

type InterestRow = { id: string; status: ProgramInterestStatus; appliedAt: Date | null; notes: string | null; checklist: unknown; updatedAt: Date };

export function toInterestView(i: InterestRow, timezone: string): InterestView {
  const checklist = parseChecklist(i.checklist);
  return {
    id: i.id,
    status: i.status,
    appliedAtKey: i.appliedAt ? dateKeyInTz(i.appliedAt, timezone) : null,
    notes: i.notes,
    checklist,
    progress: checklistProgress(checklist),
    updatedAt: i.updatedAt,
  };
}

async function timezoneFor(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return safeTimezone(profile?.timezone);
}

export type DirectoryEntry = ProgramView & { interest: InterestView | null };

export type DirectoryData = {
  programs: DirectoryEntry[];
  regions: string[];
  totalPrograms: number;
  tracked: number;
  timezone: string;
};

const INTEREST_SELECT = { id: true, programId: true, status: true, appliedAt: true, notes: true, checklist: true, updatedAt: true } as const;

/** Programs (optionally filtered by region and union status) with the user's own interest rows. */
export async function listPrograms(userId: string, filters: ProgramFilters = { region: null, union: null }): Promise<DirectoryData> {
  const [all, interests, timezone] = await Promise.all([
    prisma.apprenticeshipProgram.findMany({ orderBy: [{ isUnion: "desc" }, { region: "asc" }, { name: "asc" }] }),
    prisma.userProgramInterest.findMany({ where: { userId }, select: INTEREST_SELECT }),
    timezoneFor(userId),
  ]);
  const byProgram = new Map(interests.map((i) => [i.programId, i]));
  const regions = [...new Set(all.map((p) => p.region))].sort();
  const filtered = all.filter((p) => matchesProgramFilters(p, filters));
  return {
    programs: filtered.map((p) => {
      const i = byProgram.get(p.id);
      return { ...toProgramView(p), interest: i ? toInterestView(i, timezone) : null };
    }),
    regions,
    totalPrograms: all.length,
    tracked: interests.length,
    timezone,
  };
}

export async function getProgramBySlug(userId: string, slug: string): Promise<{ program: DirectoryEntry; timezone: string } | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const p = await prisma.apprenticeshipProgram.findUnique({ where: { slug } });
  if (!p) return null;
  const [interest, timezone] = await Promise.all([
    prisma.userProgramInterest.findUnique({ where: { userId_programId: { userId, programId: p.id } }, select: INTEREST_SELECT }),
    timezoneFor(userId),
  ]);
  return { program: { ...toProgramView(p), interest: interest ? toInterestView(interest, timezone) : null }, timezone };
}
