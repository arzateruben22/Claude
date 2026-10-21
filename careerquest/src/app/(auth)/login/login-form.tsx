"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/auth/actions";
import { Button, Field, Input, Alert } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-fg-muted mt-1">Sign in to continue your campaign.</p>
      </div>
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" errors={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password" errors={fe?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
      <p className="text-sm text-fg-muted text-center">
        New here?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
