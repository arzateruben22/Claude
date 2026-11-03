// First-run setup for a hosted studio (docs/LAUNCH-CHECKLIST.md). Open only while OWNER_PASSWORD_HASH is unset: it
// makes fresh random secrets and the passphrase hash for the owner to paste into the host's variables. It stores
// nothing; once the hash is set, the page is gone (404).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { randomBytes } from "node:crypto";
import { ownerConfigured } from "@/lib/auth";
import { Wallpaper } from "@/components/Wallpaper";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Set up", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Setup() {
  if (ownerConfigured()) notFound();
  const hex = () => randomBytes(32).toString("hex");
  // keep the ones already set, so a reload never changes a secret the host is using
  const lines = [
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? null : `SESSION_SECRET=${hex()}`,
    /^[0-9a-f]{64}$/i.test(process.env.INTEGRATIONS_KEY || "") ? null : `INTEGRATIONS_KEY=${hex()}`,
    (process.env.MEDIA_PUSH_TOKEN || "").length >= 32 ? null : `MEDIA_PUSH_TOKEN=${hex()}`,
  ].filter(Boolean).join("\n");
  return (
    <main className="main login" style={{ maxWidth: 520 }}>
      <Wallpaper variant="crisp" />
      <div className="kicker">First run</div>
      <h1>Set up <em className="accent">Prism</em></h1>
      <p className="lede">This makes your sign-in passphrase into a hash, plus three random secrets, ready to paste into the host. Nothing is saved here, and this page closes once the passphrase is set.</p>
      <SetupForm secrets={lines} />
    </main>
  );
}
