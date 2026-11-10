import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Wallpaper } from "@/components/Wallpaper";
import { safeNextPath } from "@/domain/signin";
import { ownerConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="main login" style={{ maxWidth: 440 }}>
      <Wallpaper variant="crisp" />
      <div className="kicker">Owner only</div>
      <h1>Prism <em className="accent">Studio</em></h1>
      <p className="lede">Every channel, one studio. Sign in with your studio passphrase.</p>
      {ownerConfigured() ? <LoginForm next={safeNextPath(next)} /> : (
        <div className="card stack-sm">
          <p style={{ margin: 0 }}>This studio has no passphrase yet.</p>
          <a href="/setup" className="btn block">Set it up</a>
        </div>
      )}
      <p className="faint" style={{ fontSize: 13, marginTop: 28 }}>Prism never stores your platform passwords or recovery codes. Keep those in your password manager.</p>
    </main>
  );
}
