/**
 * Pure import logic: delimited parsing (BOM, quoted commas, CRLF, blank rows), header detection,
 * dates, column mapping, status/source vocabularies, row validation, presets (personal-data columns
 * dropped), URL lists, and .xlsx reading with a workbook generated in the test.
 */
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseDelimited, stripBom } from "@/lib/imports/csv";
import { excelSerialToDayKey, parseImportDate } from "@/lib/imports/dates";
import {
  mapSource,
  mapStatus,
  mappingProblems,
  normalizeHeader,
  suggestMapping,
  validateRow,
  type ColumnMapping,
} from "@/lib/imports/mapping";
import { importReason, bucketForEmail, bucketForIngest, describeTotals, emptyTotals, totalsFromJson } from "@/lib/imports/outcome";
import { LINKEDIN_EXPORT_HEADERS, PRESETS, getPreset, isSensitiveHeader, keptColumns } from "@/lib/imports/presets";
import { readSpreadsheet, rowObservation, rowSourceRef, spreadsheetFormat } from "@/lib/imports/spreadsheet";
import { MAX_DATA_ROWS, buildTable, detectHeaderRow } from "@/lib/imports/table";
import { MAX_URL_LINES, hintsFromUrl, parseUrlLines } from "@/lib/imports/urls";
import { urlObservation } from "@/lib/imports/url-import";
import { emailFileKind, looksLikeEmail, prepareEmailInputs } from "@/lib/imports/email-files";
import { xlsxCellToString } from "@/lib/imports/xlsx";

const TODAY = "2026-10-22";

// ---------------------------------------------------------------------------
// Minimal .xlsx writer (stored ZIP entries) so the test owns its fixture.
// ---------------------------------------------------------------------------

function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
}

type XCell = string | number | { date: string };

function colName(i: number): string {
  return String.fromCharCode(65 + i);
}

function makeXlsx(rows: XCell[][]): Buffer {
  const strings: string[] = [];
  const sIndex = (s: string) => {
    const i = strings.indexOf(s);
    if (i >= 0) return i;
    strings.push(s);
    return strings.length - 1;
  };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === "string") return `<c r="${ref}" t="s"><v>${sIndex(v)}</v></c>`;
          if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
          const serial = Date.parse(`${v.date}T00:00:00Z`) / 86_400_000 + 25569;
          return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  return zip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Applications" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${ns}><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${ns} count="${strings.length}" uniqueCount="${strings.length}">${strings
      .map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`)
      .join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${ns}><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

// ---------------------------------------------------------------------------

describe("delimited parsing", () => {
  it("strips a UTF-8 BOM so the first header is clean", () => {
    expect(stripBom("﻿Company")).toBe("Company");
    const { rows } = parseDelimited("﻿Company,Job Title\r\nAcme,Electrician\r\n");
    expect(rows[0]).toEqual(["Company", "Job Title"]);
    expect(rows[1]).toEqual(["Acme", "Electrician"]);
  });

  it("keeps quoted commas, escaped quotes and line breaks inside one cell", () => {
    const text = 'Company,Job Title,Notes\r\n"Acme Electric, Inc.","Apprentice, Inside Wireman","He said ""call back""\r\nnext week"\r\n';
    const { rows } = parseDelimited(text);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["Acme Electric, Inc.", "Apprentice, Inside Wireman", 'He said "call back"\r\nnext week']);
  });

  it("handles CRLF, LF and CR line endings the same way", () => {
    for (const nl of ["\r\n", "\n", "\r"]) {
      const { rows } = parseDelimited(["Company,Title", "A,B", "C,D"].join(nl) + nl);
      expect(rows).toEqual([
        ["Company", "Title"],
        ["A", "B"],
        ["C", "D"],
      ]);
    }
  });

  it("keeps blank rows so row numbers match the file, and the table skips them", () => {
    const { rows } = parseDelimited("Company,Job Title\n\nAcme,Electrician\n,\nBeta,Helper\n\n");
    const built = buildTable(rows, PRESETS.generic);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.table.blankRows).toBe(2);
    expect(built.table.rows.map((r) => r.rowNumber)).toEqual([3, 5]);
  });

  it("detects tab and semicolon delimiters", () => {
    expect(parseDelimited("Company\tJob Title\nAcme\tElectrician\n", { delimiter: "\t" }).rows[1]).toEqual(["Acme", "Electrician"]);
    expect(parseDelimited("Company;Job Title;Date\nAcme;Electrician;2026-01-05\n").rows[1]).toEqual(["Acme", "Electrician", "2026-01-05"]);
  });
});

describe("header detection and table building", () => {
  it("finds the header row below a title line", () => {
    const rows = [["My 2026 job search"], [""], ["Company", "Position", "Date Applied", "Status"], ["Acme", "Helper", "1/5/2026", "Applied"]];
    expect(detectHeaderRow(rows)).toBe(2);
    const built = buildTable(rows, PRESETS.generic);
    expect(built.ok && built.table.headerRowNumber).toBe(3);
    expect(built.ok && built.table.rows[0]!.rowNumber).toBe(4);
  });

  it("names empty header cells and rejects files without data", () => {
    const built = buildTable([["Company", "", "Job Title"], ["Acme", "x", "Helper"]], PRESETS.generic);
    expect(built.ok && built.table.headers).toEqual(["Company", "Column 2", "Job Title"]);
    expect(buildTable([["Company", "Job Title"]], PRESETS.generic)).toEqual({ ok: false, error: "The file has a header row but no data rows." });
    expect(buildTable([[""], [""]], PRESETS.generic).ok).toBe(false);
  });

  it(`caps imports at ${MAX_DATA_ROWS} data rows`, () => {
    const rows = [["Company", "Job Title"], ...Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => [`Co ${i}`, "Helper"])];
    const built = buildTable(rows, PRESETS.generic);
    expect(built.ok).toBe(false);
    const ok = buildTable(rows.slice(0, MAX_DATA_ROWS + 1), PRESETS.generic);
    expect(ok.ok && ok.table.rows.length).toBe(MAX_DATA_ROWS);
  });

  it("drops personal-data columns for every preset", () => {
    const rows = [["Company", "Job Title", "Recruiter Email", "Phone", "Notes"], ["Acme", "Helper", "jane@acme.com", "555-0100", "ok"]];
    const built = buildTable(rows, PRESETS.generic);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.table.headers).toEqual(["Company", "Job Title", "Notes"]);
    expect(built.table.droppedHeaders).toEqual(["Recruiter Email", "Phone"]);
    expect(JSON.stringify(built.table.rows)).not.toContain("jane@acme.com");
    expect(JSON.stringify(built.table.rows)).not.toContain("555-0100");
  });
});

describe("dates", () => {
  it.each([
    ["2026-01-05", "2026-01-05"],
    ["2026/1/5", "2026-01-05"],
    ["2026-01-05T15:30:00Z", "2026-01-05"],
    ["2026-01-05 15:30", "2026-01-05"],
    ["01/05/2026", "2026-01-05"],
    ["1/5/2026", "2026-01-05"],
    ["1/5/26", "2026-01-05"],
    ["1-5-2026", "2026-01-05"],
    ["25/01/2026", "2026-01-25"],
    ["10/14/25, 3:41 PM", "2025-10-14"],
    ["Jan 5, 2026", "2026-01-05"],
    ["Jan. 5, 2026", "2026-01-05"],
    ["January 5 2026", "2026-01-05"],
    ["Mon, Jan 5, 2026", "2026-01-05"],
    ["5 Jan 2026", "2026-01-05"],
    ["5-Jan-26", "2026-01-05"],
    ["September 30, 2025", "2025-09-30"],
    ["Sept 30 2025", "2025-09-30"],
    ["46027", "2026-01-05"],
  ])("parses %s", (input, day) => {
    expect(parseImportDate(input)).toEqual({ ok: true, day });
  });

  it.each(["", "   ", "yesterday", "02/30/2026", "13/13/2026", "2026-13-01", "Foo 5, 2026", "1/5", "12345", "1850-01-01"])("rejects %j", (input) => {
    expect(parseImportDate(input).ok).toBe(false);
  });

  it("converts Excel serial numbers", () => {
    expect(excelSerialToDayKey(46027)).toBe("2026-01-05");
    expect(excelSerialToDayKey(46027.75)).toBe("2026-01-05");
    expect(excelSerialToDayKey(100)).toBeNull();
  });
});

describe("column mapping", () => {
  it("normalizes header names", () => {
    expect(normalizeHeader("  Date_Applied (MM/DD) ")).toBe("date applied mm dd");
    expect(normalizeHeader("Req. #")).toBe("req");
  });

  it("suggests a mapping from common header names, each column used once", () => {
    const m = suggestMapping(["Company Name", "Job Title", "Date Applied", "Status", "Link", "Location", "Req ID", "Pay", "Where applied", "Comments"]);
    expect(m).toEqual({
      company: 0,
      title: 1,
      dateApplied: 2,
      status: 3,
      url: 4,
      location: 5,
      requisition: 6,
      salary: 7,
      notes: 9,
    });
  });

  it("prefers exact matches and leaves unknown columns unmapped", () => {
    const m = suggestMapping(["Job Url", "Job Title", "Company", "Contact Email", "Favorite color"]);
    expect(m.url).toBe(0);
    expect(m.title).toBe(1);
    expect(m.company).toBe(2);
    expect(Object.values(m)).not.toContain(3);
    expect(Object.values(m)).not.toContain(4);
  });

  it("uses preset header hints first (LinkedIn)", () => {
    const headers = ["Application Date", "Company Name", "Job Title", "Job Url"];
    expect(suggestMapping(headers, PRESETS.linkedin.headerHints)).toEqual({ dateApplied: 0, company: 1, title: 2, url: 3 });
  });

  it("reports missing required fields and invalid or shared columns", () => {
    expect(mappingProblems({ company: 0 }, 3)).toEqual(["Choose the column that holds “Job title”."]);
    expect(mappingProblems({ company: 0, title: 0 }, 3)[0]).toMatch(/same column/);
    expect(mappingProblems({ company: 0, title: 5 }, 3)[0]).toMatch(/does not exist/);
    expect(mappingProblems({ company: 0, title: 1 }, 3)).toEqual([]);
  });
});

describe("status and source vocabularies", () => {
  it.each([
    ["Applied", "SUBMITTED"],
    ["Application submitted", "SUBMITTED"],
    ["Saved", "JOB_SEEN"],
    ["Not applied yet", "JOB_SEEN"],
    ["To apply", "JOB_SEEN"],
    ["Phone screen", "RECRUITER_RESPONSE"],
    ["Interview scheduled", "INTERVIEW_INVITED"],
    ["Rejected after interview", "REJECTED"],
    ["Not selected", "REJECTED"],
    ["Offer", "OFFER"],
    ["Offer declined", "OFFER"],
    ["Hired", "ONBOARDING"],
    ["Aptitude test", "ASSESSMENT_INVITED"],
    ["Under review", "ACKNOWLEDGED"],
  ])("maps %s → %s", (raw, kind) => {
    expect(mapStatus(raw).kind).toBe(kind);
  });

  it("falls back to the date rule for waiting states, and explains statuses it cannot import", () => {
    expect(mapStatus("No response")).toEqual({ kind: null, warning: null });
    expect(mapStatus("Withdrawn").warning).toMatch(/Withdrawn/);
    expect(mapStatus("Position closed").warning).toMatch(/Closed/);
    expect(mapStatus("Purple").warning).toMatch(/not recognized/);
  });

  it("maps source names to platforms", () => {
    expect(mapSource("LinkedIn Easy Apply")).toBe("LINKEDIN");
    expect(mapSource("Zip Recruiter")).toBe("ZIPRECRUITER");
    expect(mapSource("Company website")).toBe("COMPANY_SITE");
    expect(mapSource("IBEW Local 11")).toBe("UNION_PORTAL");
    expect(mapSource("Referred by Sam")).toBe("REFERRAL");
    expect(mapSource("Craigslist")).toBe("OTHER");
    expect(mapSource("")).toBeNull();
  });
});

describe("row validation", () => {
  const mapping: ColumnMapping = { company: 0, title: 1, dateApplied: 2, status: 3, url: 4, notes: 5 };
  const v = (cells: string[]) => validateRow(cells, mapping, 2, { todayKey: TODAY });

  it("imports dated rows as submitted and undated rows as saved leads", () => {
    expect(v(["Acme Electric", "Apprentice", "Jan 5, 2026", "", "", ""]).value).toMatchObject({ kind: "SUBMITTED", appliedDay: "2026-01-05" });
    expect(v(["Acme Electric", "Apprentice", "", "", "", ""]).value).toMatchObject({ kind: "JOB_SEEN", appliedDay: null });
  });

  it("lets a status column override the date rule", () => {
    expect(v(["Acme", "Helper", "2026-01-05", "Interview", "", ""]).value?.kind).toBe("INTERVIEW_INVITED");
    expect(v(["Acme", "Helper", "2026-01-05", "Saved", "", ""]).value?.kind).toBe("JOB_SEEN");
    const noDate = v(["Acme", "Helper", "", "Applied", "", ""]);
    expect(noDate.value?.kind).toBe("SUBMITTED");
    expect(noDate.warnings[0]).toMatch(/import date is used/);
  });

  it("rejects rows without company or title, with unreadable dates, or dated in the future", () => {
    expect(v(["", "Helper", "", "", "", ""]).errors).toEqual(["Company is empty."]);
    expect(v(["Acme", "", "", "", "", ""]).errors).toEqual(["Job title is empty."]);
    expect(v(["Acme", "Helper", "next Tuesday", "", "", ""]).errors[0]).toMatch(/not a recognizable date/);
    expect(v(["Acme", "Helper", "2026-12-25", "", "", ""]).errors[0]).toMatch(/in the future/);
  });

  it("skips blank rows silently", () => {
    expect(v(["", "", "", "", "", ""])).toMatchObject({ blank: true, value: null, errors: [] });
  });

  it("normalizes posting URLs, warns about invalid ones, and detects the platform", () => {
    const ok = v(["Acme", "Helper", "", "", "https://www.indeed.com/viewjob?jk=ABC123&from=serp", ""]);
    expect(ok.value).toMatchObject({ normalizedUrl: "https://indeed.com/viewjob?jk=abc123", platform: "INDEED" });
    const www = v(["Acme", "Helper", "", "", "www.acme.com/careers/42", ""]);
    expect(www.value?.postingUrl).toBe("https://www.acme.com/careers/42");
    const bad = v(["Acme", "Helper", "", "", "javascript:alert(1)", ""]);
    expect(bad.value?.postingUrl).toBeNull();
    expect(bad.warnings[0]).toMatch(/not a valid web address/);
  });

  it("caps notes at 300 characters", () => {
    const r = v(["Acme", "Helper", "", "", "", "x".repeat(400)]);
    expect(r.value?.notes).toHaveLength(300);
    expect(r.warnings[0]).toMatch(/shortened/);
  });

  it("uses a preset's default platform when nothing else identifies one", () => {
    const r = validateRow(["Acme", "Helper"], { company: 0, title: 1 }, 2, { todayKey: TODAY, defaultPlatform: "LINKEDIN" });
    expect(r.value?.platform).toBe("LINKEDIN");
  });
});

describe("row fingerprint and observation", () => {
  const base = validateRow(["Acme Electric, Inc.", "Apprentice Electrician", "1/5/2026", "Applied", "https://www.linkedin.com/jobs/view/123456/?trk=x"], { company: 0, title: 1, dateApplied: 2, status: 3, url: 4 }, 2, { todayKey: TODAY }).value!;

  it("is stable across cosmetic differences and changes when the application changes", () => {
    const cosmetic = validateRow(["acme electric", "Apprentice  Electrician", "2026-01-05", "submitted", "https://linkedin.com/jobs/view/123456"], { company: 0, title: 1, dateApplied: 2, status: 3, url: 4 }, 9, { todayKey: TODAY }).value!;
    expect(rowSourceRef(cosmetic)).toBe(rowSourceRef(base));
    const later = { ...base, kind: "INTERVIEW_INVITED" as const };
    expect(rowSourceRef(later)).not.toBe(rowSourceRef(base));
    expect(rowSourceRef(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds a self-reported CSV observation dated at noon of the applied day in the user's timezone", () => {
    const obs = rowObservation(base, { timezone: "America/Los_Angeles", now: new Date("2026-10-22T12:00:00Z"), fileName: "tracker.csv", rowNumber: 2, presetId: "generic" });
    expect(obs).toMatchObject({ kind: "SUBMITTED", source: "IMPORT", origin: "CSV_IMPORT", verified: false, company: "Acme Electric, Inc.", platform: "LINKEDIN" });
    expect(obs.observedAt.toISOString()).toBe("2026-01-05T20:00:00.000Z");
    expect(obs.evidence).toMatchObject({ kind: "CSV_ROW", sourceRef: rowSourceRef(base) });
  });
});

describe("presets", () => {
  it("keeps only date, company, title and URL from LinkedIn's export", () => {
    const keep = keptColumns(LINKEDIN_EXPORT_HEADERS, PRESETS.linkedin);
    expect(keep.map((i) => LINKEDIN_EXPORT_HEADERS[i])).toEqual(["Application Date", "Company Name", "Job Title", "Job Url"]);
    expect(PRESETS.linkedin.allowedFields).toEqual(["company", "title", "dateApplied", "url"]);
  });

  it("flags personal-data headers and falls back to the generic preset", () => {
    expect(isSensitiveHeader("Contact Phone Number")).toBe(true);
    expect(isSensitiveHeader("Question And Answers")).toBe(true);
    expect(isSensitiveHeader("E-mail")).toBe(true);
    expect(isSensitiveHeader("Company Name")).toBe(false);
    expect(getPreset("nope").id).toBe("generic");
    expect(getPreset("__proto__").id).toBe("generic");
  });
});

describe("spreadsheet files", () => {
  it("recognizes formats by extension", () => {
    expect(spreadsheetFormat("Job Applications.csv")).toBe("csv");
    expect(spreadsheetFormat("x.TSV")).toBe("tsv");
    expect(spreadsheetFormat("x.xlsx")).toBe("xlsx");
    expect(spreadsheetFormat("x.xls")).toBeNull();
  });

  it("reads a generated .xlsx workbook, including date and number cells", async () => {
    const buf = makeXlsx([
      ["Company", "Job Title", "Date Applied", "Req ID", "Status"],
      ["Acme Electric", "Apprentice Electrician", { date: "2026-01-05" }, 12345, "Applied"],
      ["Beta Builders", "Helper", "Jan 7, 2026", "", ""],
    ]);
    const read = await readSpreadsheet("tracker.xlsx", buf, "generic");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.format).toBe("xlsx");
    expect(read.table.headers).toEqual(["Company", "Job Title", "Date Applied", "Req ID", "Status"]);
    expect(read.table.rows[0]!.cells).toEqual(["Acme Electric", "Apprentice Electrician", "2026-01-05", "12345", "Applied"]);
    const mapping = suggestMapping(read.table.headers);
    const row = validateRow(read.table.rows[0]!.cells, mapping, 2, { todayKey: TODAY });
    expect(row.value).toMatchObject({ appliedDay: "2026-01-05", requisitionId: "12345", kind: "SUBMITTED" });
    expect(validateRow(read.table.rows[1]!.cells, mapping, 3, { todayKey: TODAY }).value?.appliedDay).toBe("2026-01-07");
  });

  it("checks content against the extension", async () => {
    const csvAsXlsx = await readSpreadsheet("t.xlsx", Buffer.from("Company,Title\nA,B\n"), "generic");
    expect(csvAsXlsx).toEqual({ ok: false, error: expect.stringMatching(/not an \.xlsx workbook/) });
    const xlsxAsCsv = await readSpreadsheet("t.csv", makeXlsx([["Company"], ["A"]]), "generic");
    expect(xlsxAsCsv).toEqual({ ok: false, error: expect.stringMatching(/\.xlsx workbook saved with a \.csv name/) });
    const binary = await readSpreadsheet("t.csv", Buffer.from([0x43, 0x00, 0x01, 0x02]), "generic");
    expect(binary.ok).toBe(false);
    expect((await readSpreadsheet("t.csv", Buffer.alloc(0), "generic")).ok).toBe(false);
    expect((await readSpreadsheet("t.pdf", Buffer.from("x"), "generic")).ok).toBe(false);
  });

  it("reads Windows-1252 CSV files with a warning", async () => {
    const bytes = Buffer.from([...Buffer.from("Company,Job Title\nCaf"), 0xe9, ...Buffer.from(" Electric,Helper\n")]);
    const read = await readSpreadsheet("t.csv", bytes, "generic");
    expect(read.ok && read.table.rows[0]!.cells[0]).toBe("Café Electric");
    expect(read.ok && read.warnings[0]).toMatch(/Windows-1252/);
  });

  it("converts xlsx cell values to strings", () => {
    expect(xlsxCellToString(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
    expect(xlsxCellToString(new Date(Date.UTC(2026, 0, 5, 15, 30)))).toBe("2026-01-05T15:30");
    expect(xlsxCellToString(true)).toBe("TRUE");
    expect(xlsxCellToString(null)).toBe("");
    expect(xlsxCellToString(85000)).toBe("85000");
  });
});

describe("job URL lists", () => {
  it("parses links, optional company/title, duplicates and invalid lines", () => {
    const { lines, tooMany } = parseUrlLines(
      [
        "# my links",
        "https://www.indeed.com/viewjob?jk=abc123&from=serp",
        "",
        "https://boards.greenhouse.io/acmeelectric/jobs/4567 | Acme Electric | Apprentice Electrician",
        "https://indeed.com/viewjob?jk=ABC123",
        "not a url",
        "ftp://example.com/job",
        "www.example.com/careers/7",
      ].join("\r\n"),
    );
    expect(tooMany).toBe(false);
    expect(lines.map((l) => l.line)).toEqual([2, 4, 5, 6, 7, 8]);
    expect(lines[0]).toMatchObject({ normalizedUrl: "https://indeed.com/viewjob?jk=abc123", platform: "INDEED", detailsFrom: "none", error: null });
    expect(lines[1]).toMatchObject({ company: "Acme Electric", title: "Apprentice Electrician", detailsFrom: "user", platform: "GREENHOUSE" });
    expect(lines[2]!.error).toMatch(/Same posting as line 2/);
    expect(lines[3]!.error).toMatch(/Not a web address/);
    expect(lines[4]!.error).toMatch(/Not a web address/);
    expect(lines[5]).toMatchObject({ url: "https://www.example.com/careers/7", platform: "COMPANY_SITE", error: null });
  });

  it(`stops after ${MAX_URL_LINES} links`, () => {
    const text = Array.from({ length: MAX_URL_LINES + 5 }, (_, i) => `https://example.com/jobs/${i}`).join("\n");
    const { lines, tooMany } = parseUrlLines(text);
    expect(lines).toHaveLength(MAX_URL_LINES);
    expect(tooMany).toBe(true);
  });

  it("reads company and title only from URL paths that contain them", () => {
    expect(hintsFromUrl("https://www.linkedin.com/jobs/view/apprentice-electrician-at-acme-electric-3812345678/")).toEqual({
      title: "Apprentice Electrician",
      company: "Acme Electric",
    });
    expect(hintsFromUrl("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Anaheim-CA/Electrician-Helper_R-1234")).toEqual({
      company: "Acme",
      title: "Electrician Helper",
    });
    expect(hintsFromUrl("https://jobs.smartrecruiters.com/AcmeElectric/743999-journeyman-electrician")).toEqual({
      company: "AcmeElectric",
      title: "Journeyman Electrician",
    });
    expect(hintsFromUrl("https://careers-acme.icims.com/jobs/1234/maintenance-technician/job")).toEqual({ company: "Acme", title: "Maintenance Technician" });
    expect(hintsFromUrl("https://www.ziprecruiter.com/c/Acme-Electric/Job/Electrician-Apprentice/-in-Anaheim,CA?jid=abc")).toEqual({
      company: "Acme Electric",
      title: "Electrician Apprentice",
    });
    expect(hintsFromUrl("https://boards.greenhouse.io/acmeelectric/jobs/4567")).toEqual({ company: "Acmeelectric", title: null });
    expect(hintsFromUrl("https://www.indeed.com/viewjob?jk=abc")).toEqual({ company: null, title: null });
  });

  it("builds JOB_SEEN observations with confidence by detail source", () => {
    const { lines } = parseUrlLines(
      "https://boards.greenhouse.io/acme/jobs/1 | Acme | Helper\nhttps://www.linkedin.com/jobs/view/helper-at-acme-3812345678\nhttps://www.indeed.com/viewjob?jk=zz",
    );
    const now = new Date("2026-10-22T12:00:00Z");
    const [user, url, none] = lines.map((l) => urlObservation(l, now));
    expect(user).toMatchObject({ kind: "JOB_SEEN", origin: "URL_IMPORT", source: "IMPORT", confidence: 0.9, verified: false });
    expect(user!.evidence).toMatchObject({ kind: "URL", sourceRef: "https://boards.greenhouse.io/acme/jobs/1" });
    expect(url!.confidence).toBe(0.8);
    expect(none!.confidence).toBe(0.5);
  });
});

describe("email files", () => {
  it("recognizes extensions and RFC 5322 headers", () => {
    expect(emailFileKind("a.EML")).toBe("eml");
    expect(emailFileKind("Inbox.mbox")).toBe("mbox");
    expect(emailFileKind("a.msg")).toBeNull();
    expect(looksLikeEmail("From: a@b.com\r\nSubject: Hi\r\n\r\nbody")).toBe(true);
    expect(looksLikeEmail("From: a@b.com\nX-Long: one\n two\nDate: Mon, 1 Jan 2026 10:00:00 +0000\n\nbody")).toBe(true);
    expect(looksLikeEmail("Hello there,\nthis is not an email")).toBe(false);
    expect(looksLikeEmail("Subject: only one\n\nbody")).toBe(false);
    expect(looksLikeEmail("X-Foo: 1\nX-Bar: 2\n\nbody")).toBe(false);
  });

  it("validates uploads by extension and content, and splits mbox archives", () => {
    const eml = Buffer.from("From: a@b.com\r\nSubject: Application received\r\n\r\nThanks");
    const mbox = Buffer.from(
      "From a@b.com Mon Jan  5 10:00:00 2026\nFrom: a@b.com\nSubject: One\n\nbody 1\n\nFrom c@d.com Tue Jan  6 10:00:00 2026\nFrom: c@d.com\nSubject: Two\n\nbody 2\n",
    );
    const res = prepareEmailInputs(
      [
        { name: "ok.eml", bytes: eml },
        { name: "notes.txt", bytes: Buffer.from("x") },
        { name: "bad.eml", bytes: Buffer.from("just some text") },
        { name: "bin.eml", bytes: Buffer.from([1, 0, 2]) },
        { name: "box.mbox", bytes: mbox },
      ],
      "Not an email at all",
    );
    expect(res.messages.map((m) => [m.label, m.provider])).toEqual([
      ["ok.eml", "EML"],
      ["box.mbox, message 1", "MBOX"],
      ["box.mbox, message 2", "MBOX"],
    ]);
    expect(res.hasMbox).toBe(true);
    expect(res.fileErrors).toHaveLength(4);
    expect(res.fileErrors.join("\n")).toMatch(/notes\.txt: only \.eml and \.mbox/);
    expect(res.fileErrors.join("\n")).toMatch(/bad\.eml: this does not look like an email/);
    expect(res.fileErrors.join("\n")).toMatch(/bin\.eml: this is a binary file/);
    expect(res.fileErrors.join("\n")).toMatch(/Pasted text/);
  });
});

describe("outcome helpers", () => {
  it("buckets engine and pipeline outcomes", () => {
    expect(bucketForIngest({ action: "created" })).toBe("created");
    expect(bucketForIngest({ action: "ignored" })).toBe("ignored");
    expect(bucketForEmail("ingested", { action: "created" })).toBe("created");
    expect(bucketForEmail("ingested", { action: "updated" })).toBe("updated");
    expect(bucketForEmail("user_reviewed", null)).toBe("duplicate");
    expect(bucketForEmail("ingest_failed", null)).toBe("needs_review");
    expect(bucketForEmail("stored", null)).toBe("ignored");
  });

  it("strips review-queue advice from engine reasons for file imports", () => {
    expect(importReason("Possibly the same job as 2 tracked applications (best match 0.72); confirm in the review queue.")).toBe(
      "Possibly the same job as 2 tracked applications (best match 0.72).",
    );
    expect(importReason("Company or job title is missing; add them in the review queue.")).toBe("Company or job title is missing.");
    expect(importReason("Confidence 0.50 is below 0.80; confirm in the review queue before a record is created.")).toBe("Confidence 0.50 is below 0.80.");
    expect(importReason("Confidence 0.30 is below the review floor (0.45).")).toBe("Confidence 0.30 is below the review floor (0.45).");
  });

  it("reads and describes totals", () => {
    const t = { ...emptyTotals(), total: 4, created: 2, duplicate: 1, errors: 1 };
    expect(describeTotals(t)).toBe("2 new, 1 already tracked, 1 error");
    expect(describeTotals(emptyTotals())).toBe("nothing new");
    expect(totalsFromJson({ created: 3, bogus: 1, updated: "x" })).toEqual({ ...emptyTotals(), created: 3 });
    expect(totalsFromJson(null)).toEqual(emptyTotals());
  });
});
