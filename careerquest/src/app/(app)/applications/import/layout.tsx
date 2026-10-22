import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { IMPORT_TABS } from "@/components/imports/import-tabs";

export default function ImportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Tracker"
        title="Import applications"
        description="Bring in applications you already sent. Every import is matched against your tracker first, so nothing is counted twice, and nothing is ever submitted for you."
        actions={
          <Link href="/applications" className={buttonClasses("ghost", "md")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to tracker
          </Link>
        }
      />
      <LinkTabs tabs={IMPORT_TABS} />
      {children}
    </>
  );
}
