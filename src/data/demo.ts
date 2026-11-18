/**
 * Demo data for the UI skeleton.
 * Everything here is fake: names, phone numbers, lessons and projects are invented.
 * There is no persistence — the UI keeps edits in memory only.
 */

// ---------- Types ----------

export type StudioSpaceId = "new-high-school" | "balance-studio";
export type PrivateSpaceId = "private-lessons";
export type SpaceId = StudioSpaceId | PrivateSpaceId;

export interface Student {
  id: string;
  name: string;
  /** Example phone number (fake). */
  phone: string;
}

/** A class group inside a studio space; its members come from the space's pool. */
export interface Group {
  id: string;
  name: string;
  studentIds: string[];
}

interface SpaceBase {
  name: string;
  description: string;
  /** Each space has its own student pool. */
  students: Student[];
}

export interface StudioSpace extends SpaceBase {
  id: StudioSpaceId;
  kind: "studio";
  groups: Group[];
}

export interface PrivateSpace extends SpaceBase {
  id: PrivateSpaceId;
  kind: "private";
}

export type Space = StudioSpace | PrivateSpace;

export type SongLang = "he" | "en";

export interface Song {
  id: string;
  title: string;
  artist: string;
  style: string;
  /** YouTube or Spotify link (optional). Without it, listening falls back to a YouTube search. */
  link?: string;
  /** Sivan's personal note about the song (optional). */
  note?: string;
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

/** A lesson in a studio space. */
export interface Lesson {
  id: string;
  spaceId: StudioSpaceId;
  /** ISO date, e.g. "2026-11-16". */
  date: string;
  /** 24h time, e.g. "17:30". */
  time: string;
  /** Students who actually took part (from the space's pool). */
  participantIds: string[];
  songIds: string[];
  notes: string;
  media: MediaItem[];
}

export type ProjectType = "solo" | "group";

/** A rehearsal session of a private dance project. */
export interface Session {
  id: string;
  date: string;
  time: string;
  songIds: string[];
  notes: string;
  media: MediaItem[];
  /** One entry per project participant. */
  payments: Payment[];
}

/** A private project: preparing one choreography, solo or group. */
export interface DanceProject {
  id: string;
  name: string;
  type: ProjectType;
  participantIds: string[];
  mainSongId: string;
  sessions: Session[];
}

// ---------- Song bank ----------

export const songs: Song[] = [
  { id: "s1", title: "טודו בום", artist: "סטטיק ובן אל תבורי", style: "היפ הופ", titleLang: "he", artistLang: "he", note: "מצוין לחימום — קצב מדבק" },
  { id: "s2", title: "תל אביב", artist: "עומר אדם", style: "פופ ים-תיכוני", titleLang: "he", artistLang: "he" },
  { id: "s3", title: "Toy", artist: "נטע ברזילי", style: "פופ", titleLang: "en", artistLang: "he", note: "הגרסה המקוצרת לבחינה — 2:30" },
  { id: "s4", title: "הללויה", artist: "גלי עטרי", style: "קלאסי ישראלי", titleLang: "he", artistLang: "he" },
  { id: "s5", title: "אבניבי", artist: "יזהר כהן", style: "דיסקו", titleLang: "he", artistLang: "he" },
  { id: "s6", title: "דיווה", artist: "דנה אינטרנשיונל", style: "דיסקו", titleLang: "he", artistLang: "he" },
  { id: "s7", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", style: "פאנק", titleLang: "en", artistLang: "en", note: "לעבוד על איזולציות בפזמון" },
  { id: "s8", title: "Dancing Queen", artist: "ABBA", style: "דיסקו", titleLang: "en", artistLang: "en" },
  { id: "s9", title: "Shake It Off", artist: "Taylor Swift", style: "פופ", titleLang: "en", artistLang: "en" },
  { id: "s10", title: "Levitating", artist: "Dua Lipa", style: "פופ", titleLang: "en", artistLang: "en" },
  { id: "s11", title: "Can't Stop the Feeling!", artist: "Justin Timberlake", style: "פופ", titleLang: "en", artistLang: "en" },
  { id: "s12", title: "Happy", artist: "Pharrell Williams", style: "סול", titleLang: "en", artistLang: "en" },
];

// ---------- Spaces, students & groups ----------

export const spaces: Space[] = [
  {
    id: "new-high-school",
    name: "תיכון חדש",
    kind: "studio",
    description: "חוג מחול לתלמידות חטיבה ותיכון",
    students: [
      { id: "hs1", name: "נועה כהן", phone: "050-000-1101" },
      { id: "hs2", name: "מאיה לוי", phone: "050-000-1102" },
      { id: "hs3", name: "תמר מזרחי", phone: "050-000-1103" },
      { id: "hs4", name: "יעל אברהם", phone: "050-000-1104" },
      { id: "hs5", name: "שירה פרידמן", phone: "050-000-1105" },
      { id: "hs6", name: "אגם ביטון", phone: "050-000-1106" },
      { id: "hs7", name: "רותם אלון", phone: "050-000-1107" },
      { id: "hs8", name: "עדן יוסף", phone: "050-000-1108" },
      { id: "hs9", name: "ליה שטרן", phone: "050-000-1109" },
    ],
    groups: [
      { id: "hs-g9", name: "שכבה ט׳", studentIds: ["hs1", "hs2", "hs3"] },
      { id: "hs-g10", name: "שכבה י׳", studentIds: ["hs4", "hs5", "hs6", "hs7"] },
      // The performance troupe overlaps the grade groups on purpose.
      { id: "hs-troupe", name: "להקה ייצוגית", studentIds: ["hs1", "hs5", "hs8", "hs9"] },
    ],
  },
  {
    id: "balance-studio",
    name: "סטודיו באלאנס",
    kind: "studio",
    description: "שיעורי ג׳אז לירי לנוער ולבוגרות",
    students: [
      { id: "bs1", name: "רוני שפירא", phone: "052-000-2201" },
      { id: "bs2", name: "הילה דהן", phone: "052-000-2202" },
      { id: "bs3", name: "ליאור גבאי", phone: "052-000-2203" },
      { id: "bs4", name: "עדי אוחיון", phone: "052-000-2204" },
      { id: "bs5", name: "מיכל רוזן", phone: "052-000-2205" },
      { id: "bs6", name: "סתיו קרמר", phone: "052-000-2206" },
    ],
    groups: [
      { id: "bs-teens", name: "ג׳אז נוער", studentIds: ["bs1", "bs2", "bs3"] },
      { id: "bs-adults", name: "ג׳אז בוגרות", studentIds: ["bs4", "bs5", "bs6"] },
    ],
  },
  {
    id: "private-lessons",
    name: "שיעורים פרטיים",
    kind: "private",
    description: "פרויקטי ריקוד אישיים: סולו וקבוצות קטנות",
    students: [
      { id: "pl1", name: "אלה ברק", phone: "054-000-3301" },
      { id: "pl2", name: "דניאל חדד", phone: "054-000-3302" },
      { id: "pl3", name: "זוהר נחום", phone: "054-000-3303" },
      { id: "pl4", name: "נגה פרץ", phone: "054-000-3304" },
      { id: "pl5", name: "קורל סעדה", phone: "054-000-3305" },
    ],
  },
];

// ---------- Studio lessons ----------

export const lessons: Lesson[] = [
  // תיכון חדש
  {
    id: "hs-2026-11-16",
    spaceId: "new-high-school",
    date: "2026-11-16",
    time: "15:30",
    participantIds: ["hs1", "hs2", "hs3", "hs5"],
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
    participantIds: ["hs4", "hs5", "hs6", "hs7"],
    songIds: ["s1"],
    notes: "התחלנו קטע חדש. אגם חזרה אחרי פציעה — להקל בקפיצות.",
    media: [{ id: "m4", kind: "photo", caption: "קבוצה" }],
  },
  {
    id: "hs-2026-11-02",
    spaceId: "new-high-school",
    date: "2026-11-02",
    time: "17:00",
    participantIds: ["hs1", "hs5", "hs8", "hs9"],
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
    participantIds: ["bs1", "bs2", "bs3"],
    songIds: ["s7", "s10"],
    notes: "ג׳אז — איזולציות וסיבובים. רוני מוכנה לסולו.",
    media: [
      { id: "m5", kind: "video", caption: "קומבינציה באלכסון" },
      { id: "m6", kind: "photo", caption: "רוני בסולו" },
    ],
  },
  {
    id: "bs-2026-11-08",
    spaceId: "balance-studio",
    date: "2026-11-08",
    time: "20:15",
    participantIds: ["bs4", "bs5", "bs6", "bs1"],
    songIds: ["s5", "s6"],
    notes: "ערב דיסקו ישראלי. רוני הצטרפה לבוגרות.",
    media: [{ id: "m7", kind: "photo", caption: "תמונה קבוצתית" }],
  },
];

// ---------- Private dance projects ----------

export const projects: DanceProject[] = [
  {
    id: "bagrut-ella",
    name: "סולו לבגרות במחול",
    type: "solo",
    participantIds: ["pl1"],
    mainSongId: "s3",
    sessions: [
      {
        id: "2026-11-17",
        date: "2026-11-17",
        time: "18:00",
        songIds: ["s3"],
        notes: "לעבוד על הסיום — הירידה לרצפה עדיין לא נקייה.",
        media: [{ id: "m8", kind: "video", caption: "ריצה של הקטע לבחינה" }],
        payments: [{ studentId: "pl1", amount: 200, paid: false }],
      },
      {
        id: "2026-11-10",
        date: "2026-11-10",
        time: "18:00",
        songIds: ["s3"],
        notes: "בנינו את החלק האמצעי.",
        media: [],
        payments: [{ studentId: "pl1", amount: 200, paid: true }],
      },
      {
        id: "2026-11-03",
        date: "2026-11-03",
        time: "18:00",
        songIds: ["s3", "s12"],
        notes: "מפגש פתיחה: בחירת שיר ורעיון.",
        media: [{ id: "m9", kind: "photo", caption: "סקיצה של המבנה" }],
        payments: [{ studentId: "pl1", amount: 200, paid: true }],
      },
    ],
  },
  {
    id: "bat-mitzvah",
    name: "ריקוד לבת מצווה",
    type: "group",
    participantIds: ["pl2", "pl3", "pl4"],
    mainSongId: "s11",
    sessions: [
      {
        id: "2026-11-12",
        date: "2026-11-12",
        time: "17:00",
        songIds: ["s11"],
        notes: "סנכרון בפזמון השני. נגה צריכה לחזור על הסיבוב.",
        media: [],
        payments: [
          { studentId: "pl2", amount: 120, paid: true },
          { studentId: "pl3", amount: 120, paid: false },
          { studentId: "pl4", amount: 120, paid: true },
        ],
      },
      {
        id: "2026-11-05",
        date: "2026-11-05",
        time: "17:00",
        songIds: ["s11", "s2"],
        notes: "",
        media: [{ id: "m10", kind: "video", caption: "ריצה ראשונה" }],
        payments: [
          { studentId: "pl2", amount: 120, paid: true },
          { studentId: "pl3", amount: 120, paid: true },
          { studentId: "pl4", amount: 120, paid: true },
        ],
      },
    ],
  },
  {
    id: "competition-solo",
    name: "סולו לתחרות ג׳אז",
    type: "solo",
    participantIds: ["pl5"],
    mainSongId: "s12",
    sessions: [
      {
        id: "2026-11-14",
        date: "2026-11-14",
        time: "16:00",
        songIds: ["s12"],
        notes: "עבודה על הבעה ועל שימוש בקומות.",
        media: [],
        payments: [{ studentId: "pl5", amount: 220, paid: false }],
      },
    ],
  },
];

// ---------- Helpers ----------

export function getSpace(id: string): Space | undefined {
  return spaces.find((s) => s.id === id);
}

export const studioSpaces = spaces.filter((s): s is StudioSpace => s.kind === "studio");

export const privateSpace = spaces.find((s): s is PrivateSpace => s.kind === "private")!;

const byDateDesc = <T extends { date: string; time: string }>(a: T, b: T) =>
  a.date + a.time < b.date + b.time ? 1 : -1;

export function getLessonsForSpace(spaceId: string): Lesson[] {
  return lessons.filter((l) => l.spaceId === spaceId).sort(byDateDesc);
}

export function getLesson(spaceId: string, lessonId: string): Lesson | undefined {
  return lessons.find((l) => l.spaceId === spaceId && l.id === lessonId);
}

export function getProject(projectId: string): DanceProject | undefined {
  return projects.find((p) => p.id === projectId);
}

export function getSessions(project: DanceProject): Session[] {
  return [...project.sessions].sort(byDateDesc);
}

export function getSession(project: DanceProject, sessionId: string): Session | undefined {
  return project.sessions.find((s) => s.id === sessionId);
}

export function getStudents(space: Space, ids: string[]): Student[] {
  return ids
    .map((id) => space.students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));
}

export function getSong(id: string): Song | undefined {
  return songs.find((s) => s.id === id);
}

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

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
