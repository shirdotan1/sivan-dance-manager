import type { Song } from "@/data/demo";

/**
 * Song title and artist as bidi-isolated text: <bdi> (implicit dir="auto")
 * keeps English titles like "Can't Stop the Feeling!" from reordering the
 * surrounding RTL text, and lang lets screen readers pronounce them correctly.
 */
export function SongTitle({ song }: { song: Song }) {
  return <bdi lang={song.titleLang}>{song.title}</bdi>;
}

export function SongArtist({ song }: { song: Song }) {
  return <bdi lang={song.artistLang}>{song.artist}</bdi>;
}
