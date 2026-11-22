import { defineConfig, devices } from "@playwright/test";

// Same env as the app (.env.local is never committed). Tests write to the
// database, so e2e/support/env.ts refuses to run unless it is the TEST project.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI or a machine without .env.local: the guard in e2e/support/env.ts stops the run. */
}

const PORT = 3100;
export const FAULT_PORT = 3101;

export default defineConfig({
  testDir: "./e2e",
  // One shared test database: run serially and in a fixed order.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    storageState: "e2e/.auth/state.json",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: [
    {
      // Production build (env baked from .env.local, i.e. the test project).
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      // Same build with per-request fault injection enabled (src/lib/testFaults.ts):
      // a test opts in with the x-test-fault header; test bucket only.
      command: `npx next start -p ${FAULT_PORT}`,
      url: `http://localhost:${FAULT_PORT}/login`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { MEDIA_TEST_FAULTS: "on" },
    },
  ],
});
