/** Registry truths: one entry per provider, honest capability matrices, and exactly one status each. */
import { describe, expect, it } from "vitest";
import { IntegrationProvider } from "@/generated/prisma/enums";
import {
  CAPABILITY_NAMES,
  CONSENT,
  DISPLAY_STATUSES,
  EXTENSION_ACTIVE_DAYS,
  INTEGRATION_KEYS,
  PROVIDERS,
  computeStatus,
  getProvider,
  isHistoryDays,
  oauthConfigProblem,
  oauthConfigured,
  pickPrimaryConnection,
  type IntegrationEnv,
} from "@/lib/integrations/registry";

const CONFIGURED: IntegrationEnv = {
  GOOGLE_CLIENT_ID: "gid",
  GOOGLE_CLIENT_SECRET: "gsecret",
  MICROSOFT_CLIENT_ID: "mid",
  MICROSOFT_CLIENT_SECRET: "msecret",
  APP_URL: "https://careerquest.test",
};
const EMPTY: IntegrationEnv = { APP_URL: "https://careerquest.test" };
const NOW = new Date("2026-10-22T12:00:00Z");
const base = { env: CONFIGURED, connection: null, extensionTokenUsage: null, now: NOW };

describe("registry", () => {
  it("has one entry per schema provider plus union portals, each with a complete capability matrix", () => {
    expect([...INTEGRATION_KEYS].sort()).toEqual([...Object.values(IntegrationProvider), "UNION_PORTALS"].sort());
    expect(new Set(INTEGRATION_KEYS).size).toBe(INTEGRATION_KEYS.length);
    for (const p of PROVIDERS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.capture.length).toBeGreaterThan(0);
      for (const c of CAPABILITY_NAMES) expect(["supported", "experimental", "unsupported"]).toContain(p.capabilities[c]);
    }
  });

  it("never claims an applicant API for job boards or ATS providers", () => {
    for (const key of ["INDEED", "GLASSDOOR", "LINKEDIN", "ZIPRECRUITER", "WORKDAY", "SMARTRECRUITERS", "ICIMS", "ADP", "GOVERNMENTJOBS", "USAJOBS", "UNION_PORTALS", "GREENHOUSE", "LEVER"]) {
      const p = getProvider(key)!;
      expect(p.capabilities.importApplications, key).toBe("unsupported");
      expect(p.capabilities.syncStatuses, key).toBe("unsupported");
    }
    expect(getProvider("GREENHOUSE")!.capabilities.getJobDetails).toBe("experimental");
    expect(getProvider("LEVER")!.capabilities.getJobDetails).toBe("experimental");
    expect(getProvider("INDEED")!.capabilities.getJobDetails).toBe("unsupported");
    expect(getProvider("GREENHOUSE")!.verificationNote).toMatch(/not been verified live/);
  });

  it("mentions LinkedIn's data export as a capture path", () => {
    expect(getProvider("LINKEDIN")!.capture.join(" ")).toMatch(/Job Applications\.csv/);
    expect(getProvider("LINKEDIN")!.importLinks.some((l) => l.href === "/applications/import/exports")).toBe(true);
  });

  it("documents consent for both mailbox providers", () => {
    expect(CONSENT.GMAIL.scopes.map((s) => s.scope)).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(CONSENT.OUTLOOK.scopes.map((s) => s.scope)).toEqual(["offline_access", "Mail.Read", "User.Read"]);
    for (const c of Object.values(CONSENT)) {
      expect(c.reads.length && c.stores.length && c.retention.length && c.disconnect.length).toBeTruthy();
    }
    expect(isHistoryDays(90)).toBe(true);
    expect(isHistoryDays(45)).toBe(false);
  });
});

describe("computeStatus", () => {
  it("returns exactly one known status for every provider in every situation", () => {
    for (const key of INTEGRATION_KEYS) {
      for (const env of [CONFIGURED, EMPTY]) {
        for (const connection of [null, { status: "CONNECTED" as const, accountEmail: "a@b.com" }, { status: "NEEDS_REAUTH" as const, accountEmail: null }]) {
          const r = computeStatus(key, { env, connection, extensionTokenUsage: null, now: NOW });
          expect(DISPLAY_STATUSES).toContain(r.status);
          expect(r.reason.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("Gmail/Outlook are Manual-only without OAuth client configuration", () => {
    for (const key of ["GMAIL", "OUTLOOK"] as const) {
      expect(computeStatus(key, { ...base, env: EMPTY })).toEqual({
        status: "Manual-only",
        reason: "OAuth client not configured — import .eml/.mbox files instead",
      });
      expect(oauthConfigured(key, EMPTY)).toBe(false);
    }
    // Client id without secret is not configured either.
    expect(oauthConfigured("GMAIL", { ...EMPTY, GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "  " })).toBe(false);
    expect(oauthConfigProblem("GMAIL", { ...CONFIGURED, APP_URL: "" })).toMatch(/APP_URL/);
  });

  it("is never Connected without a CONNECTED connection", () => {
    expect(computeStatus("GMAIL", base)).toEqual({ status: "Available", reason: expect.stringMatching(/Ready to connect/) });
    expect(computeStatus("GMAIL", { ...base, connection: { status: "CONNECTED", accountEmail: "me@gmail.com" } })).toEqual({
      status: "Connected",
      reason: "Connected as me@gmail.com",
    });
    expect(computeStatus("OUTLOOK", { ...base, connection: { status: "NEEDS_REAUTH", accountEmail: "me@outlook.com" } }).status).toBe("Available");
    expect(computeStatus("OUTLOOK", { ...base, connection: { status: "ERROR", accountEmail: null, lastError: "boom" } }).reason).toMatch(/boom/);
    expect(computeStatus("GMAIL", { ...base, connection: { status: "DISCONNECTED", accountEmail: "x@y.z" } }).status).toBe("Available");
    // A stored connection cannot be "Connected" when the server can no longer use it.
    const orphan = computeStatus("GMAIL", { ...base, env: EMPTY, connection: { status: "CONNECTED", accountEmail: "me@gmail.com" } });
    expect(orphan.status).toBe("Manual-only");
    expect(orphan.reason).toMatch(/cannot sync/);
  });

  it("job boards and ATS portals are Manual-only; Greenhouse and Lever are Experimental", () => {
    for (const key of ["INDEED", "GLASSDOOR", "LINKEDIN", "ZIPRECRUITER", "WORKDAY", "SMARTRECRUITERS", "ICIMS", "ADP", "GOVERNMENTJOBS", "USAJOBS", "UNION_PORTALS"]) {
      expect(computeStatus(key, base).status, key).toBe("Manual-only");
    }
    expect(computeStatus("LINKEDIN", base).reason).toMatch(/data export/);
    expect(computeStatus("GREENHOUSE", base)).toMatchObject({ status: "Experimental", reason: expect.stringMatching(/not live-verified/) });
    expect(computeStatus("LEVER", base).status).toBe("Experimental");
    expect(computeStatus("MONSTER", base).status).toBe("Unsupported");
  });

  it("Chrome extension is Connected only with a token used in the last 30 days", () => {
    const day = 86_400_000;
    expect(computeStatus("CHROME_EXTENSION", base)).toMatchObject({ status: "Available", reason: expect.stringMatching(/Settings → Developer tokens/) });
    expect(computeStatus("CHROME_EXTENSION", { ...base, extensionTokenUsage: { lastUsedAt: null } })).toMatchObject({
      status: "Available",
      reason: expect.stringMatching(/has not used it yet/),
    });
    expect(computeStatus("CHROME_EXTENSION", { ...base, extensionTokenUsage: { lastUsedAt: new Date(NOW.getTime() - 2 * day) } })).toEqual({
      status: "Connected",
      reason: "A developer token was used by the extension 2 days ago.",
    });
    expect(
      computeStatus("CHROME_EXTENSION", { ...base, extensionTokenUsage: { lastUsedAt: new Date(NOW.getTime() - (EXTENSION_ACTIVE_DAYS + 1) * day) } }).status,
    ).toBe("Available");
  });

  it("picks the most relevant connection", () => {
    const list = [
      { id: "a", status: "DISCONNECTED" as const },
      { id: "b", status: "NEEDS_REAUTH" as const },
      { id: "c", status: "CONNECTED" as const },
    ];
    expect(pickPrimaryConnection(list)?.id).toBe("c");
    expect(pickPrimaryConnection(list.slice(0, 2))?.id).toBe("b");
    expect(pickPrimaryConnection([])).toBeNull();
  });
});
