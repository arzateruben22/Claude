/** Display helpers for the Academy records pages. Pure; calendar keys are formatted in UTC so they never shift. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Oct 21, 2026" for "2026-10-21"; "—" for null/invalid. */
export function formatDayKey(key: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!key) return "—";
  const m = KEY.exec(key);
  if (!m) return "—";
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return "—";
  const base = `${month} ${Number(m[3])}`;
  return opts.year === false ? base : `${base}, ${m[1]}`;
}

const hoursFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "1,234.5" (no unit). */
export function formatHoursNumber(n: number): string {
  return Number.isFinite(n) ? hoursFmt.format(n) : "—";
}

/** "1,234.5 h". */
export function formatHours(n: number): string {
  return `${formatHoursNumber(n)} h`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
