import { test, expect } from "@playwright/test";

test.describe("Public pages (no auth required)", () => {
  test("home page redirects to LINE login when unauthenticated", async ({ page }) => {
    // LiffProvider triggers a LIFF OAuth redirect when there is no idToken and
    // the browser is not inside LIFF.
    await page.goto("/");
    await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
    expect(page.url()).toMatch(/access\.line\.me/);
  });

  test("hospital page loads", async ({ page }) => {
    // /hospital is a truly public page (no LiffProvider gate); it renders the
    // dynamic Leaflet map. Use a generous timeout for slower browsers and CDN
    // tile loads.
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

  test("/pets redirects to LINE login when unauthenticated", async ({ page }) => {
    await page.goto("/pets");
    await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
    expect(page.url()).toMatch(/access\.line\.me/);
  });

  test("/profile redirects to LINE login when unauthenticated", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL(/access\.line\.me/, { timeout: 15000 });
    expect(page.url()).toMatch(/access\.line\.me/);
  });
});
