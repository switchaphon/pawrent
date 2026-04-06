import { test, expect } from "@playwright/test";

test.describe("Feedback page (anonymous access)", () => {
  test("feedback page is accessible without auth", async ({ page }) => {
    await page.goto("/feedback?anonymous=true");
    // Should NOT redirect to login — feedback allows anonymous access
    await expect(page.getByText(/feedback/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("feedback form has a message textarea", async ({ page }) => {
    await page.goto("/feedback?anonymous=true");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 5000 });
  });
});
