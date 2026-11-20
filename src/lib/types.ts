/** Domain types shared by the data layer and the UI. */

export type StudioSpaceId = "new-high-school" | "balance-studio";
export type PrivateSpaceId = "private-lessons";
export type SpaceId = StudioSpaceId | PrivateSpaceId;

export interface Student {
  id: string;
  name: string;
  phone: string;
  /** Removed from the pool (history is kept). */
  archived?: boolean;
}

/** A class group inside a studio space; its members come from the space's pool. */
export interface Group {
  id: string;
  name: string;
  color: string;
  studentIds: string[];
}

interface SpaceBase {
  name: string;
  description: string;
  /**
   * Everyone who was ever in the pool. Removed students are flagged
   * `archived`: still shown by name in history, never offered as choices.
   */
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

export type TextLang = "he" | "en";

/** What a material is. Songs stay the main kind and the default everywhere. */
export type MaterialKind = "song" | "video" | "link" | "note";

/**
 * A teaching material in the bank (stored in the `songs` table). Songs use
 * artist and style; other kinds use title, link and note.
 */
export interface Material {
  id: string;
  kind: MaterialKind;
  title: string;
  /** Songs only. */
  artist: string;
  /** Songs only. */
  style: string;
  /** Song: YouTube/Spotify (optional, else a YouTube search). Video/link: required. Note: optional. */
  link?: string;
  /** Sivan's personal note (optional). For kind "note" this is the content. */
  note?: string;
  titleLang: TextLang;
  artistLang: TextLang;
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
  /** The lesson's group (optional): calendar color and label. */
  groupId?: string;
  /** ISO date, e.g. "2026-11-16". */
  date: string;
  /** 24h time, e.g. "17:30". */
  time: string;
  participantIds: string[];
  materialIds: string[];
  notes: string;
  media: MediaItem[];
}

export type ProjectType = "solo" | "group";

/** A session of a private project. */
export interface Session {
  id: string;
  date: string;
  time: string;
  materialIds: string[];
  notes: string;
  media: MediaItem[];
  /** One entry per project participant. */
  payments: Payment[];
}

/** A private project: one goal worked on over several sessions (a piece, an exam, a training plan), solo or group. */
export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  color: string;
  participantIds: string[];
  mainMaterialId?: string;
  sessions: Session[];
}
