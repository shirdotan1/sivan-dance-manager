"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { FieldError, errorProps, useFocusFirstError } from "@/components/forms/FieldError";
import { createSeries, type SeriesFormState } from "@/lib/actions/series";
import { formatDate, WEEKDAYS } from "@/lib/format";
import type { Group } from "@/lib/types";

/**
 * New weekly slot, in two steps: "בדיקה" shows what will happen (lessons to
 * create for the next 8 weeks, existing lessons that will be linked instead
 * of duplicated); "יצירת המשבצת" saves exactly that.
 */
export function SeriesForm({ spaceId, groups, today }: { spaceId: string; groups: Group[]; today: string }) {
  const id = useId();
  const [state, dispatch, pending] = useActionState<SeriesFormState, FormData>(createSeries.bind(null, spaceId), {});
  const [stale, setStale] = useState(false);
  useFocusFirstError(state, [
    ["weekday", `${id}-weekday`],
    ["time", `${id}-time`],
    ["startsOn", `${id}-startsOn`],
    ["groupId", `${id}-groupId`],
  ]);
  const err = state.fieldErrors ?? {};
  const preview = !stale ? state.preview : undefined;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setStale(false);
    startTransition(() => dispatch(fd));
  }

  return (
    <>
      <form
        key={state.done}
        onSubmit={onSubmit}
        onChange={() => setStale(true)}
        aria-label="משבצת שבועית חדשה"
        className="grid gap-4 px-4 pb-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-weekday`} className="font-medium">
              יום בשבוע <span aria-hidden="true">*</span>
            </label>
            <select id={`${id}-weekday`} name="weekday" required defaultValue="" {...errorProps(id, "weekday", state)}>
              <option value="" disabled>
                בחירת יום
              </option>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  יום {d}
                </option>
              ))}
            </select>
            <FieldError id={`${id}-weekday-error`} message={err.weekday} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-time`} className="font-medium">
              שעה <span aria-hidden="true">*</span>
            </label>
            <input id={`${id}-time`} name="time" type="time" required step={300} {...errorProps(id, "time", state)} />
            <FieldError id={`${id}-time-error`} message={err.time} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-groupId`} className="font-medium">
              קבוצה <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <select id={`${id}-groupId`} name="groupId" defaultValue="" {...errorProps(id, "groupId", state, `${id}-group-hint`)}>
              <option value="">בלי קבוצה</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span id={`${id}-group-hint`} className="text-sm text-muted">
              צבע ושם בלוח השנה. משתתפות לא מתמלאות מראש.
            </span>
            <FieldError id={`${id}-groupId-error`} message={err.groupId} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-startsOn`} className="font-medium">
              החל מתאריך <span aria-hidden="true">*</span>
            </label>
            <input id={`${id}-startsOn`} name="startsOn" type="date" required defaultValue={today} {...errorProps(id, "startsOn", state)} />
            <FieldError id={`${id}-startsOn-error`} message={err.startsOn} />
          </div>
        </div>

        {preview && (
          <div role="region" aria-label="תצוגה מקדימה" className="rounded-2xl border border-border p-4">
            <p className="font-medium">
              כל יום {WEEKDAYS[preview.weekday]} בשעה <bdi dir="ltr">{preview.time}</bdi>, החל מ־{formatDate(preview.startsOn)}
            </p>
            <ul className="mt-2 list-disc ps-5 text-sm">
              <li>
                {preview.create > 0
                  ? `ייווצרו ${preview.create} שיעורים עד ${formatDate(preview.until)} (8 שבועות קדימה; ממשיך להתחדש).`
                  : "לא ייווצרו שיעורים חדשים בשמונת השבועות הקרובים."}
              </li>
              {preview.adopt.length > 0 && (
                <li>
                  {preview.adopt.length === 1 ? "שיעור קיים אחד יצורף" : `${preview.adopt.length} שיעורים קיימים יצורפו`} למשבצת במקום
                  שייווצר כפל: {preview.adopt.map((a) => formatDate(a.date)).join(", ")}.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="preview" className={preview ? "btn btn-secondary" : "btn btn-primary"} disabled={pending}>
            {pending ? "בודקת…" : preview ? "בדיקה מחדש" : "בדיקה"}
          </button>
          {preview && (
            <button type="submit" name="intent" value="create" className="btn btn-primary" disabled={pending}>
              יצירת המשבצת
            </button>
          )}
        </div>
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {state.error}
        </p>
      </form>
      <p role="status" className="px-4 pb-3 text-sm text-success empty:hidden">
        {state.message}
      </p>
    </>
  );
}
