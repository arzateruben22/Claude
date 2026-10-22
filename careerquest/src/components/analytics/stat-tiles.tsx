import { Clock, Handshake, MessageSquareReply, Mic, Send } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RateEstimate } from "@/lib/analytics/stats";
import type { FunnelResult, ResponseTiming } from "@/lib/analytics/types";

function intervalText(est: RateEstimate): string {
  if (!est.interval) return "";
  return `${formatPercent(est.interval.low, 0)}–${formatPercent(est.interval.high, 0)}`;
}

function RateTile({ label, est, icon, testId }: { label: string; est: RateEstimate; icon: ReactNode; testId: string }) {
  let hint: ReactNode;
  if (est.n === 0) hint = "No applied applications in this range";
  else if (est.lowSample)
    hint = (
      <span className="flex flex-wrap items-center gap-1">
        <span className="tnum">n = {formatNumber(est.n)}</span>
        <Badge tone="warning">Low sample</Badge>
        <span>not enough data for a reliable rate (95% interval {intervalText(est)})</span>
      </span>
    );
  else hint = <span className="tnum">n = {formatNumber(est.n)} · 95% interval {intervalText(est)}</span>;

  return (
    <div data-testid={testId}>
      <StatTile
        label={`${label} · Observed`}
        value={est.value === null ? "—" : formatPercent(est.value, 0)}
        hint={hint}
        icon={icon}
        tone={est.value !== null && est.value > 0 && !est.lowSample ? "accent" : undefined}
      />
    </div>
  );
}

export function AnalyticsStatTiles({ funnel, timing }: { funnel: FunnelResult; timing: ResponseTiming }) {
  const { counts, rates } = funnel;
  const avg = timing.averageDays;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 mb-5" role="list" aria-label="Observed totals and rates">
      <div role="listitem" data-testid="tile-applied">
        <StatTile
          label="Applied · Observed"
          value={formatNumber(counts.applied)}
          hint={counts.total > counts.applied ? `${formatNumber(counts.total - counts.applied)} never applied (saved or closed)` : `${formatNumber(counts.total)} in this slice`}
          icon={<Send className="h-4 w-4" aria-hidden />}
        />
      </div>
      <div role="listitem">
        <RateTile label="Response rate" est={rates.responseRate} icon={<MessageSquareReply className="h-4 w-4" aria-hidden />} testId="tile-response-rate" />
      </div>
      <div role="listitem">
        <RateTile label="Interview rate" est={rates.interviewRate} icon={<Mic className="h-4 w-4" aria-hidden />} testId="tile-interview-rate" />
      </div>
      <div role="listitem">
        <RateTile label="Offer rate" est={rates.offerRate} icon={<Handshake className="h-4 w-4" aria-hidden />} testId="tile-offer-rate" />
      </div>
      <div role="listitem" data-testid="tile-days-to-response">
        <StatTile
          label="Avg days to response · Observed"
          value={avg === null ? "—" : avg < 10 ? avg.toFixed(1) : Math.round(avg).toString()}
          hint={
            timing.n === 0 ? (
              "No responses with dates yet"
            ) : (
              <span className="tnum">
                n = {formatNumber(timing.n)} · median {timing.medianDays === null ? "—" : timing.medianDays.toFixed(1)} days
              </span>
            )
          }
          icon={<Clock className="h-4 w-4" aria-hidden />}
        />
      </div>
    </div>
  );
}
