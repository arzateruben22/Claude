import { z } from "zod";
import {
  CALLOUT_TONES,
  FAULT_KINDS,
  MAX_SECTIONS,
  QUANTITY_PATTERN,
  TRACK_KEYS,
  collectResistorIds,
  type NetworkNode,
} from "./constants";

export * from "./constants";

/**
 * Zod schemas mirroring the academy content files in `data/academy/**`. They are the contract
 * between the content team (who may correct facts/typos at any time) and the app: the loader in
 * `content.ts` validates every file against these and skips (and logs) anything that does not fit
 * rather than crashing a page. Pure module: safe to import from tests and (as types) from clients.
 */

/** Lesson / workshop keys are URL segments: lowercase words joined by single hyphens. */
export const contentKeySchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Keys are lowercase words joined by hyphens");

const itemIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/, "Item ids may only contain letters, digits, '-', '_', '.', ':'");

/** Only plain web links may be rendered as hrefs. */
export const httpUrlSchema = z
  .string()
  .max(2048)
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Must be an http(s) URL");

export const toleranceTypeSchema = z.enum(["absolute", "relative"]);
export type ToleranceType = z.infer<typeof toleranceTypeSchema>;

// ---------------------------------------------------------------------------
// Practice / quiz items
// ---------------------------------------------------------------------------

export const numericItemSchema = z.object({
  id: itemIdSchema,
  type: z.literal("numeric"),
  prompt: z.string().min(1),
  answer: z.number().finite(),
  unit: z.string().max(40).optional(),
  tolerance: z.number().finite().min(0),
  /** Content files omit this for absolute tolerances (e.g. `answer: 60, tolerance: 0.1`). */
  toleranceType: toleranceTypeSchema.optional(),
  explanation: z.string().default(""),
  area: z.string().max(80).optional(),
});

export const multipleChoiceItemSchema = z.object({
  id: itemIdSchema,
  type: z.literal("multiple_choice"),
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(10),
  correctIndex: z.number().int().min(0),
  explanation: z.string().default(""),
  area: z.string().max(80).optional(),
});

export const itemSchema = z
  .discriminatedUnion("type", [numericItemSchema, multipleChoiceItemSchema])
  .superRefine((item, ctx) => {
    if (item.type === "multiple_choice" && item.correctIndex >= item.choices.length) {
      ctx.addIssue({ code: "custom", message: "correctIndex is out of range", path: ["correctIndex"] });
    }
  });

export type NumericItem = z.infer<typeof numericItemSchema>;
export type MultipleChoiceItem = z.infer<typeof multipleChoiceItemSchema>;
export type LessonItem = NumericItem | MultipleChoiceItem;

// ---------------------------------------------------------------------------
// Lesson sections
// ---------------------------------------------------------------------------

export const textSectionSchema = z.object({
  type: z.literal("text"),
  heading: z.string().optional(),
  markdown: z.string().min(1),
});

export const formulaSectionSchema = z.object({
  type: z.literal("formula"),
  name: z.string().min(1),
  expression: z.string().min(1),
  variables: z
    .array(z.object({ symbol: z.string().min(1), meaning: z.string().min(1), unit: z.string().optional() }))
    .default([]),
  explanation: z.string().optional(),
});

export const diagramSectionSchema = z.object({
  type: z.literal("diagram"),
  title: z.string().min(1),
  svg: z.string().min(1).max(200_000),
  caption: z.string().optional(),
});

export const exampleSectionSchema = z.object({
  type: z.literal("example"),
  title: z.string().optional(),
  problem: z.string().min(1),
  solutionSteps: z.array(z.string().min(1)).min(1),
  answer: z.string().optional(),
});

const cellSchema = z.union([z.string(), z.number()]).transform((v) => String(v));

export const tableSectionSchema = z.object({
  type: z.literal("table"),
  caption: z.string().optional(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(cellSchema)).default([]),
});

export const calloutSectionSchema = z.object({
  type: z.literal("callout"),
  tone: z.enum(CALLOUT_TONES),
  title: z.string().optional(),
  text: z.string().min(1),
});

export const sectionSchema = z.discriminatedUnion("type", [
  textSectionSchema,
  formulaSectionSchema,
  diagramSectionSchema,
  exampleSectionSchema,
  tableSectionSchema,
  calloutSectionSchema,
]);

export type LessonSection = z.infer<typeof sectionSchema>;
export type TextSection = z.infer<typeof textSectionSchema>;
export type FormulaSection = z.infer<typeof formulaSectionSchema>;
export type DiagramSection = z.infer<typeof diagramSectionSchema>;
export type ExampleSection = z.infer<typeof exampleSectionSchema>;
export type TableSection = z.infer<typeof tableSectionSchema>;
export type CalloutSection = z.infer<typeof calloutSectionSchema>;

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export const sourceSchema = z.object({ title: z.string().min(1), url: httpUrlSchema });
export type ContentSource = z.infer<typeof sourceSchema>;

export const quizSchema = z.object({
  key: contentKeySchema,
  passingScore: z.number().min(1).max(100),
  questions: z.array(itemSchema).min(1).max(100),
});

export const DEFAULT_LESSON_DISCLAIMER =
  "Educational simulation. Completing this lesson is not qualifying work experience, a certification or a license.";

export const lessonSchema = z
  .object({
    key: contentKeySchema,
    track: z.enum(TRACK_KEYS),
    order: z.number().int().min(0),
    title: z.string().min(1).max(200),
    summary: z.string().min(1),
    estimatedMinutes: z.number().int().positive().max(600),
    prerequisites: z.array(contentKeySchema).default([]),
    objectives: z.array(z.string().min(1)).default([]),
    sections: z.array(sectionSchema).min(1).max(MAX_SECTIONS),
    practice: z.array(itemSchema).default([]),
    quiz: quizSchema,
    sources: z.array(sourceSchema).default([]),
    disclaimer: z.string().min(1).default(DEFAULT_LESSON_DISCLAIMER),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    for (const [i, item] of [...lesson.practice, ...lesson.quiz.questions].entries()) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `Duplicate item id ${item.id}`, path: ["items", i] });
      seen.add(item.id);
    }
    if (lesson.prerequisites.includes(lesson.key)) {
      ctx.addIssue({ code: "custom", message: "A lesson cannot require itself", path: ["prerequisites"] });
    }
  });

export type Lesson = z.infer<typeof lessonSchema>;
export type Quiz = Lesson["quiz"];

// ---------------------------------------------------------------------------
// Workshop (simulated bench)
// ---------------------------------------------------------------------------

export const resistorNodeSchema = z.object({
  type: z.literal("resistor"),
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/, "Resistor ids are short identifiers like R1 or RL"),
  ohms: z.number().finite().min(0),
});

export const networkNodeSchema: z.ZodType<NetworkNode> = z.lazy(() =>
  z.union([
    resistorNodeSchema,
    z.object({ type: z.enum(["series", "parallel"]), items: z.array(networkNodeSchema).min(1).max(12) }),
  ]),
);

export const circuitSchema = z.object({
  sourceVolts: z.number().finite().min(0).max(100_000),
  network: networkNodeSchema,
  faults: z.array(z.object({ id: z.string(), fault: z.enum(FAULT_KINDS) })).default([]),
});
export type Circuit = z.infer<typeof circuitSchema>;

const numericTaskSchema = z.object({
  id: itemIdSchema,
  type: z.literal("numeric"),
  question: z.string().min(1),
  quantity: z.string().regex(QUANTITY_PATTERN, "Unknown quantity"),
  tolerance: z.number().finite().min(0),
  toleranceType: toleranceTypeSchema.optional(),
});

const choiceTaskSchema = z.object({
  id: itemIdSchema,
  type: z.literal("multiple_choice"),
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(10),
  correctIndex: z.number().int().min(0),
  explanation: z.string().optional(),
});

/** Numeric tasks omit `type` in the content files. */
export const workshopTaskSchema = z.preprocess(
  (v) => (v && typeof v === "object" && !("type" in v) ? { ...(v as object), type: "numeric" } : v),
  z.discriminatedUnion("type", [numericTaskSchema, choiceTaskSchema]),
);

export type WorkshopNumericTask = z.infer<typeof numericTaskSchema>;
export type WorkshopChoiceTask = z.infer<typeof choiceTaskSchema>;
export type WorkshopTask = WorkshopNumericTask | WorkshopChoiceTask;

export const DEFAULT_WORKSHOP_DISCLAIMER = "Simulated bench exercise; not field experience.";

export const workshopSchema = z
  .object({
    key: contentKeySchema,
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    difficulty: z.number().int().min(1).max(5).default(1),
    estimatedMinutes: z.number().int().positive().max(600).default(10),
    relatedLessons: z.array(contentKeySchema).default([]),
    circuit: circuitSchema,
    tasks: z.array(workshopTaskSchema).min(1).max(30),
    hints: z.array(z.string().min(1)).default([]),
    learningGoals: z.array(z.string().min(1)).default([]),
    disclaimer: z.string().min(1).default(DEFAULT_WORKSHOP_DISCLAIMER),
  })
  .superRefine((w, ctx) => {
    const ids = collectResistorIds(w.circuit.network);
    const idSet = new Set(ids);
    if (idSet.size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate resistor ids", path: ["circuit", "network"] });
    for (const [i, f] of w.circuit.faults.entries()) {
      if (!idSet.has(f.id)) ctx.addIssue({ code: "custom", message: `Fault refers to unknown resistor ${f.id}`, path: ["circuit", "faults", i] });
    }
    const taskIds = new Set<string>();
    for (const [i, t] of w.tasks.entries()) {
      if (taskIds.has(t.id)) ctx.addIssue({ code: "custom", message: `Duplicate task id ${t.id}`, path: ["tasks", i] });
      taskIds.add(t.id);
      if (t.type === "numeric") {
        const target = QUANTITY_PATTERN.exec(t.quantity)?.[2];
        if (target !== "total" && (!target || !idSet.has(target))) {
          ctx.addIssue({ code: "custom", message: `Quantity ${t.quantity} refers to an unknown element`, path: ["tasks", i, "quantity"] });
        }
      } else if (t.correctIndex >= t.choices.length) {
        ctx.addIssue({ code: "custom", message: "correctIndex is out of range", path: ["tasks", i, "correctIndex"] });
      }
    }
  });

export type Workshop = z.infer<typeof workshopSchema>;

// ---------------------------------------------------------------------------
// Practice-exam question bank
// ---------------------------------------------------------------------------

export const bankAreaSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1),
  weight: z.number().finite().min(0).default(0),
});

export const bankQuestionSchema = z
  .object({
    id: itemIdSchema,
    area: z.string().min(1).max(80),
    difficulty: z.number().int().min(1).max(5).optional(),
    prompt: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(10),
    correctIndex: z.number().int().min(0),
    explanation: z.string().default(""),
    necReference: z.string().nullish().transform((v) => v ?? null),
  })
  .superRefine((q, ctx) => {
    if (q.correctIndex >= q.choices.length) ctx.addIssue({ code: "custom", message: "correctIndex is out of range", path: ["correctIndex"] });
  });

export const questionBankShellSchema = z.object({
  disclaimer: z.string().min(1),
  areas: z.array(bankAreaSchema).default([]),
  questions: z.array(z.unknown()),
});

export type BankArea = z.infer<typeof bankAreaSchema>;
export type BankQuestion = z.infer<typeof bankQuestionSchema>;
export type QuestionBank = { disclaimer: string; areas: BankArea[]; questions: BankQuestion[] };

/** Short, human-readable description of a zod failure for logs. */
export function describeIssues(error: z.ZodError, max = 4): string {
  const parts = error.issues.slice(0, max).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
  if (error.issues.length > max) parts.push(`…and ${error.issues.length - max} more`);
  return parts.join("; ");
}
