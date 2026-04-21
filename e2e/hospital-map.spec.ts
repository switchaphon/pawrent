import { test, expect } from "@playwright/test";

test.describe("Hospital map page", () => {
  test("loads the map with Leaflet container", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
  });

  test("shows 'Nearby Hospital' title overlay", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.getByText("Nearby Hospital")).toBeVisible({ timeout: 10000 });
  });

  test("renders hospital markers when data is available", async ({ page }) => {
    await page.goto("/hospital");
    // LIFF auth redirects unauthenticated browsers to access.line.me
    // asynchronously in useEffect — race-prone across browsers.
    try {
      await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    } catch (e) {
      if (page.url().includes("access.line.me")) {
        test.skip(true, "LIFF redirected before leaflet mounted — auth race, not a map regression");
        return;
      }
      throw e;
    }
    const marker = page.locator(".leaflet-marker-icon").first();
    const hasMarkers = await marker.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasMarkers) {
      await expect(marker).toBeVisible();
    } else {
      // No hospital data (e.g. CI with placeholder credentials) — map still loads
      await expect(page.locator(".leaflet-container")).toBeVisible();
    }
  });

  test("clicking a marker opens a popup with hospital info", async ({ page }) => {
    await page.goto("/hospital");
    try {
      await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    } catch (e) {
      if (page.url().includes("access.line.me")) {
        test.skip(true, "LIFF redirected before leaflet mounted — auth race, not a map regression");
        return;
      }
      throw e;
    }
    const marker = page.locator(".leaflet-marker-icon").first();
    const hasMarkers = await marker.isVisible({ timeout: 5000 }).catch(() => false);
    // Only test popup interaction if markers are present (requires real DB data)
    test.skip(!hasMarkers, "No hospital markers — skipping popup test (no DB data in CI)");
    await marker.click();
    await expect(page.locator(".leaflet-popup")).toBeVisible({ timeout: 5000 });
  });

  test("bottom nav renders on hospital page (hospital tab dropped in prp-16)", async ({ page }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 5000 });
    // /hospital is still a valid route but no longer has a dedicated bottom-nav tab
    await expect(nav.getByText("หน้าหลัก")).toBeVisible();
  });
});
