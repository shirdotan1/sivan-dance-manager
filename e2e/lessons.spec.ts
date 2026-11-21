import { SEED, TAG } from "./support/env";
import { expect, expectNoOverflow, go, submit, test, vis } from "./support/fixtures";

test("server field error: message, focus on the field, typed data kept", async ({ page }, info) => {
  await go(page, "/spaces/new-high-school/lessons/new");
  await vis(page.getByLabel("הערות לשיעור")).fill(`${TAG} שגיאה ${info.project.name}`);
  // Bypass the browser's own check so the server answers with a field error.
  const time = vis(page.getByLabel(/^שעה/));
  await time.evaluate((el: HTMLInputElement) => {
    el.removeAttribute("required");
    el.value = "";
  });
  await submit(page).click();
  await expect(vis(page.getByText("יש לתקן את השדות המסומנים."))).toBeVisible();
  const timeId = (await time.getAttribute("id"))!;
  await page.waitForFunction((id) => document.activeElement?.id === id, timeId);
  await expect(time).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(`[id="${timeId}-error"]`)).toContainText("יש לבחור שעה");
  await expect(vis(page.getByLabel("הערות לשיעור"))).toHaveValue(/שגיאה/);
  expect(page.url()).not.toMatch(/\/lessons\/[0-9a-f-]{36}/);
});

test("'עריכת משתתפות' on a lesson opens the edit form focused on participants", async ({ page }) => {
  await go(page, `/spaces/new-high-school/lessons/${SEED.lesson}`);
  await vis(page.getByRole("link", { name: /עריכת משתתפות/ })).click();
  await page.waitForURL(/\/edit#participants$/);
  await page.waitForFunction(() => document.activeElement?.id === "participants");
  await expectNoOverflow(page);
});
