"use client";

import { useCallback, useId, useState } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Label, Select } from "@/components/ui/input";
import { removeCertificationVerificationAction, verifyCertificationAction } from "@/lib/academy/certification/actions";
import { VERIFIED_CERT_LABEL } from "@/lib/academy/certification/constants";
import { ACCEPT_ATTRIBUTE, ALLOWED_TYPES_LABEL, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_LABEL, documentHref } from "@/lib/documents/validation";
import { UPLOAD_TRANSPORT_ERROR, useRecordsAction } from "./use-records-action";

type Verification = { documentId: string; fileName: string; verifiedAtLabel: string } | null;

/**
 * "Verified certification": needs a recorded certification date plus an attached CERTIFICATE
 * document. Always labelled as self-attested — CareerQuest does not check state records.
 */
export function VerifyCertification({
  classification,
  classificationName,
  certifiedAtLabel,
  verification,
  certificates,
  xpReward,
}: {
  classification: string;
  classificationName: string;
  certifiedAtLabel: string | null;
  verification: Verification;
  certificates: { id: string; fileName: string }[];
  xpReward: number;
}) {
  const uid = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const onSuccess = useCallback(() => setFileName(null), []);
  const [state, action, pending] = useRecordsAction(verifyCertificationAction, { onSuccess, transportErrorMessage: UPLOAD_TRANSPORT_ERROR });
  const [, removeAction, removing] = useRecordsAction(removeCertificationVerificationAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (verification) {
    return (
      <div className="space-y-3" data-testid="certification-verified">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <BadgeCheck className="h-5 w-5" aria-hidden />
          Verified certification — {classificationName}
        </p>
        <p className="text-xs text-fg-muted">{VERIFIED_CERT_LABEL}.</p>
        <p className="text-sm">
          Document:{" "}
          <a href={documentHref(verification.documentId)} download className="text-accent hover:underline">
            {verification.fileName}
          </a>{" "}
          <span className="text-xs text-fg-subtle">· marked {verification.verifiedAtLabel}</span>
        </p>
        <form action={removeAction}>
          <input type="hidden" name="classification" value={classification} />
          <Button type="submit" variant="ghost" size="sm" loading={removing}>
            Remove verified mark
          </Button>
        </form>
      </div>
    );
  }

  if (!certifiedAtLabel) {
    return (
      <p className="flex items-start gap-2 text-sm text-fg-muted">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
        Record the date you were certified on the timeline first. Then attach your certificate to mark it verified (self-attested with
        document).
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="classification" value={classification} />
      <p className="text-sm text-fg-muted">
        Certified on {certifiedAtLabel} (self-reported). Attach the certificate to mark it verified — {VERIFIED_CERT_LABEL.toLowerCase()}. +{xpReward} XP
        once.
      </p>
      {certificates.length > 0 && (
        <Field label="Use an uploaded certificate" htmlFor={`${uid}-doc`} errors={errors?.documentId}>
          <Select id={`${uid}-doc`} name="documentId" defaultValue="" disabled={Boolean(fileName)}>
            <option value="">Choose…</option>
            {certificates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fileName}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div>
        <Label htmlFor={`${uid}-file`}>{certificates.length > 0 ? "…or upload the certificate" : "Upload the certificate"}</Label>
        <input
          id={`${uid}-file`}
          name="file"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-ctl file:border-0 file:bg-surface-strong file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-surface-hover"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f && f.size > MAX_DOCUMENT_BYTES) {
              setFileError(`That file is larger than ${MAX_DOCUMENT_LABEL}.`);
              e.currentTarget.value = "";
              setFileName(null);
              return;
            }
            setFileError(null);
            setFileName(f ? f.name : null);
          }}
        />
        <p className="mt-1 text-xs text-fg-subtle">
          {ALLOWED_TYPES_LABEL}, up to {MAX_DOCUMENT_LABEL}. Stored as a Certificate document only you can download.
        </p>
        <FieldError errors={fileError ? [fileError] : errors?.file} />
      </div>
      <Button type="submit" variant="gold" loading={pending}>
        Mark certification verified
      </Button>
    </form>
  );
}
