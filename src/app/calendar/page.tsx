import type { Metadata } from "next";
import Link from "next/link";
import { renewSeries } from "@/lib/data/series";
import { requireUser } from "@/lib/supabase/server";
import { getCalendarEvents, getCalendarLegend, getProjects, getSpaces, type CalendarEvent } from "@/lib/data/queries";
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  formatMonth,
  isPlainDate,
  isYearMonth,
  monthRange,
  monthWeeks,
  shiftMonth,
} from "@/lib/calendar";
import { formatDate, todayIso } from "@/lib/format";
import { NEUTRAL_COLOR } from "@/lib/palette";

export const metadata: Metadata = { title: "לוח שנה" };

/**
 * Month view of every lesson and session. ?month=YYYY-MM selects the month,
 * ?day=YYYY-MM-DD the day listed under the grid (both survive back/forward
 * and can be shared). Color is never the only cue: names always accompany it.
 */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { month: monthParam, day: dayParam } = await searchParams;
  // Request-time from here on: requireUser waits for a real request, so "today" is never prerendered.
  const { supabase } = await requireUser();
  const today = todayIso();
  const month = isYearMonth(monthParam) ? monthParam : isPlainDate(dayParam) ? dayParam.slice(0, 7) : today.slice(0, 7);
  const weeks = monthWeeks(month);
  const gridFirst = weeks[0][0].date;
  const gridLast = weeks.at(-1)!.at(-1)!.date;
  const { first } = monthRange(month);
  const selected = isPlainDate(dayParam) && dayParam.slice(0, 7) === month ? dayParam : today.startsWith(month) ? today : first;

  // Weekly slots: fill the next 8 weeks before showing the month (failure must not hide the calendar).
  await renewSeries(supabase)
    .then((r) => r.conflicts.length && console.warn("series renewal skipped conflicting dates", r.conflicts))
    .catch((e) => console.error("series renewal failed", e));
  const [events, legend, spaces, projects] = await Promise.all([
    getCalendarEvents(gridFirst, gridLast),
    getCalendarLegend(),
    getSpaces(),
    getProjects(),
  ]);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const dayEvents = byDay.get(selected) ?? [];
  const studios = spaces.filter((s) => s.kind === "studio");
  const monthLink = (m: string) => `/calendar?month=${m}`;
  const dayLink = (d: string) => `/calendar?month=${d.slice(0, 7)}&day=${d}`;

  return (
    <>
      <h1 className="mb-4">לוח שנה</h1>

      <nav aria-label="מעבר בין חודשים" className="mb-3 flex items-center justify-between gap-2">
        <Link href={monthLink(shiftMonth(month, -1))} className="btn btn-secondary btn-compact" aria-label={`החודש הקודם: ${formatMonth(shiftMonth(month, -1))}`}>
          <span aria-hidden="true">→</span> הקודם
        </Link>
        <h2 aria-live="polite">{formatMonth(month)}</h2>
        <Link href={monthLink(shiftMonth(month, 1))} className="btn btn-secondary btn-compact" aria-label={`החודש הבא: ${formatMonth(shiftMonth(month, 1))}`}>
          הבא <span aria-hidden="true">←</span>
        </Link>
      </nav>
      {!today.startsWith(month) && (
        <p className="mb-3 text-center">
          <Link href={dayLink(today)} className="tap-link text-sm text-brand-strong underline underline-offset-4">
            חזרה להיום
          </Link>
        </p>
      )}

      <table className="calendar mb-8">
        <caption className="visually-hidden">
          {formatMonth(month)}: שיעורים ומפגשים. כל יום הוא קישור לרשימת האירועים שלו.
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map((name, i) => (
              <th key={name} scope="col">
                <abbr title={name} className="no-underline sm:hidden">
                  {WEEKDAYS_SHORT[i]}
                </abbr>
                <span className="max-sm:hidden">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const list = byDay.get(cell.date) ?? [];
                const isSelected = cell.date === selected;
                const isToday = cell.date === today;
                const names = list.map((e) => (e.cancelled ? `${e.label} (מבוטל)` : e.label)).join(", ");
                return (
                  <td key={cell.date} data-out={!cell.inMonth || undefined} data-selected={isSelected || undefined}>
                    <Link
                      href={dayLink(cell.date)}
                      scroll={false}
                      aria-current={isToday ? "date" : undefined}
                      className="calendar-day"
                    >
                      <span className="calendar-num" aria-hidden="true">
                        {cell.day}
                      </span>
                      <span className="visually-hidden">
                        {formatDate(cell.date)}
                        {isToday && ", היום"}
                        {isSelected && ", נבחר"}
                        {list.length > 0 ? `, ${list.length === 1 ? "אירוע אחד" : `${list.length} אירועים`}: ${names}` : ", אין אירועים"}
                      </span>
                      {list.length > 0 && (
                        <span aria-hidden="true" className="calendar-events">
                          {/* Phones: dots + count. Wider: dot + short name per event. */}
                          <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                            {list.slice(0, 3).map((e) => (
                              <span key={e.id} className={`calendar-dot ${e.cancelled ? "opacity-40" : ""}`} style={{ background: e.color }} />
                            ))}
                          </span>
                          <span className="text-xs sm:hidden">{list.length}</span>
                          <span className="hidden w-full min-w-0 flex-col gap-0.5 sm:flex">
                            {list.slice(0, 3).map((e) => (
                              <span key={e.id} className={`calendar-chip ${e.cancelled ? "line-through opacity-60" : ""}`}>
                                <span className="calendar-dot" style={{ background: e.color }} />
                                <span className="min-w-0 truncate">{e.label}</span>
                              </span>
                            ))}
                            {list.length > 3 && <span className="text-xs text-muted">+{list.length - 3}</span>}
                          </span>
                        </span>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-labelledby="day-heading" className="card card-section">
        <h2 id="day-heading" className="mb-3">
          {formatDate(selected)}
        </h2>
        {dayEvents.length === 0 ? (
          <p className="empty-state mb-4">אין שיעורים או מפגשים ביום הזה.</p>
        ) : (
          <ul className="divider-list mb-4" role="list">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className="flex items-center gap-3 py-2 no-underline hover:bg-brand-soft">
                  <span aria-hidden="true" className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${e.cancelled ? "line-through" : ""}`}>{e.label}</span>
                    <span className="text-sm text-muted">
                      {e.kind === "lesson" ? "שיעור" : "מפגש"} · {e.context}
                      {e.cancelled && <span className="font-medium text-danger"> · מבוטל</span>}
                    </span>
                  </span>
                  <time dateTime={`${e.date}T${e.time}`} className="font-medium" dir="ltr">
                    {e.time}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <details className="disclosure">
            <summary>+ שיעור חדש</summary>
            <ul className="grid gap-1 px-4 pb-3" role="list">
              {studios.map((s) => (
                <li key={s.id}>
                  <Link href={`/spaces/${s.id}/lessons/new?date=${selected}`} className="tap-link text-brand-strong underline underline-offset-4">
                    שיעור חדש ב{s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details className="disclosure">
            <summary>+ מפגש חדש</summary>
            {projects.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-muted">אין עדיין פרויקטים.</p>
            ) : (
              <ul className="grid gap-1 px-4 pb-3" role="list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/spaces/private-lessons/projects/${p.id}/sessions/new?date=${selected}`}
                      className="tap-link text-brand-strong underline underline-offset-4"
                    >
                      מפגש חדש: {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      </section>

      <section aria-labelledby="legend-heading" className="card card-section">
        <h2 id="legend-heading" className="mb-3">
          מקרא צבעים
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2" role="list">
          {legend.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span aria-hidden="true" className="calendar-dot size-3!" style={{ background: item.color }} />
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-muted">· {item.context}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="calendar-dot size-3!" style={{ background: NEUTRAL_COLOR }} />
            <span className="font-medium">שיעור בלי קבוצה</span>
          </li>
        </ul>
      </section>
    </>
  );
}
