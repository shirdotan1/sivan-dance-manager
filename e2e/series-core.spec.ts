import { createSlotExactly, previewNewSeries, renewSeries } from "../src/lib/data/series-core";
import { TAG, TEST_CORE_HOUR, db, recordSeries } from "./support/env";
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
  const time = `${TEST_CORE_HOUR}:${minute}`;
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
  const time = `${TEST_CORE_HOUR}:42`;
  const date = addDays(todayIL(), 16);
  const input = { spaceId: SPACE, weekday: weekdayOf(date), time, startsOn: todayIL(), groupId: null };
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} נחטף` }).select("id").single();
  const expected = await previewNewSeries(sb, input);
  expect(expected.adopt.map((a) => a.id)).toEqual([l!.id]);
  // The "other" slot that grabs it at the last moment (recorded, so cleanup removes it).
  const { data: other } = await sb.from("lesson_series").insert({ space_id: SPACE, weekday: 0, time: `${TEST_CORE_HOUR}:43`, starts_on: "2030-01-06" }).select("id").single();
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
  const time = `${TEST_CORE_HOUR}:44`;
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
  const time = `${TEST_CORE_HOUR}:46`;
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

/**
 * Two renewals at once, forced deterministically: a barrier makes both finish
 * their reads before either writes. The contested set includes an adoption
 * candidate. Exactly one row per slot date; the candidate linked exactly once.
 */
test("two concurrent renewals (barrier after reads), with an adoption candidate: one row per date, one adoption, no error", async () => {
  const sb = await db();
  const { seriesId, candidateId, date } = await slotWithCandidate("47", 2, "מקביליות");
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const hooks = {
    beforeWrite: async (id: string) => {
      if (id !== seriesId) return;
      if (++arrived === 2) release();
      await gate; // neither writes until both have read
    },
  };
  const [a, b] = await Promise.all([renewSeries(sb, [SPACE], hooks, [seriesId]), renewSeries(sb, [SPACE], hooks, [seriesId])]);
  expect(arrived).toBe(2);

  const { data: occ } = await sb.from("lessons").select("id,series_date,date").eq("series_id", seriesId).order("series_date");
  const dates = occ!.map((o) => o.series_date);
  expect(new Set(dates).size).toBe(dates.length); // one row per slot date
  expect(occ!.filter((o) => o.id === candidateId)).toEqual([{ id: candidateId, series_date: date, date }]); // linked once
  expect(occ!.filter((o) => o.series_date === date)).toHaveLength(1); // no envelope next to it
  expect(a.adopted + b.adopted).toBe(1);
  expect(a.created + b.created).toBe(dates.length - 1);
  expect([...a.conflicts, ...b.conflicts]).toEqual([]);
  // The loser's guarded update found it already linked: reported as changed, not swallowed.
  expect([...a.changed, ...b.changed]).toEqual([{ seriesId, date, lessonId: candidateId }]);
});

test("a cancelled one-off lesson on the slot's date and time is never adopted; renewal creates the occurrence as usual", async () => {
  const sb = await db();
  const { seriesId, candidateId, date } = await slotWithCandidate("48", 4, "מבוטל-לא-מאומץ");
  const { error } = await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", candidateId);
  if (error) throw error;
  const r = await renewSeries(sb, [SPACE], undefined, [seriesId]);
  expect(r.adopted).toBe(0);
  expect(r.conflicts).toEqual([]);
  const { data: candidate } = await sb.from("lessons").select("series_id,cancelled_at").eq("id", candidateId).single();
  expect(candidate!.series_id).toBeNull(); // not adopted
  expect(candidate!.cancelled_at).toBeTruthy(); // untouched
  const { data: occ } = await sb.from("lessons").select("id").eq("series_id", seriesId).eq("series_date", date);
  expect(occ).toHaveLength(1); // the slot got its own occurrence that day
  expect(occ![0].id).not.toBe(candidateId);
});

test("a candidate moved between the read and the update is not adopted; the date is skipped and reported", async () => {
  const sb = await db();
  const { seriesId, candidateId, date } = await slotWithCandidate("49", 5, "זז-באמצע");
  const moved = addDays(date, 1);
  const r = await renewSeries(sb, [SPACE], {
    beforeWrite: async (id) => {
      if (id !== seriesId) return;
      const { error } = await sb.from("lessons").update({ date: moved }).eq("id", candidateId);
      if (error) throw error;
    },
  }, [seriesId]);
  expect(r.adopted).toBe(0);
  expect(r.changed).toEqual([{ seriesId, date, lessonId: candidateId }]);
  const { data: c } = await sb.from("lessons").select("series_id,date").eq("id", candidateId).single();
  expect(c).toEqual({ series_id: null, date: moved }); // not adopted, at its new date
  expect((await sb.from("lessons").select("id").eq("series_id", seriesId).eq("series_date", date)).data).toEqual([]); // skipped this pass
  // Next renewal re-plans it: no candidate on that date any more → the occurrence is created.
  const next = await renewSeries(sb, [SPACE], undefined, [seriesId]);
  expect(next.changed).toEqual([]);
  expect((await sb.from("lessons").select("id").eq("series_id", seriesId).eq("series_date", date)).data).toHaveLength(1);
});

test("creation: a one-off cancelled between the preview and the apply is not adopted — refused and fully rolled back", async () => {
  const sb = await db();
  const time = `${TEST_CORE_HOUR}:05`;
  const date = addDays(todayIL(), 19);
  const input = { spaceId: SPACE, weekday: weekdayOf(date), time, startsOn: todayIL(), groupId: null };
  const { data: l } = await sb.from("lessons").insert({ space_id: SPACE, date, time, notes: `${TAG} בוטל-באמצע` }).select("id").single();
  const expected = await previewNewSeries(sb, input);
  expect(expected.adopt.map((a) => a.id)).toEqual([l!.id]);
  const r = await createSlotExactly(sb, input, expected, {
    beforeApply: async () => {
      const { error } = await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", l!.id);
      if (error) throw error;
    },
  });
  expect(r).toMatchObject({ ok: false, reason: "changed" });
  const { data: after } = await sb.from("lessons").select("series_id,cancelled_at").eq("id", l!.id).single();
  expect(after!.series_id).toBeNull(); // not adopted
  expect(after!.cancelled_at).toBeTruthy();
  expect((await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", time).eq("weekday", input.weekday)).data).toEqual([]);
});
