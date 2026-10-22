/**
 * Review queue form schemas and server-action wiring (auth, resolvers and cache mocked).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: vi.fn(async () => ({
    id: "user-1",
    email: "u@example.com",
    name: "U",
    role: "USER",
  })),
}));
vi.mock("@/lib/applications/service", () => ({
  userTimezone: vi.fn(async () => "America/Los_Angeles"),
}));
vi.mock("@/lib/ingest/review", () => {
  class ReviewError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ReviewError,
    resolveEmailReview: vi.fn(async () => ({
      message: "Created Acme – Helper as Submitted.",
      applicationId: "app-1",
      xpAwarded: 25,
    })),
    resolveCaptureReview: vi.fn(async () => ({
      message: "Capture dismissed. Nothing was changed.",
      applicationId: null,
      xpAwarded: 0,
    })),
    resolveInterviewInvite: vi.fn(async () => ({
      message: "Interview added to Acme – Helper.",
      applicationId: "app-1",
      xpAwarded: 0,
    })),
  };
});
vi.mock("@/lib/dedup/merge", () => {
  class DuplicateError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    DuplicateError,
    dismissDuplicate: vi.fn(async () => undefined),
    mergeDuplicateCandidate: vi.fn(async () => ({
      keepId: "11111111-1111-4111-8111-111111111111",
      mergedId: "22222222-2222-4222-8222-222222222222",
      statusChange: {
        attempted: true,
        applied: false,
        status: "SUBMITTED",
        message: "Inferred change not applied.",
      },
    })),
  };
});
vi.mock("@/lib/dedup/scan", () => ({
  scanDuplicates: vi.fn(async () => ({
    scanned: 12,
    found: 2,
    created: 1,
    updated: 0,
    removed: 0,
    skipped: 1,
  })),
}));

import { revalidatePath } from "next/cache";
import {
  resolveCaptureReviewAction,
  resolveDuplicateAction,
  resolveEmailReviewAction,
  resolveInterviewInviteAction,
  scanDuplicatesAction,
} from "@/lib/ingest/review-actions";
import {
  ReviewError,
  resolveEmailReview,
  resolveInterviewInvite,
} from "@/lib/ingest/review";
import { mergeDuplicateCandidate } from "@/lib/dedup/merge";
import {
  emailReviewFormSchema,
  parseDecision,
} from "@/lib/ingest/review-schemas";

const EMAIL_ID = "33333333-3333-4333-8333-333333333333";
const APP_ID = "44444444-4444-4444-8444-444444444444";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("review form schemas", () => {
  const base = { emailId: EMAIL_ID, status: "SUBMITTED" };
  it("parses every decision", () => {
    expect(
      parseDecision(
        emailReviewFormSchema.parse({
          ...base,
          decision: "create",
          company: "Acme",
          title: "Helper",
        }),
      ),
    ).toEqual({ kind: "create" });
    expect(
      parseDecision(
        emailReviewFormSchema.parse({ ...base, decision: "dismiss" }),
      ),
    ).toEqual({ kind: "dismiss" });
    expect(
      parseDecision(
        emailReviewFormSchema.parse({ ...base, decision: `attach:${APP_ID}` }),
      ),
    ).toEqual({ kind: "attach", applicationId: APP_ID });
    expect(
      parseDecision(
        emailReviewFormSchema.parse({
          ...base,
          decision: "attach-other",
          otherApplicationId: APP_ID,
        }),
      ),
    ).toEqual({
      kind: "attach",
      applicationId: APP_ID,
    });
  });

  it("requires company and title to create, a target to attach, and a known decision", () => {
    const r = emailReviewFormSchema.safeParse({
      ...base,
      decision: "create",
      company: " ",
      title: "",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join("."))).toEqual(
      expect.arrayContaining(["company", "title"]),
    );
    expect(
      emailReviewFormSchema.safeParse({
        ...base,
        decision: "attach-other",
        otherApplicationId: "",
      }).success,
    ).toBe(false);
    expect(
      emailReviewFormSchema.safeParse({
        ...base,
        decision: "attach:not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      emailReviewFormSchema.safeParse({
        ...base,
        decision: "delete-everything",
      }).success,
    ).toBe(false);
    expect(
      emailReviewFormSchema.safeParse({
        ...base,
        decision: "dismiss",
        status: "BOGUS",
      }).success,
    ).toBe(false);
  });
});

describe("review server actions", () => {
  it("resolves an email with the clicked decision, converting the interview time in the user's timezone", async () => {
    const res = await resolveEmailReviewAction(
      null,
      form({
        emailId: EMAIL_ID,
        decision: "create",
        company: "Acme",
        title: "Helper",
        location: "",
        status: "INTERVIEWING",
        interviewAt: "2026-03-10T10:00",
        interviewType: "ONSITE",
      }),
    );
    expect(res).toEqual({
      ok: true,
      data: { message: "Created Acme – Helper as Submitted." },
    });
    expect(resolveEmailReview).toHaveBeenCalledWith(
      "user-1",
      EMAIL_ID,
      { kind: "create" },
      {
        company: "Acme",
        title: "Helper",
        location: undefined,
        status: "INTERVIEWING",
        interviewAt: new Date("2026-03-10T17:00:00.000Z"),
        interviewType: "ONSITE",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      "/applications/review",
      "layout",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1");
  });

  it("leaves the interview time untouched when the form has no interview field, and reports field errors", async () => {
    await resolveEmailReviewAction(
      null,
      form({
        emailId: EMAIL_ID,
        decision: `attach:${APP_ID}`,
        status: "CONFIRMED",
      }),
    );
    expect(vi.mocked(resolveEmailReview).mock.calls[0]![3]).toMatchObject({
      interviewAt: undefined,
    });

    const bad = await resolveEmailReviewAction(
      null,
      form({ emailId: EMAIL_ID, decision: "create", status: "SUBMITTED" }),
    );
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.fieldErrors?.company).toBeTruthy();
  });

  it("turns known errors into messages", async () => {
    vi.mocked(resolveEmailReview).mockRejectedValueOnce(
      new ReviewError("INVALID", "That email was already reviewed."),
    );
    const res = await resolveEmailReviewAction(
      null,
      form({ emailId: EMAIL_ID, decision: "dismiss", status: "SAVED" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "That email was already reviewed.",
      fieldErrors: undefined,
    });
  });

  it("wires captures, interview invitations, duplicates and scans", async () => {
    expect(
      (
        await resolveCaptureReviewAction(
          null,
          form({ captureId: EMAIL_ID, decision: "dismiss", status: "SAVED" }),
        )
      ).ok,
    ).toBe(true);

    const invite = await resolveInterviewInviteAction(
      null,
      form({
        emailId: EMAIL_ID,
        decision: "add",
        scheduledAt: "2026-03-10T10:00",
        interviewType: "VIDEO",
      }),
    );
    expect(invite.ok).toBe(true);
    expect(resolveInterviewInvite).toHaveBeenCalledWith("user-1", EMAIL_ID, {
      decision: "add",
      scheduledAt: new Date("2026-03-10T17:00:00.000Z"),
      type: "VIDEO",
    });
    const noTime = await resolveInterviewInviteAction(
      null,
      form({ emailId: EMAIL_ID, decision: "add", scheduledAt: "" }),
    );
    expect(noTime.ok).toBe(false);

    const merge = await resolveDuplicateAction(
      null,
      form({ candidateId: EMAIL_ID, decision: "merge", keepId: APP_ID }),
    );
    expect(merge).toEqual({
      ok: true,
      data: {
        message:
          "Merged into one record. Stage kept: Inferred change not applied.",
      },
    });
    expect(mergeDuplicateCandidate).toHaveBeenCalledWith(
      "user-1",
      EMAIL_ID,
      APP_ID,
    );
    expect(
      (
        await resolveDuplicateAction(
          null,
          form({ candidateId: EMAIL_ID, decision: "merge" }),
        )
      ).ok,
    ).toBe(false);
    expect(
      await resolveDuplicateAction(
        null,
        form({ candidateId: EMAIL_ID, decision: "dismiss" }),
      ),
    ).toMatchObject({ ok: true });

    expect(await scanDuplicatesAction(null, new FormData())).toEqual({
      ok: true,
      data: {
        message:
          "Scanned 12 applications: 1 new possible duplicate, 1 you already dismissed.",
      },
    });
  });
});
