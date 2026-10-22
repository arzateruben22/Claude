import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it.each([
    ["/applications", "/applications"],
    ["/applications?status=SUBMITTED#top", "/applications?status=SUBMITTED#top"],
    ["/settings/account", "/settings/account"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/ok\n/evil",
    "",
    null,
    undefined,
    42,
    "/" + "a".repeat(600),
  ])("rejects %j", (input) => {
    expect(safeNext(input)).toBe("/dashboard");
  });
});
