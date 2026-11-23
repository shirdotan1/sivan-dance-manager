"use server";

import { refresh } from "next/cache";
import { field, type ActionState } from "@/lib/actions/result";
import { DATE_RE, TIME_RE } from "@/lib/data/entries";
import {
  applySlotChange,
  createSlotExactly,
  planSlotChange,
  previewNewSeries,
  type Conflict,
  type SlotChangeInput,
  type SlotChangeKind,
  type SlotChangePlan,
} from "@/lib/data/series";
import { formatDate, shortTime, todayIso, WEEKDAYS } from "@/lib/format";
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

export type SeriesChangeState = ActionState & { preview?: SlotChangePlan & { key: string; time?: string; weekday?: number } };

/**
 * "שינוי המשבצת מכאן והלאה", in two steps like creation: intent "preview"
 * saves nothing and returns exactly what will change; intent "apply" saves
 * only for the same input, and applySlotChange compares the content again.
 */
export async function changeSeries(spaceId: string, seriesId: string, prev: SeriesChangeState, formData: FormData): Promise<SeriesChangeState> {
  if (!STUDIOS.has(spaceId)) return { error: "משבצות שבועיות קיימות רק במרחבי סטודיו." };
  const kind = field(formData, "kind");
  const from = field(formData, "from");
  const time = shortTime(field(formData, "time"));
  const weekdayRaw = field(formData, "weekday");
  const fieldErrors: Record<string, string> = {};
  if (kind !== "time" && kind !== "day" && kind !== "stop") fieldErrors.kind = "יש לבחור מה משנים.";
  if (!DATE_RE.test(from)) fieldErrors.from = "יש לבחור מאיזה תאריך.";
  if (kind !== "stop" && !TIME_RE.test(time)) fieldErrors.time = "יש לבחור שעה.";
  if (kind === "day" && !/^[0-6]$/.test(weekdayRaw)) fieldErrors.weekday = "יש לבחור יום.";
  if (Object.keys(fieldErrors).length) return { error: "יש לתקן את השדות המסומנים.", fieldErrors, done: prev.done };

  const { supabase } = await requireUser();
  const { data: s } = await supabase.from("lesson_series").select("space_id, weekday, time, starts_on, stops_on").eq("id", seriesId).maybeSingle();
  if (!s || s.space_id !== spaceId) return { error: "המשבצת לא נמצאה." };
  if (from < todayIso()) return { error: "יש לתקן את השדות המסומנים.", fieldErrors: { from: "השינוי חל מהיום והלאה." }, done: prev.done };
  if (from < s.starts_on) return { error: "יש לתקן את השדות המסומנים.", fieldErrors: { from: `המשבצת מתחילה ב־${formatDate(s.starts_on)}.` }, done: prev.done };
  if (kind === "time" && time === shortTime(s.time)) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: { time: "זו כבר השעה של המשבצת." }, done: prev.done };
  }
  if (kind === "day" && Number(weekdayRaw) === s.weekday) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: { weekday: "זה כבר היום של המשבצת; לשינוי שעה בלבד יש לבחור ״שעה״." }, done: prev.done };
  }

  const input: SlotChangeInput = {
    seriesId,
    kind: kind as SlotChangeKind,
    from,
    ...(kind !== "stop" ? { time } : {}),
    ...(kind === "day" ? { weekday: Number(weekdayRaw) } : {}),
  };
  const key = JSON.stringify(input);
  const plan = await planSlotChange(supabase, input);
  const preview = { ...plan, key, time: input.time, weekday: input.weekday };

  if (field(formData, "intent") !== "apply") return { preview, done: prev.done };
  if (prev.preview?.key !== key) return { preview, done: prev.done, error: "הפרטים השתנו מאז הבדיקה. כדאי לעבור שוב על התצוגה המקדימה ולאשר." };
  const r = await applySlotChange(supabase, input, prev.preview);
  refresh();
  if (!r.ok) return { preview, done: prev.done, error: r.message };
  const what =
    kind === "stop"
      ? `המשבצת נעצרה מ־${formatDate(from)}; השיעורים הקיימים נשארו כמו שהם.`
      : kind === "time"
        ? `מ־${formatDate(from)} המשבצת בשעה ${time}: ${plan.retime.length} שיעורים עברו לשעה החדשה.`
        : `מ־${formatDate(from)} המשבצת ביום ${WEEKDAYS[Number(weekdayRaw)]} בשעה ${time}: ${plan.remove.length} שיעורים ריקים הוסרו, ${plan.next?.create.length ?? 0} נוצרו.`;
  return { message: what, done: (prev.done ?? 0) + 1 };
}
