"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { fail, fromZodError, type ActionResult } from "@/lib/action-result";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { safeNext } from "@/lib/auth/safe-next";
import { todayInTz } from "@/lib/dates";
import { addDaysUtc } from "@/lib/goals/days";

/** Matches the UserProfile.timezone default; campaigns are dated in the user's calendar, not the server's. */
const DEFAULT_TIMEZONE = "America/Los_Angeles";
const DEFAULT_CAMPAIGN_LENGTH_DAYS = 90;

let dummyHash: Promise<string> | null = null;
/** A real bcrypt hash so unknown-email logins take as long as wrong-password logins. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("careerquest-timing-equalizer-not-a-password");
  return dummyHash;
}

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const limit = rateLimit(await clientKey("register"), 10, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`);

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return fail("An account with that email already exists.", { email: ["Try signing in instead."] });

  const passwordHash = await hashPassword(password);
  // @db.Date columns hold UTC-midnight dates: derive "today" in the profile timezone so day 1 is today for the user.
  const campaignStart = todayInTz(DEFAULT_TIMEZONE);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      profile: { create: { careerInterests: ["Electrician"] } },
      stats: { create: {} },
      campaigns: {
        create: [
          { campaign: "GET_HIRED", startedAt: campaignStart, targetEndAt: addDaysUtc(campaignStart, DEFAULT_CAMPAIGN_LENGTH_DAYS) },
          { campaign: "ELECTRICIAN_150K", startedAt: campaignStart },
        ],
      },
    },
    select: { id: true },
  });
  await audit("user.register", { userId: user.id });
  await createSession(user.id);
  redirect("/dashboard?welcome=1");
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const limit = rateLimit(await clientKey("login"), 20, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`);

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, password } = parsed.data;
  // Per-account limit complements the per-client limit (which cannot trust forwarding headers by default).
  const accountLimit = rateLimit(`login-account:${email}`, 10, 15 * 60 * 1000);
  if (!accountLimit.ok) return fail(`Too many attempts for this account. Try again in ${accountLimit.retryAfterSeconds}s.`);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, deletedAt: true } });
  // Always run the hash comparison to keep timing similar for unknown emails.
  const valid = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());
  if (!user || !valid || user.deletedAt) {
    await audit("user.login_failed", { metadata: { email } });
    return fail("Incorrect email or password.");
  }
  await createSession(user.id);
  await audit("user.login", { userId: user.id });
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit("user.logout", { userId: user.id });
  redirect("/login");
}
