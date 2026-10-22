"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToastForm } from "@/components/applications/use-toast-action";
import { importEmailAction } from "@/lib/imports/actions";
import { ImportSummary } from "./import-summary";

const MAX_BYTES = 25 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload .eml/.mbox files or paste one raw email; results summarized below the form. */
export function EmailImportForm() {
  const [size, setSize] = useState(0);
  const [count, setCount] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const clearCounts = useCallback(() => {
    setCount(0);
    setSize(0);
  }, []);
  // Submitting through a transition keeps typed/pasted input when the server rejects the import.
  const { state, pending, formProps } = useToastForm(importEmailAction, { onSuccess: clearCounts });
  const tooLarge = size > MAX_BYTES;

  return (
    <div className="space-y-5">
      <form key={formKey} {...formProps} className="space-y-4">
        <Field
          label="Email files (.eml or .mbox)"
          htmlFor="email-files"
          hint={count ? `${count} file${count === 1 ? "" : "s"}, ${formatBytes(size)} of 25 MB` : "Up to 25 MB per import, up to 50 files."}
          errors={tooLarge ? ["The selected files are larger than 25 MB. Import them in smaller groups."] : undefined}
        >
          <Input
            id="email-files"
            name="files"
            type="file"
            multiple
            accept=".eml,.mbox,.mbx,message/rfc822,application/mbox"
            className="h-auto py-2 file:mr-3 file:rounded-ctl file:border-0 file:bg-surface-strong file:px-3 file:py-1 file:text-sm file:text-fg"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              setCount(files.length);
              setSize(files.reduce((n, f) => n + f.size, 0));
            }}
          />
        </Field>
        <Field label="…or paste the raw source of one email" htmlFor="email-paste" hint="Use “Show original” (Gmail) or “View message source” (Outlook) and paste everything, headers included.">
          <Textarea id="email-paste" name="pasted" rows={6} spellCheck={false} className="font-mono text-xs" placeholder={"From: …\nTo: …\nSubject: …\nDate: …\n\n…"} />
        </Field>
        <Button type="submit" loading={pending} disabled={tooLarge}>
          {!pending && <Upload className="h-4 w-4" aria-hidden />}
          {pending ? "Importing…" : "Import emails"}
        </Button>
      </form>
      {state?.ok && (
        <ImportSummary
          data={state.data}
          onReset={() => {
            setFormKey((k) => k + 1);
            clearCounts();
          }}
        />
      )}
    </div>
  );
}
