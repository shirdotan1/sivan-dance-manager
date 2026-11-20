import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SessionForm } from "@/components/forms/SessionForm";
import { saveSession } from "@/lib/actions/sessions";
import { getProject, getSongs, getSpace } from "@/lib/data/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "עריכת מפגש" };

export default async function EditSessionPage({
  params,
}: PageProps<"/spaces/[spaceId]/projects/[projectId]/sessions/[sessionId]/edit">) {
  const { spaceId, projectId, sessionId } = await params;
  const [space, project, bank] = await Promise.all([getSpace(spaceId), getProject(projectId), getSongs()]);
  const session = project?.sessions.find((s) => s.id === sessionId);
  if (!space || space.kind !== "private" || !project || !session) notFound();
  const projectHref = `/spaces/${space.id}/projects/${project.id}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: project.name, href: projectHref },
          { label: formatDate(session.date), href: `${projectHref}/sessions/${session.id}` },
          { label: "עריכה" },
        ]}
      />
      <h1 className="mb-6">עריכת מפגש</h1>
      <SessionForm
        action={saveSession.bind(null, project.id, session.id)}
        pool={space.students}
        participantIds={project.participantIds}
        bank={bank}
        draft={session}
        submitLabel="שמירת המפגש"
      />
    </>
  );
}
