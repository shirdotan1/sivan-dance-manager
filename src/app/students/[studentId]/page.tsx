import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isOpenPayment, paymentSummary, summarizeStudent, type Participation } from "@/lib/attendance";
import { nowInIsrael } from "@/lib/lessonTime";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ReminderButton } from "@/components/ReminderButton";
import { StudentEditForm } from "@/components/StudentEditForm";
import { getStudentCard } from "@/lib/data/queries";
import { formatCurrency, formatDate } from "@/lib/format";

type Props = PageProps<"/students/[studentId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getStudentCard((await params).studentId);
  return { title: card?.student.name ?? "תלמידה לא נמצאה" };
}

/**
 * Student card: who she is, her numbers at a glance (held, this month, by
 * group/project, last and next), (private) payments, and her history —
 * upcoming apart, then newest first, cancelled marked and never counted.
 * Counting: the shared rule via src/lib/attendance.ts.
 */
export default async function StudentPage({ params }: Props) {
  const card = await getStudentCard((await params).studentId);
  if (!card) notFound();
  const { student, groups, lessons, sessions, projects } = card;
  const isPrivate = student.spaceKind === "private";
  const records: Row[] = [
    ...lessons.map((l) => ({
      eventId: l.id,
      kind: "lesson" as const,
      date: l.date,
      time: l.time,
      ...(l.cancelled ? { cancelled: true } : {}),
      ...(l.groupId ? { bucketId: l.groupId, bucketName: l.groupName ?? "" } : {}),
      href: l.href,
      color: l.color,
      label: `שיעור${l.groupName ? ` · ${l.groupName}` : ""}`,
    })),
    ...sessions.map((s) => ({
      eventId: s.id,
      kind: "session" as const,
      date: s.date,
      time: s.time,
      bucketId: s.projectId,
      bucketName: s.projectName,
      href: s.href,
      color: s.color,
      label: `מפגש · ${s.projectName}`,
      payment: s.payment,
    })),
  ];
  const now = nowInIsrael();
  const sum = summarizeStudent(records, now);
  // Payments: her session_payments rows, "open" exactly as on the open-payments page.
  const pay = paymentSummary(sessions.map((s) => ({ sessionId: s.id, ...s.payment })));
  const openLines = sessions
    .filter((s) => isOpenPayment({ sessionId: s.id, ...s.payment }))
    .map((s) => ({ projectName: s.projectName, date: s.date, amount: s.payment.amount }));
  const word = isPrivate ? { many: "מפגשים בפרויקט", one: "מפגש", last: "מפגש אחרון" } : { many: "שיעורים שהייתה בהם", one: "שיעור", last: "שיעור אחרון" };

  return (
    <>
      <Breadcrumbs items={[{ label: student.spaceName, href: `/spaces/${student.spaceId}` }, { label: student.name }]} />
      <h1 className="mb-2">{student.name}</h1>
      <p className="mb-6 flex flex-wrap items-center gap-x-3 text-muted">
        <span>{student.spaceName}</span>
        {student.phone && (
          <a href={`tel:${student.phone.replaceAll("-", "")}`} dir="ltr" className="tap-link text-brand-strong underline underline-offset-4">
            {student.phone}
          </a>
        )}
        {student.archived && <span className="chip">הוסרה מהמאגר — ההיסטוריה נשמרת</span>}
      </p>
      {(student.parentName || student.parentPhone) && (
        <p className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 text-muted">
          <span>
            הורה{student.parentName ? `: ${student.parentName}` : ""}
          </span>
          {student.parentPhone && (
            <a href={`tel:${student.parentPhone.replace(/[\s\-().\/]/g, "")}`} dir="ltr" className="tap-link text-brand-strong underline underline-offset-4">
              {student.parentPhone}
            </a>
          )}
        </p>
      )}

      <details className="disclosure mb-6">
        <summary>עריכת פרטים</summary>
        <StudentEditForm student={student} />
      </details>

      {/* At a glance: her numbers (and, private, the open balance), above the details. */}
      <section aria-labelledby="summary-h" className="card card-section">
        <h2 id="summary-h" className="mb-3">
          במבט אחד
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">{word.many}</dt>
            <dd className="text-2xl font-extrabold">{sum.held}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">החודש</dt>
            <dd className="text-2xl font-extrabold">{sum.heldThisMonth}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{word.last}</dt>
            <dd>
              {sum.lastHeld ? (
                <Link href={sum.lastHeld.href} className="tap-link font-semibold text-brand-strong underline underline-offset-4">
                  {formatDate(sum.lastHeld.date)}
                </Link>
              ) : (
                <span className="font-semibold">עדיין אין</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">הבא בתור</dt>
            <dd>
              {sum.nextUp ? (
                <Link href={sum.nextUp.href} className="tap-link font-semibold text-brand-strong underline underline-offset-4">
                  {formatDate(sum.nextUp.date)}
                </Link>
              ) : (
                <span className="font-semibold">אין {word.one} מתוכנן</span>
              )}
            </dd>
          </div>
        </dl>
        {sum.breakdown.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-base font-semibold">{isPrivate ? "לפי פרויקט" : "לפי קבוצה"}</h3>
            <ul className="grid gap-1" role="list">
              {sum.breakdown.map((b) => (
                <li key={b.bucketId ?? "none"} className="flex justify-between gap-3">
                  <span>{b.bucketName ?? "בלי קבוצה"}</span>
                  <span className="font-semibold">{b.held}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!isPrivate ? (
        <section aria-labelledby="groups-h" className="card card-section">
          <h2 id="groups-h" className="mb-3">
            קבוצות ({groups.length})
          </h2>
          {groups.length === 0 ? (
            <p className="empty-state">לא משויכת לקבוצה.</p>
          ) : (
            <ul className="flex flex-wrap gap-2" role="list">
              {groups.map((g) => (
                <li key={g.id} className="chip flex items-center gap-1.5">
                  <span aria-hidden="true" className="calendar-dot" style={{ background: g.color }} />
                  {g.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section aria-labelledby="pay-h" className="card card-section">
          <h2 id="pay-h" className="mb-3">
            תשלומים
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">מפגשים</dt>
            <dd className="font-semibold">{pay.sessions}</dd>
            <dt className="text-muted">שולם</dt>
            <dd className="font-semibold">
              {formatCurrency(pay.paidSum)} · {pay.paidCount} מפגשים
            </dd>
            <dt className="text-muted">פתוח</dt>
            <dd className={`font-semibold ${pay.openSum > 0 ? "text-danger" : "text-success"}`}>
              {pay.openSum > 0 ? `${formatCurrency(pay.openSum)} · ${pay.openCount} מפגשים` : "✓ אין חוב"}
            </dd>
            <dt className="text-muted">פרויקטים</dt>
            <dd>
              {projects.length === 0
                ? "—"
                : projects.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/spaces/private-lessons/projects/${p.id}`} className="text-brand-strong underline underline-offset-4">
                        {p.name}
                      </Link>
                    </span>
                  ))}
            </dd>
          </dl>
          {pay.openSum > 0 && (
            <div className="mt-3">
              <ReminderButton
                studentId={student.id}
                studentName={student.name}
                phone={student.phone}
                parentName={student.parentName}
                parentPhone={student.parentPhone}
                lines={openLines}
              />
            </div>
          )}
        </section>
      )}

      {sum.upcoming.length > 0 && (
        <section aria-labelledby="upcoming-h" className="card card-section">
          <h2 id="upcoming-h" className="mb-3">
            קרובים ({sum.upcoming.length})
          </h2>
          <HistoryList rows={sum.upcoming} />
        </section>
      )}

      <section aria-labelledby="history-h" className="card card-section">
        <h2 id="history-h" className="mb-3">
          היסטוריה ({sum.past.length})
        </h2>
        {sum.past.length === 0 ? (
          <p className="empty-state">{isPrivate ? "עדיין אין מפגשים שהתקיימו." : "עדיין לא השתתפה בשיעורים שהתקיימו."}</p>
        ) : (
          <HistoryList rows={sum.past} />
        )}
      </section>
    </>
  );
}

type Row = Participation & { href: string; color: string; label: string; payment?: { amount: number; paid: boolean } };

function HistoryList({ rows }: { rows: Row[] }) {
  return (
    <ul className="divider-list" role="list">
      {rows.map((r) => (
        <li key={r.eventId}>
          <Link href={r.href} className="flex items-center gap-3 py-2 no-underline hover:bg-brand-soft">
            <span aria-hidden="true" className={`h-9 w-1.5 shrink-0 rounded-full ${r.cancelled ? "opacity-40" : ""}`} style={{ background: r.color }} />
            <span className="min-w-0 flex-1">
              <span className={`block font-medium ${r.cancelled ? "line-through" : ""}`}>{formatDate(r.date)}</span>
              <span className="text-sm text-muted">
                {r.label}
                {r.cancelled && <span className="font-medium text-danger"> · מבוטל</span>}
              </span>
            </span>
            {r.payment && (
              <span className={`text-sm font-medium ${r.payment.paid ? "text-success" : "text-danger"}`}>
                {r.payment.paid ? "✓" : "✗"} {formatCurrency(r.payment.amount)}
                <span className="visually-hidden">{r.payment.paid ? " שולם" : " טרם שולם"}</span>
              </span>
            )}
            <time dateTime={`${r.date}T${r.time}`} dir="ltr">
              {r.time}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
