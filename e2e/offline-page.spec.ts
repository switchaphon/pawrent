import { test, expect } from "@playwright/test";

test.describe("Offline fallback page", () => {
  test("renders offline message", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows retry button", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("button", { name: /retry|try again/i }).or(page.getByText(/retry|try again/i))).toBeVisible({ timeout: 5000 });
  });
});
