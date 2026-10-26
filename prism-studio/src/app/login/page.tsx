import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="main" style={{ maxWidth: 440, paddingTop: "12vh" }}>
      <div className="kicker">Owner only</div>
      <h1>Prism <em className="accent">Studio</em></h1>
      <p className="lede">Five channels, one studio. Sign in with your studio passphrase.</p>
      <LoginForm next={next ?? "/"} />
      <p className="faint" style={{ fontSize: 13, marginTop: 28 }}>Prism never stores your platform passwords or recovery codes. Keep those in your password manager.</p>
    </main>
  );
}
