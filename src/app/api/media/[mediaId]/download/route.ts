import { respond } from "@/lib/api/json";
import { getDownloadUrl } from "@/lib/data/media";

/**
 * Download of the original file: checks access, then redirects to a fresh
 * signed URL that serves it as an attachment with a readable name. A plain
 * link (GET, no side effects); never cached.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[mediaId]/download">) {
  const { mediaId } = await ctx.params;
  const result = await getDownloadUrl(mediaId);
  if (!result.ok) return respond(result);
  return new Response(null, { status: 302, headers: { Location: result.url, "Cache-Control": "no-store" } });
}
