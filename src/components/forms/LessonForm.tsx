"use client";

import { useId } from "react";
import { MediaField } from "@/components/forms/MediaField";
import { ParticipantsField } from "@/components/forms/ParticipantsField";
import { FieldError, errorProps, useFocusFirstError } from "@/components/forms/FieldError";
import { MaterialsField } from "@/components/forms/MaterialsField";
import type { ActionState } from "@/lib/actions/result";
import { useActionForm } from "@/lib/actions/useActionForm";
import type { Lesson, Material, StudioSpace } from "@/lib/types";

export interface LessonDraft {
  date: string;
  time: string;
  groupId?: string;
  participantIds: string[];
  materialIds: string[];
  notes: string;
  media: Lesson["media"];
}

interface LessonFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  space: StudioSpace;
  bank: Material[];
  draft: LessonDraft;
  submitLabel: string;
}

/** One form for new / edit / duplicate lesson. Everything is saved with one submit. */
export function LessonForm({ action, space, bank, draft, submitLabel }: LessonFormProps) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(action);
  useFocusFirstError(state, [
    ["date", `${id}-date`],
    ["time", `${id}-time`],
    ["groupId", `${id}-groupId`],
    ["participants", "participants"],
    ["materials", "materials"],
  ]);
  const err = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="pb-2">
      <fieldset className="card card-section">
        <legend className="card-legend">מתי ומי</legend>
        <div className="grid gap-4 sm:grid-cols-3">
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
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-groupId`} className="font-medium">
              קבוצת השיעור
            </label>
            <select
              id={`${id}-groupId`}
              name="groupId"
              defaultValue={draft.groupId ?? ""}
              {...errorProps(id, "groupId", state, `${id}-group-hint`)}
            >
              <option value="">בלי קבוצה</option>
              {space.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span id={`${id}-group-hint`} className="text-sm text-muted">
              קובעת את הצבע בלוח השנה.
            </span>
            <FieldError id={`${id}-groupId-error`} message={err.groupId} />
          </div>
        </div>
      </fieldset>

      <ParticipantsField pool={space.students} groups={space.groups} initialIds={draft.participantIds} error={err.participants} />
      <MaterialsField bank={bank} initialIds={draft.materialIds} legend="חומרים בשיעור" error={err.materials} />

      <fieldset className="card card-section">
        <legend className="card-legend">הערות</legend>
        <label htmlFor={`${id}-notes`} className="mb-1 block font-medium">
          הערות לשיעור
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

      {/* Save stays within thumb reach on phones. */}
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
