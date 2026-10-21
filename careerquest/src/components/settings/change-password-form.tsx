"use client";

import { useCallback, useRef } from "react";
import { changePasswordAction } from "@/lib/account/actions";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/ui";
import { useSettingsAction } from "./use-settings-action";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const reset = useCallback(() => formRef.current?.reset(), []);
  const [state, action, pending] = useSettingsAction(changePasswordAction, reset);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Every other signed-in device is signed out when the password changes; this one stays signed in.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} noValidate className="space-y-4" aria-label="Change password">
          {state && !state.ok && state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}
          <Field label="Current password" htmlFor="currentPassword" errors={fe?.currentPassword}>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="newPassword" errors={fe?.newPassword} hint="At least 10 characters with a letter and a number.">
              <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmPassword" errors={fe?.confirmPassword}>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
