import type { Student } from "@/data/demo";

/** Student names with tap-to-call phone numbers. */
export function StudentList({ students }: { students: Student[] }) {
  return (
    <ul className="divide-y divide-border" role="list">
      {students.map((student) => (
        <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="font-medium">{student.name}</span>
          <a
            href={`tel:${student.phone.replaceAll("-", "")}`}
            dir="ltr"
            className="text-brand-strong underline underline-offset-4"
          >
            {student.phone}
          </a>
        </li>
      ))}
    </ul>
  );
}
