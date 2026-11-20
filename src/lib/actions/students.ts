"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";

const SPACES = new Set(["new-high-school", "balance-studio", "private-lessons"]);

/** Adds a student to a space's pool (or restores a removed one with the same name). */
export async function addStudent(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!SPACES.has(spaceId)) return { error: "מרחב לא מוכר." };
  const name = field(formData, "name").replace(/\s+/g, " ");
  const phone = field(formData, "phone");
  if (!name) return { error: "יש להזין שם תלמידה." };

  const { supabase } = await requireUser();
  const { data: existing, error: findError } = await supabase
    .from("students")
    .select("id, archived_at")
    .eq("space_id", spaceId)
    .eq("name", name)
    .maybeSingle();
  if (findError) return { error: "השמירה נכשלה. כדאי לנסות שוב." };

  if (existing && !existing.archived_at) return { error: `${name} כבר במאגר.` };
  if (existing) {
    const { error } = await supabase
      .from("students")
      .update({ archived_at: null, ...(phone ? { phone } : {}) })
      .eq("id", existing.id);
    if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
    refresh();
    return { message: `${name} הוחזרה למאגר.`, done: Date.now() };
  }

  const { error } = await supabase.from("students").insert({ space_id: spaceId, name, phone });
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  refresh();
  return { message: `${name} נוספה למאגר.`, done: Date.now() };
}

/**
 * Removes a student from the pool: archived, never deleted, so past
 * lessons, sessions and payments keep her name. Also leaves her groups
 * (group membership is about the future).
 */
export async function removeStudentFromPool(studentId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("students")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", studentId);
  if (error) throw new Error("הסרה מהמאגר נכשלה.");
  await supabase.from("group_members").delete().eq("student_id", studentId);
  refresh();
}
