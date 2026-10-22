"use client";

import { useCallback, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useToastForm } from "@/components/applications/use-toast-action";
import { importUrlsAction } from "@/lib/imports/actions";
import { MAX_URL_LINES } from "@/lib/imports/urls";
import { ImportSummary } from "./import-summary";
import { withUploadErrors } from "./safe-action";

const safeImportUrls = withUploadErrors(importUrlsAction);

function countLines(text: string): number {
  return text.split(/\r\n?|\n/).filter((l) => l.trim() && !l.trim().startsWith("#")).length;
}

/** Paste posting links (one per line, optional "| Company | Job title"); saved as leads or matched. */
export function UrlImportForm() {
  const [lines, setLines] = useState(0);
  const clearLines = useCallback(() => setLines(0), []);
  const { state, pending, formProps } = useToastForm(safeImportUrls, { onSuccess: clearLines });
  const [formKey, setFormKey] = useState(0);
  const tooMany = lines > MAX_URL_LINES;
  const fieldErrors = state && !state.ok ? state.fieldErrors?.urls : undefined;

  return (
    <div className="space-y-5">
      <form key={formKey} {...formProps} className="space-y-4">
        <Field
          label="Job posting links"
          htmlFor="job-urls"
          hint={lines ? `${lines} link${lines === 1 ? "" : "s"} (at most ${MAX_URL_LINES})` : `One per line, at most ${MAX_URL_LINES}.`}
          errors={tooMany ? [`Paste at most ${MAX_URL_LINES} links at a time.`] : fieldErrors}
        >
          <Textarea
            id="job-urls"
            name="urls"
            rows={8}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={"https://www.indeed.com/viewjob?jk=…\nhttps://boards.greenhouse.io/acme/jobs/123 | Acme Electric | Apprentice Electrician"}
            onChange={(e) => setLines(countLines(e.currentTarget.value))}
            aria-describedby="job-urls-format"
          />
        </Field>
        <p id="job-urls-format" className="text-xs text-fg-muted">
          Add <code className="text-fg">| Company | Job title</code> after a link to name it yourself. Otherwise the company and title are read
          from the link only where the site puts them in the address. Nothing is downloaded from these sites.
        </p>
        <Button type="submit" loading={pending} disabled={tooMany}>
          {!pending && <Link2 className="h-4 w-4" aria-hidden />}
          {pending ? "Importing…" : "Import links"}
        </Button>
      </form>
      {state?.ok && (
        <ImportSummary
          data={state.data}
          onReset={() => {
            setFormKey((k) => k + 1);
            clearLines();
          }}
        />
      )}
    </div>
  );
}
