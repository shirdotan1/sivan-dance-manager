import { SEED } from "./support/env";
import { expect, expectNoOverflow, go, test } from "./support/fixtures";

test("no old song wording and no horizontal overflow on the main pages", async ({ page }) => {
  for (const p of [
    "/", "/calendar", "/materials", "/spaces/new-high-school", "/spaces/balance-studio", "/spaces/private-lessons",
    `/spaces/private-lessons/projects/${SEED.project}`, `/spaces/private-lessons/projects/${SEED.project}/edit`,
    `/spaces/new-high-school/lessons/${SEED.lesson}`,
  ]) {
    await go(page, p);
    const t = await page.locator("body").innerText();
    for (const bad of ["שיר ראשי", "בנק שירים", "בנק השירים", "שירים בשיעור", "שירים במפגש"]) expect(t, p).not.toContain(bad);
    expect(t, p).not.toMatch(/\d+ שירים/);
    await expectNoOverflow(page);
  }
});
