import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getLesson } from "@/lib/academy/content";
import { toPublicQuiz } from "@/lib/academy/quiz";
import { contentKeySchema } from "@/lib/academy/schema";
import { getLessonPageData, listQuizAttempts, markLessonOpened, timezoneOf } from "@/lib/academy/service";
import { trackLabel } from "@/lib/academy/tracks";
import { formatInTz } from "@/lib/applications/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LessonStateBadge } from "@/components/academy/badges";
import { Breadcrumbs, LockedLessonPanel } from "@/components/academy/lesson-parts";
import { QuizForm } from "@/components/academy/quiz-form";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const lesson = contentKeySchema.safeParse(key).success ? getLesson(key) : null;
  return { title: lesson ? `Quiz: ${lesson.title}` : "Quiz" };
}

export default async function LessonQuizPage({ params }: Props) {
  const { key } = await params;
  if (!contentKeySchema.safeParse(key).success) notFound();
  const user = await requireUser(`/academy/lessons/${key}/quiz`);
  const data = await getLessonPageData(user.id, key);
  if (!data) notFound();
  const { lesson, view } = data;
  const locked = view.state === "LOCKED";
  const state = locked ? view.state : ((await markLessonOpened(user.id, key)) ?? view.state);
  const [history, tz] = await Promise.all([locked ? [] : listQuizAttempts(user.id, lesson.quiz.key, 5), timezoneOf(user.id)]);

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/academy", label: "Academy" },
          { href: `/academy#track-${lesson.track.toLowerCase()}`, label: trackLabel(lesson.track) },
          { href: `/academy/lessons/${lesson.key}`, label: lesson.title },
          { label: "Quiz" },
        ]}
      />
      <PageHeader
        eyebrow="Lesson quiz"
        title={lesson.title}
        description={`${lesson.quiz.questions.length} questions · pass at ${lesson.quiz.passingScore}% to complete the lesson. Retakes are allowed; lesson XP is earned once.`}
        actions={<LessonStateBadge state={state} />}
      />

      {locked ? (
        <LockedLessonPanel lessonKey={lesson.key} missing={view.missing} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 max-w-3xl">
            <QuizForm lessonKey={lesson.key} lessonTitle={lesson.title} quiz={toPublicQuiz(lesson.quiz)} />
          </div>
          <aside aria-labelledby="quiz-history" className="space-y-3 lg:sticky lg:top-6 lg:self-start">
            <div className="glass rounded-card p-4">
              <h2 id="quiz-history" className="text-sm font-medium">
                Recent attempts
              </h2>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-fg-muted">No attempts yet. Your first attempt will appear here.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span className="text-fg-muted text-xs">{formatInTz(h.createdAt, tz, "datetime")}</span>
                      <Badge tone={h.passed ? "success" : "neutral"} className="tnum">
                        {h.score}/{h.maxScore}
                        {h.passed ? " · passed" : ""}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href={`/academy/lessons/${lesson.key}`} className="block text-sm text-accent hover:underline">
              Review the lesson first
            </Link>
            <p className="text-xs text-fg-subtle">{lesson.disclaimer}</p>
          </aside>
        </div>
      )}
    </>
  );
}
