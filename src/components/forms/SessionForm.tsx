"use client";

import { useId } from "react";
import { MediaField } from "@/components/forms/MediaField";
import { PaymentsField } from "@/components/forms/PaymentsField";
import { FieldError, errorProps, useFocusFirstError } from "@/components/forms/FieldError";
import { MaterialsField } from "@/components/forms/MaterialsField";
import type { ActionState } from "@/lib/actions/result";
import { useActionForm } from "@/lib/actions/useActionForm";
import type { MediaItem, Payment, Material, Student } from "@/lib/types";

export interface SessionDraft {
  date: string;
  time: string;
  payments: Payment[];
  materialIds: string[];
  notes: string;
  media: MediaItem[];
}

interface SessionFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  pool: Student[];
  participantIds: string[];
  bank: Material[];
  draft: SessionDraft;
  submitLabel: string;
}

/** One form for new / edit session: date, time, payments, songs, notes, media. */
export function SessionForm({ action, pool, participantIds, bank, draft, submitLabel }: SessionFormProps) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(action);
  useFocusFirstError(state, [
    ["date", `${id}-date`],
    ["time", `${id}-time`],
    ["materials", "materials"],
  ]);
  const err = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="pb-2">
      <fieldset className="card card-section">
        <legend className="card-legend">מתי</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-date`} className="font-medium">
              תאריך <span aria-hidden="true">*</span>
            </label>
            <input id={`${id}-date`} name="date" type="date" required defaultValue={draft.date} {...errorProps(id, "date", state)} />
            <FieldError id={`${id}-date-error`} message={err.date} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-time`} className="font-medium">
              שעה <span aria-hidden="true">*</span>
            </label>
            <input id={`${id}-time`} name="time" type="time" required step={300} defaultValue={draft.time} {...errorProps(id, "time", state)} />
            <FieldError id={`${id}-time-error`} message={err.time} />
          </div>
        </div>
      </fieldset>

      <PaymentsField students={pool} participantIds={participantIds} initial={draft.payments} />
      <MaterialsField bank={bank} initialIds={draft.materialIds} legend="חומרים במפגש" error={err.materials} />

      <fieldset className="card card-section">
        <legend className="card-legend">הערות</legend>
        <label htmlFor={`${id}-notes`} className="mb-1 block font-medium">
          הערות למפגש
        </label>
        <p id={`${id}-notes-hint`} className="mb-2 text-sm text-muted">
          מה עבדנו עליו, למה לשים לב בפעם הבאה.
        </p>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={5}
          dir="auto"
          aria-describedby={`${id}-notes-hint`}
          defaultValue={draft.notes}
          className="block w-full"
        />
      </fieldset>

      <MediaField initial={draft.media} />

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
