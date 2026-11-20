import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SessionForm, type SessionDraft } from "@/components/forms/SessionForm";
import { saveSession } from "@/lib/actions/sessions";
import { getProject, getMaterials, getSpace } from "@/lib/data/queries";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "מפגש חדש" };

/**
 * New session. ?date=YYYY-MM-DD prefills the date (calendar). Time, amounts
 * and songs start from the latest session, so a routine session is one tap.
 */
export default async function NewSessionPage({
  params,
  searchParams,
}: PageProps<"/spaces/[spaceId]/projects/[projectId]/sessions/new">) {
  const { spaceId, projectId } = await params;
  const { date } = await searchParams;
  const [space, project, bank] = await Promise.all([getSpace(spaceId), getProject(projectId), getMaterials()]);
  if (!space || space.kind !== "private" || !project) notFound();

  const latest = project.sessions[0]; // newest first
  const validDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const draft: SessionDraft = {
    date: validDate ?? todayIso(),
    time: latest?.time ?? "17:00",
    payments: project.participantIds.map((studentId) => ({
      studentId,
      amount: latest?.payments.find((p) => p.studentId === studentId)?.amount ?? 0,
      paid: false,
    })),
    materialIds: latest?.materialIds ?? (project.mainMaterialId ? [project.mainMaterialId] : []),
    notes: "",
    media: [],
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { label: space.name, href: `/spaces/${space.id}` },
          { label: project.name, href: `/spaces/${space.id}/projects/${project.id}` },
          { label: "מפגש חדש" },
        ]}
      />
      <h1 className="mb-2">מפגש חדש</h1>
      <p className="mb-6 text-muted">{project.name}</p>
      <SessionForm
        action={saveSession.bind(null, project.id, null)}
        pool={space.students}
        participantIds={project.participantIds}
        bank={bank}
        draft={draft}
        submitLabel="יצירת המפגש"
      />
    </>
  );
}
