import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { ELIGIBILITY_FLAG_LABELS, flagsOf } from "@/lib/discovery/eligibility";
import { MAX_PASTE_CHARS, parseSharePayload } from "@/lib/discovery/paste";
import { loadShareContext } from "@/lib/discovery/share";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OutboundLink, hostLabel } from "@/components/discovery/discovery-parts";
import { ShareCapture } from "@/components/share/share-capture";
import { SharePasteForm } from "@/components/share/share-paste-form";

export const metadata: Metadata = { title: "Capture a job" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Mobile capture: the PWA share target (GET ?title=&text=&url=, see public/manifest.webmanifest)
 * and a paste box when opened directly. Signed-in users only (the app layout gates it).
 */
export default async function SharePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/share");
  const sp = await searchParams;
  const title = first(sp.title).slice(0, 1000);
  const text = first(sp.text).slice(0, MAX_PASTE_CHARS);
  const url = first(sp.url).slice(0, 2048);
  const hasPayload = Boolean(title.trim() || text.trim() || url.trim());
  const draft = hasPayload ? parseSharePayload({ title, text, url }) : null;
  const context = draft ? await loadShareContext(user.id, draft) : null;
  const sharedText = [title, text].filter((s) => s.trim()).join("\n").slice(0, MAX_PASTE_CHARS);
  const flags = draft ? flagsOf(draft.flags) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Mobile capture"
        title="Capture a job"
        description="Share a posting from your phone, or paste it here. Nothing is saved until you tap one of the buttons."
      />

      {draft && context ? (
        <Card>
          <CardHeader className="flex-col sm:flex-row">
            <div className="min-w-0">
              <CardTitle>What was shared</CardTitle>
              <CardDescription>
                {draft.url ? (
                  <>
                    {SOURCE_LABELS[draft.platform]} · <OutboundLink href={draft.url}>{hostLabel(draft.url)}</OutboundLink>
                  </>
                ) : (
                  "No link found — add one below if you have it."
                )}
              </CardDescription>
            </div>
            {flags.length > 0 && (
              <ul className="flex flex-wrap gap-1" aria-label="Eligibility flags">
                {flags.map((f) => (
                  <li key={f}>
                    <Badge tone="warning">Flag: {ELIGIBILITY_FLAG_LABELS[f]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardHeader>
          <CardContent>
            {draft.detailsFrom !== "text" && (draft.company || draft.title) && (
              <Alert tone="info" className="mb-4" title="Company and title were read from the link">
                Check them before saving.
              </Alert>
            )}
            {!draft.company || !draft.title ? (
              <Alert tone="warning" className="mb-4" title="Add the company and job title">
                They could not be read from what was shared. Type them in to save to the tracker or as a lead.
              </Alert>
            ) : null}
            <ShareCapture
              fields={{
                url: draft.url ?? "",
                title: draft.title ?? "",
                company: draft.company ?? "",
                location: draft.location ?? "",
                salaryText: draft.salaryText ?? "",
              }}
              sharedText={sharedText}
              context={context}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{draft ? "Paste something else" : "Paste a job"}</CardTitle>
            <CardDescription>Copy a job link (or the posting text) from any app and paste it here.</CardDescription>
          </div>
          <Smartphone className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-4">
          <SharePasteForm />
          <div className="space-y-1 text-xs text-fg-muted">
            <p>
              <strong className="text-fg">Android (Chrome):</strong> install CareerQuest (menu → Install app), then use Share → CareerQuest
              from a job board app or the browser.
            </p>
            <p>
              <strong className="text-fg">iPhone / iPad:</strong> Safari&apos;s share sheet does not reliably list web apps, so copy the link and
              paste it here, or use an iOS Shortcut that opens this page with the link (see the project notes).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
