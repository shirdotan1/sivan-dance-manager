import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SongTitle } from "@/components/SongText";
import { GroupCard } from "@/components/GroupCard";
import { GroupForm } from "@/components/GroupForm";
import { PoolManager } from "@/components/PoolManager";
import { createGroup } from "@/lib/actions/groups";
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
        {space.groups.length === 0 ? (
          <p className="empty-state mb-4">אין עדיין קבוצות במרחב. אפשר ליצור קבוצה בטופס למטה.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" role="list">
            {space.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                pool={pool}
                members={activeStudents(studentsByIds(space.students, group.studentIds))}
              />
            ))}
          </ul>
        )}
        <details className="disclosure mt-4">
          <summary>+ קבוצה חדשה</summary>
          <GroupForm action={createGroup.bind(null, space.id)} pool={pool} submitLabel="יצירת הקבוצה" />
        </details>
      </section>

      <section aria-labelledby="lessons-heading" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="lessons-heading">שיעורים ({spaceLessons.length})</h2>
          <Link href={`/spaces/${space.id}/lessons/new`} className="btn btn-secondary btn-compact max-sm:hidden">
            + שיעור חדש
          </Link>
        </div>
        {spaceLessons.length === 0 ? (
          <p className="empty-state">עדיין אין שיעורים במרחב הזה. אפשר ליצור שיעור חדש.</p>
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

      {/* Daily main action within thumb reach on phones. */}
      <div className="action-bar sm:hidden">
        <Link href={`/spaces/${space.id}/lessons/new`} className="btn btn-primary w-full">
          + שיעור חדש
        </Link>
      </div>
    </>
  );
}

async function PrivateSpaceView({ space }: { space: PrivateSpace }) {
  const [projects, songs] = await Promise.all([getProjects(), getSongs()]);
  const pool = activeStudents(space.students);
  const openTotal = projects
    .flatMap((p) => p.sessions.flatMap((se) => se.payments))
    .filter((p) => !p.paid)
    .reduce((sum, p) => sum + p.amount, 0);
  return (
    <>
      <Link href={`/spaces/${space.id}/payments`} className="card card-link mb-8 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">תשלומים פתוחים</span>
        <span className={`font-bold ${openTotal > 0 ? "text-danger" : "text-success"}`}>
          {openTotal > 0 ? `${formatCurrency(openTotal)} טרם שולמו` : "✓ הכול שולם"}
        </span>
      </Link>

      <section aria-labelledby="projects-heading" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="projects-heading">פרויקטים ({projects.length})</h2>
          <Link href={`/spaces/${space.id}/projects/new`} className="btn btn-secondary btn-compact max-sm:hidden">
            + פרויקט חדש
          </Link>
        </div>
        {projects.length === 0 && <p className="empty-state">אין עדיין פרויקטים. אפשר ליצור פרויקט חדש.</p>}
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

      <div className="action-bar sm:hidden">
        <Link href={`/spaces/${space.id}/projects/new`} className="btn btn-primary w-full">
          + פרויקט חדש
        </Link>
      </div>
    </>
  );
}
