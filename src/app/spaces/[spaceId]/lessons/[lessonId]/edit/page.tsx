import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LessonForm } from "@/components/forms/LessonForm";
import { saveLesson } from "@/lib/actions/lessons";
import { getLesson, getMaterials, getSpace } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "עריכת שיעור" };

export default async function EditLessonPage({ params }: PageProps<"/spaces/[spaceId]/lessons/[lessonId]/edit">) {
  const { spaceId, lessonId } = await params;
  const [space, lesson, bank] = await Promise.all([getSpace(spaceId), getLesson(spaceId, lessonId), getMaterials()]);
  if (!space || space.kind !== "studio" || !lesson) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: formatDate(lesson.date), href: `/spaces/${space.id}/lessons/${lesson.id}` },
          { label: "עריכה" },
        ]}
      />
      <h1 className="mb-6">
        עריכת שיעור
      </h1>
      <LessonForm
        action={saveLesson.bind(null, space.id, lesson.id)}
        space={space}
        bank={bank}
        draft={lesson}
        submitLabel="שמירת השיעור"
      />
    </>
  );
}
