import { FAULT_PORT } from "../playwright.config";
import { TAG, db } from "./support/env";
import { expect, test } from "./support/fixtures";

/**
 * Checklist #8: a failed write fails the action and is reported — never
 * discarded. Each failure is provoked on the fault server with an opt-in
 * x-test-fault header; a control shows the normal path still works.
 */
test.use({ baseURL: `http://localhost:${FAULT_PORT}` });
const json = { "content-type": "application/json" };

async function newLesson(label: string) {
  const { data, error } = await (await db()).from("lessons").insert({ space_id: "new-high-school", date: "2026-12-22", time: "09:00", notes: `${TAG} ${label}` }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
const rowsByCaption = async (caption: string) => (await (await db()).from("media_items").select("id,uploaded_at").eq("caption", caption)).data!;

test("write 1 — storage fails to start an upload AND removing the pending row fails: reported, not swallowed", async ({ request }, info) => {
  const lessonId = await newLesson(`כתיבה1 ${info.project.name}`);
  const caption = `${TAG} כתיבה1 ${info.project.name}`;
  const res = await request.post("/api/media/uploads", {
    headers: { ...json, "x-test-fault": "startMultipart,mediaRowDelete" },
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "video/mp4", caption, multipart: true },
  });
  expect(res.status()).toBe(502);
  expect((await res.json()).error).toContain("וגם ניקוי הפריט הממתין נכשל");
  expect(await rowsByCaption(caption)).toHaveLength(1); // the row the failed cleanup left (removed after 24h / by test cleanup)

  // Control: storage fails, cleanup works → plain message, no pending row left.
  const caption2 = `${caption} ביקורת`;
  const ok = await request.post("/api/media/uploads", {
    headers: { ...json, "x-test-fault": "startMultipart" },
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "video/mp4", caption: caption2, multipart: true },
  });
  expect(ok.status()).toBe(502);
  expect((await ok.json()).error).not.toContain("ניקוי");
  expect(await rowsByCaption(caption2)).toEqual([]);
});

async function uploadedPending(request: Parameters<Parameters<typeof test>[2]>[0]["request"], lessonId: string, caption: string) {
  const { PNG } = await import("./support/media");
  const start = await request.post("/api/media/uploads", { headers: json, data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png", caption } });
  const { mediaId, uploadUrl } = await start.json();
  expect((await fetch(uploadUrl, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } })).status).toBe(200);
  const { data } = await (await db()).from("media_items").select("storage_key").eq("id", mediaId).single();
  return { mediaId: mediaId as string, key: data!.storage_key as string };
}

test("write 2 — a non-media upload whose row deletion fails: reported; the object is still removed", async ({ request }, info) => {
  const { objectExists } = await import("./support/r2");
  const lessonId = await newLesson(`כתיבה2 ${info.project.name}`);
  const caption = `${TAG} כתיבה2 ${info.project.name}`;
  const a = await uploadedPending(request, lessonId, caption);
  const res = await request.post(`/api/media/uploads/${a.mediaId}/complete`, { headers: { ...json, "x-test-fault": "headAsHtml,mediaRowDelete" }, data: {} });
  expect(res.status()).toBe(500);
  expect((await res.json()).error).toContain("מחיקת הפריט נכשלה");
  expect(await objectExists(a.key)).toBe(false);
  expect(await rowsByCaption(caption)).toHaveLength(1);

  // Control: the row deletion works → 415, nothing left.
  const caption2 = `${caption} ביקורת`;
  const b = await uploadedPending(request, lessonId, caption2);
  const ok = await request.post(`/api/media/uploads/${b.mediaId}/complete`, { headers: { ...json, "x-test-fault": "headAsHtml" }, data: {} });
  expect(ok.status()).toBe(415);
  expect(await objectExists(b.key)).toBe(false);
  expect(await rowsByCaption(caption2)).toEqual([]);
});

test("write 3 — cancelling an upload whose row deletion fails: reported, not a silent success", async ({ request }, info) => {
  const lessonId = await newLesson(`כתיבה3 ${info.project.name}`);
  const caption = `${TAG} כתיבה3 ${info.project.name}`;
  const start = await request.post("/api/media/uploads", { headers: json, data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png", caption } });
  const { mediaId } = await start.json();
  const res = await request.post(`/api/media/uploads/${mediaId}/abort`, { headers: { ...json, "x-test-fault": "mediaRowDelete" }, data: {} });
  expect(res.status()).toBe(500);
  expect((await res.json()).error).toContain("ביטול ההעלאה לא הושלם");
  expect(await rowsByCaption(caption)).toHaveLength(1);

  // Control: the same cancel without the fault succeeds and leaves nothing.
  const ok = await request.post(`/api/media/uploads/${mediaId}/abort`, { headers: json, data: {} });
  expect(ok.status()).toBe(200);
  expect(await rowsByCaption(caption)).toEqual([]);
});
