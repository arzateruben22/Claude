import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import { archiveApplication, changeStatus, createApplication } from "@/lib/applications/service";
import { getForecastData } from "@/lib/forecast/queries";
import { computeForecast } from "@/lib/forecast/model";

let userId = "";
let otherId = "";

const app = (companyName: string, positionTitle: string, status: "SAVED" | "SUBMITTED") =>
  applicationInputSchema.parse({ companyName, positionTitle, status, appliedAt: status === "SUBMITTED" ? "2026-10-01" : undefined });

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  userId = (
    await prisma.user.create({
      data: {
        email: `forecast-test+${stamp}@careerquest.test`,
        passwordHash: "x",
        name: "Forecast Test",
        profile: { create: { weeklyApplicationTarget: 15 } },
        stats: { create: {} },
      },
    })
  ).id;
  otherId = (await prisma.user.create({ data: { email: `forecast-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other", stats: { create: {} } } })).id;

  const a1 = await createApplication(userId, app("Acme Electric", "Apprentice", "SUBMITTED"));
  const a2 = await createApplication(userId, app("ACME Electric, Inc.", "Helper", "SUBMITTED"));
  const a3 = await createApplication(userId, app("Bright Power", "Trainee", "SUBMITTED"));
  await createApplication(userId, app("Saved Lead Co", "Wireman", "SAVED"));
  const archived = await createApplication(userId, app("Archived Co", "Helper", "SUBMITTED"));
  await changeStatus(userId, a1.application.id, { status: "INTERVIEWING", occurredAt: new Date("2026-10-06T18:00:00Z") }, "USER", true);
  await changeStatus(userId, a2.application.id, { status: "REJECTED", occurredAt: new Date("2026-10-03T18:00:00Z") }, "USER", true);
  await changeStatus(userId, a3.application.id, { status: "OFFER", occurredAt: new Date("2026-10-10T18:00:00Z") }, "USER", true);
  await archiveApplication(userId, archived.application.id);
  // Another user's data must never leak into the forecast.
  await createApplication(otherId, app("Acme Electric", "Apprentice", "SUBMITTED"));
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await prisma.$disconnect();
});

describe("getForecastData", () => {
  it("counts the user's applied, non-archived applications, clustered by employer", async () => {
    const data = await getForecastData(userId, new Date("2026-10-22T18:00:00Z"));
    expect(data.capped).toBe(false);
    expect(data.loaded).toBe(4); // archived excluded; the saved lead is loaded but never applied
    expect(data.horizon).toBe(15);
    expect(data.horizonSource).toBe("profile");
    expect(data.input.applied).toBe(3);
    expect(data.input.interviews).toBe(2); // interviewing + offer (later stages imply earlier ones)
    expect(data.input.offers).toBe(1);
    expect([...data.input.clusterSizes].sort()).toEqual([1, 2]); // "Acme Electric" twice
    expect(data.input.responseDays).toHaveLength(3);
    expect(data.input.awaitingAgesDays).toEqual([]);

    const f = computeForecast(data.input, { rho: 0.5, horizon: data.horizon });
    expect(f.design.deff).toBeGreaterThan(1);
    expect(f.quality).toBe("prior-dominated");
  });

  it("returns an empty history for a user with no applied applications", async () => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const fresh = await prisma.user.create({ data: { email: `forecast-fresh+${stamp}@careerquest.test`, passwordHash: "x", name: "Fresh" } });
    try {
      const data = await getForecastData(fresh.id);
      expect(data.input).toEqual({ applied: 0, interviews: 0, offers: 0, clusterSizes: [], responseDays: [], awaitingAgesDays: [] });
      expect(data.horizon).toBe(25);
      expect(data.horizonSource).toBe("default");
    } finally {
      await prisma.user.delete({ where: { id: fresh.id } });
    }
  });
});
