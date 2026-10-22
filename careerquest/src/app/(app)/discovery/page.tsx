import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { JOB_CATEGORY_SUGGESTIONS } from "@/lib/applications/labels";
import { listLeads, type LeadListView } from "@/lib/discovery/leads";
import { loadDiscoveryProfile } from "@/lib/discovery/profile";
import { EmptyState } from "@/components/ui/empty-state";
import { QuickAddLead } from "@/components/discovery/quick-add-lead";
import { LeadCard } from "@/components/discovery/lead-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads · Job Discovery" };

const VIEWS: Array<{ key: LeadListView; label: string }> = [
  { key: "active", label: "Active" },
  { key: "dismissed", label: "Dismissed" },
  { key: "converted", label: "In tracker" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(view: LeadListView, showHidden: boolean) {
  const qs = new URLSearchParams();
  if (view !== "active") qs.set("view", view);
  if (showHidden && view === "active") qs.set("hidden", "1");
  const s = qs.toString();
  return s ? `/discovery?${s}` : "/discovery";
}

export default async function DiscoveryLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/discovery");
  const sp = await searchParams;
  const rawView = first(sp.view);
  const view: LeadListView = rawView === "dismissed" || rawView === "converted" ? rawView : "active";
  const showHidden = first(sp.hidden) === "1";
  const profile = await loadDiscoveryProfile(user.id);
  const list = await listLeads(user.id, view, profile);
  const categories = [...JOB_CATEGORY_SUGGESTIONS];
  const filtersOn = profile.excludeCompanyVehicleJobs || profile.excludeDrivingRecordJobs || profile.excludeCdlJobs;

  return (
    <div className="space-y-6">
      <QuickAddLead categories={categories} />

      <section aria-labelledby="leads-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="leads-heading" className="text-lg font-semibold">
            Your leads
          </h2>
          <nav aria-label="Lead lists" className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={href(v.key, false)}
                aria-current={view === v.key ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tnum",
                  view === v.key ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-muted hover:text-fg",
                )}
              >
                {v.label} ({list.counts[v.key]})
              </Link>
            ))}
          </nav>
        </div>

        {view === "active" && (
          <p className="text-xs text-fg-muted">
            Sorted by fit score — an estimate from your{" "}
            <Link href="/settings" className="text-accent hover:underline">
              trade, interests, regions and pay targets
            </Link>
            . Flags mark driving or vehicle requirements; nothing is rejected automatically.
          </p>
        )}

        {list.items.length === 0 && list.hidden.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" aria-hidden />}
            title={view === "active" ? "No leads yet" : view === "dismissed" ? "No dismissed leads" : "No leads moved to the tracker yet"}
            description={
              view === "active" ? (
                <>
                  Paste a job link or posting above, or open{" "}
                  <Link href="/discovery/search" className="text-accent hover:underline">
                    Search links
                  </Link>{" "}
                  to look on the job boards.
                </>
              ) : (
                "Leads you dismiss or convert show up here."
              )
            }
          />
        ) : (
          <ul className="space-y-3">
            {list.items.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} categories={categories} />
              </li>
            ))}
          </ul>
        )}

        {view === "active" && list.hidden.length > 0 && (
          <div className="space-y-3 rounded-card border border-dashed border-line p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                {list.hidden.length} lead{list.hidden.length === 1 ? " is" : "s are"} hidden by your private eligibility filters.
              </p>
              <Link href={href("active", !showHidden)} className="text-sm text-accent hover:underline">
                {showHidden ? "Hide them again" : `Show hidden (${list.hidden.length})`}
              </Link>
            </div>
            {showHidden && (
              <ul className="space-y-3">
                {list.hidden.map((lead) => (
                  <li key={lead.id}>
                    <LeadCard lead={lead} categories={categories} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {view === "active" && filtersOn && list.hidden.length === 0 && list.items.length > 0 && (
          <p className="text-xs text-fg-subtle">Your private eligibility filters are on; no current lead matches them.</p>
        )}
      </section>
    </div>
  );
}
