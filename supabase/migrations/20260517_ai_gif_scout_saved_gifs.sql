ALTER TABLE public.saved_gifs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_gif_id text,
  ADD COLUMN IF NOT EXISTS original_query text,
  ADD COLUMN IF NOT EXISTS ai_scout_query text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS mp4_url text,
  ADD COLUMN IF NOT EXISTS webm_url text,
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS attribution text,
  ADD COLUMN IF NOT EXISTS rating text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

UPDATE public.saved_gifs
SET
  provider = COALESCE(provider, source_type, 'legacy'),
  provider_gif_id = COALESCE(provider_gif_id, gif_id::text, md5(source_url)),
  preview_url = COALESCE(preview_url, thumbnail_url, source_url),
  media_url = COALESCE(media_url, source_url),
  gif_url = COALESCE(gif_url, source_url),
  poster_url = COALESCE(poster_url, thumbnail_url),
  metadata = COALESCE(metadata, '{}'::jsonb)
WHERE provider IS NULL
   OR provider_gif_id IS NULL
   OR preview_url IS NULL
   OR media_url IS NULL
   OR gif_url IS NULL
   OR metadata IS NULL;

ALTER TABLE public.saved_gifs
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN provider_gif_id SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

CREATE INDEX IF NOT EXISTS saved_gifs_user_id_created_at_idx
  ON public.saved_gifs (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS saved_gifs_user_provider_provider_gif_id_idx
  ON public.saved_gifs (user_id, provider, provider_gif_id);

CREATE INDEX IF NOT EXISTS saved_gifs_provider_provider_gif_id_idx
  ON public.saved_gifs (provider, provider_gif_id);

CREATE INDEX IF NOT EXISTS saved_gifs_original_query_idx
  ON public.saved_gifs (original_query);

ALTER TABLE public.saved_gifs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_gifs TO authenticated;

DROP POLICY IF EXISTS "Users can read own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can read own saved gifs"
  ON public.saved_gifs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can create own saved gifs"
  ON public.saved_gifs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can update own saved gifs"
  ON public.saved_gifs FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can delete own saved gifs"
  ON public.saved_gifs FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
