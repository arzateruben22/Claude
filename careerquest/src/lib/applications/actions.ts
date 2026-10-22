"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/audit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import {
  applicationInputSchema,
  type ApplicationInput,
} from "@/lib/validation/application";
import {
  applicationIdSchema,
  followUpSchema,
  interviewOutcomeSchema,
  interviewSchema,
  noteSchema,
  statusChangeFormSchema,
} from "@/lib/validation/application-detail";
import * as svc from "./service";
import { parseDateInput } from "./time";
import { STATUS_LABELS, countsAsSubmission } from "./status";

/**
 * Server actions for the tracker UI. Every action authenticates, validates with zod, delegates to
 * the service (which scopes by userId) and revalidates the affected paths.
 */

export type MutationData = { message: string; xpAwarded: number };
export type StatusChangeData = MutationData & { status: ApplicationStatus };

const APPLICATION_FIELDS = [
  "companyName",
  "positionTitle",
  "jobCategory",
  "postingUrl",
  "requisitionNumber",
  "source",
  "submissionDestination",
  "location",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "employmentType",
  "status",
  "appliedAt",
  "followUpAt",
  "recruiterName",
  "recruiterEmail",
  "notes",
  "jobDescription",
  "resumeVersionId",
  "coverLetterVersionId",
] as const;

const CHECKBOX_FIELDS = [
  "remote",
  "isQualified",
  "requiresCompanyVehicle",
  "requiresDrivingRecord",
  "requiresCdl",
] as const;

function text(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

function readApplicationForm(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of APPLICATION_FIELDS) {
    const v = text(formData, k);
    // Empty selects for optional enums must be absent, not "".
    if (
      v !== undefined &&
      !((k === "submissionDestination" || k === "salaryPeriod") && v === "")
    )
      out[k] = v;
  }
  for (const k of CHECKBOX_FIELDS) out[k] = checked(formData, k);
  return out;
}

/** Re-interpret date inputs in the user's timezone (zod parsed them as UTC midnight). */
function withZonedDates(
  data: ApplicationInput,
  formData: FormData,
  timezone: string,
): ApplicationInput {
  return {
    ...data,
    appliedAt:
      parseDateInput(text(formData, "appliedAt"), timezone) ?? undefined,
    followUpAt:
      parseDateInput(text(formData, "followUpAt"), timezone) ?? undefined,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof svc.ApplicationNotFoundError) return err.message;
  console.error("applications action failed", err);
  return "Something went wrong saving that. Please try again.";
}

function revalidateApplication(id?: string) {
  revalidatePath("/applications");
  if (id) revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
}

function xpSuffix(xp: number) {
  return xp > 0 ? ` +${xp} XP` : "";
}

// ---------------------------------------------------------------------------

export async function createApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = applicationInputSchema.safeParse(
    readApplicationForm(formData),
  );
  if (!parsed.success) return fromZodError(parsed.error);
  const timezone = await svc.userTimezone(user.id);
  const input = withZonedDates(parsed.data, formData, timezone);
  if (
    input.appliedAt &&
    !countsAsSubmission({ from: null, to: input.status, appliedAt: input.appliedAt })
  ) {
    const msg = `A ${STATUS_LABELS[input.status].toLowerCase()} application has not been sent yet. Clear the date, or pick the stage it is actually at.`;
    return fail("Some fields need attention.", { appliedAt: [msg] });
  }
  let id: string;
  let xp = 0;
  try {
    const r = await svc.createApplication(user.id, input);
    id = r.application.id;
    xp = r.xpAwarded;
  } catch (err) {
    return fail(errorMessage(err));
  }
  await audit("application.create", {
    userId: user.id,
    entityType: "Application",
    entityId: id,
    metadata: { status: parsed.data.status, xp },
  });
  revalidateApplication(id);
  redirect(`/applications/${id}${xp > 0 ? `?xp=${xp}` : ""}`);
}

export async function updateApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const idParsed = applicationIdSchema.safeParse({
    applicationId: text(formData, "applicationId"),
  });
  if (!idParsed.success) return fail("Missing application id.");
  const parsed = applicationInputSchema.safeParse(
    readApplicationForm(formData),
  );
  if (!parsed.success) return fromZodError(parsed.error);
  const timezone = await svc.userTimezone(user.id);
  const id = idParsed.data.applicationId;
  try {
    await svc.updateApplication(
      user.id,
      id,
      withZonedDates(parsed.data, formData, timezone),
    );
  } catch (err) {
    return fail(errorMessage(err));
  }
  await audit("application.update", {
    userId: user.id,
    entityType: "Application",
    entityId: id,
  });
  revalidateApplication(id);
  redirect(`/applications/${id}`);
}

export async function changeStatusAction(
  _prev: ActionResult<StatusChangeData> | null,
  formData: FormData,
): Promise<ActionResult<StatusChangeData>> {
  const user = await requireUser();
  const parsed = statusChangeFormSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    status: text(formData, "status"),
    occurredAt: text(formData, "occurredAt"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const { applicationId, status, note } = parsed.data;
  const timezone = await svc.userTimezone(user.id);
  const occurredAt =
    parseDateInput(parsed.data.occurredAt, timezone) ?? undefined;
  let result: svc.ChangeStatusResult;
  try {
    result = await svc.changeStatus(user.id, applicationId, {
      status,
      occurredAt,
      note: note ?? null,
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  if (!result.applied) return fail(result.message);
  await audit("application.status", {
    userId: user.id,
    entityType: "Application",
    entityId: applicationId,
    metadata: { from: result.fromStatus, to: result.toStatus },
  });
  revalidateApplication(applicationId);
  return ok({
    status: result.toStatus,
    xpAwarded: result.xpAwarded,
    message: result.confirmed
      ? `Confirmed: ${STATUS_LABELS[result.toStatus]}.${xpSuffix(result.xpAwarded)}`
      : `Marked as ${STATUS_LABELS[result.toStatus]}.${xpSuffix(result.xpAwarded)}`,
  });
}

export async function followUpAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = followUpSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    occurredAt: text(formData, "occurredAt"),
    nextFollowUpAt: text(formData, "nextFollowUpAt"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const timezone = await svc.userTimezone(user.id);
  const { applicationId, note } = parsed.data;
  try {
    const r = await svc.recordFollowUp(user.id, applicationId, {
      note: note ?? null,
      occurredAt: parseDateInput(parsed.data.occurredAt, timezone) ?? undefined,
      nextFollowUpAt: parseDateInput(parsed.data.nextFollowUpAt, timezone),
    });
    revalidateApplication(applicationId);
    const message = r.eventCreated
      ? `Follow-up logged.${xpSuffix(r.xpAwarded)}`
      : "That follow-up was already logged for the same time.";
    return ok({ message, xpAwarded: r.xpAwarded });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function addNoteAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await svc.addNote(user.id, parsed.data.applicationId, parsed.data.note);
    revalidateApplication(parsed.data.applicationId);
    return ok({ message: "Note added.", xpAwarded: 0 });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function scheduleInterviewAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = interviewSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    type: text(formData, "type") || undefined,
    scheduledAt: text(formData, "scheduledAt"),
    durationMinutes: text(formData, "durationMinutes"),
    interviewer: text(formData, "interviewer"),
    location: text(formData, "location"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const timezone = await svc.userTimezone(user.id);
  const scheduledAt = parseDateInput(parsed.data.scheduledAt, timezone);
  if (!scheduledAt)
    return fail("Enter a valid date and time.", {
      scheduledAt: ["Enter a valid date and time."],
    });
  const { applicationId, type, durationMinutes, interviewer, location, notes } =
    parsed.data;
  try {
    const r = await svc.scheduleInterview(user.id, applicationId, {
      type,
      scheduledAt,
      durationMinutes: durationMinutes ?? null,
      interviewer,
      location,
      notes,
    });
    revalidateApplication(applicationId);
    const moved = r.statusChange?.applied
      ? " Status moved to Interviewing."
      : "";
    return ok({
      message: `Interview scheduled.${moved}${xpSuffix(r.xpAwarded)}`,
      xpAwarded: r.xpAwarded,
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function interviewOutcomeAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = interviewOutcomeSchema.safeParse({
    interviewId: text(formData, "interviewId"),
    outcome: text(formData, "outcome"),
    attended: text(formData, "attended"),
    prepCompleted: text(formData, "prepCompleted"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const applicationId = text(formData, "applicationId");
  const { interviewId, outcome, attended, prepCompleted } = parsed.data;
  try {
    const r = await svc.markInterviewOutcome(user.id, interviewId, {
      outcome,
      attended,
      prepCompleted,
    });
    revalidateApplication(r.interview.applicationId);
    if (applicationId && applicationId !== r.interview.applicationId)
      revalidatePath(`/applications/${applicationId}`);
    return ok({
      message: `Interview updated.${xpSuffix(r.xpAwarded)}`,
      xpAwarded: r.xpAwarded,
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function archiveApplicationAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = applicationIdSchema.safeParse({
    applicationId: text(formData, "applicationId"),
  });
  if (!parsed.success) return fail("Missing application id.");
  try {
    await svc.archiveApplication(user.id, parsed.data.applicationId);
    await audit("application.archive", {
      userId: user.id,
      entityType: "Application",
      entityId: parsed.data.applicationId,
    });
    revalidateApplication(parsed.data.applicationId);
    return ok({
      message:
        "Application archived. It stays in your history and can be restored.",
      xpAwarded: 0,
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function restoreApplicationAction(
  _prev: ActionResult<MutationData> | null,
  formData: FormData,
): Promise<ActionResult<MutationData>> {
  const user = await requireUser();
  const parsed = applicationIdSchema.safeParse({
    applicationId: text(formData, "applicationId"),
  });
  if (!parsed.success) return fail("Missing application id.");
  try {
    await svc.restoreApplication(user.id, parsed.data.applicationId);
    revalidateApplication(parsed.data.applicationId);
    return ok({ message: "Application restored.", xpAwarded: 0 });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = applicationIdSchema.safeParse({
    applicationId: text(formData, "applicationId"),
  });
  if (!parsed.success) return fail("Missing application id.");
  try {
    await svc.deleteApplication(user.id, parsed.data.applicationId);
  } catch (err) {
    return fail(errorMessage(err));
  }
  await audit("application.delete", {
    userId: user.id,
    entityType: "Application",
    entityId: parsed.data.applicationId,
  });
  revalidateApplication();
  redirect("/applications?deleted=1");
}
