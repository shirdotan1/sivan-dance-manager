import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LessonEditor } from "@/components/LessonEditor";
import { getLesson, getSongs, getSpace } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/spaces/[spaceId]/lessons/[lessonId]">): Promise<Metadata> {
  const { spaceId, lessonId } = await params;
  const [space, lesson] = await Promise.all([getSpace(spaceId), getLesson(spaceId, lessonId)]);
  if (!space || !lesson) return { title: "שיעור לא נמצא" };
  return { title: `שיעור ${formatDate(lesson.date)} · ${space.name}` };
}

export default async function LessonPage({ params }: PageProps<"/spaces/[spaceId]/lessons/[lessonId]">) {
  const { spaceId, lessonId } = await params;
  const [space, lesson, bank] = await Promise.all([getSpace(spaceId), getLesson(spaceId, lessonId), getSongs()]);
  if (!space || space.kind !== "studio" || !lesson) notFound();

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "שיעור" }]} />

      <h1 className="mb-2">{formatDate(lesson.date)}</h1>
      <p className="mb-6 text-muted">
        {space.name} · בשעה <time dateTime={`${lesson.date}T${lesson.time}`}>{lesson.time}</time>
      </p>

      <LessonEditor space={space} lesson={lesson} bank={bank} />
    </>
  );
}
