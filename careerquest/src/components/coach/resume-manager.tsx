"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { FileText, Pencil, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { deleteResumeAction, saveResumeAction, setDefaultResumeAction } from "@/lib/coach/actions";
import type { ResumeListItem } from "@/lib/coach/resumes";

function ResultLine({ state }: { state: Awaited<ReturnType<typeof saveResumeAction>> | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-xs text-success" role="status">
      {state.data.message}
    </p>
  ) : !state.fieldErrors ? (
    <p className="text-xs text-danger" role="alert">
      {state.error}
    </p>
  ) : null;
}

export function ResumeForm({ resume, onlyOne }: { resume?: ResumeListItem; onlyOne?: boolean }) {
  const [state, action, pending] = useActionState(saveResumeAction, null);
  const nameId = useId();
  const contentId = useId();
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-3">
      {resume && <input type="hidden" name="id" value={resume.id} />}
      <Field label="Version name" htmlFor={nameId} errors={errors?.name} hint="For example: Electrical apprentice, or Construction coordinator.">
        <Input id={nameId} name="name" required maxLength={120} defaultValue={resume?.name ?? ""} aria-invalid={errors?.name ? true : undefined} />
      </Field>
      <Field label="Résumé text" htmlFor={contentId} errors={errors?.content} hint="Paste the plain text of the résumé you send. The Advisor only reuses what it says.">
        <Textarea
          id={contentId}
          name="content"
          required
          rows={14}
          maxLength={50000}
          defaultValue={resume?.content ?? ""}
          className="font-mono text-xs leading-relaxed"
          aria-invalid={errors?.content ? true : undefined}
        />
      </Field>
      {!resume?.isDefault && <Checkbox name="isDefault" label={onlyOne ? "Make this my default (your first résumé becomes the default automatically)" : "Make this my default résumé"} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {resume ? "Save changes" : "Save résumé"}
        </Button>
        {resume && (
          <Link href="/coach/resumes" className={buttonClasses("ghost", "md")}>
            Done
          </Link>
        )}
        <ResultLine state={state} />
      </div>
    </form>
  );
}

function ResumeCard({ resume, timeZone }: { resume: ResumeListItem; timeZone: string }) {
  const [defState, defAction, defPending] = useActionState(setDefaultResumeAction, null);
  const [delState, delAction, delPending] = useActionState(deleteResumeAction, null);
  const updated = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(resume.updatedAt));
  return (
    <li className="rounded-card border border-line bg-surface p-4" data-testid="resume-version">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
            <FileText className="h-4 w-4 text-fg-subtle" aria-hidden />
            {resume.name}
            {resume.isDefault && <Badge tone="success">Default</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Updated {updated} · used on {resume.applicationCount} application{resume.applicationCount === 1 ? "" : "s"} · {resume.content.length.toLocaleString("en-US")} characters
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/coach/resumes?edit=${resume.id}`} className={buttonClasses("secondary", "sm")}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Link>
          {!resume.isDefault && (
            <form action={defAction}>
              <input type="hidden" name="id" value={resume.id} />
              <Button type="submit" variant="ghost" size="sm" loading={defPending}>
                {!defPending && <Star className="h-3.5 w-3.5" aria-hidden />}
                Make default
              </Button>
            </form>
          )}
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-accent hover:underline">Preview text</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-ctl bg-bg-elevated p-3 font-mono text-[11px] text-fg-muted">{resume.content}</pre>
      </details>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-fg-subtle hover:text-danger">Delete…</summary>
        <form action={delAction} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="id" value={resume.id} />
          <span className="text-fg-muted">
            {resume.applicationCount > 0
              ? `${resume.applicationCount} application${resume.applicationCount === 1 ? "" : "s"} will show "Deleted résumé" in résumé analytics.`
              : "This can't be undone."}
          </span>
          <Button type="submit" variant="danger" size="sm" loading={delPending}>
            {!delPending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            Delete this version
          </Button>
        </form>
      </details>
      {[defState, delState].map((s, i) => (s && !s.ok ? <p key={i} className="mt-2 text-xs text-danger" role="alert">{s.error}</p> : null))}
    </li>
  );
}

export function ResumeManager({ resumes, editing, timeZone }: { resumes: ResumeListItem[]; editing: ResumeListItem | null; timeZone: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{editing ? `Edit "${editing.name}"` : "Add a résumé version"}</CardTitle>
              <CardDescription>
                {editing
                  ? "Saving updates this version everywhere it's used."
                  : "Keep one version per kind of role you target. Applications can record which version you sent, and Analytics compares their response rates."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ResumeForm key={editing?.id ?? "new"} resume={editing ?? undefined} onlyOne={resumes.length === 0} />
          </CardContent>
        </Card>
      </div>
      <div className="min-w-0 lg:col-span-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your résumé versions</CardTitle>
              <CardDescription>The most recently updated version is the one the Advisor tailors from.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {resumes.length === 0 ? (
              <Alert tone="info" title="No résumé saved yet">
                Paste your résumé on the left. Tailoring, cover-letter drafts and résumé analytics need at least one version.
              </Alert>
            ) : (
              <ul className="space-y-3">
                {resumes.map((r) => (
                  <ResumeCard key={r.id} resume={r} timeZone={timeZone} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
