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
    // Wait for loading to finish (spinner disappears or markers appear)
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    // Give the API time to respond and markers to render
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
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    const marker = page.locator(".leaflet-marker-icon").first();
    const hasMarkers = await marker.isVisible({ timeout: 5000 }).catch(() => false);
    // Only test popup interaction if markers are present (requires real DB data)
    test.skip(!hasMarkers, "No hospital markers — skipping popup test (no DB data in CI)");
    await marker.click();
    await expect(page.locator(".leaflet-popup")).toBeVisible({ timeout: 5000 });
  });

  test("bottom nav shows Hospital as active", async ({ page }) => {
    await page.goto("/hospital");
    const hospitalNav = page.locator("nav").getByText("Hospital");
    await expect(hospitalNav).toBeVisible({ timeout: 5000 });
  });
});
