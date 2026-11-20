"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { FocusOnHash } from "@/components/FocusOnHash";
import { FieldError } from "@/components/forms/FieldError";
import { activeStudents } from "@/lib/lookup";
import type { Group, Student } from "@/lib/types";

/** A participant: an existing pool student, or a new name to create on save. */
export type ParticipantEntry = { id: string } | { name: string; key: string };

const isExisting = (e: ParticipantEntry): e is { id: string } => "id" in e;

interface ParticipantsFieldProps {
  /** Server error for this section (shown under the legend). */
  error?: string;
  /** Whole pool incl. removed students (for names in history). */
  pool: Student[];
  groups?: Group[];
  initialIds: string[];
}

/**
 * Participants inside the lesson form (no nested forms): insert a group,
 * add from the pool, type a new student. Submitted as JSON in one hidden input.
 */
export function ParticipantsField({ pool, groups = [], initialIds, error }: ParticipantsFieldProps) {
  const id = useId();
  const [entries, setEntries] = useState<ParticipantEntry[]>(() => initialIds.map((sid) => ({ id: sid })));
  const [status, setStatus] = useState("");
  const groupRef = useRef<HTMLSelectElement>(null);
  const studentRef = useRef<HTMLSelectElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  const ids = entries.filter(isExisting).map((e) => e.id);
  const nameOf = (e: ParticipantEntry) => (isExisting(e) ? (pool.find((s) => s.id === e.id)?.name ?? "תלמידה") : e.name);
  const available = activeStudents(pool).filter((s) => !ids.includes(s.id));

  const addGroup = () => {
    const group = groups.find((g) => g.id === groupRef.current?.value);
    if (!group) return;
    const activeIds = new Set(activeStudents(pool).map((s) => s.id));
    const members = group.studentIds.filter((sid) => activeIds.has(sid));
    const toAdd = members.filter((sid) => !ids.includes(sid));
    setEntries((prev) => [...prev, ...toAdd.map((sid) => ({ id: sid }))]);
    const already = members.length - toAdd.length;
    setStatus(
      toAdd.length === 0
        ? `כל חברות ״${group.name}״ כבר ברשימה.`
        : `נוספו ${toAdd.length} מ״${group.name}״` + (already > 0 ? ` (${already} כבר היו ברשימה).` : "."),
    );
  };

  const addFromPool = () => {
    const sid = studentRef.current?.value;
    const student = pool.find((s) => s.id === sid);
    if (!student || ids.includes(student.id)) return;
    setEntries((prev) => [...prev, { id: student.id }]);
    setStatus(`${student.name} נוספה לרשימה.`);
  };

  const addNew = () => {
    const name = (newNameRef.current?.value ?? "").trim().replace(/\s+/g, " ");
    if (!name) {
      newNameRef.current?.focus();
      return;
    }
    const existing = activeStudents(pool).find((s) => s.name === name);
    const pendingSame = entries.some((e) => !isExisting(e) && e.name === name);
    if (existing && ids.includes(existing.id)) setStatus(`${name} כבר ברשימה.`);
    else if (existing) {
      setEntries((prev) => [...prev, { id: existing.id }]);
      setStatus(`${name} כבר במאגר, ונוספה לרשימה.`);
    } else if (pendingSame) setStatus(`${name} כבר ברשימה.`);
    else {
      setEntries((prev) => [...prev, { name, key: crypto.randomUUID() }]);
      setStatus(`${name} נוספה לרשימה ותישמר גם במאגר.`);
    }
    if (newNameRef.current) newNameRef.current.value = "";
  };

  /** Enter in the name field adds the student instead of submitting the whole form (IME-safe). */
  const onNewNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addNew();
    }
  };

  const remove = (entry: ParticipantEntry) => {
    setEntries((prev) => prev.filter((e) => e !== entry));
    setStatus(`${nameOf(entry)} הוסרה מהרשימה.`);
  };

  return (
    <fieldset
      id="participants"
      tabIndex={-1}
      className="card card-section"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? "participants-error" : undefined}
    >
      <FocusOnHash targetId="participants" />
      <legend className="card-legend">משתתפות ({entries.length})</legend>
      <FieldError id="participants-error" message={error} />
      <input type="hidden" name="participants" value={JSON.stringify(entries.map((e) => (isExisting(e) ? { id: e.id } : { name: e.name })))} />

      {entries.length === 0 ? (
        <p className="empty-state mb-5">עדיין אין משתתפות. אפשר להכניס קבוצה, לבחור תלמידה מהמאגר או להקליד תלמידה חדשה.</p>
      ) : (
        <ul className="divider-list mb-5" role="list">
          {entries.map((entry) => (
            <li key={isExisting(entry) ? entry.id : entry.key} className="flex items-center justify-between gap-2 py-1.5">
              <span className="font-medium">
                {nameOf(entry)}
                {!isExisting(entry) && <span className="ms-2 text-sm font-normal text-muted">(חדשה)</span>}
              </span>
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => remove(entry)}>
                הסרה<span className="visually-hidden"> של {nameOf(entry)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-group`} className="font-medium">
              קבוצה
            </label>
            <div className="flex gap-2">
              <select ref={groupRef} id={`${id}-group`} className="min-w-0 flex-1">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.studentIds.length})
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={addGroup}>
                הכנסת קבוצה
              </button>
            </div>
          </div>
        )}

        {available.length === 0 ? (
          <p className="self-end text-sm text-muted">כל התלמידות במאגר כבר ברשימה.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-student`} className="font-medium">
              תלמידה מהמאגר
            </label>
            <div className="flex gap-2">
              <select ref={studentRef} id={`${id}-student`} className="min-w-0 flex-1">
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary btn-compact" onClick={addFromPool}>
                הוספה
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor={`${id}-new`} className="font-medium">
          תלמידה חדשה (לא במאגר)
        </label>
        <span id={`${id}-new-hint`} className="text-sm text-muted">
          תישמר גם במאגר של המרחב.
        </span>
        <div className="flex gap-2">
          <input
            ref={newNameRef}
            id={`${id}-new`}
            dir="auto"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={`${id}-new-hint`}
            className="min-w-0 flex-1"
            onKeyDown={onNewNameKey}
          />
          <button type="button" className="btn btn-secondary btn-compact" onClick={addNew}>
            הוספה<span className="visually-hidden"> של תלמידה חדשה</span>
          </button>
        </div>
      </div>

      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </fieldset>
  );
}
