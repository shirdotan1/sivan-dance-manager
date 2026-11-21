import type { APIRequestContext } from "@playwright/test";

/** A valid 1×1 PNG. */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const json = { "content-type": "application/json" };

/** Uploads a photo through the app's media API (signed PUT + complete). */
export async function uploadPhoto(request: APIRequestContext, owner: { kind: "lesson" | "session"; id: string }, caption: string) {
  const start = await request.post("/api/media/uploads", { headers: json, data: { owner, contentType: "image/png", caption } });
  if (!start.ok()) throw new Error(`start upload: ${start.status()}`);
  const { mediaId, uploadUrl } = await start.json();
  const put = await fetch(uploadUrl, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } });
  if (!put.ok) throw new Error(`PUT: ${put.status}`);
  const done = await request.post(`/api/media/uploads/${mediaId}/complete`, { headers: json, data: {} });
  if (!done.ok()) throw new Error(`complete: ${done.status()}`);
  return mediaId as string;
}

/** Starts an upload and PUTs the file, but never confirms it (a "closed browser"). */
export async function leavePending(request: APIRequestContext, owner: { kind: "lesson" | "session"; id: string }, caption: string) {
  const start = await request.post("/api/media/uploads", { headers: json, data: { owner, contentType: "image/png", caption } });
  const { mediaId, uploadUrl } = await start.json();
  await fetch(uploadUrl, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } });
  return mediaId as string;
}
