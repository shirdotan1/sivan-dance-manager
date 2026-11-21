import { createSlotExactly, previewNewSeries, renewSeries } from "../src/lib/data/series-core";
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

/** createSlotExactly: the check and the writes are tied; a change between them rolls everything back. */

async function nothingLeft(time: string, candidateId?: string, candidateTime?: string) {
  const sb = await db();
  expect((await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time)).data).toEqual([]);
  expect((await sb.from("lessons").select("id").eq("space_id", SPACE).eq("time", time).not("series_id", "is", null)).data).toEqual([]);
  if (candidateId) {
    const { data } = await sb.from("lessons").select("series_id,series_date,time").eq("id", candidateId).single();
    expect(data!.series_id).toBeNull();
    expect(data!.series_date).toBeNull();
    if (candidateTime) expect(data!.time.slice(0, 5)).toBe(candidateTime);
  }
}

test("a candidate taken by another slot between the check and the writes: refused and fully rolled back", async () => {
  const sb = await db();
  const time = `${TEST_HOUR}:42`;
  const date = addDays(todayIL(), 16);
  const input = { spaceId: SPACE, weekday: weekdayOf(date), time, startsOn: todayIL(), groupId: null };
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} נחטף` }).select("id").single();
  const expected = await previewNewSeries(sb, input);
  expect(expected.adopt.map((a) => a.id)).toEqual([l!.id]);
  // The "other" slot that grabs it at the last moment (recorded, so cleanup removes it).
  const { data: other } = await sb.from("lesson_series").insert({ space_id: SPACE, weekday: 0, time: `${TEST_HOUR}:43`, starts_on: "2030-01-06" }).select("id").single();
  recordSeries(other!.id);
  const r = await createSlotExactly(sb, input, expected, {
    beforeApply: async () => {
      const { error } = await sb.from("lessons").update({ series_id: other!.id, series_date: date }).eq("id", l!.id);
      if (error) throw error;
    },
  });
  expect(r).toMatchObject({ ok: false, reason: "changed" });
  expect((await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time)).data).toEqual([]);
  expect((await sb.from("lessons").select("id").eq("series_id", other!.id).neq("id", l!.id)).data).toEqual([]);
  await sb.from("lessons").update({ series_id: null, series_date: null }).eq("id", l!.id);
  await nothingLeft(time, l!.id, time);
});

test("a new lesson on a slot date between the check and the writes: caught after writing, fully rolled back", async () => {
  const sb = await db();
  const time = `${TEST_HOUR}:44`;
  const weekday = weekdayOf(addDays(todayIL(), 17));
  const input = { spaceId: SPACE, weekday, time, startsOn: todayIL(), groupId: null };
  const expected = await previewNewSeries(sb, input);
  expect(expected.create.length).toBeGreaterThan(0);
  const r = await createSlotExactly(sb, input, expected, {
    beforeApply: async () => {
      const { error } = await sb.from("lessons").insert({ space_id: SPACE, date: expected.create[2], time, notes: `${TAG} חדש-באמצע` });
      if (error) throw error;
    },
  });
  expect(r).toMatchObject({ ok: false, reason: "changed" });
  await nothingLeft(time);
});

test("the success path: exactly the previewed lessons, and the slot ends up active", async () => {
  const sb = await db();
  const time = `${TEST_HOUR}:46`;
  const date = addDays(todayIL(), 18);
  const input = { spaceId: SPACE, weekday: weekdayOf(date), time, startsOn: todayIL(), groupId: null };
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} מצטרף` }).select("id").single();
  const expected = await previewNewSeries(sb, input);
  const r = await createSlotExactly(sb, input, expected);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  recordSeries(r.seriesId);
  expect(r).toMatchObject({ created: expected.create.length, adopted: 1 });
  const { data: s } = await sb.from("lesson_series").select("stops_on").eq("id", r.seriesId).single();
  expect(s!.stops_on).toBeNull();
  const { data: occ } = await sb.from("lessons").select("id,series_date").eq("series_id", r.seriesId).order("series_date");
  expect(occ!.map((o) => o.series_date).sort()).toEqual(expected.dates);
  expect(occ!.find((o) => o.id === l!.id)?.series_date).toBe(date);
});
