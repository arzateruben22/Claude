import { requireUser } from "@/lib/auth/current-user";
import { getCampaign, getProfile } from "@/lib/profile/service";
import { formatDate } from "@/lib/format";
import { CampaignForm } from "@/components/settings/campaign-form";
import { RestartCampaign } from "@/components/settings/restart-campaign";

export const metadata = { title: "Campaign settings" };

export default async function SettingsCampaignPage() {
  const user = await requireUser("/settings/campaign");
  const [profile, campaign] = await Promise.all([getProfile(user.id), getCampaign(user.id)]);
  const startedAtLabel = formatDate(campaign.startedAt, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-4">
      <CampaignForm
        campaign={{ startedAtKey: campaign.startedAt.toISOString().slice(0, 10), status: campaign.status, dayIndex: campaign.dayIndex }}
        campaignLengthDays={profile.campaignLengthDays}
        targets={{
          dailyApplicationTarget: profile.dailyApplicationTarget,
          workdaysPerWeek: profile.workdaysPerWeek,
          weeklyApplicationTarget: profile.weeklyApplicationTarget,
        }}
      />
      <RestartCampaign lengthDays={profile.campaignLengthDays} startedAtLabel={startedAtLabel} />
    </div>
  );
}
