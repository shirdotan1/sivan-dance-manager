import { readJson, respond } from "@/lib/api/json";
import { deleteMedia } from "@/lib/data/media";

/** Deletes a media item: the object first, then the row. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/media/[mediaId]">) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const { mediaId } = await ctx.params;
  return respond(await deleteMedia(mediaId));
}
