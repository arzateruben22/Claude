import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";
import { TRAINING_HOURS_GOAL } from "@/lib/game/levels";
import type { MissionView } from "@/lib/game/views";
import { MissionCard } from "./mission-card";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

/**
 * The $150K Electrician Path: runs in parallel with Operation Get Hired and never ends when a job
 * is reported. Verified and self-reported hours are shown separately.
 */
export function ElectricianPathCard({
  missions,
  verifiedHours,
  selfReportedHours,
  longTermSalaryTarget,
  timezone,
}: {
  missions: MissionView[];
  verifiedHours: number;
  selfReportedHours: number;
  longTermSalaryTarget: number;
  timezone: string;
}) {
  const active = missions.filter((m) => m.status === "ACTIVE");
  const done = missions.filter((m) => m.status === "COMPLETED");
  return (
    <section aria-labelledby="e150-title" className="glass rounded-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="e150-title" className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" aria-hidden />
            The $150K Electrician Path
          </h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            Runs alongside Operation Get Hired and keeps going after you get a job. Your long-term goal is {formatCurrency(longTermSalaryTarget)}/yr — a goal,
            not a promise of pay.
          </p>
        </div>
        <Badge tone="accent">Always on</Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <p className="font-medium">Verified training hours</p>
          <p className="tnum">
            {fmt(verifiedHours)} <span className="text-fg-subtle">/ {fmt(TRAINING_HOURS_GOAL)}</span>
          </p>
        </div>
        <ProgressBar value={verifiedHours} max={TRAINING_HOURS_GOAL} tone="gold" className="mt-1.5" label={`Verified hours: ${fmt(verifiedHours)} of ${fmt(TRAINING_HOURS_GOAL)}`} />
        <p className="mt-1 text-[11px] text-fg-subtle">
          Verified = employer-verified or official record. {fmt(selfReportedHours)} self-reported {selfReportedHours === 1 ? "hour is" : "hours are"} logged but not
          counted until verified. Academy lessons and simulations are study, not qualifying field experience.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/career-map" className="inline-flex items-center gap-1 text-accent hover:underline">
          Career Map: programs, hours and certification
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <Link href="/academy" className="inline-flex items-center gap-1 text-accent hover:underline">
          Electrical Academy
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <h3 className="mt-5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Open milestones</h3>
      {active.length > 0 ? (
        <ul className="mt-2 grid gap-3 md:grid-cols-2">
          {active.map((m) => (
            <li key={m.id}>
              <MissionCard mission={m} timezone={timezone} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">Every open milestone is done. New ones appear as you progress.</p>
      )}
      {done.length > 0 && (
        <>
          <h3 className="mt-5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Completed</h3>
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {done.map((m) => (
              <li key={m.id}>
                <MissionCard mission={m} timezone={timezone} compact />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
