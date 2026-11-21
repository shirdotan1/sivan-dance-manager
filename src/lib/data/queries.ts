import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { connection } from "next/server";
import { addDays, nowTimeIsrael, shortTime, todayIso } from "@/lib/format";
import { NEUTRAL_COLOR } from "@/lib/palette";
import type {
  Project,
  Group,
  Lesson,
  MediaItem,
  PrivateSpace,
  Session,
  Material,
  MaterialKind,
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
interface StudentRow {
  id: string; name: string; phone: string; parent_name: string; parent_phone: string; archived_at: string | null; created_at: string;
}
interface GroupRow { id: string; name: string; color: string; created_at: string; group_members: StudentRef[] }
interface SpaceRow {
  id: string; name: string; kind: "studio" | "private"; description: string;
  students: StudentRow[]; groups: GroupRow[];
}
interface MediaRow { id: string; kind: "photo" | "video"; caption: string; position: number }
interface SongLinkRow { song_id: string; position: number }
interface LessonRow {
  id: string; space_id: string; group_id: string | null; date: string; time: string; notes: string;
  series_id: string | null; series_date: string | null; cancelled_at: string | null;
  date_overridden: boolean; time_overridden: boolean;
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
interface MaterialRow {
  kind: MaterialKind;
  id: string; title: string; artist: string; style: string; link: string | null; note: string | null;
  title_lang: "he" | "en"; artist_lang: "he" | "en";
}

// ---------- Selects ----------

const STUDENT_REF = "student_id, students(created_at)";
const SPACE_SELECT = `id, name, kind, description, students(id, name, phone, parent_name, parent_phone, archived_at, created_at), groups(id, name, color, created_at, group_members(${STUDENT_REF}))`;
const LESSON_SELECT = `id, space_id, group_id, date, time, notes, series_id, series_date, cancelled_at, date_overridden, time_overridden, lesson_participants(${STUDENT_REF}), lesson_songs(song_id, position), media_items(id, kind, caption, position)`;
const SESSION_SELECT = `id, date, time, notes, session_payments(${STUDENT_REF}, amount, paid), session_songs(song_id, position), media_items(id, kind, caption, position)`;
const PROJECT_SELECT = `id, name, type, color, main_song_id, created_at, project_participants(${STUDENT_REF}), sessions(${SESSION_SELECT})`;
const MATERIAL_SELECT = "id, kind, title, artist, style, link, note, title_lang, artist_lang";

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
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    ...(r.parent_name ? { parentName: r.parent_name } : {}),
    ...(r.parent_phone ? { parentPhone: r.parent_phone } : {}),
    ...(r.archived_at ? { archived: true } : {}),
  };
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
    materialIds: [...r.lesson_songs].sort(byPosition).map((s) => s.song_id),
    notes: r.notes,
    media: mapMedia(r.media_items),
    ...(r.series_id ? { seriesId: r.series_id, seriesDate: r.series_date! } : {}),
    ...(r.cancelled_at ? { cancelled: true } : {}),
    ...(r.date_overridden ? { dateOverridden: true } : {}),
    ...(r.time_overridden ? { timeOverridden: true } : {}),
  };
}

function mapSession(r: SessionRow): Session {
  return {
    id: r.id,
    date: r.date,
    time: shortTime(r.time),
    materialIds: [...r.session_songs].sort(byPosition).map((s) => s.song_id),
    notes: r.notes,
    media: mapMedia(r.media_items),
    payments: inPoolOrder(r.session_payments).map((p) => ({ studentId: p.student_id, amount: p.amount, paid: p.paid })),
  };
}

function mapProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    color: r.color,
    participantIds: inPoolOrder(r.project_participants).map((p) => p.student_id),
    ...(r.main_song_id ? { mainMaterialId: r.main_song_id } : {}),
    sessions: [...r.sessions].map(mapSession).sort(byDateDesc),
  };
}

export function mapMaterial(r: MaterialRow): Material {
  return {
    id: r.id,
    kind: r.kind,
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

/** Lessons that took place, per space (home page): up to today, not cancelled — future envelopes don't count. */
export async function getLessonCounts(): Promise<Record<string, number>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("lessons").select("space_id").lte("date", todayIso()).is("cancelled_at", null);
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

export async function getProjects(): Promise<Project[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).order("created_at").order("id");
  if (error) fail("projects", error);
  return (data as unknown as ProjectRow[]).map(mapProject);
}

export async function getProject(projectId: string): Promise<Project | undefined> {
  if (!isUuid(projectId)) return undefined;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", projectId).maybeSingle();
  if (error) fail("project", error);
  return data ? mapProject(data as unknown as ProjectRow) : undefined;
}

export async function getMaterials(): Promise<Material[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("songs").select(MATERIAL_SELECT).order("created_at").order("id");
  if (error) fail("songs", error);
  return (data as unknown as MaterialRow[]).map(mapMaterial);
}

export async function getMaterial(id: string | undefined): Promise<Material | undefined> {
  if (!id || !isUuid(id)) return undefined;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("songs").select(MATERIAL_SELECT).eq("id", id).maybeSingle();
  if (error) fail("song", error);
  return data ? mapMaterial(data as unknown as MaterialRow) : undefined;
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
  /** A cancelled lesson occurrence (shown as cancelled, never "next up"). */
  cancelled?: boolean;
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
    supabase.from("lessons").select("id, space_id, date, time, cancelled_at, groups(name, color)").gte("date", first).lte("date", last),
    supabase.from("sessions").select("id, date, time, projects(id, name, color)").gte("date", first).lte("date", last),
    supabase.from("spaces").select("id, name"),
  ]);
  if (lessons.error) fail("calendar lessons", lessons.error);
  if (sessions.error) fail("calendar sessions", sessions.error);
  const spaceName = new Map((spaces.data ?? []).map((s) => [s.id as string, s.name as string]));

  type LessonRow = {
    id: string; space_id: string; date: string; time: string; cancelled_at: string | null;
    groups: { name: string; color: string } | null;
  };
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
      ...(l.cancelled_at ? { cancelled: true } : {}),
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

// ---------- Open payments (private space) ----------

export interface OpenPayment {
  sessionId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  /** Unpaid amount (the full amount: payments are paid / not paid). */
  remaining: number;
}

/** Every unpaid payment across all projects, oldest session first. */
export async function getOpenPayments(): Promise<OpenPayment[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("session_payments")
    .select("amount, student_id, students(name), sessions(id, date, time, projects(id, name, color))")
    .eq("paid", false)
    .gt("amount", 0);
  if (error) fail("open payments", error);
  type Row = {
    amount: number;
    student_id: string;
    students: { name: string } | null;
    sessions: { id: string; date: string; time: string; projects: { id: string; name: string; color: string } | null } | null;
  };
  return (data as unknown as Row[])
    .filter((r) => r.sessions?.projects)
    .map((r) => ({
      sessionId: r.sessions!.id,
      projectId: r.sessions!.projects!.id,
      projectName: r.sessions!.projects!.name,
      projectColor: r.sessions!.projects!.color,
      studentId: r.student_id,
      studentName: r.students?.name ?? "תלמידה",
      date: r.sessions!.date,
      time: shortTime(r.sessions!.time),
      remaining: r.amount,
    }))
    .sort((a, b) => {
      const ka = a.date + a.time, kb = b.date + b.time;
      return ka < kb ? -1 : ka > kb ? 1 : a.studentName.localeCompare(b.studentName, "he");
    });
}

// ---------- Student card ----------

export interface StudentCard {
  student: Student & { spaceId: string; spaceName: string; spaceKind: "studio" | "private" };
  groups: { id: string; name: string; color: string }[];
  lessons: { id: string; date: string; time: string; groupName?: string; color: string; href: string }[];
  sessions: {
    id: string;
    date: string;
    time: string;
    projectId: string;
    projectName: string;
    color: string;
    href: string;
    payment?: { amount: number; paid: boolean };
  }[];
  projects: { id: string; name: string; color: string }[];
}

export async function getStudentCard(studentId: string): Promise<StudentCard | undefined> {
  if (!isUuid(studentId)) return undefined;
  const { supabase } = await requireUser();
  const { data: s, error } = await supabase
    .from("students")
    .select("id, name, phone, archived_at, space_id, spaces(name, kind)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) fail("student", error);
  if (!s) return undefined;
  const space = (s as unknown as { spaces: { name: string; kind: "studio" | "private" } }).spaces;

  const [groups, lessons, projects, payments] = await Promise.all([
    supabase.from("group_members").select("groups(id, name, color)").eq("student_id", studentId),
    supabase.from("lesson_participants").select("lessons(id, space_id, date, time, groups(name, color))").eq("student_id", studentId),
    supabase.from("project_participants").select("projects(id, name, color, sessions(id, date, time))").eq("student_id", studentId),
    supabase.from("session_payments").select("session_id, amount, paid").eq("student_id", studentId),
  ]);
  for (const r of [groups, lessons, projects, payments]) if (r.error) fail("student card", r.error);

  type G = { groups: { id: string; name: string; color: string } | null };
  type L = { lessons: { id: string; space_id: string; date: string; time: string; groups: { name: string; color: string } | null } | null };
  type P = { projects: { id: string; name: string; color: string; sessions: { id: string; date: string; time: string }[] } | null };
  const payBySession = new Map(
    (payments.data as { session_id: string; amount: number; paid: boolean }[]).map((p) => [p.session_id, { amount: p.amount, paid: p.paid }]),
  );
  const newestFirst = <T extends { date: string; time: string }>(a: T, b: T) => (a.date + a.time < b.date + b.time ? 1 : -1);
  const projectRows = (projects.data as unknown as P[]).flatMap((r) => (r.projects ? [r.projects] : []));

  return {
    student: {
      id: s.id,
      name: s.name,
      phone: s.phone,
      ...(s.archived_at ? { archived: true } : {}),
      spaceId: s.space_id,
      spaceName: space?.name ?? "",
      spaceKind: space?.kind ?? "studio",
    },
    groups: (groups.data as unknown as G[]).flatMap((r) => (r.groups ? [r.groups] : [])),
    lessons: (lessons.data as unknown as L[])
      .flatMap((r) => (r.lessons ? [r.lessons] : []))
      .map((l) => ({
        id: l.id,
        date: l.date,
        time: shortTime(l.time),
        ...(l.groups ? { groupName: l.groups.name } : {}),
        color: l.groups?.color ?? NEUTRAL_COLOR,
        href: `/spaces/${l.space_id}/lessons/${l.id}`,
      }))
      .sort(newestFirst),
    sessions: projectRows
      .flatMap((p) =>
        p.sessions.map((se) => ({
          id: se.id,
          date: se.date,
          time: shortTime(se.time),
          projectId: p.id,
          projectName: p.name,
          color: p.color,
          href: `/spaces/private-lessons/projects/${p.id}/sessions/${se.id}`,
          ...(payBySession.has(se.id) ? { payment: payBySession.get(se.id)! } : {}),
        })),
      )
      .sort(newestFirst),
    projects: projectRows.map(({ id, name, color }) => ({ id, name, color })),
  };
}

// ---------- Material usage ----------

export interface MaterialUse {
  href: string;
  date: string;
  label: string;
  kind: "lesson" | "session";
}

/** For each song id: the lessons and sessions that use it, newest first. */
export async function getMaterialUsage(): Promise<Record<string, MaterialUse[]>> {
  const { supabase } = await requireUser();
  const [ls, ss] = await Promise.all([
    supabase.from("lesson_songs").select("song_id, lessons(id, space_id, date, spaces(name), groups(name))"),
    supabase.from("session_songs").select("song_id, sessions(id, date, projects(id, name))"),
  ]);
  if (ls.error) fail("song usage (lessons)", ls.error);
  if (ss.error) fail("song usage (sessions)", ss.error);
  type L = { song_id: string; lessons: { id: string; space_id: string; date: string; spaces: { name: string } | null; groups: { name: string } | null } | null };
  type S = { song_id: string; sessions: { id: string; date: string; projects: { id: string; name: string } | null } | null };
  const usage: Record<string, MaterialUse[]> = {};
  const add = (id: string, u: MaterialUse) => (usage[id] ??= []).push(u);
  for (const r of ls.data as unknown as L[]) {
    if (!r.lessons) continue;
    const l = r.lessons;
    add(r.song_id, {
      kind: "lesson",
      date: l.date,
      href: `/spaces/${l.space_id}/lessons/${l.id}`,
      label: l.groups?.name ? `${l.groups.name} · ${l.spaces?.name ?? ""}` : (l.spaces?.name ?? "שיעור"),
    });
  }
  for (const r of ss.data as unknown as S[]) {
    if (!r.sessions?.projects) continue;
    const s = r.sessions;
    add(r.song_id, {
      kind: "session",
      date: s.date,
      href: `/spaces/private-lessons/projects/${s.projects!.id}/sessions/${s.id}`,
      label: s.projects!.name,
    });
  }
  for (const list of Object.values(usage)) list.sort((a, b) => (a.date < b.date ? 1 : -1));
  return usage;
}

// ---------- Next up (home) ----------

/**
 * The next lesson or session from now (Israel time): later today or on a
 * coming day, within the next ~4 months. Undefined when nothing is planned.
 */
export async function getNextEvent(): Promise<CalendarEvent | undefined> {
  await connection(); // "now" is request-time, never prerendered
  const today = todayIso();
  const now = nowTimeIsrael();
  const events = await getCalendarEvents(today, addDays(today, 120));
  return events.find((e) => !e.cancelled && (e.date > today || e.time >= now));
}
