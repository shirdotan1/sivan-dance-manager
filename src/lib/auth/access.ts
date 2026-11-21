import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MediaOwner } from "@/lib/storage/r2";

/**
 * The single access check for media (signing upload and view URLs, deleting).
 *
 * Stage 4: the only account is Sivan's (sign-ups are disabled), so any
 * signed-in user may view and manage the media of an existing lesson or
 * session. Stage 5 (student accounts) changes ONLY this function: students
 * get "view" for events they take part in, never "manage". Until then,
 * RLS also gives every signed-in user full access — stage 5 must rewrite
 * RLS before any student account exists.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `mode` matters from stage 5 (students: view only)
export async function getMediaAccess(owner: MediaOwner, mode: "view" | "manage"): Promise<MediaAccessResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return { ok: false, status: 401 };

  const table = owner.kind === "lesson" ? "lessons" : "sessions";
  const { data: event } = await supabase.from(table).select("id").eq("id", owner.id).maybeSingle();
  if (!event) return { ok: false, status: 404 };

  return { ok: true, supabase, userId: data.claims.sub as string };
}

export type MediaAccessResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; status: 401 | 403 | 404 };

/** Signed in at all (for checks before the owner is known). */
export async function isSignedIn() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, signedIn: !error && Boolean(data?.claims) };
}
