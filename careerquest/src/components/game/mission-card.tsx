import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, Hourglass, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SKIP_REASON_LABELS } from "@/lib/game/mission-catalog";
import type { MissionView } from "@/lib/game/views";
import { SelfCheckButton } from "./self-check-button";
import { formatDayKey, formatInstant } from "./format";

const fmt = (n: number) => n.toLocaleString("en-US");

export function missionStatusText(m: MissionView, timezone: string): string {
  switch (m.status) {
    case "COMPLETED":
      return m.completedAt ? `Completed ${formatInstant(m.completedAt, timezone)}` : "Completed";
    case "SKIPPED":
      return m.skipReason ? SKIP_REASON_LABELS[m.skipReason] : "Skipped";
    case "EXPIRED":
      return "Expired — no penalty";
    default:
      return m.progress > 0 ? "In progress" : "Not started";
  }
}

function StatusIcon({ m }: { m: MissionView }) {
  if (m.status === "COMPLETED") return <CircleCheck className="h-4 w-4 text-success shrink-0" aria-hidden />;
  if (m.status === "SKIPPED") return <Moon className="h-4 w-4 text-fg-subtle shrink-0" aria-hidden />;
  if (m.status === "EXPIRED") return <Hourglass className="h-4 w-4 text-fg-subtle shrink-0" aria-hidden />;
  return <CircleDashed className="h-4 w-4 text-accent shrink-0" aria-hidden />;
}

/**
 * One mission: why it exists, progress toward its target, XP reward, its state as text and a link
 * to where the work is done. Self-check missions get an "I did this" control (labelled).
 */
export function MissionCard({
  mission: m,
  timezone,
  showPeriod = false,
  compact = false,
}: {
  mission: MissionView;
  timezone: string;
  showPeriod?: boolean;
  compact?: boolean;
}) {
  const done = m.status === "COMPLETED";
  const inactive = m.status === "SKIPPED" || m.status === "EXPIRED";
  const active = m.status === "ACTIVE";
  const titleId = `mission-${m.id}`;
  return (
    <article
      aria-labelledby={titleId}
      data-testid="mission-card"
      data-mission-key={m.key}
      data-status={m.status}
      className={cn("rounded-ctl border p-4 min-w-0", done ? "border-success/30 bg-success-soft/40" : "border-line bg-bg-elevated/40", inactive && "opacity-70")}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">
          <StatusIcon m={m} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 id={titleId} className={cn("text-sm font-medium leading-5", done && "text-fg-muted")}>
              {m.title}
            </h3>
            <Badge tone={done ? "success" : "gold"} className="tnum">
              {done ? `+${fmt(m.xpReward)} XP earned` : `+${fmt(m.xpReward)} XP`}
            </Badge>
          </div>
          {!compact && <p className="mt-1 text-xs text-fg-muted">{m.description}</p>}
          <ProgressBar
            value={m.progress}
            max={Math.max(1, m.target)}
            tone={done ? "success" : "accent"}
            className="mt-2.5 h-1.5"
            label={`${m.title}: ${m.progress} of ${m.target}`}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
            <p className="tnum">
              <span className="text-fg-muted">
                {fmt(m.progress)} / {fmt(m.target)}
              </span>
              {" · "}
              <span data-testid="mission-status">{missionStatusText(m, timezone)}</span>
              {showPeriod && m.type !== "DAILY" && m.campaign !== "ELECTRICIAN_150K" && (
                <>
                  {" · "}
                  {formatDayKey(m.periodStartKey)} – {formatDayKey(m.periodEndKey)}
                </>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              {m.selfReported && <Badge tone="neutral">Self-reported</Badge>}
              {m.checkedAt && !done && <Badge tone="info">Checked off</Badge>}
            </div>
          </div>
          {active && (m.href || m.selfCheck) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {m.href && (
                <Link href={m.href} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  {m.cta ?? "Open"}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              )}
              {m.selfCheck && !m.checkedAt && <SelfCheckButton missionId={m.id} title={m.title} />}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function MissionList({
  missions,
  timezone,
  showPeriod,
  empty,
}: {
  missions: MissionView[];
  timezone: string;
  showPeriod?: boolean;
  empty: ReactNode;
}) {
  if (missions.length === 0) return <div className="text-sm text-fg-muted">{empty}</div>;
  return (
    <ul className="grid gap-3">
      {missions.map((m) => (
        <li key={m.id}>
          <MissionCard mission={m} timezone={timezone} showPeriod={showPeriod} />
        </li>
      ))}
    </ul>
  );
}
