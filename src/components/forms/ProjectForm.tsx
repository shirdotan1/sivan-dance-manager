"use client";

import { useId } from "react";
import type { ActionState } from "@/lib/actions/result";
import { useActionForm } from "@/lib/actions/useActionForm";
import { materialKindLabel } from "@/lib/format";
import { activeStudents } from "@/lib/lookup";
import type { Project, Material, Student } from "@/lib/types";

interface ProjectFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  pool: Student[];
  bank: Material[];
  project?: Project;
  submitLabel: string;
}

/** Project: name, solo/group, participants (from the private pool), optional main material. */
export function ProjectForm({ action, pool, bank, project, submitLabel }: ProjectFormProps) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(action);
  // Active pool, plus current participants even if they were removed from the pool since.
  const choices = pool.filter((s) => !s.archived || project?.participantIds.includes(s.id));

  return (
    <form onSubmit={onSubmit} className="pb-2">
      <fieldset className="card card-section">
        <legend className="card-legend">פרטי הפרויקט</legend>
        <div className="grid gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-name`} className="font-medium">
              שם הפרויקט <span aria-hidden="true">*</span>
            </label>
            <span id={`${id}-name-hint`} className="text-sm text-muted">
              למשל: הכנה לבחינה, סולו לתחרות, תוכנית אימון אישית
            </span>
            <input id={`${id}-name`} name="name" required aria-describedby={`${id}-name-hint`} dir="auto" autoComplete="off" defaultValue={project?.name} />
          </div>

          <fieldset>
            <legend className="mb-1 font-medium">סוג</legend>
            <div className="flex flex-wrap gap-x-6">
              {(
                [
                  ["solo", "סולו"],
                  ["group", "קבוצתי"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} htmlFor={`${id}-type-${value}`} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    id={`${id}-type-${value}`}
                    name="type"
                    value={value}
                    required
                    defaultChecked={(project?.type ?? "solo") === value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-song`} className="font-medium">
              חומר מרכזי <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <select id={`${id}-song`} name="mainMaterialId" defaultValue={project?.mainMaterialId ?? ""}>
              <option value="">עדיין לא נבחר</option>
              {bank.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${materialKindLabel[m.kind]}: ${m.title}${m.kind === "song" && m.artist ? ` — ${m.artist}` : ""}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="card card-section">
        <legend className="card-legend">משתתפות</legend>
        {activeStudents(pool).length === 0 ? (
          <p className="empty-state">אין תלמידות במאגר השיעורים הפרטיים. אפשר להוסיף במאגר בדף המרחב.</p>
        ) : (
          <div className="grid gap-x-4 sm:grid-cols-2">
            {choices.map((s) => (
              <label key={s.id} htmlFor={`${id}-p-${s.id}`} className="flex cursor-pointer items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id={`${id}-p-${s.id}`}
                  name="participant"
                  value={s.id}
                  defaultChecked={project?.participantIds.includes(s.id)}
                />
                <span>
                  {s.name}
                  {s.archived && <span className="text-muted"> (לא במאגר)</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="action-bar">
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {state.error}
        </p>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "שומרת…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
