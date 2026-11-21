import { TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, main, test, vis } from "./support/fixtures";
import { objectExists } from "./support/r2";

/** Stage 4.3: photos on the lesson/session page — upload, view, delete. */

// A valid 2×2 PNG (so the browser really decodes and shows it).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGM4oREFRAwQCgAl3gUpEzqvXwAAAABJRU5ErkJggg==", "base64");
// Signed URLs are virtual-hosted (<bucket>.<account>.r2.cloudflarestorage.com).
const isR2 = (url: string) => {
  const host = new URL(url).host;
  const base = new URL(process.env.R2_ENDPOINT!).host;
  return host === base || host.endsWith(`.${base}`);
};

let lessonId = "";
const lessonUrl = () => `/spaces/new-high-school/lessons/${lessonId}`;
test.beforeAll(async ({}, info) => {
  const { data, error } = await (await db())
    .from("lessons")
    .insert({ space_id: "new-high-school", date: "2026-12-29", time: "09:00", notes: `${TAG} תמונות ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  lessonId = data.id;
});

test("upload a photo: it shows in the grid via a signed URL, opens in a dialog, and is stored", async ({ page }, info) => {
  const caption = `${TAG} חזרה ${info.project.name}`;
  const r2Requests: string[] = [];
  page.on("request", (r) => {
    if (isR2(r.url())) r2Requests.push(r.url());
  });

  await go(page, lessonUrl());
  const section = vis(page.getByRole("region", { name: /מדיה/ }));
  await expect(section).toContainText("בשימוש באחסון:");
  const form = section.getByRole("form", { name: "העלאת תמונות וסרטונים" });
  await form.getByLabel("תמונות וסרטונים מהטלפון או מהמחשב").setInputFiles({ name: "rehearsal.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel(/^כיתוב/).fill(caption);
  await form.getByRole("button", { name: "העלאה" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "התמונה הועלתה" }))).toBeVisible();

  const thumb = section.getByRole("button", { name: `הגדלה: ${caption}` });
  await expect(thumb).toBeVisible();
  const img = thumb.locator("img");
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(2);
  const src = (await img.getAttribute("src"))!;
  expect(src).toContain("X-Amz-Signature=");
  expect(src).not.toContain("r2.dev");

  const { data: row } = await (await db()).from("media_items").select("storage_key,uploaded_at,size_bytes").eq("caption", caption).single();
  expect(row!.uploaded_at).not.toBeNull();
  expect(row!.size_bytes).toBe(PNG.length);
  expect(await objectExists(row!.storage_key!)).toBe(true);

  // Dialog: opens with the photo, closes with the button and with Esc.
  await thumb.click();
  const dialog = page.getByRole("dialog", { name: caption });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator("img").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(2);
  await dialog.getByRole("button", { name: "סגירה" }).click();
  await expect(dialog).toBeHidden();
  await thumb.click();
  await expect(page.getByRole("dialog", { name: caption })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: caption })).toBeHidden();
  await expectNoOverflow(page);

  // Every request to storage was signed; nothing public anywhere in the page.
  expect(r2Requests.length).toBeGreaterThan(0);
  for (const u of r2Requests) expect(u).toContain("X-Amz-Signature=");
  expect(await page.content()).not.toContain("r2.dev");
});

test("delete a photo from the page: the item and the stored file are gone", async ({ page }, info) => {
  const caption = `${TAG} חזרה ${info.project.name}`;
  // The photo's own lesson (a retried worker re-runs beforeAll with a new lesson).
  const { data: row } = await (await db()).from("media_items").select("id,storage_key,lesson_id").eq("caption", caption).single();
  expect(row).toBeTruthy();

  await go(page, `/spaces/new-high-school/lessons/${row!.lesson_id}`);
  const section = vis(page.getByRole("region", { name: /מדיה/ }));
  await section.getByRole("button", { name: `מחיקה של ${caption}` }).click();
  const confirm = page.getByRole("dialog", { name: "למחוק את הקובץ?" });
  await expect(confirm.getByRole("button", { name: "ביטול" })).toBeFocused();
  await confirm.getByRole("button", { name: "מחיקה" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "נמחק" }))).toBeVisible();
  await expect(section.getByRole("button", { name: `הגדלה: ${caption}` })).toHaveCount(0);

  expect((await (await db()).from("media_items").select("id").eq("id", row!.id)).data).toEqual([]);
  expect(await objectExists(row!.storage_key!)).toBe(false);
});

test("a pending upload is never shown on the page", async ({ page, request }, info) => {
  const caption = `${TAG} ממתין ${info.project.name}`;
  const start = await request.post("/api/media/uploads", {
    headers: { "content-type": "application/json" },
    data: { owner: { kind: "lesson", id: lessonId }, contentType: "image/png", caption },
  });
  const { mediaId } = await start.json();
  await go(page, lessonUrl());
  await expect(vis(page.getByRole("region", { name: /מדיה/ }))).not.toContainText(caption);
  expect((await request.post(`/api/media/uploads/${mediaId}/abort`, { headers: { "content-type": "application/json" }, data: {} })).status()).toBe(200);
});

test("a placeholder item (no file) is shown gracefully, with no image", async ({ page }) => {
  const sb = await db();
  const { data: ph } = await sb.from("media_items").select("lesson_id,session_id,caption").is("storage_key", null).not("lesson_id", "is", null).limit(1).single();
  const { data: lesson } = await sb.from("lessons").select("space_id").eq("id", ph!.lesson_id).single();
  await go(page, `/spaces/${lesson!.space_id}/lessons/${ph!.lesson_id}`);
  const section = vis(page.getByRole("region", { name: /מדיה/ }));
  const item = section.getByRole("listitem").filter({ hasText: ph!.caption });
  await expect(item).toContainText("מציין מקום — אין קובץ");
  await expect(item.locator("img")).toHaveCount(0);
  await expect(item.getByRole("button", { name: /^מחיקה/ })).toBeVisible();
  await expect(main(page)).not.toContainText("העלאת קבצים אמיתית תתווסף");
  await expectNoOverflow(page);
});

test("the session page has the same media section", async ({ page }) => {
  const sb = await db();
  const { data: s } = await sb.from("sessions").select("id,project_id").limit(1).single();
  await go(page, `/spaces/private-lessons/projects/${s!.project_id}/sessions/${s!.id}`);
  const section = vis(page.getByRole("region", { name: /מדיה/ }));
  await expect(section.getByRole("form", { name: "העלאת תמונות וסרטונים" })).toBeVisible();
  await expect(section).toContainText("בשימוש באחסון:");
  await expectNoOverflow(page);
});
