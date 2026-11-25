import type { Locator, Page } from "@playwright/test";
import { isOpenPayment, monthOf, monthSummary, offTheRadar, paymentSummary, summarizeStudent, type Participation } from "../src/lib/attendance";
import { shiftMonth } from "../src/lib/calendar";
import { addDays, formatCurrency, formatDate } from "../src/lib/format";
import { nowInIsrael, type Moment } from "../src/lib/lessonTime";
import { TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, main, test, vis } from "./support/fixtures";

/**
 * Student view: the card's numbers and history, "off the radar" on the space
 * page, and the month summary — all counted with the shared rule
 * (src/lib/lessonTime.ts via src/lib/attendance.ts). Lessons count by their
 * participants lists; sessions by session_payments (PM ruling 25.11).
 */

const STUDIO = "balance-studio";
const PRIVATE = "private-lessons";
// Outside the series test window (04:00–06:59), so no slot ever meets these lessons.
const TIME = "03:47";
const phoneOnly = (name: string) => test.skip(name !== "phone-390", "function-level: once is enough");

// ---------- Function level: the counting rules (390 only) ----------

const rec = (eventId: string, date: string, time: string, extra: Partial<Participation> = {}): Participation => ({ eventId, kind: "lesson", date, time, ...extra });

test("count rules: cancelled never, future never, later today not yet, earlier today yes; next up skips cancelled", ({}, info) => {
  phoneOnly(info.project.name);
  const now: Moment = { date: "2026-11-25", time: "12:00" };
  const s = summarizeStudent(
    [
      rec("past", "2026-11-20", "10:00", { bucketId: "g1", bucketName: "בוגרות" }),
      rec("earlier-today", "2026-11-25", "11:59", { bucketId: "g1", bucketName: "בוגרות" }),
      rec("at-now", "2026-11-25", "12:00"),
      rec("later-today", "2026-11-25", "12:01"),
      rec("cancelled-past", "2026-11-24", "10:00", { cancelled: true }),
      rec("cancelled-future", "2026-11-26", "10:00", { cancelled: true }),
      rec("future", "2026-11-27", "10:00"),
    ],
    now,
  );
  expect(s.held).toBe(3); // past, earlier today, and the one starting this minute
  expect(s.lastHeld?.eventId).toBe("at-now");
  expect(s.nextUp?.eventId).toBe("later-today");
  expect(s.upcoming.map((r) => r.eventId)).toEqual(["later-today", "cancelled-future", "future"]);
  expect(s.past.map((r) => r.eventId)).toEqual(["at-now", "earlier-today", "cancelled-past", "past"]);
  expect(s.breakdown).toEqual([
    { bucketId: "g1", bucketName: "בוגרות", held: 2 },
    { bucketId: null, bucketName: null, held: 1 },
  ]);
});

test("count rules: the month boundary is Israel's — 1 Dec 00:30 is December even while it is still 30 Nov in UTC", ({}, info) => {
  phoneOnly(info.project.name);
  const records = [rec("nov-30-late", "2026-11-30", "23:30"), rec("dec-1-early", "2026-12-01", "00:30")];
  const RealDate = Date;
  const prevTz = process.env.TZ;
  // 2026-11-30 22:45 UTC = 2026-12-01 00:45 in Israel (UTC+2). The process runs in UTC.
  const FIXED = RealDate.UTC(2026, 10, 30, 22, 45);
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length) super(...(args as [number]));
      else super(FIXED);
    }
    static now() {
      return FIXED;
    }
  }
  try {
    process.env.TZ = "UTC";
    globalThis.Date = FixedDate as DateConstructor;
    const now = nowInIsrael();
    expect(now).toEqual({ date: "2026-12-01", time: "00:45" });
    const s = summarizeStudent(records, now);
    expect(s.held).toBe(2);
    expect(s.heldThisMonth, "only 1 Dec counts in December").toBe(1);
    expect(monthOf(s.lastHeld!.date)).toBe("2026-12");
    const m = monthSummary("2026-11", [{ id: "nov-30-late", date: "2026-11-30", time: "23:30" }], [{ id: "a", name: "א" }], new Map([["a", records]]), now);
    expect(m).toMatchObject({ eventsHeld: 1, rows: [{ held: 1 }] });
  } finally {
    globalThis.Date = RealDate;
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  }
});

test("off the radar: active, with history, nothing held in the last 28 days", ({}, info) => {
  phoneOnly(info.project.name);
  const now: Moment = { date: "2026-11-25", time: "12:00" };
  const students = [
    { id: "gone", name: "נעלמה" },
    { id: "edge-in", name: "בדיוק 28" },
    { id: "edge-out", name: "28 ודקה" },
    { id: "active", name: "פעילה" },
    { id: "archived", name: "מאורכבת", archived: true },
    { id: "new", name: "חדשה" },
    { id: "only-cancelled", name: "רק מבוטל לאחרונה" },
    { id: "nothing", name: "בלי כלום" },
  ];
  const records = new Map<string, Participation[]>([
    ["gone", [rec("a", "2026-10-01", "10:00")]],
    ["edge-in", [rec("b", "2026-10-28", "12:00")]], // exactly 28 days: inside the window
    ["edge-out", [rec("c", "2026-10-28", "11:59")]],
    ["active", [rec("d", "2026-10-01", "10:00"), rec("e", "2026-11-20", "10:00")]],
    ["archived", [rec("f", "2026-10-01", "10:00")]],
    ["new", [rec("g", "2026-12-01", "10:00")]], // only upcoming: no history yet
    ["only-cancelled", [rec("h", "2026-10-02", "10:00"), rec("i", "2026-11-20", "10:00", { cancelled: true })]],
  ]);
  const out = offTheRadar(students, records, now);
  expect(out.map((o) => [o.student.id, o.lastHeld.date])).toEqual([
    ["gone", "2026-10-01"],
    ["only-cancelled", "2026-10-02"],
    ["edge-out", "2026-10-28"],
  ]);
});

test("month summary: held events of the month, per student most first; cancelled and future never count", ({}, info) => {
  phoneOnly(info.project.name);
  const now: Moment = { date: "2026-11-25", time: "12:00" };
  const events = [
    { id: "e1", date: "2026-11-02", time: "10:00" },
    { id: "e2", date: "2026-11-09", time: "10:00" },
    { id: "e3", date: "2026-11-16", time: "10:00", cancelled: true },
    { id: "e4", date: "2026-11-30", time: "10:00" }, // future
    { id: "e5", date: "2026-10-31", time: "23:00" }, // other month
  ];
  const students = [
    { id: "b", name: "בת" },
    { id: "a", name: "אביב" },
    { id: "z", name: "זהר", archived: true },
    { id: "none", name: "בלי" },
  ];
  const r = (id: string, extra: Partial<Participation> = {}) => {
    const e = events.find((x) => x.id === id)!;
    return rec(id, e.date, e.time, { cancelled: e.cancelled, ...extra });
  };
  const records = new Map<string, Participation[]>([
    ["a", [r("e1"), r("e2"), r("e3"), r("e4"), r("e5")]],
    ["b", [r("e1")]],
    ["z", [r("e2")]],
    ["none", [r("e3"), r("e4"), r("e5")]],
  ]);
  const m = monthSummary("2026-11", events, students, records, now);
  expect(m.eventsHeld).toBe(2);
  expect(m.rows.map((x) => [x.student.id, x.held])).toEqual([
    ["a", 2],
    ["b", 1],
    ["z", 1],
  ]);
});

test("payments: the open-payments page's filter — unpaid and above ₪0", ({}, info) => {
  phoneOnly(info.project.name);
  const rows = [
    { sessionId: "s1", amount: 100, paid: true },
    { sessionId: "s2", amount: 50, paid: false },
    { sessionId: "s3", amount: 0, paid: false },
    { sessionId: "s4", amount: 70, paid: false },
  ];
  expect(rows.filter(isOpenPayment).map((r) => r.sessionId)).toEqual(["s2", "s4"]);
  expect(paymentSummary(rows)).toEqual({ sessions: 4, paidCount: 1, paidSum: 100, openCount: 2, openSum: 120 });
});

// ---------- In the app (both widths) ----------

const ddOf = (scope: Locator, dt: string) => scope.locator("dt", { hasText: dt }).locator("xpath=following-sibling::dd[1]");

async function newStudent(space: string, name: string, archived = false) {
  const { data, error } = await (await db())
    .from("students")
    .insert({ space_id: space, name, ...(archived ? { archived_at: new Date().toISOString() } : {}) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function newLesson(date: string, notes: string, studentIds: string[], extra: { cancelled?: boolean; groupId?: string } = {}) {
  const sb = await db();
  const { data, error } = await sb
    .from("lessons")
    .insert({
      space_id: STUDIO,
      date,
      time: TIME,
      notes: `${TAG} ${notes}`,
      ...(extra.groupId ? { group_id: extra.groupId } : {}),
      ...(extra.cancelled ? { cancelled_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  if (studentIds.length) {
    const p = await sb.from("lesson_participants").insert(studentIds.map((student_id) => ({ lesson_id: data.id, student_id })));
    if (p.error) throw p.error;
  }
  return data.id as string;
}

test("student card (studio): attended lessons, this month, last and next, by group; history apart from upcoming, cancelled marked", async ({ page }, info) => {
  const sb = await db();
  const now = nowInIsrael();
  const { data: group } = await sb.from("groups").select("id, name").eq("space_id", STUDIO).limit(1).single();
  const id = await newStudent(STUDIO, `${TAG} כרטיס ${info.project.name}`);
  const d = (n: number) => addDays(now.date, n);
  await newLesson(d(-40), "כרטיס-ישן", [id], { groupId: group!.id });
  await newLesson(d(-2), "כרטיס-אחרון", [id]);
  await newLesson(d(-1), "כרטיס-מבוטל", [id], { cancelled: true });
  await newLesson(d(3), "כרטיס-מבוטל-קרוב", [id], { cancelled: true });
  await newLesson(d(5), "כרטיס-הבא", [id]);
  const thisMonth = [d(-40), d(-2)].filter((x) => monthOf(x) === monthOf(now.date)).length;

  await go(page, `/students/${id}`);
  const summary = vis(page.getByRole("region", { name: "במבט אחד" }));
  await expect(ddOf(summary, "שיעורים שהייתה בהם")).toHaveText("2");
  await expect(ddOf(summary, "החודש")).toHaveText(String(thisMonth));
  await expect(ddOf(summary, "שיעור אחרון")).toHaveText(formatDate(d(-2)));
  await expect(ddOf(summary, "הבא בתור")).toHaveText(formatDate(d(5)));
  await expect(summary.getByRole("heading", { name: "לפי קבוצה" })).toBeVisible();
  await expect(summary.getByRole("listitem").filter({ hasText: group!.name })).toContainText("1");
  await expect(summary.getByRole("listitem").filter({ hasText: "בלי קבוצה" })).toContainText("1");

  const upcoming = vis(page.getByRole("region", { name: /^קרובים/ }));
  await expect(upcoming.getByRole("heading")).toHaveText("קרובים (2)");
  await expect(upcoming.getByRole("listitem").nth(0)).toContainText(formatDate(d(3)));
  await expect(upcoming.getByRole("listitem").nth(0)).toContainText("מבוטל");
  await expect(upcoming.getByRole("listitem").nth(1)).toContainText(formatDate(d(5)));
  const history = vis(page.getByRole("region", { name: /^היסטוריה/ }));
  await expect(history.getByRole("heading")).toHaveText("היסטוריה (3)");
  const dates = await history.getByRole("listitem").allInnerTexts();
  expect(dates.map((t) => t.split("\n")[0])).toEqual([formatDate(d(-1)), formatDate(d(-2)), formatDate(d(-40))]);
  await expect(history.getByRole("listitem").nth(0)).toContainText("מבוטל");
  await expect(history.getByRole("listitem").nth(1)).not.toContainText("מבוטל");
  await expectNoOverflow(page);
});

test("student card (private): sessions in the project by session_payments; payments from the open-payments rows, also of a project she left", async ({ page }, info) => {
  const sb = await db();
  const now = nowInIsrael();
  const d = (n: number) => addDays(now.date, n);
  const name = `${TAG} פרטי ${info.project.name}`;
  const id = await newStudent(PRIVATE, name);
  const project = async (pname: string, member: boolean) => {
    const { data, error } = await sb.from("projects").insert({ space_id: PRIVATE, name: `${TAG} ${pname} ${info.project.name}`, type: "solo", color: "#7c3aed" }).select("id, name").single();
    if (error) throw error;
    if (member) {
      const m = await sb.from("project_participants").insert({ project_id: data.id, student_id: id });
      if (m.error) throw m.error;
    }
    return data as { id: string; name: string };
  };
  const session = async (projectId: string, date: string, amount: number, paid: boolean) => {
    const { data, error } = await sb.from("sessions").insert({ project_id: projectId, date, time: TIME, notes: `${TAG} מפגש` }).select("id").single();
    if (error) throw error;
    const p = await sb.from("session_payments").insert({ session_id: data.id, student_id: id, amount, paid });
    if (p.error) throw p.error;
  };
  const current = await project("פרויקט", true);
  const former = await project("פרויקט-קודם", false); // she left it; her payment row stays
  await session(current.id, d(-10), 100, true);
  await session(current.id, d(-5), 50, false);
  await session(current.id, d(-3), 0, false);
  await session(current.id, d(4), 80, false);
  await session(former.id, d(-20), 70, false);

  await go(page, `/students/${id}`);
  const summary = vis(page.getByRole("region", { name: "במבט אחד" }));
  await expect(ddOf(summary, "מפגשים בפרויקט")).toHaveText("4");
  await expect(ddOf(summary, "מפגש אחרון")).toHaveText(formatDate(d(-3)));
  await expect(ddOf(summary, "הבא בתור")).toHaveText(formatDate(d(4)));
  await expect(summary.getByRole("heading", { name: "לפי פרויקט" })).toBeVisible();
  await expect(summary.getByRole("listitem").filter({ hasText: current.name })).toContainText("3");
  await expect(summary.getByRole("listitem").filter({ hasText: former.name })).toContainText("1");

  const pay = vis(page.getByRole("region", { name: "תשלומים" }));
  await expect(ddOf(pay, "מפגשים")).toHaveText("5");
  await expect(ddOf(pay, "שולם")).toHaveText(`${formatCurrency(100)} · 1 מפגשים`);
  await expect(ddOf(pay, "פתוח")).toHaveText(`${formatCurrency(200)} · 3 מפגשים`);
  await expect(pay.getByRole("button", { name: /תזכורת/ })).toBeVisible();
  await expectNoOverflow(page);

  // The same source as the open-payments page: her total there is the card's open sum.
  await go(page, `/spaces/${PRIVATE}/payments`);
  await expect(vis(page.getByRole("heading", { level: 2, name: new RegExp(name) }))).toContainText(formatCurrency(200));
});

test("off the radar on the space page: gone 28+ days are listed with the last date; active, archived and new students are not", async ({ page }, info) => {
  const now = nowInIsrael();
  const d = (n: number) => addDays(now.date, n);
  const p = info.project.name;
  const gone = await newStudent(STUDIO, `${TAG} רדאר-נעלמה ${p}`);
  const active = await newStudent(STUDIO, `${TAG} רדאר-פעילה ${p}`);
  const archived = await newStudent(STUDIO, `${TAG} רדאר-מאורכבת ${p}`, true);
  const fresh = await newStudent(STUDIO, `${TAG} רדאר-חדשה ${p}`);
  const cancelledOnly = await newStudent(STUDIO, `${TAG} רדאר-בוטל ${p}`);
  await newLesson(d(-35), "רדאר-ישן", [gone, active, archived, cancelledOnly]);
  await newLesson(d(-3), "רדאר-אחרון", [active]);
  await newLesson(d(-2), "רדאר-מבוטל", [cancelledOnly], { cancelled: true });
  await newLesson(d(6), "רדאר-קרוב", [fresh]);

  await go(page, `/spaces/${STUDIO}`);
  const radar = vis(page.getByRole("region", { name: /^נעלמו מהרדאר/ }));
  const row = (n: string) => radar.getByRole("listitem").filter({ hasText: n });
  await expect(row(`רדאר-נעלמה ${p}`)).toContainText(`שיעור אחרון: ${formatDate(d(-35))}`);
  await expect(row(`רדאר-בוטל ${p}`)).toContainText(`שיעור אחרון: ${formatDate(d(-35))}`);
  for (const n of ["רדאר-פעילה", "רדאר-מאורכבת", "רדאר-חדשה"]) await expect(row(`${n} ${p}`)).toHaveCount(0);
  await row(`רדאר-נעלמה ${p}`).getByRole("link").click();
  await expect(vis(page.getByRole("heading", { level: 1, name: `${TAG} רדאר-נעלמה ${p}` }))).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/students/${gone}$`));
});

test("off the radar in the private space: counted by session_payments", async ({ page }, info) => {
  const sb = await db();
  const now = nowInIsrael();
  const name = `${TAG} רדאר-פרטי ${info.project.name}`;
  const id = await newStudent(PRIVATE, name);
  const { data: pr, error } = await sb.from("projects").insert({ space_id: PRIVATE, name: `${TAG} רדאר ${info.project.name}`, type: "solo", color: "#7c3aed" }).select("id").single();
  if (error) throw error;
  const { data: se } = await sb.from("sessions").insert({ project_id: pr.id, date: addDays(now.date, -30), time: TIME, notes: `${TAG} רדאר` }).select("id").single();
  const p = await sb.from("session_payments").insert({ session_id: se!.id, student_id: id, amount: 0, paid: false });
  if (p.error) throw p.error;

  await go(page, `/spaces/${PRIVATE}`);
  const radar = vis(page.getByRole("region", { name: /^נעלמו מהרדאר/ }));
  await expect(radar.getByRole("listitem").filter({ hasText: name })).toContainText(`מפגש אחרון: ${formatDate(addDays(now.date, -30))}`);
  await expectNoOverflow(page);
});

test("month summary page: lessons held, students on at least one, per student most first; archived marked; month in the URL", async ({ page }, info) => {
  const sb = await db();
  const now = nowInIsrael();
  const month = shiftMonth(monthOf(now.date), -1); // fully in the past: every lesson in it has started
  const day = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
  const p = info.project.name;
  const x = await newStudent(STUDIO, `${TAG} סיכום-שתיים ${p}`);
  const y = await newStudent(STUDIO, `${TAG} סיכום-אחת ${p}`);
  const z = await newStudent(STUDIO, `${TAG} סיכום-מאורכבת ${p}`, true);
  await newLesson(day(3), "סיכום-1", [x, y]);
  await newLesson(day(10), "סיכום-2", [x, z]);
  await newLesson(day(17), "סיכום-מבוטל", [y], { cancelled: true });
  // The oracle: every non-cancelled lesson of the space that month (all have started).
  const { count } = await sb
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("space_id", STUDIO)
    .gte("date", day(1))
    .lt("date", `${shiftMonth(month, 1)}-01`)
    .is("cancelled_at", null);

  await go(page, `/spaces/${STUDIO}`);
  await vis(page.getByRole("link", { name: "סיכום חודשי" })).click();
  await expect(page).toHaveURL(new RegExp(`/spaces/${STUDIO}/summary$`));
  await vis(page.getByRole("link", { name: /^החודש הקודם/ })).click();
  await expect(page).toHaveURL(new RegExp(`/spaces/${STUDIO}/summary\\?month=${month}$`));

  const m = main(page);
  await expect(ddOf(m, "שיעורים התקיימו")).toHaveText(String(count));
  const rows = m.getByRole("row").filter({ hasText: `סיכום-` }).filter({ hasText: p });
  await expect(rows).toHaveCount(3);
  const texts = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  expect(texts[0]).toContain(`סיכום-שתיים ${p}`);
  expect(texts[0]).toMatch(/2$/);
  expect(texts.slice(1).join("|")).toContain(`סיכום-אחת ${p}`);
  await expect(rows.filter({ hasText: `סיכום-מאורכבת ${p}` })).toContainText("(הוסרה מהמאגר)");
  await expect(rows.filter({ hasText: `סיכום-אחת ${p}` })).toContainText("1"); // the cancelled one never counts
  await expectNoOverflow(page);
});

async function summaryOf(page: Page, space: string) {
  await go(page, `/spaces/${space}/summary`);
  return main(page);
}

test("month summary in the private space counts sessions", async ({ page }) => {
  const m = await summaryOf(page, PRIVATE);
  await expect(m.locator("dt", { hasText: "מפגשים התקיימו" })).toBeVisible();
  await expectNoOverflow(page);
});
