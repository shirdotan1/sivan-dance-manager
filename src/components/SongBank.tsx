"use client";

import { useId, useState } from "react";
import { listenUrl } from "@/lib/format";
import type { Song } from "@/lib/types";
import { SongArtist, SongTitle } from "@/components/SongText";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SongForm } from "@/components/songs/SongForm";
import { createSong, deleteSong, updateSong } from "@/lib/actions/songs";

export function SongBank({ songs }: { songs: Song[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = q
    ? songs.filter((s) =>
        [s.title, s.artist, s.style, s.note ?? ""].some((field) => field.toLowerCase().includes(q)),
      )
    : songs;

  return (
    <>
      <details className="disclosure mb-8">
        <summary>+ הוספת שיר לבנק</summary>
        <SongForm action={createSong} submitLabel="הוספה לבנק" label="הוספת שיר לבנק" />
      </details>

      <search className="mb-4 block">
        <form onSubmit={(e) => e.preventDefault()}>
          <label htmlFor={searchId} className="mb-1 block font-medium">
            חיפוש שיר, מבצע/ת, סגנון או הערה
          </label>
          <input
            id={searchId}
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            dir="auto"
            className="w-full"
          />
        </form>
      </search>

      <p role="status" className="mb-3 text-sm text-muted">
        {visible.length === songs.length
          ? `${songs.length} שירים בבנק`
          : `נמצאו ${visible.length} מתוך ${songs.length} שירים`}
      </p>

      {visible.length === 0 && (
        <p className="empty-state">
          לא נמצאו שירים עבור ״<bdi>{query.trim()}</bdi>״. אפשר לנסות מילה אחרת, או להוסיף את השיר לבנק בטופס
          שלמעלה.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="grid gap-4" role="list">
          {visible.map((song) => (
            <li
              key={song.id}
              className="card flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <h2>
                  <SongTitle song={song} />
                </h2>
                {song.artist && (
                  <p className="text-muted">
                    <SongArtist song={song} />
                  </p>
                )}
                {song.style && (
                  <p className="mt-1">
                    <span className="chip">
                      {song.style}
                    </span>
                  </p>
                )}
                {song.note && (
                  <p className="mt-3 border-s-2 border-coral ps-3 text-sm">
                    <span className="visually-hidden">הערה: </span>
                    <bdi>{song.note}</bdi>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={listenUrl(song)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-compact"
                >
                  {song.link ? "האזנה" : "חיפוש ביוטיוב"}
                  <span className="visually-hidden">
                    {" "}
                    ל־<SongTitle song={song} /> (נפתח בלשונית חדשה)
                  </span>
                </a>
                <ConfirmDialog
                  triggerLabel="מחיקה"
                  triggerContext={`של ${song.title}`}
                  title={`למחוק את ״${song.title}״ מהבנק?`}
                  description={<p>השיר יוסר גם מכל השיעורים והמפגשים שבהם הוא מופיע.</p>}
                  confirmLabel="מחיקת השיר"
                  onConfirm={() => deleteSong(song.id)}
                />
              </div>
              <details className="disclosure basis-full">
                <summary>
                  עריכה<span className="visually-hidden"> של {song.title}</span>
                </summary>
                <SongForm
                  action={updateSong.bind(null, song.id)}
                  song={song}
                  submitLabel="שמירת השיר"
                  label={`עריכת ${song.title}`}
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
