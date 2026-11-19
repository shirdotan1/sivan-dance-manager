"use client";

import { useCallback, useState } from "react";
import { guessLang } from "@/lib/format";
import type { Song } from "@/lib/types";

export interface NewSongInput {
  title: string;
  artist?: string;
  style?: string;
  link?: string;
  note?: string;
}

/**
 * Song bank seeded from the database, with page-local additions.
 * Transitional (stage 3, section 1): section 2 saves new songs for real.
 */
export function useLocalSongBank(initial: Song[]) {
  const [songs, setSongs] = useState<Song[]>(initial);

  const getSong = useCallback((id: string) => songs.find((s) => s.id === id), [songs]);

  const addSong = useCallback((input: NewSongInput): Song => {
    const title = input.title.trim();
    const artist = input.artist?.trim() ?? "";
    const song: Song = {
      id: `new-${crypto.randomUUID()}`,
      title,
      artist,
      style: input.style?.trim() ?? "",
      ...(input.link?.trim() ? { link: input.link.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      titleLang: guessLang(title),
      artistLang: guessLang(artist),
    };
    setSongs((prev) => [...prev, song]);
    return song;
  }, []);

  return { songs, getSong, addSong };
}
