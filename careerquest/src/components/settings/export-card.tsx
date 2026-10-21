import { Download } from "lucide-react";
import { buttonClasses, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

const INCLUDED = [
  "Profile, goals, campaign state and player stats",
  "Applications with status history, events, interviews and offers",
  "Employers, contacts, resumes, cover letters, leads and target companies",
  "Integrations (without tokens) and email metadata",
  "XP ledger, achievements, missions, lesson progress and quiz attempts",
  "Work hours, certification status, notifications and audit log",
];

export function ExportCard() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Export my data</CardTitle>
          <CardDescription>One JSON file with every record CareerQuest holds for you. Yours to keep or move elsewhere.</CardDescription>
        </div>
        <a href="/api/account/export" download className={buttonClasses("secondary", "sm")}>
          <Download className="h-4 w-4" aria-hidden />
          Export my data
        </a>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 sm:grid-cols-2 text-xs text-fg-muted list-disc pl-4">
          {INCLUDED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-subtle">
          Never included: your password hash, OAuth tokens, API token secrets or push-notification keys. Inferred statuses are marked
          <code className="mx-1">verified: false</code>so you can tell them from what you confirmed.
        </p>
      </CardContent>
    </Card>
  );
}
