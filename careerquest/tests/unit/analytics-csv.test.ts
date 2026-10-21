import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, csvChunk, csvDocument, csvHeader, exportFileName, sanitizeCsvCell, toExportRow, type ExportApplication } from "@/lib/analytics/csv";

function application(overrides: Partial<ExportApplication> = {}): ExportApplication {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyName: "Acme Electric",
    positionTitle: "Apprentice Electrician",
    status: "SUBMITTED",
    source: "INDEED",
    location: "Irvine, CA",
    appliedAt: new Date("2026-10-01T15:00:00.000Z"),
    statusUpdatedAt: new Date("2026-10-02T15:00:00.000Z"),
    salaryMin: { toString: () => "28.50" },
    salaryMax: 35,
    salaryPeriod: "HOURLY",
    employmentType: "FULL_TIME",
    jobCategory: "Electrician",
    postingUrl: "https://example.com/jobs/1",
    requisitionNumber: "REQ-1",
    followUpAt: null,
    recruiterContact: { name: "Pat Recruiter" },
    createdVia: "MANUAL",
    createdAt: new Date("2026-09-30T10:00:00.000Z"),
    ...overrides,
  };
}

describe("sanitizeCsvCell", () => {
  it("neutralises formula triggers with a leading apostrophe", () => {
    expect(sanitizeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvCell("+1234")).toBe("'+1234");
    expect(sanitizeCsvCell("-cmd")).toBe("'-cmd");
    expect(sanitizeCsvCell("@import")).toBe("'@import");
    expect(sanitizeCsvCell("\tx")).toBe("'\tx");
    expect(sanitizeCsvCell("\rx")).toBe("'\rx");
  });

  it("leaves ordinary values alone and stringifies dates/numbers/decimals", () => {
    expect(sanitizeCsvCell("Acme, Inc.")).toBe("Acme, Inc.");
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(Number.NaN)).toBe("");
    expect(sanitizeCsvCell(new Date("2026-10-01T15:00:00.000Z"))).toBe("2026-10-01T15:00:00.000Z");
    expect(sanitizeCsvCell(new Date("invalid"))).toBe("");
    expect(sanitizeCsvCell({ toString: () => "28.50" })).toBe("28.50");
  });
});

describe("toExportRow", () => {
  it("maps every column in order", () => {
    const row = toExportRow(application());
    expect(Object.keys(row)).toEqual([...EXPORT_COLUMNS]);
    expect(row).toMatchObject({
      company: "Acme Electric",
      title: "Apprentice Electrician",
      status: "SUBMITTED",
      source: "INDEED",
      appliedAt: "2026-10-01T15:00:00.000Z",
      salaryMin: "28.50",
      salaryMax: "35",
      salaryPeriod: "HOURLY",
      recruiterName: "Pat Recruiter",
      followUpAt: "",
      createdVia: "MANUAL",
    });
  });

  it("handles missing optional relations", () => {
    expect(toExportRow(application({ recruiterContact: null, salaryMin: null, salaryPeriod: null })).recruiterName).toBe("");
  });
});

describe("csv output", () => {
  it("writes a header line and quoted rows that parse back losslessly", () => {
    const rows = [
      toExportRow(application({ companyName: 'Quotes "R" Us, LLC', positionTitle: "Line1\nLine2", jobCategory: "=HYPERLINK(\"x\")" })),
      toExportRow(application({ id: "22222222-2222-4222-8222-222222222222", companyName: "Plain Co" })),
    ];
    const doc = csvDocument(rows);
    expect(doc.startsWith("id,company,title,status,")).toBe(true);
    expect(csvHeader()).toBe(doc.slice(0, csvHeader().length));
    expect(csvChunk([])).toBe("");

    const parsed = Papa.parse<Record<string, string>>(doc, { header: true, skipEmptyLines: true });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]!.company).toBe('Quotes "R" Us, LLC');
    expect(parsed.data[0]!.title).toBe("Line1\nLine2");
    expect(parsed.data[0]!.jobCategory).toBe("'=HYPERLINK(\"x\")");
    expect(parsed.data[1]!.company).toBe("Plain Co");
    expect(Object.keys(parsed.data[0]!)).toEqual([...EXPORT_COLUMNS]);
  });

  it("names the file by day", () => {
    expect(exportFileName("2026-10-21")).toBe("careerquest-applications-2026-10-21.csv");
  });
});
