import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentImports } from "@/components/imports/recent-imports";
import { SpreadsheetImporter } from "@/components/imports/spreadsheet-importer";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { listRecentBatches } from "@/lib/imports/batches";
import { LINKEDIN_EXPORT_STEPS } from "@/lib/imports/presets";

export const metadata: Metadata = { title: "Import platform exports" };

export default async function ImportExportsPage() {
  const user = await requireUser("/applications/import/exports");
  const [timezone, batches] = await Promise.all([userTimezone(user.id), listRecentBatches(user.id, ["PLATFORM_EXPORT"])]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Platform exports</CardTitle>
            <CardDescription>
              Files a job site lets you download about your own applications. Only the application date, company, job title and link are
              imported from LinkedIn&apos;s export; contact details and screening answers are never read into CareerQuest.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SpreadsheetImporter preset="linkedin" presetChoices={["linkedin", "ats"]} />
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Getting LinkedIn&apos;s export</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-fg-muted">
              {LINKEDIN_EXPORT_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-fg-subtle">LinkedIn changes its menus from time to time; the export is under its data-privacy settings.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Other sites</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted space-y-2">
            <p>
              Indeed, Glassdoor, ZipRecruiter and most applicant-tracking portals do not offer a download of your application history. Use their
              confirmation emails (Email files tab or a connected mailbox), or copy the list from the site into a spreadsheet and use the
              applicant-tracking preset.
            </p>
          </CardContent>
        </Card>
        <RecentImports batches={batches} timezone={timezone} />
      </div>
    </div>
  );
}
