import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpenCheck, ClipboardCheck, Clock, FlaskConical, GraduationCap, Hammer, Lock, Map as MapIcon, ScrollText, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClasses } from "@/components/ui/button";
import type { AcademyOverview } from "@/lib/academy/service";
import type { LessonView, TrackView } from "@/lib/academy/progress";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LessonStateBadge } from "./badges";

export function AcademyStats({ stats }: { stats: AcademyOverview["stats"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="glass rounded-card p-4 col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-fg-muted">Electrician level</p>
          <GraduationCap className="h-4 w-4 text-gold" aria-hidden />
        </div>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-gold tnum" data-testid="electrician-level">
          Lv {stats.level}
        </p>
        <ProgressBar value={stats.levelProgress} max={1} tone="gold" className="mt-2" label={`Progress to Electrician level ${stats.level + 1}`} />
        <p className="mt-1 text-xs text-fg-subtle tnum">
          {formatNumber(stats.electricianXp)} Electrician XP · {formatNumber(Math.max(0, stats.xpIntoLevel))} / {formatNumber(stats.xpForNextLevel)} to Lv{" "}
          {stats.level + 1}
        </p>
      </div>
      <Tile
        label="Lessons completed"
        value={`${stats.lessonsCompleted} / ${stats.lessonsTotal}`}
        hint={stats.lessonsInProgress ? `${stats.lessonsInProgress} in progress` : "Pass a lesson quiz to complete it"}
        icon={<BookOpenCheck className="h-4 w-4" aria-hidden />}
      />
      <Tile
        label="Practice exams passed"
        value={stats.examAttempts ? `${stats.examsPassed} / ${stats.examAttempts}` : "—"}
        hint={stats.bestExamPercent !== null ? `Best score ${stats.bestExamPercent}%` : "No practice exam taken yet"}
        icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
      />
      <Tile
        label="Bench exercises cleared"
        value={`${stats.workshopsCleared} / ${stats.workshopsTotal}`}
        hint="Simulation — not field experience"
        icon={<FlaskConical className="h-4 w-4" aria-hidden />}
      />
    </div>
  );
}

function Tile({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <div className="glass rounded-card p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-fg-muted">{label}</p>
        <span className="text-fg-subtle">{icon}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tnum">{value}</p>
      <p className="mt-1 text-xs text-fg-subtle">{hint}</p>
    </div>
  );
}

const LINKS = [
  { href: "/academy/roadmap", label: "Certification roadmap", description: "Hours, fees, exam facts and how the credentials differ.", Icon: MapIcon },
  { href: "/academy/workshop", label: "Simulated workshop", description: "Virtual bench and meter. Simulation — not field experience.", Icon: Hammer },
  { href: "/academy/exam", label: "Practice exam", description: "Randomized 25 or 50 question exams graded by area.", Icon: Timer },
  { href: "/academy/apprenticeships", label: "Apprenticeships", description: "Electrical apprenticeship programs.", Icon: ScrollText },
  { href: "/academy/hours", label: "Training hours", description: "Your on-the-job and classroom hour log.", Icon: Clock },
  { href: "/academy/certification", label: "Certification", description: "Your trainee registration and certification status.", Icon: ClipboardCheck },
];

export function AcademyQuickLinks() {
  return (
    <nav aria-label="Academy tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {LINKS.map(({ href, label, description, Icon }) => (
        <Link key={href} href={href} className="glass group flex items-start gap-3 rounded-card p-4 transition-colors hover:bg-surface-hover">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-medium">
              {label}
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
            <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function NextLessonCard({ lesson }: { lesson: LessonView | null }) {
  if (!lesson) {
    return (
      <div className="glass rounded-card p-5">
        <p className="text-sm font-medium">Every available lesson is complete</p>
        <p className="mt-1 text-sm text-fg-muted">Keep your knowledge sharp with a practice exam or a bench exercise.</p>
      </div>
    );
  }
  return (
    <div className="glass rounded-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-accent">{lesson.state === "IN_PROGRESS" ? "Continue learning" : "Up next"}</p>
        <p className="mt-1 font-medium">{lesson.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{lesson.summary}</p>
      </div>
      <Link href={`/academy/lessons/${lesson.key}`} className={buttonClasses("primary", "md", "shrink-0")}>
        {lesson.state === "IN_PROGRESS" ? "Continue" : "Start lesson"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

export function TrackSection({ track }: { track: TrackView }) {
  if (!track.lessons.length) return null;
  const headingId = `track-${track.key.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">
            {track.label}
          </h2>
          <p className="text-sm text-fg-muted">{track.description}</p>
        </div>
        <div className="w-full sm:w-56 shrink-0">
          <p className="text-right text-xs text-fg-muted tnum">
            {track.completed} of {track.total} completed
          </p>
          <ProgressBar value={track.completed} max={track.total} tone="success" className="mt-1" label={`${track.label} progress`} />
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {track.lessons.map((l) => (
          <li key={l.key}>
            <LessonCard lesson={l} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LessonCard({ lesson }: { lesson: LessonView }) {
  const locked = lesson.state === "LOCKED";
  return (
    <Link
      href={`/academy/lessons/${lesson.key}`}
      className={cn(
        "glass flex h-full flex-col rounded-card p-4 transition-colors hover:bg-surface-hover",
        locked && "opacity-75",
        lesson.state === "COMPLETED" && "border-success/30",
      )}
      data-testid={`lesson-card-${lesson.key}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{lesson.title}</p>
        <LessonStateBadge state={lesson.state} className="shrink-0" />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{lesson.summary}</p>
      {locked && lesson.missing.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-fg-subtle">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>Complete {lesson.missing.map((m) => m.title).join(", ")} first</span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <Badge>{lesson.estimatedMinutes} min</Badge>
        <Badge>{lesson.quizQuestionCount}-question quiz</Badge>
        {lesson.bestScore !== null && (
          <Badge tone={lesson.bestScore >= lesson.passingScore ? "success" : "warning"}>Best {lesson.bestScore}%</Badge>
        )}
      </div>
    </Link>
  );
}

export const ACADEMY_DISCLAIMER =
  "Educational content for exam preparation. Completing lessons, quizzes, practice exams or bench exercises is not qualifying work experience, a certification or a license.";
