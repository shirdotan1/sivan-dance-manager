import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { abortUploads, deleteKeys, listKeys } from "./r2";

/** The Supabase TEST project. Tests create and delete rows; never production. */
export const TEST_PROJECT_REF = "gapprimwuxufzdjcnwwm";

/** Marker for every row a test creates; cleanup deletes by it. */
export const TAG = "בדיקה-אוטו";

/**
 * Weekly slots have no text to tag. Every slot a test creates is recorded
 * (recordSeries) the moment it exists; cleanup deletes only recorded ids.
 * Tests also keep slots in the test hours (04:00–05:59: 04 at the phone
 * width, 05 at the desktop width) — an extra filter on top of the ids,
 * never the selection itself. Times typed into a form must be whole
 * 5 minutes (the time fields use step=300).
 */
export const TEST_HOUR = "05";
export const TEST_WINDOW = { from: "04:00", to: "05:59:59" } as const;
/** A test slot time: 04:mm at the phone width, 05:mm at the desktop width. */
export const testSlotTime = (projectName: string, minute: number) =>
  `${projectName === "desktop-1280" ? "05" : "04"}:${String(minute).padStart(2, "0")}`;
const REGISTRY = "e2e/.state/created-series.json";

const readRegistry = (): string[] => {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  } catch {
    return [];
  }
};

/** Records a slot this suite created (call right after creating it). */
export function recordSeries(id: string) {
  fs.mkdirSync("e2e/.state", { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify([...new Set([...readRegistry(), id])]));
}

/** A Supabase result that must succeed: cleanup fails loudly instead of reporting a guess. */
function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`cleanup failed (${what}): ${r.error.message}`);
  return r.data as T;
}

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

/**
 * Deletes everything tests created (tagged rows; recorded slots) and undoes
 * an unfinished rename. Counts are confirmed deletions; any error throws.
 */
export async function cleanup(sb: SupabaseClient) {
  const out: Record<string, number | string> = {};
  // Recorded test slots (and, as an extra filter, only in the test hour). Their
  // occurrences go first: lessons reference slots (RESTRICT).
  const recorded = readRegistry();
  if (recorded.length) {
    const found = must(
      await sb.from("lesson_series").select("id").in("id", recorded).gte("time", TEST_WINDOW.from).lte("time", TEST_WINDOW.to),
      "find recorded series",
    ).map((r: { id: string }) => r.id);
    if (found.length) {
      const serLessons = must(await sb.from("lessons").select("id").in("series_id", found), "series lessons");
      for (const l of serLessons as { id: string }[]) await deleteKeys(await listKeys(`lessons/${l.id}/`));
      const deletedLessons = must(await sb.from("lessons").delete().in("series_id", found).select("id"), "delete series lessons");
      if (deletedLessons.length !== serLessons.length) throw new Error(`cleanup: deleted ${deletedLessons.length}/${serLessons.length} series lessons`);
      const deleted = must(await sb.from("lesson_series").delete().in("id", found).select("id"), "delete series");
      if (deleted.length !== found.length) throw new Error(`cleanup: deleted ${deleted.length}/${found.length} recorded series`);
      out.seriesLessons = deletedLessons.length;
    }
    out.series = found.length;
    fs.writeFileSync(REGISTRY, "[]");
  } else out.series = 0;
  // Storage first: objects of tagged lessons/sessions and of tagged media rows.
  const [{ data: tl }, { data: ts }, { data: tm }] = await Promise.all([
    sb.from("lessons").select("id").like("notes", `%${TAG}%`),
    sb.from("sessions").select("id").like("notes", `%${TAG}%`),
    sb.from("media_items").select("id,storage_key").like("caption", `%${TAG}%`),
  ]);
  const { data: tp } = await sb.from("projects").select("id").like("name", `%${TAG}%`);
  const { data: tps } = tp?.length ? await sb.from("sessions").select("id").in("project_id", tp.map((p) => p.id)) : { data: [] };
  let objects = 0;
  let openUploads = 0;
  const prefixes = [
    ...(tps ?? []).map((s) => `sessions/${s.id}/`),
    ...(tl ?? []).map((l) => `lessons/${l.id}/`),
    ...(ts ?? []).map((s) => `sessions/${s.id}/`),
  ];
  for (const prefix of prefixes) {
    openUploads += await abortUploads(prefix);
    objects += await deleteKeys(await listKeys(prefix));
  }
  out.openUploads = openUploads;
  objects += await deleteKeys((tm ?? []).flatMap((m) => (m.storage_key ? [m.storage_key] : [])));
  out.objects = objects;
  out.media_items = must(await sb.from("media_items").delete().like("caption", `%${TAG}%`).select("id"), "delete media_items").length;
  const del = async (table: string, col: string) => {
    out[table] = must(await sb.from(table).delete().like(col, `%${TAG}%`).select("id"), `delete ${table}`).length;
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
