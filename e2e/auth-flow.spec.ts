import { test, expect } from "@playwright/test";

test.describe("Authentication flow (unauthenticated via LIFF)", () => {
  test("unauthenticated user is redirected to LINE login", async ({ page }) => {
    // LiffProvider initializes, detects no LIFF env + no idToken, then calls
    // liffLogin() which navigates to access.line.me. Wait for that redirect.
    await page.goto("/");
    await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
    expect(page.url()).toMatch(/access\.line\.me/);
  });

  test("protected routes redirect to LINE login when unauthenticated", async ({ page }) => {
    const protectedRoutes = ["/pets", "/profile", "/post", "/notifications"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Each protected route triggers the same LIFF auth redirect
      await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
      expect(page.url()).toMatch(/access\.line\.me/);
    }
  });
});
