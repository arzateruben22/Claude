import { CircleCheck, CircleDashed, Hourglass, MapPin, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CampaignTimeline } from "@/lib/dashboard/campaign";
import type { PhaseView } from "@/lib/game/views";
import type { MissionView } from "@/lib/game/views";
import { formatDayKey } from "./format";

const STATE_BADGE: Record<PhaseView["state"], { label: string; tone: "success" | "accent" | "neutral" }> = {
  done: { label: "Done", tone: "success" },
  current: { label: "Now", tone: "accent" },
  upcoming: { label: "Upcoming", tone: "neutral" },
};

function MissionLine({ m }: { m: MissionView }) {
  const Icon = m.status === "COMPLETED" ? CircleCheck : m.status === "EXPIRED" ? Hourglass : m.status === "SKIPPED" ? Moon : CircleDashed;
  const tone = m.status === "COMPLETED" ? "text-success" : m.status === "ACTIVE" ? "text-accent" : "text-fg-subtle";
  const state = m.status === "COMPLETED" ? "completed" : m.status === "EXPIRED" ? "expired" : m.status === "SKIPPED" ? "paused" : "in progress";
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", tone)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn(m.status === "COMPLETED" ? "text-fg-muted" : "text-fg")}>{m.title}</span>
        <span className="text-fg-subtle tnum">
          {" "}
          · {m.status === "COMPLETED" ? `+${m.xpReward} XP` : `${m.progress}/${m.target}`}
        </span>
        <span className="sr-only"> ({state})</span>
      </span>
    </li>
  );
}

/**
 * Operation Get Hired: three phases on a visual timeline with a today marker, each phase's focus
 * list and its campaign missions (completed ones checked off).
 */
export function CampaignTimelineView({
  timeline,
  phases,
  hired,
}: {
  timeline: CampaignTimeline;
  phases: PhaseView[];
  hired: boolean;
}) {
  const pct = !timeline.started ? 0 : timeline.beyond ? 100 : Math.min(100, Math.max(0, ((timeline.day - 0.5) / timeline.lengthDays) * 100));
  const markerLabel = !timeline.started
    ? `Starts ${formatDayKey(timeline.startDate.toISOString().slice(0, 10))}`
    : timeline.beyond
      ? `Day ${timeline.day} · past day ${timeline.lengthDays}`
      : `Today · Day ${timeline.day}`;
  return (
    <section aria-labelledby="ogh-title" className="glass rounded-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ogh-title" className="text-base font-semibold tracking-tight">
            Operation Get Hired
          </h2>
          <p className="text-xs text-fg-muted mt-0.5 tnum">
            {formatDayKey(timeline.startDate.toISOString().slice(0, 10), true)} → {formatDayKey(timeline.endDate.toISOString().slice(0, 10), true)} ·{" "}
            {timeline.lengthDays} days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-fg-muted tnum">{timeline.eyebrow}</p>
          {hired ? <Badge tone="success">Completed · job reported</Badge> : <Badge tone="accent">Active</Badge>}
        </div>
      </div>

      <div className="relative mt-8 mb-2">
        <div
          className="relative h-3 w-full overflow-hidden rounded-full bg-surface-strong"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={`Campaign timeline: ${markerLabel}`}
        >
          <div className={cn("h-full rounded-full", hired ? "bg-success" : timeline.beyond ? "bg-gold" : "bg-accent")} style={{ width: `${pct}%` }} />
          <span className="absolute inset-y-0 left-1/3 w-0.5 bg-bg" aria-hidden />
          <span className="absolute inset-y-0 left-2/3 w-0.5 bg-bg" aria-hidden />
        </div>
        <div
          className={cn(
            "absolute -top-7 flex flex-col",
            pct < 20 ? "items-start -translate-x-1.5" : pct > 80 ? "items-end -translate-x-full" : "items-center -translate-x-1/2",
          )}
          style={{ left: `${pct}%` }}
          aria-hidden
        >
          <span className="whitespace-nowrap rounded-full bg-bg-elevated border border-line px-2 py-0.5 text-[10px] font-medium text-fg tnum">{markerLabel}</span>
          <MapPin className="h-3.5 w-3.5 text-accent -mt-0.5" />
        </div>
      </div>

      <ol className="mt-4 grid gap-3 lg:grid-cols-3">
        {phases.map((p) => {
          const badge = STATE_BADGE[p.state];
          return (
            <li
              key={p.index}
              aria-current={p.state === "current" ? "step" : undefined}
              data-testid={`phase-${p.index}`}
              className={cn("rounded-ctl border p-4 min-w-0", p.state === "current" ? "border-accent/50 bg-accent-soft/40" : "border-line bg-bg-elevated/40")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Phase {p.index} · {p.name}
                  </p>
                  <p className="text-xs text-fg-muted">{p.title}</p>
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-fg-subtle tnum">
                Days {p.startDay}–{p.endDay} · {formatDayKey(p.startKey)} – {formatDayKey(p.endKey)}
              </p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Focus</p>
              <ul className="mt-1 space-y-1 text-xs text-fg-muted list-disc pl-4">
                {p.focus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Missions</p>
              {p.missions.length > 0 ? (
                <ul className="mt-1 space-y-1.5">
                  {p.missions.map((m) => (
                    <MissionLine key={m.id} m={m} />
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-fg-subtle">
                  {p.state === "upcoming" ? `Unlock on ${formatDayKey(p.startKey)}.` : hired ? "Paused after you reported a job." : "No missions were recorded for this phase."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
