import { addDays } from "@/lib/format";
import { hasStarted, tookPlace, type Moment } from "@/lib/lessonTime";

/**
 * The student view (history and summaries), computed from participation
 * records with the shared counting rule (src/lib/lessonTime.ts) — no second
 * rule. A record is one lesson or session a student is on:
 *  - lessons: lesson_participants — Sivan updates each list after the lesson
 *    to who actually came, so held lessons are lessons she attended;
 *  - sessions: session_payments — who was in the project when the session was
 *    saved ("sessions in the project", not attendance; PM ruling 25.11).
 * Sessions can't be cancelled. Pure functions: no I/O, `now` is passed in.
 */

export type Participation = Moment & {
  /** The lesson's or session's id. */
  eventId: string;
  kind: "lesson" | "session";
  cancelled?: boolean;
  /** Breakdown key: the lesson's group (studios) or the session's project (private); none for a lesson without a group. */
  bucketId?: string;
  bucketName?: string;
};

/** Held: started (Israel) and not cancelled — the shared rule. */
export const isHeld = (p: Participation, now: Moment) => tookPlace(p, now);
/** Upcoming: not started yet and not cancelled. */
export const isUpcoming = (p: Participation, now: Moment) => !p.cancelled && !hasStarted(p, now);

const key = (p: Moment) => `${p.date} ${p.time.slice(0, 5)}`;
const newestFirst = (a: Moment, b: Moment) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0);
const soonestFirst = (a: Moment, b: Moment) => -newestFirst(a, b);

/** The calendar month (YYYY-MM) of a date. */
export const monthOf = (date: string) => date.slice(0, 7);

export type StudentSummary<P extends Participation = Participation> = {
  held: number;
  heldThisMonth: number;
  /** Held per group/project, most first; lessons without a group are one bucket. */
  breakdown: { bucketId: string | null; bucketName: string | null; held: number }[];
  lastHeld?: P;
  nextUp?: P;
  /** Not started yet (cancelled ones included, marked), soonest first. */
  upcoming: P[];
  /** Started (held and cancelled), newest first. */
  past: P[];
};

export function summarizeStudent<P extends Participation>(records: P[], now: Moment): StudentSummary<P> {
  const held = records.filter((r) => isHeld(r, now)).sort(newestFirst);
  const buckets = new Map<string | null, { bucketId: string | null; bucketName: string | null; held: number }>();
  for (const r of held) {
    const id = r.bucketId ?? null;
    const b = buckets.get(id) ?? { bucketId: id, bucketName: r.bucketName ?? null, held: 0 };
    b.held++;
    buckets.set(id, b);
  }
  const upcoming = records.filter((r) => !hasStarted(r, now)).sort(soonestFirst);
  return {
    held: held.length,
    heldThisMonth: held.filter((r) => monthOf(r.date) === monthOf(now.date)).length,
    breakdown: [...buckets.values()].sort((a, b) => b.held - a.held || (a.bucketName ?? "").localeCompare(b.bucketName ?? "", "he")),
    lastHeld: held[0],
    nextUp: upcoming.find((r) => !r.cancelled),
    upcoming,
    past: records.filter((r) => hasStarted(r, now)).sort(newestFirst),
  };
}

export const RADAR_DAYS = 28;

export type RadarStudent = { id: string; name: string; archived?: boolean };

/**
 * "Off the radar": active (not archived) students with at least one held
 * lesson/session, none of them in the last 28 days (from now, same rule).
 * Longest gone first.
 */
export function offTheRadar<S extends RadarStudent>(
  students: S[],
  recordsByStudent: Map<string, Participation[]>,
  now: Moment,
): { student: S; lastHeld: Participation }[] {
  const windowStart: Moment = { date: addDays(now.date, -RADAR_DAYS), time: now.time };
  const out: { student: S; lastHeld: Participation }[] = [];
  for (const s of students) {
    if (s.archived) continue;
    const held = (recordsByStudent.get(s.id) ?? []).filter((r) => isHeld(r, now)).sort(newestFirst);
    if (!held.length) continue; // no prior history: new, not gone
    if (key(held[0]) < key(windowStart)) out.push({ student: s, lastHeld: held[0] }); // last one began before the window
  }
  return out.sort((a, b) => soonestFirst(a.lastHeld, b.lastHeld) || a.student.name.localeCompare(b.student.name, "he"));
}

export type MonthSummary<S extends RadarStudent> = {
  month: string;
  /** Lessons (studio) or sessions (private) held in the space that month. */
  eventsHeld: number;
  /** Students on at least one of them (archived included, marked by the page). */
  rows: { student: S; held: number }[];
};

/**
 * One month of a space: events held (the shared rule) and, per student, how
 * many of them she was on — most first, then by name.
 */
export function monthSummary<S extends RadarStudent>(
  month: string,
  events: (Moment & { id: string; cancelled?: boolean })[],
  students: S[],
  recordsByStudent: Map<string, Participation[]>,
  now: Moment,
): MonthSummary<S> {
  const inMonth = (m: Moment & { cancelled?: boolean }) => monthOf(m.date) === month && tookPlace(m, now);
  const rows = students
    .map((student) => ({ student, held: new Set((recordsByStudent.get(student.id) ?? []).filter(inMonth).map((r) => r.eventId)).size }))
    .filter((r) => r.held > 0)
    .sort((a, b) => b.held - a.held || a.student.name.localeCompare(b.student.name, "he"));
  return { month, eventsHeld: events.filter(inMonth).length, rows };
}

/** Payments of one student — the same rows and the same "open" filter as the open-payments page. */
export type PaymentRow = { sessionId: string; amount: number; paid: boolean };
export const isOpenPayment = (p: PaymentRow) => !p.paid && p.amount > 0;

export function paymentSummary(rows: PaymentRow[]) {
  const paid = rows.filter((r) => r.paid);
  const open = rows.filter(isOpenPayment);
  return {
    sessions: new Set(rows.map((r) => r.sessionId)).size,
    paidCount: paid.length,
    paidSum: paid.reduce((s, r) => s + r.amount, 0),
    openCount: open.length,
    openSum: open.reduce((s, r) => s + r.amount, 0),
  };
}
