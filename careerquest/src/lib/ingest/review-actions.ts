"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { userTimezone } from "@/lib/applications/service";
import { parseDateInput } from "@/lib/applications/time";
import {
  DuplicateError,
  dismissDuplicate,
  mergeDuplicateCandidate,
} from "@/lib/dedup/merge";
import { scanDuplicates } from "@/lib/dedup/scan";
import { IngestNotFoundError, IngestValidationError } from "./rules";
import {
  ReviewError,
  resolveCaptureReview,
  resolveEmailReview,
  resolveInterviewInvite,
  type ReviewEdits,
} from "./review";
import {
  captureReviewFormSchema,
  duplicateFormSchema,
  emailReviewFormSchema,
  interviewInviteFormSchema,
  parseDecision,
} from "./review-schemas";

/**
 * Server actions for the review queue. Each one authenticates, validates with zod, delegates to the
 * owner-scoped resolvers in `review.ts` / `src/lib/dedup` and revalidates the affected pages.
 */

export type ReviewActionData = { message: string };

function fields(
  formData: FormData,
  keys: readonly string[],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : undefined;
  }
  return out;
}

const ITEM_KEYS = [
  "decision",
  "otherApplicationId",
  "company",
  "title",
  "location",
  "status",
  "interviewAt",
  "interviewType",
] as const;

function revalidateReview(applicationId?: string | null) {
  revalidatePath("/applications/review", "layout");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
}

function knownError(err: unknown): string | null {
  if (
    err instanceof ReviewError ||
    err instanceof DuplicateError ||
    err instanceof IngestValidationError
  )
    return err.message;
  if (err instanceof IngestNotFoundError)
    return "That application no longer exists.";
  return null;
}

function editsFrom(
  data: {
    company?: string;
    title?: string;
    location?: string;
    status: ReviewEdits["status"];
    interviewAt?: string;
    interviewType?: ReviewEdits["interviewType"];
  },
  formData: FormData,
  timezone: string,
): ReviewEdits {
  return {
    company: data.company,
    title: data.title,
    location: data.location,
    status: data.status,
    // Only interview items render the time field; an empty one means the user cleared it.
    interviewAt: formData.has("interviewAt")
      ? parseDateInput(data.interviewAt, timezone)
      : undefined,
    interviewType: data.interviewType,
  };
}

export async function resolveEmailReviewAction(
  _prev: ActionResult<ReviewActionData> | null,
  formData: FormData,
): Promise<ActionResult<ReviewActionData>> {
  const user = await requireUser();
  const parsed = emailReviewFormSchema.safeParse({
    emailId: formData.get("emailId"),
    ...fields(formData, ITEM_KEYS),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const tz = await userTimezone(user.id);
    const out = await resolveEmailReview(
      user.id,
      parsed.data.emailId,
      parseDecision(parsed.data),
      editsFrom(parsed.data, formData, tz),
    );
    revalidateReview(out.applicationId);
    return ok({ message: out.message });
  } catch (err) {
    const msg = knownError(err);
    if (msg) return fail(msg);
    throw err;
  }
}

export async function resolveCaptureReviewAction(
  _prev: ActionResult<ReviewActionData> | null,
  formData: FormData,
): Promise<ActionResult<ReviewActionData>> {
  const user = await requireUser();
  const parsed = captureReviewFormSchema.safeParse({
    captureId: formData.get("captureId"),
    ...fields(formData, ITEM_KEYS),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const tz = await userTimezone(user.id);
    const out = await resolveCaptureReview(
      user.id,
      parsed.data.captureId,
      parseDecision(parsed.data),
      editsFrom(parsed.data, formData, tz),
    );
    revalidateReview(out.applicationId);
    return ok({ message: out.message });
  } catch (err) {
    const msg = knownError(err);
    if (msg) return fail(msg);
    throw err;
  }
}

export async function resolveInterviewInviteAction(
  _prev: ActionResult<ReviewActionData> | null,
  formData: FormData,
): Promise<ActionResult<ReviewActionData>> {
  const user = await requireUser();
  const parsed = interviewInviteFormSchema.safeParse(
    fields(formData, ["emailId", "decision", "scheduledAt", "interviewType"]),
  );
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const tz = await userTimezone(user.id);
    const scheduledAt =
      parseDateInput(parsed.data.scheduledAt, tz) ?? undefined;
    const out = await resolveInterviewInvite(user.id, parsed.data.emailId, {
      decision: parsed.data.decision,
      scheduledAt,
      type: parsed.data.interviewType,
    });
    revalidateReview(out.applicationId);
    return ok({ message: out.message });
  } catch (err) {
    const msg = knownError(err);
    if (msg) return fail(msg);
    throw err;
  }
}

export async function resolveDuplicateAction(
  _prev: ActionResult<ReviewActionData> | null,
  formData: FormData,
): Promise<ActionResult<ReviewActionData>> {
  const user = await requireUser();
  const parsed = duplicateFormSchema.safeParse(
    fields(formData, ["candidateId", "decision", "keepId"]),
  );
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    if (parsed.data.decision === "dismiss") {
      await dismissDuplicate(user.id, parsed.data.candidateId);
      revalidateReview();
      return ok({
        message:
          "Marked as not a duplicate. This pair will not be suggested again.",
      });
    }
    const r = await mergeDuplicateCandidate(
      user.id,
      parsed.data.candidateId,
      parsed.data.keepId!,
    );
    revalidateReview(r.keepId);
    revalidatePath(`/applications/${r.mergedId}`);
    const stage = r.statusChange.attempted
      ? r.statusChange.applied
        ? ` ${r.statusChange.message}`
        : ` Stage kept: ${r.statusChange.message}`
      : "";
    return ok({ message: `Merged into one record.${stage}` });
  } catch (err) {
    const msg = knownError(err);
    if (msg) return fail(msg);
    throw err;
  }
}

export async function scanDuplicatesAction(
  _prev: ActionResult<ReviewActionData> | null,
  _formData: FormData,
): Promise<ActionResult<ReviewActionData>> {
  void _formData;
  const user = await requireUser();
  const limit = rateLimit(`dedup-scan:${user.id}`, 6, 60_000);
  if (!limit.ok)
    return fail(
      `Please wait ${limit.retryAfterSeconds}s before scanning again.`,
    );
  const r = await scanDuplicates(user.id);
  revalidateReview();
  const message =
    r.found === 0
      ? `Scanned ${r.scanned} application${r.scanned === 1 ? "" : "s"}: no possible duplicates found.`
      : `Scanned ${r.scanned} applications: ${r.created} new possible duplicate${r.created === 1 ? "" : "s"}${r.skipped ? `, ${r.skipped} you already dismissed` : ""}.`;
  return ok({ message });
}
