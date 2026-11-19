import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { shortTime } from "@/lib/format";
import { NEUTRAL_COLOR } from "@/lib/palette";
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
 * Ordering: pools/groups/songs/projects by creation time; participants and
 * payments in pool order; lessons and sessions newest first.
 */

// ---------- Row shapes (only the columns we select) ----------

/** A link row to a student, with the student's creation time for pool ordering. */
interface StudentRef { student_id: string; students: { created_at: string } | null }
interface StudentRow { id: string; name: string; phone: string; archived_at: string | null; created_at: string }
interface GroupRow { id: string; name: string; color: string; created_at: string; group_members: StudentRef[] }
interface SpaceRow {
  id: string; name: string; kind: "studio" | "private"; description: string;
  students: StudentRow[]; groups: GroupRow[];
}
interface MediaRow { id: string; kind: "photo" | "video"; caption: string; position: number }
interface SongLinkRow { song_id: string; position: number }
interface LessonRow {
  id: string; space_id: string; group_id: string | null; date: string; time: string; notes: string;
  lesson_participants: StudentRef[]; lesson_songs: SongLinkRow[]; media_items: MediaRow[];
}
interface SessionRow {
  id: string; date: string; time: string; notes: string;
  session_payments: (StudentRef & { amount: number; paid: boolean })[];
  session_songs: SongLinkRow[]; media_items: MediaRow[];
}
interface ProjectRow {
  id: string; name: string; type: "solo" | "group"; color: string; main_song_id: string | null;
  project_participants: StudentRef[]; sessions: SessionRow[];
}
interface SongRow {
  id: string; title: string; artist: string; style: string; link: string | null; note: string | null;
  title_lang: "he" | "en"; artist_lang: "he" | "en";
}

// ---------- Selects ----------

const STUDENT_REF = "student_id, students(created_at)";
const SPACE_SELECT = `id, name, kind, description, students(id, name, phone, archived_at, created_at), groups(id, name, color, created_at, group_members(${STUDENT_REF}))`;
const LESSON_SELECT = `id, space_id, group_id, date, time, notes, lesson_participants(${STUDENT_REF}), lesson_songs(song_id, position), media_items(id, kind, caption, position)`;
const SESSION_SELECT = `id, date, time, notes, session_payments(${STUDENT_REF}, amount, paid), session_songs(song_id, position), media_items(id, kind, caption, position)`;
const PROJECT_SELECT = `id, name, type, color, main_song_id, created_at, project_participants(${STUDENT_REF}), sessions(${SESSION_SELECT})`;
const SONG_SELECT = "id, title, artist, style, link, note, title_lang, artist_lang";

// ---------- Mappers ----------

/** Pools, groups, songs and projects keep their creation order (new ones last). */
const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
/** Participants and payments follow the pool's order. */
function inPoolOrder<T extends StudentRef>(refs: T[]): T[] {
  const key = (r: StudentRef) => r.students?.created_at ?? "";
  return [...refs].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
const byDateDesc = (a: { date: string; time: string }, b: { date: string; time: string }) =>
  a.date + a.time < b.date + b.time ? 1 : a.date + a.time > b.date + b.time ? -1 : 0;

function mapStudent(r: StudentRow): Student {
  return { id: r.id, name: r.name, phone: r.phone, ...(r.archived_at ? { archived: true } : {}) };
}

function mapGroup(r: GroupRow): Group {
  return { id: r.id, name: r.name, color: r.color, studentIds: inPoolOrder(r.group_members).map((m) => m.student_id) };
}

function mapSpace(r: SpaceRow): Space {
  const base = { name: r.name, description: r.description, students: [...r.students].sort(byCreated).map(mapStudent) };
  if (r.kind === "studio") {
    return { ...base, id: r.id as StudioSpace["id"], kind: "studio", groups: [...r.groups].sort(byCreated).map(mapGroup) };
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
    participantIds: inPoolOrder(r.lesson_participants).map((p) => p.student_id),
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
    payments: inPoolOrder(r.session_payments).map((p) => ({ studentId: p.student_id, amount: p.amount, paid: p.paid })),
  };
}

function mapProject(r: ProjectRow): DanceProject {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    color: r.color,
    participantIds: inPoolOrder(r.project_participants).map((p) => p.student_id),
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
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).order("created_at").order("id");
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
  const { data, error } = await supabase.from("songs").select(SONG_SELECT).order("created_at").order("id");
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

// ---------- Calendar ----------

export interface CalendarEvent {
  id: string;
  kind: "lesson" | "session";
  date: string;
  time: string;
  /** Group / project name (or the space name for a lesson without a group). */
  label: string;
  /** Where it happens: space name (lessons) or "שיעורים פרטיים" (sessions). */
  context: string;
  color: string;
  href: string;
}

export interface LegendItem {
  id: string;
  name: string;
  color: string;
  context: string;
}

/** Lessons and sessions between two dates (inclusive), sorted by date and time. */
export async function getCalendarEvents(first: string, last: string): Promise<CalendarEvent[]> {
  const { supabase } = await requireUser();
  const [lessons, sessions, spaces] = await Promise.all([
    supabase.from("lessons").select("id, space_id, date, time, groups(name, color)").gte("date", first).lte("date", last),
    supabase.from("sessions").select("id, date, time, projects(id, name, color)").gte("date", first).lte("date", last),
    supabase.from("spaces").select("id, name"),
  ]);
  if (lessons.error) fail("calendar lessons", lessons.error);
  if (sessions.error) fail("calendar sessions", sessions.error);
  const spaceName = new Map((spaces.data ?? []).map((s) => [s.id as string, s.name as string]));

  type LessonRow = { id: string; space_id: string; date: string; time: string; groups: { name: string; color: string } | null };
  type SessionRow = { id: string; date: string; time: string; projects: { id: string; name: string; color: string } | null };

  const events: CalendarEvent[] = [
    ...(lessons.data as unknown as LessonRow[]).map((l) => ({
      id: l.id,
      kind: "lesson" as const,
      date: l.date,
      time: shortTime(l.time),
      label: l.groups?.name ?? spaceName.get(l.space_id) ?? "שיעור",
      context: spaceName.get(l.space_id) ?? "",
      color: l.groups?.color ?? NEUTRAL_COLOR,
      href: `/spaces/${l.space_id}/lessons/${l.id}`,
    })),
    ...(sessions.data as unknown as SessionRow[])
      .filter((s) => s.projects)
      .map((s) => ({
        id: s.id,
        kind: "session" as const,
        date: s.date,
        time: shortTime(s.time),
        label: s.projects!.name,
        context: spaceName.get("private-lessons") ?? "שיעורים פרטיים",
        color: s.projects!.color,
        href: `/spaces/private-lessons/projects/${s.projects!.id}/sessions/${s.id}`,
      })),
  ];
  return events.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
}

/** Color legend: every group (studio spaces) and project, with where it belongs. */
export async function getCalendarLegend(): Promise<LegendItem[]> {
  const { supabase } = await requireUser();
  const [groups, projects, spaces] = await Promise.all([
    supabase.from("groups").select("id, name, color, space_id, created_at").order("created_at"),
    supabase.from("projects").select("id, name, color, created_at").order("created_at"),
    supabase.from("spaces").select("id, name"),
  ]);
  if (groups.error) fail("legend groups", groups.error);
  if (projects.error) fail("legend projects", projects.error);
  const spaceName = new Map((spaces.data ?? []).map((s) => [s.id as string, s.name as string]));
  return [
    ...(groups.data ?? []).map((g) => ({ id: g.id, name: g.name, color: g.color, context: spaceName.get(g.space_id) ?? "" })),
    ...(projects.data ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color, context: spaceName.get("private-lessons") ?? "" })),
  ];
}
