import type { Page } from "@playwright/test";
import { TEST_CORE_HOUR, db, recordSeries } from "./support/env";
import { expect, go, test, vis } from "./support/fixtures";

/**
 * Prerender round: a page render that is not a real request (a link's
 * prefetch) must never run the slot renewal, and must never carry a false
 * "renewal failed" alert into the page it prefetches.
 * (The server logs of the whole run are checked for prerender errors in
 * e2e/global-teardown.ts.)
 */

const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const tomorrowWeekdayIL = () => (new Date(`${todayIL()}T12:00:00Z`).getUTCDay() + 1) % 7;

/** Resolves when the browser has received the prefetch of that page's own segment. */
const pagePrefetched = (page: Page, path: string) =>
  page.waitForResponse((r) => {
    const segment = r.request().headers()["next-router-segment-prefetch"] ?? "";
    return segment.endsWith("/__PAGE__") && new URL(r.url()).pathname === path;
  });

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
  const prefetched = pagePrefetched(page, "/calendar");
  await go(page, "/materials");
  await prefetched;
  await page.waitForTimeout(2000); // anything the prefetch render started has had time to land
  expect(await lessonsOfSlot(), "lessons created by a prefetch").toBe(0);

  // Control: a real view renews (8 weeks ahead) — the slot itself is renewable.
  await go(page, "/calendar");
  await expect.poll(lessonsOfSlot).toBeGreaterThan(0);
});

test("space page reached through a prefetched link: no false renewal alert", async ({ page }) => {
  const prefetched = pagePrefetched(page, "/spaces/new-high-school");
  await go(page, "/");
  const link = vis(page.locator('main a[href="/spaces/new-high-school"]')).first();
  await link.scrollIntoViewIfNeeded(); // a link is prefetched once it is in the viewport (below the fold on a phone)
  await prefetched;
  await link.click();
  await page.waitForURL("**/spaces/new-high-school");
  const slots = vis(page.getByRole("region", { name: /משבצות שבועיות/ }));
  await expect(slots).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(slots.getByRole("alert")).toHaveCount(0);
});
