import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { assertTestEnvironment, cleanup, db } from "./support/env";

/** Guard + leftover cleanup + one login shared by all tests. */
export default async function globalSetup(config: FullConfig) {
  assertTestEnvironment();
  console.log("cleanup before:", JSON.stringify(await cleanup(await db())));
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // The login page streams: its Suspense fallback is the same form, so the
  // DOM can briefly hold two copies. Wait for it to settle; use the visible one.
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  const form = page.locator("form").filter({ visible: true }).filter({ has: page.locator("#email") });
  await form.locator("#email").fill(process.env.E2E_EMAIL!);
  await form.locator("#current-password").fill(process.env.E2E_PASSWORD!);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  fs.mkdirSync("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "e2e/.auth/state.json" });
  await browser.close();
}
