ALTER TABLE public.fwd_gifs
  ADD COLUMN IF NOT EXISTS source_video_url text,
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image/gif',
  ADD COLUMN IF NOT EXISTS is_animated boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mp4_url text,
  ADD COLUMN IF NOT EXISTS webm_url text;

UPDATE public.fwd_gifs
SET
  media_type = COALESCE(
    media_type,
    CASE
      WHEN COALESCE(gif_url, media_url) ~* '\.gif($|\?)' THEN 'image/gif'
      WHEN COALESCE(gif_url, media_url) ~* '\.(mp4|m4v|mov)($|\?)' THEN 'video/mp4'
      WHEN COALESCE(gif_url, media_url) ~* '\.(webm|ogv|ogg)($|\?)' THEN 'video/webm'
      ELSE 'image/gif'
    END
  ),
  is_animated = COALESCE(is_animated, true)
WHERE media_type IS NULL
   OR is_animated IS NULL;

CREATE OR REPLACE FUNCTION public.fwd_gifs_sync_media_columns()
RETURNS trigger AS $$
BEGIN
  NEW.gif_url := COALESCE(NEW.gif_url, NEW.media_url);
  NEW.media_url := COALESCE(NEW.media_url, NEW.gif_url);
  NEW.media_type := COALESCE(
    NEW.media_type,
    CASE
      WHEN COALESCE(NEW.gif_url, NEW.media_url) ~* '\.gif($|\?)' THEN 'image/gif'
      WHEN COALESCE(NEW.gif_url, NEW.media_url, NEW.source_video_url) ~* '\.(mp4|m4v|mov)($|\?)' THEN 'video/mp4'
      WHEN COALESCE(NEW.gif_url, NEW.media_url, NEW.source_video_url) ~* '\.(webm|ogv|ogg)($|\?)' THEN 'video/webm'
      ELSE 'image/gif'
    END
  );
  NEW.is_animated := COALESCE(NEW.is_animated, NEW.media_type IN ('image/gif', 'video/mp4', 'video/webm', 'video/quicktime'));
  NEW.still_url := COALESCE(NEW.still_url, NEW.preview_url, NEW.thumbnail_url);
  NEW.thumbnail_url := COALESCE(NEW.thumbnail_url, NEW.still_url, NEW.preview_url);
  NEW.preview_url := COALESCE(NEW.preview_url, NEW.still_url, NEW.thumbnail_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW public.user_gifs WITH (security_invoker = true) AS
SELECT
  id,
  owner_user_id AS user_id,
  title,
  COALESCE(gif_url, media_url) AS image_url,
  COALESCE(still_url, thumbnail_url, preview_url) AS still_url,
  tags,
  category,
  mood,
  caption,
  visibility,
  status,
  allow_reuse,
  allow_download,
  reuse_count,
  save_count,
  like_count,
  created_at,
  updated_at,
  (visibility = 'public' AND status = 'approved') AS is_public,
  source_video_url,
  media_type,
  is_animated,
  mp4_url,
  webm_url
FROM public.fwd_gifs;

GRANT SELECT ON public.user_gifs TO anon, authenticated;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/gif',
    'image/webp',
    'image/png',
    'image/jpeg',
    'video/webm',
    'video/mp4',
    'video/quicktime'
  ],
  updated_at = now()
WHERE id = 'fwd-gifs';
