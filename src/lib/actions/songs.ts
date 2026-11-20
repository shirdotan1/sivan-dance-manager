"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { field, type ActionState } from "@/lib/actions/result";
import { guessLang, isSongLink, titleFromLink } from "@/lib/format";

export interface SongActionState extends ActionState {
  /** Id of the song just created (inline add in lesson/session forms). */
  songId?: string;
  songTitle?: string;
}

/** Validates and normalizes song fields; a title or a link is required. */
function readSong(formData: FormData) {
  const link = field(formData, "link");
  if (link && !isSongLink(link)) return { error: "הלינק צריך להיות קישור מלא מיוטיוב או מספוטיפיי." } as const;
  const title = field(formData, "title") || (link ? titleFromLink(link) : "");
  if (!title) return { error: "יש להזין שם שיר או להדביק לינק." } as const;
  const artist = field(formData, "artist");
  return {
    row: {
      title,
      artist,
      style: field(formData, "style"),
      link: link || null,
      note: field(formData, "note") || null,
      title_lang: guessLang(title),
      artist_lang: guessLang(artist),
    },
  } as const;
}

export async function createSong(_prev: SongActionState, formData: FormData): Promise<SongActionState> {
  const parsed = readSong(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("songs").insert(parsed.row).select("id").single();
  if (error) return { error: "שמירת השיר נכשלה. כדאי לנסות שוב." };
  refresh();
  return {
    message: `״${parsed.row.title}״ נוסף לבנק השירים.`,
    done: Date.now(),
    songId: data.id,
    songTitle: parsed.row.title,
  };
}

export async function updateSong(songId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readSong(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("songs").update(parsed.row).eq("id", songId);
  if (error) return { error: "השמירה נכשלה. כדאי לנסות שוב." };
  refresh();
  return { message: `״${parsed.row.title}״ נשמר.`, done: Date.now() };
}

/** Deletes a song; it's removed from the lessons and sessions that used it. */
export async function deleteSong(songId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("songs").delete().eq("id", songId);
  if (error) throw new Error("מחיקת השיר נכשלה.");
  refresh();
}
