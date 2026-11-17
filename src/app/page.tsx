import Link from "next/link";
import { getLessonsForSpace, spaces } from "@/data/demo";

export default function HomePage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">שלום סיון 👋</h1>
      <p className="mb-6 text-muted">לאן נכנסים היום?</p>

      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {spaces.map((space) => {
          const lessonCount = getLessonsForSpace(space.id).length;
          return (
            <li key={space.id}>
              <Link
                href={`/spaces/${space.id}`}
                className="block h-full rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <h2 className="text-xl font-semibold text-brand-strong">{space.name}</h2>
                <p className="mt-1 text-muted">{space.description}</p>
                <p className="mt-3 text-sm">
                  {space.students.length} תלמידות · {lessonCount} שיעורים
                  {space.kind === "private" && " · כולל מעקב תשלומים"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
