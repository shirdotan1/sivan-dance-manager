import Link from "next/link";
import type { Student } from "@/lib/types";

/**
 * A student's name linking to her card (used wherever a name appears).
 * tap-link gives it a ≥44×44 touch area without changing the visible text.
 */
export function StudentLink({ student, className = "" }: { student: Pick<Student, "id" | "name">; className?: string }) {
  return (
    <Link href={`/students/${student.id}`} className={`tap-link underline-offset-4 hover:underline ${className}`}>
      {student.name}
    </Link>
  );
}
