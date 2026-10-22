import type { Quiz } from "./schema";

/**
 * Client-safe projection of a lesson quiz: prompts and choices only. Answers, tolerances and
 * explanations stay on the server until the attempt has been graded.
 */
export type PublicQuizQuestion =
  | { id: string; type: "numeric"; prompt: string; unit?: string }
  | { id: string; type: "multiple_choice"; prompt: string; choices: string[] };

export type PublicQuiz = { key: string; passingScore: number; questions: PublicQuizQuestion[] };

export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    key: quiz.key,
    passingScore: quiz.passingScore,
    questions: quiz.questions.map((q) =>
      q.type === "numeric"
        ? { id: q.id, type: q.type, prompt: q.prompt, ...(q.unit ? { unit: q.unit } : {}) }
        : { id: q.id, type: q.type, prompt: q.prompt, choices: q.choices },
    ),
  };
}
