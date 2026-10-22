import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import { changeStatus, createApplication } from "@/lib/applications/service";
import {
  OfferApplicationNotFoundError,
  createOffer,
  deleteOffer,
  getOffer,
  getOfferApplication,
  getSalaryTargets,
  isBelowOffer,
  listOfferCandidates,
  listOffers,
  moveApplicationToOffer,
  offerPrefill,
  updateOffer,
  type OfferData,
} from "@/lib/offers/service";

const TZ = "America/Los_Angeles";
let userId = "";
let otherId = "";
let appId = "";
let rejectedAppId = "";

const data = (over: Partial<OfferData> = {}): OfferData => ({
  baseAmount: 34.5,
  period: "HOURLY",
  hoursPerWeek: 40,
  overtimeHours: 4,
  signingBonus: 1000,
  annualBonus: undefined,
  benefitsValue: 9000,
  benefits: { health: "Medical, employer pays 90%" },
  startDate: new Date("2026-11-02T20:00:00Z"),
  decisionDue: null,
  status: "RECEIVED",
  notes: "Verbal offer, written to follow",
  ...over,
});

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `offers-test+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Offers Test",
      profile: { create: { timezone: TZ, immediateSalaryTarget: 90_000, longTermSalaryTarget: 150_000 } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({ data: { email: `offers-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other", stats: { create: {} } } });
  otherId = other.id;
  const app = await createApplication(
    userId,
    applicationInputSchema.parse({ companyName: "Volt Electric", positionTitle: "Electrician Trainee", status: "SUBMITTED", salaryMin: "30", salaryMax: "30", salaryPeriod: "HOURLY" }),
  );
  appId = app.application.id;
  const rej = await createApplication(userId, applicationInputSchema.parse({ companyName: "Spark Co", positionTitle: "Apprentice", status: "SUBMITTED" }));
  rejectedAppId = rej.application.id;
  await changeStatus(userId, rejectedAppId, { status: "REJECTED" }, "USER", true);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await prisma.$disconnect();
});

describe("offer ownership", () => {
  let offerId = "";

  it("creates an offer on the user's own application with Decimal values converted", async () => {
    const offer = await createOffer(userId, appId, data());
    offerId = offer.id;
    expect(offer.applicationId).toBe(appId);
    expect(offer.baseAmount).toBe(34.5);
    expect(offer.signingBonus).toBe(1000);
    expect(offer.annualBonus).toBeNull();
    expect(offer.benefits).toEqual({ health: "Medical, employer pays 90%" });
    expect(offer.application).toMatchObject({ companyName: "Volt Electric", status: "SUBMITTED" });
    // Recording an offer never changes the application's status by itself.
    const app = await prisma.application.findUniqueOrThrow({ where: { id: appId } });
    expect(app.status).toBe("SUBMITTED");
  });

  it("refuses to attach an offer to another user's application", async () => {
    await expect(createOffer(otherId, appId, data())).rejects.toBeInstanceOf(OfferApplicationNotFoundError);
    expect(await prisma.offer.count({ where: { applicationId: appId } })).toBe(1);
    expect(await getOfferApplication(otherId, appId)).toBeNull();
  });

  it("hides, and refuses to change or delete, another user's offer", async () => {
    expect(await getOffer(otherId, offerId)).toBeNull();
    expect(await listOffers(otherId)).toEqual([]);
    expect(await updateOffer(otherId, offerId, data({ baseAmount: 99 }))).toBeNull();
    expect(await deleteOffer(otherId, offerId)).toBeNull();
    const row = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
    expect(Number(row.baseAmount)).toBe(34.5);
  });

  it("lets the owner update and delete", async () => {
    const updated = await updateOffer(userId, offerId, data({ baseAmount: 36, status: "NEGOTIATING", benefits: {} }));
    expect(updated).toMatchObject({ baseAmount: 36, status: "NEGOTIATING", applicationId: appId, benefits: {} });
    expect((await listOffers(userId)).map((o) => o.id)).toEqual([offerId]);
    expect(await deleteOffer(userId, offerId)).toEqual({ applicationId: appId });
    expect(await getOffer(userId, offerId)).toBeNull();
    expect(await prisma.application.count({ where: { id: appId } })).toBe(1);
  });

  it("prefills period and a single posted amount from the user's application", async () => {
    const ctx = await getOfferApplication(userId, appId);
    expect(ctx).toMatchObject({ companyName: "Volt Electric", salaryMin: 30, salaryMax: 30, salaryPeriod: "HOURLY" });
    expect(offerPrefill(ctx!)).toEqual({ period: "HOURLY", baseAmount: "30" });
    expect(offerPrefill({ ...ctx!, salaryMin: 28, salaryMax: 36 })).toEqual({ period: "HOURLY", baseAmount: "" });
    const candidates = await listOfferCandidates(userId);
    expect(candidates.map((c) => c.id).sort()).toEqual([appId, rejectedAppId].sort());
    expect(await listOfferCandidates(otherId)).toEqual([]);
  });

  it("reads salary targets from the profile with defaults for users without one", async () => {
    expect(await getSalaryTargets(userId)).toEqual({ immediate: 90_000, longTerm: 150_000, timezone: TZ });
    expect(await getSalaryTargets(otherId)).toEqual({ immediate: 80_000, longTerm: 150_000, timezone: TZ });
  });
});

describe("moving the application to the Offer stage", () => {
  it("is refused for another user's application and leaves it unchanged", async () => {
    const res = await moveApplicationToOffer(otherId, appId);
    expect(res).toEqual({ ok: false, message: "Application not found." });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: appId } })).status).toBe("SUBMITTED");
  });

  it("changes status through the applications service as a verified user change", async () => {
    expect(isBelowOffer("SUBMITTED")).toBe(true);
    const res = await moveApplicationToOffer(userId, appId);
    expect(res.ok).toBe(true);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: appId } });
    expect(app.status).toBe("OFFER");
    expect(app.statusVerified).toBe(true);
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: appId }, orderBy: { createdAt: "desc" }, take: 1 });
    expect(history[0]).toMatchObject({ fromStatus: "SUBMITTED", toStatus: "OFFER", source: "USER", verified: true });
    const events = await prisma.applicationEvent.findMany({ where: { applicationId: appId, type: "OFFER_RECEIVED" } });
    expect(events).toHaveLength(1);
  });

  it("is refused once the application is at Offer or later", async () => {
    expect(isBelowOffer("OFFER")).toBe(false);
    expect(isBelowOffer("HIRED")).toBe(false);
    const res = await moveApplicationToOffer(userId, appId);
    expect(res.ok).toBe(false);
    expect(await prisma.applicationStatusHistory.count({ where: { applicationId: appId, toStatus: "OFFER" } })).toBe(1);
  });

  it("can reopen a rejected application at the Offer stage", async () => {
    expect(isBelowOffer("REJECTED")).toBe(true);
    const res = await moveApplicationToOffer(userId, rejectedAppId);
    expect(res.ok).toBe(true);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: rejectedAppId } })).status).toBe("OFFER");
  });
});
