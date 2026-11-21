import { readJson, respond } from "@/lib/api/json";
import { createUpload } from "@/lib/data/media";

/** Starts an upload: pending row + a signed PUT URL, or a multipart upload id. */
export async function POST(req: Request) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  return respond(await createUpload(json.body));
}
