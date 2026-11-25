import { TAG, db } from "./support/env";
import { expect, test } from "./support/fixtures";
import { listKeys, objectExists } from "./support/r2";

/** Stage 4.2: storage module, access check and the media API (no UI yet). */

// A valid 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const RANDOM_ID = "00000000-0000-4000-8000-000000000000";

let lessonId = "";
test.beforeAll(async ({}, info) => {
  const sb = await db();
  const { data, error } = await sb
    .from("lessons")
    .insert({ space_id: "new-high-school", date: "2026-12-30", time: "09:00", notes: `${TAG} מדיה ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  lessonId = data.id;
});

const keyOf = async (mediaId: string) =>
  (await (await db()).from("media_items").select("storage_key,uploaded_at,size_bytes,content_type").eq("id", mediaId).maybeSingle()).data;

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("every media endpoint answers 401, and pages redirect to login", async ({ request }) => {
    const json = { headers: { "content-type": "application/json" }, data: {} };
    const calls = [
      request.post("/api/media/uploads", { ...json, data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png" } }),
      request.post(`/api/media/uploads/${RANDOM_ID}/parts`, json),
      request.post(`/api/media/uploads/${RANDOM_ID}/complete`, json),
      request.post(`/api/media/uploads/${RANDOM_ID}/abort`, json),
      request.delete(`/api/media/${RANDOM_ID}`),
      request.get(`/api/media/${RANDOM_ID}/download`, { maxRedirects: 0 }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status(), res.url()).toBe(401);
      expect(JSON.stringify(await res.json())).not.toMatch(/X-Amz-Signature|r2\.cloudflarestorage/);
    }
    const page = await request.get(`/spaces/new-high-school/lessons/${lessonId}`, { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(page.status());
    expect(page.headers()["location"]).toContain("/login");
  });
});

test("another origin, non-JSON and invalid input are refused", async ({ request }) => {
  const h = { "content-type": "application/json" };
  const data = { owner: { kind: "lesson", id: lessonId }, contentType: "image/png" };
  expect((await request.post("/api/media/uploads", { headers: { ...h, origin: "https://evil.example" }, data })).status()).toBe(403);
  expect((await request.post("/api/media/uploads", { headers: { "content-type": "text/plain" }, data: JSON.stringify(data) })).status()).toBe(415);
  expect((await request.post("/api/media/uploads", { headers: h, data: { ...data, owner: { kind: "x", id: "1" } } })).status()).toBe(400);
  expect((await request.post("/api/media/uploads", { headers: h, data: { ...data, contentType: "application/pdf" } })).status()).toBe(415);
  expect((await request.post("/api/media/uploads", { headers: h, data: { ...data, owner: { kind: "lesson", id: RANDOM_ID } } })).status()).toBe(404);
});

test("single upload: pending row → PUT → complete → signed view → delete removes row and object", async ({ request }, info) => {
  const sb = await db();
  const caption = `${TAG} תמונה ${info.project.name}`;
  const start = await request.post("/api/media/uploads", {
    headers: { "content-type": "application/json" },
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png", caption },
  });
  expect(start.status()).toBe(200);
  const { mediaId, uploadUrl } = await start.json();
  const pending = await keyOf(mediaId);
  expect(pending?.storage_key).toMatch(new RegExp(`^lessons/${lessonId}/[0-9a-f-]{36}\\.png$`));
  expect(pending?.uploaded_at).toBeNull();

  const put = await fetch(uploadUrl, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } });
  expect(put.status).toBe(200);

  const done = await request.post(`/api/media/uploads/${mediaId}/complete`, { headers: { "content-type": "application/json" }, data: {} });
  expect(done.status()).toBe(200);
  const { media } = await done.json();
  expect(media).toMatchObject({ id: mediaId, kind: "photo", caption, contentType: "image/png", sizeBytes: PNG.length });
  const row = await keyOf(mediaId);
  expect(row?.uploaded_at).not.toBeNull();
  expect(await objectExists(row!.storage_key!)).toBe(true);

  // The signed URL serves the exact bytes; the same key without a signature is refused.
  const view = await fetch(media.url);
  expect(view.status).toBe(200);
  expect(Buffer.from(await view.arrayBuffer()).equals(PNG)).toBe(true);
  const unsigned = await fetch(media.url.split("?")[0]);
  expect(unsigned.status).toBeGreaterThanOrEqual(400);

  const del = await request.delete(`/api/media/${mediaId}`);
  expect(del.status()).toBe(200);
  expect(await keyOf(mediaId)).toBeNull();
  expect(await objectExists(row!.storage_key!)).toBe(false);
  expect((await sb.from("media_items").select("id").eq("id", mediaId)).data).toEqual([]);
});

test("multipart upload: parts with retryable signed URLs, complete, then delete", async ({ request }, info) => {
  const h = { "content-type": "application/json" };
  const start = await request.post("/api/media/uploads", {
    headers: h,
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "video/mp4", caption: `${TAG} סרטון ${info.project.name}`, multipart: true },
  });
  expect(start.status()).toBe(200);
  const { mediaId, uploadId } = await start.json();
  expect(uploadId).toBeTruthy();

  const part1 = Buffer.alloc(5 * 1024 * 1024, 1); // R2: every part but the last is ≥ 5 MiB
  const part2 = Buffer.alloc(1234, 2);
  const signed = await request.post(`/api/media/uploads/${mediaId}/parts`, { headers: h, data: { uploadId, partNumbers: [1, 2] } });
  expect(signed.status()).toBe(200);
  const { urls } = await signed.json();
  const parts = [];
  for (const [n, body] of [[1, part1], [2, part2]] as const) {
    const res = await fetch(urls[n], { method: "PUT", body });
    expect(res.status).toBe(200);
    parts.push({ PartNumber: n, ETag: res.headers.get("etag")! });
  }

  const done = await request.post(`/api/media/uploads/${mediaId}/complete`, { headers: h, data: { uploadId, parts } });
  expect(done.status()).toBe(200);
  const { media } = await done.json();
  expect(media).toMatchObject({ kind: "video", contentType: "video/mp4", sizeBytes: part1.length + part2.length });
  const row = await keyOf(mediaId);
  expect(await objectExists(row!.storage_key!)).toBe(true);

  expect((await request.delete(`/api/media/${mediaId}`)).status()).toBe(200);
  expect(await objectExists(row!.storage_key!)).toBe(false);
  expect(await keyOf(mediaId)).toBeNull();
});

test("complete before the file arrived is refused; abort leaves no row and no object", async ({ request }, info) => {
  const h = { "content-type": "application/json" };
  const start = await request.post("/api/media/uploads", {
    headers: h,
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png", caption: `${TAG} חסר ${info.project.name}` },
  });
  const { mediaId } = await start.json();
  const key = (await keyOf(mediaId))!.storage_key!;
  expect((await request.post(`/api/media/uploads/${mediaId}/complete`, { headers: h, data: {} })).status()).toBe(409);
  expect((await keyOf(mediaId))?.uploaded_at).toBeNull(); // still pending, never shown

  expect((await request.post(`/api/media/uploads/${mediaId}/abort`, { headers: h, data: {} })).status()).toBe(200);
  expect(await keyOf(mediaId)).toBeNull();
  expect(await objectExists(key)).toBe(false);
});

test("aborting a multipart upload midway leaves nothing behind", async ({ request }, info) => {
  const h = { "content-type": "application/json" };
  const start = await request.post("/api/media/uploads", {
    headers: h,
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "video/quicktime", caption: `${TAG} בוטל ${info.project.name}`, multipart: true },
  });
  const { mediaId, uploadId } = await start.json();
  const key = (await keyOf(mediaId))!.storage_key!;
  expect(key).toMatch(/\.mov$/);
  const { urls } = await (await request.post(`/api/media/uploads/${mediaId}/parts`, { headers: h, data: { uploadId, partNumbers: [1] } })).json();
  expect((await fetch(urls[1], { method: "PUT", body: Buffer.alloc(5 * 1024 * 1024, 3) })).status).toBe(200);

  expect((await request.post(`/api/media/uploads/${mediaId}/abort`, { headers: h, data: { uploadId } })).status()).toBe(200);
  expect(await keyOf(mediaId)).toBeNull();
  expect(await objectExists(key)).toBe(false);
  expect(await listKeys(`lessons/${lessonId}/`)).toEqual([]);
});
