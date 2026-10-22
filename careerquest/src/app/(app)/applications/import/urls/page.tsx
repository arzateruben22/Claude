import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentImports } from "@/components/imports/recent-imports";
import { UrlImportForm } from "@/components/imports/url-import-form";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { listRecentBatches } from "@/lib/imports/batches";

export const metadata: Metadata = { title: "Import job links" };

export default async function ImportUrlsPage() {
  const user = await requireUser("/applications/import/urls");
  const [timezone, batches] = await Promise.all([userTimezone(user.id), listRecentBatches(user.id, ["URL_LIST"])]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Job URLs</CardTitle>
            <CardDescription>
              Paste links to postings you found. Each one is matched to an application you already track, or saved as a lead. Saving a link
              never marks it as applied.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <UrlImportForm />
        </CardContent>
      </Card>
      <RecentImports batches={batches} timezone={timezone} />
    </div>
  );
}
