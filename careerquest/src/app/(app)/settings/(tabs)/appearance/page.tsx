import { requireUser } from "@/lib/auth/current-user";
import { getProfile } from "@/lib/profile/service";
import { AppearanceForm } from "@/components/settings/appearance-form";

export const metadata = { title: "Appearance" };

export default async function SettingsAppearancePage() {
  const user = await requireUser("/settings/appearance");
  const profile = await getProfile(user.id);
  return <AppearanceForm theme={profile.theme} reducedMotion={profile.reducedMotion} />;
}
