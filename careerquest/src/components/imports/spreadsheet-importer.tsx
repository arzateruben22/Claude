"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { analyzeSpreadsheetAction, importSpreadsheetAction } from "@/lib/imports/actions";
import {
  FIELD_HINTS,
  FIELD_LABELS,
  OBSERVATION_KIND_LABELS,
  REQUIRED_FIELDS,
  mappingProblems,
  validateRow,
  type ColumnMapping,
  type ImportField,
  type RowValidation,
} from "@/lib/imports/mapping";
import { PRESETS, type PresetId } from "@/lib/imports/presets";
import type { AnalyzeData, ImportSummaryData } from "@/lib/imports/types";
import { ImportSummary } from "./import-summary";
import { UPLOAD_FAILED, isNavigationError } from "./safe-action";

const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  /** Initial preset. */
  preset: PresetId;
  /** Presets the user can switch between (exports tab). */
  presetChoices?: PresetId[];
};

function hostOf(url: string | null): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

/**
 * Upload → server parse (header detection, personal-data columns dropped) → column mapping with
 * auto-suggestions → live preview of the first 20 rows validated with the same code the server runs →
 * import. The file stays in the browser between steps and is re-sent (and fully re-validated) on import.
 */
export function SpreadsheetImporter({ preset: initialPreset, presetChoices }: Props) {
  const toast = useToast();
  const [preset, setPreset] = useState<PresetId>(initialPreset);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummaryData | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [analyzing, startAnalyze] = useTransition();
  const [importing, startImport] = useTransition();

  const presetInfo = PRESETS[preset];

  function analyze(f: File, p: PresetId) {
    setError(null);
    setResult(null);
    setAnalysis(null);
    if (f.size > MAX_BYTES) {
      setError("The file is larger than 10 MB. Split it and import each part.");
      return;
    }
    startAnalyze(async () => {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("preset", p);
      try {
        const res = await analyzeSpreadsheetAction(null, fd);
        if (res.ok) {
          setAnalysis(res.data);
          setMapping(res.data.suggested);
        } else {
          setError(res.error);
        }
      } catch (err) {
        if (isNavigationError(err)) throw err;
        setError(UPLOAD_FAILED);
      }
    });
  }

  function runImport() {
    if (!file || !analysis) return;
    startImport(async () => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("preset", preset);
      fd.set("mapping", JSON.stringify(mapping));
      try {
        const res = await importSpreadsheetAction(null, fd);
        if (res.ok) {
          setResult(res.data);
          toast.push({ tone: res.data.status === "FAILED" ? "danger" : "success", title: res.data.message });
        } else {
          setError(res.error);
          toast.push({ tone: "danger", title: res.error });
        }
      } catch (err) {
        if (isNavigationError(err)) throw err;
        setError(UPLOAD_FAILED);
      }
    });
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setMapping({});
    setResult(null);
    setError(null);
    setInputKey((k) => k + 1);
  }

  const problems = analysis ? mappingProblems(mapping, analysis.headers.length) : [];
  const validations: RowValidation[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.previewRows.map((r) =>
      validateRow(r.cells, mapping, r.rowNumber, { todayKey: analysis.todayKey, defaultPlatform: PRESETS[analysis.preset].defaultPlatform }),
    );
  }, [analysis, mapping]);
  const previewErrors = validations.filter((v) => v.errors.length).length;

  if (result) return <ImportSummary data={result} onReset={reset} />;

  return (
    <div className="space-y-5">
      {presetChoices && presetChoices.length > 1 && (
        <fieldset>
          <legend className="text-xs font-medium text-fg-muted mb-1.5">What are you importing?</legend>
          <div className="flex flex-wrap gap-2">
            {presetChoices.map((id) => (
              <label
                key={id}
                className="inline-flex items-center gap-2 rounded-ctl border border-line px-3 py-2 text-sm cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="preset"
                  value={id}
                  checked={preset === id}
                  onChange={() => {
                    setPreset(id);
                    if (file) analyze(file, id);
                  }}
                  className="accent-[var(--accent)]"
                />
                {PRESETS[id].name}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-fg-muted">{presetInfo.description}</p>
        </fieldset>
      )}

      <Field label="Spreadsheet (.csv, .tsv or .xlsx)" htmlFor={`sheet-${preset}`} hint="Up to 10 MB and 5,000 rows. The first worksheet of an .xlsx is used.">
        <Input
          key={inputKey}
          id={`sheet-${preset}`}
          type="file"
          accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="h-auto py-2 file:mr-3 file:rounded-ctl file:border-0 file:bg-surface-strong file:px-3 file:py-1 file:text-sm file:text-fg"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0] ?? null;
            setFile(f);
            if (f) analyze(f, preset);
            else reset();
          }}
        />
      </Field>

      {analyzing && (
        <p className="text-sm text-fg-muted" role="status">
          Reading the file…
        </p>
      )}
      {error && (
        <Alert tone="danger" title="Cannot import this file">
          {error}
        </Alert>
      )}

      {analysis && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-fg-muted" aria-hidden />
            <span className="font-medium break-all">{analysis.fileName}</span>
            <Badge>{analysis.rowCount.toLocaleString("en-US")} rows</Badge>
            <span className="text-xs text-fg-muted">Header found on row {analysis.headerRowNumber}</span>
          </div>
          {analysis.droppedHeaders.length > 0 && (
            <Alert tone="info" title="Personal-data columns left out">
              These columns are never shown or stored: {analysis.droppedHeaders.join(", ")}.
            </Alert>
          )}
          {analysis.warnings.map((w) => (
            <Alert key={w} tone="warning">
              {w}
            </Alert>
          ))}

          <section aria-labelledby="mapping-title" className="space-y-3">
            <h2 id="mapping-title" className="text-sm font-semibold">
              Match your columns
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {presetInfo.allowedFields.map((field) => (
                <MappingSelect
                  key={field}
                  field={field}
                  headers={analysis.headers}
                  value={mapping[field]}
                  onChange={(col) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (col === undefined) delete next[field];
                      else next[field] = col;
                      return next;
                    })
                  }
                />
              ))}
            </div>
            {problems.length > 0 && (
              <ul className="text-sm text-danger space-y-0.5" role="alert">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </section>

          {problems.length === 0 && (
            <section aria-labelledby="preview-title" className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="preview-title" className="text-sm font-semibold">
                  Preview (first {validations.length} of {analysis.rowCount.toLocaleString("en-US")} rows)
                </h2>
                <p className="text-xs text-fg-muted">
                  {previewErrors ? `${previewErrors} row${previewErrors === 1 ? "" : "s"} with errors will be skipped.` : "No errors in these rows."}
                </p>
              </div>
              <PreviewTable rows={validations} />
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runImport} loading={importing} disabled={problems.length > 0 || analyzing}>
              {importing ? "Importing…" : `Import ${analysis.rowCount.toLocaleString("en-US")} rows`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={importing}>
              Choose another file
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            Re-importing the same file adds nothing new: each row is fingerprinted, and rows already imported are reported as already
            tracked.
          </p>
        </>
      )}
    </div>
  );
}

function MappingSelect({
  field,
  headers,
  value,
  onChange,
}: {
  field: ImportField;
  headers: string[];
  value: number | undefined;
  onChange: (col: number | undefined) => void;
}) {
  const id = `map-${field}`;
  const required = REQUIRED_FIELDS.includes(field);
  return (
    <div>
      <Label htmlFor={id}>
        {FIELD_LABELS[field]}
        {required ? <span className="text-danger"> *</span> : <span className="text-fg-subtle"> (optional)</span>}
      </Label>
      <Select
        id={id}
        value={value === undefined ? "" : String(value)}
        required={required}
        onChange={(e) => onChange(e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value))}
      >
        <option value="">— Not mapped —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </Select>
      {FIELD_HINTS[field] && <p className="mt-1 text-xs text-fg-subtle">{FIELD_HINTS[field]}</p>}
    </div>
  );
}

function PreviewTable({ rows }: { rows: RowValidation[] }) {
  return (
    <div className="overflow-x-auto rounded-ctl border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Preview of the rows to import, with validation results</caption>
        <thead className="bg-surface">
          <tr className="text-left text-xs text-fg-muted">
            <th scope="col" className="py-2 px-2 font-medium">Row</th>
            <th scope="col" className="py-2 px-2 font-medium">Check</th>
            <th scope="col" className="py-2 px-2 font-medium">Company</th>
            <th scope="col" className="py-2 px-2 font-medium">Job title</th>
            <th scope="col" className="py-2 px-2 font-medium">Applied</th>
            <th scope="col" className="py-2 px-2 font-medium">Imported as</th>
            <th scope="col" className="py-2 px-2 font-medium">Link</th>
            <th scope="col" className="py-2 px-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = r.value;
            const state = r.blank ? "blank" : r.errors.length ? "error" : r.warnings.length ? "warning" : "ok";
            return (
              <tr key={r.rowNumber} className="border-t border-line align-top">
                <td className="py-2 px-2 tnum text-fg-muted">{r.rowNumber}</td>
                <td className="py-2 px-2 whitespace-nowrap">
                  {state === "ok" && (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> OK
                    </span>
                  )}
                  {state === "warning" && (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Warning
                    </span>
                  )}
                  {state === "error" && (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> Error
                    </span>
                  )}
                  {state === "blank" && <span className="text-fg-subtle">Blank</span>}
                </td>
                <td className="py-2 px-2 break-words max-w-[12rem]">{v?.company ?? "—"}</td>
                <td className="py-2 px-2 break-words max-w-[14rem]">{v?.title ?? "—"}</td>
                <td className="py-2 px-2 whitespace-nowrap tnum">{v?.appliedDay ?? "—"}</td>
                <td className="py-2 px-2 whitespace-nowrap">{v ? OBSERVATION_KIND_LABELS[v.kind] : "—"}</td>
                <td className="py-2 px-2 whitespace-nowrap text-fg-muted">{hostOf(v?.postingUrl ?? null)}</td>
                <td className="py-2 px-2 text-xs max-w-[18rem]">
                  {[...r.errors.map((e) => ({ t: "e", m: e })), ...r.warnings.map((w) => ({ t: "w", m: w }))].map((x, i) => (
                    <p key={i} className={x.t === "e" ? "text-danger" : "text-warning"}>
                      {x.m}
                    </p>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
