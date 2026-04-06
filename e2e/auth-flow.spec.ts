import { test, expect } from "@playwright/test";

test.describe("Authentication flow (unauthenticated)", () => {
  test("login form validates email format client-side", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill("not-an-email");
    await passwordInput.fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // The form should not navigate away — still on login page
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("can toggle between sign-in and sign-up modes", async ({ page }) => {
    await page.goto("/");

    // Default: sign-in mode
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    // Switch to sign-up
    await page.getByRole("button", { name: /sign up/i }).click();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();

    // Switch back to sign-in
    await page.getByRole("button", { name: /sign in$/i }).click();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("can toggle password visibility", async ({ page }) => {
    await page.goto("/");
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Click show password
    await page.getByLabel(/show password/i).click();
    await expect(page.locator('input[type="text"]#password')).toBeVisible();

    // Click hide password
    await page.getByLabel(/hide password/i).click();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("feedback link is visible on login page", async ({ page }) => {
    await page.goto("/");
    const feedbackLink = page.getByText("Feedback");
    await expect(feedbackLink).toBeVisible();
    expect(await feedbackLink.getAttribute("href") ?? "").toContain("/feedback");
  });

  test("all protected routes redirect to login", async ({ page }) => {
    const protectedRoutes = ["/pets", "/profile", "/sos", "/notifications"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to / (login page)
      await page.waitForURL("/", { timeout: 5000 });
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });
});
