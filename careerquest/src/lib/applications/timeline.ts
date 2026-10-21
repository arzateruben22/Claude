import type {
  ApplicationEventType,
  ApplicationStatus,
  EventSource,
} from "@/generated/prisma/enums";
import { EVENT_TYPE_LABELS } from "./labels";
import { STATUS_LABELS } from "./status";

/** Pure merge of status history + event log into one chronological list for the detail page. */

export type HistoryLike = {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  occurredAt: Date;
  source: EventSource;
  verified: boolean;
  note: string | null;
};

export type EventLike = {
  id: string;
  type: ApplicationEventType;
  occurredAt: Date;
  source: EventSource;
  verified: boolean;
  payload: unknown;
};

export type TimelineEntry = {
  id: string;
  kind: "status" | "event";
  at: Date;
  title: string;
  detail: string | null;
  source: EventSource;
  verified: boolean;
  eventType?: ApplicationEventType;
  toStatus?: ApplicationStatus;
  /** XP recorded on the event payload at the time (informational only). */
  xp?: number;
};

/** Event types that are already represented by a status-history row and would only duplicate it. */
const HIDDEN_EVENT_TYPES: ReadonlySet<ApplicationEventType> =
  new Set<ApplicationEventType>(["STATUS_CHANGED"]);

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length ? v : null;
}

export function eventDetail(
  type: ApplicationEventType,
  payload: unknown,
): string | null {
  const p = asRecord(payload);
  switch (type) {
    case "NOTE_ADDED":
    case "FOLLOW_UP_SENT":
      return str(p.note);
    case "INTERVIEW_SCHEDULED": {
      const bits = [str(p.typeLabel), str(p.scheduledFor)].filter(Boolean);
      return bits.length ? bits.join(" · ") : null;
    }
    case "INTERVIEW_COMPLETED":
      return str(p.outcomeLabel);
    default:
      return str(p.note) ?? str(p.detail);
  }
}

export function buildTimeline(
  history: HistoryLike[],
  events: EventLike[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const h of history) {
    entries.push({
      id: `h:${h.id}`,
      kind: "status",
      at: h.occurredAt,
      title: h.fromStatus
        ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`
        : `Created as ${STATUS_LABELS[h.toStatus]}`,
      detail: h.note,
      source: h.source,
      verified: h.verified,
      toStatus: h.toStatus,
    });
  }
  for (const e of events) {
    if (HIDDEN_EVENT_TYPES.has(e.type)) continue;
    const p = asRecord(e.payload);
    const xp =
      typeof p.xpAwarded === "number" && p.xpAwarded > 0
        ? p.xpAwarded
        : undefined;
    entries.push({
      id: `e:${e.id}`,
      kind: "event",
      at: e.occurredAt,
      title: EVENT_TYPE_LABELS[e.type],
      detail: eventDetail(e.type, e.payload),
      source: e.source,
      verified: e.verified,
      eventType: e.type,
      xp,
    });
  }
  // Newest first; status rows win ties so the stage change reads above the events it triggered.
  entries.sort(
    (a, b) =>
      b.at.getTime() - a.at.getTime() ||
      (a.kind === b.kind ? 0 : a.kind === "status" ? -1 : 1),
  );
  return entries;
}
