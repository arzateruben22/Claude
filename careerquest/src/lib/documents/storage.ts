import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Disk storage for uploaded documents. Files live under UPLOAD_DIR (default `<cwd>/uploads`, which
 * is git-ignored) with random names, sharded by the first two hex characters:
 * `ab/ab3f…e1.pdf`. The stored path is relative to the root and validated on every read so a
 * tampered row can never point outside the upload directory.
 */

const STORAGE_PATH = /^[0-9a-f]{2}\/[0-9a-f]{48}\.(pdf|png|jpg|webp)$/;

export function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return path.resolve(configured ? configured : path.join(process.cwd(), "uploads"));
}

/** Absolute path for a stored relative path, or null when the value is not one we generate. */
export function resolveStoragePath(storagePath: string): string | null {
  if (!STORAGE_PATH.test(storagePath)) return null;
  const root = uploadRoot();
  const full = path.resolve(root, storagePath);
  return full.startsWith(root + path.sep) ? full : null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Write bytes under a new random name; returns the relative storage path. */
export async function writeStoredFile(bytes: Uint8Array, extension: "pdf" | "png" | "jpg" | "webp" | string): Promise<string> {
  if (!/^(pdf|png|jpg|webp)$/.test(extension)) throw new Error("Unsupported extension");
  const name = randomBytes(24).toString("hex");
  const rel = `${name.slice(0, 2)}/${name}.${extension}`;
  const full = resolveStoragePath(rel);
  if (!full) throw new Error("Invalid storage path");
  await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  // "wx": never overwrite an existing file (a 192-bit random name makes a clash practically impossible).
  await writeFile(full, bytes, { flag: "wx", mode: 0o600 });
  return rel;
}

/** File contents, or null when the path is invalid or the file is missing. */
export async function readStoredFile(storagePath: string): Promise<Buffer | null> {
  const full = resolveStoragePath(storagePath);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

/** Remove a stored file; a missing file is not an error. Returns false only on unexpected failures. */
export async function removeStoredFile(storagePath: string): Promise<boolean> {
  const full = resolveStoragePath(storagePath);
  if (!full) return true;
  try {
    await rm(full, { force: true });
    return true;
  } catch (err) {
    console.error("document file removal failed", err);
    return false;
  }
}
