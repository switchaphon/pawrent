import { test, expect } from "@playwright/test";

test.describe("Public pages (no auth required)", () => {
  test("login page renders with email and password fields", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("login page has sign-in button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("hospital page loads", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
  });

  test("hospital page shows title overlay", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.getByText("Nearby Hospital")).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated user is redirected from /pets to /", async ({ page }) => {
    await page.goto("/pets");
    await page.waitForURL("/", { timeout: 5000 });
    expect(page.url()).toContain("/");
  });

  test("unauthenticated user is redirected from /profile to /", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("/", { timeout: 5000 });
    expect(page.url()).toContain("/");
  });
});
