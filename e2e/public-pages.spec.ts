import { test, expect } from "@playwright/test";

/**
 * Unauthenticated LIFF-gated pages stay in the loading state in CI
 * (no NEXT_PUBLIC_LIFF_ID) or redirect to access.line.me when LIFF_ID
 * is set locally. `/hospital` also goes through LiffProvider and can
 * race the redirect, so assertions there are guarded with skip-on-redirect.
 */
async function expectRouteLoads(page: import("@playwright/test").Page, route: string) {
  const res = await page.goto(route, { waitUntil: "commit" });
  expect(res?.status() ?? 0).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
}

async function assertOnHospitalOrSkip(
  page: import("@playwright/test").Page,
  locator: ReturnType<import("@playwright/test").Page["locator"]>
) {
  try {
    await expect(locator).toBeVisible({ timeout: 20000 });
  } catch (e) {
    if (page.url().includes("access.line.me")) {
      test.skip(true, "LIFF redirected before hospital UI mounted — auth race, not a regression");
      return;
    }
    throw e;
  }
}

test.describe("Public pages (no auth required)", () => {
  test("home page loads without crashing", async ({ page }) => {
    await expectRouteLoads(page, "/");
  });

  test("hospital page loads", async ({ page }) => {
    await page.goto("/hospital");
    await assertOnHospitalOrSkip(page, page.locator(".leaflet-container"));
  });

  test("hospital page shows title overlay", async ({ page }) => {
    await page.goto("/hospital");
    await assertOnHospitalOrSkip(page, page.getByText("Nearby Hospital"));
  });

  test("/pets loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/pets");
  });

  test("/profile loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/profile");
  });
});
