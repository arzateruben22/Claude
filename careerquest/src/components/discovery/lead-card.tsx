"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Dialog } from "@/components/ui";
import { convertLeadAction, deleteLeadAction, leadStatusAction } from "@/lib/discovery/actions";
import { ELIGIBILITY_FLAG_LABELS } from "@/lib/discovery/eligibility";
import type { LeadView } from "@/lib/discovery/leads";
import { CandidateChooser, FlagBadges, OutboundLink, ScoreBadge, ScoreBreakdown, hostLabel } from "./discovery-parts";
import { LeadEditForm } from "./lead-edit-form";
import { useDiscoveryForm } from "./use-discovery-form";

const STATUS_BADGE: Record<LeadView["status"], { label: string; tone: "neutral" | "info" | "success" | "accent" }> = {
  NEW: { label: "New", tone: "info" },
  SAVED: { label: "Kept", tone: "accent" },
  DISMISSED: { label: "Dismissed", tone: "neutral" },
  CONVERTED: { label: "In tracker", tone: "success" },
};

function ConvertControls({ lead }: { lead: LeadView }) {
  const { data, pending, submitter, formProps } = useDiscoveryForm(convertLeadAction);
  const candidates = data?.candidates;
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="leadId" value={lead.id} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {lead.status !== "CONVERTED" && (
          <Button type="submit" name="mode" value="saved" size="sm" loading={pending && submitter === "saved"} disabled={pending}>
            Convert to application
          </Button>
        )}
        <Button type="submit" name="mode" value="applied" size="sm" variant="secondary" loading={pending && submitter === "applied"} disabled={pending}>
          I already applied
        </Button>
      </div>
      {candidates && <CandidateChooser mode={data?.mode ?? "saved"} candidates={candidates} pending={pending} submitter={submitter} />}
      {data?.tone === "success" && data.href && (
        <p className="text-xs">
          <Link href={data.href} className="inline-flex items-center gap-1 text-accent hover:underline">
            {data.hrefLabel ?? "Open the application"} <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      )}
    </form>
  );
}

function StatusControls({ lead }: { lead: LeadView }) {
  const { pending, submitter, formProps } = useDiscoveryForm(leadStatusAction);
  if (lead.status === "CONVERTED") return null;
  return (
    <form {...formProps} className="flex flex-wrap gap-2">
      <input type="hidden" name="leadId" value={lead.id} />
      {lead.status === "NEW" && (
        <Button type="submit" name="status" value="SAVED" size="sm" variant="ghost" loading={pending && submitter === "SAVED"} disabled={pending}>
          Keep
        </Button>
      )}
      {lead.status === "DISMISSED" ? (
        <Button type="submit" name="status" value="NEW" size="sm" variant="ghost" loading={pending && submitter === "NEW"} disabled={pending}>
          Restore
        </Button>
      ) : (
        <Button type="submit" name="status" value="DISMISSED" size="sm" variant="ghost" loading={pending && submitter === "DISMISSED"} disabled={pending}>
          Dismiss
        </Button>
      )}
    </form>
  );
}

function DeleteLead({ lead, onClose }: { lead: LeadView; onClose: () => void }) {
  const { pending, formProps } = useDiscoveryForm(deleteLeadAction, { onSuccess: onClose });
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="leadId" value={lead.id} />
      <p className="text-sm text-fg-muted">
        This removes the lead from Job Discovery.{" "}
        {lead.convertedApplication ? "The application in your tracker is kept." : "Nothing in your tracker changes."}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={pending}>
          Delete lead
        </Button>
      </div>
    </form>
  );
}

export function LeadCard({ lead, categories }: { lead: LeadView; categories: readonly string[] }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const status = STATUS_BADGE[lead.status];
  const idPrefix = `lead-${lead.id}`;
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 id={`${idPrefix}-title`} className="break-words font-medium">
              {lead.title}
            </h3>
            <p className="break-words text-sm text-fg-muted">
              {lead.company}
              {lead.location ? ` · ${lead.location}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {lead.sourceLabel} · added {lead.addedLabel}
              {lead.salaryText ? ` · ${lead.salaryText}` : ""}
              {lead.category ? ` · ${lead.category}` : ""}
            </p>
            {lead.url && (
              <p className="mt-1 text-xs">
                <OutboundLink href={lead.url}>{hostLabel(lead.url)}</OutboundLink>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end" id={`${idPrefix}-score`}>
            <Badge tone={status.tone}>{status.label}</Badge>
            <ScoreBadge score={lead.score.score} />
          </div>
        </div>

        <FlagBadges flags={lead.flagList} hiddenBy={lead.hiddenBy} />
        {lead.hiddenBy.length > 0 && (lead.status === "NEW" || lead.status === "SAVED") && (
          <Alert tone="warning" title="Hidden by your private filters">
            Mentions {lead.hiddenBy.map((f) => ELIGIBILITY_FLAG_LABELS[f].toLowerCase()).join(", ")}. It stays here, only hidden from the main list.{" "}
            <Link href="/settings/eligibility" className="text-accent hover:underline">
              Change filters
            </Link>
          </Alert>
        )}
        {lead.notes && <p className="whitespace-pre-line break-words text-sm text-fg-muted">{lead.notes}</p>}
        <ScoreBreakdown score={lead.score} idPrefix={idPrefix} />

        {lead.convertedApplication && (
          <p className="text-sm">
            In your tracker:{" "}
            <Link href={`/applications/${lead.convertedApplication.id}`} className="text-accent hover:underline break-words">
              {lead.convertedApplication.label}
            </Link>{" "}
            <span className="text-fg-muted">({lead.convertedApplication.statusLabel})</span>
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-start sm:justify-between">
          {lead.status !== "DISMISSED" && <ConvertControls lead={lead} />}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <StatusControls lead={lead} />
            <Button type="button" size="sm" variant="ghost" onClick={() => setDialog("edit")} aria-label={`Edit ${lead.title} at ${lead.company}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDialog("delete")} aria-label={`Delete ${lead.title} at ${lead.company}`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Edit lead" description={`${lead.company} – ${lead.title}`} size="lg">
        {dialog === "edit" && <LeadEditForm lead={lead} categories={categories} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete this lead?" description={`${lead.company} – ${lead.title}`} size="sm">
        {dialog === "delete" && <DeleteLead lead={lead} onClose={() => setDialog(null)} />}
      </Dialog>
    </Card>
  );
}
