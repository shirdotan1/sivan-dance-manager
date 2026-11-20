import { expect, expectNoOverflow, go, test, vis } from "./support/fixtures";

test("home: 'הבא בתור' + open payments link", async ({ page }) => {
  await go(page, "/");
  const sec = vis(page.getByRole("region", { name: "הבא בתור" }));
  await expect(sec).toContainText(/שיעור|מפגש|אין שיעורים או מפגשים קרובים/);
  await expect(sec).toContainText("תשלומים פתוחים");
  await expectNoOverflow(page);
  await sec.getByRole("link", { name: /תשלומים פתוחים/ }).click();
  await page.waitForURL(/\/spaces\/private-lessons\/payments/);
});
