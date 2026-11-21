import { SEED, TAG, db } from "./support/env";
import { expect, expectNoOverflow, go, main, test, vis } from "./support/fixtures";

const sessionUrl = `/spaces/private-lessons/projects/${SEED.project}/sessions/${SEED.session}`;

test("'עריכת משתתפות' on a session opens the project edit form at participants", async ({ page }) => {
  await go(page, sessionUrl);
  await vis(page.getByRole("link", { name: /עריכת משתתפות/ })).click();
  await page.waitForURL(new RegExp(`/projects/${SEED.project}/edit#participants$`));
  await page.waitForFunction(() => document.activeElement?.id === "participants");
});

test("payment switch shows ✓ נשמר and persists both ways", async ({ page }) => {
  const sb = await db();
  const paid = async () =>
    (await sb.from("session_payments").select("paid").eq("session_id", SEED.session).eq("student_id", SEED.student.id).single()).data!.paid;
  const before = await paid();
  await go(page, sessionUrl);
  const sw = vis(page.getByRole("switch", { name: new RegExp(SEED.student.name) }));
  await sw.click();
  await expect(vis(page.getByText("✓ נשמר"))).toBeVisible();
  await expect.poll(paid).toBe(!before);
  await sw.click();
  await expect.poll(paid).toBe(before);
  await expectNoOverflow(page);
});

test("FINAL-3: a ₪0 unpaid session is never 'שולם במלואו'", async ({ page }, info) => {
  const sb = await db();
  const { data: s, error } = await sb
    .from("sessions")
    .insert({ project_id: SEED.project, date: "2026-12-31", time: "10:00", notes: `${TAG} אפס ${info.project.name}` })
    .select("id")
    .single();
  if (error) throw error;
  const pe = await sb.from("session_payments").insert({ session_id: s.id, student_id: SEED.student.id, amount: 0, paid: false });
  if (pe.error) throw pe.error;
  await go(page, `/spaces/private-lessons/projects/${SEED.project}`);
  const row = vis(page.locator(`a[href$="/sessions/${s.id}"]`));
  await expect(row).not.toContainText("שולם במלואו");
  await expect(row).toContainText("טרם סומנו");
  await go(page, `/spaces/private-lessons/projects/${SEED.project}/sessions/${s.id}`);
  await expect(main(page)).not.toContainText("שולם במלואו");
  await expect(main(page)).toContainText("טרם שולם");
});
