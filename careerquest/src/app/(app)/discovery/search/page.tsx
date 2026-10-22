import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { loadDiscoveryProfile } from "@/lib/discovery/profile";
import { buildSearchPlan } from "@/lib/discovery/search-links";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { SearchLinksView } from "@/components/discovery/search-links-view";

export const metadata: Metadata = { title: "Search links · Job Discovery" };

export default async function SearchLinksPage() {
  const user = await requireUser("/discovery/search");
  const profile = await loadDiscoveryProfile(user.id);
  const groups = buildSearchPlan(profile);
  return (
    <div className="space-y-6">
      <Alert tone="info" title="These links open the job boards' own search pages">
        CareerQuest does not scrape, crawl or query job boards, and nothing comes back automatically. Search on the board, then paste a
        posting&apos;s link into{" "}
        <Link href="/discovery" className="text-accent hover:underline">
          Leads
        </Link>{" "}
        (or use the browser extension) to keep it. Searches use your interests and regions from{" "}
        <Link href="/settings" className="text-accent hover:underline">
          Settings
        </Link>
        .
      </Alert>
      {groups.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-6 w-6" aria-hidden />}
          title="No interests set"
          description="Choose your primary trade and career interests in Settings to get search links for them."
          action={
            <Link href="/settings" className={buttonClasses("secondary")}>
              Open Settings
            </Link>
          }
        />
      ) : (
        <SearchLinksView groups={groups} />
      )}
    </div>
  );
}
