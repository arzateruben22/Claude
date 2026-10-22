/**
 * Server-render smoke tests for /integrations and /applications/import components: status badges with
 * visible text, honest capability matrices, connection controls, sync history, import results.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderCard } from "@/components/integrations/provider-card";
import { SyncRunsCard } from "@/components/integrations/sync-runs";
import { CapabilityMatrix } from "@/components/integrations/capability-matrix";
import { ConnectDialog } from "@/components/integrations/connect-dialog";
import { ImportSummary } from "@/components/imports/import-summary";
import { RecentImports } from "@/components/imports/recent-imports";
import { EmailImportForm } from "@/components/imports/email-import-form";
import { UrlImportForm } from "@/components/imports/url-import-form";
import { SpreadsheetImporter } from "@/components/imports/spreadsheet-importer";
import type { ConnectionView } from "@/lib/integrations/connections";
import type { ProviderOverview } from "@/lib/integrations/queries";
import { computeStatus, getProvider, type IntegrationEnv } from "@/lib/integrations/registry";
import type { ImportSummaryData } from "@/lib/imports/types";

const TZ = "America/Los_Angeles";
const ENV: IntegrationEnv = { GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s", APP_URL: "https://careerquest.test" };

function overview(key: string, env: IntegrationEnv, connections: ConnectionView[] = [], extension: { lastUsedAt: Date | null } | null = null): ProviderOverview {
  const entry = getProvider(key)!;
  const primary = connections[0] ?? null;
  const s = computeStatus(key, { env, connection: primary ? { status: primary.status, accountEmail: primary.accountEmail, lastError: primary.lastError } : null, extensionTokenUsage: extension });
  return { entry, status: s.status, reason: s.reason, connections, canConnect: key === "GMAIL" && !!env.GOOGLE_CLIENT_ID };
}

const conn: ConnectionView = {
  id: "11111111-2222-4333-8444-555555555555",
  provider: "GMAIL",
  accountEmail: "me@gmail.com",
  status: "CONNECTED",
  syncEnabled: true,
  lastSyncAt: "2026-10-21T19:30:00.000Z",
  lastError: "1 item could not be processed in the last sync.",
  historyDays: 90,
  scopes: [],
  createdAt: "2026-10-01T00:00:00.000Z",
};

describe("integrations UI", () => {
  it("shows a connected Gmail account with sync controls, last sync and last error", () => {
    const html = renderToStaticMarkup(createElement(ProviderCard, { overview: overview("GMAIL", ENV, [conn]), timezone: TZ }));
    expect(html).toContain('data-status="Connected"');
    expect(html).toContain("Connected as me@gmail.com");
    expect(html).toContain("Oct 21, 2026");
    expect(html).toContain("1 item could not be processed");
    expect(html).toContain("Sync now");
    expect(html).toContain("Disconnect");
    expect(html).toContain("Scheduled sync: on");
    expect(html).toContain("Connect another account");
    expect(html).toContain("Not live-verified.");
    expect(html).toContain('aria-label="Gmail capabilities"');
  });

  it("never shows Connected or a Connect button when the OAuth client is not configured", () => {
    const html = renderToStaticMarkup(createElement(ProviderCard, { overview: overview("GMAIL", { APP_URL: ENV.APP_URL }), timezone: TZ }));
    expect(html).toContain('data-status="Manual-only"');
    expect(html).toContain("OAuth client not configured — import .eml/.mbox files instead");
    expect(html).not.toContain("Connect Gmail");
    expect(html).not.toContain(">Connected<");
    expect(html).toContain('href="/applications/import"');
  });

  it("shows job boards as Manual-only with their capture paths and an honest matrix", () => {
    const html = renderToStaticMarkup(createElement(ProviderCard, { overview: overview("LINKEDIN", ENV), timezone: TZ }));
    expect(html).toContain('data-status="Manual-only"');
    expect(html).toContain("Job Applications.csv");
    expect(html).toContain('href="/applications/import/exports"');
    expect((html.match(/Not available/g) ?? []).length).toBe(4);
    expect(html).toContain("Supported");
  });

  it("explains Chrome extension setup and its real token usage", () => {
    const html = renderToStaticMarkup(
      createElement(ProviderCard, {
        overview: overview("CHROME_EXTENSION", ENV, [], null),
        timezone: TZ,
        extension: { activeTokens: 0, lastUsedAt: null },
      }),
    );
    expect(html).toContain('data-status="Available"');
    expect(html).toContain('href="/settings/tokens"');
    expect(html).toContain("extension/README.md");
    expect(html).toContain("No active developer tokens yet.");
  });

  it("renders the capability matrix with visible levels", () => {
    const html = renderToStaticMarkup(createElement(CapabilityMatrix, { capabilities: getProvider("GREENHOUSE")!.capabilities, providerName: "Greenhouse" }));
    expect(html).toContain("Job details");
    expect(html).toContain("Experimental");
  });

  it("renders sync history and its empty state", () => {
    const empty = renderToStaticMarkup(createElement(SyncRunsCard, { runs: [], timezone: TZ }));
    expect(empty).toContain("No syncs yet");
    const html = renderToStaticMarkup(
      createElement(SyncRunsCard, {
        runs: [
          {
            id: "r1",
            connectionId: conn.id,
            provider: "GMAIL",
            accountEmail: "me@gmail.com",
            startedAt: "2026-10-21T19:30:00.000Z",
            finishedAt: "2026-10-21T19:31:00.000Z",
            status: "PARTIAL",
            scanned: 120,
            matched: 4,
            created: 3,
            updated: 1,
            issues: [
              { code: "MESSAGE_FAILED", message: "Not found at the provider.", ref: "abc" },
              { code: "CAP_REACHED", message: "Stopped after 500 messages." },
            ],
          },
        ],
        timezone: TZ,
      }),
    );
    expect(html).toContain("Partial");
    expect(html).toContain(">120<");
    expect(html).toContain("1 problem");
    expect(html).toContain("Stopped after 500 messages.");
  });

  it("renders the consent trigger (dialog content mounts on the client)", () => {
    const html = renderToStaticMarkup(createElement(ConnectDialog, { provider: "GMAIL", label: "Connect Gmail" }));
    expect(html).toContain("Connect Gmail");
  });
});

const summary: ImportSummaryData = {
  batchId: "b1",
  kind: "CSV",
  fileName: "tracker.csv",
  status: "PARTIAL",
  totals: { total: 6, created: 3, updated: 1, duplicate: 1, needsReview: 0, ignored: 0, errors: 1 },
  issues: [
    { row: 8, type: "error", message: "Job title is empty." },
    { row: 3, type: "warning", message: "The posting URL is not a valid web address and was skipped." },
  ],
  issuesTruncated: false,
  message: "Import finished",
  reviewQueue: false,
  unit: "row",
};

describe("import UI", () => {
  it("summarizes an import with totals and row-level problems", () => {
    const html = renderToStaticMarkup(createElement(ImportSummary, { data: summary }));
    expect(html).toContain("Completed with problems");
    expect(html).toContain("Row 8: Job title is empty.");
    expect(html).toContain("Already tracked");
    expect(html).toContain('href="/applications"');
    expect(html).not.toContain("/applications/review");
    const email = renderToStaticMarkup(createElement(ImportSummary, { data: { ...summary, kind: "EML", unit: "message", reviewQueue: true, totals: { ...summary.totals, needsReview: 2 } } }));
    expect(email).toContain("Open review queue (2)");
    const emailNone = renderToStaticMarkup(createElement(ImportSummary, { data: { ...summary, kind: "EML", unit: "message", reviewQueue: true } }));
    expect(emailNone).toContain('href="/applications/review"');
  });

  it("lists recent imports and says so when there are none", () => {
    expect(renderToStaticMarkup(createElement(RecentImports, { batches: [], timezone: TZ }))).toContain("Nothing imported here yet.");
    const html = renderToStaticMarkup(
      createElement(RecentImports, {
        batches: [{ id: "b1", kind: "PLATFORM_EXPORT", fileName: "Job Applications.csv", status: "SUCCEEDED", createdAt: "2026-10-21T19:30:00.000Z", totals: summary.totals, problemCount: 0 }],
        timezone: TZ,
      }),
    );
    expect(html).toContain("Job Applications.csv");
    expect(html).toContain("Platform export");
    expect(html).toContain("3 new, 1 updated, 1 already tracked, 1 error");
  });

  it("renders the import forms with labeled inputs", () => {
    const email = renderToStaticMarkup(createElement(EmailImportForm));
    expect(email).toContain('for="email-files"');
    expect(email).toContain('accept=".eml,.mbox,.mbx,message/rfc822,application/mbox"');
    expect(email).toContain('for="email-paste"');
    const urls = renderToStaticMarkup(createElement(UrlImportForm));
    expect(urls).toContain('for="job-urls"');
    const sheet = renderToStaticMarkup(createElement(SpreadsheetImporter, { preset: "linkedin", presetChoices: ["linkedin", "ats"] }));
    expect(sheet).toContain("LinkedIn data export (Job Applications.csv)");
    expect(sheet).toContain("Applicant-tracking system export");
    expect(sheet).toContain(".csv,.tsv,.xlsx");
  });
});
