import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";

export default function SkillsPage() {
  return (
    <>
      <PageHeader title="Skills" description="This module is scheduled for a later build phase." />
      <Alert tone="info" title="Module under construction">Nothing here is final yet; no demo data is shown.</Alert>
    </>
  );
}
