import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SessionEditor } from "@/components/SessionEditor";
import {
  formatDate,
  getProject,
  getSession,
  getSpace,
  getStudents,
  privateSpace,
  projectTypeLabel,
  projects,
} from "@/data/demo";

type Props = PageProps<"/spaces/[spaceId]/projects/[projectId]/sessions/[sessionId]">;

export function generateStaticParams() {
  return projects.flatMap((project) =>
    project.sessions.map((session) => ({
      spaceId: privateSpace.id,
      projectId: project.id,
      sessionId: session.id,
    })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, sessionId } = await params;
  const project = getProject(projectId);
  const session = project && getSession(project, sessionId);
  if (!project || !session) return { title: "מפגש לא נמצא" };
  return { title: `מפגש ${formatDate(session.date)} · ${project.name}` };
}

export default async function SessionPage({ params }: Props) {
  const { spaceId, projectId, sessionId } = await params;
  const space = getSpace(spaceId);
  const project = getProject(projectId);
  const session = project && getSession(project, sessionId);
  if (!space || space.kind !== "private" || !project || !session) notFound();

  const participants = getStudents(space, project.participantIds);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: project.name, href: `/spaces/${space.id}/projects/${project.id}` },
          { label: "מפגש" },
        ]}
      />

      <h1 className="text-2xl font-bold">{formatDate(session.date)}</h1>
      <p className="mb-6 text-muted">
        {project.name} ({projectTypeLabel[project.type]}) · בשעה{" "}
        <time dateTime={`${session.date}T${session.time}`}>{session.time}</time>
        <br />
        {participants.map((p) => p.name).join(", ")}
      </p>

      <SessionEditor space={space} project={project} session={session} />
    </>
  );
}
