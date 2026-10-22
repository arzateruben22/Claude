/* Lumevina Skin Intelligence — progress report content (shared)
 *
 * Builds exactly what a client will see in a progress report, from what the
 * practitioner chose and confirmed. Frozen into progress_reports.content at
 * approval. Never includes private notes, review notes, needle depths or
 * unconfirmed changes; every line of free text goes through the wording guard.
 */

import { MEASUREMENTS, displayable, formatValue } from "./measurements.js";
import { regionLabel } from "./regions.js";
import { changeMessage } from "./change.js";
import { checkWording, SCOPE_NOTE } from "./wording.js";
import { treatmentForClient } from "./access.js";

export const REPORT_VERSION = "report-1";

/**
 * @param {object} p
 *   profile        { name }
 *   period         { from, to }
 *   visits         [{ id, date, label }]
 *   images         [{ capture_id, region, date, label }]  (chosen; the client sees them through signed links)
 *   measurements   [verified measurement rows]
 *   changes        [{ name, region, verdict, reasons, delta, threshold, shared_with_client, review_status }]
 *   treatments     [treatment rows]  (signed ones; reduced to the client view)
 *   summary        the practitioner's paragraph
 *   routine        [{ slot, product_name, how }]
 * @returns {{ ok: boolean, content?: object, problems?: Array }}
 */
export function buildReport(p) {
  const problems = [];
  const summary = String(p.summary ?? "").trim().slice(0, 2000);
  for (const w of checkWording(summary)) problems.push({ field: "summary", ...w });
  const rows = [];
  for (const m of p.measurements ?? []) {
    if (m.review_status !== "verified") continue;
    const d = displayable(m);
    rows.push({ name: m.name, label: MEASUREMENTS[m.name]?.label ?? m.name, region: m.region, regionLabel: regionLabel(m.region),
      capture_id: m.capture_id, value: d.ok ? Number(m.value) : null, display: d.ok ? formatValue(m) : d.why,
      unit: m.unit ?? null, experimental: m.experimental !== false, uncertainty: m.uncertainty ?? null, date: m.date ?? null });
  }
  const changes = (p.changes ?? [])
    .filter((c) => c.shared_with_client && c.review_status === "confirmed")
    .map((c) => ({ name: c.name, region: c.region, verdict: c.verdict, text: changeMessage(c.name, c.region, c, "client") }));
  const treatments = (p.treatments ?? []).map(treatmentForClient).filter(Boolean);
  for (const t of treatments) for (const w of checkWording(t.summary)) problems.push({ field: `treatment ${String(t.treated_at).slice(0, 10)}`, ...w });
  const content = {
    version: REPORT_VERSION,
    client: { name: String(p.profile?.name ?? "").slice(0, 120) },
    period: p.period ?? null,
    visits: (p.visits ?? []).map((v) => ({ id: v.id, date: v.date, label: v.label })),
    images: (p.images ?? []).slice(0, 24).map((i) => ({ capture_id: i.capture_id, region: i.region, regionLabel: regionLabel(i.region), date: i.date, label: i.label ?? null })),
    measurements: rows,
    changes,
    treatments,
    routine: (p.routine ?? []).slice(0, 30).map((r) => ({ slot: r.slot, product_name: r.product_name, how: r.how ?? null })),
    summary,
    notes: [SCOPE_NOTE, "Experimental measurements are shown for interest and are not used to decide whether skin has changed."],
  };
  return problems.length ? { ok: false, problems, content } : { ok: true, content };
}
