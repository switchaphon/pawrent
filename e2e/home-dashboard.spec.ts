/**
 * Home dashboard V6+D2 structure.
 *
 * Auth-gated: skipped when E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 * are not set, because home redirects unauthenticated traffic
 * into the LIFF login loader.
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip();
  }
});

test.use({
  storageState: "e2e/.auth/user.json",
});

test.describe("Home dashboard (V6+D2)", () => {
  test("renders time-aware greeting and weather strip", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/สวัสดีตอน(เช้า|บ่าย|เย็น|ค่ำ)/)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("กรุงเทพฯ")).toBeVisible();
  });

  test("shows pet health section heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("สุขภาพน้อง ๆ")).toBeVisible({ timeout: 10000 });
  });

  test("quick actions expose lost + found + feed shortcuts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("แจ้งสัตว์เลี้ยงหาย")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("พบสัตว์จร")).toBeVisible();
    await expect(page.getByText("ฟีดน้อง")).toBeVisible();
  });

  test("notification bell has accessible label", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "การแจ้งเตือน" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("primary CTA routes to /post/lost", async ({ page }) => {
    await page.goto("/");
    await page.getByText("แจ้งสัตว์เลี้ยงหาย").first().click();
    await expect(page).toHaveURL(/\/post\/lost/);
  });
});
