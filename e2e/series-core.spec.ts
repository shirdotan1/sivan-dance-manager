import { renewSeries } from "../src/lib/data/series-core";
import { TAG, TEST_HOUR, db, recordSeries } from "./support/env";
import { expect, test } from "./support/fixtures";

/** Renewal at the function level (no page): failures and races, forced deterministically. */

const SPACE = "balance-studio";
const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

test.beforeEach(({}, info) => test.skip(info.project.name !== "phone-390", "no browser involved: once is enough"));

async function slotWithCandidate(minute: string, daysAhead: number, label: string) {
  const sb = await db();
  const date = addDays(todayIL(), daysAhead);
  const time = `${TEST_HOUR}:${minute}`;
  const { data: s, error } = await sb.from("lesson_series").insert({ space_id: SPACE, weekday: weekdayOf(date), time, starts_on: todayIL() }).select("id").single();
  if (error) throw error;
  recordSeries(s.id);
  const { data: l, error: le } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} ${label}` }).select("id").single();
  if (le) throw le;
  return { seriesId: s.id as string, candidateId: l.id as string, date, time };
}

test("a failed adoption update fails the renewal loudly and leaves the lesson unlinked", async () => {
  const sb = await db();
  const { seriesId, candidateId } = await slotWithCandidate("41", 3, "אימוץ-כושל");
  // After the reads, before the writes: the slot disappears, so linking the candidate violates the foreign key.
  const run = renewSeries(sb, [SPACE], {
    beforeWrite: async (id) => {
      if (id === seriesId) {
        const { error } = await sb.from("lesson_series").delete().eq("id", id);
        if (error) throw error;
      }
    },
  });
  await expect(run).rejects.toThrow(/adopting the lesson of .* failed/);
  const { data } = await sb.from("lessons").select("series_id").eq("id", candidateId).single();
  expect(data!.series_id).toBeNull();
});
