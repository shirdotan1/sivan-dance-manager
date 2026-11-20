/**
 * Demo data — the source for supabase/seed.sql (scripts/generate-seed.mjs).
 * The app itself reads from the database; nothing here is imported at runtime.
 * Everything is fake: names, phone numbers, lessons and projects are invented.
 * IDs are short readable keys; the seed turns them into stable UUIDs.
 */

export type SeedLang = "he" | "en";

export interface SeedSong {
  id: string;
  title: string;
  artist: string;
  style: string;
  link?: string;
  note?: string;
  titleLang: SeedLang;
  artistLang: SeedLang;
}

export interface SeedStudent {
  id: string;
  name: string;
  phone: string;
}

export interface SeedGroup {
  id: string;
  name: string;
  studentIds: string[];
}

export interface SeedSpace {
  id: "new-high-school" | "balance-studio" | "private-lessons";
  name: string;
  kind: "studio" | "private";
  description: string;
  students: SeedStudent[];
  groups?: SeedGroup[];
}

export interface SeedMedia {
  id: string;
  kind: "photo" | "video";
  caption: string;
}

export interface SeedLesson {
  id: string;
  spaceId: "new-high-school" | "balance-studio";
  groupId?: string;
  date: string;
  time: string;
  participantIds: string[];
  songIds: string[];
  notes: string;
  media: SeedMedia[];
}

export interface SeedSession {
  id: string;
  date: string;
  time: string;
  songIds: string[];
  notes: string;
  media: SeedMedia[];
  payments: { studentId: string; amount: number; paid: boolean }[];
}

export interface SeedProject {
  id: string;
  name: string;
  type: "solo" | "group";
  participantIds: string[];
  mainSongId: string;
  sessions: SeedSession[];
}

// ---------- Song bank ----------

export const songs: SeedSong[] = [
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

export const spaces: SeedSpace[] = [
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

export const lessons: SeedLesson[] = [
  // תיכון חדש
  {
    id: "hs-2026-11-16",
    spaceId: "new-high-school",
    groupId: "hs-g9",
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
    groupId: "hs-g10",
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
    groupId: "hs-troupe",
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
    groupId: "bs-teens",
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
    groupId: "bs-adults",
    date: "2026-11-08",
    time: "20:15",
    participantIds: ["bs4", "bs5", "bs6", "bs1"],
    songIds: ["s5", "s6"],
    notes: "ערב דיסקו ישראלי. רוני הצטרפה לבוגרות.",
    media: [{ id: "m7", kind: "photo", caption: "תמונה קבוצתית" }],
  },
];

// ---------- Private dance projects ----------

export const projects: SeedProject[] = [
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
