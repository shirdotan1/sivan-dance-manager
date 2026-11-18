import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getLessonsForSpace, getSpace, spaces } from "@/data/demo";

export function generateStaticParams() {
  return spaces.map((space) => ({ spaceId: space.id }));
}

export async function generateMetadata({ params }: PageProps<"/spaces/[spaceId]">): Promise<Metadata> {
  const { spaceId } = await params;
  return { title: getSpace(spaceId)?.name ?? "מרחב לא נמצא" };
}

export default async function SpacePage({ params }: PageProps<"/spaces/[spaceId]">) {
  const { spaceId } = await params;
  const space = getSpace(spaceId);
  if (!space) notFound();

  const spaceLessons = getLessonsForSpace(space.id);

  return (
    <>
      <nav aria-label="פירורי לחם" className="mb-2 text-sm">
        <ol className="flex flex-wrap gap-1 text-muted">
          <li>
            <Link href="/" className="underline underline-offset-4">
              המרחבים שלי
            </Link>
            <span aria-hidden="true"> ‹ </span>
          </li>
          <li aria-current="page">{space.name}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold">{space.name}</h1>
      <p className="mb-6 text-muted">{space.description}</p>

      <section aria-labelledby="lessons-heading" className="mb-8">
        <h2 id="lessons-heading" className="mb-3 text-xl font-semibold">
          שיעורים
        </h2>

        {spaceLessons.length === 0 ? (
          <p>עדיין אין שיעורים במרחב הזה.</p>
        ) : (
          <ul className="grid gap-3" role="list">
            {spaceLessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/spaces/${space.id}/lessons/${lesson.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4 hover:border-brand hover:bg-brand-soft"
                >
                  <span>
                    <span className="block font-semibold">{formatDate(lesson.date)}</span>
                    <span className="text-sm text-muted">
                      בשעה <time dateTime={`${lesson.date}T${lesson.time}`}>{lesson.time}</time>
                    </span>
                  </span>
                  <span className="text-sm">
                    {lesson.participantIds.length}/{space.students.length} נוכחות · {lesson.songIds.length} שירים
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="mb-3 text-xl font-semibold">
          מאגר תלמידות ({space.students.length})
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface" role="list">
          {space.students.map((student) => (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
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
      </section>
    </>
  );
}
