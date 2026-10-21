import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { buildAccountExport, exportFileName, stripSensitiveKeys } from "@/lib/account/export";
import { changePassword, deleteAccount, listSessions, listTokens, revokeOtherSessions } from "@/lib/account/service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const PASSWORD = "CorrectHorse42";
const ACCESS_SECRET = "ENC-ACCESS-SECRET-9f8e7d";
const REFRESH_SECRET = "ENC-REFRESH-SECRET-1a2b3c";
const TOKEN_HASH = "tokenhash-secret-deadbeefcafe";
let userId = "";
let otherUserId = "";
let applicationId = "";
let otherApplicationId = "";
let passwordHash = "";
const sessionA = `sess-a-${Date.now()}`;
const sessionB = `sess-b-${Date.now()}`;

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: {
      email: `export-test+${stamp}@careerquest.test`,
      passwordHash,
      name: "Export Test",
      profile: { create: {} },
      stats: { create: { totalXp: 75 } },
      sessions: {
        create: [
          { id: sessionA, expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1" },
          { id: sessionB, expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0" },
        ],
      },
      integrations: {
        create: {
          provider: "GMAIL",
          accountEmail: `inbox+${stamp}@example.com`,
          status: "CONNECTED",
          accessTokenEnc: ACCESS_SECRET,
          refreshTokenEnc: REFRESH_SECRET,
          syncCursor: "cursor-12345",
        },
      },
      apiTokens: { create: { name: "Chrome on laptop", tokenHash: TOKEN_HASH } },
      pushSubs: { create: { endpoint: `https://push.example.com/${stamp}`, keys: { p256dh: "pub-key", auth: "auth-secret" } } },
      xpLedger: { create: { amount: 75, reason: "PROFILE_COMPLETED", dedupeKey: `xp:profile:test:${stamp}` } },
    },
    select: { id: true },
  });
  userId = user.id;
  const app = await prisma.application.create({
    data: {
      userId,
      companyName: "Acme Electric",
      normalizedCompany: "acme electric",
      positionTitle: "Apprentice Electrician",
      normalizedTitle: "apprentice electrician",
      status: "SUBMITTED",
      statusHistory: { create: { toStatus: "SUBMITTED", source: "USER", verified: true } },
      events: { create: { userId, type: "APPLIED", source: "USER", verified: true, dedupeKey: `test:${stamp}:applied` } },
      interviews: { create: { userId, type: "PHONE_SCREEN", scheduledAt: new Date("2026-11-01T17:00:00Z") } },
    },
    select: { id: true },
  });
  applicationId = app.id;

  const other = await prisma.user.create({
    data: { email: `export-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" },
    select: { id: true },
  });
  otherUserId = other.id;
  const otherApp = await prisma.application.create({
    data: {
      userId: otherUserId,
      companyName: "Private Co Nobody Else",
      normalizedCompany: "private co nobody else",
      positionTitle: "Secret Role",
      normalizedTitle: "secret role",
    },
    select: { id: true },
  });
  otherApplicationId = otherApp.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("buildAccountExport", () => {
  it("contains the user's application (with history, events, interviews) and never any credential material", async () => {
    const payload = await buildAccountExport(userId);
    const text = JSON.stringify(payload);

    expect(payload.format).toBe("careerquest.account-export.v1");
    expect((payload.user as { email: string }).email).toContain("export-test+");
    const apps = payload.applications as { id: string; statusHistory: unknown[]; events: unknown[]; interviews: unknown[] }[];
    expect(apps).toHaveLength(1);
    expect(apps[0]!.id).toBe(applicationId);
    expect(apps[0]!.statusHistory).toHaveLength(1);
    expect(apps[0]!.events).toHaveLength(1);
    expect(apps[0]!.interviews).toHaveLength(1);
    expect((payload.counts as { applications: number }).applications).toBe(1);

    const integrations = payload.integrations as Record<string, unknown>[];
    expect(integrations).toHaveLength(1);
    expect(integrations[0]!.provider).toBe("GMAIL");
    expect(integrations[0]).not.toHaveProperty("accessTokenEnc");
    expect(integrations[0]).not.toHaveProperty("refreshTokenEnc");
    expect(integrations[0]).not.toHaveProperty("syncCursor");

    const tokens = payload.apiTokens as Record<string, unknown>[];
    expect(tokens[0]!.name).toBe("Chrome on laptop");
    expect(tokens[0]).not.toHaveProperty("tokenHash");
    expect(payload.user).not.toHaveProperty("passwordHash");
    expect((payload.sessions as unknown[]).length).toBe(2);
    expect((payload.xpLedger as unknown[]).length).toBe(1);
    expect((payload.stats as { totalXp: number }).totalXp).toBe(75);

    for (const forbidden of ["accessTokenEnc", "refreshTokenEnc", "passwordHash", "tokenHash", "syncCursor", ACCESS_SECRET, REFRESH_SECRET, TOKEN_HASH, passwordHash, "auth-secret", sessionA]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("never includes another user's records", async () => {
    const text = JSON.stringify(await buildAccountExport(userId));
    expect(text).not.toContain(otherApplicationId);
    expect(text).not.toContain("Private Co Nobody Else");
    const otherText = JSON.stringify(await buildAccountExport(otherUserId));
    expect(otherText).not.toContain(applicationId);
    expect(otherText).toContain(otherApplicationId);
  });

  it("stripSensitiveKeys removes denied keys at any depth and exportFileName is dated", () => {
    const out = stripSensitiveKeys({
      a: 1,
      passwordHash: "x",
      nested: [{ tokenHash: "y", keep: true }, { deeper: { accessTokenEnc: "z", ok: null } }],
    });
    expect(out).toEqual({ a: 1, nested: [{ keep: true }, { deeper: { ok: null } }] });
    expect(exportFileName(new Date("2026-10-21T15:00:00Z"))).toBe("careerquest-export-2026-10-21.json");
  });

  it("rejects unknown users", async () => {
    await expect(buildAccountExport("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/i);
  });
});

describe("sessions, password and deletion", () => {
  it("listSessions marks the current session and revokeOtherSessions keeps it", async () => {
    const before = await listSessions(userId, sessionA);
    expect(before.map((s) => s.current)).toContain(true);
    expect(before.find((s) => s.id === sessionA)?.idPrefix).toBe(sessionA.slice(0, 8));
    const removed = await revokeOtherSessions(userId, sessionA);
    expect(removed).toBe(1);
    const after = await listSessions(userId, sessionA);
    expect(after.map((s) => s.id)).toEqual([sessionA]);
    // another user's sessions are not touched by scoping
    expect(await revokeOtherSessions(otherUserId, null)).toBe(0);
  });

  it("changePassword verifies the current password, stores the new hash and signs out other sessions", async () => {
    await prisma.session.create({ data: { id: `${sessionB}-again`, userId, expiresAt: new Date(Date.now() + 86_400_000) } });
    const wrong = await changePassword(userId, "nope-nope-1", "NewerHorse99", sessionA);
    expect(wrong).toEqual({ ok: false, reason: "wrong_password" });

    const res = await changePassword(userId, PASSWORD, "NewerHorse99", sessionA);
    expect(res).toEqual({ ok: true, revokedSessions: 1 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    expect(await verifyPassword("NewerHorse99", user.passwordHash)).toBe(true);
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(false);
    expect((await listSessions(userId, sessionA)).map((s) => s.id)).toEqual([sessionA]);
  });

  it("listTokens returns metadata only", async () => {
    const tokens = await listTokens(userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).not.toHaveProperty("tokenHash");
    expect(tokens[0]!.scopes).toContain("capture:write");
  });

  it("deleteAccount requires the right password, writes an audit entry and cascades everything", async () => {
    const wrong = await deleteAccount(userId, "not-the-password-1");
    expect(wrong).toEqual({ ok: false, reason: "wrong_password" });
    expect(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })).not.toBeNull();

    const res = await deleteAccount(userId, "NewerHorse99", "127.0.0.1");
    expect(res).toEqual({ ok: true });
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.application.count({ where: { id: applicationId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await prisma.apiToken.count({ where: { userId } })).toBe(0);
    expect(await prisma.xpLedger.count({ where: { userId } })).toBe(0);

    const entry = await prisma.auditLog.findFirst({ where: { action: "account.delete", entityId: userId } });
    expect(entry).not.toBeNull();
    expect(entry!.userId).toBeNull(); // SetNull after the cascade
    expect((entry!.metadata as { applications: number }).applications).toBe(1);
    expect(entry!.ipAddress).toBe("127.0.0.1");

    // the other user is unaffected
    expect(await prisma.application.count({ where: { id: otherApplicationId } })).toBe(1);
  });
});
