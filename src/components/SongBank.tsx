"use client";

import { useId, useState } from "react";
import { listenUrl, type Song } from "@/data/demo";
import { SongArtist, SongTitle } from "@/components/SongText";

export function SongBank({ songs }: { songs: Song[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = q
    ? songs.filter((s) => [s.title, s.artist, s.style].some((field) => field.toLowerCase().includes(q)))
    : songs;

  return (
    <>
      <search className="mb-4 block">
        <form onSubmit={(e) => e.preventDefault()}>
          <label htmlFor={searchId} className="mb-1 block font-medium">
            חיפוש שיר, מבצע או סגנון
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
        {visible.length === songs.length ? `${songs.length} שירים בבנק` : `נמצאו ${visible.length} מתוך ${songs.length} שירים`}
      </p>

      {visible.length > 0 && (
        <ul className="grid gap-3" role="list">
          {visible.map((song) => (
            <li
              key={song.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <h2 className="text-lg font-semibold">
                  <SongTitle song={song} />
                </h2>
                <p className="text-muted">
                  <SongArtist song={song} />
                </p>
                <p className="mt-1">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm text-brand-strong">
                    {song.style}
                  </span>
                </p>
              </div>
              <a
                href={listenUrl(song)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 font-medium text-brand-strong hover:bg-brand-soft"
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
    </>
  );
}
