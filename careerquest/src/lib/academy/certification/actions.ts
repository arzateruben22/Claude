"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { readFormFile } from "@/lib/documents/service";
import { CERT_DATE_FIELDS, certificationStatusSchema, classificationSchema, verifyCertificationSchema } from "./form";
import { removeCertificationVerification, saveCertificationStatus, verifyCertification } from "./service";

type Msg = { message: string };

function limited(userId: string): string | null {
  const rl = rateLimit(`certification-write:${userId}`, 30, 60_000);
  return rl.ok ? null : `Too many changes. Try again in ${rl.retryAfterSeconds} s.`;
}

function revalidateCertification() {
  revalidatePath("/academy", "layout");
  revalidatePath("/missions", "layout");
  revalidatePath("/dashboard");
}

const str = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
};

export async function saveCertificationStatusAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const raw: Record<string, string | undefined> = {
    classification: str(formData, "classification"),
    schoolEnrolled: str(formData, "schoolEnrolled"),
    notes: str(formData, "notes"),
  };
  for (const f of CERT_DATE_FIELDS) raw[f] = str(formData, f);
  const parsed = certificationStatusSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const result = await saveCertificationStatus(user.id, parsed.data);
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidateCertification();
  return ok({ message: result.message });
}

export async function verifyCertificationAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = verifyCertificationSchema.safeParse({ classification: str(formData, "classification"), documentId: str(formData, "documentId") ?? "" });
  if (!parsed.success) return fromZodError(parsed.error);
  const result = await verifyCertification(user.id, parsed.data.classification, {
    documentId: parsed.data.documentId,
    newFile: readFormFile(formData, "file"),
  });
  if (!result.ok) return fail(result.error, result.fieldErrors);
  await audit("certification.verify", { userId: user.id, entityType: "CertificationStatus", metadata: { classification: parsed.data.classification } });
  revalidateCertification();
  return ok({ message: result.message });
}

export async function removeCertificationVerificationAction(_prev: ActionResult<Msg> | null, formData: FormData): Promise<ActionResult<Msg>> {
  const user = await requireUser();
  const blocked = limited(user.id);
  if (blocked) return fail(blocked);
  const parsed = classificationSchema.safeParse(str(formData, "classification"));
  if (!parsed.success) return fail("Unknown classification.");
  const result = await removeCertificationVerification(user.id, parsed.data);
  if (!result.ok) return fail(result.error);
  await audit("certification.unverify", { userId: user.id, entityType: "CertificationStatus", metadata: { classification: parsed.data } });
  revalidateCertification();
  return ok({ message: result.message });
}
