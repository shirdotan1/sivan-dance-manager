import type { Page, TestInfo } from "@playwright/test";
import { TAG, db, recordSeries, testSlotTime } from "./support/env";
import { expect, go, submit, test, vis } from "./support/fixtures";

/** Stage 5.3: one occurrence — cancel / restore, never deleted, moved by hand (protected fields). */

const SPACE = "balance-studio";
const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const slotTime = (info: TestInfo, minute: number) => testSlotTime(info.project.name, minute);

/** A slot (test hour) with its occurrences created by visiting the space page. */
async function slotWithOccurrences(page: Page, info: TestInfo, minute: number, daysAhead = 2) {
  const sb = await db();
  const { data, error } = await sb
    .from("lesson_series")
    .insert({ space_id: SPACE, weekday: weekdayOf(addDays(todayIL(), daysAhead)), time: slotTime(info, minute), starts_on: todayIL() })
    .select("id")
    .single();
  if (error) throw error;
  recordSeries(data.id);
  await go(page, `/spaces/${SPACE}`);
  const { data: occ } = await sb.from("lessons").select("id,date,time,series_date").eq("series_id", data.id).order("series_date");
  return { seriesId: data.id as string, occ: occ! };
}
const lessonRow = async (id: string) =>
  (await (await db()).from("lessons").select("date,time,cancelled_at,date_overridden,time_overridden,series_date").eq("id", id).single()).data!;

test("cancel one occurrence: marked everywhere, renewal keeps it cancelled, and it can be restored", async ({ page }, info) => {
  const { seriesId, occ } = await slotWithOccurrences(page, info, 1);
  const target = occ[0];
  await go(page, `/spaces/${SPACE}/lessons/${target.id}`);
  await expect(vis(page.getByRole("button", { name: "מחיקת השיעור" }))).toHaveCount(0);
  await vis(page.getByRole("button", { name: "ביטול המופע הזה" })).click();
  const dialog = page.getByRole("dialog", { name: "לבטל את השיעור הזה?" });
  // The safe button never reads like the action ("ביטול…"): focus starts on it.
  await expect(dialog.getByRole("button", { name: "השארת השיעור" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "ביטול", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "ביטול המופע הזה" }).click();
  await expect(vis(page.getByRole("note", { name: "השיעור בוטל" }))).toBeVisible();
  expect((await lessonRow(target.id)).cancelled_at).toBeTruthy();
  await expect(vis(page.getByRole("link", { name: "עריכת משתתפות" }))).toHaveCount(0);

  // Marked in the space list and in the calendar's day list.
  await go(page, `/spaces/${SPACE}`);
  // Beyond the 4 nearest upcoming lessons it sits under "עוד N שיעורים קרובים".
  const inList = page.locator(`main a[href$="/lessons/${target.id}"]`);
  if ((await vis(inList).count()) === 0) await vis(page.getByText(/^עוד \d+ שיעורים קרובים$/)).click();
  await expect(vis(inList)).toContainText("מבוטל");
  await go(page, `/calendar?day=${target.date}`);
  await expect(vis(page.locator(`main a[href$="/lessons/${target.id}"]`))).toContainText("מבוטל");

  // Renewal (both views ran it) didn't bring it back or add a twin.
  const rows = (await (await db()).from("lessons").select("id,cancelled_at").eq("series_id", seriesId).eq("series_date", target.series_date)).data!;
  expect(rows).toHaveLength(1);
  expect(rows[0].cancelled_at).toBeTruthy();

  await go(page, `/spaces/${SPACE}/lessons/${target.id}`);
  await vis(page.getByRole("button", { name: "ביטול הביטול" })).click();
  await expect(vis(page.getByRole("note", { name: "השיעור בוטל" }))).toHaveCount(0);
  expect((await lessonRow(target.id)).cancelled_at).toBeNull();
});

test("a slot occurrence is never deleted: no button, and the server refuses", async ({ page }, info) => {
  const sb = await db();
  const { seriesId } = await slotWithOccurrences(page, info, 2);
  // A one-off lesson page shows "מחיקת השיעור"; link it to the slot behind the page's back, then try.
  const date = addDays(todayIL(), 60);
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date, time: slotTime(info, 2), notes: `${TAG} מחיקה ${info.project.name}` }).select("id").single();
  await go(page, `/spaces/${SPACE}/lessons/${l!.id}`);
  await sb.from("lessons").update({ series_id: seriesId, series_date: date }).eq("id", l!.id);
  await vis(page.getByRole("button", { name: "מחיקת השיעור" })).click();
  const dialog = page.getByRole("dialog", { name: "למחוק את השיעור?" });
  await dialog.getByRole("button", { name: "מחיקת השיעור" }).click();
  await expect(dialog.getByRole("alert")).toContainText("שיעור של משבצת שבועית לא נמחק");
  expect((await sb.from("lessons").select("id").eq("id", l!.id)).data).toHaveLength(1);
});

test("moving an occurrence by hand protects its date only, and renewal adds no duplicate", async ({ page }, info) => {
  const { seriesId, occ } = await slotWithOccurrences(page, info, 3);
  const target = occ[1];
  const moved = addDays(target.date, 1);
  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel(/^תאריך/)).fill(moved);
  await submit(page).click();
  await page.waitForURL(new RegExp(`/lessons/${target.id}\\?saved=1`));
  expect(await lessonRow(target.id)).toMatchObject({ date: moved, series_date: target.series_date, date_overridden: true, time_overridden: false });

  await go(page, `/spaces/${SPACE}`);
  await go(page, "/calendar");
  const same = (await (await db()).from("lessons").select("id,date").eq("series_id", seriesId).eq("series_date", target.series_date)).data!;
  expect(same).toEqual([{ id: target.id, date: moved }]);
});

test("time protection is per field: participants and group don't protect it; a changed time does; back to the slot time clears it", async ({ page }, info) => {
  const sb = await db();
  const { occ } = await slotWithOccurrences(page, info, 4);
  const target = occ[2];
  const { data: group } = await sb.from("groups").select("id").eq("space_id", SPACE).limit(1).single();

  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel("תלמידה מהמאגר")).selectOption({ index: 0 });
  await vis(page.getByRole("button", { name: "הוספה", exact: true })).click();
  await vis(page.getByLabel("קבוצת השיעור")).selectOption(group!.id);
  await submit(page).click();
  await page.waitForURL(/\?saved=1/);
  expect(await lessonRow(target.id)).toMatchObject({ time_overridden: false, date_overridden: false });

  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel(/^שעה/)).fill(slotTime(info, 9));
  await submit(page).click();
  await page.waitForURL(/\?saved=1/);
  expect(await lessonRow(target.id)).toMatchObject({ time_overridden: true, date_overridden: false });

  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  await vis(page.getByLabel(/^שעה/)).fill(slotTime(info, 4));
  await submit(page).click();
  await page.waitForURL(/\?saved=1/);
  expect((await lessonRow(target.id)).time_overridden).toBe(false);
});

test("a cancelled occurrence takes no new participants (UI hides adding; the server refuses a forged one)", async ({ page }, info) => {
  const sb = await db();
  const { occ } = await slotWithOccurrences(page, info, 6);
  const target = occ[0];
  await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", target.id);
  const { count: poolBefore } = await sb.from("students").select("*", { count: "exact", head: true }).eq("space_id", SPACE);

  await go(page, `/spaces/${SPACE}/lessons/${target.id}/edit`);
  const group = vis(page.locator("#participants"));
  await expect(group).toContainText("השיעור בוטל — אי אפשר להוסיף לו משתתפות");
  await expect(group.getByLabel("תלמידה מהמאגר")).toHaveCount(0);
  await expect(group.getByLabel("תלמידה חדשה (לא במאגר)")).toHaveCount(0);

  // Forge: a pool student and a brand-new name in the hidden field.
  const { data: s } = await sb.from("students").select("id").eq("space_id", SPACE).is("archived_at", null).limit(1).single();
  await page.locator('input[name="participants"]').evaluate((el: HTMLInputElement, id) => {
    el.value = JSON.stringify([{ id }, { name: "בדיקה-אוטו מזויפת" }]);
  }, s!.id);
  await submit(page).click();
  await expect(vis(page.getByText("יש לתקן את השדות המסומנים."))).toBeVisible();
  await expect(vis(page.locator("#participants"))).toContainText("אי אפשר להוסיף לו משתתפות");
  expect((await sb.from("lesson_participants").select("student_id").eq("lesson_id", target.id)).data).toEqual([]);
  const { count: poolAfter } = await sb.from("students").select("*", { count: "exact", head: true }).eq("space_id", SPACE);
  expect(poolAfter).toBe(poolBefore); // no student was created by the refused save
});

test("'הבא בתור' skips a cancelled lesson", async ({ page }, info) => {
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  test.skip(now >= "23:50", "too close to midnight for a same-day check");
  const [h, m] = now.split(":").map(Number);
  const soon = `${String(h + Math.floor((m + 2) / 60)).padStart(2, "0")}:${String((m + 2) % 60).padStart(2, "0")}`;
  const sb = await db();
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date: todayIL(), time: soon, notes: `${TAG} הבא ${info.project.name}` }).select("id").single();
  const nextUp = () => vis(page.getByRole("region", { name: "הבא בתור" }));

  await go(page, "/");
  await expect(nextUp().locator(`a[href$="/lessons/${l!.id}"]`)).toBeVisible();
  await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", l!.id);
  await go(page, "/");
  await expect(nextUp().locator(`a[href$="/lessons/${l!.id}"]`)).toHaveCount(0);
});
