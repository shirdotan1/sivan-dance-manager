import type { Page, TestInfo } from "@playwright/test";
import { TAG, db, recordSeries, testSlotTime } from "./support/env";
import { expect, go, main, submit, test, vis } from "./support/fixtures";

/** Stage 5.4 (UI): "שינוי המשבצת מכאן והלאה" and the "moved" mark. */
const SPACE = "balance-studio";
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const slotTime = (info: TestInfo, minute: number) => testSlotTime(info.project.name, minute);

async function slotWithOccurrences(page: Page, info: TestInfo, minute: number, daysAhead: number) {
  const sb = await db();
  const weekday = weekdayOf(addDays(todayIL(), daysAhead));
  const time = slotTime(info, minute);
  const { data, error } = await sb.from("lesson_series").insert({ space_id: SPACE, weekday, time, starts_on: todayIL() }).select("id").single();
  if (error) throw error;
  recordSeries(data.id);
  await go(page, `/spaces/${SPACE}`);
  const { data: occ } = await sb.from("lessons").select("id,date,time,series_date").eq("series_id", data.id).order("series_date");
  return { id: data.id as string, weekday, time, occ: occ! };
}
async function openChange(page: Page, weekday: number, time: string) {
  await go(page, `/spaces/${SPACE}`);
  const item = vis(page.getByRole("region", { name: /משבצות שבועיות/ })).locator("li", { hasText: `כל יום ${WEEKDAYS[weekday]} · ${time}` });
  await item.getByText("שינוי המשבצת מכאן והלאה").click();
  return item.getByRole("form", { name: "שינוי המשבצת מכאן והלאה" });
}
/** Records the slot a UI change created, the moment it exists. */
async function recordNew(weekday: number, time: string) {
  const sb = await db();
  let id = "";
  await expect
    .poll(async () => {
      const { data } = await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("weekday", weekday).eq("time", time);
      id = data?.[0]?.id ?? "";
      return data?.length ?? 0;
    })
    .toBe(1);
  recordSeries(id);
  return id;
}

test("time change from the slot: preview, then the lessons from the date move to the new time", async ({ page }, info) => {
  const s = await slotWithOccurrences(page, info, 0, 2);
  const newTime = slotTime(info, 5);
  const form = await openChange(page, s.weekday, s.time);
  await expect(form.getByRole("radio", { name: "שעה", exact: true })).toBeChecked();
  await expect(form.getByLabel(/^החל מתאריך/)).toHaveValue(s.occ[0].series_date); // default: the next lesson
  await form.getByLabel(/^שעה חדשה/).fill(newTime);
  await form.getByRole("button", { name: "בדיקה" }).click();
  await expect(form.getByRole("region", { name: "תצוגה מקדימה של השינוי" })).toContainText(`${s.occ.length} שיעורים יעברו לשעה ${newTime}`);
  await form.getByRole("button", { name: "שינוי השעה" }).click();
  const newId = await recordNew(s.weekday, newTime);
  await expect(vis(page.getByRole("status").filter({ hasText: "המשבצת בשעה" }))).toBeVisible();
  const { data: occ } = await (await db()).from("lessons").select("time").eq("series_id", newId);
  expect(occ!.length).toBe(s.occ.length);
  for (const o of occ!) expect(o.time.slice(0, 5)).toBe(newTime);
});

test("day change from the slot: the preview lists removals and what stays; empty envelopes go, one with content stays", async ({ page }, info) => {
  const sb = await db();
  const s = await slotWithOccurrences(page, info, 10, 3);
  await sb.from("lessons").update({ notes: `${TAG} תוכן ${info.project.name}` }).eq("id", s.occ[1].id);
  const newWeekday = (s.weekday + 1) % 7;
  const form = await openChange(page, s.weekday, s.time);
  await form.getByRole("radio", { name: "יום (ושעה)" }).check();
  await form.getByLabel(/^יום חדש/).selectOption(String(newWeekday));
  await form.getByRole("button", { name: "בדיקה" }).click();
  const preview = form.getByRole("region", { name: "תצוגה מקדימה של השינוי" });
  await expect(preview).toContainText(`יוסרו ${s.occ.length - 1} שיעורים ריקים`);
  await expect(preview).toContainText("(יש בו תוכן)");
  await form.getByRole("button", { name: "העברת המשבצת" }).click();
  const newId = await recordNew(newWeekday, s.time);
  await expect(vis(page.getByRole("status").filter({ hasText: `ביום ${WEEKDAYS[newWeekday]}` }))).toBeVisible();
  const { data: old } = await sb.from("lessons").select("id").eq("series_id", s.id);
  expect(old!.map((o) => o.id)).toEqual([s.occ[1].id]);
  const { data: fresh } = await sb.from("lessons").select("date").eq("series_id", newId);
  for (const o of fresh!) expect(weekdayOf(o.date)).toBe(newWeekday);
});

test("a lesson moved by hand shows 'הוזז מהמשבצת' with its original day and time; moving it back clears it", async ({ page }, info) => {
  const s = await slotWithOccurrences(page, info, 15, 4);
  const target = s.occ[1];
  const mark = () => vis(page.getByText(/הוזז מהמשבצת/));
  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel(/^תאריך/)).fill(addDays(target.date, 1));
  await submit(page).click();
  await page.waitForURL(/\?saved=1/);
  await expect(mark()).toContainText(`במקור`);
  await expect(main(page)).toContainText(s.time);

  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel(/^תאריך/)).fill(target.date);
  await submit(page).click();
  await page.waitForURL(/\?saved=1/);
  await expect(mark()).toHaveCount(0);
});
