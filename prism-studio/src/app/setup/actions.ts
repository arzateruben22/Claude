"use server";
// First-run setup (only while OWNER_PASSWORD_HASH is unset): turn the owner's passphrase into the hash, on the server,
// and hand it back once. Nothing is stored; the owner pastes it into the host's variables, so the passphrase never
// has to pass through a chat or a terminal.
import { hashPassword, ownerConfigured } from "@/lib/auth";

export type SetupResult = { ok: boolean; message: string; hash?: string } | null;

export async function makeOwnerHash(_: SetupResult, fd: FormData): Promise<SetupResult> {
  if (ownerConfigured()) return { ok: false, message: "The studio already has a passphrase. Setup is closed." };
  const pass = String(fd.get("passphrase") ?? ""), again = String(fd.get("again") ?? "");
  if (pass.length < 12) return { ok: false, message: "Use at least 12 characters (four or five unrelated words work well)." };
  if (pass.length > 200) return { ok: false, message: "That's too long: 200 characters at most." };
  if (pass !== again) return { ok: false, message: "The two passphrases don't match." };
  return { ok: true, message: "Done. Copy the block below into the host's variables.", hash: hashPassword(pass) };
}
