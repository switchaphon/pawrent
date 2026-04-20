import { test, expect } from "@playwright/test";

/**
 * Unauthenticated /feedback ends up in one of two LIFF states depending
 * on whether NEXT_PUBLIC_LIFF_ID is configured (same as the home/auth
 * specs — see auth-flow.spec.ts for rationale). The ?anonymous=true
 * query param does not currently bypass the LIFF gate; design gap
 * tracked separately.
 */
test.describe("Feedback page (anonymous access)", () => {
  test("unauthenticated feedback hits LINE login flow", async ({ page }) => {
    await page.goto("/feedback?anonymous=true");
    await Promise.race([
      page.waitForURL(/access\.line\.me/, { timeout: 15000 }),
      page.getByText(/signing in with line/i).waitFor({ timeout: 15000 }),
    ]);
    const onLineAuth = /access\.line\.me/.test(page.url());
    const seesLoadingText = await page
      .getByText(/signing in with line/i)
      .isVisible()
      .catch(() => false);
    expect(onLineAuth || seesLoadingText).toBe(true);
  });
});
