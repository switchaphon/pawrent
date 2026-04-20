import { test, expect } from "@playwright/test";

/**
 * /feedback goes through the same LIFF gate as the home page, so in
 * CI it neither redirects nor renders its content. Only verify the
 * route loads without a server error. Deep coverage of the feedback
 * form lives in the component tests.
 */
test.describe("Feedback page (anonymous access)", () => {
  test("feedback page loads without crashing", async ({ page }) => {
    const res = await page.goto("/feedback?anonymous=true", { waitUntil: "commit" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
