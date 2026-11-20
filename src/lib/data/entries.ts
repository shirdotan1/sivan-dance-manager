import "server-only";
import type { requireUser } from "@/lib/supabase/server";
import { guessLang, isMaterialKind, materialKindLabel, materialLinkError, titleFromLink } from "@/lib/format";
import type { MaterialKind } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/*
 * Server-side parsing and persistence for the repeated parts of the
 * lesson and session forms (submitted as JSON in hidden inputs).
 * Everything coming from the client is validated here.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseJsonArray(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export type ParsedParticipant = { id: string } | { name: string };
export type ParsedMaterial = { id: string } | { kind: MaterialKind; title: string; link: string };
export type ParsedMedia = { kind: "photo" | "video"; caption: string };

export function parseParticipants(raw: FormDataEntryValue | null): ParsedParticipant[] {
  const out: ParsedParticipant[] = [];
  for (const v of parseJsonArray(raw)) {
    if (v && typeof v === "object" && "id" in v && typeof v.id === "string" && UUID_RE.test(v.id)) out.push({ id: v.id });
    else if (v && typeof v === "object" && "name" in v && typeof v.name === "string" && v.name.trim())
      out.push({ name: v.name.trim().replace(/\s+/g, " ").slice(0, 100) });
  }
  return out;
}

export function parseMaterials(raw: FormDataEntryValue | null): ParsedMaterial[] | { error: string } {
  const out: ParsedMaterial[] = [];
  for (const v of parseJsonArray(raw)) {
    if (v && typeof v === "object" && "id" in v && typeof v.id === "string" && UUID_RE.test(v.id)) out.push({ id: v.id });
    else if (v && typeof v === "object" && "title" in v) {
      const kind = "kind" in v && isMaterialKind(v.kind) ? v.kind : "song";
      const title = typeof v.title === "string" ? v.title.trim().slice(0, 200) : "";
      const link = "link" in v && typeof v.link === "string" ? v.link.trim() : "";
      const linkError = materialLinkError(kind, link);
      if (linkError) return { error: `${materialKindLabel[kind]} ״${title || link}״: ${linkError}` };
      if (title || link) out.push({ kind, title, link });
    }
  }
  return out;
}

export function parseMedia(raw: FormDataEntryValue | null): ParsedMedia[] {
  const out: ParsedMedia[] = [];
  for (const v of parseJsonArray(raw)) {
    if (v && typeof v === "object" && "kind" in v && (v.kind === "photo" || v.kind === "video")) {
      const caption = "caption" in v && typeof v.caption === "string" ? v.caption.trim().slice(0, 200) : "";
      out.push({ kind: v.kind, caption });
    }
  }
  return out;
}

/**
 * Resolves participants to student ids in the space: existing ids must be
 * in the space's pool; typed names reuse an active student with that name,
 * restore a removed one, or create a new pool student.
 */
export async function resolveParticipants(
  supabase: Supabase,
  spaceId: string,
  entries: ParsedParticipant[],
): Promise<string[] | { error: string }> {
  const { data: pool, error } = await supabase.from("students").select("id, name, archived_at").eq("space_id", spaceId);
  if (error) return { error: "טעינת המאגר נכשלה." };
  const ids: string[] = [];
  for (const e of entries) {
    if ("id" in e) {
      if (!pool.some((s) => s.id === e.id)) return { error: "אחת המשתתפות אינה שייכת למרחב הזה." };
      if (!ids.includes(e.id)) ids.push(e.id);
      continue;
    }
    const existing = pool.find((s) => s.name === e.name);
    if (existing) {
      if (existing.archived_at) await supabase.from("students").update({ archived_at: null }).eq("id", existing.id);
      if (!ids.includes(existing.id)) ids.push(existing.id);
      continue;
    }
    const { data, error: insErr } = await supabase
      .from("students")
      .insert({ space_id: spaceId, name: e.name })
      .select("id, name, archived_at")
      .single();
    if (insErr) return { error: `שמירת התלמידה ${e.name} נכשלה.` };
    pool.push(data);
    ids.push(data.id);
  }
  return ids;
}

/** Resolves materials to ids, creating new bank materials (with their kind) for typed titles/links. */
export async function resolveMaterials(supabase: Supabase, entries: ParsedMaterial[]): Promise<string[] | { error: string }> {
  const ids: string[] = [];
  for (const e of entries) {
    if ("id" in e) {
      if (!ids.includes(e.id)) ids.push(e.id);
      continue;
    }
    const title = e.title || titleFromLink(e.link, e.kind);
    const { data, error } = await supabase
      .from("songs")
      .insert({ kind: e.kind, title, link: e.link || null, title_lang: guessLang(title), artist_lang: "he" })
      .select("id")
      .single();
    if (error) return { error: `שמירת ״${title}״ נכשלה.` };
    ids.push(data.id);
  }
  return ids;
}

/** Replaces a lesson's or session's materials (ordered; stored in *_songs) and media placeholders. */
export async function replaceMaterialsAndMedia(
  supabase: Supabase,
  owner: { lesson_id: string } | { session_id: string },
  materialIds: string[],
  media: ParsedMedia[],
): Promise<string | null> {
  const songTable = "lesson_id" in owner ? "lesson_songs" : "session_songs";
  const [ownerCol, ownerId] = Object.entries(owner)[0];
  const del = await supabase.from(songTable).delete().eq(ownerCol, ownerId);
  if (del.error) return del.error.message;
  if (materialIds.length) {
    const ins = await supabase.from(songTable).insert(materialIds.map((song_id, position) => ({ ...owner, song_id, position })));
    if (ins.error) return ins.error.message;
  }
  const delM = await supabase.from("media_items").delete().eq(ownerCol, ownerId);
  if (delM.error) return delM.error.message;
  if (media.length) {
    const insM = await supabase.from("media_items").insert(media.map((m, position) => ({ ...owner, ...m, position })));
    if (insM.error) return insM.error.message;
  }
  return null;
}
