import "server-only";
import { prisma } from "@/lib/db";
import type { DocumentKind } from "@/generated/prisma/enums";
import { revokeXpForSource } from "@/lib/game/xp";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { lockPlayer, safeTimezone } from "@/lib/game/facts";
import { todayInTz } from "@/lib/dates";
import { afterHoursChangeTx } from "@/lib/academy/hours/rewards";
import { CERT_XP_SOURCE, parseCertificationSourceId } from "@/lib/academy/certification/constants";
import { readStoredFile, removeStoredFile, sha256Hex, writeStoredFile } from "./storage";
import { contentDisposition, isAllowedMime, precheckUpload, validateUpload, type UploadCandidate } from "./validation";

/**
 * User documents (pay stubs, hour reports, certificates, résumés). Every query is scoped by the
 * authenticated userId; another user's document is indistinguishable from a missing one.
 */

export type DocumentSummary = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
};

const SUMMARY_SELECT = { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDocumentId(id: string): boolean {
  return UUID.test(id);
}

export type SaveResult = { ok: true; document: DocumentSummary } | { ok: false; error: string; code: string };

/** Validate and store an upload, then create its Document row. The file is removed if the row fails. */
export async function saveDocument(userId: string, kind: DocumentKind, file: UploadCandidate): Promise<SaveResult> {
  const check = validateUpload(file);
  if (!check.ok) return { ok: false, error: check.error, code: check.code };
  const storagePath = await writeStoredFile(file.bytes, check.extension);
  try {
    const document = await prisma.document.create({
      data: {
        userId,
        kind,
        fileName: check.fileName,
        mimeType: check.mimeType,
        sizeBytes: file.bytes.byteLength,
        storagePath,
        sha256: sha256Hex(file.bytes),
      },
      select: SUMMARY_SELECT,
    });
    return { ok: true, document };
  } catch (err) {
    await removeStoredFile(storagePath);
    throw err;
  }
}

/** A Blob-like value read from FormData (a `File` in Node 20+). */
export type FormFile = { name: string; size: number; type?: string; arrayBuffer(): Promise<ArrayBuffer> };

export function readFormFile(formData: FormData, field: string): FormFile | null {
  const value = formData.get(field);
  if (!value || typeof value === "string") return null;
  const f = value as unknown as Partial<FormFile>;
  if (typeof f.arrayBuffer !== "function" || typeof f.size !== "number") return null;
  // Browsers send an empty part when no file was chosen. Its name is "" in a plain form post but can
  // arrive as "undefined" or "blob" through the Server Actions transport, so a zero-byte part always
  // means "no file" (a real zero-byte upload is never a valid document either).
  if (f.size === 0) return null;
  return { name: typeof f.name === "string" ? f.name : "", size: f.size, type: f.type, arrayBuffer: () => f.arrayBuffer!() };
}

/** Size/extension pre-checks run before the bytes are read into memory. */
export async function saveFormFile(userId: string, kind: DocumentKind, file: FormFile): Promise<SaveResult> {
  const pre = precheckUpload(file.name, file.size);
  if (pre && !pre.ok) return { ok: false, error: pre.error, code: pre.code };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return saveDocument(userId, kind, { name: file.name, size: file.size, bytes });
}

export async function listDocuments(userId: string, kinds?: readonly DocumentKind[]): Promise<DocumentSummary[]> {
  return prisma.document.findMany({
    where: { userId, ...(kinds ? { kind: { in: [...kinds] } } : {}) },
    orderBy: { createdAt: "desc" },
    select: SUMMARY_SELECT,
    take: 200,
  });
}

export async function getOwnedDocument(userId: string, id: string): Promise<DocumentSummary | null> {
  if (!isDocumentId(id)) return null;
  return prisma.document.findFirst({ where: { id, userId }, select: SUMMARY_SELECT });
}

export type DeleteResult =
  | { ok: true; fileName: string; downgradedEntries: number; revokedCertifications: string[] }
  | { ok: false; error: string };

/**
 * Delete a document and its file. Work-hour entries it backed lose their verification (they become
 * SELF_REPORTED, with milestone XP re-synced), and a certification it verified is un-verified
 * (CERTIFICATION_VERIFIED XP revoked). The row is removed in one transaction; the file afterwards.
 */
export async function deleteDocument(userId: string, id: string, now = new Date()): Promise<DeleteResult> {
  if (!isDocumentId(id)) return { ok: false, error: "That document was not found." };
  const result = await prisma.$transaction(
    async (tx) => {
      await lockPlayer(tx, userId);
      const doc = await tx.document.findFirst({ where: { id, userId }, select: { id: true, fileName: true, storagePath: true } });
      if (!doc) return null;
      const profile = await tx.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
      const today = todayInTz(safeTimezone(profile?.timezone), now);

      const downgraded = await tx.workHourEntry.updateMany({
        where: { userId, documentId: id, verification: { in: ["EMPLOYER_VERIFIED", "OFFICIAL_RECORD"] } },
        data: { verification: "SELF_REPORTED", documentId: null },
      });
      await tx.workHourEntry.updateMany({ where: { userId, documentId: id }, data: { documentId: null } });

      const certRows = await tx.xpLedger.findMany({
        where: { userId, sourceType: CERT_XP_SOURCE, sourceId: { endsWith: `:${id}` }, amount: { gt: 0 } },
        select: { sourceId: true },
      });
      const revokedCertifications: string[] = [];
      for (const row of certRows) {
        const parsed = parseCertificationSourceId(row.sourceId);
        if (!parsed || parsed.documentId !== id) continue;
        const amount = await revokeXpForSource(tx, userId, CERT_XP_SOURCE, row.sourceId!);
        if (amount > 0) revokedCertifications.push(parsed.classification);
      }

      await tx.document.delete({ where: { id: doc.id } });

      if (downgraded.count > 0) {
        await afterHoursChangeTx(tx, { userId, now, activityDate: today });
      } else if (revokedCertifications.length > 0) {
        await applyEventToMissions(tx, { userId, type: "PROFILE_UPDATED", occurredAt: now, activityDate: today });
        await evaluateAchievements(tx, userId);
      }
      return { doc, downgradedEntries: downgraded.count, revokedCertifications };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  if (!result) return { ok: false, error: "That document was not found." };
  await removeStoredFile(result.doc.storagePath);
  return { ok: true, fileName: result.doc.fileName, downgradedEntries: result.downgradedEntries, revokedCertifications: result.revokedCertifications };
}

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
} as const;

function notFound(): Response {
  return Response.json({ error: "Not found" }, { status: 404, headers: BASE_HEADERS });
}

/**
 * The download response for the owner of a document; 404 for anyone else (and for missing files),
 * so the existence of other users' documents is never revealed. Always an attachment, never inline.
 */
export async function documentDownloadResponse(userId: string, id: string): Promise<Response> {
  if (!isDocumentId(id)) return notFound();
  const doc = await prisma.document.findFirst({
    where: { id, userId },
    select: { fileName: true, mimeType: true, storagePath: true },
  });
  if (!doc) return notFound();
  const bytes = await readStoredFile(doc.storagePath);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": isAllowedMime(doc.mimeType) ? doc.mimeType : "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": contentDisposition(doc.fileName),
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
