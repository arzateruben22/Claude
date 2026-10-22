import { BadgeCheck, CalendarClock, ClipboardList, Flag, GraduationCap, Trophy } from "lucide-react";
import type { HourTotals, Projection } from "@/lib/academy/hours/stats";
import type { ClassroomSummary } from "@/lib/academy/hours/service";
import type { RequirementView } from "@/lib/academy/certification/requirements";
import { PROJECTION_WINDOW_WEEKS } from "@/lib/academy/hours/constants";
import { StatTile } from "@/components/ui/stat-tile";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDayKey, formatHours, formatHoursNumber } from "./format";

export function requirementCaption(r: RequirementView): string {
  if (r.source === "fallback") return `Commonly cited figure for ${r.name} — unverified here; check DIR's official rules`;
  return `Commonly cited for ${r.name}, subject to official DIR rules · last verified ${r.verifiedOnKey ? formatDayKey(r.verifiedOnKey) : "never"}`;
}

export function projectionText(p: Projection, required: number): { value: string; detail: string } {
  switch (p.status) {
    case "complete":
      return { value: "Reached", detail: `Verified hours meet the ${formatHoursNumber(required)}-hour figure. DIR decides eligibility.` };
    case "insufficient":
      return p.reason === "no-verified"
        ? { value: "Not enough data", detail: "No verified hours yet. Attach a pay stub, employer letter or union hour report to an entry to verify it." }
        : {
            value: "Not enough data",
            detail: `${p.weeksOfData} week${p.weeksOfData === 1 ? "" : "s"} of verified history; a projection needs at least ${p.minWeeks}.`,
          };
    case "stalled":
      return { value: "No recent hours", detail: `No verified hours in the last ${p.windowWeeks} weeks, so no completion date can be projected.` };
    case "projected":
      return {
        value: formatDayKey(p.dateKey),
        detail: `At ${formatHoursNumber(p.averagePerWeek)} verified h/week (trailing ${p.windowWeeks < PROJECTION_WINDOW_WEEKS ? `${p.windowWeeks}-week` : `${PROJECTION_WINDOW_WEEKS}-week`} average), ${formatHours(p.remaining)} to go.`,
      };
  }
}

/** Verified and self-reported totals side by side, the requirement and the projection. */
export function HoursTotals({ totals, requirement, projection }: { totals: HourTotals; requirement: RequirementView; projection: Projection }) {
  const proj = projectionText(projection, requirement.hoursRequired);
  const ratio = requirement.hoursRequired > 0 ? totals.verified / requirement.hoursRequired : 0;
  return (
    <section aria-label="Hour totals" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Verified hours"
          value={formatHoursNumber(totals.verified)}
          tone="success"
          icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
          hint={`Employer-verified ${formatHoursNumber(totals.employerVerified)} · official record ${formatHoursNumber(totals.officialRecord)}`}
        />
        <StatTile
          label="Self-reported hours"
          value={formatHoursNumber(totals.selfReported)}
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          hint="Tracked only — not treated as accepted by California"
        />
        <StatTile
          label={`${requirement.name} requirement`}
          value={formatHoursNumber(requirement.hoursRequired)}
          tone="gold"
          icon={<Flag className="h-4 w-4" aria-hidden />}
          hint={requirementCaption(requirement)}
        />
        <StatTile
          label="Projected completion"
          value={<span className={cn(projection.status !== "projected" && projection.status !== "complete" && "text-lg text-fg-muted")}>{proj.value}</span>}
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          hint={
            <>
              <Badge tone="info" className="mr-1">
                Estimate
              </Badge>
              {proj.detail}
            </>
          }
        />
      </div>
      <div className="glass rounded-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p>
            <span className="font-medium tnum">{formatHoursNumber(totals.verified)}</span>
            <span className="text-fg-muted"> of {formatHours(requirement.hoursRequired)} verified</span>
          </p>
          <p className="text-xs text-fg-subtle tnum">{(Math.min(1, ratio) * 100).toFixed(1)}%</p>
        </div>
        <ProgressBar value={totals.verified} max={requirement.hoursRequired} tone="success" className="mt-2" label="Verified hours toward the requirement" />
        <p className="mt-2 text-xs text-fg-muted">
          {totals.selfReported > 0
            ? `Plus ${formatHours(totals.selfReported)} self-reported, shown separately and not counted toward the requirement here.`
            : "Self-reported hours are shown separately and never counted toward the requirement here."}{" "}
          On-the-job entries only; classroom instruction is tracked separately.
        </p>
      </div>
    </section>
  );
}

export function MilestoneList({ milestones }: { milestones: { hours: number; reached: boolean }[] }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Verified-hour milestones">
      {milestones.map((m) => (
        <li
          key={m.hours}
          className={cn(
            "flex flex-col items-center gap-1 rounded-ctl border px-1 py-2 text-center",
            m.reached ? "border-gold/40 bg-gold-soft text-gold" : "border-line text-fg-subtle",
          )}
        >
          <Trophy className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold tnum">{m.hours >= 1000 ? `${m.hours / 1000}k` : m.hours}</span>
          <span className="text-[10px]">{m.reached ? "Reached" : "Locked"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Classroom (related instruction) hours with the trainee-route milestones from the seed facts. */
export function ClassroomCard({ classroom }: { classroom: ClassroomSummary }) {
  const { totals, yearToDate, year, targets } = classroom;
  return (
    <div className="space-y-4" data-testid="classroom-card">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-ctl border border-line p-3">
          <p className="text-xs text-fg-muted">Verified classroom</p>
          <p className="mt-1 text-xl font-semibold tnum text-success">{formatHours(totals.verified)}</p>
        </div>
        <div className="rounded-ctl border border-line p-3">
          <p className="text-xs text-fg-muted">Self-reported classroom</p>
          <p className="mt-1 text-xl font-semibold tnum">{formatHours(totals.selfReported)}</p>
        </div>
      </div>
      {targets.annualMinimum !== null && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p>
              <GraduationCap className="mr-1 inline h-4 w-4 text-fg-subtle" aria-hidden />
              {year}: <span className="font-medium tnum">{formatHoursNumber(yearToDate.logged)}</span>
              <span className="text-fg-muted"> of at least {formatHours(targets.annualMinimum)} this year</span>
            </p>
            <span className="text-xs text-fg-subtle tnum">{formatHoursNumber(yearToDate.verified)} verified</span>
          </div>
          <ProgressBar value={yearToDate.logged} max={targets.annualMinimum} tone="info" className="mt-1.5" label={`Classroom hours in ${year}`} />
        </div>
      )}
      {targets.routeTotal !== null && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p>
              <span className="font-medium tnum">{formatHoursNumber(totals.logged)}</span>
              <span className="text-fg-muted"> of {formatHours(targets.routeTotal)} related instruction</span>
            </p>
            <span className="text-xs text-fg-subtle tnum">{formatHoursNumber(totals.verified)} verified</span>
          </div>
          <ProgressBar value={totals.logged} max={targets.routeTotal} tone="info" className="mt-1.5" label="Related and supplemental instruction" />
        </div>
      )}
      <p className="text-xs text-fg-subtle">
        Log school hours with the work type &ldquo;Classroom instruction&rdquo;. Trainee-route figures
        {targets.annualMinimum !== null || targets.routeTotal !== null ? " come from the researched DIR facts and are" : " are not in the reference data and are"} subject to official
        rules; classroom hours never count toward on-the-job hours.
      </p>
    </div>
  );
}
