"use client";

import { useId, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { secondaryButton, sectionClass } from "@/components/lesson/styles";

const placeholderTints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

/** Placeholder media grid; "add" appends a placeholder tile (no real upload). */
export function MediaSection({ initial }: { initial: MediaItem[] }) {
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
        <h2 id={headingId}>
          מדיה ({items.length})
        </h2>
        <button type="button" className={secondaryButton} onClick={addPlaceholder}>
          + הוספת תמונה (דמו)
        </button>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">אין עדיין תמונות או סרטונים. אפשר להוסיף תמונה בכפתור למעלה.</p>
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
