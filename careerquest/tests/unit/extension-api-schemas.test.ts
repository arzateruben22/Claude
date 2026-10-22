import { describe, expect, it } from "vitest";
import { appBaseFromEnv, applicationDetailUrl, corsHeaders, isAllowedOrigin } from "@/lib/extension-api/cors";
import { captureBodySchema, maskPii, parseLookupQuery, storedEvidence } from "@/lib/extension-api/schemas";

const EXT = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

function body(over: Record<string, unknown> = {}, evidence: Record<string, unknown> = {}) {
  return {
    kind: "CONFIRMATION_PAGE",
    url: "https://boards.greenhouse.io/acme/jobs/123",
    platform: "GREENHOUSE",
    company: "Acme",
    title: "Electrician",
    confidence: 0.95,
    evidence: { pageTitle: "Thanks", detectedBy: ["phrase:thank you for applying"], confirmationText: "Thank you for applying.", capturedAt: "2026-10-22T10:00:00.000Z", ...evidence },
    ...over,
  };
}

describe("CORS policy", () => {
  it("echoes only chrome-extension ids and the APP_URL origin", () => {
    expect(isAllowedOrigin(EXT, "https://app.example.com")).toBe(true);
    expect(isAllowedOrigin("chrome-extension://short", null)).toBe(false);
    expect(isAllowedOrigin("chrome-extension://ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP", null)).toBe(false);
    expect(isAllowedOrigin("https://app.example.com", "https://app.example.com/base/")).toBe(true);
    expect(isAllowedOrigin("https://app.example.com.evil.io", "https://app.example.com")).toBe(false);
    expect(isAllowedOrigin("moz-extension://abc", "https://app.example.com")).toBe(false);
    expect(isAllowedOrigin(null, "https://app.example.com")).toBe(false);
  });

  it("builds preflight and response headers without credentials", () => {
    expect(corsHeaders(EXT, null, { preflight: true })).toEqual({
      Vary: "Origin",
      "Access-Control-Allow-Origin": EXT,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age": "600",
    });
    expect(corsHeaders(EXT, null)).toEqual({ Vary: "Origin", "Access-Control-Allow-Origin": EXT, "Access-Control-Expose-Headers": "Retry-After" });
    expect(corsHeaders("https://evil.example", "https://app.example.com", { preflight: true })).toEqual({ Vary: "Origin" });
  });

  it("builds detail URLs from APP_URL", () => {
    expect(appBaseFromEnv("https://cq.example.com/app/")).toBe("https://cq.example.com/app");
    expect(appBaseFromEnv("not a url")).toBeNull();
    expect(applicationDetailUrl("https://cq.example.com", "abc")).toBe("https://cq.example.com/applications/abc");
  });
});

describe("capture body schema", () => {
  it("accepts the extension's payload, including the captureId idempotency key", () => {
    const parsed = captureBodySchema.parse(body({}, { captureId: "c-1" }));
    expect(parsed).toMatchObject({ kind: "CONFIRMATION_PAGE", platform: "GREENHOUSE", company: "Acme" });
    expect(parsed.applicationId).toBeUndefined();
  });

  it("rejects unknown keys at both levels and enforces caps", () => {
    expect(captureBodySchema.safeParse({ ...body(), html: "<p>" }).success).toBe(false);
    expect(captureBodySchema.safeParse(body({}, { cookies: "x" })).success).toBe(false);
    expect(captureBodySchema.safeParse(body({ title: "t".repeat(301) })).success).toBe(false);
    expect(captureBodySchema.safeParse(body({}, { detectedBy: Array.from({ length: 33 }, () => "x") })).success).toBe(false);
    expect(captureBodySchema.safeParse(body({ url: "chrome://settings" })).success).toBe(false);
    expect(captureBodySchema.safeParse(body({ confidence: Number.NaN })).success).toBe(false);
    expect(captureBodySchema.safeParse(body({ applicationId: "x".repeat(65) })).success).toBe(false);
  });

  it("stores an allow-listed, masked evidence object", () => {
    const parsed = captureBodySchema.parse(body({ kind: "JOB_PAGE" }, { confirmationText: "call 714-555-0100", captureId: " c-2 " }));
    expect(storedEvidence(parsed)).toEqual({ pageTitle: "Thanks", detectedBy: ["phrase:thank you for applying"], capturedAt: "2026-10-22T10:00:00.000Z", captureId: "c-2" });
    expect(maskPii("Reach me at a.b@c.io or +1 (714) 555-0100; ref 2024-1")).toBe("Reach me at [email] or [phone]; ref 2024-1");
  });
});

describe("lookup query", () => {
  it("requires a url, company or requisition and rejects unknown or repeated params", () => {
    expect(parseLookupQuery(new URLSearchParams("url=https%3A%2F%2Fx.com%2Fj%2F1"))).toMatchObject({ ok: true });
    expect(parseLookupQuery(new URLSearchParams("title=Electrician"))).toMatchObject({ ok: false });
    expect(parseLookupQuery(new URLSearchParams("company=A&company=B"))).toMatchObject({ ok: false });
    expect(parseLookupQuery(new URLSearchParams("company=A&page=2"))).toMatchObject({ ok: false });
    expect(parseLookupQuery(new URLSearchParams("company=%20%20&requisitionId=R-1"))).toEqual({ ok: true, data: { url: undefined, company: undefined, title: undefined, requisitionId: "R-1" } });
  });
});
