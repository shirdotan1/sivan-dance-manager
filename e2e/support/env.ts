import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  const del = async (table: string, col: string) => {
    const r = await sb.from(table).delete().like(col, `%${TAG}%`).select("id");
    out[table] = r.error ? r.error.message : (r.data?.length ?? 0);
  };
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
  return out;
}

/** Seed rows (fixed ids from supabase/seed.sql) the tests read and restore. */
export const SEED = {
  lesson: "aface269-81f7-5d80-adb4-5d25e626d3f6",
  session: "6d5111b2-74bd-51cd-bff3-414685393b94",
  project: "f4035a1e-3e09-5cbb-b3a1-44d8ae946546",
  student: { id: "496c744f-85db-5390-aa6c-c871fccb8922", name: "אלה ברק" },
} as const;
