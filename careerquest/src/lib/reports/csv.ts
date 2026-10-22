/**
 * CSV rendering of a weekly report. Pure. Quoting is left to papaparse; every cell goes through
 * the analytics formula-injection guard so text such as a recommendation can never execute.
 */
import Papa from "papaparse";
import { sanitizeCsvCell } from "@/lib/analytics/csv";
import { SECTION_LABELS, type WeeklyReportData } from "./types";

export const REPORT_CSV_COLUMNS = ["section", "key", "metric", "this_week", "prior_week", "change", "basis", "unit", "note"] as const;

function rateCell(v: number | null): string {
  return v === null ? "" : (Math.round(v * 1000) / 1000).toString();
}

export function weeklyReportCsv(data: WeeklyReportData): string {
  const rows: string[][] = [];
  for (const r of data.rows) {
    rows.push([SECTION_LABELS[r.section], r.key, r.label, String(r.thisWeek), String(r.priorWeek), String(r.delta), r.basis, r.unit, r.note ?? ""]);
  }
  const c = data.cumulative;
  const cum: Array<[string, string, number | null, number | null]> = [
    ["cumulative.applied", `Applications submitted, total as of ${c.thisWeek.asOf}`, c.thisWeek.applied, c.priorWeek.applied],
    ["cumulative.response_rate", "Response rate, cumulative (0–1)", c.thisWeek.responseRate.value, c.priorWeek.responseRate.value],
    ["cumulative.interview_rate", "Interview rate, cumulative (0–1)", c.thisWeek.interviewRate.value, c.priorWeek.interviewRate.value],
  ];
  for (const [key, label, a, b] of cum) {
    const isRate = key.endsWith("_rate");
    const delta = a !== null && b !== null ? a - b : null;
    rows.push([
      "Cumulative funnel",
      key,
      label,
      isRate ? rateCell(a) : String(a ?? ""),
      isRate ? rateCell(b) : String(b ?? ""),
      delta === null ? "" : isRate ? rateCell(delta) : String(delta),
      "observed",
      isRate ? "rate" : "count",
      isRate ? `n = ${key === "cumulative.response_rate" ? c.thisWeek.responseRate.n : c.thisWeek.interviewRate.n}` : "",
    ]);
  }
  data.recommendations.forEach((rec, i) => {
    rows.push([
      "Top recommendations",
      `recommendation.${i + 1}`,
      rec.title,
      "",
      "",
      "",
      "rules",
      "",
      `${rec.body.replace(/\s?\[[a-z0-9_.-]+\]/g, "")} (cites: ${rec.citations.map((m) => `${m.label} = ${m.display}`).join("; ")})`,
    ]);
  });
  const sanitized = rows.map((r) => r.map((cell) => sanitizeCsvCell(cell)));
  return Papa.unparse({ fields: [...REPORT_CSV_COLUMNS], data: sanitized }, { newline: "\r\n" }) + "\r\n";
}

export function reportFileName(weekStart: string, format: "csv" | "json"): string {
  return `careerquest-weekly-report-${weekStart}.${format}`;
}
