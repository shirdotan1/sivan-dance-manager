import { nowTimeIsrael, todayIso } from "@/lib/format";

/**
 * One counting rule for every surface (home cards, space page, student card):
 * a lesson counts once its start — date and time, Asia/Jerusalem — has
 * passed and it isn't cancelled. Future envelopes and cancelled lessons
 * never count; a lesson later today doesn't count yet.
 */
export type Moment = { date: string; time: string };

/** Now in Israel (call at request time). */
export const nowInIsrael = (): Moment => ({ date: todayIso(), time: nowTimeIsrael() });

/** The start (date + HH:MM) has passed. */
export const hasStarted = (l: Moment, now: Moment) => l.date < now.date || (l.date === now.date && l.time.slice(0, 5) <= now.time);

/** Counts as a lesson that took place. */
export const tookPlace = (l: Moment & { cancelled?: boolean }, now: Moment) => !l.cancelled && hasStarted(l, now);
