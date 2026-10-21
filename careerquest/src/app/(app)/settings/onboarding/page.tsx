import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getProfile } from "@/lib/profile/service";
import { formatDate } from "@/lib/format";
import { XP } from "@/lib/game/xp-config";
import { Alert, PageHeader } from "@/components/ui";
import { OnboardingWizard } from "@/components/settings/onboarding-wizard";

export const metadata = { title: "Set up your campaign" };

export default async function OnboardingPage() {
  const user = await requireUser("/settings/onboarding");
  const profile = await getProfile(user.id);
  const done = profile.onboardingCompletedAt !== null;
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Operation Get Hired"
        title="Set up your campaign"
        description={
          done
            ? "Your setup is already complete. You can revisit any answer here; everything else lives under Settings."
            : `Three short steps. Finishing earns ${XP.PROFILE_COMPLETED} XP once, and every answer can be changed later in Settings.`
        }
        actions={
          <Link href="/dashboard" className="text-sm text-fg-muted hover:text-fg">
            {done ? "Back to dashboard" : "Skip for now"}
          </Link>
        }
      />
      {done && (
        <Alert tone="info" className="mb-4">
          Completed {formatDate(profile.onboardingCompletedAt)}. Saving again updates your profile without awarding XP a second time.
        </Alert>
      )}
      <OnboardingWizard defaults={profile} alreadyCompleted={done} />
    </div>
  );
}
