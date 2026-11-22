import type { Page } from "@playwright/test";
import { reminderMessage, whatsappLink } from "../src/lib/reminders";
import { TAG, db } from "./support/env";
import { expect, go, test, vis } from "./support/fixtures";

/** Stage 5.6: WhatsApp reminders — one per student, confirmed recipient, encoded message. */

test("the wa.me link encodes Hebrew, spaces, punctuation and new lines exactly", ({}, info) => {
  test.skip(info.project.name !== "phone-390", "no browser involved: once is enough");
  const message = "היי נועה, תזכורת: ?&#+% \"מירכאות\" — 200 ₪\nשורה שנייה";
  const link = whatsappLink("972501234567", message);
  expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
  expect(link).not.toContain(" ");
  expect(link).toContain("%0A"); // the new line
  expect(link).toContain("%3F%26%23%2B%25"); // ?&#+%
  expect(new URL(link).searchParams.get("text")).toBe(message); // decodes back exactly
});

test("one message gathers every open debt (sorted, totalled); ₪0 lines are left out; a parent version", ({}, info) => {
  test.skip(info.project.name !== "phone-390", "no browser involved: once is enough");
  const lines = [
    { projectName: "סולו", date: "2026-12-10", amount: 200 },
    { projectName: "דואט", date: "2026-12-03", amount: 150 },
    { projectName: "סולו", date: "2026-12-17", amount: 0 },
  ];
  const toStudent = reminderMessage({ to: "student", studentName: "נועה כהן", lines });
  expect(toStudent.split("\n")).toEqual([
    "היי נועה, תזכורת קטנה לגבי התשלום על המפגשים:",
    "• דואט — 3.12 — 150 ₪",
    "• סולו — 10.12 — 200 ₪",
    "סה״כ לתשלום: 350 ₪",
    "תודה, סיון",
  ]);
  const toParent = reminderMessage({ to: "parent", studentName: "נועה כהן", parentName: "דנה כהן", lines });
  expect(toParent.split("\n")[0]).toBe("היי דנה, תזכורת קטנה לגבי התשלום על המפגשים של נועה:");
});

/** A student with two unpaid sessions (150 + 200), a paid one and an unpaid ₪0. */
async function studentWithDebts(label: string, phones: { phone: string; parentName?: string; parentPhone?: string }) {
  const sb = await db();
  const { data: st, error } = await sb
    .from("students")
    .insert({ space_id: "private-lessons", name: `${TAG} ${label}`, phone: phones.phone, parent_name: phones.parentName ?? "", parent_phone: phones.parentPhone ?? "" })
    .select("id,name")
    .single();
  if (error) throw error;
  const { data: pr } = await sb.from("projects").insert({ space_id: "private-lessons", name: `${TAG} חוב ${label}`, type: "solo", color: "#7a2048" }).select("id,name").single();
  await sb.from("project_participants").insert({ project_id: pr!.id, student_id: st.id });
  const sessions = [
    { date: "2026-12-03", amount: 150, paid: false },
    { date: "2026-12-10", amount: 200, paid: false },
    { date: "2026-12-17", amount: 120, paid: true },
    { date: "2026-12-24", amount: 0, paid: false },
  ];
  for (const s of sessions) {
    const { data: se } = await sb.from("sessions").insert({ project_id: pr!.id, date: s.date, time: "17:00", notes: `${TAG} חוב` }).select("id").single();
    const { error: pe } = await sb.from("session_payments").insert({ session_id: se!.id, student_id: st.id, amount: s.amount, paid: s.paid });
    if (pe) throw pe;
  }
  return { student: st as { id: string; name: string }, project: pr!.name as string };
}
async function openReminder(page: Page, studentName: string) {
  await go(page, "/spaces/private-lessons/payments");
  const section = vis(page.getByRole("region", { name: new RegExp(studentName) }));
  await expect(section).toContainText("350");
  await expect(section.getByRole("listitem")).toHaveCount(2); // the two debts (open payments never list a ₪0 one)
  await section.getByRole("button", { name: /תזכורת בוואטסאפ/ }).click();
  return page.getByRole("dialog", { name: `תזכורת לתשלום — ${studentName}` });
}

test("two valid numbers: no link until an explicit choice; the parent's link carries exactly the message", async ({ page }, info) => {
  const { student, project } = await studentWithDebts(`שני-מספרים ${info.project.name}`, { phone: "050-111-2222", parentName: "דנה כהן", parentPhone: "052-765-4321" });
  const dialog = await openReminder(page, student.name);
  await expect(dialog.getByRole("link", { name: "פתיחה בוואטסאפ" })).toHaveCount(0);
  await expect(dialog).toContainText("יש לבחור למי לשלוח");
  await dialog.getByRole("radio", { name: /ההורה: דנה כהן/ }).check();
  await expect(dialog.getByRole("status")).toContainText("נמען: דנה כהן (ההורה) · +972 52-765-4321");
  const href = (await dialog.getByRole("link", { name: "פתיחה בוואטסאפ" }).getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/972527654321?text=")).toBe(true);
  const expected = reminderMessage({
    to: "parent",
    studentName: student.name,
    parentName: "דנה כהן",
    lines: [
      { projectName: project, date: "2026-12-03", amount: 150 },
      { projectName: project, date: "2026-12-10", amount: 200 },
    ],
  });
  expect(new URL(href).searchParams.get("text")).toBe(expected);
  await expect(dialog.getByRole("link", { name: "פתיחה בוואטסאפ" })).toHaveAttribute("target", "_blank");
});

test("only the student's number is valid: the parent's is explained, the link goes to the student", async ({ page }, info) => {
  const { student } = await studentWithDebts(`הורה-שגוי ${info.project.name}`, { phone: "+44 20 7946 0958", parentName: "אבי", parentPhone: "12345" });
  const dialog = await openReminder(page, student.name);
  await expect(dialog).toContainText("ההורה (אבי): המספר ״12345״ חסר קידומת");
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toContainText("(התלמידה) · +442079460958");
  expect(await dialog.getByRole("link", { name: "פתיחה בוואטסאפ" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/442079460958\?text=/);
});

test("no number WhatsApp can open: explained, no link", async ({ page }, info) => {
  const { student } = await studentWithDebts(`בלי-מספר ${info.project.name}`, { phone: "" });
  const dialog = await openReminder(page, student.name);
  await expect(dialog).toContainText("אין מספר שוואטסאפ יכול לפתוח");
  await expect(dialog.getByRole("link", { name: "פתיחה בוואטסאפ" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "לתיקון בכרטיס התלמידה" })).toHaveAttribute("href", `/students/${student.id}`);
});

test("the student card has the reminder too, with the same message", async ({ page }, info) => {
  const { student, project } = await studentWithDebts(`כרטיס ${info.project.name}`, { phone: "050-333-4444" });
  await go(page, `/students/${student.id}`);
  await vis(page.getByRole("button", { name: /תזכורת בוואטסאפ/ })).click();
  const dialog = page.getByRole("dialog", { name: `תזכורת לתשלום — ${student.name}` });
  const href = (await dialog.getByRole("link", { name: "פתיחה בוואטסאפ" }).getAttribute("href"))!;
  expect(new URL(href).searchParams.get("text")).toBe(
    reminderMessage({ to: "student", studentName: student.name, lines: [{ projectName: project, date: "2026-12-03", amount: 150 }, { projectName: project, date: "2026-12-10", amount: 200 }] }),
  );
});
