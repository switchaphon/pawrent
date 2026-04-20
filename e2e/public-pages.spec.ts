import { test, expect } from "@playwright/test";

/**
 * Unauthenticated pages end up in one of two LIFF states depending on
 * whether NEXT_PUBLIC_LIFF_ID is configured. See auth-flow.spec.ts for
 * rationale.
 */
async function expectLineAuthState(page: import("@playwright/test").Page) {
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
}

test.describe("Public pages (no auth required)", () => {
  test("home page hits LINE login flow when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expectLineAuthState(page);
  });

  test("hospital page loads", async ({ page }) => {
    // /hospital is a truly public page (no LiffProvider gate); it renders the
    // dynamic Leaflet map. Generous timeout for slower browsers and CDN tiles.
    await page.goto("/hospital");
    await expect(page.locator(".leaflet-container")).toBeVisible({
      timeout: 20000,
    });
  });

  test("hospital page shows title overlay", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.getByText("Nearby Hospital")).toBeVisible({
      timeout: 20000,
    });
  });

  test("/pets hits LINE login flow when unauthenticated", async ({ page }) => {
    await page.goto("/pets");
    await expectLineAuthState(page);
  });

  test("/profile hits LINE login flow when unauthenticated", async ({ page }) => {
    await page.goto("/profile");
    await expectLineAuthState(page);
  });
});
