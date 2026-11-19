"use client";

import { useId, useState } from "react";
import type { MediaItem, MediaKind } from "@/lib/types";

type Entry = { key: string; kind: MediaKind; caption: string };

const tints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

/** Media placeholders inside a form: add (photo/video), caption, remove. No real upload yet. */
export function MediaField({ initial }: { initial: MediaItem[] }) {
  const id = useId();
  const [items, setItems] = useState<Entry[]>(() => initial.map((m) => ({ key: m.id, kind: m.kind, caption: m.caption })));

  const add = (kind: MediaKind) =>
    setItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), kind, caption: kind === "photo" ? `תמונה ${prev.length + 1}` : `סרטון ${prev.length + 1}` },
    ]);

  return (
    <fieldset className="card card-section">
      <legend className="card-legend">מדיה ({items.length})</legend>
      <input type="hidden" name="media" value={JSON.stringify(items.map(({ kind, caption }) => ({ kind, caption })))} />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => add("photo")}>
          + תמונה
        </button>
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => add("video")}>
          + סרטון
        </button>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">אין עדיין תמונות או סרטונים.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {items.map((item, i) => (
            <li key={item.key} className="flex flex-col gap-1">
              <div className={`flex aspect-square items-center justify-center rounded-lg text-4xl ${tints[i % tints.length]}`}>
                <span aria-hidden="true">{item.kind === "video" ? "🎬" : "📷"}</span>
              </div>
              <label htmlFor={`${id}-${item.key}`} className="visually-hidden">
                כיתוב ל{item.kind === "video" ? "סרטון" : "תמונה"} {i + 1}
              </label>
              <input
                id={`${id}-${item.key}`}
                value={item.caption}
                dir="auto"
                autoComplete="off"
                className="text-sm"
                onChange={(e) =>
                  setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, caption: e.target.value } : p)))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => setItems((prev) => prev.filter((p) => p.key !== item.key))}
              >
                הסרה<span className="visually-hidden"> של {item.caption || `פריט ${i + 1}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">אלה מצייני מקום — העלאת קבצים אמיתית תתווסף בשלב הבא.</p>
    </fieldset>
  );
}
