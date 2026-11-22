import { normalizePhone } from "../src/lib/phone";
import { TAG, db } from "./support/env";
import { expect, go, main, test, vis } from "./support/fixtures";

/** Stage 5.5: parent name and phone on the student; phone numbers normalized (never guessed). */

test("normalizePhone: Israeli local → international, international kept, the rest refused with a reason", ({}, info) => {
  test.skip(info.project.name !== "phone-390", "no browser involved: once is enough");
  const ok = (raw: string) => {
    const r = normalizePhone(raw);
    return r.ok ? r.international : `✗${r.reason}`;
  };
  expect(ok("050-123-4567")).toBe("972501234567");
  expect(ok(" 050 1234567 ")).toBe("972501234567");
  expect(ok("+972 50-123-4567")).toBe("972501234567");
  expect(ok("00972501234567")).toBe("972501234567");
  expect(ok("02-623-4567")).toBe("97226234567");
  expect(ok("077-1234567")).toBe("972771234567");
  expect(ok("+44 20 7946 0958")).toBe("442079460958");
  expect(ok("")).toBe("✗empty");
  expect(ok("501234567")).toBe("✗invalid"); // no prefix — never guessed
  expect(ok("050-12")).toBe("✗invalid");
  expect(ok("050-123-456a")).toBe("✗invalid");
  expect(ok("+972 12345")).toBe("✗invalid");
  expect(ok("+123")).toBe("✗invalid");
  const r = normalizePhone("050-123-4567");
  expect(r.ok && r.display).toBe("+972 50-123-4567");
});

async function newStudent(label: string) {
  const { data, error } = await (await db()).from("students").insert({ space_id: "private-lessons", name: `${TAG} ${label}`, phone: "050-111-2222" }).select("id,name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}
async function editParent(page: import("@playwright/test").Page, id: string, parentName: string, parentPhone: string) {
  await go(page, `/students/${id}`);
  await vis(page.getByText("עריכת פרטים")).click();
  const form = vis(page.getByRole("form", { name: /עריכת הפרטים של/ }));
  await form.getByLabel(/^שם הורה/).fill(parentName);
  await form.getByLabel(/^טלפון הורה/).fill(parentPhone);
  await form.getByRole("button", { name: "שמירת הפרטים" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "עודכנו" }))).toBeVisible();
}

test("parent name and phone save and show on the student card; a valid number gives no warning", async ({ page }, info) => {
  const s = await newStudent(`הורה ${info.project.name}`);
  await editParent(page, s.id, "דנה כהן", "052-765-4321");
  const { data } = await (await db()).from("students").select("parent_name,parent_phone").eq("id", s.id).single();
  expect(data).toEqual({ parent_name: "דנה כהן", parent_phone: "052-765-4321" });
  await expect(main(page)).toContainText("הורה: דנה כהן");
  await expect(vis(page.getByRole("link", { name: "052-765-4321" }))).toHaveAttribute("href", "tel:0527654321");
  await expect(vis(page.getByRole("status").filter({ hasText: "וואטסאפ לא תעבוד" }))).toHaveCount(0);
});

test("an invalid parent number is saved anyway, with a non-blocking warning", async ({ page }, info) => {
  const s = await newStudent(`הורה-שגוי ${info.project.name}`);
  await editParent(page, s.id, "אבי", "12345");
  await expect(vis(page.getByRole("status").filter({ hasText: "טלפון הורה" }))).toContainText("תזכורת בוואטסאפ לא תעבוד");
  expect((await (await db()).from("students").select("parent_phone").eq("id", s.id).single()).data!.parent_phone).toBe("12345");
});

test("adding a student with a number WhatsApp won't understand: added, with the warning", async ({ page }, info) => {
  await go(page, "/spaces/private-lessons");
  await vis(page.getByText("+ הוספת תלמידה למאגר")).click();
  const form = vis(page.getByRole("form", { name: "הוספת תלמידה למאגר" }));
  const name = `${TAG} חדשה-טלפון ${info.project.name}`;
  await form.getByLabel(/^שם התלמידה/).fill(name);
  await form.getByLabel(/^טלפון/).fill("501234567");
  await form.getByRole("button", { name: "הוספה למאגר" }).click();
  await expect(vis(page.getByRole("status").filter({ hasText: "חסר קידומת" }))).toBeVisible();
  expect((await (await db()).from("students").select("id").eq("name", name)).data).toHaveLength(1);
});
