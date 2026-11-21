-- =====================================================================
-- Migration 004 — weekly lesson series (studio spaces) and parent contacts
--
-- WHAT (additive; no existing row or column is changed, nothing deleted):
--   1. New table lesson_series: a weekly slot in a studio space — weekday
--      (0 = Sunday … 6 = Saturday), time, optional group, start date and
--      an optional stop date (NULL = active). Series are never deleted
--      (stopping one keeps its lessons), hence ON DELETE RESTRICT below.
--   2. lessons gets:
--        series_id        the slot it belongs to (NULL = a one-off lesson)
--        series_date      the slot date this row stands for (kept when the
--                         lesson is moved by hand, so a renewal knows the
--                         occurrence exists and never duplicates it)
--        cancelled_at     a cancelled occurrence (never deleted)
--        date_overridden  date moved by hand → slot changes don't touch it
--        time_overridden  time changed by hand → slot changes don't touch it
--      + unique (series_id, series_date): the duplicate-prevention rule,
--        enforced by the database. A full (not partial) unique constraint
--        so renewal can use INSERT … ON CONFLICT (series_id, series_date)
--        DO NOTHING; one-off lessons (NULLs) never conflict.
--      + series_id and series_date are set together or not at all.
--   3. students gets parent_name and parent_phone (optional, '' = none).
--   4. Row Level Security on lesson_series, exactly like every other table:
--      signed-in users only, anonymous revoked. (Supabase grants new
--      tables to anon by default — without this the table would be
--      readable with the public key.)
--
-- WHERE / WHEN: first in the TEST project's SQL Editor (verified through
--       the API, incl. an anonymous read being refused), then in
--       PRODUCTION after a JSON backup, BEFORE deploying the code that
--       reads it (i.e. before merging feature/recurring-and-reminders).
--       Safe while the current code is live: additive, with defaults.
--
-- SAFE TO RE-RUN: yes — "if not exists" / guarded DO blocks throughout.
--       No explicit transaction, so it behaves the same in the SQL Editor.
-- =====================================================================

-- 1. Weekly slots
create table if not exists public.lesson_series (
  id         uuid primary key default gen_random_uuid(),
  space_id   text not null references public.spaces (id) on delete restrict,
  group_id   uuid references public.groups (id) on delete set null,
  weekday    smallint not null check (weekday between 0 and 6),
  time       time not null,
  starts_on  date not null,
  stops_on   date,
  created_at timestamptz not null default now(),
  check (stops_on is null or stops_on >= starts_on)
);
create index if not exists lesson_series_space_idx on public.lesson_series (space_id);

-- 2. Lessons as occurrences
alter table public.lessons add column if not exists series_id uuid references public.lesson_series (id) on delete restrict;
alter table public.lessons add column if not exists series_date date;
alter table public.lessons add column if not exists cancelled_at timestamptz;
alter table public.lessons add column if not exists date_overridden boolean not null default false;
alter table public.lessons add column if not exists time_overridden boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lessons_series_occurrence_key' and conrelid = 'public.lessons'::regclass) then
    alter table public.lessons add constraint lessons_series_occurrence_key unique (series_id, series_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lessons_series_pair_check' and conrelid = 'public.lessons'::regclass) then
    alter table public.lessons add constraint lessons_series_pair_check check ((series_id is null) = (series_date is null));
  end if;
end $$;

-- 3. Parent contacts
alter table public.students add column if not exists parent_name  text not null default '';
alter table public.students add column if not exists parent_phone text not null default '';

-- 4. Row Level Security on the new table (same policy as every table)
alter table public.lesson_series enable row level security;
revoke all on public.lesson_series from anon;
grant select, insert, update, delete on public.lesson_series to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_series' and policyname = 'signed-in full access') then
    create policy "signed-in full access" on public.lesson_series for all to authenticated using (true) with check (true);
  end if;
end $$;
