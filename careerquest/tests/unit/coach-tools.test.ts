import { describe, expect, it } from "vitest";
import { detectIntent, detectInterviewRole, interviewCommand } from "@/lib/coach/intents";
import { citationIds, extractCitations, splitCitations } from "@/lib/coach/citations";
import { parseRichText, plainText } from "@/lib/coach/format";
import { QUESTION_BANK, continueInterview, evaluateAnswer, startInterviewState } from "@/lib/coach/mock-interview";
import { aggregateGaps, analyzeFit, extractKeywords, stem, tailoredResumeDraft, usesOnlyResumeFacts } from "@/lib/coach/resume-tailor";
import { coverLetter, followUpEmail } from "@/lib/coach/drafts";
import { parseMeta, toMessageView } from "@/lib/coach/messages";

describe("intent matching", () => {
  it.each([
    ["How am I doing?", "status"],
    ["what should I do today", "today"],
    ["Compare apprenticeship programs", "programs"],
    ["explain salary progression", "salary"],
    ["Mock interview", "mock_interview"],
    ["can we practice an interview for a maintenance job", "mock_interview"],
    ["Draft a follow-up email for Acme", "follow_up"],
    ["Tailor my résumé for the Acme application", "tailor"],
    ["tailor my resume", "tailor"],
    ["Cover letter draft", "cover_letter"],
    ["How well does my résumé match?", "resume_alignment"],
    ["What skills am I missing?", "skill_gaps"],
    ["Where are my applications stalling?", "bottleneck"],
    ["Which roles fit me best?", "roles"],
    ["help", "help"],
    ["tell me a joke", "unknown"],
  ])("%s → %s", (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });

  it("detects interview roles and commands", () => {
    expect(detectInterviewRole("Mock interview: Apprentice electrician")).toBe("apprentice-electrician");
    expect(detectInterviewRole("construction coordinator please")).toBe("construction-coordinator");
    expect(detectInterviewRole("facilities maintenance")).toBe("maintenance-technician");
    expect(detectInterviewRole("anything")).toBeNull();
    expect(interviewCommand("stop")).toBe("stop");
    expect(interviewCommand("Skip this question")).toBe("skip");
    expect(interviewCommand("I stopped the work and told my foreman")).toBeNull();
  });
});

describe("citations", () => {
  const known = new Set(["funnel.applied", "funnel.response_rate", "category.best"]);
  const isKnown = (id: string) => known.has(id);

  it("keeps known ids, drops unknown ones, splits multi-id tokens", () => {
    const { text, citations } = extractCitations("You applied 75 times [funnel.applied] with [funnel.response_rate, made.up] and [invented.metric].", isKnown);
    expect(citations).toEqual(["funnel.applied", "funnel.response_rate"]);
    expect(text).toBe("You applied 75 times [funnel.applied] with [funnel.response_rate] and.");
  });

  it("never treats placeholders or links as citations", () => {
    const t = "Dear [Hiring manager's name], see [the docs](https://x.y) and [Your name].";
    expect(citationIds(t)).toEqual([]);
    expect(extractCitations(t, isKnown).text).toBe(t);
  });

  it("is case-insensitive on ids and splits segments", () => {
    const segs = splitCitations("A [Funnel.Applied] B [x.y] C", isKnown);
    expect(segs).toEqual([
      { type: "text", value: "A " },
      { type: "cite", id: "funnel.applied" },
      { type: "text", value: " B  C" },
    ]);
  });

  it("parses rich text into paragraphs, lists, bold and chips", () => {
    const blocks = parseRichText("**Title.** First [funnel.applied]\n\n- one\n- two [category.best]\nafter", isKnown);
    expect(blocks[0]).toEqual({ type: "p", lines: [[{ type: "text", value: "Title.", bold: true }, { type: "text", value: " First " }, { type: "cite", id: "funnel.applied" }]] });
    expect(blocks[1]!.type).toBe("ul");
    expect(blocks[2]!.type).toBe("p");
    expect(plainText("Rate [funnel.response_rate] is **low**.")).toBe("Rate is low.");
  });
});

describe("mock interview", () => {
  const safety = QUESTION_BANK["apprentice-electrician"].find((q) => q.id === "ae-safety")!;

  it("credits a full STAR answer", () => {
    const answer =
      "Last summer while I was working as a warehouse helper, I noticed an extension cord with damaged insulation running through a wet area. My job was to keep the loading dock clear, so I needed to deal with it. I stopped the work in that area, I unplugged the cord and I reported it to my supervisor right away. I also put a sign out. As a result the cord was replaced the same day and nobody got hurt; since then I check cords at the start of every shift.";
    const fb = evaluateAnswer(safety, answer);
    expect(fb.star).toEqual({ situation: true, task: true, action: true, result: true });
    expect(fb.rating).toBe("strong");
    expect(fb.keyPointsCovered.length).toBeGreaterThanOrEqual(3);
  });

  it("flags short answers missing STAR parts and 'we' over 'I'", () => {
    const fb = evaluateAnswer(safety, "We fixed it and we were fine.");
    expect(fb.rating).toBe("needs_work");
    expect(fb.star.situation).toBe(false);
    expect(fb.improvements.join(" ")).toMatch(/short/);
  });

  it("checks key points on technical questions", () => {
    const ohms = QUESTION_BANK["apprentice-electrician"].find((q) => q.id === "ae-ohms")!;
    const fb = evaluateAnswer(ohms, "Ohm's law says voltage equals current times resistance, V = I x R. On the job I would use it to calculate the current a load draws and to check a meter reading when troubleshooting a circuit.");
    expect(fb.keyPointsMissed).toEqual([]);
    expect(fb.rating).toBe("strong");
  });

  it("advances, skips and summarizes", () => {
    let s = startInterviewState("construction-coordinator");
    let turn = continueInterview(s, "skip", "skip");
    expect(turn.state.index).toBe(1);
    expect(turn.content).toMatch(/Question 2 of 6/);
    s = turn.state;
    turn = continueInterview(s, "When our schedule slipped because of a material delay, I called the supplier, I updated the look-ahead and told the superintendent. As a result we finished on time.", null);
    expect(turn.content).toMatch(/Feedback/);
    expect(turn.state.results).toHaveLength(2);
    turn = continueInterview(turn.state, "stop", "stop");
    expect(turn.state.active).toBe(false);
    expect(turn.content).toMatch(/You answered 1 of 6 questions/);
  });
});

describe("résumé tailoring", () => {
  const jd = `Apprentice Electrician – Commercial
We need an apprentice who can read blueprints, bend conduit and follow lockout/tagout procedures.
Requirements: OSHA 10 card, valid driver's license, basic hand tools, ability to use a multimeter.
Preferred: experience with conduit bending on commercial projects, Microsoft Excel for material tracking.
Safety first: lockout/tagout on every job. Commercial tenant improvements.`;
  const resume = `ADA LOPEZ
Warehouse Associate, Acme Logistics (2023–2025)
- Followed LOTO procedures on conveyor maintenance with the site electrician
- Tracked inventory for 3 warehouses in Excel and cut count errors by 20%
- Read construction drawings to stage materials for tenant improvements
Certifications: OSHA 10
Skills: hand tools, forklift`;

  it("finds matched and missing keywords", () => {
    const fit = analyzeFit(jd, resume);
    const matched = fit.matched.map((k) => k.display);
    const missing = fit.missing.map((k) => k.display);
    expect(matched).toEqual(expect.arrayContaining(["lockout/tagout", "OSHA 10", "blueprints", "Microsoft Excel", "hand tools"]));
    expect(missing).toEqual(expect.arrayContaining(["conduit bending", "multimeter", "driver's license"]));
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.score).toBeLessThan(1);
  });

  it("suggests rewrites that only reuse résumé facts", () => {
    const fit = analyzeFit(jd, resume);
    expect(fit.suggestions.length).toBeGreaterThan(0);
    const wording = fit.suggestions.find((s) => s.kind === "wording" && s.original?.includes("LOTO"));
    expect(wording?.suggested).toBe("Followed lockout/tagout (LOTO) procedures on conveyor maintenance with the site electrician");
    for (const s of fit.suggestions) {
      // No new numbers, and nothing from the missing list sneaks into a suggestion.
      for (const n of s.suggested.match(/\d+/g) ?? []) expect(resume).toContain(n);
      for (const m of fit.missing) expect(s.suggested.toLowerCase()).not.toContain(m.display.toLowerCase());
    }
    expect(fit.suggestions.some((s) => s.kind === "skills_line")).toBe(true);
  });

  it("builds a tailored copy that only reorders and rewords the résumé's own lines", () => {
    const fit = analyzeFit(jd, resume);
    const draft = tailoredResumeDraft(resume, fit)!;
    expect(draft).not.toBeNull();
    const lines = draft.split("\n");
    expect(lines[0]).toBe("ADA LOPEZ");
    expect(lines[1]!.startsWith("Skills: ")).toBe(true);
    expect(draft).toContain("- Followed lockout/tagout (LOTO) procedures on conveyor maintenance");
    expect(draft).toContain("- Tracked inventory for 3 warehouses in Microsoft Excel (Excel) and cut count errors by 20%");
    // Every original line is still there (or its equivalent-wording version), and nothing else is added.
    const swaps = new Map(fit.suggestions.filter((x) => x.kind === "wording").map((x) => [x.original!, x.suggested]));
    for (const line of resume.split("\n")) {
      const body = line.replace(/^- /, "");
      expect(draft).toContain(swaps.has(body) ? `- ${swaps.get(body)}` : line);
    }
    expect(lines.length).toBe(resume.split("\n").length + 1);
    expect(usesOnlyResumeFacts(draft, resume, fit.allowedTerms)).toBe(true);
    expect(tailoredResumeDraft("Plain résumé line one here\nAnother plain line", analyzeFit("Nothing relevant at all here.", "x"))).toBeNull();
  });

  it("the fact check rejects invented skills and numbers", () => {
    expect(usesOnlyResumeFacts("Tracked inventory in Excel", resume)).toBe(true);
    expect(usesOnlyResumeFacts("Certified journeyman electrician with PLC experience", resume)).toBe(false);
    expect(usesOnlyResumeFacts("Cut count errors by 45%", resume)).toBe(false);
  });

  it("does not swap ordinary words that look like products", () => {
    const fit = analyzeFit("Must know Microsoft Excel. Excel spreadsheets daily.", "- I excel at customer service and teamwork on busy sites");
    expect(fit.suggestions.find((s) => s.kind === "wording")).toBeUndefined();
  });

  it("extracts repeated terms and aggregates gaps across postings", () => {
    const kws = extractKeywords("Fire alarm installs. Fire alarm testing. Tenant improvements and tenant buildouts.");
    expect(kws[0]!.display).toBe("fire alarm");
    expect(stem("installing")).toBe("install");
    const gaps = aggregateGaps([{ jobDescription: jd }, { jobDescription: "Use a multimeter daily. Multimeter readings. OSHA 10 required." }], resume);
    const multimeter = gaps.find((g) => g.display === "multimeter")!;
    expect(multimeter).toMatchObject({ postings: 2, inResume: false });
    expect(gaps.find((g) => g.display === "OSHA 10")!.inResume).toBe(true);
  });
});

describe("drafts", () => {
  const app = {
    id: "a",
    companyName: "Bright Builders",
    positionTitle: "Construction Coordinator",
    status: "INTERVIEWING",
    requisitionNumber: null,
    sourceLabel: "LinkedIn",
    appliedAt: "2026-10-01T16:00:00.000Z",
    recruiterName: "Maria Chen",
    lastInterviewAt: "2026-10-20T17:30:00.000Z",
  };

  it("post-interview follow-up thanks the named contact", () => {
    const { draft, notes } = followUpEmail(app, { userName: "Ada Lopez", timeZone: "America/Los_Angeles", now: new Date("2026-10-22T19:00:00Z") });
    expect(draft.body.startsWith("Hi Maria,")).toBe(true);
    expect(draft.body).toContain("on October 20 about the Construction Coordinator position at Bright Builders");
    expect(draft.subject).toBe("Thank you – Construction Coordinator interview");
    expect(notes.join(" ")).toMatch(/\[bracketed\]/);
  });

  it("warns when following up early", () => {
    const { notes } = followUpEmail({ ...app, lastInterviewAt: null, status: "SUBMITTED" }, { userName: "Ada", timeZone: "UTC", now: new Date("2026-10-03T19:00:00Z") });
    expect(notes[0]).toMatch(/2 days ago/);
  });

  it("cover letter uses placeholders for unknowns and only résumé terms as prompts", () => {
    const d = coverLetter({ ...app, recruiterName: null }, { userName: "Ada Lopez", matchedTerms: ["scheduling", "RFIs"], missingTerms: ["Procore"] });
    expect(d.body).toContain("Dear [Hiring manager's name],");
    expect(d.body).toContain("[Turn these points from your résumé that match the posting into two or three sentences");
    expect(d.body).toContain("scheduling, RFIs");
    expect(d.body).toContain("Mention any of these only if they are true for you");
    expect(d.body).toContain("Ada Lopez");
    expect(d.body).not.toMatch(/\bI have experience with Procore\b/);
  });
});

describe("message storage", () => {
  it("parses stored metadata defensively", () => {
    const meta = parseMeta({
      citations: [{ id: "funnel.applied", label: "Applications", display: "75", basis: "observed" }, { id: 3 }, null],
      actions: [{ label: "Go", href: "/applications" }, { label: "Evil", href: "https://evil.example" }],
      quickReplies: [{ label: "Pick", text: "Draft", applicationId: "not-a-uuid" }],
      drafts: [{ title: "Email", body: "Hi" }],
      interview: { role: "apprentice-electrician", index: 1, total: 6, active: true, results: [] },
    });
    expect(meta.citations).toHaveLength(1);
    expect(meta.actions).toEqual([{ label: "Go", href: "/applications" }]);
    expect(meta.quickReplies?.[0]?.applicationId).toBeUndefined();
    expect(meta.interview?.active).toBe(true);
    expect(parseMeta("garbage").citations).toEqual([]);
    const view = toMessageView({ id: "m", role: "ASSISTANT", content: "x", provider: "WEIRD", createdAt: new Date(0), metrics: null });
    expect(view.provider).toBe("RULES");
  });
});
