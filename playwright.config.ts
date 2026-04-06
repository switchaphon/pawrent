import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Uncomment to enable authenticated E2E tests:
    // {
    //   name: "setup",
    //   testMatch: /auth\.setup\.ts/,
    // },
    {
      name: "chromium",
      use: { browserName: "chromium" },
      // To use auth: dependencies: ["setup"],
      // use: { browserName: "chromium", storageState: "e2e/.auth/user.json" },
    },
    {
      name: "firefox",
      use: { browserName: "firefox" },
    },
  ],
  webServer: {
    command: "npm run dev -- --webpack",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
