import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Wallpaper } from "@/components/Wallpaper";
import { safeNextPath } from "@/domain/signin";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="main login" style={{ maxWidth: 440 }}>
      <Wallpaper variant="crisp" />
      <div className="kicker">Owner only</div>
      <h1>Prism <em className="accent">Studio</em></h1>
      <p className="lede">Five channels, one studio. Sign in with your studio passphrase.</p>
      <LoginForm next={safeNextPath(next)} />
      <p className="faint" style={{ fontSize: 13, marginTop: 28 }}>Prism never stores your platform passwords or recovery codes. Keep those in your password manager.</p>
    </main>
  );
}
