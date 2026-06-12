import { test, expect } from "@playwright/test";

test.describe("Pet Passport page", () => {
  test("passport route is public — renders without redirect for anonymous visitor", async ({
    page,
  }) => {
    // Decision #21: passport is a public share page — no auth gate, no redirect.
    // Unknown-but-valid uuid → not-found UI streams in; URL must stay on /passport.
    await page.goto("/pets/00000000-0000-0000-0000-000000000000/passport");
    await expect(page).toHaveURL(/\/passport/);
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
