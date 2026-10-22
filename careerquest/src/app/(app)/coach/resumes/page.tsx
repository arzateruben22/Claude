import { requireUser } from "@/lib/auth/current-user";
import { listResumes } from "@/lib/coach/resumes";
import { getUserTimezone } from "@/lib/analytics/queries";
import { PageHeader } from "@/components/ui/page-header";
import { CoachTabs } from "@/components/coach/coach-tabs";
import { ResumeManager } from "@/components/coach/resume-manager";

export const metadata = { title: "Résumés · Career Advisor · CareerQuest" };

export default async function ResumesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/coach/resumes"), searchParams]);
  const [resumes, timeZone] = await Promise.all([listResumes(user.id), getUserTimezone(user.id)]);
  const editId = Array.isArray(sp.edit) ? sp.edit[0] : sp.edit;
  const editing = editId ? (resumes.find((r) => r.id === editId) ?? null) : null;
  return (
    <>
      <PageHeader
        eyebrow="Career Advisor"
        title="Résumés"
        description="The résumé text the Advisor tailors from. Suggestions only ever reorder or reword what is already here; they never add skills, employers or achievements."
      />
      <CoachTabs />
      <ResumeManager resumes={resumes} editing={editing} timeZone={timeZone} />
    </>
  );
}
