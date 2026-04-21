import { test, expect } from "@playwright/test";

test.describe("Bottom navigation (on public pages)", () => {
  test("hospital page shows bottom nav with d2 thai tabs", async ({ page }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    // D2 thai labels (bottom-nav.tsx) — exact match required because
    // "แจ้ง" is a substring of "แจ้งเตือน".
    await expect(nav.getByText("หน้าหลัก", { exact: true })).toBeVisible();
    await expect(nav.getByText("ฟีด", { exact: true })).toBeVisible();
    await expect(nav.getByText("แจ้ง", { exact: true })).toBeVisible();
    await expect(nav.getByText("แจ้งเตือน", { exact: true })).toBeVisible();
    await expect(nav.getByText("สัตว์เลี้ยง", { exact: true })).toBeVisible();
    await expect(nav.getByText("โปรไฟล์", { exact: true })).toBeVisible();
  });

  test("clicking หน้าหลัก from hospital page navigates to /", async ({ page }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    await nav.getByText("หน้าหลัก").click();
    await page.waitForURL("/", { timeout: 5000 });
  });

  test("clicking สัตว์เลี้ยง from hospital page navigates (may redirect to / if unauthed)", async ({
    page,
  }) => {
    await page.goto("/hospital");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
    await nav.getByText("สัตว์เลี้ยง").click();
    await page.waitForURL(/\/(pets)?/, { timeout: 5000 });
  });
});
