import type { Page } from "@playwright/test";
import { FAULT_PORT } from "../playwright.config";
import { TEST_CORE_HOUR, db, recordSeries } from "./support/env";
import { expect, go, main, test, vis } from "./support/fixtures";

/**
 * Prerender round: a page render that is not a real request (a link's
 * prefetch) must never run the slot renewal, and must never carry a false
 * "renewal failed" alert into the page it prefetches. A renewal failure on a
 * real view of the calendar is shown on the calendar, as on the space page.
 * (The server logs of the whole run are checked for prerender errors in
 * e2e/global-teardown.ts.)
 */

const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const tomorrowWeekdayIL = () => (new Date(`${todayIL()}T12:00:00Z`).getUTCDay() + 1) % 7;

/**
 * Resolves once the prefetch of a route's page segment has been fully
 * received. It must be a prefetch (`Next-Router-Prefetch: 1`) of that page
 * segment — otherwise the wait times out and the test fails, so a test can
 * never pass on a prefetch that did not happen. The body is awaited to its
 * end: the server's prefetch render is over.
 * Matched by the segment key (e.g. `/spaces/$d$spaceId/__PAGE__`), not by the
 * URL: the App Shell is shared by every link to the route, so it is fetched
 * once, through whichever link was seen first.
 */
async function pagePrefetched(page: Page, segment: string) {
  const response = await page.waitForResponse((r) => {
    const h = r.request().headers();
    return h["next-router-prefetch"] === "1" && h["next-router-segment-prefetch"] === segment;
  });
  await response.finished();
  return response;
}

test("a prefetch of the calendar alone never renews a slot; a real view of the calendar does", async ({ page }, info) => {
  test.skip(info.project.name !== "phone-390", "no layout involved: once is enough");
  const sb = await db();
  const { data: s, error } = await sb
    .from("lesson_series")
    .insert({ space_id: "balance-studio", weekday: tomorrowWeekdayIL(), time: `${TEST_CORE_HOUR}:31`, starts_on: todayIL() })
    .select("id")
    .single();
  if (error) throw error;
  recordSeries(s.id);
  const lessonsOfSlot = async () => {
    const r = await sb.from("lessons").select("id", { count: "exact", head: true }).eq("series_id", s.id);
    if (r.error) throw r.error;
    return r.count;
  };

  // /materials does not renew; its header link prefetches the calendar page.
  const prefetched = pagePrefetched(page, "/calendar/__PAGE__");
  await go(page, "/materials");
  await prefetched;
  await page.waitForTimeout(2000); // anything the prefetch render started has had time to land
  expect(await lessonsOfSlot(), "lessons created by a prefetch").toBe(0);

  // Control: a real view renews (8 weeks ahead) — the slot itself is renewable.
  await go(page, "/calendar");
  await expect.poll(lessonsOfSlot).toBeGreaterThan(0);
});

test("space page reached through a prefetched link: no false renewal alert", async ({ page }) => {
  const prefetched = pagePrefetched(page, "/spaces/$d$spaceId/__PAGE__");
  await go(page, "/");
  const link = vis(page.locator('main a[href="/spaces/new-high-school"]')).first();
  // A link is prefetched once in the viewport (below the fold on a phone); hovering
  // makes it a high-priority prefetch instead of waiting for the idle queue.
  await link.scrollIntoViewIfNeeded();
  await link.hover();
  await prefetched;
  await link.click();
  await page.waitForURL("**/spaces/new-high-school");
  const slots = vis(page.getByRole("region", { name: /משבצות שבועיות/ }));
  await expect(slots).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(slots.getByRole("alert")).toHaveCount(0);
});

test("calendar reached through a prefetched link: no false renewal alert", async ({ page }) => {
  const prefetched = pagePrefetched(page, "/calendar/__PAGE__");
  await go(page, "/materials");
  const link = vis(page.locator('a[href="/calendar"]')).first();
  await link.hover();
  await prefetched;
  await link.click();
  await page.waitForURL("**/calendar");
  await expect(vis(page.getByRole("heading", { level: 1, name: "לוח שנה" }))).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(main(page).getByRole("alert")).toHaveCount(0);
});

test("calendar control — no renewal alert on a real view", async ({ page }) => {
  await go(page, "/calendar");
  await expect(vis(page.getByRole("heading", { level: 1, name: "לוח שנה" }))).toBeVisible();
  await expect(main(page).getByRole("alert")).toHaveCount(0);
});

/** PM ruling: a renewal failure on the calendar is shown on the calendar, not only logged. */
test.describe("renewal failure on the calendar", () => {
  test.use({ baseURL: `http://localhost:${FAULT_PORT}`, extraHTTPHeaders: { "x-test-fault": "renewal" } });
  test("is shown on the page; the month still renders", async ({ page }) => {
    await go(page, "/calendar");
    await expect(main(page).getByRole("alert")).toContainText("חידוש השיעורים של המשבצות נכשל כרגע");
    await expect(vis(page.locator("table.calendar"))).toBeVisible();
  });
});
