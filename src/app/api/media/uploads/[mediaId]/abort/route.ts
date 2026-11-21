import { readJson, respond } from "@/lib/api/json";
import { abortUpload } from "@/lib/data/media";

/** Cancels a failed upload: no pending row and no object are left behind. */
export async function POST(req: Request, ctx: RouteContext<"/api/media/uploads/[mediaId]/abort">) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const { mediaId } = await ctx.params;
  return respond(await abortUpload(mediaId, json.body));
}
