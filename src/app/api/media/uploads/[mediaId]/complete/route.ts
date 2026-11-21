import { readJson, respond } from "@/lib/api/json";
import { completeUpload } from "@/lib/data/media";

/** Confirms an upload (the server checks the object exists) and returns the item. */
export async function POST(req: Request, ctx: RouteContext<"/api/media/uploads/[mediaId]/complete">) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const { mediaId } = await ctx.params;
  return respond(await completeUpload(mediaId, json.body));
}
