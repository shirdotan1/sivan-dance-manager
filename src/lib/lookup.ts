/** Pure lookups over already-loaded data (server or client). */
import type { Song, Student } from "@/lib/types";

/** Students for the given ids, in id order (archived ones included, for history). */
export function studentsByIds(pool: Student[], ids: string[]): Student[] {
  return ids.map((id) => pool.find((s) => s.id === id)).filter((s): s is Student => Boolean(s));
}

/** Active pool only (students removed from the pool are hidden). */
export function activeStudents(pool: Student[]): Student[] {
  return pool.filter((s) => !s.archived);
}

export function songsByIds(bank: Song[], ids: string[]): Song[] {
  return ids.map((id) => bank.find((s) => s.id === id)).filter((s): s is Song => Boolean(s));
}
