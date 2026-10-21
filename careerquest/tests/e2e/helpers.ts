import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1e6)}@careerquest.test`;
}

export const TEST_PASSWORD = "Str0ngPassw0rd!";

export async function register(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Name").fill(opts.name ?? "Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { email, password: TEST_PASSWORD };
}

export async function login(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
