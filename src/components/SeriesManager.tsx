"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { FieldError, errorProps, useFocusFirstError } from "@/components/forms/FieldError";
import { changeSeries, createSeries, type SeriesChangeState, type SeriesFormState } from "@/lib/actions/series";
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
  const groupName = (gid: string | null) => (gid ? (groups.find((g) => g.id === gid)?.name ?? "קבוצה") : "בלי קבוצה");
  const mismatches = preview?.adopt.filter((a) => a.groupId !== preview.groupId) ?? [];

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
                {preview.create.length > 0
                  ? `ייווצרו ${preview.create.length} שיעורים עד ${formatDate(preview.until)} (8 שבועות קדימה; ממשיך להתחדש).`
                  : "לא ייווצרו שיעורים חדשים בשמונת השבועות הקרובים."}
              </li>
              {preview.adopt.length > 0 && (
                <li>
                  {preview.adopt.length === 1 ? "שיעור קיים אחד יצורף" : `${preview.adopt.length} שיעורים קיימים יצורפו`} למשבצת במקום
                  שייווצר כפל: {preview.adopt.map((a) => formatDate(a.date)).join(", ")}.
                </li>
              )}
              {preview.conflicts.map((c) => (
                <li key={c.date} className="font-medium text-danger">
                  התנגשות ב־{formatDate(c.date)}:{" "}
                  {c.kind === "ambiguous"
                    ? `יש ${c.lessonIds.length} שיעורים באותה שעה, ולא ברור לאיזה מהם לצרף.`
                    : "כבר יש באותה שעה שיעור של משבצת שבועית אחרת."}
                </li>
              ))}
              {mismatches.map((a) => (
                <li key={a.id}>
                  בשיעור של {formatDate(a.date)} הקבוצה היא ״{groupName(a.groupId)}״ ובמשבצת ״{groupName(preview.groupId)}״ — הקבוצה של
                  השיעור נשארת כפי שהיא; הצירוף רק מקשר.
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="preview" className={preview ? "btn btn-secondary" : "btn btn-primary"} disabled={pending}>
            {pending ? "בודקת…" : preview ? "בדיקה מחדש" : "בדיקה"}
          </button>
          {preview && preview.conflicts.length === 0 && (
            <button type="submit" name="intent" value="create" className="btn btn-primary" disabled={pending}>
              יצירת המשבצת
            </button>
          )}
        </div>
        {preview && preview.conflicts.length > 0 && (
          <p className="text-sm font-medium">אי אפשר ליצור את המשבצת כל עוד יש התנגשויות. אפשר לבחור שעה או יום אחרים, או להתחיל מתאריך מאוחר יותר.</p>
        )}
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

const WHY: Record<"content" | "moved" | "cancelled" | "stop", string> = {
  content: "יש בו תוכן",
  moved: "הוזז ידנית",
  cancelled: "מבוטל",
  stop: "",
};

/**
 * "שינוי המשבצת מכאן והלאה" on one slot: time, day (and time) or stop, from an
 * effective date (default: the slot's next lesson). Two steps: "בדיקה" shows
 * exactly what changes; the confirm button applies exactly that.
 */
export function SeriesChangeForm({
  spaceId,
  seriesId,
  weekday,
  time,
  nextDate,
  today,
}: {
  spaceId: string;
  seriesId: string;
  weekday: number;
  time: string;
  nextDate: string;
  today: string;
}) {
  const id = useId();
  const [state, dispatch, pending] = useActionState<SeriesChangeState, FormData>(changeSeries.bind(null, spaceId, seriesId), {});
  const [kind, setKind] = useState<"time" | "day" | "stop">("time");
  const [stale, setStale] = useState(false);
  useFocusFirstError(state, [
    ["kind", `${id}-kind-time`],
    ["from", `${id}-from`],
    ["time", `${id}-time`],
    ["weekday", `${id}-weekday`],
  ]);
  const err = state.fieldErrors ?? {};
  const p = !stale ? state.preview : undefined;
  const list = (xs: { date: string }[]) => xs.map((x) => formatDate(x.date)).join(", ");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setStale(false);
    startTransition(() => dispatch(fd));
  }

  const confirmLabel = kind === "stop" ? "עצירת המשבצת" : kind === "time" ? "שינוי השעה" : "העברת המשבצת";

  return (
    <>
      <form key={state.done} onSubmit={onSubmit} onChange={() => setStale(true)} aria-label="שינוי המשבצת מכאן והלאה" className="grid gap-4 px-4 pb-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 font-medium">מה משנים</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup">
            {(
              [
                ["time", "שעה"],
                ["day", "יום (ושעה)"],
                ["stop", "עצירת המשבצת"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" id={`${id}-kind-${value}`} name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                {label}
              </label>
            ))}
          </div>
          <FieldError id={`${id}-kind-error`} message={err.kind} />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-from`} className="font-medium">
              החל מתאריך <span aria-hidden="true">*</span>
            </label>
            <input id={`${id}-from`} name="from" type="date" required min={today} defaultValue={nextDate} {...errorProps(id, "from", state)} />
            <FieldError id={`${id}-from-error`} message={err.from} />
          </div>
          {kind === "day" && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-weekday`} className="font-medium">
                יום חדש <span aria-hidden="true">*</span>
              </label>
              <select id={`${id}-weekday`} name="weekday" required defaultValue={String(weekday)} {...errorProps(id, "weekday", state)}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    יום {d}
                  </option>
                ))}
              </select>
              <FieldError id={`${id}-weekday-error`} message={err.weekday} />
            </div>
          )}
          {kind !== "stop" && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-time`} className="font-medium">
                {kind === "time" ? "שעה חדשה" : "שעה"} <span aria-hidden="true">*</span>
              </label>
              <input id={`${id}-time`} name="time" type="time" required step={300} defaultValue={time} {...errorProps(id, "time", state)} />
              <FieldError id={`${id}-time-error`} message={err.time} />
            </div>
          )}
        </div>

        {p && (
          <div role="region" aria-label="תצוגה מקדימה של השינוי" className="rounded-2xl border border-border p-4 text-sm">
            <ul className="list-disc ps-5">
              {p.kind === "time" && (
                <>
                  <li>
                    מ־{formatDate(p.from)}: {p.retime.length} שיעורים יעברו לשעה <bdi dir="ltr">{p.time}</bdi>.
                  </li>
                  {p.protectedTime.length > 0 && (
                    <li>
                      שעתם שונתה ידנית ותישאר כמו שהיא:{" "}
                      {p.protectedTime.map((x) => `${formatDate(x.date)} (${x.time})`).join(", ")}.
                    </li>
                  )}
                  {p.cancelled.length > 0 && <li>מבוטלים שיישארו מבוטלים: {list(p.cancelled)}.</li>}
                  <li>השיעורים שייווצרו מעכשיו והלאה יהיו בשעה החדשה.</li>
                </>
              )}
              {p.kind === "day" && p.next && (
                <>
                  <li>
                    המשבצת של יום {WEEKDAYS[p.current.weekday]} תיעצר מ־{formatDate(p.from)}, ותיפתח משבצת ביום {WEEKDAYS[p.weekday!]} בשעה{" "}
                    <bdi dir="ltr">{p.time}</bdi>.
                  </li>
                  <li>{p.remove.length > 0 ? `יוסרו ${p.remove.length} שיעורים ריקים: ${list(p.remove)}.` : "לא יוסרו שיעורים."}</li>
                  {p.keep.length > 0 && (
                    <li>
                      יישארו כמו שהם: {p.keep.map((k) => `${formatDate(k.date)} (${WHY[k.why]})`).join(", ")}.
                    </li>
                  )}
                  <li>ייווצרו {p.next.create.length} שיעורים ביום החדש.</li>
                  {p.next.adopt.length > 0 && <li>שיעורים קיימים שיצורפו למשבצת החדשה: {list(p.next.adopt)}.</li>}
                </>
              )}
              {p.kind === "stop" && (
                <li>
                  מ־{formatDate(p.from)} לא ייווצרו שיעורים חדשים.{" "}
                  {p.keep.length > 0 ? `${p.keep.length} שיעורים שכבר קיימים מהתאריך הזה יישארו כמו שהם: ${list(p.keep)}.` : "אין שיעורים קיימים מהתאריך הזה."}
                </li>
              )}
              {p.conflicts.map((c) => (
                <li key={c.date} className="font-medium text-danger">
                  התנגשות ב־{formatDate(c.date)}: {c.kind === "other-series" ? "באותה שעה כבר יש שיעור של משבצת אחרת." : "באותה שעה כבר יש שיעור אחר."}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="preview" className={p ? "btn btn-secondary" : "btn btn-primary"} disabled={pending}>
            {pending ? "בודקת…" : p ? "בדיקה מחדש" : "בדיקה"}
          </button>
          {p && p.conflicts.length === 0 && (
            <button type="submit" name="intent" value="apply" className="btn btn-primary" disabled={pending}>
              {confirmLabel}
            </button>
          )}
        </div>
        {p && p.conflicts.length > 0 && <p className="text-sm font-medium">אי אפשר לשמור את השינוי כל עוד יש התנגשויות.</p>}
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
