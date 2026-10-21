import { requireUser } from "@/lib/auth/current-user";
import { getProfile } from "@/lib/profile/service";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata = { title: "Profile & goals" };

export default async function SettingsProfilePage() {
  const user = await requireUser("/settings");
  const profile = await getProfile(user.id);
  return <ProfileForm profile={profile} />;
}
