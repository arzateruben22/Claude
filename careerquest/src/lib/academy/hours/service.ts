import "server-only";
import { prisma } from "@/lib/db";
import type { DocumentKind, HourVerification } from "@/generated/prisma/enums";
import type { FieldErrors } from "@/lib/action-result";
import { awardXp, revokeXpForSource, type Tx } from "@/lib/game/xp";
import { lockPlayer, safeTimezone } from "@/lib/game/facts";
import { dateFromKey, dateKey, todayInTz } from "@/lib/dates";
import { deleteDocument, listDocuments, saveFormFile, type DocumentSummary, type FormFile } from "@/lib/documents/service";
import { HOUR_PROOF_KINDS } from "@/lib/documents/validation";
import { getRequirement, type RequirementView } from "@/lib/academy/certification/requirements";
import {
  HOURS_ENTRY_XP_SOURCE,
  HOUR_MILESTONES,
  MAX_HOURS_PER_DAY,
  VERIFICATION_LABELS,
  entryXpKey,
  roundHours,
} from "./constants";
import { estimateCountableHours, parseAreaCaps, type CapEstimate } from "./caps";
import {
  cumulativeSeries,
  hoursByWorkType,
  projectCompletion,
  shortDayLabel,
  splitTotals,
  weeklySeries,
  type CumulativePoint,
  type HourPoint,
  type HourTotals,
  type Projection,
  type WeeklyPoint,
} from "./stats";
import { hoursCsv, type HoursCsvEntry } from "./csv";
import { parseClassroomTargets, splitClassroom, type ClassroomTargets } from "./classroom";
import { loadRoadmap } from "@/lib/academy/roadmap";
import { afterHoursChangeTx } from "./rewards";
import type { WorkHourInput } from "./validation";

/**
 * Work-hour log persistence. Every query is scoped by the authenticated userId. Each write runs in
 * one transaction that (1) locks the player row so concurrent writes serialize, (2) enforces the
 * 24-hours-per-date limit across entries, (3) downgrades "verified" hours without a document to
 * SELF_REPORTED, and (4) keeps XP, missions and achievements in step:
 *   - WORK_HOURS_LOGGED once per entry (`xp:hours-entry:<id>`, sourceType "WorkHourEntry"),
 *     revoked when the entry is deleted;
 *   - TRAINING_MILESTONE at verified 1,000/2,000/4,000/6,000/8,000 (see rewards.ts).
 */

export const DOWNGRADE_EXPLANATION =
  "Saved as self-reported: employer-verified and official-record hours need an attached document such as a pay stub, employer letter or union hour report.";

class HoursInputError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

export async function userTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return safeTimezone(profile?.timezone);
}

export type HoursWriteResult =
  | {
      ok: true;
      entryId: string;
      savedAs: HourVerification;
      downgraded: boolean;
      message: string;
      milestones: { awarded: number[]; revoked: number[] };
    }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type HoursWriteOptions = {
  /** A file uploaded with the entry form; stored as a Document and attached to the entry. */
  newDocument?: { kind: DocumentKind; file: FormFile };
  now?: Date;
};

function failure(error: string, fieldErrors?: FieldErrors): HoursWriteResult {
  return { ok: false, error, fieldErrors };
}

async function writeEntry(userId: string, entryId: string | null, input: WorkHourInput, opts: HoursWriteOptions): Promise<HoursWriteResult> {
  const now = opts.now ?? new Date();
  const tz = await userTimezone(userId);
  const today = todayInTz(tz, now);
  if (input.dateWorked > dateKey(today)) {
    return failure("Please fix the highlighted fields.", { dateWorked: ["The date worked cannot be in the future."] });
  }

  let uploadedId: string | null = null;
  if (opts.newDocument) {
    if (!HOUR_PROOF_KINDS.includes(opts.newDocument.kind)) {
      return failure("Please fix the highlighted fields.", { documentKind: ["Choose pay stub, employer letter / union hour report, or other."] });
    }
    const saved = await saveFormFile(userId, opts.newDocument.kind, opts.newDocument.file);
    if (!saved.ok) return failure(saved.error, { file: [saved.error] });
    uploadedId = saved.document.id;
  }
  const documentId = uploadedId ?? input.documentId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      if (entryId) {
        const existing = await tx.workHourEntry.findFirst({ where: { id: entryId, userId }, select: { id: true } });
        if (!existing) throw new HoursInputError("That entry was not found.");
      }
      if (input.programId) {
        const program = await tx.apprenticeshipProgram.findUnique({ where: { id: input.programId }, select: { id: true } });
        if (!program) throw new HoursInputError("Please fix the highlighted fields.", { programId: ["Choose a program from the list."] });
      }
      if (documentId) {
        const doc = await tx.document.findFirst({ where: { id: documentId, userId, kind: { in: [...HOUR_PROOF_KINDS] } }, select: { id: true } });
        if (!doc) throw new HoursInputError("Please fix the highlighted fields.", { documentId: ["Choose one of your pay stubs or hour documents."] });
      }
      const dateWorked = dateFromKey(input.dateWorked);
      const sameDay = await tx.workHourEntry.aggregate({
        where: { userId, dateWorked, ...(entryId ? { NOT: { id: entryId } } : {}) },
        _sum: { hours: true },
      });
      const already = roundHours(Number(sameDay._sum.hours?.toString() ?? 0));
      if (already + input.hours > MAX_HOURS_PER_DAY) {
        const left = roundHours(Math.max(0, MAX_HOURS_PER_DAY - already));
        throw new HoursInputError("Please fix the highlighted fields.", {
          hours: [
            `You already logged ${already} h on ${shortDayLabel(input.dateWorked, true)}. A date can hold at most ${MAX_HOURS_PER_DAY} h across entries${left > 0 ? `, so at most ${left} h more` : ""}.`,
          ],
        });
      }

      const downgraded = input.verification !== "SELF_REPORTED" && !documentId;
      const savedAs: HourVerification = downgraded ? "SELF_REPORTED" : input.verification;
      const data = {
        employer: input.employer,
        supervisor: input.supervisor,
        dateWorked,
        hours: input.hours,
        workType: input.workType,
        programId: input.programId,
        description: input.description,
        verification: savedAs,
        documentId,
      };
      const entry = entryId
        ? await tx.workHourEntry.update({ where: { id: entryId }, data, select: { id: true } })
        : await tx.workHourEntry.create({ data: { userId, ...data }, select: { id: true } });

      if (!entryId) {
        await awardXp(tx, {
          userId,
          reason: "WORK_HOURS_LOGGED",
          dedupeKey: entryXpKey(entry.id),
          sourceType: HOURS_ENTRY_XP_SOURCE,
          sourceId: entry.id,
          activityDate: today,
        });
      }
      const milestones = await afterHoursChangeTx(tx, { userId, now, activityDate: today, sourceId: entry.id });
      return { entryId: entry.id, savedAs, downgraded, milestones };
    }, TX_OPTIONS);

    const what = `${result.savedAs === "SELF_REPORTED" ? "" : `${VERIFICATION_LABELS[result.savedAs].toLowerCase()} `}${input.hours} h on ${shortDayLabel(input.dateWorked, true)}`;
    const verb = entryId ? "Updated" : "Logged";
    const milestoneNote = result.milestones.awarded.length
      ? ` Milestone reached: ${result.milestones.awarded.map((n) => n.toLocaleString("en-US")).join(", ")} verified hours.`
      : "";
    return {
      ok: true,
      entryId: result.entryId,
      savedAs: result.savedAs,
      downgraded: result.downgraded,
      milestones: result.milestones,
      message: result.downgraded ? `${verb} ${what}. ${DOWNGRADE_EXPLANATION}` : `${verb} ${what}.${milestoneNote}`,
    };
  } catch (err) {
    if (uploadedId) await deleteDocument(userId, uploadedId).catch(() => undefined);
    if (err instanceof HoursInputError) return failure(err.message, err.fieldErrors);
    throw err;
  }
}

export function createWorkHourEntry(userId: string, input: WorkHourInput, opts: HoursWriteOptions = {}): Promise<HoursWriteResult> {
  return writeEntry(userId, null, input, opts);
}

export function updateWorkHourEntry(userId: string, entryId: string, input: WorkHourInput, opts: HoursWriteOptions = {}): Promise<HoursWriteResult> {
  return writeEntry(userId, entryId, input, opts);
}

export type DeleteHoursResult = { ok: true; message: string; revokedXp: number } | { ok: false; error: string };

/** Delete an entry, revoke its XP and re-sync milestones/missions/achievements. Its document is kept. */
export async function deleteWorkHourEntry(userId: string, entryId: string, now = new Date()): Promise<DeleteHoursResult> {
  const tz = await userTimezone(userId);
  const today = todayInTz(tz, now);
  const result = await prisma.$transaction(async (tx: Tx) => {
    await lockPlayer(tx, userId);
    const entry = await tx.workHourEntry.findFirst({ where: { id: entryId, userId }, select: { id: true, hours: true, dateWorked: true } });
    if (!entry) return null;
    const revokedXp = await revokeXpForSource(tx, userId, HOURS_ENTRY_XP_SOURCE, entry.id);
    await tx.workHourEntry.delete({ where: { id: entry.id } });
    const milestones = await afterHoursChangeTx(tx, { userId, now, activityDate: today });
    return { entry, revokedXp, milestones };
  }, TX_OPTIONS);
  if (!result) return { ok: false, error: "That entry was not found." };
  const hours = roundHours(Number(result.entry.hours.toString()));
  const revokedMilestones = result.milestones.revoked.length
    ? ` Milestone XP for ${result.milestones.revoked.map((n) => n.toLocaleString("en-US")).join(", ")} verified hours was revoked.`
    : "";
  return {
    ok: true,
    revokedXp: result.revokedXp,
    message: `Deleted ${hours} h on ${shortDayLabel(dateKey(result.entry.dateWorked), true)}${result.revokedXp > 0 ? ` (−${result.revokedXp} XP)` : ""}.${revokedMilestones}`,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type HourEntryView = {
  id: string;
  dateKey: string;
  hours: number;
  employer: string;
  supervisor: string | null;
  workType: WorkHourInput["workType"];
  verification: HourVerification;
  description: string | null;
  program: { id: string; name: string } | null;
  document: { id: string; fileName: string } | null;
  createdAt: Date;
};

const ENTRY_SELECT = {
  id: true,
  dateWorked: true,
  hours: true,
  employer: true,
  supervisor: true,
  workType: true,
  verification: true,
  description: true,
  createdAt: true,
  program: { select: { id: true, name: true } },
  document: { select: { id: true, fileName: true } },
} as const;

type EntryRow = {
  id: string;
  dateWorked: Date;
  hours: { toString(): string };
  employer: string;
  supervisor: string | null;
  workType: HourEntryView["workType"];
  verification: HourVerification;
  description: string | null;
  createdAt: Date;
  program: { id: string; name: string } | null;
  document: { id: string; fileName: string } | null;
};

function toView(r: EntryRow): HourEntryView {
  return {
    id: r.id,
    dateKey: dateKey(r.dateWorked),
    hours: roundHours(Number(r.hours.toString())),
    employer: r.employer,
    supervisor: r.supervisor,
    workType: r.workType,
    verification: r.verification,
    description: r.description,
    program: r.program,
    document: r.document,
    createdAt: r.createdAt,
  };
}

export async function getWorkHourEntry(userId: string, entryId: string): Promise<HourEntryView | null> {
  const row = await prisma.workHourEntry.findFirst({ where: { id: entryId, userId }, select: ENTRY_SELECT });
  return row ? toView(row) : null;
}

async function loadPoints(userId: string): Promise<HourPoint[]> {
  const rows = await prisma.workHourEntry.findMany({
    where: { userId },
    select: { dateWorked: true, hours: true, verification: true, workType: true },
    orderBy: { dateWorked: "asc" },
  });
  return rows.map((r) => ({ dateKey: dateKey(r.dateWorked), hours: Number(r.hours.toString()), verification: r.verification, workType: r.workType }));
}

export type ClassroomSummary = {
  totals: HourTotals;
  /** Calendar year of `yearToDate` (the user's local year). */
  year: number;
  yearToDate: HourTotals;
  targets: ClassroomTargets;
};

export type HoursSummary = {
  timezone: string;
  todayKey: string;
  /** On-the-job hours only (work type CLASSROOM excluded): these count toward the requirement. */
  totals: HourTotals;
  /** Classroom instruction, tracked separately from on-the-job hours. */
  classroom: ClassroomSummary;
  /** Every entry, on-the-job and classroom. */
  entryCount: number;
  requirement: RequirementView;
  caps: { verified: CapEstimate; logged: CapEstimate; fromSeed: boolean } | null;
  weekly: WeeklyPoint[];
  cumulative: CumulativePoint[];
  projection: Projection;
  milestones: { hours: number; reached: boolean }[];
  firstEntryKey: string | null;
};

/** Totals, charts, caps estimate and projection for a classification (default GENERAL). */
export async function getHoursSummary(userId: string, opts: { now?: Date; classification?: string; requirement?: RequirementView } = {}): Promise<HoursSummary> {
  const now = opts.now ?? new Date();
  const timezone = await userTimezone(userId);
  const todayKey = dateKey(todayInTz(timezone, now));
  const [points, requirement] = await Promise.all([
    loadPoints(userId),
    opts.requirement ? Promise.resolve(opts.requirement) : getRequirement(opts.classification ?? "GENERAL").then((r) => r!),
  ]);
  const { ojt, classroom } = splitClassroom(points);
  const totals = splitTotals(ojt);
  let caps: HoursSummary["caps"] = null;
  if (requirement.code === "GENERAL") {
    const parsed = parseAreaCaps(requirement.notes);
    caps = {
      verified: estimateCountableHours(hoursByWorkType(ojt, "verified"), parsed),
      logged: estimateCountableHours(hoursByWorkType(ojt, "all"), parsed),
      fromSeed: parsed.fromSeed.length > 0,
    };
  }
  const year = Number(todayKey.slice(0, 4));
  return {
    timezone,
    todayKey,
    totals,
    classroom: {
      totals: splitTotals(classroom),
      year,
      yearToDate: splitTotals(classroom.filter((p) => p.dateKey.startsWith(`${year}-`))),
      targets: classroomTargets(requirement),
    },
    entryCount: points.length,
    requirement,
    caps,
    weekly: weeklySeries(ojt, todayKey, 12),
    cumulative: cumulativeSeries(ojt, todayKey),
    projection: projectCompletion(ojt, todayKey, requirement.hoursRequired),
    milestones: HOUR_MILESTONES.map((n) => ({ hours: n, reached: totals.verified >= n })),
    firstEntryKey: points[0]?.dateKey ?? null,
  };
}

let targetsCache: { key: string; at: number; value: ClassroomTargets } | null = null;

/** Trainee-route classroom targets from the researched facts (none are invented). Cached 10 min. */
function classroomTargets(requirement: RequirementView): ClassroomTargets {
  const key = `${requirement.code}:${requirement.notes?.length ?? 0}`;
  if (targetsCache && targetsCache.key === key && Date.now() - targetsCache.at < 600_000) return targetsCache.value;
  const facts = loadRoadmap().trainee?.facts ?? [];
  const text = (label: string) => facts.find((f) => f.label === label)?.value ?? null;
  const value = parseClassroomTargets({
    traineeClassroom: text("Classroom hours"),
    traineePath: text("Path to certification"),
    generalNotes: requirement.code === "GENERAL" ? requirement.notes : null,
  });
  targetsCache = { key, at: Date.now(), value };
  return value;
}

export const ENTRIES_PAGE_SIZE = 25;

export type HoursPageData = HoursSummary & {
  entries: HourEntryView[];
  page: number;
  pageCount: number;
  programs: { id: string; name: string }[];
  documents: DocumentSummary[];
};

export async function getHoursPageData(userId: string, opts: { page?: number; now?: Date } = {}): Promise<HoursPageData> {
  const summary = await getHoursSummary(userId, { now: opts.now });
  const pageCount = Math.max(1, Math.ceil(summary.entryCount / ENTRIES_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pageCount);
  const [rows, programs, documents] = await Promise.all([
    prisma.workHourEntry.findMany({
      where: { userId },
      select: ENTRY_SELECT,
      orderBy: [{ dateWorked: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * ENTRIES_PAGE_SIZE,
      take: ENTRIES_PAGE_SIZE,
    }),
    listProgramOptions(),
    listDocuments(userId, HOUR_PROOF_KINDS),
  ]);
  return { ...summary, entries: rows.map(toView), page, pageCount, programs, documents };
}

export async function listProgramOptions(): Promise<{ id: string; name: string }[]> {
  return prisma.apprenticeshipProgram.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** CSV of every entry (oldest first). */
export async function exportHoursCsv(userId: string, now = new Date()): Promise<{ csv: string; rows: number; todayKey: string }> {
  const tz = await userTimezone(userId);
  const rows = await prisma.workHourEntry.findMany({
    where: { userId },
    select: ENTRY_SELECT,
    orderBy: [{ dateWorked: "asc" }, { createdAt: "asc" }],
  });
  const entries: HoursCsvEntry[] = rows.map((r) => {
    const v = toView(r);
    return {
      dateKey: v.dateKey,
      hours: v.hours,
      employer: v.employer,
      supervisor: v.supervisor,
      workType: v.workType,
      verification: v.verification,
      documentName: v.document?.fileName ?? null,
      programName: v.program?.name ?? null,
      description: v.description,
      createdAt: v.createdAt,
    };
  });
  return { csv: hoursCsv(entries), rows: entries.length, todayKey: dateKey(todayInTz(tz, now)) };
}

