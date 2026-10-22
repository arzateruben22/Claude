import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_GENERAL_CAPS, WORK_TYPE_AREA, estimateCountableHours, parseAreaCaps } from "@/lib/academy/hours/caps";
import { cumulativeSeries, hoursByWorkType, projectCompletion, splitTotals, weeklySeries, type HourPoint } from "@/lib/academy/hours/stats";
import { csvSafe, hoursCsv } from "@/lib/academy/hours/csv";
import { workHourSchema } from "@/lib/academy/hours/validation";
import { parseClassroomTargets, splitClassroom } from "@/lib/academy/hours/classroom";
import { addUtcDays, dateFromKey, dateKey } from "@/lib/dates";

const GENERAL_NOTES = (() => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/seed/certification_requirements.json"), "utf8")) as { code: string; notes: string }[];
  return raw.find((r) => r.code === "GENERAL")!.notes;
})();

const p = (dateKey: string, hours: number, verification: HourPoint["verification"] = "EMPLOYER_VERIFIED", workType: HourPoint["workType"] = "COMMERCIAL"): HourPoint => ({
  dateKey,
  hours,
  verification,
  workType,
});

function daysBefore(todayKey: string, n: number): string {
  return dateKey(addUtcDays(dateFromKey(todayKey), -n));
}

describe("per-area caps", () => {
  it("parses every cap from the seeded General Electrician notes", () => {
    const caps = parseAreaCaps(GENERAL_NOTES);
    expect(caps.caps).toEqual({
      RESIDENTIAL: 3000,
      COMMERCIAL: 6000,
      INDUSTRIAL: 6000,
      VOICE_DATA_VIDEO: 1500,
      TROUBLESHOOTING_MAINTENANCE: 1500,
      UNDERGROUND: 750,
      FINISH_FIXTURES: 600,
      FIRE_LIFE_SAFETY: 600,
      STOCK_ROOM: 300,
    });
    expect(caps.fromSeed).toHaveLength(9);
  });

  it("takes seed values over defaults and keeps defaults for missing areas", () => {
    const caps = parseAreaCaps("residential wiring max 2,500; commercial wiring maximum 5000.");
    expect(caps.caps.RESIDENTIAL).toBe(2500);
    expect(caps.caps.COMMERCIAL).toBe(5000);
    expect(caps.caps.INDUSTRIAL).toBe(DEFAULT_GENERAL_CAPS.INDUSTRIAL);
    expect(caps.fromSeed.sort()).toEqual(["COMMERCIAL", "RESIDENTIAL"]);
    expect(parseAreaCaps(null).fromSeed).toEqual([]);
  });

  it("caps each area and sums the countable hours", () => {
    const caps = parseAreaCaps(GENERAL_NOTES);
    const est = estimateCountableHours({ RESIDENTIAL: 3500, COMMERCIAL: 2000, LIGHTING: 700, MAINTENANCE: 100 }, caps);
    const row = (a: string) => est.rows.find((r) => r.area === a)!;
    expect(row("RESIDENTIAL")).toMatchObject({ logged: 3500, countable: 3000, excess: 500 });
    expect(row("COMMERCIAL")).toMatchObject({ logged: 2000, countable: 2000, excess: 0 });
    expect(row("FINISH_FIXTURES")).toMatchObject({ logged: 700, countable: 600, excess: 100 });
    expect(row("TROUBLESHOOTING_MAINTENANCE")).toMatchObject({ logged: 100, countable: 100 });
    expect(est.countable).toBe(3000 + 2000 + 600 + 100);
    expect(est.logged).toBe(6300);
    expect(est.areasWithHours).toBe(4);
    expect(est.meetsTwoAreaRule).toBe(true);
  });

  it("excludes unmapped work types and flags the two-area rule", () => {
    const caps = parseAreaCaps(GENERAL_NOTES);
    const est = estimateCountableHours({ COMMERCIAL: 7000, SOLAR_PV: 40, CLASSROOM: 100, OTHER: 5 }, caps);
    expect(est.countable).toBe(6000);
    expect(est.logged).toBe(7145);
    expect(est.unmapped.map((u) => u.workType).sort()).toEqual(["CLASSROOM", "OTHER", "SOLAR_PV"]);
    expect(est.meetsTwoAreaRule).toBe(false);
    expect(WORK_TYPE_AREA.CLASSROOM).toBeNull();
  });

  it("never counts more than the sum of caps even with huge totals", () => {
    const caps = parseAreaCaps(GENERAL_NOTES);
    const est = estimateCountableHours({ COMMERCIAL: 1e6, RESIDENTIAL: 1e6, INDUSTRIAL: 1e6, VOICE_DATA_VIDEO: 1e6, MAINTENANCE: 1e6, LIGHTING: 1e6, FIRE_LIFE_SAFETY: 1e6 }, caps);
    expect(est.countable).toBe(3000 + 6000 + 6000 + 1500 + 1500 + 600 + 600);
  });
});

describe("totals split", () => {
  it("keeps self-reported and verified apart", () => {
    const t = splitTotals([
      p("2026-10-01", 8, "SELF_REPORTED"),
      p("2026-10-02", 7.5, "EMPLOYER_VERIFIED"),
      p("2026-10-03", 4.25, "OFFICIAL_RECORD"),
      p("2026-10-04", 2, "SELF_REPORTED"),
    ]);
    expect(t).toMatchObject({ selfReported: 10, verified: 11.75, employerVerified: 7.5, officialRecord: 4.25, logged: 21.75, entries: 4, verifiedEntries: 2 });
  });

  it("splits hours by work type for verified only or for all", () => {
    const pts = [p("2026-10-01", 8, "SELF_REPORTED", "RESIDENTIAL"), p("2026-10-02", 6, "EMPLOYER_VERIFIED", "RESIDENTIAL"), p("2026-10-02", 2, "OFFICIAL_RECORD", "INDUSTRIAL")];
    expect(hoursByWorkType(pts, "verified")).toEqual({ RESIDENTIAL: 6, INDUSTRIAL: 2 });
    expect(hoursByWorkType(pts, "all")).toEqual({ RESIDENTIAL: 14, INDUSTRIAL: 2 });
  });
});

describe("chart series", () => {
  const today = "2026-10-22"; // Thursday
  it("buckets the last 12 Monday-based weeks", () => {
    const w = weeklySeries([p("2026-10-20", 8), p("2026-10-21", 8, "SELF_REPORTED"), p("2026-10-12", 4), p("2025-01-01", 99)], today);
    expect(w).toHaveLength(12);
    expect(w[11]!.key).toBe("2026-10-19");
    expect(w[11]).toMatchObject({ verified: 8, selfReported: 8 });
    expect(w[10]).toMatchObject({ key: "2026-10-12", verified: 4 });
    expect(w.reduce((a, x) => a + x.verified + x.selfReported, 0)).toBe(20);
  });

  it("builds running totals per week from the first entry", () => {
    const c = cumulativeSeries([p("2026-10-06", 8), p("2026-10-14", 8, "SELF_REPORTED"), p("2026-10-21", 8)], today);
    expect(c.map((x) => x.key)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(c.map((x) => [x.verified, x.selfReported])).toEqual([
      [8, 0],
      [8, 8],
      [16, 8],
    ]);
    expect(cumulativeSeries([], today)).toEqual([]);
  });

  it("thins long histories but keeps the latest week", () => {
    const pts = Array.from({ length: 300 }, (_, i) => p(daysBefore(today, i * 7), 8));
    const c = cumulativeSeries(pts, today, 104);
    expect(c.length).toBeLessThanOrEqual(104);
    expect(c[c.length - 1]!.verified).toBe(2400);
  });
});

describe("projection", () => {
  const today = "2026-10-22";

  it("needs verified hours", () => {
    expect(projectCompletion([p(daysBefore(today, 40), 8, "SELF_REPORTED")], today, 8000)).toMatchObject({ status: "insufficient", reason: "no-verified" });
  });

  it("reports not enough data under 4 weeks of verified history", () => {
    const pts = Array.from({ length: 20 }, (_, i) => p(daysBefore(today, i), 8));
    expect(projectCompletion(pts, today, 8000)).toMatchObject({ status: "insufficient", reason: "short-history", weeksOfData: 2 });
  });

  it("uses the trailing 8-week verified average", () => {
    // 40 verified h every week for 20 weeks; older weeks at a different rate must not matter.
    const pts: HourPoint[] = [];
    for (let i = 0; i < 140; i++) {
      const key = daysBefore(today, i);
      const dow = dateFromKey(key).getUTCDay();
      if (dow >= 1 && dow <= 5) pts.push(p(key, i < 56 ? 8 : 2));
    }
    pts.push(p(daysBefore(today, 3), 10, "SELF_REPORTED")); // ignored
    const verified = pts.filter((x) => x.verification !== "SELF_REPORTED").reduce((a, x) => a + x.hours, 0);
    const r = projectCompletion(pts, today, 8000);
    expect(r.status).toBe("projected");
    if (r.status !== "projected") return;
    const inWindow = pts.filter((x) => x.verification !== "SELF_REPORTED" && x.dateKey >= daysBefore(today, 55)).reduce((a, x) => a + x.hours, 0);
    expect(r.windowWeeks).toBe(8);
    expect(r.averagePerWeek).toBeCloseTo(inWindow / 8, 2);
    expect(r.remaining).toBeCloseTo(8000 - verified, 2);
    const expectedDays = Math.ceil(((8000 - verified) / (inWindow / 8)) * 7);
    expect(r.dateKey).toBe(dateKey(addUtcDays(dateFromKey(today), expectedDays)));
  });

  it("uses the available history between 4 and 8 weeks", () => {
    const pts = [p(daysBefore(today, 34), 70), p(daysBefore(today, 1), 0.25)];
    const r = projectCompletion(pts, today, 8000);
    expect(r.status).toBe("projected");
    if (r.status === "projected") {
      expect(r.windowWeeks).toBe(5);
      expect(r.averagePerWeek).toBeCloseTo(70.25 / 5, 2);
    }
  });

  it("is stalled when nothing verified was logged in the window", () => {
    expect(projectCompletion([p(daysBefore(today, 120), 100)], today, 8000)).toMatchObject({ status: "stalled" });
  });

  it("is complete once verified hours reach the requirement", () => {
    expect(projectCompletion([p(daysBefore(today, 1), 24)], today, 20)).toMatchObject({ status: "complete", verified: 24 });
  });
});

describe("entry validation", () => {
  const base = { employer: "Acme Electric", dateWorked: "2026-10-20", hours: "8", workType: "COMMERCIAL", verification: "SELF_REPORTED" };
  it("accepts quarter hours within 0.25–24", () => {
    expect(workHourSchema.safeParse({ ...base, hours: "0.25" }).success).toBe(true);
    expect(workHourSchema.safeParse({ ...base, hours: "24" }).success).toBe(true);
    expect(workHourSchema.parse({ ...base, hours: "7.75" }).hours).toBe(7.75);
  });
  it("rejects out-of-range or non-quarter hours", () => {
    expect(workHourSchema.safeParse({ ...base, hours: "0" }).success).toBe(false);
    expect(workHourSchema.safeParse({ ...base, hours: "24.25" }).success).toBe(false);
    expect(workHourSchema.safeParse({ ...base, hours: "7.3" }).success).toBe(false);
    expect(workHourSchema.safeParse({ ...base, hours: "abc" }).success).toBe(false);
  });
  it("rejects bad dates and unknown enums; empty optionals become null", () => {
    expect(workHourSchema.safeParse({ ...base, dateWorked: "2026-02-30" }).success).toBe(false);
    expect(workHourSchema.safeParse({ ...base, workType: "PLUMBING" }).success).toBe(false);
    const ok = workHourSchema.parse({ ...base, supervisor: "", programId: "", documentId: "", description: "  " });
    expect(ok).toMatchObject({ supervisor: null, programId: null, documentId: null, description: null });
  });
});

describe("CSV", () => {
  it("labels verification and neutralizes formula cells", () => {
    const csv = hoursCsv([
      {
        dateKey: "2026-10-20",
        hours: 8,
        employer: "=HYPERLINK(\"x\")",
        supervisor: null,
        workType: "COMMERCIAL",
        verification: "EMPLOYER_VERIFIED",
        documentName: "stub.pdf",
        programName: null,
        description: "Pulled wire, conduit",
        createdAt: new Date("2026-10-20T20:00:00Z"),
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("date,hours,employer,supervisor,work_type,verification,counts_as_verified,document,program,description,logged_at");
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain("Employer-verified,yes,stub.pdf");
    expect(row).toContain('"Pulled wire, conduit"');
    expect(csvSafe("+1")).toBe("'+1");
    expect(csvSafe("plain")).toBe("plain");
  });
});

describe("classroom milestones", () => {
  it("parses the trainee-route targets from the seed text and never invents them", () => {
    const facts = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/seed/certification_facts.json"), "utf8")) as {
      trainee: { classroomHoursPerYear: string; pathToCertification: string };
    };
    expect(parseClassroomTargets({ traineeClassroom: facts.trainee.classroomHoursPerYear, traineePath: facts.trainee.pathToCertification })).toEqual({
      annualMinimum: 150,
      routeTotal: 720,
    });
    expect(parseClassroomTargets({ generalNotes: GENERAL_NOTES })).toEqual({ annualMinimum: null, routeTotal: 720 });
    expect(parseClassroomTargets({})).toEqual({ annualMinimum: null, routeTotal: null });
  });

  it("keeps classroom hours out of on-the-job totals", () => {
    const { ojt, classroom } = splitClassroom([p("2026-10-01", 8, "OFFICIAL_RECORD", "CLASSROOM"), p("2026-10-02", 8)]);
    expect(splitTotals(ojt).verified).toBe(8);
    expect(splitTotals(classroom).verified).toBe(8);
  });
});
