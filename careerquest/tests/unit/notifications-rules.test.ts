import { describe, expect, it } from "vitest";
import { buildReminderCandidates, type ReminderSnapshot } from "@/lib/notifications/rules";
import { DEFAULT_PREFS, parsePrefs } from "@/lib/notifications/prefs";

const TZ = "America/Los_Angeles";
// 2026-10-21 10:00 PT
const now = new Date("2026-10-21T17:00:00Z");
const base: ReminderSnapshot = { now, timezone: TZ, workdaysPerWeek: 5, followUps: [], interviews: [], certifications: [], weeklyReports: [], appliedToday: 0 };

describe("buildReminderCandidates", () => {
  it("creates follow-up reminders only when due today or overdue, with a stable key", () => {
    const c = buildReminderCandidates(
      {
        ...base,
        followUps: [
          { applicationId: "a1", companyName: "Acme", positionTitle: "Apprentice", followUpAt: new Date("2026-10-21T19:00:00Z") },
          { applicationId: "a2", companyName: "Beta", positionTitle: "Helper", followUpAt: new Date("2026-10-19T19:00:00Z") },
          { applicationId: "a3", companyName: "Gamma", positionTitle: "Tech", followUpAt: new Date("2026-10-22T19:00:00Z") },
        ],
      },
      DEFAULT_PREFS,
    );
    expect(c.map((x) => x.dedupeKey)).toEqual(["followup:a1:2026-10-21", "followup:a2:2026-10-19"]);
    expect(c[0]!.body).toContain("due today");
    expect(c[0]!.body).toMatch(/never contacts anyone/);
  });

  it("uses the user's timezone for the due date (late-evening PT is still the same day)", () => {
    const late = new Date("2026-10-22T06:30:00Z"); // 23:30 PT on Oct 21
    const c = buildReminderCandidates(
      { ...base, now: late, followUps: [{ applicationId: "a1", companyName: "Acme", positionTitle: "X", followUpAt: new Date("2026-10-22T05:00:00Z") }] },
      DEFAULT_PREFS,
    );
    expect(c[0]!.dedupeKey).toBe("followup:a1:2026-10-21");
  });

  it("reminds about interviews within ~24h only", () => {
    const c = buildReminderCandidates(
      {
        ...base,
        interviews: [
          { id: "i1", applicationId: "a1", companyName: "Acme", scheduledAt: new Date(now.getTime() + 20 * 3600e3) },
          { id: "i2", applicationId: "a2", companyName: "Beta", scheduledAt: new Date(now.getTime() + 72 * 3600e3) },
          { id: "i3", applicationId: "a3", companyName: "Past", scheduledAt: new Date(now.getTime() - 3600e3) },
        ],
      },
      DEFAULT_PREFS,
    );
    expect(c.map((x) => x.dedupeKey)).toEqual(["interview:i1"]);
  });

  it("flags trainee and certificate renewals within 30 days", () => {
    const c = buildReminderCandidates(
      {
        ...base,
        certifications: [{ classification: "GENERAL", traineeExpiresAt: new Date("2026-11-10T00:00:00Z"), certificateExpiresAt: new Date("2027-06-01T00:00:00Z") }],
      },
      DEFAULT_PREFS,
    );
    expect(c).toHaveLength(1);
    expect(c[0]!.type).toBe("TRAINEE_RENEWAL");
    expect(c[0]!.title).toMatch(/expires in \d+ days/);
  });

  it("respects preferences; the evening nudge is opt-in and only on workdays after 6 pm", () => {
    const evening = new Date("2026-10-22T02:30:00Z"); // Wed 19:30 PT
    const off = buildReminderCandidates({ ...base, now: evening }, DEFAULT_PREFS);
    expect(off.find((x) => x.type === "DAILY_NUDGE")).toBeUndefined();
    const on = buildReminderCandidates({ ...base, now: evening }, { ...DEFAULT_PREFS, dailyNudge: true });
    expect(on.find((x) => x.type === "DAILY_NUDGE")?.dedupeKey).toBe("nudge:2026-10-21");
    const saturday = new Date("2026-10-25T02:30:00Z"); // Sat 19:30 PT
    expect(buildReminderCandidates({ ...base, now: saturday }, { ...DEFAULT_PREFS, dailyNudge: true }).length).toBe(0);
    const applied = buildReminderCandidates({ ...base, now: evening, appliedToday: 2 }, { ...DEFAULT_PREFS, dailyNudge: true });
    expect(applied.length).toBe(0);
    const noFollow = buildReminderCandidates(
      { ...base, followUps: [{ applicationId: "a1", companyName: "A", positionTitle: "B", followUpAt: now }] },
      { ...DEFAULT_PREFS, followUps: false },
    );
    expect(noFollow).toHaveLength(0);
  });
});

describe("parsePrefs", () => {
  it("falls back to defaults and ignores junk", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ push: true, followUps: "yes", extra: 1 })).toEqual({ ...DEFAULT_PREFS, push: true });
  });
});
