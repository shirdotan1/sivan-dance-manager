import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./support/fixtures";

/** No storage secret, key id or account endpoint in anything sent to the browser. */
test("R2 credentials never appear in client bundles", async ({}, info) => {
  test.skip(info.project.name !== "phone-390", "build output is the same for both widths");
  const secrets = {
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
    R2_ENDPOINT_HOST: new URL(process.env.R2_ENDPOINT!).host,
  };
  for (const [name, value] of Object.entries(secrets)) expect(value, `${name} is set`).toBeTruthy();

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(".next/static");
  expect(files.length).toBeGreaterThan(10);
  // Positive control: text from a client component IS in the bundle, so the scan
  // must find it (proves it reads the real client code). Supabase is server-only here.
  expect(files.some((f) => fs.readFileSync(f, "utf8").includes("ניסיון חוזר")), "scan finds client text").toBe(true);
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const [name, value] of Object.entries(secrets)) {
      expect(text.includes(value), `${name} found in ${f}`).toBe(false);
    }
  }
});

test("signed URLs are bound and short-lived; the media API is never cached", async ({ request }, info) => {
  const { TAG, db } = await import("./support/env");
  const sb = await db();
  const { data: lesson, error } = await sb
    .from("lessons")
    .insert({ space_id: "new-high-school", date: "2026-12-23", time: "09:00", notes: `${TAG} אבטחה ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  const h = { "content-type": "application/json" };

  // An upload URL signed for image/png can't be used to upload another type.
  const start = await request.post("/api/media/uploads", { headers: h, data: { owner: { kind: "lesson", id: lesson.id }, contentType: "image/png", caption: `${TAG} חתימה` } });
  expect(start.headers()["cache-control"]).toContain("no-store");
  const { mediaId, uploadUrl } = await start.json();
  const wrongType = await fetch(uploadUrl, { method: "PUT", body: "<html>", headers: { "content-type": "text/html" } });
  expect(wrongType.status).toBe(403);
  const upload = new URL(uploadUrl);
  expect(Number(upload.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(15 * 60);

  // The real upload, then the view URL: signed, ≤ 2 hours.
  const { PNG } = await import("./support/media");
  expect((await fetch(uploadUrl, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } })).status).toBe(200);
  const done = await request.post(`/api/media/uploads/${mediaId}/complete`, { headers: h, data: {} });
  expect(done.headers()["cache-control"]).toContain("no-store");
  const view = new URL((await done.json()).media.url);
  expect(view.searchParams.get("X-Amz-Signature")).toBeTruthy();
  expect(Number(view.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(2 * 60 * 60);

  // Errors are not cached either.
  const bad = await request.post("/api/media/uploads", { headers: h, data: {} });
  expect(bad.status()).toBe(400);
  expect(bad.headers()["cache-control"]).toContain("no-store");

  expect((await request.delete(`/api/media/${mediaId}`)).status()).toBe(200);
});

/** Every table — including lesson_series (migration 004) — refuses anonymous reads. */
test("no table can be read anonymously with the public key", async ({}, info) => {
  test.skip(info.project.name !== "phone-390", "one database for both widths");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const tables = [
    "spaces", "students", "groups", "group_members", "songs", "lesson_series", "lessons", "lesson_participants",
    "lesson_songs", "projects", "project_participants", "sessions", "session_payments", "session_songs", "media_items",
  ];
  for (const t of tables) {
    const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const body = await res.json().catch(() => null);
    expect(Array.isArray(body) && body.length > 0, `${t} returned rows anonymously`).toBe(false);
    expect([401, 403], `${t}: status ${res.status}`).toContain(res.status);
  }
});
