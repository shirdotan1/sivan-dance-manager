import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ReminderButton } from "@/components/ReminderButton";
import { getOpenPayments, getSpace } from "@/lib/data/queries";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "תשלומים פתוחים" };

/** All unpaid session payments across projects, oldest first, with the total on top. */
export default async function OpenPaymentsPage({ params }: PageProps<"/spaces/[spaceId]/payments">) {
  const { spaceId } = await params;
  const space = await getSpace(spaceId);
  if (!space || space.kind !== "private") notFound();
  const open = await getOpenPayments();
  const total = open.reduce((sum, p) => sum + p.remaining, 0);
  // One group per student (oldest debt first): the reminder gathers all her open debts.
  const byStudent = [...new Set(open.map((p) => p.studentId))].map((id) => {
    const payments = open.filter((p) => p.studentId === id);
    const student = space.students.find((s) => s.id === id) ?? { id, name: payments[0].studentName, phone: "" };
    return { student, payments, owed: payments.reduce((sum, p) => sum + p.remaining, 0) };
  });

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "תשלומים פתוחים" }]} />
      <h1 className="mb-4">תשלומים פתוחים</h1>

      <p className="card card-section flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">סך הכול טרם שולם</span>
        <span className="text-2xl font-extrabold text-brand-strong">{formatCurrency(total)}</span>
        <span className="basis-full text-sm text-muted">
          {open.length === 0 ? "אין תשלומים פתוחים." : `${open.length} תשלומים ב-${new Set(open.map((p) => p.sessionId)).size} מפגשים`}
        </span>
      </p>

      {open.length === 0 ? (
        <p className="empty-state">כל המפגשים שולמו במלואם. ✓</p>
      ) : (
        <div className="grid gap-6">
          {byStudent.map(({ student, payments, owed }) => (
            <section key={student.id} aria-labelledby={`debt-${student.id}`} className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 id={`debt-${student.id}`} className="text-lg">
                  <Link href={`/students/${student.id}`} className="underline-offset-4 hover:underline">
                    {student.name}
                  </Link>{" "}
                  <span className="font-normal text-muted">· {formatCurrency(owed)}</span>
                </h2>
                <ReminderButton
                  studentId={student.id}
                  studentName={student.name}
                  phone={student.phone}
                  parentName={student.parentName}
                  parentPhone={student.parentPhone}
                  lines={payments.map((p) => ({ projectName: p.projectName, date: p.date, amount: p.remaining }))}
                />
              </div>
              <ul className="grid gap-3" role="list">
                {payments.map((p) => (
                  <li key={`${p.sessionId}-${p.studentId}`}>
                    <Link
                      href={`/spaces/${space.id}/projects/${p.projectId}/sessions/${p.sessionId}`}
                      className="card card-link flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: p.projectColor }} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{p.projectName}</span>
                          <span className="text-sm text-muted">
                            <time dateTime={p.date}>{formatDate(p.date)}</time>
                          </span>
                        </span>
                      </span>
                      <span className="font-bold">
                        <span className="visually-hidden">נותר לתשלום: </span>
                        {formatCurrency(p.remaining)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
