import {
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Flag,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { ApplicationEventType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { EVENT_SOURCE_LABELS } from "@/lib/applications/labels";
import { STATUS_TONE } from "@/lib/applications/status";
import { formatInTz } from "@/lib/applications/time";
import type { TimelineEntry } from "@/lib/applications/timeline";
import { cn } from "@/lib/utils";

const EVENT_ICON: Partial<Record<ApplicationEventType, typeof Bookmark>> = {
  SAVED: Bookmark,
  APPLIED: Send,
  CONFIRMATION_RECEIVED: Mail,
  RECRUITER_RESPONSE: Mail,
  INTERVIEW_SCHEDULED: CalendarClock,
  INTERVIEW_COMPLETED: CalendarCheck,
  OFFER_RECEIVED: Sparkles,
  OFFER_ACCEPTED: CheckCircle2,
  REJECTED: XCircle,
  WITHDRAWN: XCircle,
  FOLLOW_UP_SENT: Send,
  NOTE_ADDED: MessageSquare,
};

const TONE_CLASS: Record<
  (typeof STATUS_TONE)[keyof typeof STATUS_TONE],
  string
> = {
  neutral: "text-fg-muted",
  info: "text-info",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  gold: "text-gold",
};

export function ApplicationTimeline({
  entries,
  timezone,
}: {
  entries: TimelineEntry[];
  timezone: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-fg-muted">No activity recorded yet.</p>;
  }
  return (
    <ol
      className="relative border-l border-line ml-2.5 space-y-5"
      aria-label="Activity timeline"
    >
      {entries.map((e) => {
        const Icon =
          e.kind === "status"
            ? Flag
            : (e.eventType && EVENT_ICON[e.eventType]) || MessageSquare;
        const tone =
          e.kind === "status" && e.toStatus
            ? STATUS_TONE[e.toStatus]
            : "neutral";
        return (
          <li key={e.id} className="pl-6 relative">
            <span
              className={cn(
                "absolute -left-[11px] top-0.5 h-[22px] w-[22px] rounded-full border border-line bg-bg-elevated flex items-center justify-center",
                TONE_CLASS[tone],
              )}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p
                className={cn(
                  "text-sm",
                  e.kind === "status" ? "font-medium" : "text-fg",
                )}
              >
                {e.title}
              </p>
              <Badge tone="neutral">{EVENT_SOURCE_LABELS[e.source]}</Badge>
              {e.verified ? (
                <Badge tone="success">
                  <ShieldCheck className="h-3 w-3" aria-hidden /> Verified
                </Badge>
              ) : (
                <Badge tone="warning">Unverified</Badge>
              )}
            </div>
            {e.detail && (
              <p className="mt-1 text-sm text-fg-muted whitespace-pre-wrap break-words">
                {e.detail}
              </p>
            )}
            <p className="mt-0.5 text-xs text-fg-subtle tnum">
              {formatInTz(e.at, timezone, "datetime")}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
