import type { Page, TestInfo } from "@playwright/test";
import { TAG, db, recordSeries, testSlotTime } from "./support/env";
import { expect, expectNoOverflow, go, test, vis } from "./support/fixtures";

/** Stage 5.2: weekly slots — creation with preview, renewal, adoption, no duplicates. */

const SPACE = "balance-studio";
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** The slot dates the app should create: from today, 8 weeks ahead (inclusive). */
function expectedDates(weekday: number, startsOn = todayIL()) {
  const to = addDays(todayIL(), 56);
  let d = startsOn > todayIL() ? startsOn : todayIL();
  d = addDays(d, (weekday - weekdayOf(d) + 7) % 7);
  const out: string[] = [];
  for (; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
}
/** A distinct test-hour time per test and width, so runs never share a slot. */
const slotTime = (info: TestInfo, minute: number) => testSlotTime(info.project.name, minute);

async function openSlotForm(page: Page) {
  await go(page, `/spaces/${SPACE}`);
  await vis(page.getByText("+ משבצת שבועית חדשה")).click();
  return vis(page.getByRole("form", { name: "משבצת שבועית חדשה" }));
}

async function newSeriesInDb(weekday: number, time: string) {
  const { data, error } = await (await db()).from("lesson_series").insert({ space_id: SPACE, weekday, time, starts_on: todayIL() }).select("id").single();
  if (error) throw error;
  recordSeries(data.id);
  return data.id as string;
}

const occurrences = async (seriesId: string) =>
  (await (await db()).from("lessons").select("id,date,time,series_date,group_id,cancelled_at").eq("series_id", seriesId).order("series_date")).data!;

test("creating a slot: preview first, then 8 weeks of envelopes, marked in the list", async ({ page }, info) => {
  const sb = await db();
  const weekday = weekdayOf(addDays(todayIL(), 2));
  const time = slotTime(info, 10);
  const { data: group } = await sb.from("groups").select("id,name").eq("space_id", SPACE).limit(1).single();
  const dates = expectedDates(weekday);

  const form = await openSlotForm(page);
  await form.getByLabel(/^יום בשבוע/).selectOption(String(weekday));
  await form.getByLabel(/^שעה/).fill(time);
  await form.getByLabel(/^קבוצה/).selectOption(group!.id);
  await form.getByRole("button", { name: "בדיקה" }).click();
  const preview = form.getByRole("region", { name: "תצוגה מקדימה" });
  await expect(preview).toContainText(`כל יום ${WEEKDAYS[weekday]} בשעה ${time}`);
  await expect(preview).toContainText(`ייווצרו ${dates.length} שיעורים`);
  // Nothing is saved by the preview.
  expect((await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time)).data).toEqual([]);

  await form.getByRole("button", { name: "יצירת המשבצת" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "המשבצת של יום" }))).toContainText(`נוצרו ${dates.length} שיעורים`);

  const { data: series } = await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time).single();
  recordSeries(series!.id);
  const occ = await occurrences(series!.id);
  expect(occ.map((o) => o.series_date)).toEqual(dates);
  for (const o of occ) {
    expect(o.date).toBe(o.series_date);
    expect(o.time.slice(0, 5)).toBe(time);
    expect(o.group_id).toBe(group!.id);
  }
  const { count: participants } = await sb.from("lesson_participants").select("*", { count: "exact", head: true }).in("lesson_id", occ.map((o) => o.id));
  expect(participants).toBe(0); // never pre-filled

  // Listed: the slot, and the upcoming lessons carry the weekly-slot mark.
  await go(page, `/spaces/${SPACE}`);
  await expect(vis(page.getByRole("region", { name: /משבצות שבועיות/ }))).toContainText(`כל יום ${WEEKDAYS[weekday]} · ${time}`);
  const upcoming = vis(page.getByRole("list", { name: /קרובים/ }));
  await expect(upcoming.getByText("משבצת שבועית").first()).toBeVisible();
  await expectNoOverflow(page);
});

test("an existing one-off lesson on a slot date is adopted, not duplicated", async ({ page }, info) => {
  const sb = await db();
  const time = slotTime(info, 20);
  const date = addDays(todayIL(), 9);
  const weekday = weekdayOf(date);
  const { data: oneOff, error } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} חד-פעמי ${info.project.name}` }).select("id").single();
  if (error) throw error;

  const form = await openSlotForm(page);
  await form.getByLabel(/^יום בשבוע/).selectOption(String(weekday));
  await form.getByLabel(/^שעה/).fill(time);
  await form.getByRole("button", { name: "בדיקה" }).click();
  const preview = form.getByRole("region", { name: "תצוגה מקדימה" });
  await expect(preview).toContainText("שיעור קיים אחד יצורף למשבצת");
  await expect(preview).toContainText(`ייווצרו ${expectedDates(weekday).length - 1} שיעורים`);
  await expect(preview).not.toContainText("הקבוצה של השיעור נשארת"); // same (no) group: no mismatch note
  await form.getByRole("button", { name: "יצירת המשבצת" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "המשבצת של יום" }))).toContainText("1 שיעורים קיימים צורפו");
  for (const r of (await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time)).data!) recordSeries(r.id);

  const { data: sameDay } = await sb.from("lessons").select("id,series_id,series_date").eq("space_id", SPACE).eq("date", date).eq("time", time);
  expect(sameDay).toHaveLength(1);
  expect(sameDay![0].id).toBe(oneOff.id);
  expect(sameDay![0].series_id).toBeTruthy();
  expect(sameDay![0].series_date).toBe(date);
});

test("creating after the details changed since the preview is refused (the preview is what gets saved)", async ({ page }, info) => {
  const sb = await db();
  const form = await openSlotForm(page);
  await form.getByLabel(/^יום בשבוע/).selectOption("1");
  await form.getByLabel(/^שעה/).fill(slotTime(info, 25));
  await form.getByRole("button", { name: "בדיקה" }).click();
  await expect(form.getByRole("region", { name: "תצוגה מקדימה" })).toBeVisible();
  // Change the time after the preview: the preview disappears; a forged create is refused server-side.
  await form.getByLabel(/^שעה/).fill(slotTime(info, 30));
  await expect(form.getByRole("region", { name: "תצוגה מקדימה" })).toHaveCount(0);
  await expect(form.getByRole("button", { name: "יצירת המשבצת" })).toHaveCount(0);
  expect((await sb.from("lesson_series").select("id").eq("time", slotTime(info, 30))).data).toEqual([]);
});

test("renewal twice at the same moment creates no duplicates", async ({ page, context }, info) => {
  const weekday = weekdayOf(addDays(todayIL(), 3));
  const seriesId = await newSeriesInDb(weekday, slotTime(info, 0));
  const second = await context.newPage();
  await Promise.all([go(page, `/spaces/${SPACE}`), go(second, `/spaces/${SPACE}`)]);
  await second.close();
  const occ = await occurrences(seriesId);
  expect(occ.map((o) => o.series_date)).toEqual(expectedDates(weekday));
  expect(new Set(occ.map((o) => o.series_date)).size).toBe(occ.length);
});

test("renewal never recreates a cancelled occurrence or duplicates a moved one", async ({ page }, info) => {
  const sb = await db();
  const weekday = weekdayOf(addDays(todayIL(), 4));
  const seriesId = await newSeriesInDb(weekday, slotTime(info, 5));
  await go(page, `/spaces/${SPACE}`);
  const occ = await occurrences(seriesId);
  const [first, second] = occ;
  await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", first.id);
  await sb.from("lessons").update({ date: addDays(second.date, 1), date_overridden: true }).eq("id", second.id);

  await go(page, `/spaces/${SPACE}`);
  await go(page, "/calendar");
  const after = await occurrences(seriesId);
  expect(after).toHaveLength(occ.length);
  expect(after.find((o) => o.id === first.id)?.cancelled_at).toBeTruthy();
  expect(after.filter((o) => o.series_date === second.series_date)).toHaveLength(1);
  expect(after.find((o) => o.series_date === second.series_date)?.date).toBe(addDays(second.date, 1));
});

test("opening the calendar renews slots too", async ({ page }, info) => {
  const weekday = weekdayOf(addDays(todayIL(), 5));
  const seriesId = await newSeriesInDb(weekday, slotTime(info, 15));
  expect(await occurrences(seriesId)).toHaveLength(0);
  await go(page, "/calendar");
  expect((await occurrences(seriesId)).map((o) => o.series_date)).toEqual(expectedDates(weekday));
});

test("home counts only lessons that took place, not future envelopes", async ({ page }) => {
  const sb = await db();
  const { count } = await sb.from("lessons").select("*", { count: "exact", head: true }).eq("space_id", SPACE).lte("date", todayIL()).is("cancelled_at", null);
  await go(page, "/");
  // The space card itself (the "next up" card may also mention the space).
  const card = vis(page.locator(`main a[href="/spaces/${SPACE}"]`)).first();
  await expect(card).toContainText(`${count} שיעורים`);
});

/** Adoption only links: a lesson's own group is never changed, and a mismatch is shown first. */
for (const dir of [
  { name: "lesson in a group, slot without", lessonGroup: true, slotGroup: false, minute: 35 },
  { name: "lesson without a group, slot in one", lessonGroup: false, slotGroup: true, minute: 40 },
] as const) {
  test(`adoption never changes the lesson's group (${dir.name}); the preview shows the mismatch`, async ({ page }, info) => {
    const sb = await db();
    const { data: groups } = await sb.from("groups").select("id,name").eq("space_id", SPACE).order("created_at").limit(2);
    const [a, b] = groups!;
    const time = slotTime(info, dir.minute);
    const date = addDays(todayIL(), 11);
    const { data: lesson, error } = await sb
      .from("lessons")
      .insert({ space_id: SPACE, date, time, group_id: dir.lessonGroup ? a.id : null, notes: `${TAG} קבוצה ${info.project.name}` })
      .select("id")
      .single();
    if (error) throw error;

    const form = await openSlotForm(page);
    await form.getByLabel(/^יום בשבוע/).selectOption(String(weekdayOf(date)));
    await form.getByLabel(/^שעה/).fill(time);
    if (dir.slotGroup) await form.getByLabel(/^קבוצה/).selectOption(b.id);
    await form.getByRole("button", { name: "בדיקה" }).click();
    const preview = form.getByRole("region", { name: "תצוגה מקדימה" });
    await expect(preview).toContainText(
      `הקבוצה היא ״${dir.lessonGroup ? a.name : "בלי קבוצה"}״ ובמשבצת ״${dir.slotGroup ? b.name : "בלי קבוצה"}״ — הקבוצה של השיעור נשארת כפי שהיא`,
    );
    await form.getByRole("button", { name: "יצירת המשבצת" }).click();
    await expect(vis(page.getByRole("status").filter({ hasText: "המשבצת של יום" }))).toContainText("1 שיעורים קיימים צורפו");
    for (const r of (await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time)).data!) recordSeries(r.id);

    const { data: after } = await sb.from("lessons").select("group_id,series_id,notes,date,time").eq("id", lesson.id).single();
    expect(after!.series_id).toBeTruthy(); // linked…
    expect(after!.group_id).toBe(dir.lessonGroup ? a.id : null); // …and its group untouched
    expect(after!.date).toBe(date);
  });
}
