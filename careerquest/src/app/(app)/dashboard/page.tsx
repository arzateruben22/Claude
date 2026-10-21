import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Command Center" eyebrow="Phase 1" description="Your daily status, targets and next best action." />
      <Alert tone="info" title="Module under construction">This page is being built in the current phase.</Alert>
    </>
  );
}
