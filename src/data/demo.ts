/**
 * Demo data for the UI skeleton (stage 2).
 * Everything here is fake: names, phone numbers and lessons are invented.
 * There is no persistence — the UI keeps edits in memory only.
 */

// ---------- Types ----------

export type SpaceId = "new-high-school" | "balance-studio" | "private-lessons";

export type SpaceKind = "venue" | "private";

export interface Student {
  id: string;
  name: string;
  /** Example phone number (fake). */
  phone: string;
}

export interface Space {
  id: SpaceId;
  name: string;
  kind: SpaceKind;
  description: string;
  /** Each space has its own student pool. */
  students: Student[];
}

export type SongLang = "he" | "en";

export interface Song {
  id: string;
  title: string;
  artist: string;
  style: string;
  /** Link for finding the track (search link in the demo). */
  url: string;
  /** Languages of title and artist (they can differ), for lang attributes. */
  titleLang: SongLang;
  artistLang: SongLang;
}

export type MediaKind = "photo" | "video";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  caption: string;
}

export interface Payment {
  studentId: string;
  /** Amount in ILS. */
  amount: number;
  paid: boolean;
}

export interface Lesson {
  id: string;
  spaceId: SpaceId;
  /** ISO date, e.g. "2026-11-16". */
  date: string;
  /** 24h time, e.g. "17:30". */
  time: string;
  /** IDs of students (from the space's pool) who attended. */
  attendance: string[];
  songIds: string[];
  notes: string;
  media: MediaItem[];
  /** Only for private lessons. */
  payments?: Payment[];
}

// ---------- Song bank ----------

const yt = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const songs: Song[] = [
  { id: "s1", title: "טודו בום", artist: "סטטיק ובן אל תבורי", style: "היפ הופ", url: yt("טודו בום סטטיק ובן אל תבורי"), titleLang: "he", artistLang: "he" },
  { id: "s2", title: "תל אביב", artist: "עומר אדם", style: "פופ ים-תיכוני", url: yt("תל אביב עומר אדם"), titleLang: "he", artistLang: "he" },
  { id: "s3", title: "Toy", artist: "נטע ברזילי", style: "פופ", url: yt("Netta Toy"), titleLang: "en", artistLang: "he" },
  { id: "s4", title: "הללויה", artist: "גלי עטרי", style: "קלאסי ישראלי", url: yt("הללויה גלי עטרי"), titleLang: "he", artistLang: "he" },
  { id: "s5", title: "אבניבי", artist: "יזהר כהן", style: "דיסקו", url: yt("אבניבי יזהר כהן"), titleLang: "he", artistLang: "he" },
  { id: "s6", title: "דיווה", artist: "דנה אינטרנשיונל", style: "דיסקו", url: yt("דיווה דנה אינטרנשיונל"), titleLang: "he", artistLang: "he" },
  { id: "s7", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", style: "פאנק", url: yt("Uptown Funk Mark Ronson Bruno Mars"), titleLang: "en", artistLang: "en" },
  { id: "s8", title: "Dancing Queen", artist: "ABBA", style: "דיסקו", url: yt("Dancing Queen ABBA"), titleLang: "en", artistLang: "en" },
  { id: "s9", title: "Shake It Off", artist: "Taylor Swift", style: "פופ", url: yt("Shake It Off Taylor Swift"), titleLang: "en", artistLang: "en" },
  { id: "s10", title: "Levitating", artist: "Dua Lipa", style: "פופ", url: yt("Levitating Dua Lipa"), titleLang: "en", artistLang: "en" },
  { id: "s11", title: "Can't Stop the Feeling!", artist: "Justin Timberlake", style: "פופ", url: yt("Can't Stop the Feeling Justin Timberlake"), titleLang: "en", artistLang: "en" },
  { id: "s12", title: "Happy", artist: "Pharrell Williams", style: "סול", url: yt("Happy Pharrell Williams"), titleLang: "en", artistLang: "en" },
];

// ---------- Spaces & students ----------

export const spaces: Space[] = [
  {
    id: "new-high-school",
    name: "תיכון חדש",
    kind: "venue",
    description: "חוג מחול לתלמידות חטיבה ותיכון",
    students: [
      { id: "hs1", name: "נועה כהן", phone: "050-000-1101" },
      { id: "hs2", name: "מאיה לוי", phone: "050-000-1102" },
      { id: "hs3", name: "תמר מזרחי", phone: "050-000-1103" },
      { id: "hs4", name: "יעל אברהם", phone: "050-000-1104" },
      { id: "hs5", name: "שירה פרידמן", phone: "050-000-1105" },
      { id: "hs6", name: "אגם ביטון", phone: "050-000-1106" },
    ],
  },
  {
    id: "balance-studio",
    name: "סטודיו באלאנס",
    kind: "venue",
    description: "שיעורי ג'אז ומודרני לנוער ובוגרות",
    students: [
      { id: "bs1", name: "רוני שפירא", phone: "052-000-2201" },
      { id: "bs2", name: "הילה דהן", phone: "052-000-2202" },
      { id: "bs3", name: "ליאור גבאי", phone: "052-000-2203" },
      { id: "bs4", name: "עדי אוחיון", phone: "052-000-2204" },
      { id: "bs5", name: "מיכל רוזן", phone: "052-000-2205" },
    ],
  },
  {
    id: "private-lessons",
    name: "שיעורים פרטיים",
    kind: "private",
    description: "שיעורים אישיים והכנה לבחינות ולהופעות",
    students: [
      { id: "pl1", name: "אלה ברק", phone: "054-000-3301" },
      { id: "pl2", name: "דניאל חדד", phone: "054-000-3302" },
      { id: "pl3", name: "זוהר נחום", phone: "054-000-3303" },
    ],
  },
];

// ---------- Lessons ----------

export const lessons: Lesson[] = [
  // תיכון חדש
  {
    id: "hs-2026-11-16",
    spaceId: "new-high-school",
    date: "2026-11-16",
    time: "15:30",
    attendance: ["hs1", "hs2", "hs3", "hs5"],
    songIds: ["s1", "s9"],
    notes: "עבדנו על הכוריאוגרפיה לטקס חנוכה. לחזור על המעבר בפזמון.",
    media: [
      { id: "m1", kind: "photo", caption: "חימום" },
      { id: "m2", kind: "video", caption: "ריצה מלאה של הפזמון" },
      { id: "m3", kind: "photo", caption: "מבנה סיום" },
    ],
  },
  {
    id: "hs-2026-11-09",
    spaceId: "new-high-school",
    date: "2026-11-09",
    time: "15:30",
    attendance: ["hs1", "hs2", "hs4", "hs5", "hs6"],
    songIds: ["s1"],
    notes: "התחלנו קטע חדש. אגם חזרה אחרי פציעה — להקל בקפיצות.",
    media: [{ id: "m4", kind: "photo", caption: "קבוצה" }],
  },
  {
    id: "hs-2026-11-02",
    spaceId: "new-high-school",
    date: "2026-11-02",
    time: "15:30",
    attendance: ["hs1", "hs3", "hs4", "hs6"],
    songIds: ["s8"],
    notes: "",
    media: [],
  },

  // סטודיו באלאנס
  {
    id: "bs-2026-11-15",
    spaceId: "balance-studio",
    date: "2026-11-15",
    time: "19:00",
    attendance: ["bs1", "bs2", "bs4", "bs5"],
    songIds: ["s7", "s10"],
    notes: "ג'אז — איזולציות וסיבובים. רוני מוכנה לסולו.",
    media: [
      { id: "m5", kind: "video", caption: "קומבינציה באלכסון" },
      { id: "m6", kind: "photo", caption: "רוני בסולו" },
    ],
  },
  {
    id: "bs-2026-11-08",
    spaceId: "balance-studio",
    date: "2026-11-08",
    time: "19:00",
    attendance: ["bs1", "bs2", "bs3", "bs4", "bs5"],
    songIds: ["s5", "s6"],
    notes: "ערב דיסקו ישראלי. כולן הגיעו!",
    media: [{ id: "m7", kind: "photo", caption: "תמונה קבוצתית" }],
  },

  // שיעורים פרטיים
  {
    id: "pl-2026-11-17",
    spaceId: "private-lessons",
    date: "2026-11-17",
    time: "18:00",
    attendance: ["pl1"],
    songIds: ["s3"],
    notes: "הכנה לבחינת בגרות במחול. לעבוד על הסיום.",
    media: [{ id: "m8", kind: "video", caption: "ריצה של הקטע לבחינה" }],
    payments: [{ studentId: "pl1", amount: 200, paid: false }],
  },
  {
    id: "pl-2026-11-12",
    spaceId: "private-lessons",
    date: "2026-11-12",
    time: "17:00",
    attendance: ["pl2", "pl3"],
    songIds: ["s4", "s11"],
    notes: "שיעור זוגי — הכנה להופעה בבת מצווה.",
    media: [],
    payments: [
      { studentId: "pl2", amount: 150, paid: true },
      { studentId: "pl3", amount: 150, paid: false },
    ],
  },
  {
    id: "pl-2026-11-05",
    spaceId: "private-lessons",
    date: "2026-11-05",
    time: "18:00",
    attendance: ["pl1"],
    songIds: ["s12"],
    notes: "",
    media: [],
    payments: [{ studentId: "pl1", amount: 200, paid: true }],
  },
];

// ---------- Helpers ----------

export function getSpace(id: string): Space | undefined {
  return spaces.find((s) => s.id === id);
}

export function getLessonsForSpace(spaceId: string): Lesson[] {
  return lessons
    .filter((l) => l.spaceId === spaceId)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
}

export function getLesson(spaceId: string, lessonId: string): Lesson | undefined {
  return lessons.find((l) => l.spaceId === spaceId && l.id === lessonId);
}

export function getSongs(ids: string[]): Song[] {
  return ids.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => Boolean(s));
}

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

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
