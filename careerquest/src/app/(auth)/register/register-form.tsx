"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/auth/actions";
import { Button, Field, Input, Alert } from "@/components/ui";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-fg-muted mt-1">Start Operation Get Hired and the $150K Electrician Path.</p>
      </div>
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Name" htmlFor="name" errors={fe?.name}>
        <Input id="name" name="name" autoComplete="name" required placeholder="Your name" />
      </Field>
      <Field label="Email" htmlFor="email" errors={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password" errors={fe?.password} hint="At least 10 characters with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-xs text-fg-subtle">
        Your data is private to you. CareerQuest never submits applications or contacts employers without your explicit action.
      </p>
      <p className="text-sm text-fg-muted text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
