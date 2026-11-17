import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonEditor } from "@/components/LessonEditor";
import { formatDate, getLesson, getSongs, getSpace, lessons } from "@/data/demo";

export function generateStaticParams() {
  return lessons.map((lesson) => ({ spaceId: lesson.spaceId, lessonId: lesson.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/spaces/[spaceId]/lessons/[lessonId]">): Promise<Metadata> {
  const { spaceId, lessonId } = await params;
  const space = getSpace(spaceId);
  const lesson = getLesson(spaceId, lessonId);
  if (!space || !lesson) return { title: "שיעור לא נמצא" };
  return { title: `שיעור ${formatDate(lesson.date)} · ${space.name}` };
}

export default async function LessonPage({ params }: PageProps<"/spaces/[spaceId]/lessons/[lessonId]">) {
  const { spaceId, lessonId } = await params;
  const space = getSpace(spaceId);
  const lesson = getLesson(spaceId, lessonId);
  if (!space || !lesson) notFound();

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
          <li>
            <Link href={`/spaces/${space.id}`} className="underline underline-offset-4">
              {space.name}
            </Link>
            <span aria-hidden="true"> ‹ </span>
          </li>
          <li aria-current="page">שיעור</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold">{formatDate(lesson.date)}</h1>
      <p className="mb-6 text-muted">
        {space.name} · בשעה <time dateTime={`${lesson.date}T${lesson.time}`}>{lesson.time}</time>
      </p>

      <LessonEditor space={space} lesson={lesson} lessonSongs={getSongs(lesson.songIds)} />
    </>
  );
}
