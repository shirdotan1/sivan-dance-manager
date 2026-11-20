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
  await page.goto(`${baseURL}/login`);
  await page.locator("#email").fill(process.env.E2E_EMAIL!);
  await page.locator("#current-password").fill(process.env.E2E_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  fs.mkdirSync("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "e2e/.auth/state.json" });
  await browser.close();
}
