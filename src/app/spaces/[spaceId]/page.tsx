import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SongTitle } from "@/components/SongText";
import { PoolManager } from "@/components/PoolManager";
import { getLessonsForSpace, getProjects, getSongs, getSpace } from "@/lib/data/queries";
import { formatCurrency, formatDate, projectTypeLabel } from "@/lib/format";
import { activeStudents, studentsByIds } from "@/lib/lookup";
import type { PrivateSpace, StudioSpace } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/spaces/[spaceId]">): Promise<Metadata> {
  const { spaceId } = await params;
  return { title: (await getSpace(spaceId))?.name ?? "מרחב לא נמצא" };
}

export default async function SpacePage({ params }: PageProps<"/spaces/[spaceId]">) {
  const { spaceId } = await params;
  const space = await getSpace(spaceId);
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

async function StudioSpaceView({ space }: { space: StudioSpace }) {
  const spaceLessons = await getLessonsForSpace(space.id);
  const pool = activeStudents(space.students);

  return (
    <>
      <section aria-labelledby="groups-heading" className="mb-10">
        <h2 id="groups-heading" className="mb-3">
          קבוצות ({space.groups.length})
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {space.groups.map((group) => {
            const members = activeStudents(studentsByIds(space.students, group.studentIds));
            return (
              <li key={group.id} className="card">
                <h3>{group.name}</h3>
                <p className="mb-2 text-sm text-muted">{members.length} תלמידות</p>
                <ul className="flex flex-wrap gap-1.5" role="list">
                  {members.map((m) => (
                    <li key={m.id} className="chip">
                      {m.name}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="lessons-heading" className="mb-10">
        <h2 id="lessons-heading" className="mb-3">
          שיעורים
        </h2>
        {spaceLessons.length === 0 ? (
          <p>עדיין אין שיעורים במרחב הזה.</p>
        ) : (
          <ul className="grid gap-4" role="list">
            {spaceLessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/spaces/${space.id}/lessons/${lesson.id}`}
                  className="card card-link flex flex-wrap items-center justify-between gap-2"
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
          מאגר התלמידות ({pool.length})
        </h2>
        <div className="card py-2">
          <PoolManager spaceId={space.id} students={pool} />
        </div>
      </section>
    </>
  );
}

async function PrivateSpaceView({ space }: { space: PrivateSpace }) {
  const [projects, songs] = await Promise.all([getProjects(), getSongs()]);
  const pool = activeStudents(space.students);
  return (
    <>
      <section aria-labelledby="projects-heading" className="mb-10">
        <h2 id="projects-heading" className="mb-3">
          פרויקטים ({projects.length})
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {projects.map((project) => {
            const mainSong = songs.find((s) => s.id === project.mainSongId);
            const participants = studentsByIds(space.students, project.participantIds);
            const unpaid = project.sessions
              .flatMap((s) => s.payments)
              .filter((p) => !p.paid)
              .reduce((sum, p) => sum + p.amount, 0);
            return (
              <li key={project.id}>
                <Link
                  href={`/spaces/${space.id}/projects/${project.id}`}
                  className="card card-link h-full"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-semibold">{project.name}</span>
                    <span className="chip">
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
          מאגר התלמידות ({pool.length})
        </h2>
        <div className="card py-2">
          <PoolManager spaceId={space.id} students={pool} />
        </div>
      </section>
    </>
  );
}
