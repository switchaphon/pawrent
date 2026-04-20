import { test, expect } from "@playwright/test";

test.describe("Feedback page (anonymous access)", () => {
  // The current LiffProvider always triggers a LINE OAuth redirect when there is
  // no idToken and the browser is not inside LIFF. This means /feedback cannot
  // be reached from a non-LIFF browser regardless of ?anonymous=true. These tests
  // pin that behavior; the design gap is tracked separately.
  test("feedback page redirects to LINE login when unauthenticated", async ({ page }) => {
    await page.goto("/feedback?anonymous=true");
    await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
    expect(page.url()).toMatch(/access\.line\.me/);
  });
});
