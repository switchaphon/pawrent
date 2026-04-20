/**
 * Authenticated E2E tests — requires test credentials.
 *
 * These tests use the storageState saved by auth.setup.ts.
 * They will be SKIPPED if E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set.
 *
 * To run:
 *   E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=password npx playwright test e2e/authenticated-flows.spec.ts
 */

import { test, expect } from "@playwright/test";

// Skip all tests if no test credentials
test.beforeEach(async () => {
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    test.skip();
  }
});

test.use({
  storageState: "e2e/.auth/user.json",
});

test.describe("Authenticated user flows", () => {
  test("can access /pets page after login", async ({ page }) => {
    await page.goto("/pets");
    await expect(page).toHaveURL(/\/pets/);
    // D2 thai header: "น้องของฉัน" or empty-state CTA "เพิ่มน้อง"
    await expect(page.getByText(/น้องของฉัน|เพิ่มน้อง/)).toBeVisible({ timeout: 10000 });
  });

  test("can access /profile page", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator('input[type="email"], [data-testid="profile"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("can navigate between pages via bottom nav", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Navigate to สัตว์เลี้ยง (pets tab)
    await nav.getByText("สัตว์เลี้ยง").click();
    await expect(page).toHaveURL(/\/pets/);

    // Navigate to ฟีด (post feed — replaces hospital tab)
    await nav.getByText("ฟีด").click();
    await expect(page).toHaveURL(/\/post/);
  });

  test("report shortcut is visible on home and routes to post/lost", async ({ page }) => {
    await page.goto("/");
    // Home page quick-actions or bottom-nav แจ้ง button leads to /post/lost wizard
    const reportShortcut = page.getByText("แจ้งน้องหาย").first();
    await expect(reportShortcut).toBeVisible({ timeout: 10000 });
  });

  test("report shortcut links to /post/lost page", async ({ page }) => {
    await page.goto("/");
    await page.getByText("แจ้งน้องหาย").first().click();
    await expect(page).toHaveURL(/\/post\/lost/);
  });
});

test.describe("Pet CRUD flow", () => {
  test("can open the create pet form", async ({ page }) => {
    await page.goto("/pets");
    // D2 empty state "เพิ่มน้อง" button (or circular selector "เพิ่ม" tile)
    const addButton = page.getByRole("button", { name: /เพิ่มน้อง|เพิ่ม/ });
    await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    await addButton.first().click();

    // Form opens — look for pet name input (label or data-testid)
    await expect(page.getByLabel(/pet name|ชื่อน้อง/i)).toBeVisible({ timeout: 5000 });
  });
});
