import { TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, main, submit, test, vis } from "./support/fixtures";

test("bank: /songs redirect, explainer, 'הכול' default, video filter", async ({ page }) => {
  await go(page, "/songs");
  expect(new URL(page.url()).pathname).toBe("/materials");
  await expect(vis(page.getByRole("heading", { level: 1, name: "בנק חומרים" }))).toBeVisible();
  await expect(vis(page.getByText("שירים, סרטונים, קישורים והערות לשיעורים ולאימונים."))).toBeVisible();
  const all = vis(page.getByRole("radio", { name: /^הכול/ }));
  await expect(all).toBeChecked();
  await vis(page.getByRole("radio", { name: /^סרטון/ })).check();
  await expect(main(page)).toContainText("רעיונות לחימום ג׳אז לירי");
  await expect(main(page)).not.toContainText("Lyrical dance — ויקיפדיה");
  await expectNoOverflow(page);
});

test("FINAL-1: a video joins the bank and a lesson; a quick-added link joins the bank", async ({ page }, info) => {
  const sb = await db();
  const videoTitle = `${TAG} סרטון ${info.project.name}`;
  const linkTitle = `${TAG} קישור ${info.project.name}`;

  await go(page, "/materials");
  await vis(page.getByText("+ הוספת חומר לבנק")).click();
  const form = vis(page.getByRole("form", { name: "הוספת חומר לבנק" }));
  await expect(form.getByRole("radio", { name: "שיר" })).toBeChecked();
  await form.getByRole("radio", { name: "סרטון" }).check();
  await form.getByLabel("כותרת").fill(videoTitle);
  await form.getByLabel(/לינק/).fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await form.getByRole("button", { name: "הוספה לבנק" }).click();
  const card = vis(page.locator("li", { hasText: videoTitle })).last();
  await expect(card.getByRole("link", { name: /צפייה/ })).toBeVisible();
  expect((await sb.from("songs").select("kind").eq("title", videoTitle).single()).data?.kind).toBe("video");

  await go(page, "/spaces/new-high-school/lessons/new");
  await vis(page.getByLabel("תלמידה מהמאגר")).selectOption({ index: 0 });
  await vis(page.getByRole("button", { name: "הוספה", exact: true })).click();
  const mats = vis(page.getByRole("group", { name: /חומרים בשיעור/ }));
  await mats.getByLabel("חומר מהבנק").selectOption({ label: `סרטון: ${videoTitle}` });
  await mats.getByRole("button", { name: "הוספה של חומר מהבנק" }).click();
  await expect(mats.getByRole("radio", { name: "שיר" })).toBeChecked();
  await mats.getByRole("radio", { name: "קישור" }).check();
  await mats.getByLabel("כותרת").fill(linkTitle);
  await mats.getByLabel(/לינק/).fill("https://example.com/warmup");
  await mats.getByRole("button", { name: "הוספת החומר" }).click();
  await vis(page.getByLabel("הערות לשיעור")).fill(`${TAG} שיעור ${info.project.name}`);
  await expectNoOverflow(page);
  await submit(page).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}\?saved=1/);
  const sec = vis(page.getByRole("region", { name: /חומרים בשיעור/ }));
  await expect(sec).toContainText(videoTitle);
  await expect(sec).toContainText(linkTitle);
  await expectNoOverflow(page);

  await go(page, "/materials");
  await vis(page.getByRole("radio", { name: /^קישור/ })).check();
  await expect(vis(page.locator("li", { hasText: linkTitle })).last().getByRole("link", { name: /פתיחה/ })).toBeVisible();
  expect((await sb.from("songs").select("kind").eq("title", linkTitle).single()).data?.kind).toBe("link");
});

test("quick-add: a video without a link is refused inline", async ({ page }) => {
  await go(page, "/spaces/new-high-school/lessons/new");
  const mats = vis(page.getByRole("group", { name: /חומרים בשיעור/ }));
  await mats.getByRole("radio", { name: "סרטון" }).check();
  await mats.getByLabel("כותרת").fill("x");
  await mats.getByRole("button", { name: "הוספת החומר" }).click();
  await expect(mats.getByRole("alert")).not.toBeEmpty();
});

test("quick-add: an invalid link draft never blocks saving the lesson", async ({ page }, info) => {
  await go(page, "/spaces/new-high-school/lessons/new");
  await vis(page.getByLabel("תלמידה מהמאגר")).selectOption({ index: 0 });
  await vis(page.getByRole("button", { name: "הוספה", exact: true })).click();
  const mats = vis(page.getByRole("group", { name: /חומרים בשיעור/ }));
  await mats.getByRole("radio", { name: "סרטון" }).check();
  await mats.getByLabel(/לינק/).fill("לא כתובת");
  await mats.getByLabel(/לינק/).blur();
  await vis(page.getByLabel("הערות לשיעור")).fill(`${TAG} טיוטה ${info.project.name}`);
  await submit(page).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}\?saved=1/);
  await expect(vis(page.getByRole("region", { name: /חומרים בשיעור/ }))).not.toContainText("לא כתובת");
});

test("quick-add: an unknown kind is a field error, never a silent song", async ({ page }, info) => {
  const sb = await db();
  await go(page, "/spaces/new-high-school/lessons/new");
  await vis(page.getByLabel("הערות לשיעור")).fill(`${TAG} סוג ${info.project.name}`);
  await page.locator('input[name="materials"]').evaluate((el: HTMLInputElement) => {
    el.value = JSON.stringify([{ kind: "podcast", title: "בדיקה-אוטו פודקאסט" }]);
  });
  await submit(page).click();
  await expect(vis(page.getByText("יש לתקן את השדות המסומנים."))).toBeVisible();
  await page.waitForFunction(() => document.activeElement?.id === "materials");
  await expect(page.locator("#materials-error")).toContainText("לא מוכר");
  const { count } = await sb.from("songs").select("*", { count: "exact", head: true }).like("title", "%פודקאסט%");
  expect(count).toBe(0);
  expect(page.url()).not.toMatch(/\/lessons\/[0-9a-f-]{36}/);
});
