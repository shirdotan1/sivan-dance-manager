import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowInIsrael, tookPlace } from "@/lib/lessonTime";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StudentEditForm } from "@/components/StudentEditForm";
import { getStudentCard } from "@/lib/data/queries";
import { formatCurrency, formatDate } from "@/lib/format";

type Props = PageProps<"/students/[studentId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getStudentCard((await params).studentId);
  return { title: card?.student.name ?? "תלמידה לא נמצאה" };
}

/** Student card: groups, participation history and (private space) payment status. */
export default async function StudentPage({ params }: Props) {
  const card = await getStudentCard((await params).studentId);
  if (!card) notFound();
  const { student, groups, lessons, sessions, projects } = card;
  const withPayment = sessions.filter((s) => s.payment);
  const paid = withPayment.filter((s) => s.payment!.paid);
  const owed = withPayment.filter((s) => !s.payment!.paid).reduce((sum, s) => sum + s.payment!.amount, 0);
  const paidSum = paid.reduce((sum, s) => sum + s.payment!.amount, 0);
  // The shared rule (src/lib/lessonTime.ts): only what already took place
  // counts — not future lessons, not cancelled ones (sessions can't be cancelled).
  const now = nowInIsrael();
  const heldLessons = lessons.filter((l) => tookPlace(l, now));
  const heldSessions = sessions.filter((se) => tookPlace(se, now));
  // Most recent participation that took place (each list is newest first).
  const latest = [
    ...heldLessons.slice(0, 1).map((l) => ({ ...l, label: l.groupName ? `שיעור · ${l.groupName}` : "שיעור" })),
    ...heldSessions.slice(0, 1).map((se) => ({ ...se, label: `מפגש · ${se.projectName}` })),
  ].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0];
  const totalActivity = heldLessons.length + heldSessions.length;

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

      {/* At a glance: balance (private) and the latest activity, above the details. */}
      <section aria-labelledby="summary-h" className="card card-section">
        <h2 id="summary-h" className="visually-hidden">
          תקציר
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {student.spaceKind === "private" && (
            <div>
              <dt className="text-sm text-muted">יתרה פתוחה</dt>
              <dd className={`text-2xl font-extrabold ${owed > 0 ? "text-danger" : "text-success"}`}>
                {owed > 0 ? formatCurrency(owed) : "✓ אין חוב"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted">פעילות אחרונה</dt>
            <dd>
              {latest ? (
                <Link href={latest.href} className="tap-link font-semibold text-brand-strong underline underline-offset-4">
                  {formatDate(latest.date)}
                </Link>
              ) : (
                <span className="font-semibold">עדיין אין</span>
              )}
              {latest && <span className="block text-sm text-muted">{latest.label}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">השתתפויות</dt>
            <dd className="font-semibold">{totalActivity}</dd>
          </div>
        </dl>
      </section>

      {student.spaceKind === "studio" ? (
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
            מצב תשלום
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">שולם</dt>
            <dd className="font-semibold">
              {formatCurrency(paidSum)} · {paid.length} מתוך {withPayment.length} מפגשים
            </dd>
            <dt className="text-muted">טרם שולם</dt>
            <dd className={`font-semibold ${owed > 0 ? "text-danger" : "text-success"}`}>
              {owed > 0 ? formatCurrency(owed) : "✓ אין חוב"}
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
        </section>
      )}

      <section aria-labelledby="history-h" className="card card-section">
        <h2 id="history-h" className="mb-3">
          היסטוריית השתתפות ({lessons.length + sessions.length})
        </h2>
        {lessons.length + sessions.length === 0 ? (
          <p className="empty-state">עדיין לא השתתפה בשיעורים או במפגשים.</p>
        ) : (
          <ul className="divider-list" role="list">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link href={l.href} className="flex items-center gap-3 py-2 no-underline hover:bg-brand-soft">
                  <span aria-hidden="true" className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{formatDate(l.date)}</span>
                    <span className="text-sm text-muted">שיעור{l.groupName ? ` · ${l.groupName}` : ""}</span>
                  </span>
                  <time dateTime={`${l.date}T${l.time}`} dir="ltr">
                    {l.time}
                  </time>
                </Link>
              </li>
            ))}
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="flex items-center gap-3 py-2 no-underline hover:bg-brand-soft">
                  <span aria-hidden="true" className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{formatDate(s.date)}</span>
                    <span className="text-sm text-muted">מפגש · {s.projectName}</span>
                  </span>
                  {s.payment && (
                    <span className={`text-sm font-medium ${s.payment.paid ? "text-success" : "text-danger"}`}>
                      {s.payment.paid ? "✓" : "✗"} {formatCurrency(s.payment.amount)}
                      <span className="visually-hidden">{s.payment.paid ? " שולם" : " טרם שולם"}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
