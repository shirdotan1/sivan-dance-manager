import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { monthSummary } from "@/lib/attendance";
import { formatMonth, isYearMonth, shiftMonth } from "@/lib/calendar";
import { getSpace, getSpaceAttendance } from "@/lib/data/queries";
import { nowInIsrael } from "@/lib/lessonTime";

export const metadata: Metadata = { title: "סיכום חודשי" };

/**
 * One month of a space (?month=YYYY-MM, default this month): how many lessons
 * (studio) or sessions (private) were held, how many students were on at
 * least one, and per student her count that month — most first. No charts.
 * Archived students who were there that month are listed, marked.
 */
export default async function SpaceSummaryPage({ params, searchParams }: PageProps<"/spaces/[spaceId]/summary">) {
  const [{ spaceId }, { month: monthParam }] = await Promise.all([params, searchParams]);
  const space = await getSpace(spaceId); // request-time from here on (requireUser)
  if (!space) notFound();
  const now = nowInIsrael();
  const thisMonth = now.date.slice(0, 7);
  const month = isYearMonth(monthParam) ? monthParam : thisMonth;
  const { events, recordsByStudent } = await getSpaceAttendance(space);
  const summary = monthSummary(month, events, space.students, recordsByStudent, now);
  const isPrivate = space.kind === "private";
  const what = isPrivate ? { many: "מפגשים", held: "מפגשים התקיימו" } : { many: "שיעורים", held: "שיעורים התקיימו" };
  const link = (m: string) => `/spaces/${space.id}/summary?month=${m}`;

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "סיכום חודשי" }]} />
      <h1 className="mb-4">סיכום חודשי</h1>

      <nav aria-label="מעבר בין חודשים" className="mb-3 flex items-center justify-between gap-2">
        <Link href={link(shiftMonth(month, -1))} className="btn btn-secondary btn-compact" aria-label={`החודש הקודם: ${formatMonth(shiftMonth(month, -1))}`}>
          <span aria-hidden="true">→</span> הקודם
        </Link>
        <h2 aria-live="polite">{formatMonth(month)}</h2>
        <Link href={link(shiftMonth(month, 1))} className="btn btn-secondary btn-compact" aria-label={`החודש הבא: ${formatMonth(shiftMonth(month, 1))}`}>
          הבא <span aria-hidden="true">←</span>
        </Link>
      </nav>
      {month !== thisMonth && (
        <p className="mb-3 text-center">
          <Link href={link(thisMonth)} className="tap-link text-sm text-brand-strong underline underline-offset-4">
            חזרה לחודש הנוכחי
          </Link>
        </p>
      )}

      <dl className="card card-section grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-muted">{what.held}</dt>
          <dd className="text-2xl font-extrabold">{summary.eventsHeld}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">תלמידות שהשתתפו</dt>
          <dd className="text-2xl font-extrabold">{summary.rows.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="per-student-h" className="card card-section">
        <h2 id="per-student-h" className="mb-3">
          לפי תלמידה
        </h2>
        {summary.rows.length === 0 ? (
          <p className="empty-state">אין {what.many} שהתקיימו בחודש הזה.</p>
        ) : (
          <table className="w-full">
            <caption className="visually-hidden">
              {formatMonth(month)}: {isPrivate ? "מפגשים בפרויקט" : "שיעורים שהייתה בהם"}, לכל תלמידה
            </caption>
            <thead>
              <tr className="text-sm text-muted">
                <th scope="col" className="py-1 text-start font-medium">
                  תלמידה
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {isPrivate ? "מפגשים בפרויקט" : "שיעורים שהייתה בהם"}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map(({ student, held }) => (
                <tr key={student.id} className="border-t border-border">
                  <th scope="row" className="py-2 text-start font-normal">
                    <Link href={`/students/${student.id}`} className="tap-link text-brand-strong underline underline-offset-4">
                      {student.name}
                    </Link>
                    {student.archived && <span className="ms-2 text-sm text-muted">(הוסרה מהמאגר)</span>}
                  </th>
                  <td className="py-2 text-end font-semibold">{held}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
