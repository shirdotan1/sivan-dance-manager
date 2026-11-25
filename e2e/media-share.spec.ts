import type { Page } from "@playwright/test";
import fs from "node:fs";
import { attachmentDisposition, extensionFor, mediaFileName } from "../src/lib/media/filename";
import { activationExpired, canShareFile, shareData, shareFile, type ShareNavigator } from "../src/lib/media/share";
import { TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, test, vis } from "./support/fixtures";
import { PNG, uploadFile, uploadPhoto } from "./support/media";

/**
 * Download and share of a media item. Download: the original file, as an
 * attachment with a readable name, through the app's access-checked route.
 * Share: the file itself (never a signed URL), the caption as text, and a
 * button only where the browser can share that file. The OS share sheet
 * itself can't be automated: it is checked by hand on a phone.
 */

const DATE = "2026-12-25";
let lessonId = "";
const lessonUrl = () => `/spaces/new-high-school/lessons/${lessonId}`;
test.beforeAll(async ({}, info) => {
  const { data, error } = await (await db())
    .from("lessons")
    .insert({ space_id: "new-high-school", date: DATE, time: "09:00", notes: `${TAG} הורדה ושיתוף ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  lessonId = data.id;
});

const phoneOnly = (name: string) => test.skip(name !== "phone-390", "function-level: once is enough");

// ---------- Download (both widths) ----------

test("download: the original file, as an attachment named caption + lesson date, through the access-checked route", async ({ page, request }, info) => {
  const caption = `${TAG} הורדה ${info.project.name}`;
  const mediaId = await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);

  await go(page, lessonUrl());
  const item = vis(page.getByRole("region", { name: /מדיה/ })).getByRole("listitem").filter({ hasText: caption });
  const link = item.getByRole("link", { name: `הורדה של ${caption}` });
  await expect(link).toHaveAttribute("href", `/api/media/${mediaId}/download`);
  const box = (await link.boundingBox())!;
  expect(box.height, "touch target").toBeGreaterThanOrEqual(44);
  expect(box.width, "touch target").toBeGreaterThanOrEqual(44);
  await expectNoOverflow(page);

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe(`${caption} ${DATE}.png`);
  expect(fs.readFileSync((await download.path())!).equals(PNG), "same bytes as uploaded").toBe(true);
  await expect(page).toHaveURL(new RegExp(`${lessonUrl()}$`)); // the page stays

  // The route: a redirect to a fresh signed URL that asks storage for the attachment header; never cached.
  const res = await request.get(`/api/media/${mediaId}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const location = new URL(res.headers()["location"]);
  expect(location.searchParams.get("X-Amz-Signature")).toBeTruthy();
  expect(location.host).not.toContain("r2.dev");
  expect(location.searchParams.get("response-content-disposition")).toBe(
    attachmentDisposition(mediaFileName({ caption, kind: "photo", date: DATE, contentType: "image/png" })),
  );
  const file = await fetch(location);
  expect(file.headers.get("content-disposition")).toMatch(/^attachment; /);
  expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
});

test("download of an unknown item or a placeholder is refused", async ({ request }) => {
  const sb = await db();
  const { data, error } = await sb
    .from("media_items")
    .insert({ lesson_id: lessonId, kind: "photo", caption: `${TAG} מציין מקום`, position: 99 })
    .select("id")
    .single();
  if (error) throw error;
  expect((await request.get(`/api/media/${data.id}/download`, { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get(`/api/media/00000000-0000-4000-8000-000000000000/download`, { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get(`/api/media/not-a-uuid/download`, { maxRedirects: 0 })).status()).toBe(404);
});

// ---------- File names and share logic (function level) ----------

test("file name: caption or kind, the event date, the stored type's extension; RFC 5987 with an ASCII fallback", ({}, info) => {
  phoneOnly(info.project.name);
  expect(mediaFileName({ caption: "חזרה כללית", kind: "video", date: "2026-11-20", contentType: "video/mp4" })).toEqual({
    name: "חזרה כללית 2026-11-20.mp4",
    ascii: "video 2026-11-20.mp4",
  });
  expect(mediaFileName({ caption: "", kind: "photo", date: "2026-11-20", contentType: "image/jpeg" }).name).toBe("תמונה 2026-11-20.jpg");
  expect(mediaFileName({ caption: "  ", kind: "video", date: "2026-11-20", contentType: "video/quicktime" }).name).toBe("סרטון 2026-11-20.mov");
  expect(mediaFileName({ caption: "Final run", kind: "photo", date: "2026-11-20", contentType: "image/png" }).ascii).toBe("Final run 2026-11-20.png");
  // Path, reserved and control characters never reach the name; no date → no date.
  expect(mediaFileName({ caption: '../a/b:c*"d"\n<e>|', kind: "photo", date: null, contentType: "image/png" }).name).toBe("a b c d e.png");
  expect(mediaFileName({ caption: "x".repeat(300), kind: "photo", date: null, contentType: "image/png" }).name).toBe(`${"x".repeat(80)}.png`);
  expect(extensionFor("image/heic")).toBe("heic");
  expect(extensionFor("application/octet-stream")).toBe("bin");

  const cd = attachmentDisposition({ name: "שיעור (1) it's.png", ascii: "photo.png" });
  expect(cd).toBe(`attachment; filename="photo.png"; filename*=UTF-8''${encodeURIComponent("שיעור")}%20%281%29%20it%27s.png`);
  expect(decodeURIComponent(cd.split("''")[1])).toBe("שיעור (1) it's.png");
});

test("share gate: a button only where the browser can share a file of that type", ({}, info) => {
  phoneOnly(info.project.name);
  const asked: ShareData[] = [];
  const onlyPhotos: ShareNavigator = {
    canShare: (d) => (asked.push(d!), d!.files![0].type.startsWith("image/")),
    share: async () => {},
  };
  expect(canShareFile(onlyPhotos, "a.png", "image/png")).toBe(true);
  expect(canShareFile(onlyPhotos, "a.mov", "video/quicktime")).toBe(false);
  expect(asked[1].files![0]).toMatchObject({ name: "a.mov", type: "video/quicktime" });
  expect(Object.keys(asked[1])).toEqual(["files"]); // asked about a file, never a URL

  expect(canShareFile(undefined, "a.png", "image/png")).toBe(false);
  expect(canShareFile({}, "a.png", "image/png"), "no Web Share").toBe(false);
  expect(canShareFile({ share: async () => {} }, "a.png", "image/png"), "share without canShare (old browser)").toBe(false);
  expect(canShareFile({ canShare: () => true }, "a.png", "image/png"), "canShare without share").toBe(false);
  const throws: ShareNavigator = { canShare: () => { throw new TypeError("x"); }, share: async () => {} };
  expect(canShareFile(throws, "a.png", "image/png")).toBe(false);
});

test("share call: the file itself and the caption as text — never a URL; cancel and a used-up tap are told apart", async ({}, info) => {
  phoneOnly(info.project.name);
  const file = new File([PNG], "חזרה 2026-11-20.png", { type: "image/png" });
  expect(shareData(file, " חזרה ")).toEqual({ files: [file], text: "חזרה" });
  expect(shareData(file, "")).toEqual({ files: [file] });

  const calls: ShareData[] = [];
  const ok: ShareNavigator = { share: async (d) => void calls.push(d!) };
  expect(await shareFile(ok, file, "חזרה")).toBe("shared");
  expect(calls[0].files![0]).toBe(file);
  expect(calls[0]).not.toHaveProperty("url");
  expect(calls[0].text).toBe("חזרה");

  const rejecting = (name: string): ShareNavigator => ({ share: async () => { throw new DOMException("x", name); } });
  expect(await shareFile(rejecting("AbortError"), file, "")).toBe("cancelled");
  expect(await shareFile(rejecting("NotAllowedError"), file, "")).toBe("needs-tap");
  await expect(shareFile(rejecting("DataError"), file, "")).rejects.toThrow();

  expect(activationExpired({ userActivation: { isActive: false } })).toBe(true);
  expect(activationExpired({ userActivation: { isActive: true } })).toBe(false);
  expect(activationExpired({}), "no userActivation: just try").toBe(false);
});

// ---------- Share in the page (phone; the share API is stood in for) ----------

type Mock = { canShare?: boolean; reject?: string[]; activationExpired?: boolean };
/** Stands in for the Web Share API; records what would be shared. */
async function mockShare(page: Page, mock: Mock) {
  await page.addInitScript((m: Mock) => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    const reject = [...(m.reject ?? [])];
    Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: () => m.canShare !== false });
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: async (d: ShareData) => {
        const files = await Promise.all(
          (d.files ?? []).map(async (f) => ({ name: f.name, type: f.type, size: f.size, head: Array.from(new Uint8Array(await f.slice(0, 8).arrayBuffer())) })),
        );
        w.__shared.push({ keys: Object.keys(d), text: d.text, url: d.url, files });
        const next = reject.shift();
        if (next) throw new DOMException("mock", next);
      },
    });
    if (m.activationExpired) Object.defineProperty(Navigator.prototype, "userActivation", { configurable: true, get: () => ({ isActive: false }) });
  }, mock);
}
const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared);

async function itemOf(page: Page, caption: string) {
  await go(page, lessonUrl());
  return vis(page.getByRole("region", { name: /מדיה/ })).getByRole("listitem").filter({ hasText: caption });
}

test("share: one tap shares the file itself with the caption; no signed URL is handed over", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} שיתוף`;
  await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);
  await mockShare(page, {});
  const item = await itemOf(page, caption);
  const button = item.getByRole("button", { name: `שיתוף של ${caption}` });
  const box = (await button.boundingBox())!;
  expect(box.height, "touch target").toBeGreaterThanOrEqual(44);
  await button.click();
  await expect.poll(() => shared(page)).toHaveLength(1);
  expect(await shared(page)).toEqual([
    {
      keys: ["files", "text"],
      text: caption,
      url: undefined,
      files: [{ name: `${caption} ${DATE}.png`, type: "image/png", size: PNG.length, head: Array.from(PNG.subarray(0, 8)) }],
    },
  ]);
  await expect(button).toHaveText(new RegExp(`^שיתוף`)); // back to idle
});

test("share: when the tap no longer counts, the button becomes 'הקובץ מוכן: שיתוף' and a second tap shares", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} שיתוף בשתי לחיצות`;
  await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);
  await mockShare(page, { reject: ["NotAllowedError"] });
  const item = await itemOf(page, caption);
  await item.getByRole("button", { name: `שיתוף של ${caption}` }).click();
  const ready = item.getByRole("button", { name: `הקובץ מוכן: שיתוף של ${caption}` });
  await expect(ready).toBeVisible();
  await expect(item.getByRole("status")).toContainText("הקובץ מוכן");
  await ready.click();
  await expect.poll(() => shared(page)).toHaveLength(2);
  await expect(item.getByRole("button", { name: `שיתוף של ${caption}` })).toBeVisible();
});

test("share: if the tap expired during the download, it waits for a second tap without trying", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} שיתוף אחרי המתנה`;
  await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);
  await mockShare(page, { activationExpired: true });
  const item = await itemOf(page, caption);
  await item.getByRole("button", { name: `שיתוף של ${caption}` }).click();
  await expect(item.getByRole("button", { name: `הקובץ מוכן: שיתוף של ${caption}` })).toBeVisible();
  expect(await shared(page)).toHaveLength(0);
  await item.getByRole("button", { name: `הקובץ מוכן: שיתוף של ${caption}` }).click();
  await expect.poll(() => shared(page)).toHaveLength(1);
});

test("share: no button where the browser can't share the file — download only, never a dead button", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} רק הורדה`;
  await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);
  await mockShare(page, { canShare: false });
  const item = await itemOf(page, caption);
  await expect(item.getByRole("link", { name: `הורדה של ${caption}` })).toBeVisible();
  await expect(item.getByRole("button", { name: /^(שיתוף|הקובץ מוכן)/ })).toHaveCount(0);
});

test("unsupported format (HEVC .mov): download and share instead of a bare 'open the file' link", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} HEVC`;
  const mov = Buffer.alloc(4096, 1); // not playable here: the item shows as unsupported
  const mediaId = await uploadFile(request, { kind: "lesson", id: lessonId }, caption, { contentType: "video/quicktime", body: mov });
  await mockShare(page, {});
  const item = await itemOf(page, caption);
  await expect(item).toContainText("הפורמט של הסרטון לא נתמך בדפדפן הזה.");
  await expect(item.getByRole("link", { name: /פתיחת הקובץ/ })).toHaveCount(0);
  await expect(item.getByRole("link", { name: `הורדה של ${caption}` })).toHaveAttribute("href", `/api/media/${mediaId}/download`);
  await item.getByRole("button", { name: `שיתוף של ${caption}` }).click();
  await expect.poll(() => shared(page)).toHaveLength(1);
  const [s] = (await shared(page)) as { files: { name: string; type: string; size: number }[] }[];
  expect(s.files[0]).toMatchObject({ name: `${caption} ${DATE}.mov`, type: "video/quicktime", size: mov.length });
});

test("photo dialog: download and share are there too", async ({ page, request }, info) => {
  phoneOnly(info.project.name);
  const caption = `${TAG} בדיאלוג`;
  await uploadPhoto(request, { kind: "lesson", id: lessonId }, caption);
  await mockShare(page, {});
  const item = await itemOf(page, caption);
  await item.getByRole("button", { name: `הגדלה: ${caption}` }).click();
  const dialog = page.getByRole("dialog", { name: caption });
  await expect(dialog.getByRole("link", { name: `הורדה של ${caption}` })).toBeVisible();
  await dialog.getByRole("button", { name: `שיתוף של ${caption}` }).click();
  await expect.poll(() => shared(page)).toHaveLength(1);
});
