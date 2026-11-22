"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StudentEditForm } from "@/components/StudentEditForm";
import { StudentLink } from "@/components/StudentLink";
import { addStudent, removeStudentFromPool } from "@/lib/actions/students";
import { useActionForm } from "@/lib/actions/useActionForm";
import type { Student } from "@/lib/types";

/** The space's pool: list with tap-to-call phones, remove (with confirm), and add. */
export function PoolManager({ spaceId, students }: { spaceId: string; students: Student[] }) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(addStudent.bind(null, spaceId));
  /** Which row's edit form is open (one at a time). */
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      {students.length === 0 ? (
        <p className="empty-state mb-4">אין עדיין תלמידות במאגר. אפשר להוסיף בטופס למטה.</p>
      ) : (
        <ul className="divider-list" role="list">
          {students.map((student) => (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
              <StudentLink student={student} className="font-medium" />
              <span className="flex items-center gap-2">
                {student.phone && (
                  <a
                    href={`tel:${student.phone.replaceAll("-", "")}`}
                    dir="ltr"
                    className="tap-link text-brand-strong underline underline-offset-4"
                  >
                    {student.phone}
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  aria-expanded={editing === student.id}
                  aria-controls={`${id}-edit-${student.id}`}
                  onClick={() => setEditing((cur) => (cur === student.id ? null : student.id))}
                >
                  עריכה<span className="visually-hidden"> של {student.name}</span>
                </button>
                <ConfirmDialog
                  triggerLabel="הסרה"
                  triggerContext={`של ${student.name} מהמאגר`}
                  title={`להסיר את ${student.name} מהמאגר?`}
                  description={
                    <p>
                      היא לא תופיע יותר במאגר ובבחירת משתתפות. שיעורים, מפגשים ותשלומים קודמים שלה נשמרים.
                    </p>
                  }
                  confirmLabel="הסרה מהמאגר"
                  onConfirm={() => removeStudentFromPool(student.id)}
                />
              </span>
              {editing === student.id && (
                <div id={`${id}-edit-${student.id}`} className="disclosure mb-2 basis-full pt-3">
                  <StudentEditForm student={student} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="disclosure mt-4">
        <summary>+ הוספת תלמידה למאגר</summary>
        <form key={state.done} onSubmit={onSubmit} aria-label="הוספת תלמידה למאגר" className="grid gap-3 px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-name`} className="font-medium">
                שם התלמידה <span aria-hidden="true">*</span>
              </label>
              <input id={`${id}-name`} name="name" required dir="auto" autoComplete="off" enterKeyHint="next" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-phone`} className="font-medium">
                טלפון <span className="font-normal text-muted">(לא חובה)</span>
              </label>
              <input
                id={`${id}-phone`}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                dir="ltr"
                enterKeyHint="done"
              />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "שומרת…" : "הוספה למאגר"}
            </button>
          </div>
        </form>
      </details>
      <p role="status" className="mt-2 text-sm text-success empty:hidden">
        {state.message}
      </p>
      <p role="status" className="mt-2 rounded-2xl bg-coral-soft p-3 text-sm font-medium empty:hidden">
        {state.warning}
      </p>
      <p role="alert" className="mt-2 text-sm font-medium text-danger empty:hidden">
        {state.error}
      </p>
    </>
  );
}
