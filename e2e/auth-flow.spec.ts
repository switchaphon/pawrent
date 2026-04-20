import { test, expect } from "@playwright/test";

/**
 * Unauthenticated LIFF flow produces one of two observable states
 * depending on whether NEXT_PUBLIC_LIFF_ID is configured:
 *   (a) LIFF_ID set + reachable: liff.init() succeeds, liffLogin()
 *       redirects the browser to access.line.me
 *   (b) LIFF_ID missing (CI) or LIFF unreachable: liff.init() throws,
 *       LiffProvider falls through to the "Signing in with LINE..."
 *       loading UI on the same origin
 *
 * Both outcomes are legitimate; asserting one or the other keeps the
 * spec resilient to env differences.
 */
async function expectLineAuthState(page: import("@playwright/test").Page) {
  await Promise.race([
    page.waitForURL(/access\.line\.me/, { timeout: 15000 }),
    page.getByText(/signing in with line/i).waitFor({ timeout: 15000 }),
  ]);
  const url = page.url();
  const onLineAuth = /access\.line\.me/.test(url);
  const seesLoadingText = await page
    .getByText(/signing in with line/i)
    .isVisible()
    .catch(() => false);
  expect(onLineAuth || seesLoadingText).toBe(true);
}

test.describe("Authentication flow (unauthenticated via LIFF)", () => {
  test("unauthenticated user hits LINE login flow", async ({ page }) => {
    await page.goto("/");
    await expectLineAuthState(page);
  });

  test("protected routes hit LINE login flow when unauthenticated", async ({ page }) => {
    const protectedRoutes = ["/pets", "/profile", "/post", "/notifications"];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expectLineAuthState(page);
    }
  });
});
