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

  test("unauthenticated user stays on /pets without crash", async ({ page }) => {
    await page.goto("/pets");
    // Without LIFF auth, page renders loading state — no crash or redirect
    await expect(page).toHaveURL(/\/pets/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated user stays on /profile without crash", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator("body")).toBeVisible();
  });
});
