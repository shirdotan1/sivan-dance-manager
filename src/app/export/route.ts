import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/format";

/** Every table, in dependency order (so a restore can insert top to bottom). */
const TABLES = [
  "spaces",
  "students",
  "groups",
  "group_members",
  "songs",
  "lessons",
  "lesson_participants",
  "lesson_songs",
  "projects",
  "project_participants",
  "sessions",
  "session_payments",
  "session_songs",
  "media_items",
] as const;

/**
 * GET /export — downloads all data as one JSON file (sivan-backup-YYYY-MM-DD.json).
 * Signed-in only: checked here as well as by the proxy and by RLS.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return new Response("נדרשת התחברות.", { status: 401 });

  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return new Response(`הייצוא נכשל (${table}).`, { status: 500 });
    tables[table] = data;
  }

  const date = todayIso();
  const body = JSON.stringify(
    {
      app: "sivan-dance-manager",
      format: 1,
      exportedAt: new Date().toISOString(),
      // Media rows are included; the photo/video files themselves live in R2 and are not.
      note: "קבצי התמונות והסרטונים עצמם אינם כלולים בקובץ הזה: הם שמורים באחסון נפרד (Cloudflare R2). כאן נשמרים רק פרטי הפריטים.",
      counts: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])),
      tables,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sivan-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
