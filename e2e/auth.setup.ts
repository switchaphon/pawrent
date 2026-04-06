/**
 * Playwright auth setup — logs in once and saves session for reuse.
 *
 * To enable authenticated E2E tests:
 * 1. Create a test account in Supabase
 * 2. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local or CI secrets
 * 3. Uncomment the "setup" project in playwright.config.ts
 *
 * This file logs in via the UI and saves the session to e2e/.auth/user.json
 * so authenticated tests don't need to repeat the login flow.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    setup.skip();
    return;
  }

  await page.goto("/");

  // Fill login form
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for auth to complete — should see the feed or pets page
  await expect(page.locator('nav, [data-testid="feed"]')).toBeVisible({ timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
});
