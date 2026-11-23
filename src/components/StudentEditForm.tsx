"use client";

import { useId } from "react";
import { updateStudent } from "@/lib/actions/students";
import { useActionForm } from "@/lib/actions/useActionForm";
import type { Student } from "@/lib/types";

/** Fix a student's name / phone in place (same record: history and payments stay). */
export function StudentEditForm({ student }: { student: Pick<Student, "id" | "name" | "phone" | "parentName" | "parentPhone"> }) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(updateStudent.bind(null, student.id));
  return (
    <>
      <form onSubmit={onSubmit} aria-label={`עריכת הפרטים של ${student.name}`} className="grid gap-3 px-4 pb-4">
        <p id={`${id}-hint`} className="text-sm text-muted">
          לתיקון טעות בשם או בטלפון. ההיסטוריה, ההשתתפויות והתשלומים נשארים על אותה תלמידה. עזיבה אמיתית — ״הסרה מהמאגר״.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-name`} className="font-medium">
              שם <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-name`}
              name="name"
              required
              dir="auto"
              autoComplete="off"
              defaultValue={student.name}
              aria-describedby={`${id}-hint`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-phone`} className="font-medium">
              טלפון <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="off" dir="ltr" defaultValue={student.phone} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-parentName`} className="font-medium">
              שם הורה <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <input id={`${id}-parentName`} name="parentName" dir="auto" autoComplete="off" defaultValue={student.parentName} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-parentPhone`} className="font-medium">
              טלפון הורה <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <input
              id={`${id}-parentPhone`}
              name="parentPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              dir="ltr"
              defaultValue={student.parentPhone}
              aria-describedby={`${id}-parent-hint`}
            />
          </div>
          <p id={`${id}-parent-hint`} className="text-sm text-muted sm:col-span-2">
            איש קשר לתזכורות בלבד. מספר ישראלי מתחיל ב־0; מספר מחו״ל ב־+.
          </p>
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "שומרת…" : "שמירת הפרטים"}
          </button>
        </div>
      </form>
      <p role="status" className="px-4 pb-3 text-sm text-success empty:hidden">
        {state.message}
      </p>
      <p role="status" className="mx-4 mb-3 rounded-2xl bg-coral-soft p-3 text-sm font-medium empty:hidden">
        {state.warning}
      </p>
      <p role="alert" className="px-4 pb-3 text-sm font-medium text-danger empty:hidden">
        {state.error}
      </p>
    </>
  );
}
