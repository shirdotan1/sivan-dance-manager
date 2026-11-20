"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { SongArtist, SongTitle } from "@/components/SongText";
import { SongLinkField } from "@/components/songs/SongLinkField";
import { guessLang, isSongLink, listenUrl, titleFromLink } from "@/lib/format";
import type { Song } from "@/lib/types";

/** A song: from the bank, or a new one (title and/or link) created on save. */
export type SongEntry = { id: string } | { title: string; link: string; key: string };

const isExisting = (e: SongEntry): e is { id: string } => "id" in e;

/** Songs inside the lesson/session form: pick from the bank or add a new song (joins the bank on save). */
export function SongsField({ bank, initialIds, legend }: { bank: Song[]; initialIds: string[]; legend: string }) {
  const id = useId();
  const [entries, setEntries] = useState<SongEntry[]>(() => initialIds.map((sid) => ({ id: sid })));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pickRef = useRef<HTMLSelectElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const ids = entries.filter(isExisting).map((e) => e.id);
  const available = bank.filter((s) => !ids.includes(s.id));
  /** Display shape for an entry (new songs get a provisional Song). */
  const asSong = (e: SongEntry): Song | undefined =>
    isExisting(e)
      ? bank.find((s) => s.id === e.id)
      : {
          id: e.key,
          title: e.title || titleFromLink(e.link),
          artist: "",
          style: "",
          ...(e.link ? { link: e.link } : {}),
          titleLang: guessLang(e.title),
          artistLang: "he",
        };

  const addExisting = () => {
    const song = bank.find((s) => s.id === pickRef.current?.value);
    if (!song || ids.includes(song.id)) return;
    setEntries((prev) => [...prev, { id: song.id }]);
    setStatus(`״${song.title}״ נוסף.`);
  };

  const addNew = () => {
    const title = (titleRef.current?.value ?? "").trim();
    const link = (linkRef.current?.value ?? "").trim();
    if (!title && !link) {
      setError("יש להזין שם שיר או להדביק לינק.");
      titleRef.current?.focus();
      return;
    }
    if (link && !isSongLink(link)) {
      setError("הלינק צריך להיות קישור מלא מיוטיוב או מספוטיפיי.");
      linkRef.current?.focus();
      return;
    }
    setError("");
    setEntries((prev) => [...prev, { title, link, key: crypto.randomUUID() }]);
    setStatus(`״${title || titleFromLink(link)}״ נוסף ויישמר גם בבנק השירים.`);
    if (titleRef.current) titleRef.current.value = "";
    if (linkRef.current) linkRef.current.value = "";
  };

  const onEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addNew();
    }
  };

  const remove = (entry: SongEntry) => {
    setEntries((prev) => prev.filter((e) => e !== entry));
    setStatus(`״${asSong(entry)?.title ?? "השיר"}״ הוסר.`);
  };

  return (
    <fieldset className="card card-section">
      <legend className="card-legend">
        {legend} ({entries.length})
      </legend>
      <input
        type="hidden"
        name="songs"
        value={JSON.stringify(entries.map((e) => (isExisting(e) ? { id: e.id } : { title: e.title, link: e.link })))}
      />

      {entries.length === 0 ? (
        <p className="empty-state mb-5">עדיין לא נבחרו שירים. אפשר לבחור מהמאגר או להוסיף שיר חדש.</p>
      ) : (
        <ul className="divider-list mb-5" role="list">
          {entries.map((entry) => {
            const song = asSong(entry);
            if (!song) return null;
            return (
              <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    <SongTitle song={song} />
                    {!isExisting(entry) && <span className="ms-2 text-sm font-normal text-muted">(חדש)</span>}
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
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => remove(entry)}>
                    הסרה
                    <span className="visually-hidden">
                      {" "}
                      של <SongTitle song={song} />
                    </span>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor={`${id}-pick`} className="font-medium">
            שיר מהמאגר
          </label>
          <div className="flex gap-2">
            <select ref={pickRef} id={`${id}-pick`} className="min-w-0 flex-1">
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.artist ? `${s.title} — ${s.artist}` : s.title}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-compact" onClick={addExisting}>
              הוספה<span className="visually-hidden"> של שיר מהמאגר</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-border p-4" onKeyDown={onEnter}>
        <p id={`${id}-new-hint`} className="font-medium">
          שיר חדש (לא מהמאגר){" "}
          <span className="block text-sm font-normal text-muted">מספיק שם או לינק. השיר יישמר גם בבנק השירים.</span>
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-new-title`} className="font-medium">
            שם השיר
          </label>
          <input ref={titleRef} id={`${id}-new-title`} dir="auto" autoComplete="off" enterKeyHint="next" />
        </div>
        <SongLinkField name="" inputRef={linkRef} />
        <div>
          <button type="button" className="btn btn-secondary" onClick={addNew}>
            הוספת השיר
          </button>
        </div>
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
      </div>

      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </fieldset>
  );
}
