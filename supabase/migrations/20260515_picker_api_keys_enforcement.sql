-- FWD picker key enforcement support.
-- Safe to run on an existing FWD database.

alter table if exists public.picker_api_keys
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists picker_api_keys_public_key_idx
  on public.picker_api_keys (public_key);

create index if not exists picker_api_keys_user_id_idx
  on public.picker_api_keys (user_id);
