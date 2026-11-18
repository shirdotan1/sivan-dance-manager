"use client";

import { useId, useState } from "react";
import type { Group, Student } from "@/data/demo";
import { primaryButton, secondaryButton, sectionClass } from "@/components/lesson/styles";

interface ParticipantsSectionProps {
  /** The space's student pool. */
  pool: Student[];
  /** Groups to insert in one go (studio spaces only). */
  groups?: Group[];
  participantIds: string[];
  onChange: (ids: string[]) => void;
}

/** Who actually took part: add a whole group, add one student, remove anyone. */
export function ParticipantsSection({ pool, groups = [], participantIds, onChange }: ParticipantsSectionProps) {
  const id = useId();
  const [status, setStatus] = useState("");

  const nameOf = (sid: string) => pool.find((s) => s.id === sid)?.name ?? "תלמידה";
  const available = pool.filter((s) => !participantIds.includes(s.id));

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
        <p className="mb-4 text-muted">עדיין אין משתתפות. אפשר להכניס קבוצה או להוסיף תלמידה.</p>
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

      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </section>
  );
}
