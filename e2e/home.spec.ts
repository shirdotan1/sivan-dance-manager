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

test("backup: the page and the exported file say media files are not included", async ({ page, request }) => {
  await go(page, "/");
  await expect(vis(page.getByRole("region", { name: "גיבוי" }))).toContainText("קבצי התמונות והסרטונים עצמם אינם כלולים");
  const res = await request.get("/export");
  expect(res.status()).toBe(200);
  const backup = await res.json();
  expect(backup.note).toContain("אינם כלולים");
  expect(backup.tables.media_items.length).toBeGreaterThan(0);
});
