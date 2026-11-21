import { readJson, respond } from "@/lib/api/json";
import { signUploadParts } from "@/lib/data/media";

/** Signed URLs for a batch of multipart parts. */
export async function POST(req: Request, ctx: RouteContext<"/api/media/uploads/[mediaId]/parts">) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const { mediaId } = await ctx.params;
  return respond(await signUploadParts(mediaId, json.body));
}
