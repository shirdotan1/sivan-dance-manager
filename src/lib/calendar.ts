/**
 * Calendar math on plain dates ("YYYY-MM-DD" / "YYYY-MM"), with no Date
 * objects and therefore no time-zone drift: weekday, month length and
 * month navigation are pure arithmetic. (Temporal.PlainDate would be the
 * native fit, but it isn't available in Node 24; this avoids a polyfill.)
 */

export interface DayCell {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isYearMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function isPlainDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 0 = Sunday … 6 = Saturday (Sakamoto's algorithm, proleptic Gregorian). */
export function weekday(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function monthRange(ym: string): { first: string; last: string } {
  const [y, m] = ym.split("-").map(Number);
  return { first: `${ym}-01`, last: `${ym}-${pad(daysInMonth(y, m))}` };
}

/** Weeks (Sunday first, as in Israel) covering the month, padded with neighbouring days. */
export function monthWeeks(ym: string): DayCell[][] {
  const [y, m] = ym.split("-").map(Number);
  const lead = weekday(y, m, 1);
  const total = daysInMonth(y, m);
  const prev = shiftMonth(ym, -1).split("-").map(Number);
  const next = shiftMonth(ym, 1);
  const cells: DayCell[] = [];
  const prevDays = daysInMonth(prev[0], prev[1]);
  for (let i = lead - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ date: `${prev[0]}-${pad(prev[1])}-${pad(d)}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= total; d++) cells.push({ date: `${ym}-${pad(d)}`, day: d, inMonth: true });
  for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ date: `${next}-${pad(d)}`, day: d, inMonth: false });
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Hebrew weekday names, Sunday first. */
export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;
export const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;

const monthFormatter = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });

/** "נובמבר 2026". Display only: the instant is midday UTC on the 15th, formatted in UTC. */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return monthFormatter.format(Date.UTC(y, m - 1, 15, 12));
}
