-- =====================================================================
-- Migration 001 — material kind on songs
--
-- WHAT: adds the column songs.kind with the values 'song', 'video',
--       'link', 'note' and the default 'song'. Every existing row gets
--       kind = 'song' (no other column or row is changed, nothing is
--       deleted). The table keeps its name (songs); the UI calls these
--       "materials".
--
-- WHERE / WHEN: in the Supabase SQL Editor of the PRODUCTION project,
--       after downloading a JSON backup from the live site ("ייצוא כל
--       הנתונים"), and BEFORE the code that reads songs.kind is deployed
--       (i.e. before merging branch feature/materials-and-polish).
--       It is safe while the current code is live: the column is additive
--       and has a default, so existing pages and inserts keep working.
--       (Once a separate test project exists, run it there first.)
--
-- SAFE TO RE-RUN: yes — "if not exists" for the column, and the check
--       constraint is only added when missing. A second run changes nothing.
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
