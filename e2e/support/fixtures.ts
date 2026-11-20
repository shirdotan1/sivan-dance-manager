import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** Every test fails on uncaught page errors or console errors. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await use(errors);
      expect(errors, "console / page errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Next keeps previous routes in the DOM (hidden); act only on visible ones. */
export const vis = (loc: Locator) => loc.filter({ visible: true });
export const main = (page: Page) => vis(page.locator("main")).last();

export async function go(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/** Submit button of the page's main form (the save in the action bar). */
export const submit = (page: Page) => vis(page.locator('main form button[type="submit"]')).last();
