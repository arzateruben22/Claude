import { cn } from "@/lib/utils";
import type { CampaignTimeline } from "@/lib/dashboard/campaign";
import { fmtDay } from "./format";

export function CampaignTimelineCard({ campaign }: { campaign: CampaignTimeline }) {
  const pct = Math.round(campaign.progress * 100);
  return (
    <section aria-labelledby="campaign-title" className="glass rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="campaign-title" className="text-sm font-medium tracking-tight">
            Operation Get Hired
          </h2>
          <p className="text-xs text-fg-muted mt-0.5">
            {fmtDay(campaign.startDate, true)} → {fmtDay(campaign.endDate, true)} · {campaign.lengthDays} days
          </p>
        </div>
        <p className="text-xs text-fg-muted tnum shrink-0" aria-live="polite">
          {campaign.eyebrow}
        </p>
      </div>

      <div
        className="relative mt-4 h-2.5 w-full rounded-full bg-surface-strong overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Campaign progress: ${campaign.beyond ? "campaign length exceeded" : `day ${campaign.day} of ${campaign.lengthDays}`}`}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", campaign.beyond ? "bg-gold" : "bg-accent")} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 left-1/3 w-px bg-line-strong" aria-hidden />
        <span className="absolute inset-y-0 left-2/3 w-px bg-line-strong" aria-hidden />
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {campaign.phases.map((p) => {
          const active = campaign.phase === p.index;
          const done = campaign.started && (campaign.beyond || campaign.day > p.endDay);
          return (
            <li key={p.index} aria-current={active ? "step" : undefined} className={cn("min-w-0", active ? "text-accent" : done ? "text-fg-muted" : "text-fg-subtle")}>
              <p className="font-medium truncate">
                Phase {p.index} · {p.name}
              </p>
              <p className="tnum">
                Days {p.startDay}–{p.endDay}
                {done && !active ? " · done" : ""}
              </p>
            </li>
          );
        })}
      </ol>
      {campaign.beyond && (
        <p className="mt-3 text-xs text-fg-muted">
          The planned campaign window has passed. Your targets still apply; adjust the campaign length on the Numbers game tab if you want a new horizon.
        </p>
      )}
      {!campaign.started && <p className="mt-3 text-xs text-fg-muted">The campaign starts {fmtDay(campaign.startDate, true)}. Applications logged before then still count.</p>}
    </section>
  );
}
