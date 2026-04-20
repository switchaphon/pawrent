import { test, expect } from "@playwright/test";

/**
 * Unauthenticated LIFF-gated pages stay in the loading state in CI
 * (no NEXT_PUBLIC_LIFF_ID); only assert the route loads without a
 * server error. Hospital page has no LIFF gate and renders Leaflet
 * directly, so keep the deeper assertions there.
 */
async function expectRouteLoads(page: import("@playwright/test").Page, route: string) {
  const res = await page.goto(route, { waitUntil: "commit" });
  expect(res?.status() ?? 0).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
}

test.describe("Public pages (no auth required)", () => {
  test("home page loads without crashing", async ({ page }) => {
    await expectRouteLoads(page, "/");
  });

  test("hospital page loads", async ({ page }) => {
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

  test("/pets loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/pets");
  });

  test("/profile loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/profile");
  });
});
