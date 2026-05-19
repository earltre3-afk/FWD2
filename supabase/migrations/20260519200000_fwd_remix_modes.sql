-- FWD Remix mode, layout, and AI recipe columns
-- Safe: all ADD COLUMN IF NOT EXISTS with defaults or nullable. No RLS changes. No data drops.

ALTER TABLE public.fwd_gifs
  ADD COLUMN IF NOT EXISTS remix_mode        text          DEFAULT 'reaction',
  ADD COLUMN IF NOT EXISTS remix_media_url   text,
  ADD COLUMN IF NOT EXISTS remix_media_type  text,
  ADD COLUMN IF NOT EXISTS remix_layout      jsonb,
  ADD COLUMN IF NOT EXISTS remix_ai_recipe   jsonb,
  ADD COLUMN IF NOT EXISTS remix_tags        text[]        DEFAULT '{}';

COMMENT ON COLUMN public.fwd_gifs.remix_mode       IS 'Applied remix render mode: reaction | split | replace | text';
COMMENT ON COLUMN public.fwd_gifs.remix_media_url  IS 'Public URL of the user-uploaded replacement media for this remix';
COMMENT ON COLUMN public.fwd_gifs.remix_media_type IS 'MIME type of remix_media_url (e.g. image/png, video/mp4)';
COMMENT ON COLUMN public.fwd_gifs.remix_layout     IS 'Placement/shape JSON for overlay rendering: { placement, overlayShape, scale, captionPlacement }';
COMMENT ON COLUMN public.fwd_gifs.remix_ai_recipe  IS 'Full AI remix recipe JSON if AI Blend was used';
COMMENT ON COLUMN public.fwd_gifs.remix_tags       IS 'Tags suggested by AI recipe or set by user for this remix';
