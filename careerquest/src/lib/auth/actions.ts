"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { fail, fromZodError, type ActionResult } from "@/lib/action-result";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
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
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      profile: { create: { careerInterests: ["Electrician"] } },
      stats: { create: {} },
      campaigns: {
        create: [
          { campaign: "GET_HIRED", startedAt: new Date(), targetEndAt: new Date(Date.now() + 90 * 86400000) },
          { campaign: "ELECTRICIAN_150K", startedAt: new Date() },
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

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, deletedAt: true } });
  // Always run the hash comparison to keep timing similar for unknown emails.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
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
