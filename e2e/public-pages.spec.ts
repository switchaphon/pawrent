import { test, expect } from "@playwright/test";

test.describe("Public pages (no auth required)", () => {
  test("home page shows LINE login state when unauthenticated", async ({ page }) => {
    await page.goto("/");
    // Without LIFF environment, the unauthenticated page shows signing-in message
    await expect(page.getByText(/signing in with line/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("hospital page loads", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.locator(".leaflet-container")).toBeVisible({
      timeout: 10000,
    });
  });

  test("hospital page shows title overlay", async ({ page }) => {
    await page.goto("/hospital");
    await expect(page.getByText("Nearby Hospital")).toBeVisible({
      timeout: 10000,
    });
  });

  test("unauthenticated user sees login state on /pets", async ({ page }) => {
    await page.goto("/pets");
    // Auth is handled client-side — page renders but shows login prompt
    await expect(page.getByText(/signing in with line/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("unauthenticated user sees login state on /profile", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText(/signing in with line/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
