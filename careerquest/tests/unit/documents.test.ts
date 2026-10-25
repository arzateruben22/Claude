import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string; role: "USER" | "ADMIN" } }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => session.user) }));

import { prisma } from "@/lib/db";
import { contentDisposition, extensionOf, MAX_DOCUMENT_BYTES, sanitizeFileName, sniffFormat, validateUpload } from "@/lib/documents/validation";
import { deleteDocument, documentDownloadResponse, readFormFile, saveDocument, saveFormFile } from "@/lib/documents/service";
import { resolveStoragePath, uploadRoot } from "@/lib/documents/storage";
import { GET } from "@/app/api/documents/[id]/route";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("IHDR-fake-png-body")]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF-fake")]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x20, 0, 0, 0]), Buffer.from("WEBPVP8 fake")]);

let ownerId = "";
let otherId = "";
let tmp = "";
const previousUploadDir = process.env.UPLOAD_DIR;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cq-docs-"));
  process.env.UPLOAD_DIR = tmp;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  ownerId = (await prisma.user.create({ data: { email: `docs-owner+${stamp}@careerquest.test`, passwordHash: "x", name: "Owner", profile: { create: {} } }, select: { id: true } })).id;
  otherId = (await prisma.user.create({ data: { email: `docs-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other", profile: { create: {} } }, select: { id: true } })).id;
});

afterAll(async () => {
  for (const id of [ownerId, otherId]) if (id) await prisma.user.delete({ where: { id } }).catch(() => undefined);
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previousUploadDir;
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  await prisma.$disconnect();
});

const candidate = (name: string, bytes: Buffer, size = bytes.byteLength) => ({ name, size, bytes: new Uint8Array(bytes) });

describe("upload validation", () => {
  it("accepts allowlisted formats whose bytes match the extension", () => {
    expect(validateUpload(candidate("stub.pdf", PDF))).toMatchObject({ ok: true, mimeType: "application/pdf", extension: "pdf" });
    expect(validateUpload(candidate("card.PNG", PNG))).toMatchObject({ ok: true, mimeType: "image/png" });
    expect(validateUpload(candidate("photo.jpeg", JPEG))).toMatchObject({ ok: true, mimeType: "image/jpeg", extension: "jpg" });
    expect(validateUpload(candidate("photo.jpg", JPEG))).toMatchObject({ ok: true });
    expect(validateUpload(candidate("scan.webp", WEBP))).toMatchObject({ ok: true, mimeType: "image/webp" });
  });

  it("rejects wrong magic bytes", () => {
    expect(validateUpload(candidate("stub.pdf", Buffer.from("hello, I am plain text")))).toMatchObject({ ok: false, code: "CONTENT" });
    expect(validateUpload(candidate("x.png", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")))).toMatchObject({ ok: false, code: "CONTENT" });
    expect(sniffFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // RIFF/WAVE
  });

  it("rejects a disguised extension (content of another allowed type)", () => {
    expect(validateUpload(candidate("certificate.pdf", PNG))).toMatchObject({ ok: false, code: "MISMATCH" });
    expect(validateUpload(candidate("photo.png", JPEG))).toMatchObject({ ok: false, code: "MISMATCH" });
  });

  it("rejects disallowed extensions even with valid bytes", () => {
    for (const name of ["payload.exe", "page.html", "image.svg", "stub.pdf.exe", "noextension"]) {
      expect(validateUpload(candidate(name, PDF))).toMatchObject({ ok: false, code: "EXTENSION" });
    }
  });

  it("rejects empty and oversize files", () => {
    expect(validateUpload(candidate("stub.pdf", Buffer.alloc(0)))).toMatchObject({ ok: false, code: "EMPTY" });
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_DOCUMENT_BYTES)]);
    expect(validateUpload(candidate("stub.pdf", big))).toMatchObject({ ok: false, code: "TOO_LARGE" });
    expect(validateUpload(candidate("stub.pdf", PDF, MAX_DOCUMENT_BYTES + 1))).toMatchObject({ ok: false, code: "TOO_LARGE" });
  });

  it("sanitizes names and builds a safe Content-Disposition", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("C:\\Users\\me\\stub\u202Efdp.exe.pdf")).toBe("stubfdp.exe.pdf");
    expect(sanitizeFileName("a".repeat(300) + ".pdf")).toHaveLength(120);
    expect(extensionOf("x.tar.PDF")).toBe("pdf");
    const cd = contentDisposition('Pay "stub"; résumé.pdf');
    expect(cd.startsWith('attachment; filename="Pay _stub__ r_sum_.pdf"')).toBe(true);
    expect(cd).toContain("filename*=UTF-8''Pay%20%22stub%22%3B%20r%C3%A9sum%C3%A9.pdf");
  });
});

describe("storage and download", () => {
  it("stores under a random name in UPLOAD_DIR with a sha256", async () => {
    const saved = await saveDocument(ownerId, "PAY_STUB", candidate("Oct stub.pdf", PDF));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const row = await prisma.document.findUniqueOrThrow({ where: { id: saved.document.id } });
    expect(row.storagePath).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{48}\.pdf$/);
    expect(row.storagePath).not.toContain("Oct");
    expect(row.sha256).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(row.sizeBytes).toBe(PDF.byteLength);
    expect(row.fileName).toBe("Oct stub.pdf");
    const full = resolveStoragePath(row.storagePath)!;
    expect(full.startsWith(uploadRoot())).toBe(true);
    expect(uploadRoot()).toBe(path.resolve(tmp));
    expect(fs.readFileSync(full).equals(PDF)).toBe(true);
    expect(resolveStoragePath("../../etc/passwd")).toBeNull();
  });

  it("does not store anything for a rejected upload", async () => {
    const before = await prisma.document.count({ where: { userId: ownerId } });
    const saved = await saveDocument(ownerId, "PAY_STUB", candidate("evil.pdf", PNG));
    expect(saved).toMatchObject({ ok: false, code: "MISMATCH" });
    expect(await prisma.document.count({ where: { userId: ownerId } })).toBe(before);
  });

  it("checks size and extension before reading a form file", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const huge = await saveFormFile(ownerId, "PAY_STUB", { name: "big.pdf", size: MAX_DOCUMENT_BYTES + 1, arrayBuffer });
    expect(huge).toMatchObject({ ok: false, code: "TOO_LARGE" });
    const exe = await saveFormFile(ownerId, "PAY_STUB", { name: "x.exe", size: 10, arrayBuffer });
    expect(exe).toMatchObject({ ok: false, code: "EXTENSION" });
    expect(arrayBuffer).not.toHaveBeenCalled();

    const fd = new FormData();
    fd.set("file", new File([new Uint8Array(PDF)], "letter.pdf", { type: "application/pdf" }));
    fd.set("empty", new File([], "", { type: "application/octet-stream" }));
    // Through the Server Actions transport an unchosen file input arrives as a zero-byte part with a
    // placeholder name; it must still read as "no file" (regression: optional proof uploads failed).
    fd.set("emptyNamed", new File([], "undefined", { type: "application/octet-stream" }));
    fd.set("emptyBlob", new File([], "blob", { type: "application/octet-stream" }));
    const file = readFormFile(fd, "file");
    expect(file?.name).toBe("letter.pdf");
    expect(readFormFile(fd, "empty")).toBeNull();
    expect(readFormFile(fd, "emptyNamed")).toBeNull();
    expect(readFormFile(fd, "emptyBlob")).toBeNull();
    expect(readFormFile(fd, "missing")).toBeNull();
    const saved = await saveFormFile(ownerId, "HOURS_VERIFICATION", file!);
    expect(saved).toMatchObject({ ok: true });
  });

  it("serves the owner an attachment with nosniff, and 404s everyone else", async () => {
    const saved = await saveDocument(ownerId, "CERTIFICATE", candidate("card.png", PNG));
    if (!saved.ok) throw new Error(saved.error);
    const id = saved.document.id;

    const res = await documentDownloadResponse(ownerId, id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="card\.png"/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);

    const other = await documentDownloadResponse(otherId, id);
    expect(other.status).toBe(404);
    expect(other.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await documentDownloadResponse(ownerId, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await documentDownloadResponse(ownerId, "../etc/passwd")).status).toBe(404);
  });

  it("route handler: 401 signed out, 404 for another user, 200 for the owner", async () => {
    const saved = await saveDocument(ownerId, "PAY_STUB", candidate("stub.pdf", PDF));
    if (!saved.ok) throw new Error(saved.error);
    const call = (id: string) => GET(new Request(`http://localhost/api/documents/${id}`), { params: Promise.resolve({ id }) });

    session.user = null;
    expect((await call(saved.document.id)).status).toBe(401);

    session.user = { id: otherId, email: "other@careerquest.test", name: "Other", role: "USER" };
    const forOther = await call(saved.document.id);
    expect(forOther.status).toBe(404);
    expect(await forOther.json()).toEqual({ error: "Not found" });

    session.user = { id: ownerId, email: "owner@careerquest.test", name: "Owner", role: "USER" };
    const forOwner = await call(saved.document.id);
    expect(forOwner.status).toBe(200);
    expect(forOwner.headers.get("content-type")).toBe("application/pdf");
    session.user = null;
  });

  it("returns 404 when the stored file is missing", async () => {
    const saved = await saveDocument(ownerId, "OTHER", candidate("gone.pdf", PDF));
    if (!saved.ok) throw new Error(saved.error);
    const row = await prisma.document.findUniqueOrThrow({ where: { id: saved.document.id } });
    fs.rmSync(resolveStoragePath(row.storagePath)!);
    expect((await documentDownloadResponse(ownerId, saved.document.id)).status).toBe(404);
  });
});

describe("delete", () => {
  it("removes the row and the file, and downgrades hours it verified", async () => {
    const saved = await saveDocument(ownerId, "PAY_STUB", candidate("week.pdf", PDF));
    if (!saved.ok) throw new Error(saved.error);
    const row = await prisma.document.findUniqueOrThrow({ where: { id: saved.document.id } });
    const full = resolveStoragePath(row.storagePath)!;
    const entry = await prisma.workHourEntry.create({
      data: { userId: ownerId, employer: "Acme", dateWorked: new Date("2026-10-01T00:00:00Z"), hours: 8, verification: "EMPLOYER_VERIFIED", documentId: row.id },
    });

    expect(await deleteDocument(otherId, row.id)).toMatchObject({ ok: false });
    expect(fs.existsSync(full)).toBe(true);

    const result = await deleteDocument(ownerId, row.id);
    expect(result).toMatchObject({ ok: true, downgradedEntries: 1 });
    expect(await prisma.document.findUnique({ where: { id: row.id } })).toBeNull();
    expect(fs.existsSync(full)).toBe(false);
    const after = await prisma.workHourEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(after).toMatchObject({ verification: "SELF_REPORTED", documentId: null });
    expect(await deleteDocument(ownerId, row.id)).toMatchObject({ ok: false });
  });
});
