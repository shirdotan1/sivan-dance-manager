import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { saveProject } from "@/lib/actions/projects";
import { getMaterials, getSpace } from "@/lib/data/queries";

export const metadata: Metadata = { title: "פרויקט חדש" };

export default async function NewProjectPage({ params }: PageProps<"/spaces/[spaceId]/projects/new">) {
  const { spaceId } = await params;
  const [space, bank] = await Promise.all([getSpace(spaceId), getMaterials()]);
  if (!space || space.kind !== "private") notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: space.name, href: `/spaces/${space.id}` }, { label: "פרויקט חדש" }]} />
      <h1 className="mb-6">פרויקט חדש</h1>
      <ProjectForm action={saveProject.bind(null, null)} pool={space.students} bank={bank} submitLabel="יצירת הפרויקט" />
    </>
  );
}
