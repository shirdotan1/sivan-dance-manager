/** Formatting and small pure helpers shared by server and client code. */
import type { Material, MaterialKind, ProjectType } from "@/lib/types";

/** Kind labels shown as text next to every material (never color/icon alone). */
export const materialKindLabel: Record<MaterialKind, string> = {
  song: "שיר",
  video: "סרטון",
  link: "קישור",
  note: "הערה",
};

export const MATERIAL_KINDS: MaterialKind[] = ["song", "video", "link", "note"];

export function isMaterialKind(v: unknown): v is MaterialKind {
  return typeof v === "string" && (MATERIAL_KINDS as string[]).includes(v);
}

/**
 * Where the action button goes: the material's own link, or for a song
 * without one a YouTube search. Notes without a link have no action.
 */
export function materialUrl(m: Material): string | undefined {
  if (m.link) return m.link;
  if (m.kind !== "song") return undefined;
  const query = [m.title, m.artist].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Action wording per kind: listen (song) / watch (video) / open (link, note). */
export function materialActionLabel(m: Material): string {
  if (m.kind === "song") return m.link ? "האזנה" : "חיפוש ביוטיוב";
  if (m.kind === "video") return "צפייה";
  return "פתיחה";
}

/** Full-match regex (for the `pattern` attribute) for YouTube/Spotify links. */
export const SONG_LINK_PATTERN =
  "https?://([a-z0-9\\-]+\\.)*(youtube\\.com|youtu\\.be|spotify\\.com)(/.*)?";

const songLinkRegex = new RegExp(`^(?:${SONG_LINK_PATTERN})$`, "i");

export function isSongLink(value: string): boolean {
  return songLinkRegex.test(value.trim());
}

/** Any absolute http(s) URL — for videos and links (not limited to YouTube/Spotify). */
export function isWebLink(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Validates a material's link for its kind. Returns an error message or null. */
export function materialLinkError(kind: MaterialKind, link: string): string | null {
  const v = link.trim();
  if (!v) return kind === "video" || kind === "link" ? "לסרטון ולקישור צריך להדביק לינק." : null;
  if (kind === "song") return isSongLink(v) ? null : "לשיר: קישור מלא מיוטיוב או מספוטיפיי.";
  return isWebLink(v) ? null : "יש להדביק כתובת מלאה שמתחילה ב-https://";
}

/** Hebrew letters → "he"; otherwise Latin letters → "en"; default "he". */
export function guessLang(text: string): "he" | "en" {
  if (/[֐-׿]/.test(text)) return "he";
  if (/[A-Za-z]/.test(text)) return "en";
  return "he";
}

/** Title for a material added by link only, e.g. "שיר מיוטיוב" / "סרטון מיוטיוב" / "קישור: example.com". */
export function titleFromLink(link: string, kind: MaterialKind = "song"): string {
  if (kind === "song") return /spotify\.com/i.test(link) ? "שיר מספוטיפיי" : "שיר מיוטיוב";
  let host = "";
  try {
    host = new URL(link).hostname.replace(/^www\./, "");
  } catch {}
  if (kind === "video") return /youtu/.test(host) ? "סרטון מיוטיוב" : host ? `סרטון מ-${host}` : "סרטון";
  return host ? `קישור: ${host}` : "קישור";
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

/** File sizes for the media usage line, e.g. "820 KB", "3.2 GB" (decimal units, like R2's pricing). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)} ${units[i]}`;
}

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** "17:30:00" (Postgres time) → "17:30". */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** Hebrew weekday names, 0 = Sunday. */
export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

/** Current wall-clock time in Israel as HH:MM. */
export function nowTimeIsrael(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
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
