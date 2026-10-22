"use client";

import { useCallback, useId, useState } from "react";
import { Upload } from "lucide-react";
import type { DocumentKind } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Label, Select } from "@/components/ui/input";
import { uploadDocumentAction } from "@/lib/documents/actions";
import { ACCEPT_ATTRIBUTE, ALLOWED_TYPES_LABEL, DOCUMENT_KIND_LABELS, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_LABEL } from "@/lib/documents/validation";
import { UPLOAD_TRANSPORT_ERROR, useRecordsAction } from "./use-records-action";

/** Upload a document (validated again on the server by size, extension and magic bytes). */
export function DocumentUploadForm({ kinds, defaultKind }: { kinds: readonly DocumentKind[]; defaultKind?: DocumentKind }) {
  const uid = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const onSuccess = useCallback(() => setHasFile(false), []);
  const [state, action, pending] = useRecordsAction(uploadDocumentAction, { onSuccess, transportErrorMessage: UPLOAD_TRANSPORT_ERROR });
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end" noValidate>
      <div className="min-w-0">
        <Label htmlFor={`${uid}-file`}>File</Label>
        <input
          id={`${uid}-file`}
          name="file"
          type="file"
          required
          accept={ACCEPT_ATTRIBUTE}
          className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-ctl file:border-0 file:bg-surface-strong file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-surface-hover"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f && f.size > MAX_DOCUMENT_BYTES) {
              setFileError(`That file is larger than ${MAX_DOCUMENT_LABEL}.`);
              e.currentTarget.value = "";
              setHasFile(false);
              return;
            }
            setFileError(null);
            setHasFile(Boolean(f));
          }}
        />
        <p className="mt-1 text-xs text-fg-subtle">
          {ALLOWED_TYPES_LABEL}, up to {MAX_DOCUMENT_LABEL}. Only you can download it.
        </p>
        <FieldError errors={fileError ? [fileError] : errors?.file} />
      </div>
      <Field label="Kind" htmlFor={`${uid}-kind`} errors={errors?.kind}>
        <Select id={`${uid}-kind`} name="kind" defaultValue={defaultKind ?? kinds[0]}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" loading={pending} disabled={!hasFile}>
        {!pending && <Upload className="h-4 w-4" aria-hidden />}
        Upload
      </Button>
    </form>
  );
}
