"use client";

import { useId, useState } from "react";
import { listenUrl } from "@/data/demo";
import { SongArtist, SongTitle } from "@/components/SongText";
import { useSongBank } from "@/components/songs/SongBankProvider";
import { SongLinkField } from "@/components/songs/SongLinkField";

export function SongBank() {
  const { songs } = useSongBank();
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
      <AddSongForm />

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
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AddSongForm() {
  const { addSong } = useSongBank();
  const id = useId();
  const [status, setStatus] = useState("");
  // Remount the fields after a successful add to clear them and their error state.
  const [formKey, setFormKey] = useState(0);

  return (
    <details className="disclosure mb-8">
      <summary>+ הוספת שיר לבנק</summary>
      <form
        key={formKey}
        aria-label="הוספת שיר לבנק"
        className="grid gap-4 px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const song = addSong({
            title: String(data.get("title") ?? ""),
            artist: String(data.get("artist") ?? ""),
            style: String(data.get("style") ?? ""),
            link: String(data.get("link") ?? ""),
            note: String(data.get("note") ?? ""),
          });
          setStatus(`״${song.title}״ נוסף לבנק השירים.`);
          setFormKey((k) => k + 1);
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="font-medium">
            שם השיר <span aria-hidden="true">*</span>
          </label>
          <input id={`${id}-name`} name="title" required dir="auto" autoComplete="off" enterKeyHint="next" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-artist`} className="font-medium">
              מבצע/ת
            </label>
            <input id={`${id}-artist`} name="artist" dir="auto" autoComplete="off" enterKeyHint="next" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-style`} className="font-medium">
              סגנון
            </label>
            <input id={`${id}-style`} name="style" autoComplete="off" enterKeyHint="next" />
          </div>
        </div>
        <SongLinkField />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="font-medium">
            הערה אישית
          </label>
          <textarea id={`${id}-note`} name="note" rows={2} dir="auto" />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
          >
            הוספה לבנק
          </button>
        </div>
      </form>
      <p role="status" className="px-4 pb-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </details>
  );
}
