"use client";

import { useId, useState } from "react";
import type { Lesson, MediaItem, Space, Song } from "@/data/demo";
import { SongArtist, SongTitle } from "@/components/SongText";

interface LessonEditorProps {
  space: Space;
  lesson: Lesson;
  lessonSongs: Song[];
}

/**
 * Interactive lesson view. All state is in memory only (demo stage):
 * changes are lost on refresh.
 */
export function LessonEditor({ space, lesson, lessonSongs }: LessonEditorProps) {
  return (
    <>
      <AttendanceSection space={space} initial={lesson.attendance} />
      <SongsSection songs={lessonSongs} />
      <NotesSection initial={lesson.notes} />
      <MediaSection initial={lesson.media} />
    </>
  );
}

const sectionClass = "mb-8 rounded-xl border border-border bg-surface p-4 sm:p-5";
const secondaryButton =
  "rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-brand-soft";
const primaryButton =
  "rounded-lg bg-brand px-4 py-2 font-semibold text-on-brand hover:bg-brand-strong";

// ---------- Attendance ----------

function AttendanceSection({ space, initial }: { space: Space; initial: string[] }) {
  const baseId = useId();
  const [present, setPresent] = useState<Set<string>>(() => new Set(initial));

  const toggle = (studentId: string, checked: boolean) => {
    setPresent((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  return (
    <section aria-labelledby={`${baseId}-heading`} className={sectionClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${baseId}-heading`} className="text-xl font-semibold">
          נוכחות
        </h2>
        <p className="text-sm text-muted">
          {present.size} מתוך {space.students.length} נוכחות
        </p>
      </div>

      <fieldset>
        <legend className="visually-hidden">סימון נוכחות מתוך מאגר התלמידות של {space.name}</legend>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setPresent(new Set(space.students.map((s) => s.id)))}
          >
            סימון כולן
          </button>
          <button type="button" className={secondaryButton} onClick={() => setPresent(new Set())}>
            ניקוי הסימון
          </button>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {space.students.map((student) => {
            const id = `${baseId}-${student.id}`;
            const checked = present.has(student.id);
            return (
              <label
                key={student.id}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-soft has-checked:font-semibold"
              >
                <input
                  type="checkbox"
                  id={id}
                  name="attendance"
                  value={student.id}
                  checked={checked}
                  onChange={(e) => toggle(student.id, e.target.checked)}
                />
                <span>{student.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}

// ---------- Songs ----------

function SongsSection({ songs }: { songs: Song[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={sectionClass}>
      <h2 id={headingId} className="mb-3 text-xl font-semibold">
        שירים בשיעור
      </h2>
      {songs.length === 0 ? (
        <p className="text-muted">לא נבחרו שירים לשיעור הזה.</p>
      ) : (
        <ul className="divide-y divide-border" role="list">
          {songs.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="block font-medium">
                  <SongTitle song={song} />
                </span>
                <span className="text-sm text-muted">
                  <SongArtist song={song} /> · {song.style}
                </span>
              </span>
              <a
                href={song.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-strong underline underline-offset-4"
              >
                האזנה
                <span className="visually-hidden">
                  {" "}
                  ל־<SongTitle song={song} /> (נפתח בלשונית חדשה)
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">בחירת שירים מתוך הבנק תתווסף בשלב הבא.</p>
    </section>
  );
}

// ---------- Notes ----------

function NotesSection({ initial }: { initial: string }) {
  const baseId = useId();
  const [notes, setNotes] = useState(initial);
  const [status, setStatus] = useState("");

  return (
    <section aria-labelledby={`${baseId}-heading`} className={sectionClass}>
      <h2 id={`${baseId}-heading`} className="mb-3 text-xl font-semibold">
        הערות
      </h2>
      <form
        aria-labelledby={`${baseId}-heading`}
        onSubmit={(e) => {
          e.preventDefault();
          setStatus("ההערות נשמרו (דמו — יימחקו ברענון הדף).");
        }}
      >
        <label htmlFor={`${baseId}-notes`} className="mb-1 block font-medium">
          הערות לשיעור
        </label>
        <p id={`${baseId}-hint`} className="mb-2 text-sm text-muted">
          מה עבדנו עליו, למה לשים לב בפעם הבאה.
        </p>
        <textarea
          id={`${baseId}-notes`}
          name="notes"
          rows={5}
          aria-describedby={`${baseId}-hint`}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setStatus("");
          }}
          className="mb-3 block w-full"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton}>
            שמירת הערות
          </button>
          <p role="status" className="text-sm text-success">
            {status}
          </p>
        </div>
      </form>
    </section>
  );
}

// ---------- Media ----------

const placeholderTints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

function MediaSection({ initial }: { initial: MediaItem[] }) {
  const headingId = useId();
  const [items, setItems] = useState(initial);

  const addPlaceholder = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${prev.length + 1}`, kind: "photo", caption: `תמונה חדשה ${prev.length + 1}` },
    ]);
  };

  return (
    <section aria-labelledby={headingId} className={sectionClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          מדיה ({items.length})
        </h2>
        <button type="button" className={secondaryButton} onClick={addPlaceholder}>
          + הוספת תמונה (דמו)
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted">אין עדיין תמונות או סרטונים מהשיעור.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {items.map((item, i) => (
            <li key={item.id}>
              <figure>
                <div
                  className={`flex aspect-square items-center justify-center rounded-lg text-4xl ${placeholderTints[i % placeholderTints.length]}`}
                >
                  <span aria-hidden="true">{item.kind === "video" ? "🎬" : "📷"}</span>
                </div>
                <figcaption className="mt-1 text-sm">
                  <span className="visually-hidden">{item.kind === "video" ? "סרטון: " : "תמונה: "}</span>
                  {item.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">אלה מצייני מקום — העלאת קבצים אמיתית תתווסף בשלב הבא.</p>
    </section>
  );
}
