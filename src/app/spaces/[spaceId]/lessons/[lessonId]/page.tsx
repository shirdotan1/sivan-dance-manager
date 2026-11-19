import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DeleteLessonButton } from "@/components/DeleteLessonButton";
import { MediaView, NotesView, ParticipantsView, SongsView } from "@/components/view/EventView";
import { getLesson, getSongs, getSpace } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";
import { songsByIds, studentsByIds } from "@/lib/lookup";

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
  const [space, lesson, bank] = await Promise.all([getSpace(spaceId), getLesson(spaceId, lessonId), getSongs()]);
  if (!space || space.kind !== "studio" || !lesson) notFound();

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

      <ParticipantsView students={studentsByIds(space.students, lesson.participantIds)} />
      <SongsView songs={songsByIds(bank, lesson.songIds)} title="שירים בשיעור" />
      <NotesView notes={lesson.notes} />
      <MediaView media={lesson.media} />

      <div className="mb-6 flex justify-end">
        <DeleteLessonButton spaceId={space.id} lessonId={lesson.id} label={formatDate(lesson.date)} />
      </div>

      <div className="action-bar">
        <Link href={`${base}/edit`} className="btn btn-primary w-full sm:w-auto">
          עריכת השיעור
        </Link>
      </div>
    </>
  );
}
