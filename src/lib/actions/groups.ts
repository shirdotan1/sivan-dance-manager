"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { field, fields, type ActionState } from "@/lib/actions/result";
import { nextColor } from "@/lib/data/colors";

const STUDIOS = new Set(["new-high-school", "balance-studio"]);
type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function setMembers(supabase: Supabase, groupId: string, studentIds: string[]) {
  const del = await supabase.from("group_members").delete().eq("group_id", groupId);
  if (del.error) return del.error;
  if (studentIds.length === 0) return null;
  const ins = await supabase
    .from("group_members")
    .insert(studentIds.map((student_id) => ({ group_id: groupId, student_id })));
  return ins.error;
}

export async function createGroup(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!STUDIOS.has(spaceId)) return { error: "קבוצות קיימות רק במרחבי סטודיו." };
  const name = field(formData, "name");
  if (!name) return { error: "יש להזין שם לקבוצה." };
  const members = fields(formData, "member");

  const { supabase } = await requireUser();
  const color = await nextColor(supabase);
  const { data, error } = await supabase
    .from("groups")
    .insert({ space_id: spaceId, name, color })
    .select("id")
    .single();
  if (error) return { error: "יצירת הקבוצה נכשלה. כדאי לנסות שוב." };
  const memberError = await setMembers(supabase, data.id, members);
  if (memberError) return { error: "הקבוצה נוצרה, אבל שמירת החברות נכשלה." };
  refresh();
  return { message: `הקבוצה ״${name}״ נוצרה.`, done: Date.now() };
}

export async function updateGroup(groupId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = field(formData, "name");
  if (!name) return { error: "יש להזין שם לקבוצה." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("groups").update({ name }).eq("id", groupId);
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  const memberError = await setMembers(supabase, groupId, fields(formData, "member"));
  if (memberError) return { error: "שמירת החברות נכשלה." };
  refresh();
  return { message: `הקבוצה ״${name}״ נשמרה.`, done: Date.now() };
}

/** Deletes a group. Its lessons stay (they just lose their group). */
export async function deleteGroup(groupId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error("מחיקת הקבוצה נכשלה.");
  refresh();
}
