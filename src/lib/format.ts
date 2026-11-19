/** Formatting and small pure helpers shared by server and client code. */
import type { ProjectType, Song } from "@/lib/types";

/** Link for listening: the song's own link, or a YouTube search as a fallback. */
export function listenUrl(song: Song): string {
  if (song.link) return song.link;
  const query = [song.title, song.artist].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Full-match regex (for the `pattern` attribute) for YouTube/Spotify links. */
export const SONG_LINK_PATTERN =
  "https?://([a-z0-9\\-]+\\.)*(youtube\\.com|youtu\\.be|spotify\\.com)(/.*)?";

const songLinkRegex = new RegExp(`^(?:${SONG_LINK_PATTERN})$`, "i");

export function isSongLink(value: string): boolean {
  return songLinkRegex.test(value.trim());
}

/** Hebrew letters → "he"; otherwise Latin letters → "en"; default "he". */
export function guessLang(text: string): "he" | "en" {
  if (/[֐-׿]/.test(text)) return "he";
  if (/[A-Za-z]/.test(text)) return "en";
  return "he";
}

/** Title for a song added by link only, e.g. "שיר מיוטיוב". */
export function titleFromLink(link: string): string {
  return /spotify\.com/i.test(link) ? "שיר מספוטיפיי" : "שיר מיוטיוב";
}

export const projectTypeLabel: Record<ProjectType, string> = {
  solo: "סולו",
  group: "קבוצתי",
};

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO date (YYYY-MM-DD) in Hebrew, e.g. "יום שני, 16 בנובמבר 2026". */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

const shortDateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "UTC",
});

/** Short date, e.g. "16.11.26". */
export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** "17:30:00" (Postgres time) → "17:30". */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** Today's date in Israel as YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/** Adds days to an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
