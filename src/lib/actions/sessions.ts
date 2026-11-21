"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { deleteEventFiles } from "@/lib/data/media";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import { DATE_RE, TIME_RE, parseMaterials, replaceMaterials, resolveMaterials } from "@/lib/data/entries";

const SPACE = "private-lessons";

/** Field-level failure: the form shows each message next to its field and focuses the first. */
function invalid(fieldErrors: Record<string, string>): ActionState {
  return { error: "יש לתקן את השדות המסומנים.", fieldErrors };
}

/**
 * Creates (sessionId = null) or updates a project session: date, time,
 * one payment per project participant (amount + paid), materials, notes. Media is managed on the session page.
 */
export async function saveSession(
  projectId: string,
  sessionId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const date = field(formData, "date");
  const time = field(formData, "time");
  const fieldErrors: Record<string, string> = {};
  if (!DATE_RE.test(date)) fieldErrors.date = "יש לבחור תאריך.";
  if (!TIME_RE.test(time)) fieldErrors.time = "יש לבחור שעה.";
  const notes = field(formData, "notes");
  const materials = parseMaterials(formData.get("materials"));
  if ("error" in materials) fieldErrors.materials = materials.error;
  if (Object.keys(fieldErrors).length) return invalid(fieldErrors);
  if ("error" in materials) return invalid(fieldErrors); // narrows the type

  const { supabase } = await requireUser();
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_participants(student_id)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "הפרויקט לא נמצא." };

  const payments = [];
  for (const { student_id } of project.project_participants as { student_id: string }[]) {
    const raw = field(formData, `amount_${student_id}`).replace(/[^\d]/g, "");
    const amount = raw ? Math.min(Number(raw), 1_000_000) : 0;
    payments.push({ student_id, amount, paid: formData.get(`paid_${student_id}`) === "on" });
  }

  const materialIds = await resolveMaterials(supabase, materials);
  if ("error" in materialIds) return invalid({ materials: materialIds.error });

  let id = sessionId;
  if (id) {
    const { error } = await supabase.from("sessions").update({ date, time, notes }).eq("id", id).eq("project_id", projectId);
    if (error) return { error: "שמירת המפגש נכשלה. כדאי לנסות שוב." };
  } else {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ project_id: projectId, date, time, notes })
      .select("id")
      .single();
    if (error) return { error: "יצירת המפגש נכשלה. כדאי לנסות שוב." };
    id = data.id as string;
  }

  // Payments for current participants are replaced; rows of former participants are kept (history).
  const ids = payments.map((p) => p.student_id);
  if (ids.length) {
    const del = await supabase.from("session_payments").delete().eq("session_id", id).in("student_id", ids);
    if (del.error) return { error: "שמירת התשלומים נכשלה." };
    const ins = await supabase.from("session_payments").insert(payments.map((p) => ({ ...p, session_id: id })));
    if (ins.error) return { error: "שמירת התשלומים נכשלה." };
  }
  const err = await replaceMaterials(supabase, { session_id: id! }, materialIds);
  if (err) return { error: "שמירת החומרים נכשלה." };

  redirect(`/spaces/${SPACE}/projects/${projectId}/sessions/${id}?saved=1`);
}

/** One-tap paid / not paid from the session page (saved immediately). */
export async function setPaymentPaid(sessionId: string, studentId: string, paid: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("session_payments")
    .update({ paid })
    .eq("session_id", sessionId)
    .eq("student_id", studentId);
  if (error) throw new Error("עדכון התשלום נכשל.");
  refresh();
}

/**
 * Deletes a session with its payments, materials and media. Its stored
 * files go first; if that fails, the session is not deleted.
 */
export async function deleteSession(projectId: string, sessionId: string): Promise<{ error: string } | void> {
  const { supabase } = await requireUser();
  const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionId).eq("project_id", projectId).maybeSingle();
  if (!session) return { error: "המפגש לא נמצא." };
  const files = await deleteEventFiles([{ kind: "session", id: sessionId }]);
  if (!files.ok) return { error: files.error };
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("project_id", projectId);
  if (error) return { error: "הקבצים נמחקו, אבל מחיקת המפגש נכשלה. כדאי לנסות שוב." };
  refresh();
  redirect(`/spaces/${SPACE}/projects/${projectId}`);
}
