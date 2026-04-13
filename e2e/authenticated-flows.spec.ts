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

// Use saved auth state
test.use({
  storageState: "e2e/.auth/user.json",
});

test.describe("Authenticated user flows", () => {
  test("can access /pets page after login", async ({ page }) => {
    await page.goto("/pets");
    // Should NOT redirect to login
    await expect(page).toHaveURL(/\/pets/);
    // Should see pets content
    await expect(page.getByText(/my pets|add.*pet/i)).toBeVisible({ timeout: 10000 });
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
    // Should see bottom nav (authenticated)
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Navigate to pets
    await nav.getByText(/pets/i).click();
    await expect(page).toHaveURL(/\/pets/);

    // Navigate to hospital
    await nav.getByText(/hospital/i).click();
    await expect(page).toHaveURL(/\/hospital/);
  });

  test("Report button is visible on feed page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Report Lost Pet")).toBeVisible({ timeout: 10000 });
  });

  test("Report button links to /post page", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Report Lost Pet").click();
    await expect(page).toHaveURL(/\/post/);
  });
});

test.describe("Pet CRUD flow", () => {
  test("can open the create pet form", async ({ page }) => {
    await page.goto("/pets");
    // Look for the add pet button (floating + button or text)
    const addButton = page.getByText(/add.*pet/i).or(page.locator('[aria-label*="add"]'));
    await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    await addButton.first().click();

    // Should see the create pet form
    await expect(page.getByText("Add New Pet")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/pet name/i)).toBeVisible();
  });
});
