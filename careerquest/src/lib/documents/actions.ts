"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { deleteDocument, readFormFile, saveFormFile } from "./service";
import { documentIdSchema, uploadDocumentSchema, type UploadedDocumentInfo } from "./form";

/**
 * Document upload/delete. Authenticated, rate-limited, validated; files are checked by size,
 * extension allowlist and magic bytes in the service before anything is stored.
 */

function revalidateRecords() {
  revalidatePath("/academy", "layout");
  revalidatePath("/missions", "layout");
  revalidatePath("/dashboard");
}

export async function uploadDocumentAction(
  _prev: ActionResult<{ message: string; document: UploadedDocumentInfo }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string; document: UploadedDocumentInfo }>> {
  const user = await requireUser();
  const rl = rateLimit(`documents-upload:${user.id}`, 20, 10 * 60_000);
  if (!rl.ok) return fail(`Too many uploads. Try again in ${rl.retryAfterSeconds} s.`);
  const parsed = uploadDocumentSchema.safeParse({ kind: formData.get("kind") });
  if (!parsed.success) return fail("Choose what kind of document this is.", { kind: ["Choose what kind of document this is."] });
  const file = readFormFile(formData, "file");
  if (!file) return fail("Choose a file to upload.", { file: ["Choose a file to upload."] });
  const saved = await saveFormFile(user.id, parsed.data.kind, file);
  if (!saved.ok) return fail(saved.error, { file: [saved.error] });
  await audit("document.upload", {
    userId: user.id,
    entityType: "Document",
    entityId: saved.document.id,
    metadata: { kind: saved.document.kind, sizeBytes: saved.document.sizeBytes, mimeType: saved.document.mimeType },
  });
  revalidateRecords();
  return ok({
    message: `Uploaded ${saved.document.fileName}.`,
    document: { id: saved.document.id, fileName: saved.document.fileName, kind: saved.document.kind },
  });
}

export async function deleteDocumentAction(
  _prev: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  const rl = rateLimit(`documents-delete:${user.id}`, 30, 60_000);
  if (!rl.ok) return fail(`Too many requests. Try again in ${rl.retryAfterSeconds} s.`);
  const parsed = documentIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return fail("That document was not found.");
  const result = await deleteDocument(user.id, parsed.data.id);
  if (!result.ok) return fail(result.error);
  await audit("document.delete", {
    userId: user.id,
    entityType: "Document",
    entityId: parsed.data.id,
    metadata: { downgradedEntries: result.downgradedEntries, revokedCertifications: result.revokedCertifications },
  });
  revalidateRecords();
  const extra: string[] = [];
  if (result.downgradedEntries > 0) {
    extra.push(`${result.downgradedEntries} work-hour entr${result.downgradedEntries === 1 ? "y is" : "ies are"} now self-reported`);
  }
  if (result.revokedCertifications.length > 0) extra.push("the certification it verified is no longer marked verified");
  return ok({ message: `Deleted ${result.fileName}${extra.length ? ` — ${extra.join("; ")}` : ""}.` });
}
