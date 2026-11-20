"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
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

  const participantIds = await resolveParticipants(supabase, spaceId, parseParticipants(formData.get("participants")));
  if ("error" in participantIds) return invalid({ participants: participantIds.error });
  const materialIds = await resolveMaterials(supabase, materials);
  if ("error" in materialIds) return invalid({ materials: materialIds.error });

  const row = { space_id: spaceId, group_id: groupId, date, time, notes };
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

/** Deletes a lesson with its participants, songs and media. */
export async function deleteLesson(spaceId: string, lessonId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId).eq("space_id", spaceId);
  if (error) throw new Error("מחיקת השיעור נכשלה.");
  refresh();
  redirect(`/spaces/${spaceId}`);
}
