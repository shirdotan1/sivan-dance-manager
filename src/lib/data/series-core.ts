import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, shortTime, todayIso } from "@/lib/format";
import type { LessonSeries } from "@/lib/types";

/**
 * Weekly slots (studio spaces). Every occurrence is a real lesson row linked
 * to its slot by (series_id, series_date). Rules:
 *  - Renewal fills the next 8 weeks, only for slot dates that have NO row of
 *    that slot (active, cancelled or moved). The database backs it up:
 *    unique (series_id, series_date) + INSERT … ON CONFLICT DO NOTHING.
 *  - Per slot date, among lessons in the space at the same date and time:
 *      a lesson of ANOTHER slot          → conflict "other-series"
 *      two or more one-off lessons       → conflict "ambiguous"
 *      exactly one one-off lesson        → adopt it (link only)
 *      none                              → create an envelope
 *    A conflict is never created and never resolved silently: the preview
 *    refuses, renewal skips the date (and re-plans it next time).
 *  - Adoption only links (series_id, series_date); it never changes a
 *    lesson's content, group included.
 *  - Renewal is batched: a fixed number of queries whatever the number of
 *    slots, and slots are planned in order (oldest first) against one
 *    snapshot that includes the earlier slots' planned envelopes.
 *  - Participants are never pre-filled; the slot's group only labels/colours.
 *
 * No `server-only` here so the e2e suite can call renewal directly (with
 * its signed-in test client); the app imports it through ./series.
 */

type Supabase = SupabaseClient;

/** Test seam: runs after a slot's reads and before its writes (to force races deterministically). */
export interface RenewHooks {
  beforeWrite?: (seriesId: string) => Promise<void>;
}

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

// ---------- Planning (pure) ----------

/** A lesson in the window, as planning sees it. */
export interface WindowLesson {
  id: string;
  spaceId: string;
  date: string;
  time: string;
  groupId: string | null;
  seriesId: string | null;
}

export interface Conflict {
  date: string;
  kind: "ambiguous" | "other-series";
  lessonIds: string[];
}

export interface SlotPlan {
  /** Slot dates in the window. */
  dates: string[];
  /** Dates that get a new envelope. */
  create: string[];
  /** One-off lessons to link (groupId: the lesson's own, kept as is). */
  adopt: { id: string; date: string; groupId: string | null }[];
  /** Dates that are neither created nor adopted — explained, never silent. */
  conflicts: Conflict[];
}

type PlannedSlot = Pick<LessonSeries, "spaceId" | "weekday" | "time" | "startsOn" | "stopsOn"> & { id?: string };

/**
 * Plans one slot against a snapshot of the space's lessons in the window.
 * `occupied`: slot dates that already have a row of this slot (by series_date).
 */
export function planSlot(slot: PlannedSlot, window: { from: string; to: string }, lessons: WindowLesson[], occupied: Set<string>): SlotPlan {
  const plan: SlotPlan = { dates: slotDates(slot, window.from, window.to), create: [], adopt: [], conflicts: [] };
  for (const date of plan.dates) {
    if (occupied.has(date)) continue;
    const same = lessons.filter((l) => l.spaceId === slot.spaceId && l.date === date && l.time === slot.time && (!slot.id || l.seriesId !== slot.id));
    const otherSeries = same.filter((l) => l.seriesId);
    const oneOffs = same.filter((l) => !l.seriesId);
    if (otherSeries.length) plan.conflicts.push({ date, kind: "other-series", lessonIds: otherSeries.map((l) => l.id) });
    else if (oneOffs.length > 1) plan.conflicts.push({ date, kind: "ambiguous", lessonIds: oneOffs.map((l) => l.id) });
    else if (oneOffs.length === 1) plan.adopt.push({ id: oneOffs[0].id, date, groupId: oneOffs[0].groupId });
    else plan.create.push(date);
  }
  return plan;
}

// ---------- Snapshot (reads) ----------

/**
 * Lessons in the window that planning considers. Cancelled lessons are left
 * out: a cancelled lesson is never an adoption candidate (nor a conflict).
 * A slot's own cancelled occurrences still count as existing — through
 * occupiedDates (by series_date) — so they are never recreated.
 */
async function windowLessons(supabase: Supabase, spaceIds: string[], from: string, to: string): Promise<WindowLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, space_id, date, time, group_id, series_id")
    .in("space_id", spaceIds)
    .is("cancelled_at", null)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(`window lessons: ${error.message}`);
  return (data ?? []).map((l) => ({
    id: l.id,
    spaceId: l.space_id,
    date: l.date,
    time: shortTime(l.time),
    groupId: l.group_id,
    seriesId: l.series_id,
  }));
}

/** series_id → slot dates (series_date) in the window that already have a row (wherever it was moved). */
async function occupiedDates(supabase: Supabase, seriesIds: string[], from: string, to: string) {
  const out = new Map<string, Set<string>>(seriesIds.map((id) => [id, new Set<string>()]));
  if (!seriesIds.length) return out;
  const { data, error } = await supabase
    .from("lessons")
    .select("series_id, series_date")
    .in("series_id", seriesIds)
    .gte("series_date", from)
    .lte("series_date", to);
  if (error) throw new Error(`occurrences: ${error.message}`);
  for (const r of data ?? []) out.get(r.series_id)!.add(r.series_date);
  return out;
}

// ---------- Renewal (reads, plan, writes) ----------

export interface RenewResult {
  created: number;
  adopted: number;
  conflicts: (Conflict & { seriesId: string })[];
  /** Planned adoptions skipped because the lesson changed since it was read (re-planned next time). */
  changed: { seriesId: string; date: string; lessonId: string }[];
}

/**
 * Renews active slots (optionally of some spaces, or only some slots). A
 * fixed number of queries: slots, occurrences, window lessons, one insert
 * (+ one update per adopted lesson). Safe to run concurrently.
 */
export async function renewSeries(
  supabase: Supabase,
  spaceIds?: string[],
  hooks?: RenewHooks,
  onlySeriesIds?: string[],
): Promise<RenewResult> {
  const window = horizon();
  let q = supabase.from("lesson_series").select(SERIES_SELECT).or(`stops_on.is.null,stops_on.gt.${window.from}`).order("created_at");
  if (spaceIds) q = q.in("space_id", spaceIds);
  if (onlySeriesIds) q = q.in("id", onlySeriesIds);
  const { data, error } = await q;
  if (error) throw new Error(`series: ${error.message}`);
  const series = (data as SeriesRow[]).map(mapSeries);
  const result: RenewResult = { created: 0, adopted: 0, conflicts: [], changed: [] };
  if (!series.length) return result;

  const spaces = [...new Set(series.map((s) => s.spaceId))];
  const [lessons, occupied] = await Promise.all([
    windowLessons(supabase, spaces, window.from, window.to),
    occupiedDates(supabase, series.map((s) => s.id), window.from, window.to),
  ]);

  const rows: Record<string, unknown>[] = [];
  for (const s of series) {
    const plan = planSlot(s, window, lessons, occupied.get(s.id)!);
    for (const c of plan.conflicts) result.conflicts.push({ ...c, seriesId: s.id });
    await hooks?.beforeWrite?.(s.id);

    for (const a of plan.adopt) {
      // Guarded by the full identity that was read: still a one-off, still
      // on that date at that time, not cancelled. 0 rows = it changed since
      // (moved, cancelled, or linked by another renewal): skip the date, create
      // nothing for it now, and report it (re-planned next time). An error fails.
      const { data: linked, error: adoptError } = await supabase
        .from("lessons")
        .update({ series_id: s.id, series_date: a.date })
        .eq("id", a.id)
        .is("series_id", null)
        .eq("date", a.date)
        .eq("time", s.time)
        .is("cancelled_at", null)
        .select("id");
      if (adoptError) throw new Error(`adopting the lesson of ${a.date} failed: ${adoptError.message}`);
      if (linked?.length) {
        result.adopted++;
        const l = lessons.find((x) => x.id === a.id);
        if (l) l.seriesId = s.id;
      } else {
        result.changed.push({ seriesId: s.id, date: a.date, lessonId: a.id });
      }
    }
    for (const date of plan.create) {
      rows.push({ space_id: s.spaceId, group_id: s.groupId ?? null, date, time: s.time, series_id: s.id, series_date: date });
      // Later slots in this pass see this envelope (so two slots at the same time can't both create).
      lessons.push({ id: `planned:${s.id}:${date}`, spaceId: s.spaceId, date, time: s.time, groupId: s.groupId ?? null, seriesId: s.id });
    }
  }

  if (rows.length) {
    const { data: inserted, error: insError } = await supabase
      .from("lessons")
      .upsert(rows, { onConflict: "series_id,series_date", ignoreDuplicates: true })
      .select("id");
    if (insError) throw new Error(`renewal insert: ${insError.message}`);
    result.created = inserted?.length ?? 0;
  }
  return result;
}

export async function getSeriesForSpace(supabase: Supabase, spaceId: string): Promise<LessonSeries[]> {
  const { data, error } = await supabase.from("lesson_series").select(SERIES_SELECT).eq("space_id", spaceId).order("created_at");
  if (error) throw new Error(`series: ${error.message}`);
  return (data as SeriesRow[]).map(mapSeries);
}

/**
 * What creating this slot would do (nothing is saved): envelopes to create,
 * lessons to adopt (link only — each with its own group, so the preview can
 * show a mismatch with the slot's group) and conflicts, which block creation.
 */
export async function previewNewSeries(supabase: Supabase, input: { spaceId: string; weekday: number; time: string; startsOn: string }) {
  const window = horizon();
  const lessons = await windowLessons(supabase, [input.spaceId], window.from, window.to);
  const plan = planSlot({ spaceId: input.spaceId as LessonSeries["spaceId"], weekday: input.weekday, time: input.time, startsOn: input.startsOn }, window, lessons, new Set());
  return { ...plan, until: window.to };
}

// ---------- Creating a slot exactly as previewed ----------

export type PreviewContent = { create: string[]; adopt: { id: string; date: string }[]; conflicts: Conflict[] };

/** Same content: the dates to create, the lessons (and dates) to adopt, and no conflicts. */
export function samePlanContent(a: PreviewContent, b: PreviewContent) {
  const key = (p: PreviewContent) =>
    JSON.stringify({
      create: [...p.create].sort(),
      adopt: p.adopt.map((x) => `${x.id}@${x.date}`).sort(),
      conflicts: p.conflicts.map((c) => `${c.date}:${c.kind}:${[...c.lessonIds].sort().join(",")}`).sort(),
    });
  return key(a) === key(b);
}

export type CreateSlotResult =
  | { ok: true; seriesId: string; created: number; adopted: number }
  | { ok: false; reason: "conflict" | "changed" | "failed"; message: string };

/**
 * Creates a slot only if its plan is still exactly the previewed one, and
 * applies exactly that plan:
 *   1. recompute the plan; any conflict, or any content difference from the
 *      preview (dates to create, lessons to adopt), refuses;
 *   2. insert the slot inactive (stops_on = starts_on), so concurrent
 *      renewals ignore it;
 *   3. adopt each planned lesson (guarded: still one-off, same date and
 *      time; exactly one row each) and insert exactly the planned envelopes;
 *   4. check after writing: no other lesson at the slot's dates and time;
 *   5. activate (stops_on = NULL).
 * Any deviation rolls everything back (adopted lessons unlinked, new
 * envelopes and the slot deleted) and refuses. The unique index on
 * (series_id, series_date) stays a backup, not the check.
 */
export async function createSlotExactly(
  supabase: Supabase,
  input: { spaceId: string; weekday: number; time: string; startsOn: string; groupId: string | null },
  expected: PreviewContent,
  hooks?: { beforeApply?: () => Promise<void> },
): Promise<CreateSlotResult> {
  const plan = await previewNewSeries(supabase, input);
  if (plan.conflicts.length) return { ok: false, reason: "conflict", message: "יש התנגשויות בתאריכים של המשבצת, ולכן היא לא נוצרה." };
  if (!samePlanContent(plan, expected)) {
    return { ok: false, reason: "changed", message: "השיעורים בתאריכים של המשבצת השתנו מאז הבדיקה, ולכן היא לא נוצרה. כדאי לבדוק שוב." };
  }

  const { data: slot, error } = await supabase
    .from("lesson_series")
    .insert({ space_id: input.spaceId, group_id: input.groupId, weekday: input.weekday, time: input.time, starts_on: input.startsOn, stops_on: input.startsOn })
    .select("id")
    .single();
  if (error || !slot) return { ok: false, reason: "failed", message: "יצירת המשבצת נכשלה. כדאי לנסות שוב." };
  const seriesId = slot.id as string;

  const rollback = async (message: string): Promise<CreateSlotResult> => {
    const adoptIds = plan.adopt.map((a) => a.id);
    const steps = [
      adoptIds.length
        ? supabase.from("lessons").update({ series_id: null, series_date: null }).eq("series_id", seriesId).in("id", adoptIds)
        : null,
      supabase.from("lessons").delete().eq("series_id", seriesId),
      supabase.from("lesson_series").delete().eq("id", seriesId),
    ];
    for (const step of steps) {
      if (!step) continue;
      const { error: e } = await step;
      if (e) return { ok: false, reason: "failed", message: `${message} גם הביטול נכשל (${e.message}) — כדאי לבדוק את המשבצות במרחב.` };
    }
    return { ok: false, reason: "changed", message };
  };

  try {
    await hooks?.beforeApply?.();
    for (const a of plan.adopt) {
      const { data, error: e } = await supabase
        .from("lessons")
        .update({ series_id: seriesId, series_date: a.date })
        .eq("id", a.id)
        .is("series_id", null)
        .eq("date", a.date)
        .eq("time", input.time)
        .select("id");
      if (e) throw new Error(`adopting the lesson of ${a.date} failed: ${e.message}`);
      if (data?.length !== 1) return await rollback("שיעור שהיה אמור להצטרף למשבצת השתנה בינתיים, ולכן המשבצת לא נוצרה. כדאי לבדוק שוב.");
    }
    if (plan.create.length) {
      const rows = plan.create.map((date) => ({
        space_id: input.spaceId,
        group_id: input.groupId,
        date,
        time: input.time,
        series_id: seriesId,
        series_date: date,
      }));
      const { data, error: e } = await supabase.from("lessons").upsert(rows, { onConflict: "series_id,series_date", ignoreDuplicates: true }).select("id");
      if (e) throw new Error(`creating the lessons failed: ${e.message}`);
      if (data?.length !== rows.length) return await rollback("לא כל השיעורים של המשבצת נוצרו, ולכן היא לא נוצרה. כדאי לבדוק שוב.");
    }
    const window = horizon();
    const after = await windowLessons(supabase, [input.spaceId], window.from, window.to);
    const dates = new Set(plan.dates);
    if (after.some((l) => dates.has(l.date) && l.time === input.time && l.seriesId !== seriesId)) {
      return await rollback("נוסף בינתיים שיעור באותה שעה באחד התאריכים, ולכן המשבצת לא נוצרה. כדאי לבדוק שוב.");
    }
    const { error: e } = await supabase.from("lesson_series").update({ stops_on: null }).eq("id", seriesId);
    if (e) throw new Error(`activating the slot failed: ${e.message}`);
    return { ok: true, seriesId, created: plan.create.length, adopted: plan.adopt.length };
  } catch (e) {
    return await rollback(`יצירת המשבצת נכשלה (${e instanceof Error ? e.message : "שגיאה"}).`);
  }
}
