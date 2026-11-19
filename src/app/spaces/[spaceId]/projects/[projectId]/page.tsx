import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { SongArtist, SongTitle } from "@/components/SongText";
import { getProject, getSong, getSpace } from "@/lib/data/queries";
import { formatCurrency, formatDate, listenUrl, projectTypeLabel } from "@/lib/format";
import { studentsByIds } from "@/lib/lookup";

export async function generateMetadata({
  params,
}: PageProps<"/spaces/[spaceId]/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;
  return { title: (await getProject(projectId))?.name ?? "פרויקט לא נמצא" };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/spaces/[spaceId]/projects/[projectId]">) {
  const { spaceId, projectId } = await params;
  const { saved } = await searchParams;
  const [space, project] = await Promise.all([getSpace(spaceId), getProject(projectId)]);
  if (!space || space.kind !== "private" || !project) notFound();

  const participants = studentsByIds(space.students, project.participantIds);
  const mainSong = await getSong(project.mainSongId);
  const sessions = project.sessions; // newest first

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: project.name }]} />

      <h1 className="mb-2">{project.name}</h1>
      <p className="mb-4 text-muted">פרויקט {projectTypeLabel[project.type]}</p>
      {saved && (
        <p role="status" className="mb-4 text-sm font-medium text-success">
          ✓ הפרויקט נשמר.
        </p>
      )}

      <section aria-labelledby="details-heading" className="card card-section">
        <h2 id="details-heading" className="mb-3">
          פרטי הפרויקט
        </h2>
        <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="font-medium text-muted">סוג</dt>
          <dd>{projectTypeLabel[project.type]}</dd>

          <dt className="font-medium text-muted">{participants.length > 1 ? "משתתפות" : "משתתפת"}</dt>
          <dd>{participants.map((p) => p.name).join(", ")}</dd>

          <dt className="font-medium text-muted">שיר ראשי</dt>
          <dd>
            {mainSong ? (
              <>
                {/* Title and artist on separate lines, as in the song lists: joining two
                    English strings with a dash inside RTL text displays them reversed. */}
                <span className="block font-medium">
                  <SongTitle song={mainSong} />
                </span>
                {mainSong.artist && (
                  <span className="block text-sm text-muted">
                    <SongArtist song={mainSong} />
                  </span>
                )}
                <a
                  href={listenUrl(mainSong)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-link text-sm text-brand-strong underline underline-offset-4"
                >
                  האזנה
                  <span className="visually-hidden">
                    {" "}
                    ל־<SongTitle song={mainSong} /> (נפתח בלשונית חדשה)
                  </span>
                </a>
              </>
            ) : (
              "לא נבחר"
            )}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="sessions-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="sessions-heading">מפגשים ({sessions.length})</h2>
          <Link href={`/spaces/${space.id}/projects/${project.id}/sessions/new`} className="btn btn-secondary btn-compact max-sm:hidden">
            + מפגש חדש
          </Link>
        </div>
        {sessions.length === 0 && <p className="empty-state">אין עדיין מפגשים. אפשר ליצור מפגש חדש.</p>}
        <ul className="grid gap-4" role="list">
          {sessions.map((session) => {
            const total = session.payments.reduce((sum, p) => sum + p.amount, 0);
            const paid = session.payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
            return (
              <li key={session.id}>
                <Link
                  href={`/spaces/${space.id}/projects/${project.id}/sessions/${session.id}`}
                  className="card card-link flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    <span className="block font-semibold">{formatDate(session.date)}</span>
                    <span className="text-sm text-muted">
                      בשעה <time dateTime={`${session.date}T${session.time}`}>{session.time}</time>
                    </span>
                  </span>
                  <span className="text-sm">
                    {paid === total ? "✓ שולם במלואו" : `שולמו ${formatCurrency(paid)} מתוך ${formatCurrency(total)}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 mb-6 flex flex-wrap justify-between gap-3">
        <Link href={`/spaces/${space.id}/projects/${project.id}/edit`} className="btn btn-secondary btn-compact">
          עריכת הפרויקט
        </Link>
        <DeleteProjectButton projectId={project.id} name={project.name} sessions={sessions.length} />
      </div>

      <div className="action-bar sm:hidden">
        <Link href={`/spaces/${space.id}/projects/${project.id}/sessions/new`} className="btn btn-primary w-full">
          + מפגש חדש
        </Link>
      </div>
    </>
  );
}
