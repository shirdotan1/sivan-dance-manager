"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import { guessLang, isMaterialKind, materialKindLabel, materialLinkError, titleFromLink } from "@/lib/format";

/**
 * Validates and normalizes a material from a form. The kind decides the
 * rules: songs keep artist/style and a YouTube/Spotify link; videos and
 * links require any http(s) link; notes need a title or note text.
 * Fields that don't belong to the kind are cleared.
 */
function readMaterial(formData: FormData) {
  const rawKind = field(formData, "kind") || "song";
  if (!isMaterialKind(rawKind)) return { error: "סוג חומר לא מוכר." } as const;
  const kind = rawKind;
  const link = field(formData, "link");
  const linkError = materialLinkError(kind, link);
  if (linkError) return { error: linkError } as const;
  const note = field(formData, "note");
  const title = field(formData, "title") || (link ? titleFromLink(link, kind) : "");
  if (!title) return { error: kind === "note" ? "יש להזין כותרת להערה." : "יש להזין שם או להדביק לינק." } as const;
  const isSong = kind === "song";
  const artist = isSong ? field(formData, "artist") : "";
  return {
    row: {
      kind,
      title,
      artist,
      style: isSong ? field(formData, "style") : "",
      link: link || null,
      note: note || null,
      title_lang: guessLang(title),
      artist_lang: guessLang(artist),
    },
  } as const;
}

export async function createMaterial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readMaterial(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("songs").insert(parsed.row);
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  refresh();
  return {
    message: `${materialKindLabel[parsed.row.kind]} ״${parsed.row.title}״ נוסף לבנק החומרים.`,
    done: Date.now(),
  };
}

export async function updateMaterial(materialId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readMaterial(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("songs").update(parsed.row).eq("id", materialId);
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  refresh();
  return { message: `״${parsed.row.title}״ נשמר.`, done: Date.now() };
}

/** Deletes a material; it's removed from the lessons and sessions that used it. */
export async function deleteMaterial(materialId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("songs").delete().eq("id", materialId);
  if (error) throw new Error("המחיקה נכשלה.");
  refresh();
}
