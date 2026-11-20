"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import { DATE_RE, TIME_RE, parseMedia, parseMaterials, replaceMaterialsAndMedia, resolveMaterials } from "@/lib/data/entries";

const SPACE = "private-lessons";

/**
 * Creates (sessionId = null) or updates a project session: date, time,
 * one payment per project participant (amount + paid), songs, notes, media.
 */
export async function saveSession(
  projectId: string,
  sessionId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const date = field(formData, "date");
  const time = field(formData, "time");
  if (!DATE_RE.test(date)) return { error: "יש לבחור תאריך." };
  if (!TIME_RE.test(time)) return { error: "יש לבחור שעה." };
  const notes = field(formData, "notes");
  const materials = parseMaterials(formData.get("materials"));
  if ("error" in materials) return { error: materials.error };

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
  if ("error" in materialIds) return { error: materialIds.error };

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
  const err = await replaceMaterialsAndMedia(supabase, { session_id: id! }, materialIds, parseMedia(formData.get("media")));
  if (err) return { error: "שמירת השירים או המדיה נכשלה." };

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

/** Deletes a session with its payments, songs and media. */
export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("project_id", projectId);
  if (error) throw new Error("מחיקת המפגש נכשלה.");
  refresh();
  redirect(`/spaces/${SPACE}/projects/${projectId}`);
}
