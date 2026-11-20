import { db } from "./support/env";
import { expect, go, submit, test, vis } from "./support/fixtures";

/**
 * Regression (stage 4.1): media is managed only on the lesson/session page.
 * Saving the edit form must not delete or re-create media rows; once rows
 * point at real files, new ids would orphan them.
 */
const snapshot = async (col: "lesson_id" | "session_id", id: string) =>
  (await (await db()).from("media_items").select("id,kind,caption,position").eq(col, id).order("position")).data;

test("saving a lesson's edit form leaves its media rows untouched", async ({ page }) => {
  const sb = await db();
  const { data: m } = await sb.from("media_items").select("lesson_id").not("lesson_id", "is", null).limit(1).single();
  const { data: lesson } = await sb.from("lessons").select("id,space_id").eq("id", m!.lesson_id).single();
  const before = await snapshot("lesson_id", lesson!.id);
  expect(before!.length).toBeGreaterThan(0);

  await go(page, `/spaces/${lesson!.space_id}/lessons/${lesson!.id}/edit`);
  const form = vis(page.locator("main form")).last();
  await expect(form.getByRole("group", { name: /מדיה/ })).toHaveCount(0);
  await expect(form).toContainText("תמונות וסרטונים מוסיפים בעמוד השיעור עצמו");
  await submit(page).click();
  await page.waitForURL(new RegExp(`/lessons/${lesson!.id}\\?saved=1`));

  expect(await snapshot("lesson_id", lesson!.id)).toEqual(before);
});

test("saving a session's edit form leaves its media rows untouched", async ({ page }) => {
  const sb = await db();
  const { data: m } = await sb.from("media_items").select("session_id").not("session_id", "is", null).limit(1).single();
  const { data: session } = await sb.from("sessions").select("id,project_id").eq("id", m!.session_id).single();
  const before = await snapshot("session_id", session!.id);
  expect(before!.length).toBeGreaterThan(0);

  await go(page, `/spaces/private-lessons/projects/${session!.project_id}/sessions/${session!.id}/edit`);
  const form = vis(page.locator("main form")).last();
  await expect(form.getByRole("group", { name: /מדיה/ })).toHaveCount(0);
  await expect(form).toContainText("תמונות וסרטונים מוסיפים בעמוד המפגש עצמו");
  await submit(page).click();
  await page.waitForURL(new RegExp(`/sessions/${session!.id}\\?saved=1`));

  expect(await snapshot("session_id", session!.id)).toEqual(before);
});
