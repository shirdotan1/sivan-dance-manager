import { FAULT_PORT } from "../playwright.config";
import { SEED, TAG, db } from "./support/env";
import { expect, go, test, vis } from "./support/fixtures";
import { leavePending, uploadPhoto } from "./support/media";
import { listKeys, objectExists, putObject } from "./support/r2";

/** Stage 4.5: deleting events removes their stored files first; stale pending cleanup. */

async function newLesson(label: string) {
  const { data, error } = await (await db())
    .from("lessons")
    .insert({ space_id: "new-high-school", date: "2026-12-25", time: "09:00", notes: `${TAG} ${label}` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Fills an event's prefix: two confirmed photos, one pending upload, one orphan object. */
async function stock(request: Parameters<typeof uploadPhoto>[0], owner: { kind: "lesson" | "session"; id: string }, label: string) {
  await uploadPhoto(request, owner, `${TAG} ${label} א`);
  await uploadPhoto(request, owner, `${TAG} ${label} ב`);
  await leavePending(request, owner, `${TAG} ${label} ממתין`);
  await putObject(`${owner.kind}s/${owner.id}/orphan.bin`);
  const keys = await listKeys(`${owner.kind}s/${owner.id}/`);
  expect(keys.length).toBe(4);
  return keys;
}

async function confirmDelete(page: Parameters<typeof go>[0], trigger: string, title: string | RegExp, confirm: string) {
  await vis(page.getByRole("button", { name: trigger })).click();
  const dialog = page.getByRole("dialog", { name: title });
  await dialog.getByRole("button", { name: confirm }).click();
  return dialog;
}

test("deleting a lesson deletes every stored file under it first", async ({ page, request }, info) => {
  const lessonId = await newLesson(`מחיקה ${info.project.name}`);
  await stock(request, { kind: "lesson", id: lessonId }, "שיעור");

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  await confirmDelete(page, "מחיקת השיעור", "למחוק את השיעור?", "מחיקת השיעור");
  await page.waitForURL(/\/spaces\/new-high-school$/);

  expect((await (await db()).from("lessons").select("id").eq("id", lessonId)).data).toEqual([]);
  expect((await (await db()).from("media_items").select("id").eq("lesson_id", lessonId)).data).toEqual([]);
  expect(await listKeys(`lessons/${lessonId}/`)).toEqual([]);
});

test("deleting a session deletes every stored file under it first", async ({ page, request }, info) => {
  const { data: s, error } = await (await db())
    .from("sessions")
    .insert({ project_id: SEED.project, date: "2026-12-24", time: "10:00", notes: `${TAG} מפגש ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  await stock(request, { kind: "session", id: s.id }, "מפגש");

  await go(page, `/spaces/private-lessons/projects/${SEED.project}/sessions/${s.id}`);
  await confirmDelete(page, "מחיקת המפגש", "למחוק את המפגש?", "מחיקת המפגש");
  await page.waitForURL(new RegExp(`/projects/${SEED.project}$`));

  expect((await (await db()).from("sessions").select("id").eq("id", s.id)).data).toEqual([]);
  expect(await listKeys(`sessions/${s.id}/`)).toEqual([]);
});

test("deleting a project deletes the stored files of all its sessions first", async ({ page, request }, info) => {
  const sb = await db();
  const name = `${TAG} פרויקט ${info.project.name}`;
  const { data: p, error } = await sb.from("projects").insert({ space_id: "private-lessons", name, type: "solo", color: "#7a2048" }).select("id").single();
  if (error) throw error;
  const { data: sessions, error: e2 } = await sb
    .from("sessions")
    .insert([
      { project_id: p.id, date: "2026-12-20", time: "10:00", notes: "" },
      { project_id: p.id, date: "2026-12-21", time: "10:00", notes: "" },
    ])
    .select("id");
  if (e2) throw e2;
  for (const s of sessions!) await stock(request, { kind: "session", id: s.id }, "פרויקט");

  await go(page, `/spaces/private-lessons/projects/${p.id}`);
  await confirmDelete(page, "מחיקת הפרויקט", `למחוק את ״${name}״?`, "מחיקת הפרויקט");
  await page.waitForURL(/\/spaces\/private-lessons$/);

  expect((await sb.from("projects").select("id").eq("id", p.id)).data).toEqual([]);
  for (const s of sessions!) expect(await listKeys(`sessions/${s.id}/`)).toEqual([]);
});

test.describe("when storage deletion fails", () => {
  test.use({ baseURL: `http://localhost:${FAULT_PORT}` });

  test("the lesson is NOT deleted, its files stay, and the dialog says why", async ({ page, request }, info) => {
    const lessonId = await newLesson(`כשל ${info.project.name}`);
    const mediaId = await uploadPhoto(request, { kind: "lesson", id: lessonId }, `${TAG} כשל ${info.project.name}`);
    const { data: row } = await (await db()).from("media_items").select("storage_key").eq("id", mediaId).single();

    await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
    const dialog = await confirmDelete(page, "מחיקת השיעור", "למחוק את השיעור?", "מחיקת השיעור");
    await expect(dialog.getByRole("alert")).toContainText("מחיקת הקבצים מהאחסון נכשלה, ולכן שום דבר לא נמחק");
    await expect(dialog).toBeVisible(); // stays open
    expect(new URL(page.url()).pathname).toBe(`/spaces/new-high-school/lessons/${lessonId}`);

    expect((await (await db()).from("lessons").select("id").eq("id", lessonId)).data).toHaveLength(1);
    expect((await (await db()).from("media_items").select("id").eq("id", mediaId)).data).toHaveLength(1);
    expect(await objectExists(row!.storage_key!)).toBe(true);
  });
});

test("an upload pending for more than 24h is removed with its object when the page is viewed; a fresh one stays", async ({ page, request }, info) => {
  const sb = await db();
  const lessonId = await newLesson(`ממתינים ${info.project.name}`);
  const owner = { kind: "lesson" as const, id: lessonId };
  const staleId = await leavePending(request, owner, `${TAG} ישן ${info.project.name}`);
  const freshId = await leavePending(request, owner, `${TAG} טרי ${info.project.name}`);
  const keyOf = async (id: string) => (await sb.from("media_items").select("storage_key").eq("id", id).single()).data!.storage_key!;
  const [staleKey, freshKey] = [await keyOf(staleId), await keyOf(freshId)];
  expect(await objectExists(staleKey)).toBe(true);
  const aged = await sb.from("media_items").update({ created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() }).eq("id", staleId);
  expect(aged.error, "media_items.created_at exists (migration 003)").toBeNull();

  await go(page, `/spaces/new-high-school/lessons/${lessonId}`);
  await expect.poll(async () => (await sb.from("media_items").select("id").eq("id", staleId)).data!.length).toBe(0);
  expect(await objectExists(staleKey)).toBe(false);
  expect((await sb.from("media_items").select("id").eq("id", freshId)).data).toHaveLength(1);
  expect(await objectExists(freshKey)).toBe(true);
});
