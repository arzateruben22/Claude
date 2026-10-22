import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { generateDueNotifications, getNotificationSummary, markAllRead, savePrefs } from "@/lib/notifications/service";
import { deliverPush } from "@/lib/notifications/push";
import { DEFAULT_PREFS } from "@/lib/notifications/prefs";

let userId = "";
let otherId = "";

beforeAll(async () => {
  const mk = (tag: string) =>
    prisma.user.create({
      data: { email: `notif-${tag}-${Date.now()}-${Math.random()}@careerquest.test`, name: "N", passwordHash: "x", profile: { create: {} } },
    });
  userId = (await mk("a")).id;
  otherId = (await mk("b")).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("notification generation", () => {
  it("creates a follow-up reminder once, scoped to its owner", async () => {
    await prisma.application.create({
      data: {
        userId,
        companyName: "Acme Electric",
        normalizedCompany: "acme electric",
        positionTitle: "Apprentice",
        normalizedTitle: "apprentice",
        status: "SUBMITTED",
        followUpAt: new Date(Date.now() - 3600e3),
      },
    });
    const first = await generateDueNotifications(userId, { force: true });
    const second = await generateDueNotifications(userId, { force: true });
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect((await getNotificationSummary(userId)).unread).toBe(1);
    expect((await getNotificationSummary(otherId)).unread).toBe(0);
    await markAllRead(userId);
    expect((await getNotificationSummary(userId)).unread).toBe(0);
  });

  it("ignores follow-ups on archived, merged or closed applications", async () => {
    const base = { userId, normalizedCompany: "x", positionTitle: "T", normalizedTitle: "t", followUpAt: new Date(Date.now() - 3600e3) };
    await prisma.application.createMany({
      data: [
        { ...base, companyName: "Archived Co", status: "SUBMITTED", archivedAt: new Date() },
        { ...base, companyName: "Closed Co", status: "REJECTED" },
      ],
    });
    expect(await generateDueNotifications(userId, { force: true })).toBe(0);
  });

  it("delivers push only when the user opted in, and drops gone subscriptions", async () => {
    await prisma.pushSubscription.create({ data: { userId, endpoint: `https://push.example.test/${userId}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } } });
    await prisma.notification.create({ data: { userId, type: "TEST", title: "Hello", dedupeKey: "test:1" } });
    const sent: string[] = [];
    const sender = async (_s: unknown, payload: string) => {
      sent.push(payload);
    };
    expect(await deliverPush(userId, sender)).toBe(0); // push pref off by default
    await savePrefs(userId, { ...DEFAULT_PREFS, push: true });
    expect(await deliverPush(userId, sender)).toBe(1);
    expect(JSON.parse(sent[0]!).title).toBe("Hello");
    expect(await deliverPush(userId, sender)).toBe(0); // already pushed
    await prisma.notification.create({ data: { userId, type: "TEST", title: "Again", dedupeKey: "test:2" } });
    const gone = async () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    };
    await deliverPush(userId, gone);
    expect(await prisma.pushSubscription.count({ where: { userId } })).toBe(0);
  });
});
