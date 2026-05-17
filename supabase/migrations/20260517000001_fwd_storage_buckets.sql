-- Create fwd-gifs public bucket for final user-created GIFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fwd-gifs',
  'fwd-gifs',
  true,
  52428800, -- 50 MB
  ARRAY['image/gif', 'image/webp', 'image/png', 'image/jpeg', 'video/webm', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/gif', 'image/webp', 'image/png', 'image/jpeg', 'video/webm', 'video/mp4'];

-- Fix fwd-uploads to be private (owner-only)
UPDATE storage.buckets SET public = false WHERE id = 'fwd-uploads';

-- fwd-gifs: anyone can read (public GIFs feed)
CREATE POLICY "Public read fwd-gifs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fwd-gifs');

-- fwd-gifs: authenticated users upload into their own uid folder
CREATE POLICY "Authenticated upload to fwd-gifs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fwd-gifs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- fwd-gifs: owners can delete their own GIFs
CREATE POLICY "Owners delete own fwd-gifs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fwd-gifs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- fwd-gifs: owners can update their own GIFs
CREATE POLICY "Owners update own fwd-gifs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fwd-gifs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
