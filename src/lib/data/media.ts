import "server-only";
import { after } from "next/server";
import { getMediaAccess, isSignedIn } from "@/lib/auth/access";
import { testFault } from "@/lib/testFaults";
import {
  abortMultipart,
  completeMultipart,
  deleteObject,
  deletePrefix,
  headObject,
  isMediaContentType,
  newObjectKey,
  ownerPrefix,
  signParts,
  signUpload,
  signView,
  startMultipart,
  type MediaOwner,
} from "@/lib/storage/r2";
import type { MediaKind } from "@/lib/types";

/**
 * Media lifecycle. Order of operations (no orphans):
 *  upload:   pending row (storage_key, uploaded_at NULL) → signed upload →
 *            browser uploads → complete: server HEADs the object, then sets
 *            uploaded_at/size/type. Pending rows are never shown.
 *  failure:  abort → cancel multipart, delete the object (if any), delete
 *            the pending row. A pending row left by a closed browser is
 *            removed after 24h (cleanupStalePending) with its object; R2's
 *            lifecycle rule cancels its unfinished multipart after a day.
 *  delete:   object first (safe to repeat), then the row. If the row delete
 *            fails, the row shows "file missing" and can be deleted again.
 *  event:    deleting a lesson/session/project first deletes every object
 *            under its prefix (incl. pending ones); if that fails, the event
 *            is NOT deleted (deleteEventFiles).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });
const ACCESS_ERROR: Record<number, string> = { 401: "יש להתחבר מחדש.", 403: "אין הרשאה.", 404: "השיעור או המפגש לא נמצאו." };

export function parseOwner(v: unknown): MediaOwner | null {
  if (!v || typeof v !== "object") return null;
  const { kind, id } = v as { kind?: unknown; id?: unknown };
  if ((kind !== "lesson" && kind !== "session") || typeof id !== "string" || !UUID_RE.test(id)) return null;
  return { kind, id };
}

const ownerCol = (o: MediaOwner) => (o.kind === "lesson" ? "lesson_id" : "session_id");
const kindOf = (contentType: string): MediaKind => (contentType.startsWith("video/") ? "video" : "photo");

type Row = {
  id: string;
  lesson_id: string | null;
  session_id: string | null;
  kind: MediaKind;
  caption: string;
  position: number;
  storage_key: string | null;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
};
const ROW = "id, lesson_id, session_id, kind, caption, position, storage_key, content_type, size_bytes, uploaded_at";

/** A media item as the page shows it. Placeholders have no file. */
export type MediaView = {
  id: string;
  kind: MediaKind;
  caption: string;
  /** Signed, short-lived; absent for placeholders. */
  url?: string;
  contentType?: string;
  sizeBytes?: number;
};

async function toView(row: Row): Promise<MediaView> {
  const base = { id: row.id, kind: row.kind, caption: row.caption };
  if (!row.storage_key) return base;
  return { ...base, url: await signView(row.storage_key), contentType: row.content_type ?? undefined, sizeBytes: row.size_bytes ?? undefined };
}

/** Loads a media row and checks access to its lesson/session. */
async function accessForMedia(mediaId: string, mode: "view" | "manage") {
  if (!UUID_RE.test(mediaId)) return fail(404, "הפריט לא נמצא.");
  const { supabase, signedIn } = await isSignedIn();
  if (!signedIn) return fail(401, ACCESS_ERROR[401]);
  const { data: row } = await supabase.from("media_items").select(ROW).eq("id", mediaId).maybeSingle<Row>();
  if (!row) return fail(404, "הפריט לא נמצא.");
  const owner: MediaOwner = row.lesson_id ? { kind: "lesson", id: row.lesson_id } : { kind: "session", id: row.session_id! };
  const access = await getMediaAccess(owner, mode);
  if (!access.ok) return fail(access.status, ACCESS_ERROR[access.status]);
  return { ok: true as const, supabase: access.supabase, row, owner };
}

/** Deletes a media row; returns the error message, or null. Never discarded by callers. */
async function deleteMediaRow(supabase: Awaited<ReturnType<typeof isSignedIn>>["supabase"], id: string): Promise<string | null> {
  if (await testFault("mediaRowDelete")) return "Injected test fault: mediaRowDelete";
  const { error } = await supabase.from("media_items").delete().eq("id", id);
  return error ? error.message : null;
}

// ---------- Upload ----------

export async function createUpload(input: { owner?: unknown; contentType?: unknown; caption?: unknown; multipart?: unknown }) {
  const owner = parseOwner(input.owner);
  if (!owner) return fail(400, "יעד ההעלאה לא תקין.");
  if (!isMediaContentType(input.contentType)) return fail(415, "אפשר להעלות רק תמונות וסרטונים.");
  const contentType = input.contentType;
  const caption = typeof input.caption === "string" ? input.caption.trim().slice(0, 200) : "";

  const access = await getMediaAccess(owner, "manage");
  if (!access.ok) return fail(access.status, ACCESS_ERROR[access.status]);
  const { supabase } = access;

  const { data: last } = await supabase
    .from("media_items").select("position").eq(ownerCol(owner), owner.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const key = newObjectKey(owner, contentType);
  const { data: row, error } = await supabase
    .from("media_items")
    .insert({ [ownerCol(owner)]: owner.id, kind: kindOf(contentType), caption, position: (last?.position ?? -1) + 1, storage_key: key, content_type: contentType })
    .select("id")
    .single();
  if (error || !row) return fail(500, "פתיחת ההעלאה נכשלה. כדאי לנסות שוב.");

  try {
    if (input.multipart === true) {
      const uploadId = await startMultipart(key, contentType);
      return { ok: true as const, mediaId: row.id as string, uploadId };
    }
    return { ok: true as const, mediaId: row.id as string, uploadUrl: await signUpload(key, contentType) };
  } catch {
    // No pending row without a started upload — and if removing it fails too, say so.
    const cleanupError = await deleteMediaRow(supabase, row.id);
    if (cleanupError) {
      return fail(502, "האחסון לא זמין כרגע, וגם ניקוי הפריט הממתין נכשל (הוא יוסר אוטומטית אחרי 24 שעות). כדאי לנסות שוב.");
    }
    return fail(502, "האחסון לא זמין כרגע. כדאי לנסות שוב.");
  }
}

export async function signUploadParts(mediaId: string, input: { uploadId?: unknown; partNumbers?: unknown }) {
  const a = await accessForMedia(mediaId, "manage");
  if (!a.ok) return a;
  if (!a.row.storage_key || a.row.uploaded_at) return fail(409, "ההעלאה כבר הסתיימה.");
  const parts = Array.isArray(input.partNumbers) ? input.partNumbers : [];
  if (typeof input.uploadId !== "string" || !parts.length || parts.length > 100 || !parts.every((n) => Number.isInteger(n) && n >= 1 && n <= 10000)) {
    return fail(400, "בקשת חלקים לא תקינה.");
  }
  return { ok: true as const, urls: await signParts(a.row.storage_key, input.uploadId, parts as number[]) };
}

export async function completeUpload(mediaId: string, input: { uploadId?: unknown; parts?: unknown }) {
  const a = await accessForMedia(mediaId, "manage");
  if (!a.ok) return a;
  const { row, supabase } = a;
  if (!row.storage_key) return fail(409, "לפריט הזה אין קובץ.");
  if (row.uploaded_at) return { ok: true as const, media: await toView(row) }; // already confirmed (retry)

  if (typeof input.uploadId === "string") {
    const parts = Array.isArray(input.parts) ? input.parts : [];
    const valid = parts.every(
      (p) => p && typeof p === "object" && Number.isInteger((p as { PartNumber?: unknown }).PartNumber) && typeof (p as { ETag?: unknown }).ETag === "string",
    );
    if (!parts.length || !valid) return fail(400, "רשימת החלקים לא תקינה.");
    try {
      await completeMultipart(row.storage_key, input.uploadId, parts as { PartNumber: number; ETag: string }[]);
    } catch {
      return fail(502, "השלמת ההעלאה נכשלה. כדאי לנסות שוב.");
    }
  }

  const head = await headObject(row.storage_key);
  if (!head) return fail(409, "הקובץ לא הגיע לאחסון. כדאי לנסות שוב.");
  if (!isMediaContentType(head.contentType)) {
    // Not a photo or video: remove the object, then the row — each checked and reported.
    try {
      await deleteObject(row.storage_key);
    } catch {
      return fail(502, "הקובץ שהועלה אינו תמונה או סרטון, ומחיקתו מהאחסון נכשלה. כדאי לנסות שוב.");
    }
    const cleanupError = await deleteMediaRow(supabase, row.id);
    if (cleanupError) return fail(500, "הקובץ שהועלה אינו תמונה או סרטון והוסר מהאחסון, אבל מחיקת הפריט נכשלה. כדאי לנסות שוב.");
    return fail(415, "אפשר להעלות רק תמונות וסרטונים.");
  }
  const { data: done, error } = await supabase
    .from("media_items")
    .update({ uploaded_at: new Date().toISOString(), size_bytes: head.size, content_type: head.contentType, kind: kindOf(head.contentType) })
    .eq("id", row.id)
    .select(ROW)
    .single<Row>();
  if (error || !done) return fail(500, "שמירת הפריט נכשלה. כדאי לנסות שוב.");
  return { ok: true as const, media: await toView(done) };
}

export async function abortUpload(mediaId: string, input: { uploadId?: unknown }) {
  const a = await accessForMedia(mediaId, "manage");
  if (!a.ok) return a;
  const { row, supabase } = a;
  if (row.uploaded_at) return fail(409, "ההעלאה כבר הסתיימה; אפשר למחוק את הפריט.");
  if (row.storage_key) {
    try {
      if (typeof input.uploadId === "string") await abortMultipart(row.storage_key, input.uploadId);
      await deleteObject(row.storage_key);
    } catch {
      return fail(502, "ביטול ההעלאה לא הושלם: האחסון לא זמין כרגע. כדאי לנסות שוב.");
    }
  }
  const cleanupError = await deleteMediaRow(supabase, row.id);
  if (cleanupError) return fail(500, "ביטול ההעלאה לא הושלם: מחיקת הפריט הממתין נכשלה (הוא יוסר אוטומטית אחרי 24 שעות).");
  return { ok: true as const };
}

// ---------- Delete ----------

export async function deleteMedia(mediaId: string) {
  const a = await accessForMedia(mediaId, "manage");
  if (!a.ok) return a;
  const { row, supabase } = a;
  if (row.storage_key) {
    try {
      await deleteObject(row.storage_key);
    } catch {
      return fail(502, "מחיקת הקובץ נכשלה. כדאי לנסות שוב.");
    }
  }
  const { error } = await supabase.from("media_items").delete().eq("id", row.id);
  if (error) return fail(500, "הקובץ נמחק, אבל מחיקת הפריט נכשלה. כדאי לנסות שוב.");
  return { ok: true as const };
}

// ---------- Read ----------

/** The media of a lesson/session for its page: placeholders and confirmed uploads, in order. */
export async function getEventMedia(owner: MediaOwner) {
  const access = await getMediaAccess(owner, "view");
  if (!access.ok) return [];
  // After the response: drop this event's uploads left pending > 24h (closed browser).
  const supabase = access.supabase;
  after(() => cleanupStalePending(supabase, owner).catch(() => {}));
  const { data } = await access.supabase
    .from("media_items")
    .select(ROW)
    .eq(ownerCol(owner), owner.id)
    .or("storage_key.is.null,uploaded_at.not.is.null")
    .order("position")
    .returns<Row[]>();
  return Promise.all((data ?? []).map(toView));
}

/**
 * Bytes stored across all confirmed uploads (for the usage line; R2's free
 * tier is 10 GB). Summed here because PostgREST aggregates are off by default.
 */
export async function getMediaUsage() {
  const { supabase, signedIn } = await isSignedIn();
  if (!signedIn) return 0;
  const { data } = await supabase.from("media_items").select("size_bytes").not("uploaded_at", "is", null);
  return (data ?? []).reduce((sum, r) => sum + Number(r.size_bytes ?? 0), 0);
}

// ---------- Event deletion & cleanup ----------

/**
 * Deletes every stored object of these lessons/sessions (by prefix, so
 * pending and orphaned objects go too). Called BEFORE the database delete;
 * a failure means the event must not be deleted.
 */
export async function deleteEventFiles(owners: MediaOwner[]): Promise<{ ok: true } | Fail> {
  try {
    for (const owner of owners) await deletePrefix(ownerPrefix(owner));
    return { ok: true };
  } catch {
    return fail(502, "מחיקת הקבצים מהאחסון נכשלה, ולכן שום דבר לא נמחק. כדאי לנסות שוב.");
  }
}

const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

/** Uploads left pending for more than 24h: object first (safe to repeat), then the row. */
export async function cleanupStalePending(supabase: Awaited<ReturnType<typeof isSignedIn>>["supabase"], owner: MediaOwner) {
  const { data } = await supabase
    .from("media_items")
    .select("id, storage_key")
    .eq(ownerCol(owner), owner.id)
    .not("storage_key", "is", null)
    .is("uploaded_at", null)
    .lt("created_at", new Date(Date.now() - STALE_PENDING_MS).toISOString());
  let removed = 0;
  for (const row of data ?? []) {
    await deleteObject(row.storage_key!);
    const { error } = await supabase.from("media_items").delete().eq("id", row.id).is("uploaded_at", null);
    if (!error) removed++;
  }
  return removed;
}
