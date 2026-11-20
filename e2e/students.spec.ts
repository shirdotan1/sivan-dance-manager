import { SEED, TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, main, test, vis } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function openEdit(page: Page, studentId: string) {
  await go(page, `/students/${studentId}`);
  await vis(page.getByText("עריכת פרטים")).click();
  return vis(page.getByRole("form", { name: /עריכת הפרטים של/ }));
}

test("pool: 'עריכה' opens one inline form, prefilled, and closes", async ({ page }) => {
  await go(page, "/spaces/private-lessons");
  const btn = vis(page.getByRole("button", { name: `עריכה של ${SEED.student.name}` }));
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const form = vis(page.getByRole("form", { name: `עריכת הפרטים של ${SEED.student.name}` }));
  await expect(form.getByLabel(/^שם/)).toHaveValue(SEED.student.name);
  await expectNoOverflow(page);
  await btn.click();
  await expect(form).toHaveCount(0);
});

test("rename to another student's name is refused", async ({ page }) => {
  const sb = await db();
  const { data: other } = await sb
    .from("students").select("name").eq("space_id", "private-lessons").neq("id", SEED.student.id).is("archived_at", null).limit(1).single();
  const form = await openEdit(page, SEED.student.id);
  await form.getByLabel(/^שם/).fill(other!.name);
  await form.getByRole("button", { name: "שמירת הפרטים" }).click();
  await expect(vis(page.getByRole("alert").filter({ hasText: /./ })).first()).toBeVisible();
  expect((await sb.from("students").select("name").eq("id", SEED.student.id).single()).data!.name).toBe(SEED.student.name);
});

test("rename refused when the name is shared by an active + a removed student", async ({ page }, info) => {
  const sb = await db();
  const dup = `${TAG} כפולה ${info.project.name}`;
  const ins = await sb.from("students").insert([
    { space_id: "private-lessons", name: dup },
    { space_id: "private-lessons", name: dup, archived_at: new Date().toISOString() },
    { space_id: "private-lessons", name: `${TAG} שלישית ${info.project.name}` },
  ]).select("id,name");
  if (ins.error) throw ins.error;
  const third = ins.data.find((x) => x.name.includes("שלישית"))!;
  const form = await openEdit(page, third.id);
  await form.getByLabel(/^שם/).fill(dup);
  await form.getByRole("button", { name: "שמירת הפרטים" }).click();
  await expect(vis(page.getByRole("alert").filter({ hasText: "יש כבר תלמידה בשם" })).first()).toBeVisible();
  expect((await sb.from("students").select("name").eq("id", third.id).single()).data!.name).toContain("שלישית");
});

test("FINAL-2: a renamed student shows the new name across her history", async ({ page }, info) => {
  const sb = await db();
  const newName = `שונה-אוטו ${info.project.name}|${SEED.student.name}`;
  try {
    let form = await openEdit(page, SEED.student.id);
    await form.getByLabel(/^שם/).fill(newName);
    await form.getByRole("button", { name: "שמירת הפרטים" }).click();
    await expect(vis(page.getByRole("heading", { level: 1, name: newName }))).toBeVisible();
    for (const p of [
      "/spaces/private-lessons",
      `/spaces/private-lessons/projects/${SEED.project}`,
      `/spaces/private-lessons/projects/${SEED.project}/sessions/${SEED.session}`,
      "/spaces/private-lessons/payments",
    ]) {
      await go(page, p);
      const t = await main(page).innerText();
      expect(t, p).toContain(newName);
      expect(t.replaceAll(newName, ""), p).not.toContain(SEED.student.name);
    }
    // Restore through the UI too.
    form = await openEdit(page, SEED.student.id);
    await form.getByLabel(/^שם/).fill(SEED.student.name);
    await form.getByRole("button", { name: "שמירת הפרטים" }).click();
    await expect(vis(page.getByRole("heading", { level: 1, name: SEED.student.name }))).toBeVisible();
  } finally {
    await sb.from("students").update({ name: SEED.student.name }).eq("id", SEED.student.id);
  }
});

test("student card summary: balance, latest activity, participations", async ({ page }) => {
  await go(page, `/students/${SEED.student.id}`);
  for (const t of ["יתרה פתוחה", "פעילות אחרונה", "השתתפויות"]) await expect(main(page)).toContainText(t);
  await expect(vis(page.locator("dd a[href*='/sessions/'], dd a[href*='/lessons/']")).first()).toBeVisible();
  await expectNoOverflow(page);
});
