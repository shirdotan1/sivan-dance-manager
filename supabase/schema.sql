-- =====================================================================
-- Sivan dance manager — database schema (Supabase / Postgres)
--
-- !!! WARNING — DESTRUCTIVE !!!
-- This file DROPS EVERY APP TABLE AND ALL OF ITS DATA before creating
-- them again. It is meant for a ONE-TIME setup of a NEW, EMPTY Supabase
-- project only. NEVER run it again once real data has been entered:
-- students, lessons, sessions and payments would be deleted permanently.
--
-- Setup order (new project only): schema.sql, then seed.sql.
-- =====================================================================

drop table if exists public.media_items cascade;
drop table if exists public.session_songs cascade;
drop table if exists public.session_payments cascade;
drop table if exists public.sessions cascade;
drop table if exists public.project_participants cascade;
drop table if exists public.projects cascade;
drop table if exists public.lesson_songs cascade;
drop table if exists public.lesson_participants cascade;
drop table if exists public.lessons cascade;
drop table if exists public.songs cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.students cascade;
drop table if exists public.spaces cascade;

-- ---------- Spaces (three fixed rows) ----------
create table public.spaces (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('studio', 'private')),
  description text not null default '',
  position    int  not null default 0
);

-- ---------- Students (each space has its own pool) ----------
-- Removing a student from the pool sets archived_at; rows are never deleted,
-- so past lessons, sessions and payments keep her name.
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  space_id    text not null references public.spaces (id) on delete restrict,
  name        text not null check (length(btrim(name)) > 0),
  phone       text not null default '',
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create index students_space_idx on public.students (space_id) where archived_at is null;

-- ---------- Groups (studio spaces) ----------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  space_id   text not null references public.spaces (id) on delete restrict,
  name       text not null check (length(btrim(name)) > 0),
  color      text not null,
  created_at timestamptz not null default now()
);
create index groups_space_idx on public.groups (space_id);

create table public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  primary key (group_id, student_id)
);

-- ---------- Song bank ----------
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) > 0),
  artist      text not null default '',
  style       text not null default '',
  link        text,
  note        text,
  title_lang  text not null default 'he' check (title_lang in ('he', 'en')),
  artist_lang text not null default 'he' check (artist_lang in ('he', 'en')),
  created_at  timestamptz not null default now()
);

-- ---------- Studio lessons ----------
create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  space_id   text not null references public.spaces (id) on delete restrict,
  -- The lesson's group (optional): drives its calendar color and label.
  group_id   uuid references public.groups (id) on delete set null,
  date       date not null,
  time       time not null,
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index lessons_space_date_idx on public.lessons (space_id, date, time);
create index lessons_date_idx on public.lessons (date);

create table public.lesson_participants (
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  primary key (lesson_id, student_id)
);
create index lesson_participants_student_idx on public.lesson_participants (student_id);

create table public.lesson_songs (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  song_id   uuid not null references public.songs (id) on delete cascade,
  position  int  not null default 0,
  primary key (lesson_id, song_id)
);
create index lesson_songs_song_idx on public.lesson_songs (song_id);

-- ---------- Private dance projects ----------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  space_id     text not null references public.spaces (id) on delete restrict,
  name         text not null check (length(btrim(name)) > 0),
  type         text not null check (type in ('solo', 'group')),
  main_song_id uuid references public.songs (id) on delete set null,
  color        text not null,
  created_at   timestamptz not null default now()
);

create table public.project_participants (
  project_id uuid not null references public.projects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  primary key (project_id, student_id)
);
create index project_participants_student_idx on public.project_participants (student_id);

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  date       date not null,
  time       time not null,
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index sessions_project_date_idx on public.sessions (project_id, date, time);
create index sessions_date_idx on public.sessions (date);

-- One row per participant per session; "remaining" = amount when not paid.
create table public.session_payments (
  session_id uuid    not null references public.sessions (id) on delete cascade,
  student_id uuid    not null references public.students (id) on delete restrict,
  amount     int     not null default 0 check (amount >= 0),
  paid       boolean not null default false,
  primary key (session_id, student_id)
);
create index session_payments_student_idx on public.session_payments (student_id);
create index session_payments_unpaid_idx on public.session_payments (session_id) where not paid;

create table public.session_songs (
  session_id uuid not null references public.sessions (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  position   int  not null default 0,
  primary key (session_id, song_id)
);
create index session_songs_song_idx on public.session_songs (song_id);

-- ---------- Media placeholders (lesson OR session) ----------
create table public.media_items (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid references public.lessons (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete cascade,
  kind       text not null check (kind in ('photo', 'video')),
  caption    text not null default '',
  position   int  not null default 0,
  check (num_nonnulls(lesson_id, session_id) = 1)
);
create index media_lesson_idx on public.media_items (lesson_id);
create index media_session_idx on public.media_items (session_id);

-- =====================================================================
-- Row Level Security: only a signed-in user (Sivan — sign-ups are
-- disabled in Supabase Auth) can read or write. Anonymous: no access.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'spaces', 'students', 'groups', 'group_members', 'songs',
    'lessons', 'lesson_participants', 'lesson_songs',
    'projects', 'project_participants', 'sessions', 'session_payments',
    'session_songs', 'media_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "signed-in full access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
