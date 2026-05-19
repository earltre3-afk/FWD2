-- Add edit metadata columns to fwd_gifs table

ALTER TABLE public.fwd_gifs
  ADD COLUMN IF NOT EXISTS trim_start numeric,
  ADD COLUMN IF NOT EXISTS trim_end numeric,
  ADD COLUMN IF NOT EXISTS original_duration numeric,
  ADD COLUMN IF NOT EXISTS edited_duration numeric,
  ADD COLUMN IF NOT EXISTS crop_x numeric,
  ADD COLUMN IF NOT EXISTS crop_y numeric,
  ADD COLUMN IF NOT EXISTS crop_width numeric,
  ADD COLUMN IF NOT EXISTS crop_height numeric,
  ADD COLUMN IF NOT EXISTS crop_aspect_ratio text,
  ADD COLUMN IF NOT EXISTS output_aspect_ratio text,
  ADD COLUMN IF NOT EXISTS edit_metadata jsonb;

-- Recreate the user_gifs view to include the new columns
DROP VIEW IF EXISTS public.user_gifs;

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
  webm_url,
  trim_start,
  trim_end,
  original_duration,
  edited_duration,
  crop_x,
  crop_y,
  crop_width,
  crop_height,
  crop_aspect_ratio,
  output_aspect_ratio,
  edit_metadata
FROM public.fwd_gifs;

GRANT SELECT ON public.user_gifs TO anon, authenticated;
