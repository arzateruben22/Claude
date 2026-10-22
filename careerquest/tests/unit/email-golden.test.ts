/**
 * Golden tests over the labeled fixture corpus (tests/fixtures/emails, see its README.md).
 * Asserts classification accuracy (with a per-class confusion table), confidence floors, field
 * extraction, the submission/observation contract and mbox splitting.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyEmail, type Classification } from "@/lib/email/classify";
import { toObservation } from "@/lib/email/observation";
import { parseEmail, splitMbox, type ParsedEmail } from "@/lib/email/parse";
import type { ApplicationObservation } from "@/lib/ingest/types";

type Expected = {
  classification: string;
  employer: string | null;
  positionTitle: string | null;
  requisitionNumber: string | null;
  platform: string | null;
  interviewAt: string | null;
  recruiterName: string | null;
  countsAsSubmission: boolean;
  minConfidence: number;
};
type Fixture = { file: string; expected: Expected; notes: string };

const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const INDEX: Fixture[] = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
const NEVER_OBSERVED = new Set(["JOB_ALERT", "INCOMPLETE_APPLICATION", "APPLICATION_INVITATION"]);

type Result = { fixture: Fixture; parsed: ParsedEmail; result: Classification; observation: ApplicationObservation | null };
const results: Result[] = [];

/** Case- and whitespace-insensitive comparison used for labeled strings. */
const norm = (v: unknown) => (v === null || v === undefined ? null : String(v).toLowerCase().replace(/\s+/g, " ").trim());

beforeAll(async () => {
  for (const fixture of INDEX) {
    const parsed = await parseEmail(fs.readFileSync(path.join(DIR, fixture.file)));
    const result = classifyEmail(parsed);
    const observation = toObservation(parsed, result, { provider: "EML" });
    results.push({ fixture, parsed, result, observation });
  }
});

describe("fixture corpus", () => {
  it("covers all 40 labeled messages", () => {
    expect(INDEX).toHaveLength(40);
    expect(results).toHaveLength(40);
  });

  it("classifies ≥ 95 % correctly (confusion table printed)", () => {
    const classes = [...new Set(INDEX.map((f) => f.expected.classification))].sort();
    const predicted = [...new Set([...classes, ...results.map((r) => r.result.classification)])].sort();
    const matrix = new Map<string, Map<string, number>>();
    for (const r of results) {
      const row = matrix.get(r.fixture.expected.classification) ?? new Map<string, number>();
      row.set(r.result.classification, (row.get(r.result.classification) ?? 0) + 1);
      matrix.set(r.fixture.expected.classification, row);
    }
    const CODES: Record<string, string> = {
      APPLICATION_SUBMITTED: "SUB",
      EMPLOYER_ACKNOWLEDGMENT: "ACK",
      RECRUITER_MESSAGE: "REC",
      INTERVIEW_INVITATION: "INT",
      ASSESSMENT_INVITATION: "ASM",
      REJECTION: "REJ",
      OFFER: "OFR",
      ONBOARDING: "ONB",
      JOB_ALERT: "ALR",
      INCOMPLETE_APPLICATION: "INC",
      APPLICATION_INVITATION: "INV",
      UNRELATED: "UNR",
      UNKNOWN: "UNK",
    };
    const abbreviation = (c: string) => CODES[c] ?? c.slice(0, 3);
    const header = ["expected \\ predicted".padEnd(26), ...predicted.map((c) => abbreviation(c).padStart(5)), "  acc"].join("");
    const lines = [header];
    for (const c of classes) {
      const row = matrix.get(c) ?? new Map<string, number>();
      const total = [...row.values()].reduce((a, b) => a + b, 0);
      const correct = row.get(c) ?? 0;
      lines.push(
        [c.padEnd(26), ...predicted.map((p) => String(row.get(p) ?? 0).padStart(5)), `  ${Math.round((100 * correct) / total)}%`].join(""),
      );
    }
    const correct = results.filter((r) => r.result.classification === r.fixture.expected.classification).length;
    lines.push(`accuracy ${correct}/${results.length} = ${((100 * correct) / results.length).toFixed(1)}%`);
    lines.push(`legend: ${predicted.map((p) => `${abbreviation(p)}=${p}`).join(", ")}`);
    console.log(`\nEmail classification confusion table\n${lines.join("\n")}\n`);

    const misses = results
      .filter((r) => r.result.classification !== r.fixture.expected.classification)
      .map((r) => `${r.fixture.file}: ${r.result.classification} (want ${r.fixture.expected.classification})`);
    expect(correct / results.length, misses.join("\n")).toBeGreaterThanOrEqual(0.95);
  });

  it("never produces an observation for job alerts, unfinished applications or invitations to apply", () => {
    const offenders = results.filter(
      (r) =>
        (NEVER_OBSERVED.has(r.fixture.expected.classification) || NEVER_OBSERVED.has(r.result.classification)) &&
        r.observation !== null,
    );
    expect(offenders.map((r) => r.fixture.file)).toEqual([]);
  });
});

describe.each(INDEX.map((f) => [f.file, f] as const))("%s", (_file, fixture) => {
  const get = () => results.find((r) => r.fixture.file === fixture.file)!;
  const x = fixture.expected;

  it(`classifies as ${x.classification} with confidence ≥ ${x.minConfidence}`, () => {
    const { result } = get();
    expect(result.classification, fixture.notes).toBe(x.classification);
    expect(result.confidence).toBeGreaterThanOrEqual(x.minConfidence);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it(`counts as submission ⇔ observation kind is SUBMITTED/ACKNOWLEDGED (${x.countsAsSubmission})`, () => {
    const { observation } = get();
    const counts = !!observation && (observation.kind === "SUBMITTED" || observation.kind === "ACKNOWLEDGED");
    expect(counts).toBe(x.countsAsSubmission);
  });

  it("extracts the labeled employer, title, requisition, platform and recruiter (never guessing unlabeled ones)", () => {
    const e = get().result.extracted;
    expect(norm(e.employer), "employer").toBe(norm(x.employer));
    expect(norm(e.positionTitle), "positionTitle").toBe(norm(x.positionTitle));
    expect(norm(e.requisitionNumber), "requisitionNumber").toBe(norm(x.requisitionNumber));
    expect(e.platform, "platform").toBe(x.platform);
    expect(norm(e.recruiterName), "recruiterName").toBe(norm(x.recruiterName));
  });

  it(`extracts interviewAt = ${x.interviewAt ?? "null"}`, () => {
    const e = get().result.extracted;
    expect(e.interviewAt ? e.interviewAt.toISOString() : null).toBe(x.interviewAt ? new Date(x.interviewAt).toISOString() : null);
  });

  it("builds a well-formed observation (or none)", () => {
    const { observation, parsed, result } = get();
    if (!observation) return;
    expect(observation.source).toBe("EMAIL");
    expect(observation.origin).toBe("EMAIL");
    expect(observation.evidence.kind).toBe("EMAIL");
    expect(observation.evidence.sourceRef).toBe(`EML:${parsed.externalId}`);
    expect(observation.evidence.title).toBe(parsed.subject);
    expect((observation.evidence.snippet ?? "").length).toBeLessThanOrEqual(300);
    expect(observation.evidence.snippet ?? "").not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(observation.evidence.snippet ?? "").not.toMatch(/\(\d{3}\)\s?\d{3}-\d{4}/);
    expect(observation.confidence).toBe(result.confidence);
    expect(observation.observedAt.getTime()).toBe(parsed.receivedAt!.getTime());
    if (observation.verified) {
      expect(["SUBMITTED", "ACKNOWLEDGED", "REJECTED", "OFFER", "ONBOARDING"]).toContain(observation.kind);
      expect(observation.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe("verified flag", () => {
  it("is set for platform confirmations and employer-domain decisions, never for recruiter or interview mail", () => {
    const byFile = (prefix: string) => results.find((r) => r.fixture.file.startsWith(prefix))!.observation!;
    expect(byFile("003").verified).toBe(true); // Workday confirmation
    expect(byFile("001").verified).toBe(true); // Indeed confirmation
    expect(byFile("030").verified).toBe(true); // offer from the employer's own domain
    expect(byFile("015").verified).toBe(false); // recruiter message
    expect(byFile("020").verified).toBe(false); // interview invitation
    expect(byFile("028").verified).toBe(false); // subtle rejection below 0.9
  });
});

describe("all.mbox", () => {
  it("splits into the 40 fixture messages, unescaping >From lines", async () => {
    const mbox = fs.readFileSync(path.join(DIR, "all.mbox"));
    const messages = splitMbox(mbox);
    expect(messages).toHaveLength(40);
    const firstDay = messages.find((m) => m.includes("Subject: Your first day at Pacific Coast Mechanical"))!;
    expect(firstDay).toMatch(/^From there, Ray will walk you over/m);
    expect(firstDay).not.toMatch(/^>From there/m);

    for (let i = 0; i < messages.length; i++) {
      const parsed = await parseEmail(messages[i]!);
      const expected = results[i]!;
      expect(parsed.externalId).toBe(expected.parsed.externalId);
      expect(parsed.text).toBe(expected.parsed.text);
      expect(classifyEmail(parsed).classification).toBe(expected.result.classification);
    }
  });
});
