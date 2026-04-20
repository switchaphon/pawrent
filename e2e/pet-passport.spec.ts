import { test, expect } from "@playwright/test";

test.describe("Pet Passport page", () => {
  test("passport route loads without crash for unauthenticated user", async ({ page }) => {
    // Without auth, the server component redirects to "/"
    await page.goto("/pets/some-id/passport");
    // Should redirect to home (LIFF login) — no 500 error
    await expect(page).not.toHaveURL(/\/passport/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cron health-reminders returns 401 without secret", async ({ request }) => {
    const res = await request.get("/api/cron/health-reminders");
    expect(res.status()).toBe(401);
  });

  test("cron celebrations returns 401 without secret", async ({ request }) => {
    const res = await request.get("/api/cron/celebrations");
    expect(res.status()).toBe(401);
  });

  test("pet-weight API returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/pet-weight?pet_id=00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(401);
  });
});
