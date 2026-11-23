"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { deleteEventFiles } from "@/lib/data/media";
import { shortTime } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import {
  DATE_RE,
  TIME_RE,
  parseParticipants,
  parseMaterials,
  replaceMaterials,
  resolveParticipants,
  resolveMaterials,
} from "@/lib/data/entries";

const STUDIOS = new Set(["new-high-school", "balance-studio"]);

/** Field-level failure: the form shows each message next to its field and focuses the first. */
function invalid(fieldErrors: Record<string, string>): ActionState {
  return { error: "יש לתקן את השדות המסומנים.", fieldErrors };
}

/**
 * Creates (lessonId = null) or updates a studio lesson with everything in
 * the form: date, time, group, participants (incl. new pool students),
 * materials (incl. new bank materials) and notes. Media is managed on the lesson page. Redirects to the lesson.
 */
export async function saveLesson(
  spaceId: string,
  lessonId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!STUDIOS.has(spaceId)) return { error: "מרחב לא מוכר." };
  const date = field(formData, "date");
  const time = field(formData, "time");
  const fieldErrors: Record<string, string> = {};
  if (!DATE_RE.test(date)) fieldErrors.date = "יש לבחור תאריך.";
  if (!TIME_RE.test(time)) fieldErrors.time = "יש לבחור שעה.";
  const groupId = field(formData, "groupId") || null;
  const notes = field(formData, "notes");
  const materials = parseMaterials(formData.get("materials"));
  if ("error" in materials) fieldErrors.materials = materials.error;
  if (Object.keys(fieldErrors).length) return invalid(fieldErrors);
  if ("error" in materials) return invalid(fieldErrors); // narrows the type

  const { supabase } = await requireUser();

  if (groupId) {
    const { data: g } = await supabase.from("groups").select("id").eq("id", groupId).eq("space_id", spaceId).maybeSingle();
    if (!g) return invalid({ groupId: "הקבוצה שנבחרה אינה במרחב הזה." });
  }

  // Editing: what the lesson is now (slot occurrence? cancelled? who takes part).
  let current: { series_date: string | null; cancelled_at: string | null; slotTime?: string; participants: string[] } | null = null;
  if (lessonId) {
    const { data } = await supabase
      .from("lessons")
      .select("series_date, cancelled_at, lesson_series(time), lesson_participants(student_id)")
      .eq("id", lessonId)
      .eq("space_id", spaceId)
      .maybeSingle();
    if (!data) return { error: "השיעור לא נמצא." };
    const slot = data.lesson_series as unknown as { time: string } | null;
    current = {
      series_date: data.series_date,
      cancelled_at: data.cancelled_at,
      slotTime: slot ? shortTime(slot.time) : undefined,
      participants: (data.lesson_participants as { student_id: string }[]).map((p) => p.student_id),
    };
  }

  const parsedParticipants = parseParticipants(formData.get("participants"));
  // A cancelled occurrence takes no new participants (checked before any new pool student is created).
  if (current?.cancelled_at && parsedParticipants.some((p) => !("id" in p) || !current!.participants.includes(p.id))) {
    return invalid({ participants: "השיעור בוטל — אי אפשר להוסיף לו משתתפות. אפשר להחזיר אותו קודם." });
  }
  const participantIds = await resolveParticipants(supabase, spaceId, parsedParticipants);
  if ("error" in participantIds) return invalid({ participants: participantIds.error });
  const materialIds = await resolveMaterials(supabase, materials);
  if ("error" in materialIds) return invalid({ materials: materialIds.error });

  // Slot occurrence: a field changed by hand is protected from later slot
  // changes — each field on its own; back to the slot's value clears it.
  const row: Record<string, string | boolean | null> = { space_id: spaceId, group_id: groupId, date, time, notes };
  if (current?.series_date) {
    row.date_overridden = date !== current.series_date;
    row.time_overridden = shortTime(time) !== current.slotTime;
  }
  let id = lessonId;
  if (id) {
    const { error } = await supabase.from("lessons").update(row).eq("id", id).eq("space_id", spaceId);
    if (error) return { error: "שמירת השיעור נכשלה. כדאי לנסות שוב." };
  } else {
    const { data, error } = await supabase.from("lessons").insert(row).select("id").single();
    if (error) return { error: "יצירת השיעור נכשלה. כדאי לנסות שוב." };
    id = data.id as string;
  }

  const delP = await supabase.from("lesson_participants").delete().eq("lesson_id", id);
  if (delP.error) return { error: "שמירת המשתתפות נכשלה." };
  if (participantIds.length) {
    const insP = await supabase
      .from("lesson_participants")
      .insert(participantIds.map((student_id) => ({ lesson_id: id, student_id })));
    if (insP.error) return { error: "שמירת המשתתפות נכשלה." };
  }
  const err = await replaceMaterials(supabase, { lesson_id: id! }, materialIds);
  if (err) return { error: "שמירת החומרים נכשלה." };

  redirect(`/spaces/${spaceId}/lessons/${id}?saved=1`);
}

/**
 * Deletes a lesson with its participants, materials and media. Its stored
 * files go first; if that fails, the lesson is not deleted.
 */
export async function deleteLesson(spaceId: string, lessonId: string): Promise<{ error: string } | void> {
  const { supabase } = await requireUser();
  const { data: lesson } = await supabase.from("lessons").select("id, series_id").eq("id", lessonId).eq("space_id", spaceId).maybeSingle();
  if (!lesson) return { error: "השיעור לא נמצא." };
  // A slot occurrence is cancelled, never deleted — the next renewal would recreate it.
  if (lesson.series_id) return { error: "שיעור של משבצת שבועית לא נמחק — אפשר לבטל אותו." };
  const files = await deleteEventFiles([{ kind: "lesson", id: lessonId }]);
  if (!files.ok) return { error: files.error };
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId).eq("space_id", spaceId);
  if (error) return { error: "הקבצים נמחקו, אבל מחיקת השיעור נכשלה. כדאי לנסות שוב." };
  refresh();
  redirect(`/spaces/${spaceId}`);
}

/** Cancels one slot occurrence: a status on the row (kept, never deleted). */
export async function cancelLesson(spaceId: string, lessonId: string): Promise<{ error: string } | void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("lessons")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", lessonId)
    .eq("space_id", spaceId)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { error: "ביטול השיעור נכשל. כדאי לנסות שוב." };
  if (!data?.length) return { error: "השיעור לא נמצא או שכבר בוטל." };
  refresh();
}

/** Undoes a cancellation (clears the status only). */
export async function restoreLesson(spaceId: string, lessonId: string): Promise<{ error: string } | void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lessons").update({ cancelled_at: null }).eq("id", lessonId).eq("space_id", spaceId);
  if (error) return { error: "החזרת השיעור נכשלה. כדאי לנסות שוב." };
  refresh();
}
