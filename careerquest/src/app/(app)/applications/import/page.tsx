import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailImportForm } from "@/components/imports/email-import-form";
import { RecentImports } from "@/components/imports/recent-imports";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { listRecentBatches } from "@/lib/imports/batches";

export const metadata: Metadata = { title: "Import email files" };

export default async function ImportEmailFilesPage() {
  const user = await requireUser("/applications/import");
  const [timezone, batches] = await Promise.all([userTimezone(user.id), listRecentBatches(user.id, ["EML", "MBOX"])]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Email files</CardTitle>
            <CardDescription>
              Confirmation, interview, rejection and offer emails become tracker updates. Job alerts, unfinished-application reminders and
              invitations to apply never count as applications. Mail that is not job-related is skipped and not stored.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EmailImportForm />
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Getting email files</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-fg-muted">
              <li>Gmail: open a message, ⋮ → Download message (.eml). For many messages, Google Takeout exports Mail as .mbox (you can pick labels).</li>
              <li>Outlook on the web: open a message, … → Save / Download (.eml). Outlook for Windows saves .msg files, which are not supported — forward them to a webmail account or use the paste box.</li>
              <li>Apple Mail: File → Save As → Raw Message Source, or Mailbox → Export Mailbox (.mbox).</li>
              <li>Thunderbird: Save As → File (.eml), or an mbox export add-on.</li>
            </ul>
            <p className="mt-3 text-xs text-fg-subtle">Menu names vary between app versions.</p>
          </CardContent>
        </Card>
        <RecentImports batches={batches} timezone={timezone} />
      </div>
    </div>
  );
}
