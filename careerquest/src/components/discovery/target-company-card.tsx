"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Dialog } from "@/components/ui";
import { deleteTargetCompanyAction } from "@/lib/discovery/actions";
import type { TargetCompanyView } from "@/lib/discovery/companies";
import { PRIORITY_LABELS } from "@/lib/discovery/schemas";
import { OutboundLink, hostLabel } from "./discovery-parts";
import { TargetCompanyForm } from "./target-company-form";
import { useDiscoveryForm } from "./use-discovery-form";

const PRIORITY_TONE = { 1: "gold", 2: "accent", 3: "neutral" } as const;

function DeleteCompany({ company, onClose }: { company: TargetCompanyView; onClose: () => void }) {
  const { pending, formProps } = useDiscoveryForm(deleteTargetCompanyAction, { onSuccess: onClose });
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="companyId" value={company.id} />
      <p className="text-sm text-fg-muted">
        Removes {company.name} from your target list. Your applications to it stay in the tracker. The XP you earned for adding it is taken back.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={pending}>
          Remove company
        </Button>
      </div>
    </form>
  );
}

export function TargetCompanyCard({ company, categories }: { company: TargetCompanyView; categories: readonly string[] }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const n = company.applicationCount;
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="break-words font-medium">{company.name}</h3>
            {company.category && <p className="text-xs text-fg-muted">{company.category}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge tone={PRIORITY_TONE[company.priority]}>{PRIORITY_LABELS[company.priority]} priority</Badge>
          </div>
        </div>
        <p className="text-sm">
          {n === 0 ? (
            <span className="text-fg-muted">No applications to this company in your tracker yet.</span>
          ) : (
            <Link href={company.applicationsHref} className="text-accent hover:underline tnum">
              {n} application{n === 1 ? "" : "s"} in your tracker
            </Link>
          )}
        </p>
        <div className="flex flex-col gap-1 text-xs sm:flex-row sm:flex-wrap sm:gap-x-4">
          {company.careersUrl && <OutboundLink href={company.careersUrl}>Careers: {hostLabel(company.careersUrl)}</OutboundLink>}
          {company.website && <OutboundLink href={company.website}>Website: {hostLabel(company.website)}</OutboundLink>}
        </div>
        {company.notes && <p className="whitespace-pre-line break-words text-sm text-fg-muted">{company.notes}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDialog("edit")} aria-label={`Edit ${company.name}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDialog("delete")} aria-label={`Remove ${company.name}`}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
          </Button>
        </div>
      </CardContent>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title={`Edit ${company.name}`} size="lg">
        {dialog === "edit" && <TargetCompanyForm company={company} categories={categories} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title={`Remove ${company.name}?`} size="sm">
        {dialog === "delete" && <DeleteCompany company={company} onClose={() => setDialog(null)} />}
      </Dialog>
    </Card>
  );
}
