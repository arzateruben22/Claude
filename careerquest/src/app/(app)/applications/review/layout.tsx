import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getReviewCounts } from "@/lib/ingest/review";
import { LinkTabs, PageHeader, buttonClasses } from "@/components/ui";

export const metadata: Metadata = { title: "Review queue" };

const withCount = (label: string, n: number) =>
  n > 0 ? `${label} (${n > 99 ? "99+" : n})` : label;

export default async function ReviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const counts = await getReviewCounts(user.id);
  return (
    <>
      <PageHeader
        eyebrow="Tracker"
        title="Review queue"
        description="Emails and browser captures CareerQuest could not file with confidence, and records that may be the same job. Nothing here changes your applications until you decide."
        actions={
          <Link
            href="/applications"
            className={buttonClasses("secondary", "md")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Applications
          </Link>
        }
      />
      <LinkTabs
        tabs={[
          {
            href: "/applications/review",
            label: withCount("Emails", counts.emails),
            exact: true,
          },
          {
            href: "/applications/review/captures",
            label: withCount("Captures", counts.captures),
          },
          {
            href: "/applications/review/duplicates",
            label: withCount("Possible duplicates", counts.duplicates),
          },
        ]}
      />
      {children}
    </>
  );
}
