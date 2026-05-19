-- Remix metadata columns on fwd_gifs
-- Phase 1: metadata-based remixes (same source media, new record with overlay metadata)
-- These are all nullable so existing GIFs are unaffected.

ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS remixed_from_gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS remixed_from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS remix_caption text;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS remix_style text;   -- 'clean','meme','neon','cinematic','textmessage','reactioncam'
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS remix_mood text;    -- 'funny','petty','flirty','shocked','dramatic','celebration'
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS is_remix boolean NOT NULL DEFAULT false;

-- Index to quickly query "remixes of this GIF"
CREATE INDEX IF NOT EXISTS fwd_gifs_remixed_from_idx ON public.fwd_gifs (remixed_from_gif_id);

-- Index for is_remix queries on the feed
CREATE INDEX IF NOT EXISTS fwd_gifs_is_remix_idx ON public.fwd_gifs (is_remix);

-- RLS is already enabled on fwd_gifs from prior migrations.
-- Existing policies already allow:
--   SELECT where visibility = 'public'          (anon + authenticated)
--   INSERT/UPDATE/DELETE where owner = auth.uid()
-- No additional policies needed — remix GIFs are just new fwd_gifs rows with is_remix=true.
-- Public remixes have visibility='public' and are already readable by all.
-- Private remixes have visibility='private' and are only readable by the owner.
