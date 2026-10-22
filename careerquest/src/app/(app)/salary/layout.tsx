import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { SALARY_TABS } from "@/components/salary/nav";

export default function SalaryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Estimates · based on your inputs"
        title="Salary Simulator"
        description="Work out weekly, monthly and yearly pay, compare a job now with an apprenticeship, and line up real offers. Gross amounts before taxes; overtime and raises are never guaranteed."
      />
      <LinkTabs tabs={SALARY_TABS} />
      {children}
    </>
  );
}
