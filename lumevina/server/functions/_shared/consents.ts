// Lumevina — whether a client has a consent in force (server/migrations/0003_consents.sql).
// The newest answer per email and kind is the one that counts; a withdrawn yes is a no.
// When the consents table isn't there yet (migration not applied), the answer is no:
// nothing that needs consent happens until it can be checked.

// deno-lint-ignore-file no-explicit-any
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();

export async function hasConsent(db: any, email: string, kind: string): Promise<boolean> {
  const { data, error } = await db.from("current_consents").select("active").eq("email", norm(email)).eq("kind", kind).maybeSingle();
  if (error) return false;
  return !!data?.active;
}
