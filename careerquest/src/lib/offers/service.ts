import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus, EmploymentType, OfferStatus, SalaryPeriod } from "@/generated/prisma/enums";
import { changeStatus } from "@/lib/applications/service";
import { STATUS_LABELS, statusRank } from "@/lib/applications/status";
import { benefitsNotesSchema, type BenefitsNotes } from "./schema";

/**
 * Offer CRUD. Every read is scoped by userId; creating an offer verifies the application belongs to
 * the user; updates and deletes match `{ id, userId }`. Offers never change an application's status
 * on their own — `moveApplicationToOffer` does that only on an explicit user action, through the
 * applications service.
 */

export class OfferApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found.");
    this.name = "OfferApplicationNotFoundError";
  }
}

const dec = (v: Prisma.Decimal | null): number | null => (v === null ? null : Number(v));

export type OfferApplicationRef = {
  id: string;
  companyName: string;
  positionTitle: string;
  status: ApplicationStatus;
};

export type OfferRecord = {
  id: string;
  applicationId: string;
  application: OfferApplicationRef;
  baseAmount: number;
  period: SalaryPeriod;
  hoursPerWeek: number;
  overtimeHours: number;
  signingBonus: number | null;
  annualBonus: number | null;
  benefitsValue: number | null;
  benefits: BenefitsNotes;
  startDate: Date | null;
  decisionDue: Date | null;
  status: OfferStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const offerSelect = {
  id: true,
  applicationId: true,
  baseAmount: true,
  period: true,
  hoursPerWeek: true,
  overtimeHours: true,
  signingBonus: true,
  annualBonus: true,
  benefitsValue: true,
  benefits: true,
  startDate: true,
  decisionDue: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  application: { select: { id: true, companyName: true, positionTitle: true, status: true } },
} satisfies Prisma.OfferSelect;

type OfferRow = Prisma.OfferGetPayload<{ select: typeof offerSelect }>;

function toRecord(r: OfferRow): OfferRecord {
  return {
    id: r.id,
    applicationId: r.applicationId,
    application: r.application,
    baseAmount: Number(r.baseAmount),
    period: r.period,
    hoursPerWeek: r.hoursPerWeek,
    overtimeHours: r.overtimeHours,
    signingBonus: dec(r.signingBonus),
    annualBonus: dec(r.annualBonus),
    benefitsValue: dec(r.benefitsValue),
    benefits: benefitsNotesSchema.parse(r.benefits),
    startDate: r.startDate,
    decisionDue: r.decisionDue,
    status: r.status,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Upper bound on offers shown/compared at once. */
export const MAX_OFFERS = 200;

export async function listOffers(userId: string): Promise<OfferRecord[]> {
  const rows = await prisma.offer.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }], take: MAX_OFFERS, select: offerSelect });
  return rows.map(toRecord);
}

export async function getOffer(userId: string, id: string): Promise<OfferRecord | null> {
  const row = await prisma.offer.findFirst({ where: { id, userId }, select: offerSelect });
  return row ? toRecord(row) : null;
}

export type OfferApplicationContext = OfferApplicationRef & {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  employmentType: EmploymentType;
  location: string | null;
};

/** The application an offer is being recorded for, or null when it is not the user's. */
export async function getOfferApplication(userId: string, applicationId: string): Promise<OfferApplicationContext | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      companyName: true,
      positionTitle: true,
      status: true,
      salaryMin: true,
      salaryMax: true,
      salaryPeriod: true,
      employmentType: true,
      location: true,
    },
  });
  if (!app) return null;
  return { ...app, salaryMin: dec(app.salaryMin), salaryMax: dec(app.salaryMax) };
}

export type OfferCandidate = OfferApplicationRef & { appliedAt: Date | null };

/** Applications the user can attach an offer to (most advanced and most recent first). */
export async function listOfferCandidates(userId: string): Promise<OfferCandidate[]> {
  const rows = await prisma.application.findMany({
    where: { userId, mergedIntoId: null },
    orderBy: [{ statusUpdatedAt: "desc" }],
    take: 300,
    select: { id: true, companyName: true, positionTitle: true, status: true, appliedAt: true },
  });
  const rank = (s: ApplicationStatus) => (s === "OFFER" ? 0 : s === "ACCEPTED" || s === "HIRED" ? 1 : s === "INTERVIEWING" ? 2 : 3);
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}

/** Prefill for a new offer: period/hours from the application; the amount only when the posting gave one figure. */
export function offerPrefill(app: OfferApplicationContext): { period: SalaryPeriod; baseAmount: string } {
  const period: SalaryPeriod = app.salaryPeriod ?? (app.salaryMax !== null && app.salaryMax < 1000 ? "HOURLY" : "ANNUAL");
  const single =
    app.salaryMin !== null && app.salaryMax !== null
      ? app.salaryMin === app.salaryMax
        ? app.salaryMin
        : null
      : (app.salaryMin ?? app.salaryMax);
  return { period, baseAmount: single !== null ? String(single) : "" };
}

export type OfferData = {
  baseAmount: number;
  period: SalaryPeriod;
  hoursPerWeek: number;
  overtimeHours: number;
  signingBonus?: number;
  annualBonus?: number;
  benefitsValue?: number;
  benefits: BenefitsNotes;
  startDate?: Date | null;
  decisionDue?: Date | null;
  status: OfferStatus;
  notes?: string;
};

function writeData(d: OfferData) {
  return {
    baseAmount: d.baseAmount,
    period: d.period,
    hoursPerWeek: d.hoursPerWeek,
    overtimeHours: d.overtimeHours,
    signingBonus: d.signingBonus ?? null,
    annualBonus: d.annualBonus ?? null,
    benefitsValue: d.benefitsValue ?? null,
    benefits: d.benefits as Prisma.InputJsonValue,
    startDate: d.startDate ?? null,
    decisionDue: d.decisionDue ?? null,
    status: d.status,
    notes: d.notes ?? null,
  };
}

/** Create an offer on one of the user's applications. Throws OfferApplicationNotFoundError otherwise. */
export async function createOffer(userId: string, applicationId: string, data: OfferData): Promise<OfferRecord> {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
    if (!app) throw new OfferApplicationNotFoundError();
    const row = await tx.offer.create({ data: { userId, applicationId: app.id, ...writeData(data) }, select: offerSelect });
    return toRecord(row);
  });
}

/** Update an offer the user owns; null when it does not exist for this user. The application never changes. */
export async function updateOffer(userId: string, id: string, data: OfferData): Promise<OfferRecord | null> {
  const res = await prisma.offer.updateMany({ where: { id, userId }, data: writeData(data) });
  if (res.count !== 1) return null;
  return getOffer(userId, id);
}

export async function deleteOffer(userId: string, id: string): Promise<{ applicationId: string } | null> {
  const row = await prisma.offer.findFirst({ where: { id, userId }, select: { applicationId: true } });
  if (!row) return null;
  const res = await prisma.offer.deleteMany({ where: { id, userId } });
  return res.count === 1 ? { applicationId: row.applicationId } : null;
}

/** True when the status is before the Offer stage (including closed statuses), so moving to OFFER is a step forward or a reopening. */
export function isBelowOffer(status: ApplicationStatus): boolean {
  return statusRank(status) < statusRank("OFFER");
}

export type MoveToOfferResult = { ok: true; message: string; xpAwarded: number } | { ok: false; message: string };

/**
 * Explicit user action: move the application to the Offer stage through the applications service
 * (history row, event, XP — all attributed to the user and verified).
 */
export async function moveApplicationToOffer(userId: string, applicationId: string): Promise<MoveToOfferResult> {
  const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { status: true } });
  if (!app) return { ok: false, message: "Application not found." };
  if (!isBelowOffer(app.status)) return { ok: false, message: `This application is already at ${STATUS_LABELS[app.status]}.` };
  const res = await changeStatus(userId, applicationId, { status: "OFFER", note: "Offer recorded in the salary simulator" }, "USER", true);
  if (!res.applied) return { ok: false, message: res.message };
  return { ok: true, message: `Moved to ${STATUS_LABELS.OFFER}.`, xpAwarded: res.xpAwarded };
}

export type SalaryTargets = { immediate: number; longTerm: number; timezone: string };

/** The user's salary targets from their profile (defaults match the profile schema). */
export async function getSalaryTargets(userId: string): Promise<SalaryTargets> {
  const p = await prisma.userProfile.findUnique({ where: { userId }, select: { immediateSalaryTarget: true, longTermSalaryTarget: true, timezone: true } });
  return { immediate: p?.immediateSalaryTarget ?? 80_000, longTerm: p?.longTermSalaryTarget ?? 150_000, timezone: p?.timezone || "America/Los_Angeles" };
}

/** Target list for `offerGaps`, without duplicates. */
export function targetList(t: SalaryTargets): { label: string; amount: number }[] {
  const list = [
    { label: "Immediate target", amount: t.immediate },
    { label: "Long-term target", amount: t.longTerm },
  ];
  return list.filter((x, i) => x.amount > 0 && list.findIndex((y) => y.amount === x.amount) === i);
}
