import { requireUser } from "@/lib/auth/current-user";
import { getProfile } from "@/lib/profile/service";
import { EligibilityForm } from "@/components/settings/eligibility-form";

export const metadata = { title: "Eligibility filters" };

export default async function SettingsEligibilityPage() {
  const user = await requireUser("/settings/eligibility");
  const profile = await getProfile(user.id);
  return (
    <EligibilityForm
      defaults={{
        excludeCompanyVehicleJobs: profile.excludeCompanyVehicleJobs,
        excludeDrivingRecordJobs: profile.excludeDrivingRecordJobs,
        excludeCdlJobs: profile.excludeCdlJobs,
      }}
    />
  );
}
