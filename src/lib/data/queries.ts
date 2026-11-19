import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { shortTime } from "@/lib/format";
import type {
  DanceProject,
  Group,
  Lesson,
  MediaItem,
  PrivateSpace,
  Session,
  Song,
  Space,
  Student,
  StudioSpace,
} from "@/lib/types";

/*
 * Read side of the Data Access Layer. Every function verifies the user
 * (requireUser) and maps database rows to the app's domain types.
 * Ordering: students by name, groups by name, lessons/sessions by date.
 */

// ---------- Row shapes (only the columns we select) ----------

interface StudentRow { id: string; name: string; phone: string; archived_at: string | null }
interface GroupRow { id: string; name: string; color: string; group_members: { student_id: string }[] }
interface SpaceRow {
  id: string; name: string; kind: "studio" | "private"; description: string;
  students: StudentRow[]; groups: GroupRow[];
}
interface MediaRow { id: string; kind: "photo" | "video"; caption: string; position: number }
interface SongLinkRow { song_id: string; position: number }
interface LessonRow {
  id: string; space_id: string; group_id: string | null; date: string; time: string; notes: string;
  lesson_participants: { student_id: string }[]; lesson_songs: SongLinkRow[]; media_items: MediaRow[];
}
interface SessionRow {
  id: string; date: string; time: string; notes: string;
  session_payments: { student_id: string; amount: number; paid: boolean }[];
  session_songs: SongLinkRow[]; media_items: MediaRow[];
}
interface ProjectRow {
  id: string; name: string; type: "solo" | "group"; color: string; main_song_id: string | null;
  project_participants: { student_id: string }[]; sessions: SessionRow[];
}
interface SongRow {
  id: string; title: string; artist: string; style: string; link: string | null; note: string | null;
  title_lang: "he" | "en"; artist_lang: "he" | "en";
}

// ---------- Selects ----------

const SPACE_SELECT =
  "id, name, kind, description, students(id, name, phone, archived_at), groups(id, name, color, group_members(student_id))";
const LESSON_SELECT =
  "id, space_id, group_id, date, time, notes, lesson_participants(student_id), lesson_songs(song_id, position), media_items(id, kind, caption, position)";
const SESSION_SELECT =
  "id, date, time, notes, session_payments(student_id, amount, paid), session_songs(song_id, position), media_items(id, kind, caption, position)";
const PROJECT_SELECT = `id, name, type, color, main_song_id, project_participants(student_id), sessions(${SESSION_SELECT})`;
const SONG_SELECT = "id, title, artist, style, link, note, title_lang, artist_lang";

// ---------- Mappers ----------

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he");
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
const byDateDesc = (a: { date: string; time: string }, b: { date: string; time: string }) =>
  a.date + a.time < b.date + b.time ? 1 : a.date + a.time > b.date + b.time ? -1 : 0;

function mapStudent(r: StudentRow): Student {
  return { id: r.id, name: r.name, phone: r.phone, ...(r.archived_at ? { archived: true } : {}) };
}

function mapGroup(r: GroupRow): Group {
  return { id: r.id, name: r.name, color: r.color, studentIds: r.group_members.map((m) => m.student_id) };
}

function mapSpace(r: SpaceRow): Space {
  const base = { name: r.name, description: r.description, students: [...r.students].sort(byName).map(mapStudent) };
  if (r.kind === "studio") {
    return { ...base, id: r.id as StudioSpace["id"], kind: "studio", groups: [...r.groups].sort(byName).map(mapGroup) };
  }
  return { ...base, id: r.id as PrivateSpace["id"], kind: "private" };
}

function mapMedia(rows: MediaRow[]): MediaItem[] {
  return [...rows].sort(byPosition).map(({ id, kind, caption }) => ({ id, kind, caption }));
}

function mapLesson(r: LessonRow): Lesson {
  return {
    id: r.id,
    spaceId: r.space_id as Lesson["spaceId"],
    ...(r.group_id ? { groupId: r.group_id } : {}),
    date: r.date,
    time: shortTime(r.time),
    participantIds: r.lesson_participants.map((p) => p.student_id),
    songIds: [...r.lesson_songs].sort(byPosition).map((s) => s.song_id),
    notes: r.notes,
    media: mapMedia(r.media_items),
  };
}

function mapSession(r: SessionRow): Session {
  return {
    id: r.id,
    date: r.date,
    time: shortTime(r.time),
    songIds: [...r.session_songs].sort(byPosition).map((s) => s.song_id),
    notes: r.notes,
    media: mapMedia(r.media_items),
    payments: r.session_payments.map((p) => ({ studentId: p.student_id, amount: p.amount, paid: p.paid })),
  };
}

function mapProject(r: ProjectRow): DanceProject {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    color: r.color,
    participantIds: r.project_participants.map((p) => p.student_id),
    ...(r.main_song_id ? { mainSongId: r.main_song_id } : {}),
    sessions: [...r.sessions].map(mapSession).sort(byDateDesc),
  };
}

export function mapSong(r: SongRow): Song {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    style: r.style,
    ...(r.link ? { link: r.link } : {}),
    ...(r.note ? { note: r.note } : {}),
    titleLang: r.title_lang,
    artistLang: r.artist_lang,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Database error (${what}): ${error.message}`);
}

// ---------- Queries ----------

export async function getSpaces(): Promise<Space[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("spaces").select(SPACE_SELECT).order("position");
  if (error) fail("spaces", error);
  return (data as unknown as SpaceRow[]).map(mapSpace);
}

export async function getSpace(id: string): Promise<Space | undefined> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("spaces").select(SPACE_SELECT).eq("id", id).maybeSingle();
  if (error) fail("space", error);
  return data ? mapSpace(data as unknown as SpaceRow) : undefined;
}

export async function getLessonsForSpace(spaceId: string): Promise<Lesson[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("lessons").select(LESSON_SELECT).eq("space_id", spaceId);
  if (error) fail("lessons", error);
  return (data as unknown as LessonRow[]).map(mapLesson).sort(byDateDesc);
}

/** Lesson counts per space (home page). */
export async function getLessonCounts(): Promise<Record<string, number>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("lessons").select("space_id");
  if (error) fail("lesson counts", error);
  const counts: Record<string, number> = {};
  for (const r of data as { space_id: string }[]) counts[r.space_id] = (counts[r.space_id] ?? 0) + 1;
  return counts;
}

export async function getLesson(spaceId: string, lessonId: string): Promise<Lesson | undefined> {
  if (!isUuid(lessonId)) return undefined;
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("id", lessonId)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (error) fail("lesson", error);
  return data ? mapLesson(data as unknown as LessonRow) : undefined;
}

export async function getProjects(): Promise<DanceProject[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).order("created_at");
  if (error) fail("projects", error);
  return (data as unknown as ProjectRow[]).map(mapProject);
}

export async function getProject(projectId: string): Promise<DanceProject | undefined> {
  if (!isUuid(projectId)) return undefined;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", projectId).maybeSingle();
  if (error) fail("project", error);
  return data ? mapProject(data as unknown as ProjectRow) : undefined;
}

export async function getSongs(): Promise<Song[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("songs").select(SONG_SELECT).order("created_at").order("title");
  if (error) fail("songs", error);
  return (data as unknown as SongRow[]).map(mapSong);
}

export async function getSong(id: string | undefined): Promise<Song | undefined> {
  if (!id || !isUuid(id)) return undefined;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("songs").select(SONG_SELECT).eq("id", id).maybeSingle();
  if (error) fail("song", error);
  return data ? mapSong(data as unknown as SongRow) : undefined;
}

/** URL segments are user input: reject non-UUIDs before they reach Postgres. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
