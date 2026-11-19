"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import {
  DATE_RE,
  TIME_RE,
  parseMedia,
  parseParticipants,
  parseSongs,
  replaceSongsAndMedia,
  resolveParticipants,
  resolveSongs,
} from "@/lib/data/entries";

const STUDIOS = new Set(["new-high-school", "balance-studio"]);

/**
 * Creates (lessonId = null) or updates a studio lesson with everything in
 * the form: date, time, group, participants (incl. new pool students),
 * songs (incl. new bank songs), notes and media. Redirects to the lesson.
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
  if (!DATE_RE.test(date)) return { error: "יש לבחור תאריך." };
  if (!TIME_RE.test(time)) return { error: "יש לבחור שעה." };
  const groupId = field(formData, "groupId") || null;
  const notes = field(formData, "notes");
  const songs = parseSongs(formData.get("songs"));
  if ("error" in songs) return { error: songs.error };

  const { supabase } = await requireUser();

  if (groupId) {
    const { data: g } = await supabase.from("groups").select("id").eq("id", groupId).eq("space_id", spaceId).maybeSingle();
    if (!g) return { error: "הקבוצה שנבחרה אינה במרחב הזה." };
  }

  const participantIds = await resolveParticipants(supabase, spaceId, parseParticipants(formData.get("participants")));
  if ("error" in participantIds) return { error: participantIds.error };
  const songIds = await resolveSongs(supabase, songs);
  if ("error" in songIds) return { error: songIds.error };

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
  const err = await replaceSongsAndMedia(supabase, { lesson_id: id! }, songIds, parseMedia(formData.get("media")));
  if (err) return { error: "שמירת השירים או המדיה נכשלה." };

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
