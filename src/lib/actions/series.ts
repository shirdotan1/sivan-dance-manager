"use server";

import { refresh } from "next/cache";
import { field, type ActionState } from "@/lib/actions/result";
import { DATE_RE, TIME_RE } from "@/lib/data/entries";
import { createSlotExactly, previewNewSeries, type Conflict } from "@/lib/data/series";
import { formatDate, shortTime, WEEKDAYS } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

const STUDIOS = new Set(["new-high-school", "balance-studio"]);

export interface SeriesPreview {
  /** The exact input this preview was made for; creation must match it. */
  key: string;
  weekday: number;
  time: string;
  startsOn: string;
  until: string;
  /** Dates that get a new envelope. */
  create: string[];
  /** Dates that can't be created or adopted; creation is refused while any exist. */
  conflicts: Conflict[];
  /** groupId: the lesson's own group (kept as is — adoption only links). */
  adopt: { id: string; date: string; groupId: string | null }[];
  /** The slot's group, to show a mismatch with adopted lessons. */
  groupId: string | null;
}
export type SeriesFormState = ActionState & { preview?: SeriesPreview };

/**
 * New weekly slot, in two steps: intent "preview" saves nothing and returns
 * what would happen (envelopes to create, existing lessons to adopt);
 * intent "create" saves only if the input is identical to the previewed one.
 */
export async function createSeries(spaceId: string, prev: SeriesFormState, formData: FormData): Promise<SeriesFormState> {
  if (!STUDIOS.has(spaceId)) return { error: "משבצות שבועיות קיימות רק במרחבי סטודיו." };
  const weekdayRaw = field(formData, "weekday");
  const weekday = Number(weekdayRaw);
  const time = field(formData, "time");
  const startsOn = field(formData, "startsOn");
  const groupId = field(formData, "groupId") || null;

  const fieldErrors: Record<string, string> = {};
  if (!/^[0-6]$/.test(weekdayRaw)) fieldErrors.weekday = "יש לבחור יום בשבוע.";
  if (!TIME_RE.test(time)) fieldErrors.time = "יש לבחור שעה.";
  if (!DATE_RE.test(startsOn)) fieldErrors.startsOn = "יש לבחור תאריך התחלה.";
  if (Object.keys(fieldErrors).length) return { error: "יש לתקן את השדות המסומנים.", fieldErrors };

  const { supabase } = await requireUser();
  if (groupId) {
    const { data: g } = await supabase.from("groups").select("id").eq("id", groupId).eq("space_id", spaceId).maybeSingle();
    if (!g) return { error: "יש לתקן את השדות המסומנים.", fieldErrors: { groupId: "הקבוצה שנבחרה אינה במרחב הזה." } };
  }

  const t = shortTime(time);
  const key = [weekday, t, startsOn, groupId ?? ""].join("|");
  const preview = await previewNewSeries(supabase, { spaceId, weekday, time: t, startsOn });
  const result: SeriesPreview = {
    key,
    weekday,
    time: t,
    startsOn,
    until: preview.until,
    create: preview.create,
    adopt: preview.adopt,
    conflicts: preview.conflicts,
    groupId,
  };

  if (field(formData, "intent") !== "create") return { preview: result, done: prev.done };
  // The preview the user confirmed must be for these exact details…
  if (prev.preview?.key !== key) {
    return { preview: result, done: prev.done, error: "הפרטים השתנו מאז הבדיקה. כדאי לעבור שוב על התצוגה המקדימה ולאשר." };
  }
  // …and its content must still be what will happen (recomputed and applied exactly; see createSlotExactly).
  const r = await createSlotExactly(supabase, { spaceId, weekday, time: t, startsOn, groupId }, prev.preview);
  if (!r.ok) {
    if (r.reason !== "failed") refresh();
    return { preview: result, done: prev.done, error: r.message };
  }
  refresh();
  const parts = [`נוצרו ${r.created} שיעורים`, r.adopted ? `${r.adopted} שיעורים קיימים צורפו למשבצת` : ""].filter(Boolean);
  return {
    message: `המשבצת של יום ${WEEKDAYS[weekday]} בשעה ${t} נוצרה (מ־${formatDate(startsOn)}): ${parts.join(", ")}.`,
    done: (prev.done ?? 0) + 1,
  };
}
