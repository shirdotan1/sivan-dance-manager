import Link from "next/link";
import { offTheRadar, RADAR_DAYS } from "@/lib/attendance";
import { getSpaceAttendance } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";
import { nowInIsrael } from "@/lib/lessonTime";
import type { Space } from "@/lib/types";

/**
 * On each space page: the month summary link and "off the radar" — active
 * students with history who were on nothing held in the last 28 days, so
 * Sivan notices and reaches out herself. Nothing is sent to anyone.
 */
export async function SpaceOverview({ space }: { space: Space }) {
  const { recordsByStudent } = await getSpaceAttendance(space);
  const gone = offTheRadar(space.students, recordsByStudent, nowInIsrael());
  const what = space.kind === "private" ? "מפגש" : "שיעור";

  return (
    <section aria-labelledby="radar-heading" className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="radar-heading">נעלמו מהרדאר ({gone.length})</h2>
        <Link href={`/spaces/${space.id}/summary`} className="btn btn-secondary btn-compact">
          סיכום חודשי
        </Link>
      </div>
      <p className="mb-3 text-sm text-muted">
        תלמידות פעילות שהיו בעבר, ולא היו באף {what} שהתקיים ב־{RADAR_DAYS} הימים האחרונים.
      </p>
      {gone.length === 0 ? (
        <p className="empty-state">כולן היו לפחות פעם אחת בארבעת השבועות האחרונים. ✓</p>
      ) : (
        <ul className="card divider-list py-1" role="list">
          {gone.map(({ student, lastHeld }) => (
            <li key={student.id}>
              <Link href={`/students/${student.id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 px-1 py-2 no-underline hover:bg-brand-soft">
                <span className="font-medium text-brand-strong underline underline-offset-4">{student.name}</span>
                <span className="text-sm text-muted">
                  {what} אחרון: {formatDate(lastHeld.date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
