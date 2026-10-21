import { requireUser } from "@/lib/auth/current-user";
import { listSessions } from "@/lib/account/service";
import { currentSessionId } from "@/lib/account/sessions";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { SessionsCard } from "@/components/settings/sessions-card";
import { ExportCard } from "@/components/settings/export-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";

export const metadata = { title: "Account & data" };

export default async function SettingsAccountPage() {
  const user = await requireUser("/settings/account");
  const sessions = await listSessions(user.id, await currentSessionId());
  return (
    <div className="space-y-4">
      <ChangePasswordForm />
      <SessionsCard sessions={sessions} />
      <ExportCard />
      <DeleteAccountCard email={user.email} />
    </div>
  );
}
