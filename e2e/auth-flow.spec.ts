import { test, expect } from "@playwright/test";

/**
 * LIFF-gated pages behave differently based on whether
 * NEXT_PUBLIC_LIFF_ID is configured:
 *   - configured + reachable: LiffProvider redirects to access.line.me
 *   - missing (CI): liff.init() never resolves; page stays on the
 *     loading spinner until a real LIFF env comes online
 *
 * Neither state is deterministic enough to assert against in CI, so
 * these specs only verify that the route loads (no 5xx, renders a
 * body) — the full auth flow is covered by the integration tests.
 */
async function expectRouteLoads(page: import("@playwright/test").Page, route: string) {
  // waitUntil: "commit" returns once the navigation request commits, so we don't
  // race a follow-up LIFF redirect that would abort a default "load" wait.
  const res = await page.goto(route, { waitUntil: "commit" });
  expect(res?.status() ?? 0).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
}

test.describe("Authentication flow (unauthenticated via LIFF)", () => {
  test("home page loads without crashing", async ({ page }) => {
    await expectRouteLoads(page, "/");
  });

  test("/pets loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/pets");
  });

  test("/profile loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/profile");
  });

  test("/post loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/post");
  });

  test("/notifications loads without crashing when unauthenticated", async ({ page }) => {
    await expectRouteLoads(page, "/notifications");
  });
});
