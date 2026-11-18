import Link from "next/link";
import { getLessonsForSpace, projects, spaces } from "@/data/demo";

export default function HomePage() {
  return (
    <>
      <h1 className="mb-2">שלום סיון 👋</h1>
      <p className="mb-6 text-muted">לאן נכנסים היום?</p>

      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {spaces.map((space) => {
          return (
            <li key={space.id}>
              <Link
                href={`/spaces/${space.id}`}
                className="block h-full rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <h2 className="text-brand-strong">{space.name}</h2>
                <p className="mt-1 text-muted">{space.description}</p>
                <p className="mt-3 text-sm">
                  {space.students.length} תלמידות ·{" "}
                  {space.kind === "studio"
                    ? `${space.groups.length} קבוצות · ${getLessonsForSpace(space.id).length} שיעורים`
                    : `${projects.length} פרויקטים · כולל מעקב תשלומים`}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
