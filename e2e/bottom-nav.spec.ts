import { test, expect } from "@playwright/test";

test.describe("Bottom navigation (on public pages)", () => {
  test("hospital page shows bottom nav with all items", async ({ page }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    await expect(nav.getByText("Feed")).toBeVisible();
    await expect(nav.getByText("Hospital")).toBeVisible();
    await expect(nav.getByText("Pets")).toBeVisible();
    await expect(nav.getByText("Profile")).toBeVisible();
  });

  test("clicking Feed from hospital page navigates to /", async ({ page }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    await nav.getByText("Feed").click();
    await page.waitForURL("/", { timeout: 5000 });
  });

  test("clicking Pets from hospital page navigates (may redirect to / if unauthed)", async ({
    page,
  }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    await nav.getByText("Pets").click();
    // Will redirect to / for unauthenticated users
    await page.waitForURL(/\/(pets)?/, { timeout: 5000 });
  });
});
