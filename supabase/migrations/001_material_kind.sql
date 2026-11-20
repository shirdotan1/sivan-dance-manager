-- =====================================================================
-- Migration 001 — material kind on songs
--
-- WHAT: adds songs.kind with the values 'song', 'video', 'link', 'note'
--       (default 'song'). Every existing row becomes 'song'. The table
--       keeps its name (songs); the UI calls these "materials".
--
-- WHEN: run BEFORE deploying the code that reads songs.kind (branch
--       feature/materials-and-polish), first on the TEST project, then on
--       PRODUCTION. Safe to run while the current code is live: the
--       column is additive and has a default, so nothing existing breaks.
--
-- SAFE TO RE-RUN: yes. Running it a second time changes nothing.
-- DOES NOT touch any data other than adding the column default.
-- =====================================================================

alter table public.songs
  add column if not exists kind text not null default 'song';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'songs_kind_check' and conrelid = 'public.songs'::regclass
  ) then
    alter table public.songs
      add constraint songs_kind_check check (kind in ('song', 'video', 'link', 'note'));
  end if;
end $$;
