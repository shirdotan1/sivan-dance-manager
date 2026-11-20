-- =====================================================================
-- Migration 002 — real media files (Cloudflare R2) on media_items
--
-- WHAT: adds four nullable columns to media_items and one partial unique
--       index. No existing row or column is changed, nothing is deleted.
--         storage_key   text         object key in the private R2 bucket
--                                    (lessons/<lessonId>/<uuid>.<ext> or
--                                    sessions/<sessionId>/<uuid>.<ext>)
--         content_type  text         e.g. image/jpeg, video/mp4
--         size_bytes    bigint       size of the uploaded object
--         uploaded_at   timestamptz  set only when the server confirmed the
--                                    upload; NULL + storage_key = pending
--       Rows without storage_key are placeholders (seed data, test
--       project only) and keep working as before.
--
-- WHERE / WHEN: first in the TEST project's SQL Editor, verified through
--       the API; then in PRODUCTION (after a JSON backup) BEFORE deploying
--       the code that reads these columns (i.e. before merging branch
--       feature/real-media). Safe while the current code is live: the
--       columns are additive and nullable.
--
-- SAFE TO RE-RUN: yes — "if not exists" everywhere. A second run changes
--       nothing. It is a single statement list with no explicit
--       transaction, so it behaves the same in the Supabase SQL Editor.
-- =====================================================================

alter table public.media_items add column if not exists storage_key  text;
alter table public.media_items add column if not exists content_type text;
alter table public.media_items add column if not exists size_bytes   bigint;
alter table public.media_items add column if not exists uploaded_at  timestamptz;

-- One row per object; placeholders (NULL key) are not constrained.
create unique index if not exists media_items_storage_key_idx
  on public.media_items (storage_key)
  where storage_key is not null;
