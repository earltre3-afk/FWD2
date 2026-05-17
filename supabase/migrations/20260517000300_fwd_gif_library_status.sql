-- Add library_status and last_used_at to saved_gifs for cross-platform GIF library tracking
alter table public.saved_gifs
  add column if not exists library_status text not null default 'saved'
    check (library_status in ('saved', 'recent', 'created', 'unsaved', 'favorite')),
  add column if not exists last_used_at timestamptz;

create index if not exists saved_gifs_user_library_status_idx
  on public.saved_gifs (user_id, library_status);

create index if not exists saved_gifs_user_last_used_at_idx
  on public.saved_gifs (user_id, last_used_at desc nulls last);
