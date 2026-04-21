/**
 * Profile page V6+D2 structure.
 *
 * Auth-gated: skipped when E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 * are not set, because /profile is behind LIFF auth.
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

test.describe("Profile page (V6+D2)", () => {
  test("renders 11-section structure", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("โปรไฟล์ของฉัน")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/แพ็คเกจปัจจุบัน|POPS Family/)).toBeVisible();
    await expect(page.getByText("สัตว์เลี้ยงของฉัน")).toBeVisible();
    await expect(page.getByText("ช่องทางติดต่อ")).toBeVisible();
    await expect(page.getByText("การแจ้งเตือน", { exact: false })).toBeVisible();
    await expect(page.getByText(/ความเป็นส่วนตัว.*ข้อมูล|PDPA/)).toBeVisible();
    await expect(page.getByText("การตั้งค่าแอป")).toBeVisible();
    await expect(page.getByText("ช่วยเหลือ")).toBeVisible();
  });

  test("edit profile modal opens and closes", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: /แก้ไขโปรไฟล์/ }).click();
    await expect(page.getByText("ชื่อที่แสดง")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page.getByText("ชื่อที่แสดง")).not.toBeVisible();
  });

  test("sign out button has correct label", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("notification radius pills are selectable", async ({ page }) => {
    await page.goto("/profile");
    const pill5km = page.getByRole("button", { name: "5 km" });
    await expect(pill5km).toBeVisible({ timeout: 10000 });
    await pill5km.click();
    // Visual state change can't be asserted without a data-testid,
    // but click must not throw
  });
});
