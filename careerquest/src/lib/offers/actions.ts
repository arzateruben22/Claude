"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/audit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { parseDateInput } from "@/lib/applications/time";
import { userTimezone } from "@/lib/applications/service";
import { benefitsFromForm, offerFormSchema, readOfferForm } from "./schema";
import { OfferApplicationNotFoundError, createOffer, deleteOffer, moveApplicationToOffer, updateOffer, type OfferData } from "./service";

export type OfferActionData = { message: string; xpAwarded?: number };

const idSchema = z.uuid();

function revalidateOffers(applicationId?: string, offerId?: string) {
  revalidatePath("/salary/offers");
  if (offerId) revalidatePath(`/salary/offers/${offerId}`);
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
}

async function parseOffer(formData: FormData, userId: string): Promise<{ data: OfferData } | { error: ActionResult<OfferActionData> }> {
  const parsed = offerFormSchema.safeParse(readOfferForm(formData));
  if (!parsed.success) return { error: fromZodError(parsed.error) };
  const v = parsed.data;
  const tz = await userTimezone(userId);
  return {
    data: {
      baseAmount: v.baseAmount,
      period: v.period,
      hoursPerWeek: v.hoursPerWeek,
      overtimeHours: v.overtimeHours,
      signingBonus: v.signingBonus,
      annualBonus: v.annualBonus,
      benefitsValue: v.benefitsValue,
      benefits: benefitsFromForm(v),
      startDate: parseDateInput(v.startDate, tz),
      decisionDue: parseDateInput(v.decisionDue, tz),
      status: v.status,
      notes: v.notes,
    },
  };
}

export async function createOfferAction(_prev: ActionResult<OfferActionData> | null, formData: FormData): Promise<ActionResult<OfferActionData>> {
  const user = await requireUser();
  if (!rateLimit(`offer-write:${user.id}`, 60, 60_000).ok) return fail("Too many changes in a short time. Wait a minute and try again.");
  const applicationId = idSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) return fail("Choose the application this offer belongs to.", { applicationId: ["Choose an application."] });
  const parsed = await parseOffer(formData, user.id);
  if ("error" in parsed) return parsed.error;
  let offerId: string;
  try {
    const offer = await createOffer(user.id, applicationId.data, parsed.data);
    offerId = offer.id;
  } catch (err) {
    if (err instanceof OfferApplicationNotFoundError) return fail("That application was not found in your tracker.", { applicationId: ["Choose one of your applications."] });
    console.error("createOfferAction failed", err);
    return fail("Something went wrong saving the offer. Please try again.");
  }
  revalidateOffers(applicationId.data, offerId);
  redirect(`/salary/offers/${offerId}`);
}

export async function updateOfferAction(_prev: ActionResult<OfferActionData> | null, formData: FormData): Promise<ActionResult<OfferActionData>> {
  const user = await requireUser();
  if (!rateLimit(`offer-write:${user.id}`, 60, 60_000).ok) return fail("Too many changes in a short time. Wait a minute and try again.");
  const id = idSchema.safeParse(formData.get("offerId"));
  if (!id.success) return fail("That offer was not found.");
  const parsed = await parseOffer(formData, user.id);
  if ("error" in parsed) return parsed.error;
  let applicationId: string;
  try {
    const updated = await updateOffer(user.id, id.data, parsed.data);
    if (!updated) return fail("That offer was not found.");
    applicationId = updated.applicationId;
  } catch (err) {
    console.error("updateOfferAction failed", err);
    return fail("Something went wrong saving the offer. Please try again.");
  }
  revalidateOffers(applicationId, id.data);
  redirect(`/salary/offers/${id.data}`);
}

export async function deleteOfferAction(_prev: ActionResult<OfferActionData> | null, formData: FormData): Promise<ActionResult<OfferActionData>> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("offerId"));
  if (!id.success) return fail("That offer was not found.");
  let applicationId: string;
  try {
    const removed = await deleteOffer(user.id, id.data);
    if (!removed) return fail("That offer was not found.");
    applicationId = removed.applicationId;
  } catch (err) {
    console.error("deleteOfferAction failed", err);
    return fail("Something went wrong deleting the offer. Please try again.");
  }
  await audit("offer.delete", { userId: user.id, entityType: "Offer", entityId: id.data, metadata: { applicationId } });
  revalidateOffers(applicationId, id.data);
  redirect("/salary/offers");
}

/** Explicit user action: move the linked application to the Offer stage. */
export async function moveToOfferStageAction(_prev: ActionResult<OfferActionData> | null, formData: FormData): Promise<ActionResult<OfferActionData>> {
  const user = await requireUser();
  const applicationId = idSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) return fail("Application not found.");
  try {
    const res = await moveApplicationToOffer(user.id, applicationId.data);
    if (!res.ok) return fail(res.message);
    revalidateOffers(applicationId.data);
    revalidatePath("/applications");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    revalidatePath("/salary/offers/new");
    return ok({ message: res.xpAwarded > 0 ? `${res.message} +${res.xpAwarded} XP` : res.message, xpAwarded: res.xpAwarded });
  } catch (err) {
    console.error("moveToOfferStageAction failed", err);
    return fail("Something went wrong updating the application. Please try again.");
  }
}
