"use client";

import { useId, useState } from "react";
import { primaryButton, sectionClass } from "@/components/lesson/styles";

/** Notes form with a demo "save" (memory only). */
export function NotesSection({ initial, label }: { initial: string; label: string }) {
  const baseId = useId();
  const [notes, setNotes] = useState(initial);
  const [status, setStatus] = useState("");

  return (
    <section aria-labelledby={`${baseId}-heading`} className={sectionClass}>
      <h2 id={`${baseId}-heading`} className="mb-3">
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
          {label}
        </label>
        <p id={`${baseId}-hint`} className="mb-2 text-sm text-muted">
          מה עבדנו עליו, למה לשים לב בפעם הבאה.
        </p>
        <textarea
          id={`${baseId}-notes`}
          name="notes"
          rows={5}
          dir="auto"
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
