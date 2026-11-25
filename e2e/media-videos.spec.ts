import type { Page, Route } from "@playwright/test";
import { TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, test, vis } from "./support/fixtures";
import { listKeys, objectExists, openUploads } from "./support/r2";

/** Stage 4.4: videos — multipart upload with retries, cancel, inline player. */

const isR2 = (url: string) => {
  const host = new URL(url).host;
  const base = new URL(process.env.R2_ENDPOINT!).host;
  return host === base || host.endsWith(`.${base}`);
};

let lessonId = "";
test.beforeAll(async ({}, info) => {
  const { data, error } = await (await db())
    .from("lessons")
    .insert({ space_id: "new-high-school", date: "2026-12-27", time: "09:00", notes: `${TAG} סרטונים ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  lessonId = data.id;
});

/** A real ~1.5 s WebM, recorded in the browser (Playwright's Chromium plays VP8/VP9, not H.264). */
async function recordWebm(page: Page) {
  const b64 = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 160, height: 120 });
    const ctx = canvas.getContext("2d")!;
    const rec = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    let frame = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${frame++ * 25} 70% 50%)`;
      ctx.fillRect(0, 0, 160, 120);
    }, 66);
    rec.start();
    await new Promise((r) => setTimeout(r, 1500));
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.stop();
    await stopped;
    clearInterval(timer);
    const bytes = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  return Buffer.from(b64, "base64");
}

async function startUpload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, caption: string) {
  const section = vis(page.getByRole("region", { name: /מדיה/ }));
  const form = section.getByRole("form", { name: "העלאת תמונות וסרטונים" });
  await form.getByLabel("תמונות וסרטונים מהטלפון או מהמחשב").setInputFiles(file);
  await form.getByLabel(/^כיתוב/).fill(caption);
  await form.getByRole("button", { name: "העלאה" }).click();
  return { section, form };
}

const rowByCaption = async (caption: string) =>
  (await (await db()).from("media_items").select("id,kind,storage_key,content_type,size_bytes,uploaded_at").eq("caption", caption).maybeSingle()).data;

test("a short real video uploads (multipart) and plays inline", async ({ page }, info) => {
  const caption = `${TAG} ריקוד ${info.project.name}`;
  const puts: string[] = [];
  page.on("request", (r) => isR2(r.url()) && r.method() === "PUT" && puts.push(r.url()));

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  const webm = await recordWebm(page);
  expect(webm.length).toBeGreaterThan(1000);
  const { section } = await startUpload(page, { name: "dance.webm", mimeType: "video/webm", buffer: webm }, caption);
  await expect(vis(page.getByRole("status").filter({ hasText: "הסרטון הועלה" }))).toBeVisible();

  // Went up as a multipart part, to a signed URL.
  expect(puts.length).toBe(1);
  expect(puts[0]).toMatch(/[?&]partNumber=1/);
  expect(puts[0]).toMatch(/[?&]uploadId=/);
  expect(puts[0]).toContain("X-Amz-Signature=");

  const row = await rowByCaption(caption);
  expect(row).toMatchObject({ kind: "video", content_type: "video/webm", size_bytes: webm.length });
  expect(await objectExists(row!.storage_key!)).toBe(true);

  // Plays inline in the native player.
  const video = section.getByLabel(caption);
  await expect(video).toHaveJSProperty("tagName", "VIDEO");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  const start = await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
    return v.currentTime;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(start);
  await expect(section).not.toContainText("לא נתמך");
  await expectNoOverflow(page);
});

test("a 12 MB video goes up in two parts; a format the browser can't play shows a clear message", async ({ page }, info) => {
  const caption = `${TAG} גדול ${info.project.name}`;
  const parts: string[] = [];
  page.on("request", (r) => isR2(r.url()) && r.method() === "PUT" && parts.push(new URL(r.url()).searchParams.get("partNumber")!));
  const big = Buffer.alloc(12 * 1024 * 1024, 7); // not a real video

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  const { section } = await startUpload(page, { name: "big.mp4", mimeType: "video/mp4", buffer: big }, caption);
  await expect(vis(page.getByRole("status").filter({ hasText: "הסרטון הועלה" }))).toBeVisible({ timeout: 60_000 });
  expect(parts.sort()).toEqual(["1", "2"]);

  const row = await rowByCaption(caption);
  expect(row).toMatchObject({ kind: "video", size_bytes: big.length });
  expect(await objectExists(row!.storage_key!)).toBe(true);

  const item = section.getByRole("listitem").filter({ hasText: caption });
  await expect(item).toContainText("הפורמט של הסרטון לא נתמך בדפדפן הזה.");
  // Unsupported format: download (and share where the browser can) instead of a bare "open the file" link.
  await expect(item.getByRole("link", { name: /פתיחת הקובץ/ })).toHaveCount(0);
  await expect(item.getByRole("link", { name: `הורדה של ${caption}` })).toHaveAttribute("href", /^\/api\/media\/[0-9a-f-]+\/download$/);
});

test("a dropped part is retried with a fresh signed URL and the upload succeeds", async ({ page, consoleErrors }, info) => {
  const caption = `${TAG} נפילה ${info.project.name}`;
  const attempts: string[] = [];
  let dropped = false;
  await page.route(
    (url) => isR2(url.toString()),
    async (route: Route) => {
      if (route.request().method() !== "PUT") return route.continue();
      attempts.push(route.request().url());
      if (!dropped) {
        dropped = true;
        return route.abort("connectionreset");
      }
      return route.continue();
    },
  );

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  const webm = await recordWebm(page);
  await startUpload(page, { name: "retry.webm", mimeType: "video/webm", buffer: webm }, caption);
  await expect(vis(page.getByRole("status").filter({ hasText: "הסרטון הועלה" }))).toBeVisible({ timeout: 30_000 });

  expect(attempts.length).toBe(2);
  expect(attempts[1]).not.toBe(attempts[0]); // re-signed, not the same URL
  const row = await rowByCaption(caption);
  expect(row?.uploaded_at).not.toBeNull();
  expect(await objectExists(row!.storage_key!)).toBe(true);

  // The one connection reset this test caused on purpose; anything else still fails the test.
  const expected = consoleErrors.filter((e) => e.includes("net::ERR_CONNECTION_RESET"));
  expect(expected).toHaveLength(1);
  consoleErrors.splice(consoleErrors.indexOf(expected[0]), 1);
});

test("cancel during an upload leaves no row and no object", async ({ page }, info) => {
  const caption = `${TAG} ביטול ${info.project.name}`;
  await page.route(
    (url) => isR2(url.toString()),
    async (route: Route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await new Promise((r) => setTimeout(r, 8000)); // hold the part so there is time to cancel
      await route.continue().catch(() => {});
    },
  );

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  const { form } = await startUpload(page, { name: "cancel.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(6 * 1024 * 1024, 1) }, caption);
  await expect(form.getByRole("button", { name: "ביטול ההעלאה" })).toBeVisible();
  await expect.poll(async () => (await rowByCaption(caption))?.id ?? null).not.toBeNull(); // the pending row exists
  await form.getByRole("button", { name: "ביטול ההעלאה" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "ההעלאה בוטלה" }))).toBeVisible();

  await expect.poll(() => rowByCaption(caption)).toBeNull();
  await expect.poll(async () => (await openUploads(`lessons/${lessonId}/`)).length).toBe(0); // the multipart was aborted
  const keyed = (await (await db()).from("media_items").select("storage_key").eq("lesson_id", lessonId)).data!.map((r) => r.storage_key);
  expect((await listKeys(`lessons/${lessonId}/`)).filter((k) => !keyed.includes(k))).toEqual([]); // no orphan object
});

test("leaving the page during an upload asks for confirmation", async ({ page }, info) => {
  const caption = `${TAG} יציאה ${info.project.name}`;
  await page.route(
    (url) => isR2(url.toString()),
    async (route: Route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await new Promise((r) => setTimeout(r, 8000));
      await route.continue().catch(() => {});
    },
  );
  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  const { form } = await startUpload(page, { name: "leave.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024 * 1024, 2) }, caption);
  await expect(form.getByRole("button", { name: "ביטול ההעלאה" })).toBeVisible();
  // Only once the pending row exists does "the row is gone" prove the cancel cleaned up.
  await expect.poll(async () => (await rowByCaption(caption))?.id ?? null).not.toBeNull();

  const dialog = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe("beforeunload");
  await d.dismiss(); // stay on the page
  await form.getByRole("button", { name: "ביטול ההעלאה" }).click();
  await expect.poll(() => rowByCaption(caption)).toBeNull();
  await expect.poll(async () => (await openUploads(`lessons/${lessonId}/`)).length).toBe(0);
});
