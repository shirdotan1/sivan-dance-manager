import { TEST_HOUR, cleanup, db, recordSeries } from "./support/env";
import { expect, test } from "./support/fixtures";

/** The suite's own cleanup: only slots it recorded, confirmed counts, loud failures. */
test("cleanup deletes only recorded slots (the test hour is an extra filter, not the selection)", async ({}, info) => {
  test.skip(info.project.name !== "phone-390", "one database for both widths");
  const sb = await db();
  const mk = async (minute: string) => {
    const { data, error } = await sb.from("lesson_series").insert({ space_id: "balance-studio", weekday: 1, time: `${TEST_HOUR}:${minute}`, starts_on: "2027-03-01" }).select("id").single();
    if (error) throw error;
    return data.id as string;
  };
  const recorded = await mk("51");
  recordSeries(recorded);
  const { error: le } = await sb.from("lessons").insert({ space_id: "balance-studio", date: "2027-03-01", time: `${TEST_HOUR}:51`, series_id: recorded, series_date: "2027-03-01" });
  if (le) throw le;
  const unrecorded = await mk("52"); // same window, never recorded
  try {
    const out = await cleanup(sb);
    expect(out.series).toBeGreaterThanOrEqual(1);
    expect(out.seriesLessons).toBeGreaterThanOrEqual(1);
    expect((await sb.from("lesson_series").select("id").eq("id", recorded)).data).toEqual([]);
    expect((await sb.from("lessons").select("id").eq("series_id", recorded)).data).toEqual([]);
    expect((await sb.from("lesson_series").select("id").eq("id", unrecorded)).data).toHaveLength(1);
  } finally {
    await sb.from("lesson_series").delete().eq("id", unrecorded);
  }
});
