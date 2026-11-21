import "server-only";
import { addDays, shortTime, todayIso } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import type { LessonSeries } from "@/lib/types";

/**
 * Weekly slots (studio spaces). Every occurrence is a real lesson row linked
 * to its slot by (series_id, series_date). Rules:
 *  - Renewal fills the next 8 weeks with envelopes, only for slot dates that
 *    have NO row at all (active, cancelled or moved). The database enforces
 *    it: unique (series_id, series_date) + INSERT … ON CONFLICT DO NOTHING,
 *    so two renewals at once can't duplicate.
 *  - Adoption: a one-off lesson already sitting on a slot date at the slot's
 *    time in the same space is linked to the slot instead of duplicated.
 *  - Participants are never pre-filled; the slot's group only labels/colours.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const HORIZON_WEEKS = 8;
const HORIZON_DAYS = HORIZON_WEEKS * 7;

interface SeriesRow {
  id: string;
  space_id: string;
  group_id: string | null;
  weekday: number;
  time: string;
  starts_on: string;
  stops_on: string | null;
}
export const SERIES_SELECT = "id, space_id, group_id, weekday, time, starts_on, stops_on";

export function mapSeries(r: SeriesRow): LessonSeries {
  return {
    id: r.id,
    spaceId: r.space_id as LessonSeries["spaceId"],
    ...(r.group_id ? { groupId: r.group_id } : {}),
    weekday: r.weekday,
    time: shortTime(r.time),
    startsOn: r.starts_on,
    ...(r.stops_on ? { stopsOn: r.stops_on } : {}),
  };
}

/** Day of week of an ISO date (0 = Sunday), independent of the server's time zone. */
export const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Slot dates in [from, to] (inclusive), from its start and before its stop date. */
export function slotDates(s: Pick<LessonSeries, "weekday" | "startsOn" | "stopsOn">, from: string, to: string): string[] {
  let d = from > s.startsOn ? from : s.startsOn;
  d = addDays(d, (s.weekday - weekdayOf(d) + 7) % 7);
  const out: string[] = [];
  for (; d <= to && (!s.stopsOn || d < s.stopsOn); d = addDays(d, 7)) out.push(d);
  return out;
}

/** The renewal window: today (Israel) to 8 weeks ahead. */
export function horizon() {
  const from = todayIso();
  return { from, to: addDays(from, HORIZON_DAYS) };
}

/** One-off lessons in the space on these dates at this time (adoption candidates), one per date. */
async function adoptable(supabase: Supabase, spaceId: string, time: string, dates: string[]) {
  if (!dates.length) return [];
  const { data, error } = await supabase
    .from("lessons")
    .select("id, date, time, group_id")
    .eq("space_id", spaceId)
    .is("series_id", null)
    .is("cancelled_at", null)
    .in("date", dates)
    .order("created_at");
  if (error) throw new Error(`adoption lookup: ${error.message}`);
  const seen = new Set<string>();
  return (data ?? []).filter((l) => shortTime(l.time) === time && !seen.has(l.date) && seen.add(l.date));
}

/** Creates the missing occurrences of one slot within the window. */
async function renewOne(supabase: Supabase, s: LessonSeries, from: string, to: string) {
  const dates = slotDates(s, from, to);
  if (!dates.length) return { created: 0, adopted: 0 };
  const { data: existing, error } = await supabase.from("lessons").select("series_date").eq("series_id", s.id).in("series_date", dates);
  if (error) throw new Error(`renewal lookup: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => r.series_date as string));
  const missing = dates.filter((d) => !have.has(d));

  let adopted = 0;
  for (const l of await adoptable(supabase, s.spaceId, s.time, missing)) {
    // Only if still a one-off (another renewal may have adopted it meanwhile).
    const { data } = await supabase
      .from("lessons")
      .update({ series_id: s.id, series_date: l.date })
      .eq("id", l.id)
      .is("series_id", null)
      .select("id");
    if (data?.length) {
      adopted++;
      have.add(l.date);
    }
  }

  const rows = missing
    .filter((d) => !have.has(d))
    .map((d) => ({ space_id: s.spaceId, group_id: s.groupId ?? null, date: d, time: s.time, series_id: s.id, series_date: d }));
  if (!rows.length) return { created: 0, adopted };
  const { data: inserted, error: insError } = await supabase
    .from("lessons")
    .upsert(rows, { onConflict: "series_id,series_date", ignoreDuplicates: true })
    .select("id");
  if (insError) throw new Error(`renewal insert: ${insError.message}`);
  return { created: inserted?.length ?? 0, adopted };
}

/** Renews every active slot (optionally of some spaces). Safe to run concurrently. */
export async function renewSeries(supabase: Supabase, spaceIds?: string[]) {
  const { from, to } = horizon();
  let q = supabase.from("lesson_series").select(SERIES_SELECT).or(`stops_on.is.null,stops_on.gt.${from}`);
  if (spaceIds) q = q.in("space_id", spaceIds);
  const { data, error } = await q;
  if (error) throw new Error(`series: ${error.message}`);
  let created = 0;
  let adopted = 0;
  for (const s of (data as SeriesRow[]).map(mapSeries)) {
    const r = await renewOne(supabase, s, from, to);
    created += r.created;
    adopted += r.adopted;
  }
  return { created, adopted };
}

export async function getSeriesForSpace(supabase: Supabase, spaceId: string): Promise<LessonSeries[]> {
  const { data, error } = await supabase.from("lesson_series").select(SERIES_SELECT).eq("space_id", spaceId).order("created_at");
  if (error) throw new Error(`series: ${error.message}`);
  return (data as SeriesRow[]).map(mapSeries);
}

/** What creating this slot would do: envelopes to create and existing lessons to adopt. */
export async function previewNewSeries(
  supabase: Supabase,
  input: { spaceId: string; weekday: number; time: string; startsOn: string },
) {
  const { from, to } = horizon();
  const dates = slotDates({ weekday: input.weekday, startsOn: input.startsOn }, from, to);
  const adopt = await adoptable(supabase, input.spaceId, input.time, dates);
  return {
    dates,
    until: to,
    adopt: adopt.map((l) => ({ id: l.id as string, date: l.date as string })),
    create: dates.length - adopt.length,
  };
}
