import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MaterialTitle } from "@/components/materials/MaterialText";
import { GroupCard } from "@/components/GroupCard";
import { GroupForm } from "@/components/GroupForm";
import { PoolManager } from "@/components/PoolManager";
import { SeriesForm } from "@/components/SeriesManager";
import { createGroup } from "@/lib/actions/groups";
import { getLessonsForSpace, getProjects, getMaterials, getSpace } from "@/lib/data/queries";
import { getSeriesForSpace, renewSeries } from "@/lib/data/series";
import { requireUser } from "@/lib/supabase/server";
import { formatCurrency, formatDate, projectTypeLabel, todayIso, WEEKDAYS } from "@/lib/format";
import { activeStudents, studentsByIds } from "@/lib/lookup";
import type { Lesson, LessonSeries, PrivateSpace, StudioSpace } from "@/lib/types";

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
  const { supabase } = await requireUser();
  // Weekly slots: fill the next 8 weeks before showing the lessons. A failure
  // must not hide the page — the next view renews again.
  await renewSeries(supabase, [space.id]).catch((e) => console.error("series renewal failed", e));
  const [spaceLessons, series] = await Promise.all([getLessonsForSpace(space.id), getSeriesForSpace(supabase, space.id)]);
  const pool = activeStudents(space.students);
  const today = todayIso();
  // Newest first from the query: upcoming (today and later) nearest first, then past.
  const upcoming = spaceLessons.filter((l) => l.date >= today).reverse();
  const past = spaceLessons.filter((l) => l.date < today);
  const held = past.filter((l) => !l.cancelled).length;
  const groupName = (id?: string) => space.groups.find((g) => g.id === id)?.name;

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

      <section aria-labelledby="series-heading" className="mb-10">
        <h2 id="series-heading" className="mb-3">
          משבצות שבועיות ({series.filter((x) => !x.stopsOn || x.stopsOn > today).length})
        </h2>
        {series.length === 0 ? (
          <p className="empty-state mb-4">אין עדיין משבצות קבועות. משבצת יוצרת שיעורים לשמונה שבועות קדימה ומתחדשת לבד.</p>
        ) : (
          <ul className="mb-4 grid gap-3" role="list">
            {series.map((s) => (
              <SeriesItem key={s.id} series={s} groupName={groupName(s.groupId)} today={today} />
            ))}
          </ul>
        )}
        <details className="disclosure">
          <summary>+ משבצת שבועית חדשה</summary>
          <SeriesForm spaceId={space.id} groups={space.groups} today={today} />
        </details>
      </section>

      <section aria-labelledby="lessons-heading" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="lessons-heading">שיעורים ({held} התקיימו)</h2>
          <Link href={`/spaces/${space.id}/lessons/new`} className="btn btn-secondary btn-compact max-sm:hidden">
            + שיעור חדש
          </Link>
        </div>
        {spaceLessons.length === 0 ? (
          <p className="empty-state">עדיין אין שיעורים במרחב הזה. אפשר ליצור שיעור חדש או משבצת שבועית.</p>
        ) : (
          <>
            <h3 id="upcoming-heading" className="mb-2 text-base">
              קרובים ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p className="empty-state mb-6">אין שיעורים קרובים.</p>
            ) : (
              <>
                <LessonList spaceId={space.id} lessons={upcoming.slice(0, 4)} groupName={groupName} labelledBy="upcoming-heading" />
                {upcoming.length > 4 && (
                  <details className="disclosure mt-3">
                    <summary>עוד {upcoming.length - 4} שיעורים קרובים</summary>
                    <div className="px-4 pb-4">
                      <LessonList spaceId={space.id} lessons={upcoming.slice(4)} groupName={groupName} />
                    </div>
                  </details>
                )}
              </>
            )}
            <h3 id="past-heading" className="mt-6 mb-2 text-base">
              קודמים ({past.length})
            </h3>
            {past.length === 0 ? (
              <p className="empty-state">עדיין אין שיעורים שהתקיימו.</p>
            ) : (
              <LessonList spaceId={space.id} lessons={past} groupName={groupName} labelledBy="past-heading" />
            )}
          </>
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
  const [projects, songs] = await Promise.all([getProjects(), getMaterials()]);
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
            const mainMaterial = songs.find((s) => s.id === project.mainMaterialId);
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
                  {mainMaterial && (
                    <span className="mt-1 block text-sm text-muted">
                      חומר מרכזי: <MaterialTitle material={mainMaterial} />
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

function SeriesItem({ series, groupName, today }: { series: LessonSeries; groupName?: string; today: string }) {
  const stopped = Boolean(series.stopsOn && series.stopsOn <= today);
  return (
    <li className="card flex flex-wrap items-center justify-between gap-2">
      <span>
        <span className="block font-semibold">
          כל יום {WEEKDAYS[series.weekday]} · <bdi dir="ltr">{series.time}</bdi>
          {groupName && <span className="font-normal"> · {groupName}</span>}
        </span>
        <span className="text-sm text-muted">
          החל מ־{formatDate(series.startsOn)}
          {series.stopsOn && ` · ${stopped ? "הופסקה" : "תיפסק"} מ־${formatDate(series.stopsOn)}`}
        </span>
      </span>
      {stopped && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-sm">הופסקה</span>}
    </li>
  );
}

function LessonList({
  spaceId,
  lessons,
  groupName,
  labelledBy,
}: {
  spaceId: string;
  lessons: Lesson[];
  groupName: (id?: string) => string | undefined;
  labelledBy?: string;
}) {
  return (
    <ul className="grid gap-3" role="list" aria-labelledby={labelledBy}>
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <Link
            href={`/spaces/${spaceId}/lessons/${lesson.id}`}
            className={`card card-link flex flex-wrap items-center justify-between gap-2 ${lesson.cancelled ? "opacity-75" : ""}`}
          >
            <span>
              <span className={`block font-semibold ${lesson.cancelled ? "line-through" : ""}`}>{formatDate(lesson.date)}</span>
              <span className="text-sm text-muted">
                בשעה <time dateTime={`${lesson.date}T${lesson.time}`}>{lesson.time}</time>
                {groupName(lesson.groupId) && ` · ${groupName(lesson.groupId)}`}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              {lesson.cancelled && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-medium">מבוטל</span>}
              {lesson.seriesId && <span className="rounded-full bg-brand-soft px-2.5 py-0.5">משבצת שבועית</span>}
              <span>
                {lesson.participantIds.length} משתתפות · {lesson.materialIds.length} חומרים
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
