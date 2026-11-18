import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SongArtist, SongTitle } from "@/components/SongText";
import {
  formatCurrency,
  formatDate,
  getProject,
  getSessions,
  getSong,
  getSpace,
  getStudents,
  listenUrl,
  privateSpace,
  projectTypeLabel,
  projects,
} from "@/data/demo";

export function generateStaticParams() {
  return projects.map((project) => ({ spaceId: privateSpace.id, projectId: project.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/spaces/[spaceId]/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;
  return { title: getProject(projectId)?.name ?? "פרויקט לא נמצא" };
}

export default async function ProjectPage({ params }: PageProps<"/spaces/[spaceId]/projects/[projectId]">) {
  const { spaceId, projectId } = await params;
  const space = getSpace(spaceId);
  const project = getProject(projectId);
  if (!space || space.kind !== "private" || !project) notFound();

  const participants = getStudents(space, project.participantIds);
  const mainSong = getSong(project.mainSongId);
  const sessions = getSessions(project);

  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: project.name }]} />

      <h1 className="mb-2">{project.name}</h1>
      <p className="mb-6 text-muted">פרויקט {projectTypeLabel[project.type]}</p>

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
                  className="mt-1 inline-block text-sm text-brand-strong underline underline-offset-4"
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
        <h2 id="sessions-heading" className="mb-3">
          מפגשים ({sessions.length})
        </h2>
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
    </>
  );
}
