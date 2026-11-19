"use client";

import { useId, useRef, useState } from "react";
import { listenUrl, titleFromLink } from "@/lib/format";
import type { Song } from "@/lib/types";
import { SongArtist, SongTitle } from "@/components/SongText";
import { primaryButton, secondaryButton, sectionClass } from "@/components/lesson/styles";
import { useLocalSongBank } from "@/components/songs/useLocalSongBank";
import { SongLinkField } from "@/components/songs/SongLinkField";

interface SongsSectionProps {
  /** The song bank (from the database). */
  bank: Song[];
  initialSongIds: string[];
  /** Heading, e.g. "שירים בשיעור" / "שירים במפגש". */
  heading: string;
  /** Where songs are added, for status messages, e.g. "לשיעור" / "למפגש". */
  addedTo: string;
}

/**
 * Songs of a lesson/session: pick from the bank, or add a new song by
 * name and/or link — new songs join the (in-memory) bank automatically.
 */
export function SongsSection({ bank: initialBank, initialSongIds, heading, addedTo }: SongsSectionProps) {
  const id = useId();
  const { songs: bank, getSong, addSong } = useLocalSongBank(initialBank);
  const [songIds, setSongIds] = useState(initialSongIds);
  const [status, setStatus] = useState("");
  const [newFormKey, setNewFormKey] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const selected = songIds.flatMap((sid) => getSong(sid) ?? []);
  const available = bank.filter((s) => !songIds.includes(s.id));

  const addExisting = (sid: string) => {
    const song = getSong(sid);
    if (!song || songIds.includes(sid)) return;
    setSongIds((prev) => [...prev, sid]);
    setStatus(`״${song.title}״ נוסף.`);
  };

  const remove = (sid: string) => {
    setSongIds((prev) => prev.filter((s) => s !== sid));
    setStatus(`״${getSong(sid)?.title ?? "השיר"}״ הוסר.`);
  };

  return (
    <section aria-labelledby={`${id}-heading`} className={sectionClass}>
      <h2 id={`${id}-heading`} className="mb-3">
        {heading} ({selected.length})
      </h2>

      {selected.length === 0 ? (
        <p className="empty-state mb-5">עדיין לא נבחרו שירים. אפשר לבחור מהמאגר או להוסיף שיר חדש.</p>
      ) : (
        <ul className="divider-list mb-5" role="list">
          {selected.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  <SongTitle song={song} />
                </span>
                {(song.artist || song.style) && (
                  <span className="text-sm text-muted">
                    {song.artist && <SongArtist song={song} />}
                    {song.artist && song.style && " · "}
                    {song.style}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <a
                  href={listenUrl(song)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-link text-sm text-brand-strong underline underline-offset-4"
                >
                  האזנה
                  <span className="visually-hidden">
                    {" "}
                    ל־<SongTitle song={song} /> (נפתח בלשונית חדשה)
                  </span>
                </a>
                <button type="button" className={secondaryButton} onClick={() => remove(song.id)}>
                  הסרה
                  <span className="visually-hidden">
                    {" "}
                    של <SongTitle song={song} />
                  </span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form
          aria-label="בחירת שיר מהמאגר"
          className="mb-4 flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            addExisting(String(new FormData(e.currentTarget).get("song") ?? ""));
          }}
        >
          <label htmlFor={`${id}-pick`} className="font-medium">
            שיר מהמאגר
          </label>
          <div className="flex gap-2">
            <select id={`${id}-pick`} name="song" className="min-w-0 flex-1">
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.artist ? `${s.title} — ${s.artist}` : s.title}
                </option>
              ))}
            </select>
            <button type="submit" className={secondaryButton}>
              הוספה
            </button>
          </div>
        </form>
      )}

      <details className="disclosure">
        <summary>+ שיר חדש (לא מהמאגר)</summary>
        <form
          key={newFormKey}
          aria-label="הוספת שיר חדש"
          className="grid gap-4 px-4 pb-4"
          // Any edit (name or link) clears the "name or link" requirement error.
          onInput={() => nameRef.current?.setCustomValidity("")}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            const title = String(data.get("title") ?? "").trim();
            const link = String(data.get("link") ?? "").trim();
            if (!title && !link) {
              nameRef.current?.setCustomValidity("יש להזין שם שיר או להדביק לינק.");
              nameRef.current?.reportValidity();
              return;
            }
            const song = addSong({ title: title || titleFromLink(link), link });
            setSongIds((prev) => [...prev, song.id]);
            setStatus(`״${song.title}״ נוסף ${addedTo} ולבנק השירים.`);
            setNewFormKey((k) => k + 1);
          }}
        >
          <p id={`${id}-new-hint`} className="text-sm text-muted">
            מספיק שם או לינק. השיר יתווסף גם לבנק השירים.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-new-title`} className="font-medium">
              שם השיר
            </label>
            <input
              ref={nameRef}
              id={`${id}-new-title`}
              name="title"
              dir="auto"
              autoComplete="off"
              enterKeyHint="next"
              aria-describedby={`${id}-new-hint`}
            />
          </div>
          <SongLinkField />
          <div>
            <button type="submit" className={primaryButton}>
              הוספת השיר
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
