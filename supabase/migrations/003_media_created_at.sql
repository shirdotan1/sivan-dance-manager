-- =====================================================================
-- Migration 003 — creation time on media_items
--
-- WHAT: adds media_items.created_at (timestamptz, not null, default now()).
--       Existing rows get the time of the migration. No other column or
--       row is changed, nothing is deleted. Used to remove uploads left
--       pending for more than 24 hours (a closed browser mid-upload),
--       together with their stored objects.
--
-- WHERE / WHEN: first in the TEST project's SQL Editor, verified through
--       the API; then in PRODUCTION together with 002 (after a JSON
--       backup), BEFORE deploying the code that reads it (i.e. before
--       merging branch feature/real-media). Safe while the current code is
--       live: additive, with a default.
--
-- SAFE TO RE-RUN: yes — "if not exists". A second run changes nothing.
--       No explicit transaction, so it behaves the same in the SQL Editor.
-- =====================================================================

alter table public.media_items
  add column if not exists created_at timestamptz not null default now();

-- Finding stale pending uploads quickly (only rows with a key and no confirmation).
create index if not exists media_items_pending_idx
  on public.media_items (created_at)
  where storage_key is not null and uploaded_at is null;
