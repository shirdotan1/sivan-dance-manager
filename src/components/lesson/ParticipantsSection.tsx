"use client";

import { useId, useState } from "react";
import type { Group, Student } from "@/lib/types";
import { primaryButton, secondaryButton, sectionClass } from "@/components/lesson/styles";

interface ParticipantsSectionProps {
  /** The space's student pool. */
  pool: Student[];
  /** Groups to insert in one go (studio spaces only). */
  groups?: Group[];
  participantIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Who actually took part: add a whole group, add one student from the pool,
 * type in a new student who isn't in the pool yet, remove anyone.
 * New students join this page's pool in memory only (demo).
 */
export function ParticipantsSection({ pool, groups = [], participantIds, onChange }: ParticipantsSectionProps) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [newStudents, setNewStudents] = useState<Student[]>([]);
  const [newFormKey, setNewFormKey] = useState(0);

  const allStudents = [...pool, ...newStudents];
  const nameOf = (sid: string) => allStudents.find((s) => s.id === sid)?.name ?? "תלמידה";
  // Students removed from the pool keep their name in history but are never offered.
  const available = allStudents.filter((s) => !s.archived && !participantIds.includes(s.id));

  const addGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const toAdd = group.studentIds.filter((sid) => !participantIds.includes(sid));
    const already = group.studentIds.length - toAdd.length;
    onChange([...participantIds, ...toAdd]);
    if (toAdd.length === 0) {
      setStatus(`כל חברות ״${group.name}״ כבר ברשימה.`);
    } else {
      setStatus(
        `נוספו ${toAdd.length} מ״${group.name}״` + (already > 0 ? ` (${already} כבר היו ברשימה).` : "."),
      );
    }
  };

  const addStudent = (sid: string) => {
    if (!sid || participantIds.includes(sid)) return;
    onChange([...participantIds, sid]);
    setStatus(`${nameOf(sid)} נוספה לרשימה.`);
  };

  /** Adds a typed-in name; reuses an existing student with the same name instead of duplicating. */
  const addNewStudent = (rawName: string) => {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const existing = allStudents.find((s) => !s.archived && s.name === name);
    if (existing) {
      if (participantIds.includes(existing.id)) {
        setStatus(`${name} כבר ברשימה.`);
      } else {
        onChange([...participantIds, existing.id]);
        setStatus(`${name} כבר במאגר, ונוספה לרשימה.`);
      }
    } else {
      const student: Student = { id: `new-${crypto.randomUUID()}`, name, phone: "" };
      setNewStudents((prev) => [...prev, student]);
      onChange([...participantIds, student.id]);
      setStatus(`${name} נוספה לשיעור ולמאגר.`);
    }
    setNewFormKey((k) => k + 1);
  };

  const remove = (sid: string) => {
    onChange(participantIds.filter((p) => p !== sid));
    setStatus(`${nameOf(sid)} הוסרה מהרשימה.`);
  };

  return (
    <section aria-labelledby={`${id}-heading`} className={sectionClass}>
      <h2 id={`${id}-heading`} className="mb-3">
        משתתפות ({participantIds.length})
      </h2>

      {participantIds.length === 0 ? (
        <p className="empty-state mb-5">עדיין אין משתתפות. אפשר להכניס קבוצה, לבחור תלמידה מהמאגר או להקליד תלמידה חדשה.</p>
      ) : (
        <ul className="divider-list mb-5" role="list">
          {participantIds.map((sid) => (
            <li key={sid} className="flex items-center justify-between gap-2 py-1.5">
              <span className="font-medium">{nameOf(sid)}</span>
              <button type="button" className={secondaryButton} onClick={() => remove(sid)}>
                הסרה<span className="visually-hidden"> של {nameOf(sid)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.length > 0 && (
          <form
            aria-label="הכנסת קבוצה"
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              addGroup(String(new FormData(e.currentTarget).get("group")));
            }}
          >
            <label htmlFor={`${id}-group`} className="font-medium">
              קבוצה
            </label>
            <div className="flex gap-2">
              <select id={`${id}-group`} name="group" className="min-w-0 flex-1">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.studentIds.length})
                  </option>
                ))}
              </select>
              <button type="submit" className={primaryButton}>
                הכנסת קבוצה
              </button>
            </div>
          </form>
        )}

        {available.length === 0 ? (
          <p className="self-end text-sm text-muted">כל התלמידות במאגר כבר ברשימה.</p>
        ) : (
          <form
            aria-label="הוספת תלמידה"
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              addStudent(String(new FormData(e.currentTarget).get("student") ?? ""));
            }}
          >
            <label htmlFor={`${id}-student`} className="font-medium">
              תלמידה מהמאגר
            </label>
            <div className="flex gap-2">
              <select id={`${id}-student`} name="student" className="min-w-0 flex-1">
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="submit" className={secondaryButton}>
                הוספה
              </button>
            </div>
          </form>
        )}
      </div>

      <details className="disclosure mt-4">
        <summary>+ תלמידה חדשה (לא במאגר)</summary>
        <form
          key={newFormKey}
          aria-label="הוספת תלמידה חדשה"
          className="grid gap-3 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            addNewStudent(String(new FormData(e.currentTarget).get("name") ?? ""));
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-new-name`} className="font-medium">
              שם התלמידה <span aria-hidden="true">*</span>
            </label>
            <span id={`${id}-new-hint`} className="text-sm text-muted">
              תתווסף לשיעור הזה ולמאגר (דמו — עד רענון הדף).
            </span>
            <input
              id={`${id}-new-name`}
              name="name"
              required
              dir="auto"
              autoComplete="off"
              enterKeyHint="done"
              aria-describedby={`${id}-new-hint`}
            />
          </div>
          <div>
            <button type="submit" className={primaryButton}>
              הוספה לשיעור
            </button>
          </div>
        </form>
      </details>

      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </section>
  );
}
