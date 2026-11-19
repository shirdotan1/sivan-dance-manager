import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LessonForm, type LessonDraft } from "@/components/forms/LessonForm";
import { saveLesson } from "@/lib/actions/lessons";
import { getLesson, getLessonsForSpace, getSongs, getSpace } from "@/lib/data/queries";
import { addDays, todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "שיעור חדש" };

/**
 * New lesson. ?date=YYYY-MM-DD prefills the date (calendar);
 * ?from=<lessonId> copies participants, group and songs (duplicate), a week later.
 */
export default async function NewLessonPage({ params, searchParams }: PageProps<"/spaces/[spaceId]/lessons/new">) {
  const { spaceId } = await params;
  const { date, from } = await searchParams;
  const [space, bank] = await Promise.all([getSpace(spaceId), getSongs()]);
  if (!space || space.kind !== "studio") notFound();

  const source = typeof from === "string" ? await getLesson(space.id, from) : undefined;
  const latest = source ? undefined : (await getLessonsForSpace(space.id))[0];
  const validDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  const draft: LessonDraft = source
    ? {
        date: validDate ?? addDays(source.date, 7),
        time: source.time,
        groupId: source.groupId,
        participantIds: source.participantIds,
        songIds: source.songIds,
        notes: "",
        media: [],
      }
    : {
        date: validDate ?? todayIso(),
        time: latest?.time ?? "17:00",
        participantIds: [],
        songIds: [],
        notes: "",
        media: [],
      };

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "שיעור חדש" }]} />
      <h1 className="mb-2">
        שיעור חדש
      </h1>
      <p className="mb-6 text-muted">
        {space.name}
        {source && " · הועתקו המשתתפות והשירים מהשיעור הקודם"}
      </p>
      <LessonForm
        action={saveLesson.bind(null, space.id, null)}
        space={space}
        bank={bank}
        draft={draft}
        submitLabel="יצירת השיעור"
      />
    </>
  );
}
