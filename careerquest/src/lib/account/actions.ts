"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { destroySession } from "@/lib/auth/session";
import { createApiToken, revokeApiToken } from "@/lib/auth/api-token";
import { audit } from "@/lib/audit";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { text } from "@/lib/profile/form-data";
import { changePasswordSchema, deleteAccountSchema, tokenIdSchema, tokenNameSchema } from "./schema";
import { currentSessionId } from "./sessions";
import * as svc from "./service";

export type AccountData = { message: string };
export type AccountResult = ActionResult<AccountData>;
export type CreateTokenData = AccountData & { tokenId: string; name: string; plaintext: string };
export type CreateTokenResult = ActionResult<CreateTokenData>;

async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") ?? h.get("x-real-ip"))?.split(",")[0]?.trim().slice(0, 64) ?? null;
  } catch {
    return null;
  }
}

export async function changePasswordAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/settings/account");
  const limit = rateLimit(`${await clientKey("password-change")}:${user.id}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`);
  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    newPassword: text(formData, "newPassword"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const keep = await currentSessionId();
  let res: svc.ChangePasswordResult;
  try {
    res = await svc.changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword, keep);
  } catch (err) {
    console.error("changePassword failed", err);
    return fail("Something went wrong changing your password. Please try again.");
  }
  if (!res.ok) {
    await audit("account.password_change_failed", { userId: user.id, metadata: { reason: res.reason } });
    return res.reason === "wrong_password"
      ? fail("Current password is incorrect.", { currentPassword: ["Current password is incorrect."] })
      : fail("Account not found.");
  }
  await audit("account.password_changed", { userId: user.id, metadata: { revokedSessions: res.revokedSessions } });
  revalidatePath("/settings/account");
  return ok({
    message:
      res.revokedSessions > 0
        ? `Password changed. ${res.revokedSessions} other session${res.revokedSessions === 1 ? "" : "s"} signed out.`
        : "Password changed.",
  });
}

export async function signOutOtherSessionsAction(): Promise<AccountResult> {
  const user = await requireUser("/settings/account");
  const keep = await currentSessionId();
  let count = 0;
  try {
    count = await svc.revokeOtherSessions(user.id, keep);
  } catch (err) {
    console.error("revokeOtherSessions failed", err);
    return fail("Could not sign out other sessions. Please try again.");
  }
  await audit("account.sessions_revoked", { userId: user.id, metadata: { count } });
  revalidatePath("/settings/account");
  return ok({ message: count === 0 ? "No other sessions were active." : `Signed out ${count} other session${count === 1 ? "" : "s"}.` });
}

export async function deleteAccountAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/settings/account");
  const limit = rateLimit(`${await clientKey("account-delete")}:${user.id}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`);
  const parsed = deleteAccountSchema.safeParse({ confirm: text(formData, "confirm"), password: text(formData, "password") });
  if (!parsed.success) return fromZodError(parsed.error);

  let res: svc.DeleteAccountResult;
  try {
    res = await svc.deleteAccount(user.id, parsed.data.password, await requestIp());
  } catch (err) {
    console.error("deleteAccount failed", err);
    return fail("Something went wrong deleting your account. Nothing was removed.");
  }
  if (!res.ok) {
    return res.reason === "wrong_password" ? fail("Password is incorrect.", { password: ["Password is incorrect."] }) : fail("Account not found.");
  }
  await destroySession();
  redirect("/");
}

export async function createTokenAction(_prev: CreateTokenResult | null, formData: FormData): Promise<CreateTokenResult> {
  const user = await requireUser("/settings/tokens");
  const parsed = tokenNameSchema.safeParse({ name: text(formData, "name") });
  if (!parsed.success) return fromZodError(parsed.error);
  const active = await svc.listTokens(user.id);
  if (active.filter((t) => !t.revokedAt).length >= 20) return fail("You already have 20 active tokens. Revoke one first.");
  let created: Awaited<ReturnType<typeof createApiToken>>;
  try {
    created = await createApiToken(user.id, parsed.data.name);
  } catch (err) {
    console.error("createApiToken failed", err);
    return fail("Could not create the token. Please try again.");
  }
  await audit("token.create", { userId: user.id, entityType: "ApiToken", entityId: created.token.id, metadata: { name: parsed.data.name } });
  revalidatePath("/settings/tokens");
  return ok({ message: `Token "${parsed.data.name}" created.`, tokenId: created.token.id, name: parsed.data.name, plaintext: created.plaintext });
}

export async function revokeTokenAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/settings/tokens");
  const parsed = tokenIdSchema.safeParse({ tokenId: text(formData, "tokenId") });
  if (!parsed.success) return fail("Unknown token.");
  const owned = (await svc.listTokens(user.id)).find((t) => t.id === parsed.data.tokenId);
  if (!owned) return fail("Unknown token.");
  if (owned.revokedAt) return fail("That token was already revoked.");
  try {
    await revokeApiToken(user.id, parsed.data.tokenId);
  } catch (err) {
    console.error("revokeApiToken failed", err);
    return fail("Could not revoke the token. Please try again.");
  }
  await audit("token.revoke", { userId: user.id, entityType: "ApiToken", entityId: parsed.data.tokenId, metadata: { name: owned.name } });
  revalidatePath("/settings/tokens");
  return ok({ message: `Token "${owned.name}" revoked.` });
}
