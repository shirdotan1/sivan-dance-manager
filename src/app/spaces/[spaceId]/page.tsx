import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SongTitle } from "@/components/SongText";
import { StudentList } from "@/components/StudentList";
import {
  formatCurrency,
  formatDate,
  getLessonsForSpace,
  getSong,
  getSpace,
  getStudents,
  projectTypeLabel,
  projects,
  spaces,
  type PrivateSpace,
  type StudioSpace,
} from "@/data/demo";

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

  return (
    <>
      <Breadcrumbs items={[{ label: space.name }]} />
      <h1 className="mb-2">{space.name}</h1>
      <p className="mb-6 text-muted">{space.description}</p>

      {space.kind === "studio" ? <StudioSpaceView space={space} /> : <PrivateSpaceView space={space} />}
    </>
  );
}

function StudioSpaceView({ space }: { space: StudioSpace }) {
  const spaceLessons = getLessonsForSpace(space.id);

  return (
    <>
      <section aria-labelledby="groups-heading" className="mb-8">
        <h2 id="groups-heading" className="mb-3">
          קבוצות ({space.groups.length})
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2" role="list">
          {space.groups.map((group) => {
            const members = getStudents(space, group.studentIds);
            return (
              <li key={group.id} className="rounded-xl border border-border bg-surface p-4">
                <h3>{group.name}</h3>
                <p className="mb-2 text-sm text-muted">{members.length} תלמידות</p>
                <ul className="flex flex-wrap gap-1.5" role="list">
                  {members.map((m) => (
                    <li key={m.id} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm">
                      {m.name}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="lessons-heading" className="mb-8">
        <h2 id="lessons-heading" className="mb-3">
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
                    {lesson.participantIds.length} משתתפות · {lesson.songIds.length} שירים
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="mb-3">
          כל התלמידות במרחב ({space.students.length})
        </h2>
        <div className="rounded-xl border border-border bg-surface px-4 py-1">
          <StudentList students={space.students} />
        </div>
      </section>
    </>
  );
}

function PrivateSpaceView({ space }: { space: PrivateSpace }) {
  return (
    <>
      <section aria-labelledby="projects-heading" className="mb-8">
        <h2 id="projects-heading" className="mb-3">
          פרויקטים ({projects.length})
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2" role="list">
          {projects.map((project) => {
            const mainSong = getSong(project.mainSongId);
            const participants = getStudents(space, project.participantIds);
            const unpaid = project.sessions
              .flatMap((s) => s.payments)
              .filter((p) => !p.paid)
              .reduce((sum, p) => sum + p.amount, 0);
            return (
              <li key={project.id}>
                <Link
                  href={`/spaces/${space.id}/projects/${project.id}`}
                  className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-brand hover:bg-brand-soft"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-semibold">{project.name}</span>
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm text-brand-strong">
                      {projectTypeLabel[project.type]}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm">{participants.map((p) => p.name).join(", ")}</span>
                  {mainSong && (
                    <span className="mt-1 block text-sm text-muted">
                      שיר ראשי: <SongTitle song={mainSong} />
                    </span>
                  )}
                  <span className="mt-2 block text-sm">
                    {project.sessions.length} מפגשים
                    {unpaid > 0 && ` · ${formatCurrency(unpaid)} טרם שולמו`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="mb-3">
          תלמידות ({space.students.length})
        </h2>
        <div className="rounded-xl border border-border bg-surface px-4 py-1">
          <StudentList students={space.students} />
        </div>
      </section>
    </>
  );
}
