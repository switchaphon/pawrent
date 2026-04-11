import { test, expect } from "@playwright/test";

test.describe("Authentication flow (unauthenticated via LIFF)", () => {
  test("unauthenticated user sees LINE login prompt", async ({ page }) => {
    await page.goto("/");
    // Without LIFF SDK (no LINE environment), the page shows a signing-in message
    await expect(page.getByText(/signing in with line/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("all protected routes show login state when unauthenticated", async ({ page }) => {
    const protectedRoutes = ["/pets", "/profile", "/sos", "/notifications"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to / or show loading/login state
      await page.waitForURL("/", { timeout: 5000 });
    }
  });
});
