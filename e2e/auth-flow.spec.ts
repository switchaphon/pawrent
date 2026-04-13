import { test, expect } from "@playwright/test";

test.describe("Authentication flow (unauthenticated via LIFF)", () => {
  test("unauthenticated user sees LINE login prompt", async ({ page }) => {
    await page.goto("/");
    // Without LIFF SDK (no LINE environment), the page shows a signing-in message
    await expect(page.getByText(/signing in with line/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("all protected routes stay on page without crashing when unauthenticated", async ({
    page,
  }) => {
    const protectedRoutes = ["/pets", "/profile", "/post", "/notifications"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Auth is handled client-side by LiffProvider. Without LIFF SDK,
      // pages render a loading spinner (no user = no data fetch).
      // Verify the page loads without error and stays on the route.
      await expect(page).toHaveURL(new RegExp(route));
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
