-- Ensure the storage buckets used by the app exist.
-- Supabase Storage uploads fail with "bucket not found" unless the bucket row
-- is present in storage.buckets before the browser upload starts.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'fwd-uploads',
    'fwd-uploads',
    true,
    52428800,
    array[
      'image/gif',
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/webm',
      'video/mp4',
      'video/quicktime'
    ]
  ),
  (
    'profile-media',
    'profile-media',
    true,
    10485760,
    array[
      'image/gif',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- Public buckets can serve public URLs without a broad SELECT policy. Drop any
-- broad read/list policies so clients cannot enumerate bucket contents.
drop policy if exists "FWD uploads are public" on storage.objects;
drop policy if exists "Public can read uploads" on storage.objects;

drop policy if exists "Users upload own FWD media" on storage.objects;
create policy "Users upload own FWD media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fwd-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own FWD media" on storage.objects;
create policy "Users update own FWD media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fwd-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fwd-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own FWD media" on storage.objects;
create policy "Users delete own FWD media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fwd-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile media is public" on storage.objects;

drop policy if exists "Users upload own profile media" on storage.objects;
create policy "Users upload own profile media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own profile media" on storage.objects;
create policy "Users update own profile media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own profile media" on storage.objects;
create policy "Users delete own profile media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
