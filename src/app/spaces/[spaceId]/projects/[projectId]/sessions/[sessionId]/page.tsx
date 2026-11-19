import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SessionEditor } from "@/components/SessionEditor";
import { getProject, getSongs, getSpace } from "@/lib/data/queries";
import { formatDate, projectTypeLabel } from "@/lib/format";
import { studentsByIds } from "@/lib/lookup";

type Props = PageProps<"/spaces/[spaceId]/projects/[projectId]/sessions/[sessionId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, sessionId } = await params;
  const project = await getProject(projectId);
  const session = project?.sessions.find((s) => s.id === sessionId);
  if (!project || !session) return { title: "מפגש לא נמצא" };
  return { title: `מפגש ${formatDate(session.date)} · ${project.name}` };
}

export default async function SessionPage({ params }: Props) {
  const { spaceId, projectId, sessionId } = await params;
  const [space, project, bank] = await Promise.all([getSpace(spaceId), getProject(projectId), getSongs()]);
  const session = project?.sessions.find((s) => s.id === sessionId);
  if (!space || space.kind !== "private" || !project || !session) notFound();

  const participants = studentsByIds(space.students, project.participantIds);

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
      <p className="mb-6 text-muted">
        {project.name} ({projectTypeLabel[project.type]}) · בשעה{" "}
        <time dateTime={`${session.date}T${session.time}`}>{session.time}</time>
        <br />
        {participants.map((p) => p.name).join(", ")}
      </p>

      <SessionEditor space={space} project={project} session={session} bank={bank} />
    </>
  );
}
