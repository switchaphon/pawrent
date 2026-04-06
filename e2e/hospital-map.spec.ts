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

  test("renders hospital markers on the map", async ({ page }) => {
    await page.goto("/hospital");
    // Wait for markers to appear (custom markers or default Leaflet markers)
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible({ timeout: 15000 });
  });

  test("clicking a marker opens a popup with hospital info", async ({ page }) => {
    await page.goto("/hospital");
    // Wait for markers
    const marker = page.locator(".leaflet-marker-icon").first();
    await expect(marker).toBeVisible({ timeout: 15000 });
    await marker.click();

    // Popup should show hospital details
    await expect(page.locator(".leaflet-popup")).toBeVisible({ timeout: 5000 });
  });

  test("bottom nav shows Hospital as active", async ({ page }) => {
    await page.goto("/hospital");
    const hospitalNav = page.locator("nav").getByText("Hospital");
    await expect(hospitalNav).toBeVisible({ timeout: 5000 });
  });
});
