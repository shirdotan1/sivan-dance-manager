"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { testFault } from "@/lib/testFaults";
import { phoneWarning } from "@/lib/phone";
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
  const warning = phone ? phoneWarning("טלפון", phone) : null;
  refresh();
  return { message: `${name} נוספה למאגר.`, done: Date.now(), ...(warning ? { warning } : {}) };
}

/**
 * Removes a student from the pool: archived, never deleted, so past
 * lessons, sessions and payments keep her name. Also leaves her groups
 * (group membership is about the future).
 */
export async function removeStudentFromPool(studentId: string): Promise<{ error: string } | void> {
  const { supabase } = await requireUser();
  // Leave her groups first, checked: if that fails, nothing changed (she
  // stays in the pool and her groups) and the dialog says so.
  const groupsError = (await testFault("groupMembersDelete"))
    ? "Injected test fault: groupMembersDelete"
    : (await supabase.from("group_members").delete().eq("student_id", studentId)).error?.message;
  if (groupsError) return { error: "ההוצאה מהקבוצות נכשלה, ולכן התלמידה לא הוסרה מהמאגר. כדאי לנסות שוב." };
  const { error } = await supabase.from("students").update({ archived_at: new Date().toISOString() }).eq("id", studentId);
  if (error) return { error: "התלמידה הוצאה מהקבוצות, אבל ההסרה מהמאגר נכשלה. כדאי לנסות שוב." };
  refresh();
}

/**
 * Fixes a student's name or phone on the SAME record, so her history,
 * participation and payments stay attached. (Leaving for real is
 * removeStudentFromPool.) A name already used by another student in the
 * same space — active or removed — is refused to avoid two look-alikes.
 */
export async function updateStudent(studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = field(formData, "name").replace(/\s+/g, " ");
  const phone = field(formData, "phone");
  // Parent contact: optional, reminder recipient only (stage 5 defines accounts separately).
  const parentName = field(formData, "parentName").replace(/\s+/g, " ");
  const parentPhone = field(formData, "parentPhone");
  if (!name) return { error: "יש להזין שם תלמידה." };

  const { supabase } = await requireUser();
  const { data: student, error: findError } = await supabase
    .from("students")
    .select("id, space_id")
    .eq("id", studentId)
    .maybeSingle();
  if (findError || !student) return { error: "התלמידה לא נמצאה." };

  // Never rename without a completed check. limit(1), not maybeSingle():
  // two existing students may already share the name (active + removed).
  const { data: clashes, error: clashError } = await supabase
    .from("students")
    .select("id, archived_at")
    .eq("space_id", student.space_id)
    .eq("name", name)
    .neq("id", studentId)
    .order("archived_at", { ascending: false, nullsFirst: true })
    .limit(1);
  if (clashError) return { error: "בדיקת השם נכשלה, והשם לא שונה. כדאי לנסות שוב." };
  const clash = clashes[0];
  if (clash) {
    return {
      error: clash.archived_at
        ? `יש תלמידה שהוסרה מהמאגר בשם ${name}. אפשר להחזיר אותה דרך הוספה למאגר.`
        : `יש כבר תלמידה בשם ${name} במאגר.`,
    };
  }

  const { error } = await supabase
    .from("students")
    .update({ name, phone, parent_name: parentName, parent_phone: parentPhone })
    .eq("id", studentId);
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  refresh();
  // Never blocks: existing numbers were never validated; the note says what won't work.
  const warnings = [phone && phoneWarning("טלפון", phone), parentPhone && phoneWarning("טלפון הורה", parentPhone)].filter(Boolean);
  return { message: `הפרטים של ${name} עודכנו.`, done: Date.now(), ...(warnings.length ? { warning: warnings.join(" ") } : {}) };
}
