"use client";

import { useActionState, useId } from "react";
import { initialActionState, type ActionState } from "@/lib/actions/result";
import type { Group, Student } from "@/lib/types";

interface GroupFormProps {
  /** Bound Server Action (create for a space, or update for a group). */
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  pool: Student[];
  group?: Group;
  submitLabel: string;
}

/** Group name + members (checkboxes from the space's active pool). */
export function GroupForm({ action, pool, group, submitLabel }: GroupFormProps) {
  const id = useId();
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <>
      <form
        key={group ? undefined : state.done}
        action={formAction}
        aria-label={group ? `עריכת הקבוצה ${group.name}` : "קבוצה חדשה"}
        className="grid gap-4 px-4 pb-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="font-medium">
            שם הקבוצה <span aria-hidden="true">*</span>
          </label>
          <input id={`${id}-name`} name="name" required dir="auto" autoComplete="off" defaultValue={group?.name} />
        </div>
        <fieldset>
          <legend className="mb-2 font-medium">חברות בקבוצה</legend>
          {pool.length === 0 ? (
            <p className="empty-state">אין תלמידות במאגר. אפשר להוסיף במאגר שלמטה.</p>
          ) : (
            <div className="grid gap-x-4 sm:grid-cols-2">
              {pool.map((s) => (
                <label key={s.id} htmlFor={`${id}-${s.id}`} className="flex cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id={`${id}-${s.id}`}
                    name="member"
                    value={s.id}
                    defaultChecked={group?.studentIds.includes(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "שומרת…" : submitLabel}
          </button>
        </div>
      </form>
      <p role="status" className="px-4 pb-3 text-sm text-success empty:hidden">
        {state.message}
      </p>
      <p role="alert" className="px-4 pb-3 text-sm font-medium text-danger empty:hidden">
        {state.error}
      </p>
    </>
  );
}
