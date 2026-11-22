import { applySlotChange, planSlotChange, renewSeries, type SlotChangeInput } from "../src/lib/data/series-core";
import { TAG, TEST_HOUR, db, recordSeries } from "./support/env";
import { expect, test } from "./support/fixtures";

/** Stage 5.4 (function level): changing a slot from a date — time, day, stop. */

const SPACE = "balance-studio";
const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

test.beforeEach(({}, info) => test.skip(info.project.name !== "phone-390", "no browser involved: once is enough"));

/** A recorded test slot, renewed so it has its 8 weeks of occurrences. */
async function slot(minute: string, daysAhead: number) {
  const sb = await db();
  const weekday = weekdayOf(addDays(todayIL(), daysAhead));
  const time = `${TEST_HOUR}:${minute}`;
  const { data, error } = await sb.from("lesson_series").insert({ space_id: SPACE, weekday, time, starts_on: todayIL() }).select("id").single();
  if (error) throw error;
  recordSeries(data.id);
  await renewSeries(sb, [SPACE], undefined, [data.id]);
  const { data: occ } = await sb.from("lessons").select("id,date,time,series_date").eq("series_id", data.id).order("series_date");
  return { id: data.id as string, weekday, time, occ: occ! };
}
async function apply(input: SlotChangeInput) {
  const sb = await db();
  const plan = await planSlotChange(sb, input);
  const r = await applySlotChange(sb, input, plan);
  if (r.ok && r.newSeriesId) recordSeries(r.newSeriesId);
  return { plan, r };
}
const occOf = async (seriesId: string) =>
  (await (await db()).from("lessons").select("id,date,time,series_date,cancelled_at,time_overridden").eq("series_id", seriesId).order("series_date")).data!;

test("a time change is anchored on the slot: renewal beyond the 8-week horizon creates the new time", async () => {
  const sb = await db();
  const s = await slot("20", 1);
  const from = s.occ[1].series_date;
  const { r } = await apply({ seriesId: s.id, kind: "time", from, time: `${TEST_HOUR}:25` });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const { data: old } = await sb.from("lesson_series").select("stops_on").eq("id", s.id).single();
  expect(old!.stops_on).toBe(from);
  // Beyond the horizon (weeks 9–13): only the new slot creates, at the new time.
  const far = { from: addDays(todayIL(), 60), to: addDays(todayIL(), 90) };
  await renewSeries(sb, [SPACE], undefined, [s.id, r.newSeriesId!], far);
  const farNew = (await occOf(r.newSeriesId!)).filter((o) => o.series_date >= far.from);
  expect(farNew.length).toBeGreaterThan(3);
  for (const o of farNew) expect(o.time.slice(0, 5)).toBe(`${TEST_HOUR}:25`);
  expect((await occOf(s.id)).filter((o) => o.series_date >= from)).toEqual([]);
});

test("condition: protected and cancelled occurrences move to the new slot; protected keeps its time; no duplicate for their dates", async () => {
  const sb = await db();
  const s = await slot("30", 2);
  const [first, protectedOcc, cancelledOcc, plain] = s.occ;
  await sb.from("lessons").update({ time: `${TEST_HOUR}:35`, time_overridden: true }).eq("id", protectedOcc.id);
  await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", cancelledOcc.id);
  const { plan, r } = await apply({ seriesId: s.id, kind: "time", from: protectedOcc.series_date, time: `${TEST_HOUR}:40` });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(plan.protectedTime.map((x) => x.id)).toEqual([protectedOcc.id]);
  expect(plan.cancelled.map((x) => x.id)).toEqual([cancelledOcc.id]);

  const moved = await occOf(r.newSeriesId!);
  const byId = new Map(moved.map((o) => [o.id, o]));
  expect(byId.get(protectedOcc.id)?.time.slice(0, 5)).toBe(`${TEST_HOUR}:35`); // linked to the new slot, its own time kept
  expect(byId.get(cancelledOcc.id)?.cancelled_at).toBeTruthy(); // still cancelled
  expect(byId.get(plain.id)?.time.slice(0, 5)).toBe(`${TEST_HOUR}:40`); // gets the new time
  expect((await occOf(s.id)).map((o) => o.id)).toEqual([first.id]); // only the occurrence before the date stays

  // The new slot's renewal adds nothing on those dates (they have rows — in the new slot).
  await renewSeries(sb, [SPACE], undefined, [r.newSeriesId!]);
  const after = await occOf(r.newSeriesId!);
  for (const d of [protectedOcc.series_date, cancelledOcc.series_date, plain.series_date]) expect(after.filter((o) => o.series_date === d)).toHaveLength(1);
});

test("a time change is refused if the occurrences changed since the preview, and nothing changes", async () => {
  const sb = await db();
  const s = await slot("45", 3);
  const input: SlotChangeInput = { seriesId: s.id, kind: "time", from: s.occ[0].series_date, time: `${TEST_HOUR}:50` };
  const plan = await planSlotChange(sb, input);
  await sb.from("lessons").update({ time_overridden: true }).eq("id", s.occ[2].id); // a change after the preview
  const r = await applySlotChange(sb, input, plan);
  expect(r).toMatchObject({ ok: false, reason: "changed" });
  expect((await sb.from("lesson_series").select("stops_on").eq("id", s.id).single()).data!.stops_on).toBeNull();
  expect((await occOf(s.id)).length).toBe(s.occ.length);
  for (const o of await occOf(s.id)) expect(o.time.slice(0, 5)).toBe(s.time);
});

test("a time change onto a time where another lesson already sits is a conflict that blocks it", async () => {
  const sb = await db();
  const s = await slot("55", 4);
  const target = `${TEST_HOUR}:56`;
  const { error } = await sb.from("lessons").insert({ space_id: SPACE, date: s.occ[3].date, time: target, notes: `${TAG} חוסם-שעה` });
  if (error) throw error;
  const { plan, r } = await apply({ seriesId: s.id, kind: "time", from: s.occ[0].series_date, time: target });
  expect(plan.conflicts.map((c) => c.date)).toEqual([s.occ[3].date]);
  expect(r).toMatchObject({ ok: false, reason: "conflict" });
});

test("a day change removes only untouched envelopes, keeps content/moved/cancelled, opens the new slot and stops the old", async () => {
  const sb = await db();
  const s = await slot("05", 5);
  const [withNotes, moved, cancelled, empty1, empty2] = s.occ;
  const { data: st } = await sb.from("students").select("id").eq("space_id", SPACE).limit(1).single();
  await sb.from("lessons").update({ notes: `${TAG} יש תוכן` }).eq("id", withNotes.id);
  await sb.from("lessons").update({ date: addDays(moved.date, 1), date_overridden: true }).eq("id", moved.id);
  await sb.from("lessons").update({ cancelled_at: new Date().toISOString() }).eq("id", cancelled.id);
  await sb.from("lesson_participants").insert({ lesson_id: s.occ[5].id, student_id: st!.id });
  const newWeekday = (s.weekday + 1) % 7;
  const { plan, r } = await apply({ seriesId: s.id, kind: "day", from: withNotes.series_date, weekday: newWeekday, time: `${TEST_HOUR}:10` });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(plan.keep.map((k) => [k.id, k.why]).sort()).toEqual(
    [[withNotes.id, "content"], [moved.id, "moved"], [cancelled.id, "cancelled"], [s.occ[5].id, "content"]].sort(),
  );
  const left = (await occOf(s.id)).map((o) => o.id);
  expect(left).toEqual(expect.arrayContaining([withNotes.id, moved.id, cancelled.id, s.occ[5].id]));
  expect(left).not.toContain(empty1.id);
  expect(left).not.toContain(empty2.id);
  expect((await sb.from("lesson_series").select("stops_on").eq("id", s.id).single()).data!.stops_on).toBe(withNotes.series_date);
  const fresh = await occOf(r.newSeriesId!);
  expect(fresh.length).toBe(plan.next!.create.length);
  for (const o of fresh) expect(weekdayOf(o.date)).toBe(newWeekday);
});

test("a day change rolls back if an envelope gains content between the check and the delete — nothing is deleted", async () => {
  const sb = await db();
  const s = await slot("15", 6);
  const victim = s.occ[2];
  const { data: st } = await sb.from("students").select("id").eq("space_id", SPACE).limit(1).single();
  const input: SlotChangeInput = { seriesId: s.id, kind: "day", from: s.occ[0].series_date, weekday: (s.weekday + 2) % 7, time: `${TEST_HOUR}:16` };
  const plan = await planSlotChange(sb, input);
  expect(plan.remove.map((x) => x.id)).toContain(victim.id);
  const r = await applySlotChange(sb, input, plan, {
    beforeApply: async () => {
      const { error } = await sb.from("lesson_participants").insert({ lesson_id: victim.id, student_id: st!.id });
      if (error) throw error;
    },
  });
  expect(r).toMatchObject({ ok: false, reason: "changed" });
  expect((await occOf(s.id)).length).toBe(s.occ.length); // nothing deleted
  expect((await sb.from("lesson_participants").select("student_id").eq("lesson_id", victim.id)).data).toHaveLength(1);
  expect((await sb.from("lesson_series").select("stops_on").eq("id", s.id).single()).data!.stops_on).toBeNull();
  expect((await sb.from("lesson_series").select("id").eq("space_id", SPACE).eq("time", `${TEST_HOUR}:16`)).data).toEqual([]);
});

test("stopping a slot keeps every existing occurrence and creates nothing from the date", async () => {
  const sb = await db();
  const s = await slot("25", 0);
  const from = s.occ[2].series_date;
  const { r } = await apply({ seriesId: s.id, kind: "stop", from });
  expect(r.ok).toBe(true);
  expect((await occOf(s.id)).map((o) => o.id)).toEqual(s.occ.map((o) => o.id)); // all kept
  await renewSeries(sb, [SPACE], undefined, [s.id], { from: addDays(todayIL(), 57), to: addDays(todayIL(), 90) });
  expect((await occOf(s.id)).length).toBe(s.occ.length); // nothing new from the date
});
