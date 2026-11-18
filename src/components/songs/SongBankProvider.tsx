"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { songs as demoSongs, type Song, type SongLang } from "@/data/demo";

export interface NewSongInput {
  title: string;
  artist?: string;
  style?: string;
  link?: string;
  note?: string;
}

interface SongBankValue {
  songs: Song[];
  getSong: (id: string) => Song | undefined;
  /** Adds a song to the in-memory bank and returns it. */
  addSong: (input: NewSongInput) => Song;
}

const SongBankContext = createContext<SongBankValue | null>(null);

/** Hebrew letters → "he"; otherwise Latin letters → "en"; default "he". */
function guessLang(text: string): SongLang {
  if (/[֐-׿]/.test(text)) return "he";
  if (/[A-Za-z]/.test(text)) return "en";
  return "he";
}

/**
 * Song bank shared across pages for the session (demo: memory only,
 * resets on refresh). Songs added from a lesson or session land here too.
 */
export function SongBankProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>(demoSongs);

  const getSong = useCallback((id: string) => songs.find((s) => s.id === id), [songs]);

  const addSong = useCallback((input: NewSongInput): Song => {
    const title = input.title.trim();
    const artist = input.artist?.trim() ?? "";
    const song: Song = {
      id: `new-${crypto.randomUUID()}`,
      title,
      artist,
      style: input.style?.trim() ?? "",
      link: input.link?.trim() || undefined,
      note: input.note?.trim() || undefined,
      titleLang: guessLang(title),
      artistLang: guessLang(artist),
    };
    setSongs((prev) => [...prev, song]);
    return song;
  }, []);

  const value = useMemo(() => ({ songs, getSong, addSong }), [songs, getSong, addSong]);

  return <SongBankContext value={value}>{children}</SongBankContext>;
}

export function useSongBank(): SongBankValue {
  const ctx = useContext(SongBankContext);
  if (!ctx) throw new Error("useSongBank must be used inside <SongBankProvider>");
  return ctx;
}

/** Title for a song added by link only, e.g. "שיר מיוטיוב". */
export function titleFromLink(link: string): string {
  return /spotify\.com/i.test(link) ? "שיר מספוטיפיי" : "שיר מיוטיוב";
}
