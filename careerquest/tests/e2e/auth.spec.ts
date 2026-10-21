import { test, expect } from "@playwright/test";
import { register, login, logout, uniqueEmail, TEST_PASSWORD } from "./helpers";

test.describe("authentication", () => {
  test("register, sign out, sign back in", async ({ page }) => {
    const { email } = await register(page);
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await logout(page);
    // Protected route redirects when signed out
    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login\?next=%2Fapplications/);
    await login(page, email);
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  });

  test("rejects wrong password and weak registration", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/register");
    await page.getByLabel("Name").fill("Weak");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /at least 10 characters/i })).toBeVisible();

    await register(page, { email });
    await logout(page);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD + "x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /incorrect email or password/i })).toBeVisible();
  });
});
