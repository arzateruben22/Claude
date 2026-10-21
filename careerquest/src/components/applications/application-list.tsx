import Link from "next/link";
import { CalendarClock, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui";
import type { ApplicationListItem } from "@/lib/applications/service";
import { daysBetweenInTz, formatInTz } from "@/lib/applications/time";
import { QuickStatusSelect } from "./quick-status-select";
import { SourceBadge } from "./source-badge";
import { cn } from "@/lib/utils";

function followUpState(
  item: ApplicationListItem,
  now: Date,
  timezone: string,
): { label: string; tone: "danger" | "warning" | "muted" } | null {
  if (!item.followUpAt) return null;
  const days = daysBetweenInTz(now, item.followUpAt, timezone);
  if (days < 0)
    return {
      label: `${formatInTz(item.followUpAt, timezone, "short")} · overdue`,
      tone: "danger",
    };
  if (days === 0) return { label: "Today", tone: "warning" };
  return {
    label: formatInTz(item.followUpAt, timezone, "short"),
    tone: "muted",
  };
}

const toneClass = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-fg-muted",
} as const;

export function ApplicationList({
  items,
  timezone,
  now,
}: {
  items: ApplicationListItem[];
  timezone: string;
  now: Date;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block glass rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-fg-muted border-b border-line">
            <tr>
              <th scope="col" className="text-left font-medium px-4 py-2.5">
                Company &amp; role
              </th>
              <th scope="col" className="text-left font-medium px-3 py-2.5">
                Stage
              </th>
              <th scope="col" className="text-left font-medium px-3 py-2.5">
                Source
              </th>
              <th scope="col" className="text-left font-medium px-3 py-2.5">
                Applied
              </th>
              <th scope="col" className="text-left font-medium px-3 py-2.5">
                Follow-up
              </th>
              <th scope="col" className="text-left font-medium px-3 py-2.5">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => {
              const fu = followUpState(item, now, timezone);
              const label = `${item.companyName} – ${item.positionTitle}`;
              return (
                <tr
                  key={item.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3 align-top max-w-[28rem]">
                    <Link
                      href={`/applications/${item.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {item.companyName}
                    </Link>
                    <p className="text-fg-muted truncate">
                      {item.positionTitle}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-subtle">
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden />{" "}
                          {item.location}
                        </span>
                      )}
                      {item.remote && <span>Remote</span>}
                      {item.interviewCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" aria-hidden />{" "}
                          {item.interviewCount} interview
                          {item.interviewCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {item.archivedAt && (
                        <Badge tone="neutral">Archived</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <QuickStatusSelect
                        applicationId={item.id}
                        status={item.status}
                        label={label}
                      />
                      {item.statusVerified ? (
                        <ShieldCheck
                          className="h-3.5 w-3.5 text-success"
                          aria-label="Verified"
                        />
                      ) : (
                        <span className="text-[10px] text-warning">
                          unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <SourceBadge source={item.source} />
                      {item.postingUrl && (
                        <a
                          href={item.postingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fg-subtle hover:text-accent"
                          aria-label={`Open posting for ${label}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top tnum text-fg-muted">
                    {formatInTz(item.appliedAt, timezone)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 align-top tnum",
                      fu ? toneClass[fu.tone] : "text-fg-subtle",
                    )}
                  >
                    {fu?.label ?? "—"}
                  </td>
                  <td className="px-3 py-3 align-top tnum text-fg-muted">
                    {formatInTz(item.updatedAt, timezone)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2.5">
        {items.map((item) => {
          const fu = followUpState(item, now, timezone);
          const label = `${item.companyName} – ${item.positionTitle}`;
          return (
            <li key={item.id} className="glass rounded-card p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/applications/${item.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-medium truncate">{item.companyName}</p>
                  <p className="text-sm text-fg-muted truncate">
                    {item.positionTitle}
                  </p>
                </Link>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
                <SourceBadge source={item.source} />
                {item.location && <span>{item.location}</span>}
                {item.archivedAt && <Badge tone="neutral">Archived</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-fg-subtle">Applied</dt>
                  <dd className="tnum text-fg-muted">
                    {formatInTz(item.appliedAt, timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Follow-up</dt>
                  <dd
                    className={cn(
                      "tnum",
                      fu ? toneClass[fu.tone] : "text-fg-subtle",
                    )}
                  >
                    {fu?.label ?? "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-2">
                <QuickStatusSelect
                  applicationId={item.id}
                  status={item.status}
                  label={label}
                />
                <Link
                  href={`/applications/${item.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Details
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
