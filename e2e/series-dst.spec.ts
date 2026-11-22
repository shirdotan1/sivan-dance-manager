import { assertSlotDate, renewSeries, slotDates } from "../src/lib/data/series-core";
import { TEST_HOUR, db, recordSeries } from "./support/env";
import { expect, test } from "./support/fixtures";

/**
 * Daylight saving (Israel 2026: forward Fri 27.3, back Sun 25.10). Occurrence
 * creation is calendar-date + wall-clock arithmetic, so a slot keeps its local
 * time on both sides — proven with the process in UTC (like the production
 * server) and in Asia/Jerusalem.
 */
test.beforeEach(({}, info) => test.skip(info.project.name !== "phone-390", "no browser involved: once is enough"));

const CASES = [
  { name: "spring forward (Fri 27.3.2026)", weekday: 5, from: "2026-03-13", to: "2026-04-10", dates: ["2026-03-13", "2026-03-20", "2026-03-27", "2026-04-03", "2026-04-10"], minute: "57" },
  { name: "fall back (Sun 25.10.2026)", weekday: 0, from: "2026-10-11", to: "2026-11-08", dates: ["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"], minute: "58" },
] as const;

for (const tz of ["UTC", "Asia/Jerusalem"] as const) {
  test.describe(`process time zone ${tz}`, () => {
    let previous: string | undefined;
    test.beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = tz;
    });
    test.afterAll(() => {
      process.env.TZ = previous;
    });

    test("the time zone really is in effect (sanity)", () => {
      const offset = (iso: string) => new Date(`${iso}T12:00:00`).getTimezoneOffset();
      if (tz === "UTC") expect([offset("2026-03-20"), offset("2026-04-03")]).toEqual([0, 0]);
      else expect([offset("2026-03-20"), offset("2026-04-03")]).toEqual([-120, -180]);
    });

    for (const c of CASES) {
      test(`${c.name}: dates on the slot's weekday, wall-clock time kept, in the database too`, async () => {
        const dates = slotDates({ weekday: c.weekday, startsOn: c.from }, c.from, c.to);
        expect(dates).toEqual(c.dates);
        const sb = await db();
        const time = `${TEST_HOUR}:${c.minute}`;
        // Stopped right after the window: renewal with this explicit window covers it,
        // but it stays inactive for the rest of the run.
        const stopsOn = new Date(`${c.to}T00:00:00Z`);
        stopsOn.setUTCDate(stopsOn.getUTCDate() + 1);
        const { data, error } = await sb
          .from("lesson_series")
          .insert({ space_id: "balance-studio", weekday: c.weekday, time, starts_on: c.from, stops_on: stopsOn.toISOString().slice(0, 10) })
          .select("id")
          .single();
        if (error) throw error;
        recordSeries(data.id);
        await renewSeries(sb, ["balance-studio"], undefined, [data.id], { from: c.from, to: c.to });
        const { data: rows } = await sb.from("lessons").select("date,time,series_date").eq("series_id", data.id).order("series_date");
        expect(rows!.map((r) => r.date)).toEqual(c.dates);
        for (const r of rows!) {
          expect(new Date(`${r.date}T12:00:00Z`).getUTCDay()).toBe(c.weekday);
          expect(r.time).toBe(`${time}:00`); // same wall-clock time before and after the change
        }
        await sb.from("lessons").delete().eq("series_id", data.id);
      });
    }
  });
}

test("the generation guard: a date off the slot's weekday fails", () => {
  expect(() => assertSlotDate("2026-03-27", 5)).not.toThrow();
  expect(() => assertSlotDate("2026-03-28", 5)).toThrow(/not on weekday 5/);
});
