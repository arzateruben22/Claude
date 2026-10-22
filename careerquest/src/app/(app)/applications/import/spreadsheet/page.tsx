import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentImports } from "@/components/imports/recent-imports";
import { SpreadsheetImporter } from "@/components/imports/spreadsheet-importer";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { listRecentBatches } from "@/lib/imports/batches";

export const metadata: Metadata = { title: "Import a spreadsheet" };

export default async function ImportSpreadsheetPage() {
  const user = await requireUser("/applications/import/spreadsheet");
  const [timezone, batches] = await Promise.all([userTimezone(user.id), listRecentBatches(user.id, ["CSV"])]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Spreadsheet</CardTitle>
            <CardDescription>
              Your own tracker as .csv, .tsv or .xlsx — one application per row. Company and job title are required; rows with a date applied
              are imported as submitted, rows without one as saved leads, unless you map a status column.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SpreadsheetImporter preset="generic" />
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Accepted dates</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-fg-muted">
              <li>2026-01-05 or 2026/01/05</li>
              <li>01/05/2026 or 1/5/26 (month first; 25/01/2026 is read as day first)</li>
              <li>Jan 5, 2026 · January 5 2026 · 5 Jan 2026</li>
              <li>Excel date cells</li>
            </ul>
            <p className="mt-3 text-xs text-fg-subtle">
              Dates are calendar days in your timezone ({timezone}). Columns with phone numbers, email addresses or screening answers are left out
              automatically.
            </p>
          </CardContent>
        </Card>
        <RecentImports batches={batches} timezone={timezone} />
      </div>
    </div>
  );
}
