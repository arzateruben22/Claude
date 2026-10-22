// The capacity ladder, measured: an hour-by-hour record of how full the lobby got and what it cost the machine, and
// a plain verdict on whether the cap can go up a rung. The rules are the ones in README.md ("Growing the cap").

export const RUNGS = [25, 50, 100, 200, 500];
export const nextRung = (cap) => RUNGS.find((r) => r > cap) ?? null;

// hours: rows of { hour 'YYYY-MM-DDTHH', peak, cap, queuedPeak, waited, posesIn, posesDropped, bytesOut, cpuMs, rssMb }
// newest last; looks at the last `days` days
export function verdict(hours, cap, { days = 7, now = Date.now(), memLimitMb = 300, bytesPerMonth = 1e12 } = {}) {
  const since = new Date(now - days * 86400000).toISOString().slice(0, 13);
  const rows = hours.filter((h) => h.hour >= since);
  const byDay = new Map();
  for (const h of rows) {
    const d = h.hour.slice(0, 10), o = byDay.get(d) || { day: d, peak: 0, cap: 0, waited: 0, posesIn: 0, posesDropped: 0, bytesOut: 0, cpuPct: 0, rssMb: 0 };
    o.peak = Math.max(o.peak, h.peak); o.cap = Math.max(o.cap, h.cap); o.waited += h.waited;
    o.posesIn += h.posesIn; o.posesDropped += h.posesDropped; o.bytesOut += h.bytesOut;
    o.cpuPct = Math.max(o.cpuPct, (h.cpuMs / 3600000) * 100); o.rssMb = Math.max(o.rssMb, h.rssMb);
    byDay.set(d, o);
  }
  const list = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const full = list.filter((d) => d.peak >= d.cap && d.cap > 0).length;
  const waited = list.reduce((n, d) => n + d.waited, 0);
  const posesIn = list.reduce((n, d) => n + d.posesIn, 0), dropped = list.reduce((n, d) => n + d.posesDropped, 0);
  const cpu = Math.max(0, ...list.map((d) => d.cpuPct)), mem = Math.max(0, ...list.map((d) => d.rssMb));
  const bytes = list.reduce((n, d) => n + d.bytesOut, 0), perMonth = list.length ? (bytes / list.length) * 30 : 0;
  const reasons = [];
  if (list.length < days) reasons.push(`only ${list.length} of ${days} days recorded at this cap`);
  if (full < 3) reasons.push(`the lobby was full on ${full} day${full === 1 ? '' : 's'} (want 3 or more)`);
  if (waited === 0) reasons.push('nobody has waited in line yet');
  if (cpu >= 50) reasons.push(`CPU reached ${cpu.toFixed(0)}% of a core in an hour (want under 50%)`);
  if (mem >= memLimitMb * 0.6) reasons.push(`memory reached ${mem} MB (want under ${Math.round(memLimitMb * 0.6)})`);
  if (posesIn && dropped / posesIn >= 0.01) reasons.push(`${((dropped / posesIn) * 100).toFixed(1)}% of poses dropped (want under 1%)`);
  if (perMonth >= bytesPerMonth * 0.7) reasons.push(`on pace for ${(perMonth / 1e9).toFixed(0)} GB a month (want under ${(bytesPerMonth * 0.7 / 1e9).toFixed(0)})`);
  const next = nextRung(cap);
  return {
    cap, next, ready: reasons.length === 0 && next !== null, reasons, days: list,
    summary: { fullDays: full, waited, cpuPct: Math.round(cpu * 10) / 10, rssMb: mem, dropPct: posesIn ? Math.round((dropped / posesIn) * 1000) / 10 : 0, gbPerMonth: Math.round(perMonth / 1e8) / 10 },
  };
}
