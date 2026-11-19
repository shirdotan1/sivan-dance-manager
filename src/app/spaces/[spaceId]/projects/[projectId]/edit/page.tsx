import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { saveProject } from "@/lib/actions/projects";
import { getProject, getSongs, getSpace } from "@/lib/data/queries";

export const metadata: Metadata = { title: "עריכת פרויקט" };

export default async function EditProjectPage({ params }: PageProps<"/spaces/[spaceId]/projects/[projectId]/edit">) {
  const { spaceId, projectId } = await params;
  const [space, project, bank] = await Promise.all([getSpace(spaceId), getProject(projectId), getSongs()]);
  if (!space || space.kind !== "private" || !project) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: project.name, href: `/spaces/${space.id}/projects/${project.id}` },
          { label: "עריכה" },
        ]}
      />
      <h1 className="mb-6">עריכת פרויקט</h1>
      <ProjectForm
        action={saveProject.bind(null, project.id)}
        pool={space.students}
        bank={bank}
        project={project}
        submitLabel="שמירת הפרויקט"
      />
    </>
  );
}
