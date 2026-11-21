import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteKeys, listKeys } from "./r2";

/** The Supabase TEST project. Tests create and delete rows; never production. */
export const TEST_PROJECT_REF = "gapprimwuxufzdjcnwwm";

/** Marker for every row a test creates; cleanup deletes by it. */
export const TAG = "בדיקה-אוטו";

export function assertTestEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(TEST_PROJECT_REF) || (process.env.PROD_SUPABASE_URL && url === process.env.PROD_SUPABASE_URL)) {
    throw new Error(`E2E refused: NEXT_PUBLIC_SUPABASE_URL is not the test project (${TEST_PROJECT_REF}).`);
  }
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error("E2E refused: E2E_EMAIL / E2E_PASSWORD missing.");
}

let client: Promise<SupabaseClient> | undefined;

/** A client signed in as the test user (RLS applies, like the app). */
export function db(): Promise<SupabaseClient> {
  assertTestEnvironment();
  client ??= (async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    if (error) throw error;
    return sb;
  })();
  return client;
}

/** Deletes everything tests created (tagged) and undoes an unfinished rename. */
export async function cleanup(sb: SupabaseClient) {
  const out: Record<string, number | string> = {};
  // Storage first: objects of tagged lessons/sessions and of tagged media rows.
  const [{ data: tl }, { data: ts }, { data: tm }] = await Promise.all([
    sb.from("lessons").select("id").like("notes", `%${TAG}%`),
    sb.from("sessions").select("id").like("notes", `%${TAG}%`),
    sb.from("media_items").select("id,storage_key").like("caption", `%${TAG}%`),
  ]);
  const { data: tp } = await sb.from("projects").select("id").like("name", `%${TAG}%`);
  const { data: tps } = tp?.length ? await sb.from("sessions").select("id").in("project_id", tp.map((p) => p.id)) : { data: [] };
  let objects = 0;
  for (const s of tps ?? []) objects += await deleteKeys(await listKeys(`sessions/${s.id}/`));
  for (const l of tl ?? []) objects += await deleteKeys(await listKeys(`lessons/${l.id}/`));
  for (const s of ts ?? []) objects += await deleteKeys(await listKeys(`sessions/${s.id}/`));
  objects += await deleteKeys((tm ?? []).flatMap((m) => (m.storage_key ? [m.storage_key] : [])));
  out.objects = objects;
  out.media_items = (await sb.from("media_items").delete().like("caption", `%${TAG}%`).select("id")).data?.length ?? 0;
  const del = async (table: string, col: string) => {
    const r = await sb.from(table).delete().like(col, `%${TAG}%`).select("id");
    out[table] = r.error ? r.error.message : (r.data?.length ?? 0);
  };
  await del("projects", "name");
  await del("lessons", "notes");
  await del("sessions", "notes");
  await del("songs", "title");
  const { data: renamed } = await sb.from("students").select("id,name").like("name", "%שונה-אוטו%");
  for (const st of renamed ?? []) {
    const orig = String(st.name).split("|")[1];
    if (orig) await sb.from("students").update({ name: orig }).eq("id", st.id);
  }
  out.restoredNames = renamed?.length ?? 0;
  await del("students", "name");
  // Orphans: objects in the test bucket with no media row (should be 0).
  const { data: keyed } = await sb.from("media_items").select("storage_key").not("storage_key", "is", null);
  const known = new Set((keyed ?? []).map((m) => m.storage_key));
  out.orphanObjects = (await listKeys()).filter((k) => !known.has(k)).length;
  return out;
}

/** Seed rows (fixed ids from supabase/seed.sql) the tests read and restore. */
export const SEED = {
  lesson: "aface269-81f7-5d80-adb4-5d25e626d3f6",
  session: "6d5111b2-74bd-51cd-bff3-414685393b94",
  project: "f4035a1e-3e09-5cbb-b3a1-44d8ae946546",
  student: { id: "496c744f-85db-5390-aa6c-c871fccb8922", name: "אלה ברק" },
} as const;
