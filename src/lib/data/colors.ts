import "server-only";
import type { requireUser } from "@/lib/supabase/server";
import { pickColor } from "@/lib/palette";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Least-used palette color across groups and projects (both appear in the calendar). */
export async function nextColor(supabase: Supabase): Promise<string> {
  const [g, p] = await Promise.all([supabase.from("groups").select("color"), supabase.from("projects").select("color")]);
  return pickColor([...(g.data ?? []), ...(p.data ?? [])].map((r) => r.color as string));
}
