import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Lock, Target } from "lucide-react";
import type { ContentSource } from "@/lib/academy/schema";
import type { LessonView } from "@/lib/academy/progress";
import { buttonClasses } from "@/components/ui/button";
import { LessonStateBadge } from "./badges";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-fg-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-fg">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Objectives({ objectives }: { objectives: string[] }) {
  if (!objectives.length) return null;
  return (
    <section aria-labelledby="lesson-objectives" className="glass rounded-card p-5">
      <h2 id="lesson-objectives" className="flex items-center gap-2 text-sm font-medium">
        <Target className="h-4 w-4 text-accent" aria-hidden />
        What you will be able to do
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-fg-muted">
        {objectives.map((o, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <span>{o}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourcesList({ sources }: { sources: ContentSource[] }) {
  if (!sources.length) return null;
  return (
    <section aria-labelledby="lesson-sources" className="space-y-2">
      <h2 id="lesson-sources" className="text-sm font-medium">
        Sources
      </h2>
      <ul className="space-y-1.5 text-sm">
        {sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-accent hover:underline">
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{s.title}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-subtle">NEC references are cited by article and section number only. Confirm against the code edition your jurisdiction has adopted.</p>
    </section>
  );
}

export function LockedLessonPanel({ lessonKey, missing }: { lessonKey: string; missing: LessonView["missing"] }) {
  return (
    <section aria-labelledby="locked-title" className="glass rounded-card p-5">
      <h2 id="locked-title" className="flex items-center gap-2 text-sm font-medium">
        <Lock className="h-4 w-4 text-fg-muted" aria-hidden />
        This lesson unlocks after its prerequisites
      </h2>
      <p className="mt-1 text-sm text-fg-muted">Pass the quiz in each of these lessons first:</p>
      <ul className="mt-3 space-y-2">
        {missing.map((m) => (
          <li key={m.key}>
            <Link href={`/academy/lessons/${m.key}`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
              {m.title}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/academy/lessons/${lessonKey}?preview=1`} className={buttonClasses("secondary", "sm")}>
          Preview the lesson anyway
        </Link>
        <Link href="/academy" className={buttonClasses("ghost", "sm")}>
          All lessons
        </Link>
      </div>
      <p className="mt-3 text-xs text-fg-subtle">A preview does not start the lesson, and the quiz stays locked until the prerequisites are complete.</p>
    </section>
  );
}

export function TrackNav({ lessons, current }: { lessons: { key: string; title: string; state: LessonView["state"] }[]; current: string }) {
  const idx = lessons.findIndex((l) => l.key === current);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <nav aria-label="Lessons in this track" className="grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={`/academy/lessons/${prev.key}`} className="glass rounded-card p-4 hover:bg-surface-hover">
          <span className="flex items-center gap-1 text-xs text-fg-muted">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Previous
          </span>
          <span className="mt-1 block text-sm font-medium">{prev.title}</span>
          <LessonStateBadge state={prev.state} className="mt-2" />
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`/academy/lessons/${next.key}`} className="glass rounded-card p-4 text-right hover:bg-surface-hover">
          <span className="flex items-center justify-end gap-1 text-xs text-fg-muted">
            Next <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="mt-1 block text-sm font-medium">{next.title}</span>
          <LessonStateBadge state={next.state} className="mt-2" />
        </Link>
      )}
    </nav>
  );
}
