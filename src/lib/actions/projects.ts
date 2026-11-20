"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { field, fields, type ActionState } from "@/lib/actions/result";
import { nextColor } from "@/lib/data/colors";

const SPACE = "private-lessons";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates (projectId = null) or updates a private project (any lesson or training goal). */
export async function saveProject(projectId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = field(formData, "name");
  const type = field(formData, "type");
  const mainMaterialId = field(formData, "mainMaterialId");
  const participants = fields(formData, "participant").filter((id) => UUID_RE.test(id));
  if (!name) return { error: "יש להזין שם לפרויקט." };
  if (type !== "solo" && type !== "group") return { error: "יש לבחור סולו או קבוצתי." };
  if (participants.length === 0) return { error: "יש לבחור לפחות משתתפת אחת." };
  if (type === "solo" && participants.length > 1) return { error: "בסולו יש משתתפת אחת. לכמה משתתפות — לבחור ״קבוצתי״." };

  const { supabase } = await requireUser();
  const { data: pool } = await supabase.from("students").select("id").eq("space_id", SPACE).in("id", participants);
  if ((pool ?? []).length !== participants.length) return { error: "אחת המשתתפות אינה במאגר השיעורים הפרטיים." };

  const row = { name, type, main_song_id: mainMaterialId && UUID_RE.test(mainMaterialId) ? mainMaterialId : null };
  let id = projectId;
  if (id) {
    const { error } = await supabase.from("projects").update(row).eq("id", id);
    if (error) return { error: "שמירת הפרויקט נכשלה. כדאי לנסות שוב." };
  } else {
    const color = await nextColor(supabase);
    const { data, error } = await supabase.from("projects").insert({ ...row, space_id: SPACE, color }).select("id").single();
    if (error) return { error: "יצירת הפרויקט נכשלה. כדאי לנסות שוב." };
    id = data.id as string;
  }
  const del = await supabase.from("project_participants").delete().eq("project_id", id);
  if (del.error) return { error: "שמירת המשתתפות נכשלה." };
  const ins = await supabase.from("project_participants").insert(participants.map((student_id) => ({ project_id: id, student_id })));
  if (ins.error) return { error: "שמירת המשתתפות נכשלה." };

  redirect(`/spaces/${SPACE}/projects/${id}?saved=1`);
}

/** Deletes a project with all its sessions and their payments. */
export async function deleteProject(projectId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error("מחיקת הפרויקט נכשלה.");
  refresh();
  redirect(`/spaces/${SPACE}`);
}
