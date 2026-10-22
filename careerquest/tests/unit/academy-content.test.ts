import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getLesson,
  getQuestionBank,
  getTracks,
  getWorkshop,
  listLessons,
  listWorkshops,
  loadAcademyContent,
  resetAcademyContentCache,
} from "@/lib/academy/content";
import { MAX_SECTIONS, TRACK_KEYS } from "@/lib/academy/schema";

const REAL_ROOT = path.join(process.cwd(), "data", "academy");
const tmpDirs: string[] = [];

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-content-"));
  tmpDirs.push(dir);
  for (const sub of ["lessons", "workshop", "exam"]) fs.mkdirSync(path.join(dir, sub));
  return dir;
}

function realLesson(key: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(REAL_ROOT, "lessons", `${key}.json`), "utf8"));
}

afterEach(() => {
  resetAcademyContentCache();
  delete process.env.ACADEMY_CONTENT_DIR;
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("academy content loader (real data)", () => {
  it("loads every lesson, workshop and the question bank without issues", () => {
    const logs: string[] = [];
    const content = loadAcademyContent(REAL_ROOT, (m) => logs.push(m));
    const lessonFiles = fs.readdirSync(path.join(REAL_ROOT, "lessons")).filter((f) => f.endsWith(".json"));
    const workshopFiles = fs.readdirSync(path.join(REAL_ROOT, "workshop")).filter((f) => f.endsWith(".json"));
    expect(content.issues).toEqual([]);
    expect(logs).toEqual([]);
    expect(content.lessons).toHaveLength(lessonFiles.length);
    expect(content.workshops).toHaveLength(workshopFiles.length);
    expect(content.bank?.questions.length).toBeGreaterThan(50);
  });

  it("exposes tracks in the canonical order with lessons sorted by order", () => {
    const tracks = getTracks();
    expect(tracks.map((t) => t.key)).toEqual([...TRACK_KEYS]);
    for (const t of tracks) {
      const orders = t.lessons.map((l) => l.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      expect(t.lessons.every((l) => l.track === t.key)).toBe(true);
    }
    expect(listLessons().length).toBe(tracks.reduce((s, t) => s + t.lessons.length, 0));
  });

  it("returns full lessons and workshops by key and null for unknown keys", () => {
    const lesson = getLesson("ohms-law");
    expect(lesson?.title).toBe("Ohm's Law");
    expect(lesson?.sections.length).toBeLessThanOrEqual(MAX_SECTIONS);
    expect(lesson?.quiz.questions.length).toBeGreaterThan(0);
    expect(getLesson("does-not-exist")).toBeNull();
    expect(getWorkshop("series-parallel-1")?.circuit.sourceVolts).toBe(12);
    expect(getWorkshop("nope")).toBeNull();
    expect(listWorkshops().every((w) => w.taskCount > 0)).toBe(true);
    expect(getQuestionBank()?.areas.length).toBeGreaterThan(0);
  });

  it("every prerequisite refers to an existing lesson and there are no cycles", () => {
    const lessons = listLessons();
    const keys = new Set(lessons.map((l) => l.key));
    const byKey = new Map(lessons.map((l) => [l.key, l]));
    for (const l of lessons) for (const p of l.prerequisites) expect(keys.has(p)).toBe(true);
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (k: string) => {
      if (done.has(k)) return;
      expect(visiting.has(k)).toBe(false);
      visiting.add(k);
      for (const p of byKey.get(k)!.prerequisites) visit(p);
      visiting.delete(k);
      done.add(k);
    };
    for (const l of lessons) visit(l.key);
  });
});

describe("academy content loader (fixtures)", () => {
  it("skips and logs invalid files instead of crashing", () => {
    const root = fixtureRoot();
    const good = realLesson("ohms-law");
    fs.writeFileSync(path.join(root, "lessons", "good.json"), JSON.stringify({ ...good, prerequisites: ["missing-lesson"] }));
    fs.writeFileSync(path.join(root, "lessons", "broken.json"), "{ not json");
    fs.writeFileSync(path.join(root, "lessons", "bad-track.json"), JSON.stringify({ ...good, key: "bad-track", track: "WIZARDRY" }));
    const tooMany = { ...good, key: "too-many", sections: Array.from({ length: MAX_SECTIONS + 1 }, () => ({ type: "text", markdown: "x" })) };
    fs.writeFileSync(path.join(root, "lessons", "too-many.json"), JSON.stringify(tooMany));
    fs.writeFileSync(path.join(root, "lessons", "z-dupe.json"), JSON.stringify(good));
    const badKey = { ...good, key: "bad-key", quiz: { ...(good.quiz as object), questions: [{ id: "x", type: "multiple_choice", prompt: "?", choices: ["a", "b"], correctIndex: 5 }] } };
    fs.writeFileSync(path.join(root, "lessons", "bad-key.json"), JSON.stringify(badKey));
    fs.writeFileSync(path.join(root, "lessons", "README.md"), "# not content");

    const logs: string[] = [];
    const content = loadAcademyContent(root, (m) => logs.push(m));
    expect(content.lessons.map((l) => l.key)).toEqual(["ohms-law"]);
    // unknown prerequisite dropped so the lesson can still be unlocked
    expect(content.lessons[0]!.prerequisites).toEqual([]);
    const files = content.issues.map((i) => i.file);
    expect(files).toEqual(expect.arrayContaining(["lessons/broken.json", "lessons/bad-track.json", "lessons/too-many.json", "lessons/z-dupe.json", "lessons/bad-key.json", "lessons/ohms-law"]));
    expect(logs.length).toBe(content.issues.length);
  });

  it("accepts up to 16 sections and every section type", () => {
    const root = fixtureRoot();
    const good = realLesson("ohms-law");
    const sections = [
      { type: "text", heading: "H", markdown: "Some **bold** text" },
      { type: "formula", name: "Ohm", expression: "V = I × R", variables: [{ symbol: "V", meaning: "volts", unit: "V" }] },
      { type: "diagram", title: "D", svg: "<svg viewBox='0 0 10 10'><line x1='0' y1='0' x2='10' y2='10'/></svg>" },
      { type: "example", problem: "P", solutionSteps: ["s1", "s2"], answer: "A" },
      { type: "table", columns: ["a", "b"], rows: [["1", 2]] },
      { type: "callout", tone: "simulation", text: "Bench" },
    ];
    const sixteen = Array.from({ length: MAX_SECTIONS }, (_, i) => sections[i % sections.length]);
    fs.writeFileSync(path.join(root, "lessons", "a.json"), JSON.stringify({ ...good, sections: sixteen, prerequisites: [] }));
    const content = loadAcademyContent(root, () => undefined);
    expect(content.issues).toEqual([]);
    const table = content.lessons[0]!.sections.find((s) => s.type === "table");
    expect(table && table.type === "table" ? table.rows[0] : null).toEqual(["1", "2"]);
  });

  it("rejects workshops whose tasks refer to unknown elements or have no finite answer", () => {
    const root = fixtureRoot();
    const base = JSON.parse(fs.readFileSync(path.join(REAL_ROOT, "workshop", "series-basics.json"), "utf8"));
    fs.writeFileSync(path.join(root, "workshop", "ok.json"), JSON.stringify(base));
    fs.writeFileSync(path.join(root, "workshop", "unknown.json"), JSON.stringify({ ...base, key: "unknown", tasks: [{ id: "t", question: "?", quantity: "V_R9", tolerance: 0.1 }] }));
    const allOpen = { ...base, key: "all-open", circuit: { ...base.circuit, faults: [{ id: "R1", fault: "open" }] }, tasks: [{ id: "t", question: "?", quantity: "R_total", tolerance: 0.1 }] };
    fs.writeFileSync(path.join(root, "workshop", "all-open.json"), JSON.stringify(allOpen));
    const content = loadAcademyContent(root, () => undefined);
    expect(content.workshops.map((w) => w.key)).toEqual([base.key]);
    expect(content.issues.map((i) => i.file).sort()).toEqual(["workshop/all-open.json", "workshop/unknown.json"]);
  });

  it("keeps the bank when single questions are invalid", () => {
    const root = fixtureRoot();
    const bank = {
      disclaimer: "Original study questions.",
      areas: [{ key: "a", label: "A", weight: 1 }],
      questions: [
        { id: "q1", area: "a", prompt: "?", choices: ["x", "y"], correctIndex: 0, explanation: "", necReference: null },
        { id: "q2", area: "a", prompt: "?", choices: ["x"], correctIndex: 0 },
        { id: "q1", area: "a", prompt: "dupe", choices: ["x", "y"], correctIndex: 1 },
      ],
    };
    fs.writeFileSync(path.join(root, "exam", "question_bank.json"), JSON.stringify(bank));
    const content = loadAcademyContent(root, () => undefined);
    expect(content.bank?.questions.map((q) => q.id)).toEqual(["q1"]);
    expect(content.issues).toHaveLength(2);
  });

  it("re-reads changed files outside production and uses ACADEMY_CONTENT_DIR", () => {
    const root = fixtureRoot();
    const good = realLesson("ohms-law");
    process.env.ACADEMY_CONTENT_DIR = root;
    fs.writeFileSync(path.join(root, "lessons", "a.json"), JSON.stringify({ ...good, prerequisites: [] }));
    expect(getLesson("ohms-law")?.title).toBe("Ohm's Law");
    fs.writeFileSync(path.join(root, "lessons", "a.json"), JSON.stringify({ ...good, prerequisites: [], title: "Ohm's Law (corrected)" }));
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(root, "lessons", "a.json"), future, future);
    expect(getLesson("ohms-law")?.title).toBe("Ohm's Law (corrected)");
  });
});
