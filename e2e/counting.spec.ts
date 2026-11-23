import type { Page } from "@playwright/test";
import { TAG, db } from "./support/env";
import { expect, go, main, test, vis } from "./support/fixtures";

/**
 * One counting rule on every surface: a lesson counts once its start (date and
 * time, Asia/Jerusalem) has passed and it isn't cancelled.
 */
const SPACE = "balance-studio";
const nowIL = () => {
  const d = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { date, time };
};
const shift = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const homeCount = async (page: Page) => {
  await go(page, "/");
  const text = await vis(page.locator(`main a[href="/spaces/${SPACE}"]`)).first().innerText();
  return Number(text.match(/(\d+) שיעורים/)![1]);
};
const spaceHeld = async (page: Page) => {
  await go(page, `/spaces/${SPACE}`);
  const text = await vis(page.getByRole("heading", { level: 2, name: /^שיעורים/ })).innerText();
  return Number(text.match(/\((\d+) התקיימו\)/)![1]);
};
const studentCount = async (page: Page, id: string) => {
  await go(page, `/students/${id}`);
  const dd = main(page).locator("dt", { hasText: "השתתפויות" }).locator("xpath=following-sibling::dd[1]");
  return Number(await dd.innerText());
};

test("earlier today counts; later today doesn't yet; cancelled never — on the home card, the space page and the student card", async ({ page }, info) => {
  const now = nowIL();
  test.skip(now.time < "00:31" || now.time > "23:29", "needs ±30 minutes inside today");
  const sb = await db();
  const { data: student } = await sb.from("students").select("id").eq("space_id", SPACE).is("archived_at", null).limit(1).single();
  const [home0, held0, card0] = [await homeCount(page), await spaceHeld(page), await studentCount(page, student!.id)];

  const rows = [
    { label: "מוקדם", time: shift(now.time, -30), cancelled: false },
    { label: "מאוחר", time: shift(now.time, 30), cancelled: false },
    { label: "מבוטל", time: shift(now.time, -30), cancelled: true },
  ];
  const ids: Record<string, string> = {};
  for (const r of rows) {
    const { data, error } = await sb
      .from("lessons")
      .insert({ space_id: SPACE, date: now.date, time: r.time, notes: `${TAG} ספירה-${r.label} ${info.project.name}`, cancelled_at: r.cancelled ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error) throw error;
    ids[r.label] = data.id;
    const p = await sb.from("lesson_participants").insert({ lesson_id: data.id, student_id: student!.id });
    if (p.error) throw p.error;
  }

  expect(await homeCount(page)).toBe(home0 + 1);
  expect(await spaceHeld(page)).toBe(held0 + 1);
  // On the space page: later today is upcoming, earlier today (and the cancelled one) are past.
  const upcoming = vis(page.getByRole("list", { name: /קרובים/ }));
  const past = vis(page.getByRole("list", { name: /קודמים/ }));
  await expect(upcoming.locator(`a[href$="/lessons/${ids["מאוחר"]}"]`)).toHaveCount(1);
  await expect(past.locator(`a[href$="/lessons/${ids["מוקדם"]}"]`)).toHaveCount(1);
  await expect(past.locator(`a[href$="/lessons/${ids["מבוטל"]}"]`)).toContainText("מבוטל");
  expect(await studentCount(page, student!.id)).toBe(card0 + 1);
});
