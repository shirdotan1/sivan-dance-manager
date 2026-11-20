import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { PrevNext } from "@/components/PrevNext";
import { PaymentsQuick } from "@/components/PaymentsQuick";
import { MediaView, NotesView, SongsView } from "@/components/view/EventView";
import { getProject, getSongs, getSpace } from "@/lib/data/queries";
import { formatDate, projectTypeLabel } from "@/lib/format";
import { songsByIds, studentsByIds } from "@/lib/lookup";

type Props = PageProps<"/spaces/[spaceId]/projects/[projectId]/sessions/[sessionId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, sessionId } = await params;
  const project = await getProject(projectId);
  const session = project?.sessions.find((s) => s.id === sessionId);
  if (!project || !session) return { title: "מפגש לא נמצא" };
  return { title: `מפגש ${formatDate(session.date)} · ${project.name}` };
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { spaceId, projectId, sessionId } = await params;
  const { saved } = await searchParams;
  const [space, project, bank] = await Promise.all([getSpace(spaceId), getProject(projectId), getSongs()]);
  const session = project?.sessions.find((s) => s.id === sessionId);
  if (!space || space.kind !== "private" || !project || !session) notFound();

  const participants = studentsByIds(space.students, project.participantIds);
  // project.sessions is newest first.
  const idx = project.sessions.findIndex((s) => s.id === session.id);
  const later = idx > 0 ? project.sessions[idx - 1] : undefined;
  const earlier = project.sessions[idx + 1];
  const href = (id: string) => `/spaces/${space.id}/projects/${project.id}/sessions/${id}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: project.name, href: `/spaces/${space.id}/projects/${project.id}` },
          { label: "מפגש" },
        ]}
      />

      <h1 className="mb-2">{formatDate(session.date)}</h1>
      <p className="mb-4 text-muted">
        {project.name} ({projectTypeLabel[project.type]}) · בשעה{" "}
        <time dateTime={`${session.date}T${session.time}`}>{session.time}</time>
        <br />
        {participants.map((p) => p.name).join(", ")}
      </p>

      {saved && (
        <p role="status" className="mb-4 text-sm font-medium text-success">
          ✓ המפגש נשמר.
        </p>
      )}

      <PrevNext
        noun="מפגשי הפרויקט"
        prev={earlier && { href: href(earlier.id), date: earlier.date }}
        next={later && { href: href(later.id), date: later.date }}
      />

      <PaymentsQuick sessionId={session.id} payments={session.payments} students={space.students} />
      <SongsView songs={songsByIds(bank, session.songIds)} title="שירים במפגש" />
      <NotesView notes={session.notes} />
      <MediaView media={session.media} />

      <div className="mb-6 flex justify-end">
        <DeleteSessionButton projectId={project.id} sessionId={session.id} label={formatDate(session.date)} />
      </div>

      <div className="action-bar">
        <Link
          href={`/spaces/${space.id}/projects/${project.id}/sessions/${session.id}/edit`}
          className="btn btn-primary w-full sm:w-auto"
        >
          עריכת המפגש
        </Link>
      </div>
    </>
  );
}
