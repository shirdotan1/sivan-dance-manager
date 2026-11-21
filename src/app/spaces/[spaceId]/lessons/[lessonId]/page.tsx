import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DeleteLessonButton } from "@/components/DeleteLessonButton";
import { PrevNext } from "@/components/PrevNext";
import { Suspense } from "react";
import { EventMedia, EventMediaSkeleton } from "@/components/media/EventMedia";
import { NotesView, ParticipantsView, MaterialsView } from "@/components/view/EventView";
import { getLesson, getLessonsForSpace, getMaterials, getSpace } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";
import { materialsByIds, studentsByIds } from "@/lib/lookup";

type Props = PageProps<"/spaces/[spaceId]/lessons/[lessonId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { spaceId, lessonId } = await params;
  const [space, lesson] = await Promise.all([getSpace(spaceId), getLesson(spaceId, lessonId)]);
  if (!space || !lesson) return { title: "שיעור לא נמצא" };
  return { title: `שיעור ${formatDate(lesson.date)} · ${space.name}` };
}

export default async function LessonPage({ params, searchParams }: Props) {
  const { spaceId, lessonId } = await params;
  const { saved } = await searchParams;
  const [space, lesson, bank, all] = await Promise.all([
    getSpace(spaceId),
    getLesson(spaceId, lessonId),
    getMaterials(),
    getLessonsForSpace(spaceId),
  ]);
  if (!space || space.kind !== "studio" || !lesson) notFound();
  // `all` is newest first: the next (later) lesson is before this one.
  const idx = all.findIndex((l) => l.id === lesson.id);
  const later = idx > 0 ? all[idx - 1] : undefined;
  const earlier = idx >= 0 ? all[idx + 1] : undefined;
  const href = (id: string) => `/spaces/${space.id}/lessons/${id}`;

  const group = space.groups.find((g) => g.id === lesson.groupId);
  const base = `/spaces/${space.id}/lessons/${lesson.id}`;

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "שיעור" }]} />

      <h1 className="mb-2">
        {formatDate(lesson.date)}
      </h1>
      <p className="mb-2 text-muted">
        {space.name} · בשעה <time dateTime={`${lesson.date}T${lesson.time}`}>{lesson.time}</time>
      </p>
      {lesson.seriesId && (
        <p className="mb-2">
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm">משבצת שבועית</span>
        </p>
      )}
      {group && (
        <p className="mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: group.color }} />
          <span>קבוצה: {group.name}</span>
        </p>
      )}
      {saved && (
        <p role="status" className="mb-4 text-sm font-medium text-success">
          ✓ השיעור נשמר.
        </p>
      )}

      <PrevNext
        noun="שיעורי המרחב"
        prev={earlier && { href: href(earlier.id), date: earlier.date }}
        next={later && { href: href(later.id), date: later.date }}
      />

      <ParticipantsView students={studentsByIds(space.students, lesson.participantIds)} />
      <p className="-mt-6 mb-8 flex justify-end">
        <Link href={`${base}/edit#participants`} className="btn btn-secondary btn-compact">
          עריכת משתתפות
        </Link>
      </p>
      <MaterialsView materials={materialsByIds(bank, lesson.materialIds)} title="חומרים בשיעור" />
      <NotesView notes={lesson.notes} />
      <Suspense fallback={<EventMediaSkeleton />}>
        <EventMedia owner={{ kind: "lesson", id: lesson.id }} />
      </Suspense>

      <div className="mb-6 flex justify-end">
        <DeleteLessonButton spaceId={space.id} lessonId={lesson.id} label={formatDate(lesson.date)} />
      </div>

      <div className="action-bar">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link href={`/spaces/${space.id}/lessons/new?from=${lesson.id}`} className="btn btn-secondary">
            צרי את השיעור הבא מזה
          </Link>
          <Link href={`${base}/edit`} className="btn btn-primary">
            עריכת השיעור
          </Link>
        </div>
      </div>
    </>
  );
}
